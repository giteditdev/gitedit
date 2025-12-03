import { createFileRoute } from "@tanstack/react-router"
import { getAuth } from "@/lib/auth"
import { prepareElectricUrl, proxyElectricRequest } from "@/lib/electric-proxy"
import { getDb } from "@/db/connection"

const serve = async ({ request }: { request: Request }) => {
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  // Ensure tables exist before proxying
  try {
    const db = getDb(process.env.DATABASE_URL!)
    await db.execute(
      `CREATE TABLE IF NOT EXISTS chat_threads (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        title text NOT NULL,
        user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );`,
    )
    await db.execute(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        thread_id integer NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        role varchar(32) NOT NULL,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );`,
    )
  } catch (error) {
    console.warn("[chat-messages] ensure table failed", error)
  }

  // Get user's thread IDs first
  const db = getDb(process.env.DATABASE_URL!)
  const userThreads = await db.query.chat_threads.findMany({
    where(fields, { eq }) {
      return eq(fields.user_id, session.user.id)
    },
    columns: { id: true },
  })

  const threadIds = userThreads.map((t) => t.id)

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set("table", "chat_messages")

  // Filter messages by user's thread IDs (no subquery)
  if (threadIds.length > 0) {
    originUrl.searchParams.set(
      "where",
      `"thread_id" IN (${threadIds.join(",")})`,
    )
  } else {
    // User has no threads, return empty by filtering impossible condition
    originUrl.searchParams.set("where", `"thread_id" = -1`)
  }

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/chat-messages")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
