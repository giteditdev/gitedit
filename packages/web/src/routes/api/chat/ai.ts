import { createFileRoute } from "@tanstack/react-router"
import { streamText } from "ai"
import { getAuth } from "@/lib/auth"
import { getDb } from "@/db/connection"
import { chat_messages, chat_threads } from "@/db/schema"
import { getOpenRouter, getDefaultModel } from "@/lib/ai/provider"

export const Route = createFileRoute("/api/chat/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAuth().api.getSession({
          headers: request.headers,
        })
        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          })
        }

        const body = (await request.json().catch(() => ({}))) as {
          threadId?: number | string
          messages?: Array<{ role: "user" | "assistant"; content: string }>
          model?: string
        }

        const threadId = Number(body.threadId)
        const messages = body.messages ?? []
        const model = body.model || getDefaultModel()

        if (!threadId || messages.length === 0) {
          return new Response(
            JSON.stringify({ error: "Missing threadId or messages" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          )
        }

        const db = getDb(process.env.DATABASE_URL!)

        // Verify thread ownership
        const thread = await db.query.chat_threads.findFirst({
          where(fields, { eq }) {
            return eq(fields.id, threadId)
          },
        })

        if (!thread || thread.user_id !== session.user.id) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          })
        }

        const openrouter = getOpenRouter()
        console.log(
          "[ai] openrouter:",
          openrouter ? "configured" : "not configured",
        )
        console.log(
          "[ai] OPENROUTER_API_KEY set:",
          !!process.env.OPENROUTER_API_KEY,
        )
        if (!openrouter) {
          // Fallback to streaming-compatible demo response
          const lastUserMessage = messages
            .filter((m) => m.role === "user")
            .pop()
          const reply = `Demo reply: I received "${lastUserMessage?.content}". Configure OPENROUTER_API_KEY for real responses.`

          // Save the assistant message
          await db.insert(chat_messages).values({
            thread_id: threadId,
            role: "assistant",
            content: reply,
          })

          // Return a streaming-compatible response using AI SDK data stream format
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              // AI SDK data stream format: 0: for text chunks
              controller.enqueue(encoder.encode(`0:${JSON.stringify(reply)}\n`))
              controller.close()
            },
          })

          return new Response(stream, {
            status: 200,
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "x-vercel-ai-data-stream": "v1",
            },
          })
        }

        // Use AI SDK streaming with OpenRouter
        console.log("[ai] calling streamText with model:", model)
        try {
          const result = streamText({
            model: openrouter.chat(model),
            system: "You are a helpful assistant.",
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            async onFinish({ text }) {
              console.log("[ai] onFinish, text length:", text.length)
              // Save the assistant message when streaming completes
              await db.insert(chat_messages).values({
                thread_id: threadId,
                role: "assistant",
                content: text,
              })
            },
          })

          console.log("[ai] returning stream response")
          // Return the streaming response (AI SDK v5 uses toTextStreamResponse)
          return result.toTextStreamResponse()
        } catch (error) {
          console.error("[ai] streamText error:", error)
          throw error
        }
      },
    },
  },
})
