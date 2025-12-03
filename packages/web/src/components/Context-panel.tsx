import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
} from "react"
// import { useMutation } from "@tanstack/react-db"
import {
  Brain,
  ChevronDown,
  ChevronRight,
  File,
  Globe,
  Ellipsis,
  MessageCircle,
  Plus,
  Check,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import type { ChatThread } from "@/db/schema"

interface ContextPanelProps {
  chats: ChatThread[]
  activeChatId?: string | null
  isAuthenticated?: boolean
  profile?: users | null | undefined
}

interface CollapsiblePanelProps {
  title: string
  icon: LucideIcon
  isOpen: boolean
  onToggle: () => void
  headerActions?: ReactNode
  children: ReactNode
  height?: string
  isDragging?: boolean
}

function CollapsiblePanel({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  headerActions,
  children,
  height,
  isDragging = false,
}: CollapsiblePanelProps) {
  const isFlexHeight = height === "flex-1"

  return (
    <div
      className={`border bg-inherit rounded-xl border-slate-500/15 flex flex-col ${
        !isDragging ? "transition-all duration-300" : ""
      } ${isFlexHeight && isOpen ? "flex-1" : ""}`}
      style={!isFlexHeight && isOpen ? { height } : undefined}
    >
      <div
        className={`flex items-center justify-between px-2 py-2.5 bg-[#0b0d15] w-full flex-shrink-0 transition-all duration-300 ${
          isOpen ? "border-b border-slate-500/15 rounded-t-xl" : "rounded-xl"
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon
            className="w-5 h-5 text-teal-500 transition-transform duration-300"
            strokeWidth={2}
          />
          <span className="text-white font-medium text-[13px]">{title}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {headerActions}
          <div className="relative w-5 h-5 flex items-center justify-center">
            <ChevronDown
              onClick={onToggle}
              className={`absolute cursor-pointer transition-all duration-200 text-neutral-400 group-hover:text-white w-3.5 h-3.5 ${
                isOpen ? "opacity-100 rotate-0" : "opacity-0 rotate-90"
              }`}
              strokeWidth={1}
            />
            <ChevronRight
              onClick={onToggle}
              className={`absolute cursor-pointer transition-all duration-200 text-neutral-400 group-hover:text-white w-3.5 h-3.5 ${
                isOpen ? "opacity-0 -rotate-90" : "opacity-100 rotate-0"
              }`}
              strokeWidth={1}
            />
          </div>
        </div>
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen
            ? "opacity-100 bg-[#14151c]/80 text-neutral-500 font-semibold rounded-b-xl px-2 py-4 overflow-y-auto flex-1"
            : "opacity-0 max-h-0 py-0"
        }`}
      >
        {children}
      </div>
    </div>
  )
}

interface CheckboxProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  label: string
  disabled?: boolean
}

function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  const boxShadow = checked
    ? "0 0 8px rgba(20, 184, 166, 0.3), inset 0 1px 3px rgba(0, 0, 0, 0.5)"
    : "inset 0 1px 3px rgba(0, 0, 0, 0.5)"

  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className="relative w-5 h-5 rounded-md border border-teal-500/50 bg-[#1a2332] flex items-center justify-center transition-all"
        style={{ boxShadow }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          readOnly={disabled}
          className="absolute opacity-0 w-full h-full cursor-pointer"
        />
        {checked && <Check className="w-3.5 h-3.5 text-teal-400" />}
      </div>
      <span className="text-neutral-200 text-sm">{label}</span>
    </label>
  )
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: string[]
}

function Select({ value, onChange, options }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-[#0f1117]/60 rounded-lg max-w-[120px] px-2.5 py-1.5 text-white text-xs placeholder:text-neutral-500 focus:outline-none"
      style={{ boxShadow: "1px 0.5px 10px 0 rgba(0,0,0,0.4) inset" }}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  )
}

interface AddWebsiteModalProps {
  isOpen: boolean
  onClose: () => void
  buttonRef: RefObject<HTMLButtonElement | null>
}

function AddWebsiteModal({ isOpen, onClose, buttonRef }: AddWebsiteModalProps) {
  const [url, setUrl] = useState("")
  const [updateInterval, setUpdateInterval] = useState("1 hour")
  const [summarisePages, setSummarisePages] = useState(true)
  const [deepScan, setDeepScan] = useState(true)
  const [deepScanLevels, setDeepScanLevels] = useState("5 levels")
  const [scanResults, setScanResults] = useState<{
    pages: number
    tokens: number
  } | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updateIntervalOptions = [
    "15 minutes",
    "30 minutes",
    "1 hour",
    "6 hours",
    "24 hours",
  ]
  const deepScanLevelOptions = [
    "1 level",
    "2 levels",
    "3 levels",
    "5 levels",
    "10 levels",
  ]

  useEffect(() => {
    if (url && url.includes(".")) {
      const timer = setTimeout(() => {
        setScanResults({ pages: 40, tokens: 85102 })
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setScanResults(null)
    }
  }, [url])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.top - 30,
        left: rect.right + 12,
      })
    }
  }, [isOpen, buttonRef])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-[#1e202d]/60 backdrop-blur-md flex flex-col gap-3 rounded-2xl p-5 w-full max-w-[400px] shadow-xl border border-slate-200/5 box-shadow-[1px_0.5px_10px_0_rgba(0,0,0,0.4)_inset]"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white text-sm">Add website</h2>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="apple.com"
            className="flex-1 bg-[#0f1117]/40 rounded-lg px-4 py-2 text-white text-sm placeholder:text-neutral-500 focus:outline-none"
            style={{ boxShadow: "1px 0.5px 10px 0 rgba(0,0,0,0.4) inset" }}
          />
          <button className="px-4 cursor-pointer py-1 w-fit bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium transition-colors">
            Add
          </button>
        </div>

        {scanResults && (
          <div className="flex gap-8 text-sm">
            <span className="text-neutral-200 font-light">
              Found{" "}
              <span className="text-white font-mono">{scanResults.pages}</span>{" "}
              pages
            </span>
            <span className="text-neutral-200 font-light">
              <span className="text-white font-mono">
                {scanResults.tokens.toLocaleString()}
              </span>{" "}
              tokens
            </span>
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox checked={true} label="Update every" disabled />
          <Select
            value={updateInterval}
            onChange={setUpdateInterval}
            options={updateIntervalOptions}
          />
        </label>

        <Checkbox
          checked={summarisePages}
          onChange={setSummarisePages}
          label="Summarise pages"
        />

        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={deepScan}
            onChange={setDeepScan}
            label="Deep scan"
          />
          <Select
            value={deepScanLevels}
            onChange={setDeepScanLevels}
            options={deepScanLevelOptions}
          />
        </label>
      </div>
    </div>
  )
}

export default function ContextPanel({
  chats,
  activeChatId = null,
  isAuthenticated = false,
  profile = null,
}: ContextPanelProps) {
  // const { remove } = useMutation()
  const [openSections, setOpenSections] = useState({
    files: false,
    web: false,
  })
  const [isContextOpen, setIsContextOpen] = useState(true)
  const [isThreadsOpen, setIsThreadsOpen] = useState(true)
  const [threadsHeight, setThreadsHeight] = useState(350)
  const [isDragging, setIsDragging] = useState(false)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [isAddWebsiteModalOpen, setIsAddWebsiteModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const addLinkButtonRef = useRef<HTMLButtonElement>(null)

  const contextItems = [
    {
      id: "files",
      label: "Files",
      icon: File,
      count: 0,
      hasChevron: true,
    },
    {
      id: "web",
      label: "Web",
      icon: Globe,
      count: 0,
      hasChevron: true,
    },
  ]

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id as keyof typeof prev],
    }))
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return

      const container = containerRef.current
      const containerRect = container.getBoundingClientRect()
      const newHeight = e.clientY - containerRect.top - 50

      const collapseThreshold = 80
      const minHeight = 150
      const maxHeight = containerRect.height - 250

      if (newHeight < collapseThreshold) {
        setIsThreadsOpen(false)
      } else if (newHeight >= minHeight && newHeight <= maxHeight) {
        if (!isThreadsOpen) {
          setIsThreadsOpen(true)
        }
        setThreadsHeight(newHeight)
      } else if (newHeight >= collapseThreshold && newHeight < minHeight) {
        if (!isThreadsOpen) {
          setIsThreadsOpen(true)
        }
        setThreadsHeight(minHeight)
      }
    },
    [isThreadsOpen],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleDeleteChat = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    chatId: string,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    if (deletingChatId) return

    try {
      setDeletingChatId(chatId)
      // await remove.chat.with({ id: chatId })
    } catch (error) {
      console.error("[contextPanel] failed to delete chat", { chatId, error })
    } finally {
      setDeletingChatId(null)
    }
  }

  const profileUsername = profile?.username ?? null
  const profileInitial = profileUsername?.[0]?.toUpperCase() ?? "?"

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-1em)] flex flex-col ml-[0.7em] gap-2 w-[240px]"
    >
      <div className="pt-3">
        {/* {profileUsername ? (
          <a
            href="/settings"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-r from-emerald-500 to-cyan-500 text-sm font-semibold uppercase text-white shadow-lg shadow-black/30 transition hover:scale-105 hover:shadow-emerald-500/40"
            aria-label="Open settings"
          >
            {profileInitial}
          </a>
        ) : !isAuthenticated ? (
          <a
            href="/auth"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:bg-white/15"
          >
            Sign In
          </a>
        ) : (
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15">
            …
          </div>
        )} */}
      </div>
      {/* <div className="h-[calc(100vh-2em)] my-auto flex flex-col ml-[0.7em] gap-2 w-[240px]"> */}
      <div style={isDragging ? { transition: "none" } : undefined}>
        <CollapsiblePanel
          title="Threads"
          icon={MessageCircle}
          isOpen={isThreadsOpen}
          onToggle={() => setIsThreadsOpen(!isThreadsOpen)}
          height={`${threadsHeight}px`}
          headerActions={
            <a
              href="/"
              className="pr-2 text-neutral-200 hover:text-white rounded-lg text-[11px] cursor-pointer flex items-center gap-1.5 transition-colors duration-200"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span>New</span>
            </a>
          }
        >
          <p className="text-xs text-neutral-500 font-semibold">RECENT</p>
          {chats.length === 0 ? (
            <p className="px-2 pt-2 text-xs text-neutral-600">
              Start a conversation to see it here.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {chats.map((chat) => {
                const isActive = chat.id.toString() === activeChatId
                const displayTitle = chat.title?.trim() ?? "Untitled chat"
                const isDeleting = deletingChatId === chat.id.toString()

                return (
                  <div key={chat.id} className="group relative max-w-[90%]">
                    <a
                      href={`/c/${chat.id}`}
                      className={`flex items-center text-[13px] gap-2 py-2 px-2 pr-8 transition-colors duration-200 rounded-lg ${
                        isActive
                          ? "bg-white/5 text-white"
                          : "text-neutral-300 hover:text-white hover:bg-white/5"
                      } ${isDeleting ? "opacity-50" : ""}`}
                    >
                      <MessageCircle
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isActive ? "text-teal-400" : "text-teal-400/50"
                        }`}
                        strokeWidth={2}
                      />
                      <span className="truncate">{displayTitle}</span>
                    </a>
                    <button
                      type="button"
                      aria-label="Delete chat"
                      disabled={isDeleting}
                      onClick={(event) =>
                        handleDeleteChat(event, chat.id.toString())
                      }
                      className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-400 transition-all duration-200 opacity-0 invisible group-hover:visible group-hover:opacity-100 focus-visible:visible focus-visible:opacity-100 bg-transparent ${
                        isDeleting
                          ? "cursor-wait"
                          : "hover:text-white focus-visible:outline-1 focus-visible:outline-white/50"
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CollapsiblePanel>
      </div>

      {(isThreadsOpen || isContextOpen) && (
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-center cursor-row-resize group transition-all duration-300 -my-1.5 animate-in fade-in zoom-in-95"
        >
          <Ellipsis className="w-6 h-4 text-neutral-600 group-hover:text-neutral-400 transition-all duration-300" />
        </div>
      )}

      <CollapsiblePanel
        title="Context"
        icon={Brain}
        isOpen={isContextOpen}
        onToggle={() => setIsContextOpen(!isContextOpen)}
        height="flex-1"
      >
        <div className="flex justify-between text-sm mb-4 px-2">
          <span className="text-neutral-400">0 tokens</span>
          <span className="text-neutral-400">1M</span>
        </div>

        <div className="flex flex-col gap-0.5">
          {contextItems.map((item) => {
            const Icon = item.icon
            const isOpen = openSections[item.id as keyof typeof openSections]

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleSection(item.id)}
                className="flex items-center justify-between group py-2 px-2 cursor-pointer transition-colors duration-200"
              >
                <div className="flex items-center gap-2">
                  {item.hasChevron &&
                    (isOpen ? (
                      <ChevronDown
                        className="w-4 h-4 text-neutral-400 group-hover:text-white"
                        strokeWidth={2}
                      />
                    ) : (
                      <ChevronRight
                        className="w-4 h-4 text-neutral-400 group-hover:text-white"
                        strokeWidth={2}
                      />
                    ))}
                  <Icon className="w-4 h-4 text-white" strokeWidth={2} />
                  <span className="text-[13px] text-neutral-300 group-hover:text-white">
                    {item.label}
                  </span>
                </div>
                <span className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors duration-300">
                  {item.count}
                </span>
              </button>
            )
          })}

          <button
            type="button"
            ref={addLinkButtonRef}
            onClick={() => setIsAddWebsiteModalOpen(true)}
            className="flex items-center gap-2 py-2 pr-4 hover:bg-white/4 box-shadow-[1px_0.5px_10px_0_rgba(0,0,0,0.4)_inset] w-fit rounded-lg cursor-pointer transition-colors duration-200"
          >
            <Plus className="w-4 h-4 text-neutral-400" strokeWidth={2} />
            <span className="text-[13px] text-neutral-200">Add link...</span>
          </button>
        </div>
      </CollapsiblePanel>

      <AddWebsiteModal
        isOpen={isAddWebsiteModalOpen}
        onClose={() => setIsAddWebsiteModalOpen(false)}
        buttonRef={addLinkButtonRef}
      />
    </div>
  )
}
