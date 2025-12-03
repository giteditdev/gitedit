import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { emailOTP } from "better-auth/plugins"
import { Resend } from "resend"
import { getAuthDb } from "@/db/connection"
import * as schema from "@/db/schema"

type AuthEnv = {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  APP_BASE_URL?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
}

let cachedAuth: ReturnType<typeof betterAuth> | null = null
let cachedDbUrl = ""

// Get env from Cloudflare context or process.env
const getEnv = (): AuthEnv => {
  let DATABASE_URL: string | undefined
  let BETTER_AUTH_SECRET: string | undefined
  let APP_BASE_URL: string | undefined

  let RESEND_API_KEY: string | undefined
  let RESEND_FROM_EMAIL: string | undefined

  // Try Cloudflare Workers context first (production)
  try {
    const { getServerContext } = require("@tanstack/react-start/server")
    const ctx = getServerContext()
    if (ctx?.cloudflare?.env) {
      const cfEnv = ctx.cloudflare.env as Partial<AuthEnv>
      DATABASE_URL = cfEnv.DATABASE_URL
      BETTER_AUTH_SECRET = cfEnv.BETTER_AUTH_SECRET
      APP_BASE_URL = cfEnv.APP_BASE_URL
      RESEND_API_KEY = cfEnv.RESEND_API_KEY
      RESEND_FROM_EMAIL = cfEnv.RESEND_FROM_EMAIL
    }
  } catch {
    // Not in Cloudflare context
  }

  // Fall back to process.env (local dev)
  DATABASE_URL = DATABASE_URL ?? process.env.DATABASE_URL
  BETTER_AUTH_SECRET = BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET
  APP_BASE_URL = APP_BASE_URL ?? process.env.APP_BASE_URL
  RESEND_API_KEY = RESEND_API_KEY ?? process.env.RESEND_API_KEY
  RESEND_FROM_EMAIL = RESEND_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured")
  }
  if (!BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is not configured")
  }

  return {
    DATABASE_URL,
    BETTER_AUTH_SECRET,
    APP_BASE_URL,
    RESEND_API_KEY,
    RESEND_FROM_EMAIL,
  }
}

export const getAuth = () => {
  const env = getEnv()

  if (!cachedAuth || cachedDbUrl !== env.DATABASE_URL) {
    const db = getAuthDb(env.DATABASE_URL)
    cachedDbUrl = env.DATABASE_URL

    const isDev = process.env.NODE_ENV !== "production"
    const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
    const fromEmail = env.RESEND_FROM_EMAIL ?? "noreply@example.com"

    cachedAuth = betterAuth({
      database: drizzleAdapter(db, {
        provider: "pg",
        usePlural: true,
        schema,
      }),
      trustedOrigins: [env.APP_BASE_URL ?? "http://localhost:3000"],
      plugins: [
        tanstackStartCookies(),
        emailOTP({
          async sendVerificationOTP({ email, otp }) {
            if (isDev || !resend) {
              // In dev mode or if Resend not configured, log OTP to terminal
              console.log("\n" + "=".repeat(50))
              console.log(`🔐 OTP CODE for ${email}`)
              console.log(`   Code: ${otp}`)
              console.log("=".repeat(50) + "\n")
              return
            }

            // Send email via Resend in production
            const { error } = await resend.emails.send({
              from: fromEmail,
              to: email,
              subject: "Your verification code",
              html: `
                <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1e293b; margin-bottom: 16px;">Verification Code</h2>
                  <p style="color: #64748b; margin-bottom: 24px;">Enter this code to sign in:</p>
                  <div style="background: linear-gradient(to right, #0b0c15, #14151c); border-radius: 8px; padding: 16px; text-align: center;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0f172a;">${otp}</span>
                  </div>
                  <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">This code expires in 5 minutes.</p>
                </div>
              `,
            })

            if (error) {
              console.error("[auth] Failed to send OTP email:", error)
              throw new Error("Failed to send verification email")
            }
          },
          otpLength: 6,
          expiresIn: 300, // 5 minutes
        }),
      ],
    })
  }

  return cachedAuth
}

// Lazy proxy that calls getAuth() on each access
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_target, prop) {
    return getAuth()[prop as keyof ReturnType<typeof betterAuth>]
  },
})
