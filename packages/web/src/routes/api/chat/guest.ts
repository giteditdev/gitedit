import { createFileRoute } from "@tanstack/react-router"
import { streamText } from "ai"
import { getOpenRouter, getDefaultModel } from "@/lib/ai/provider"

export const Route = createFileRoute("/api/chat/guest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          messages?: Array<{ role: "user" | "assistant"; content: string }>
          model?: string
        }

        const messages = body.messages ?? []
        const model = body.model || getDefaultModel()

        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "Missing messages" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          })
        }

        const openrouter = getOpenRouter()
        if (!openrouter) {
          // Fallback to demo response for guests
          const lastUserMessage = messages
            .filter((m) => m.role === "user")
            .pop()
          const reply = `Demo reply: I received "${lastUserMessage?.content}". Configure OPENROUTER_API_KEY for real responses.`

          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(reply))
              controller.close()
            },
          })

          return new Response(stream, {
            status: 200,
            headers: { "content-type": "text/plain; charset=utf-8" },
          })
        }

        try {
          const result = streamText({
            model: openrouter.chat(model),
            system: "You are a helpful assistant.",
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          })

          return result.toTextStreamResponse()
        } catch (error) {
          console.error("[guest-ai] streamText error:", error)
          throw error
        }
      },
    },
  },
})
