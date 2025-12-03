import {
  useEffect,
  useMemo,
  useState,
  useRef,
  type ComponentProps,
  type FormEvent,
  type RefObject,
} from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { authClient } from "@/lib/auth-client"
import {
  getChatThreadsCollection,
  getChatMessagesCollection,
} from "@/lib/collections"
import ContextPanel from "@/components/Context-panel"

async function createThread(title = "New chat") {
  const res = await fetch("/api/chat/mutations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "createThread", title }),
  })
  if (!res.ok) throw new Error("Failed to create chat")
  const json = (await res.json()) as {
    thread: { id: number; title: string; created_at?: string }
  }
  return {
    ...json.thread,
    created_at: json.thread.created_at
      ? new Date(json.thread.created_at)
      : new Date(),
  }
}

async function addMessage({
  threadId,
  role,
  content,
}: {
  threadId: number
  role: "user" | "assistant"
  content: string
}) {
  const res = await fetch("/api/chat/mutations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      action: "addMessage",
      threadId,
      role,
      content,
    }),
  })
  if (!res.ok) throw new Error("Failed to add message")
  const json = (await res.json()) as { message: { id: number } & Message }
  return {
    ...json.message,
    created_at: json.message.created_at
      ? new Date(json.message.created_at)
      : new Date(),
  }
}

type Message = {
  id: number
  thread_id: number
  role: string
  content: string
  created_at: Date
}

const FREE_REQUEST_KEY = "gen_chat_free_requests"
const FREE_REQUEST_LIMIT = 1
const MODEL_STORAGE_KEY = "gen_chat_model"
const DARK_MODE_KEY = "gen_chat_dark_mode"

function getStoredDarkMode(): boolean {
  if (typeof window === "undefined") return false
  const stored = localStorage.getItem(DARK_MODE_KEY)
  if (stored !== null) return stored === "true"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

const AVAILABLE_MODELS = [
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
  },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
] as const

type ModelId = (typeof AVAILABLE_MODELS)[number]["id"]

function getStoredModel(): ModelId {
  if (typeof window === "undefined") return AVAILABLE_MODELS[0].id
  const stored = localStorage.getItem(MODEL_STORAGE_KEY)
  if (stored && AVAILABLE_MODELS.some((m) => m.id === stored)) {
    return stored as ModelId
  }
  return AVAILABLE_MODELS[0].id
}

function setStoredModel(model: ModelId) {
  localStorage.setItem(MODEL_STORAGE_KEY, model)
}

function getFreeRequestCount(): number {
  if (typeof window === "undefined") return 0
  return parseInt(localStorage.getItem(FREE_REQUEST_KEY) || "0", 10)
}

function incrementFreeRequestCount(): number {
  const count = getFreeRequestCount() + 1
  localStorage.setItem(FREE_REQUEST_KEY, count.toString())
  return count
}

type GuestMessage = {
  id: number
  role: "user" | "assistant"
  content: string
}

type DisplayMessage = {
  id: number
  role: string
  content: string
  thread_id?: number
  created_at?: Date
}

type ChatLayoutProps = {
  messages: DisplayMessage[]
  input: string
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  selectedModel: ModelId
  handleModelChange: (model: ModelId) => void
  isLoading: boolean
  darkMode: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
  emptyStateText: string
  contextPanelProps: ComponentProps<typeof ContextPanel>
}

function ChatLayout({
  messages,
  input,
  onInputChange,
  onSubmit,
  selectedModel,
  handleModelChange,
  isLoading,
  darkMode,
  messagesEndRef,
  emptyStateText,
  contextPanelProps,
}: ChatLayoutProps) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[280px_1fr] bg-inherit">
      <aside className="border-r flex flex-col h-screen bg-[#020617]">
        <ContextPanel {...contextPanelProps} />
      </aside>
      <main
        className={`flex flex-col h-screen ${darkMode ? "bg-slate-950" : "bg-slate-50"}`}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-2xl rounded-lg px-4 py-3 ${
                msg.role === "assistant"
                  ? darkMode
                    ? "bg-slate-800 border border-slate-700 text-slate-100"
                    : "bg-white border border-slate-200"
                  : darkMode
                    ? "bg-slate-100 text-slate-900 ml-auto"
                    : "bg-slate-900 text-white ml-auto"
              }`}
            >
              <div
                className={`text-xs uppercase tracking-wide mb-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}
              >
                {msg.role}
              </div>
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center justify-center items-center text-sm text-neutral-400">
              {emptyStateText}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={onSubmit}>
          <div className="relative min-h-[6.5em] max-w-5xl mx-auto rounded-2xl border border-neutral-700/60 bg-[#181921d9]/90 px-3 pt-3 pb-12 backdrop-blur-lg transition-all hover:border-neutral-600/80">
            <textarea
              className="w-full max-h-32 min-h-[24px] resize-none overflow-y-auto bg-transparent text-[15px] text-neutral-100 placeholder-neutral-500 focus:outline-none disabled:opacity-60 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              rows={3}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Try a free message..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSubmit(e)
                }
              }}
            />
            <div className="absolute bottom-0 left-0 p-2 w-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value as ModelId)}
                  className="text-xs px-2 py-2 rounded-lg bg-white/5 text-neutral-400 border border-neutral-700/60 focus:outline-none focus:ring-1 focus:ring-neutral-600 transition-colors duration-300 hover:bg-white/3"
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {}}
                  className="flex h-8 cursor-pointer items-center border border-dashed border-white/20 justify-center gap-1.5 rounded-lg px-3 text-neutral-400 transition-colors duration-300 hover:bg-white/3 hover:text-neutral-200"
                  aria-label="Add files"
                >
                  <span className="text-sm">Add files</span>
                </button>
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex py-2 px-3 cursor-pointer items-center justify-center text-white rounded-lg bg-linear-to-r from-cyan-500 to-blue-500 transition-colors duration-300 hover:bg-cyan-700 hover:text-neutral-100 disabled:opacity-40 shadow-lg box-shadow-xl"
                aria-label="Send message"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

export function ChatPage() {
  const { data: session, isPending } = authClient.useSession()
  const isAuthenticated = !!session?.session
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [guestMessages, setGuestMessages] = useState<GuestMessage[]>([])
  const [freeRequestsUsed, setFreeRequestsUsed] = useState(0)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null)
  const [pendingMessages, setPendingMessages] = useState<DisplayMessage[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelId>(
    AVAILABLE_MODELS[0].id,
  )
  const [darkMode, setDarkMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const chatThreadsCollection = getChatThreadsCollection()
  const chatMessagesCollection = getChatMessagesCollection()

  const { data: threads = [] } = useLiveQuery((q) =>
    q
      .from({ chatThreads: chatThreadsCollection })
      .orderBy(({ chatThreads }) => chatThreads.created_at),
  )

  const sortedThreads = useMemo(
    () => (isAuthenticated ? [...threads].sort((a, b) => b.id - a.id) : []),
    [threads, isAuthenticated],
  )

  useEffect(() => {
    if (
      isAuthenticated &&
      activeThreadId === null &&
      sortedThreads.length > 0
    ) {
      setActiveThreadId(sortedThreads[0].id)
    }
    if (!isAuthenticated) {
      setActiveThreadId(null)
    }
  }, [sortedThreads, activeThreadId, isAuthenticated])

  const { data: dbMessages = [] } = useLiveQuery((q) => {
    const base = q
      .from({ chatMessages: chatMessagesCollection })
      .orderBy(({ chatMessages }) => chatMessages.created_at)
    if (!isAuthenticated || activeThreadId === null) {
      return base.where(({ chatMessages }) => eq(chatMessages.thread_id, -1))
    }
    return base.where(({ chatMessages }) =>
      eq(chatMessages.thread_id, activeThreadId),
    )
  })

  useEffect(() => {
    // Remove pending messages that have been synced via Electric
    if (pendingMessages.length === 0) return

    const stillPending = pendingMessages.filter((pending) => {
      const isSynced = dbMessages.some(
        (m) =>
          m.role === pending.role &&
          m.content === pending.content &&
          m.thread_id === pending.thread_id
      )
      return !isSynced
    })

    if (stillPending.length !== pendingMessages.length) {
      setPendingMessages(stillPending)
    }
  }, [dbMessages, pendingMessages])

  useEffect(() => {
    setSelectedModel(getStoredModel())
    setDarkMode(getStoredDarkMode())
    setFreeRequestsUsed(getFreeRequestCount())
  }, [])

  const allMessages: DisplayMessage[] = useMemo(() => {
    let baseMessages: DisplayMessage[]

    if (!isAuthenticated) {
      // Guest mode: use local guest messages
      baseMessages = guestMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))
    } else if (activeThreadId !== null) {
      // Authenticated with active thread: use Electric-synced messages
      baseMessages = dbMessages
    } else {
      // Authenticated but no thread selected yet: empty
      baseMessages = []
    }

    const msgs = [...baseMessages]

    // Add pending messages that aren't already in the list
    for (const pending of pendingMessages) {
      const alreadyExists = msgs.some(
        (m) =>
          m.role === pending.role &&
          m.content === pending.content &&
          m.thread_id === pending.thread_id
      )
      if (!alreadyExists) {
        msgs.push(pending)
      }
    }

    // Add streaming assistant response
    if (streamingContent) {
      msgs.push({
        id: -1,
        role: "assistant",
        content: streamingContent,
      })
    }
    return msgs
  }, [
    guestMessages,
    streamingContent,
    isAuthenticated,
    dbMessages,
    activeThreadId,
    pendingMessages,
  ])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [allMessages])

  const handleModelChange = (model: ModelId) => {
    setSelectedModel(model)
    setStoredModel(model)
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setIsLoading(true)
    setStreamingContent("")

    if (!isAuthenticated) {
      if (freeRequestsUsed >= FREE_REQUEST_LIMIT) {
        setShowAuthPrompt(true)
        setIsLoading(false)
        return
      }

      try {
        const newUserMsg: GuestMessage = {
          id: Date.now(),
          role: "user",
          content: userMessage,
        }
        setGuestMessages((prev) => [...prev, newUserMsg])

        const messages = [
          ...guestMessages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: userMessage },
        ]

        const res = await fetch("/api/chat/guest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages, model: selectedModel }),
        })

        if (!res.ok) {
          throw new Error(`AI request failed: ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let accumulated = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setStreamingContent(accumulated)
        }

        const newAssistantMsg: GuestMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: accumulated,
        }
        setGuestMessages((prev) => [...prev, newAssistantMsg])
        setStreamingContent("")

        const newCount = incrementFreeRequestCount()
        setFreeRequestsUsed(newCount)
        if (newCount >= FREE_REQUEST_LIMIT) {
          setShowAuthPrompt(true)
        }
      } catch (error) {
        console.error("Chat error:", error)
        setStreamingContent("")
      } finally {
        setIsLoading(false)
      }
      return
    }

    try {
      let threadId = activeThreadId
      if (!threadId) {
        const thread = await createThread(
          userMessage.slice(0, 40) || "New chat",
        )
        threadId = thread.id
        setActiveThreadId(thread.id)
      }

      const pendingUserMsg: DisplayMessage = {
        id: Date.now(),
        role: "user",
        content: userMessage,
        thread_id: threadId,
        created_at: new Date(),
      }
      setPendingMessages((prev) => [...prev, pendingUserMsg])

      await addMessage({ threadId, role: "user", content: userMessage })

      const threadMessages = dbMessages.filter((m) => m.thread_id === threadId)
      const messages = [
        ...threadMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: userMessage },
      ]

      const res = await fetch("/api/chat/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ threadId, messages, model: selectedModel }),
      })

      if (!res.ok) {
        throw new Error(`AI request failed: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamingContent(accumulated)
      }

      // Store the assistant response as a pending message until Electric syncs
      if (accumulated) {
        const pendingAssistantMsg: DisplayMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: accumulated,
          thread_id: threadId,
          created_at: new Date(),
        }
        setPendingMessages((prev) => [...prev, pendingAssistantMsg])
      }
      setStreamingContent("")
    } catch (error) {
      console.error("Chat error:", error)
      setStreamingContent("")
    } finally {
      setIsLoading(false)
    }
  }

  if (isPending) {
    return null
  }

  return (
    <>
      <ChatLayout
        messages={allMessages}
        input={input}
        onInputChange={setInput}
        onSubmit={handleSend}
        selectedModel={selectedModel}
        handleModelChange={handleModelChange}
        isLoading={isLoading}
        darkMode={darkMode}
        messagesEndRef={messagesEndRef}
        emptyStateText={
          isAuthenticated
            ? "No messages yet. Start with a new prompt."
            : "Try a free message! Ask the AI anything."
        }
        contextPanelProps={{
          chats: sortedThreads,
          activeChatId: activeThreadId ? activeThreadId.toString() : null,
          isAuthenticated,
          profile: null,
        }}
      />

      {showAuthPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`rounded-xl p-6 max-w-md mx-4 shadow-xl ${darkMode ? "bg-slate-800" : "bg-white"}`}
          >
            <h2
              className={`text-xl font-semibold mb-2 ${darkMode ? "text-slate-100" : "text-slate-800"}`}
            >
              Sign in to continue
            </h2>
            <p
              className={`mb-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`}
            >
              You've used your free message. Sign in to get unlimited access and
              save your chat history.
            </p>
            <div className="flex gap-3">
              <button
                className={`flex-1 px-4 py-2 border rounded-lg ${
                  darkMode
                    ? "border-slate-600 text-slate-200 hover:bg-slate-700"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setShowAuthPrompt(false)}
              >
                Maybe later
              </button>
              <a
                href="/login"
                className={`flex-1 px-4 py-2 rounded-lg text-center ${
                  darkMode
                    ? "bg-slate-100 text-slate-900 hover:bg-slate-200"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                Sign in
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
