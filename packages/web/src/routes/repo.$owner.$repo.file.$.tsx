import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Loader2, AlertCircle, GitBranch } from "lucide-react"
import { GitHubShell } from "@/components/layout/GitHubShell"

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
    <div className="flex items-center gap-1 text-sm text-slate-600 flex-wrap">
      <Link
        to="/repo/$owner/$repo"
        params={{ owner, repo }}
        search={{ ref }}
        className="text-slate-700 hover:text-slate-900 font-medium"
      >
        {repo}
      </Link>
      {parts.map((part, i) => {
        const pathUpTo = parts.slice(0, i + 1).join("/")
        const isLast = i === parts.length - 1
        return (
          <span key={pathUpTo} className="flex items-center gap-1">
            <span className="text-slate-400">/</span>
            {isLast ? (
              <span className="text-slate-900">{part}</span>
            ) : (
              <Link
                to="/repo/$owner/$repo/$"
                params={{ owner, repo, _splat: pathUpTo }}
                search={{ ref }}
                className="text-slate-700 hover:text-slate-900"
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
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        <p>Binary file not shown ({humanizeSize(size)})</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {path.split("/").pop()}
        </span>
        <span className="text-xs text-slate-400">
          {lines.length} lines | {humanizeSize(size)} | {language}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-0 px-3 text-right text-slate-400 select-none text-xs w-12 border-r border-slate-200 font-mono">
                  {i + 1}
                </td>
                <td className="py-0 px-3">
                  <pre className="text-sm text-slate-800 whitespace-pre font-mono">
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
  const repoSubnav = (
    <div className="flex flex-wrap items-center gap-6 py-3 text-sm">
      <div className="flex items-center gap-1 text-slate-600">
        <Link
          to="/repo/$owner/$repo"
          params={{ owner, repo }}
          className="font-semibold text-slate-900 hover:text-[#0969da]"
        >
          {owner}
        </Link>
        <span className="text-slate-400">/</span>
        <Link
          to="/repo/$owner/$repo"
          params={{ owner, repo }}
          className="font-semibold text-slate-900 hover:text-[#0969da]"
        >
          {repo}
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <Link
          to="/repo/$owner/$repo"
          params={{ owner, repo }}
          className="border-b-2 border-[#0969da] pb-2 font-medium text-slate-900"
        >
          Code
        </Link>
        <span className="pb-2 text-slate-400">Issues</span>
        <span className="pb-2 text-slate-400">Pull requests</span>
        <span className="pb-2 text-slate-400">Actions</span>
        <span className="pb-2 text-slate-400">Insights</span>
      </div>
    </div>
  )

  if (loading) {
    return (
      <GitHubShell subnav={repoSubnav}>
        <main className="mx-auto max-w-6xl px-4 py-20">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span>Loading file...</span>
          </div>
        </main>
      </GitHubShell>
    )
  }

  if (error) {
    return (
      <GitHubShell subnav={repoSubnav}>
        <main className="mx-auto max-w-6xl px-4 py-20">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Error Loading File
            </h2>
            <p className="text-slate-600 mb-4">{error}</p>
            <button
              onClick={() =>
                navigate({ to: "/repo/$owner/$repo", params: { owner, repo } })
              }
              className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
            >
              Back to Repository
            </button>
          </div>
        </main>
      </GitHubShell>
    )
  }

  if (!fileContent) return null

  return (
    <GitHubShell subnav={repoSubnav}>
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <Link
            to={parentPath ? "/repo/$owner/$repo/$" : "/repo/$owner/$repo"}
            params={{ owner, repo, _splat: parentPath }}
            search={{ ref: currentRef }}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to files
          </Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
            <GitBranch className="mr-1 inline h-3 w-3" />
            {currentRef}
          </span>
        </div>

        <Breadcrumbs
          owner={owner}
          repo={repo}
          path={path || ""}
          ref={currentRef}
        />

        <FileViewer
          content={fileContent.content}
          path={fileContent.path}
          size={fileContent.size}
          isBinary={fileContent.isBinary}
        />
      </main>
    </GitHubShell>
  )
}
