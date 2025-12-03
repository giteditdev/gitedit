import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"

type RepoSearch = {
  ref?: string
}

type FileContentResult = {
  content: string
  path: string
  size: number
  isBinary: boolean
  encoding: string
}

function humanizeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(path: string): string {
  const parts = path.split(".")
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
}

function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    md: "markdown",
    markdown: "markdown",
    sql: "sql",
    dockerfile: "dockerfile",
    makefile: "makefile",
  }
  return langMap[ext] || "plaintext"
}

function Breadcrumbs({
  owner,
  repo,
  path,
  ref,
}: {
  owner: string
  repo: string
  path: string
  ref: string
}) {
  const parts = path ? path.split("/") : []

  return (
    <div className="flex items-center gap-1 text-sm flex-wrap">
      <Link
        to="/repo/$owner/$repo"
        params={{ owner, repo }}
        search={{ ref }}
        className="text-blue-400 hover:underline font-medium"
      >
        {repo}
      </Link>
      {parts.map((part, i) => {
        const pathUpTo = parts.slice(0, i + 1).join("/")
        const isLast = i === parts.length - 1
        return (
          <span key={pathUpTo} className="flex items-center gap-1">
            <span className="text-slate-500">/</span>
            {isLast ? (
              <span className="text-slate-200">{part}</span>
            ) : (
              <Link
                to="/repo/$owner/$repo/$"
                params={{ owner, repo, _splat: pathUpTo }}
                search={{ ref }}
                className="text-blue-400 hover:underline"
              >
                {part}
              </Link>
            )}
          </span>
        )
      })}
    </div>
  )
}

function FileViewer({
  content,
  path,
  size,
  isBinary,
}: {
  content: string
  path: string
  size: number
  isBinary: boolean
}) {
  const ext = getFileExtension(path)
  const language = getLanguageFromExtension(ext)
  const lines = content.split("\n")

  if (isBinary) {
    return (
      <div className="border border-slate-700 rounded-lg p-8 text-center">
        <p className="text-slate-400">Binary file not shown ({humanizeSize(size)})</p>
      </div>
    )
  }

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
        <span className="text-sm text-slate-300">{path.split("/").pop()}</span>
        <span className="text-xs text-slate-500">
          {lines.length} lines | {humanizeSize(size)} | {language}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-slate-800/30">
                <td className="py-0 px-3 text-right text-slate-600 select-none text-xs w-12 border-r border-slate-700 font-mono">
                  {i + 1}
                </td>
                <td className="py-0 px-3">
                  <pre className="text-sm text-slate-300 whitespace-pre font-mono">
                    {line || " "}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/repo/$owner/$repo/file/$")({
  validateSearch: (search: Record<string, unknown>): RepoSearch => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  component: FileRoute,
})

function FileRoute() {
  const { owner, repo, _splat: path } = Route.useParams()
  const { ref } = Route.useSearch()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<FileContentResult | null>(null)

  useEffect(() => {
    async function fetchFile() {
      setLoading(true)
      setError(null)

      try {
        const fileUrl = new URL(
          `/api/github/file/${owner}/${repo}/${path}`,
          window.location.origin,
        )
        if (ref) fileUrl.searchParams.set("ref", ref)

        const res = await fetch(fileUrl)
        if (!res.ok) {
          throw new Error(`Failed to fetch file: ${res.status}`)
        }

        const data = await res.json()
        if (data.error) {
          throw new Error(data.error)
        }

        setFileContent(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchFile()
  }, [owner, repo, path, ref])

  const currentRef = ref || "main"
  const parentPath = path?.split("/").slice(0, -1).join("/") || ""

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-slate-400">Loading file...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading File</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => navigate({ to: "/repo/$owner/$repo", params: { owner, repo } })}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Back to Repository
          </button>
        </div>
      </div>
    )
  }

  if (!fileContent) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              to={parentPath ? "/repo/$owner/$repo/$" : "/repo/$owner/$repo"}
              params={{ owner, repo, _splat: parentPath }}
              search={{ ref: currentRef }}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
          <Breadcrumbs
            owner={owner}
            repo={repo}
            path={path || ""}
            ref={currentRef}
          />
        </div>

        {/* File content */}
        <FileViewer
          content={fileContent.content}
          path={fileContent.path}
          size={fileContent.size}
          isBinary={fileContent.isBinary}
        />
      </div>
    </div>
  )
}
