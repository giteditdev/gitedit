import { useState, useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { GitHubShell } from "@/components/layout/GitHubShell"
import {
  Folder,
  File,
  GitBranch,
  Star,
  GitFork,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react"

// Types matching the worker RPC types
type GitHubTreeEntry = {
  path: string
  mode: string
  type: "blob" | "tree"
  sha: string
  size?: number
  url: string
}

type GitHubRepo = {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  default_branch: string
  stargazers_count: number
  forks_count: number
  language: string | null
  owner: {
    login: string
    avatar_url: string
  }
}

type RepoTreeResult = {
  repo: GitHubRepo
  tree: GitHubTreeEntry[]
  readme?: {
    content: string
    path: string
  }
  currentPath: string
  ref: string
}

type FileContentResult = {
  content: string
  path: string
  size: number
  isBinary: boolean
  encoding: string
}

type RepoPageProps = {
  owner: string
  repo: string
  path?: string
  ref?: string
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

function FileTreeView({
  tree,
  owner,
  repo,
  currentPath,
  ref,
}: {
  tree: GitHubTreeEntry[]
  owner: string
  repo: string
  currentPath: string
  ref: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-rise">
      <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Files
      </div>
      <table className="w-full text-sm">
        <tbody>
          {tree.map((entry) => {
            const name = entry.path.split("/").pop() || entry.path
            const isDir = entry.type === "tree"
            const entryPath = currentPath
              ? `${currentPath}/${name}`
              : entry.path

            return (
              <tr
                key={entry.sha}
                className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50"
              >
                <td className="py-2.5 px-4">
                  <Link
                    to={
                      isDir
                        ? "/repo/$owner/$repo/$"
                        : "/repo/$owner/$repo/file/$"
                    }
                    params={{
                      owner,
                      repo,
                      _splat: entryPath,
                    }}
                    search={{ ref }}
                    className="flex items-center gap-2 text-slate-700 hover:text-slate-900"
                  >
                    {isDir ? (
                      <Folder className="w-4 h-4 text-blue-500" />
                    ) : (
                      <File className="w-4 h-4 text-slate-400" />
                    )}
                    <span>{name}</span>
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-right text-xs text-slate-400">
                  {!isDir && entry.size !== undefined && humanizeSize(entry.size)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReadmeView({ content, path }: { content: string; path: string }) {
  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {path}
        </span>
      </div>
      <div className="p-4 prose prose-sm max-w-none text-slate-700">
        <pre className="whitespace-pre-wrap text-sm font-mono text-slate-700">
          {content}
        </pre>
      </div>
    </div>
  )
}

function FileViewer({
  content,
  path,
  isBinary,
}: {
  content: string
  path: string
  isBinary: boolean
}) {
  const ext = getFileExtension(path)
  const language = getLanguageFromExtension(ext)
  const lines = content.split("\n")

  if (isBinary) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        <p>Binary file not shown</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {path}
        </span>
        <span className="text-xs text-slate-400">
          {lines.length} lines | {language}
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

export function RepoPage({ owner, repo, path, ref }: RepoPageProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [treeData, setTreeData] = useState<RepoTreeResult | null>(null)
  const [fileContent, setFileContent] = useState<FileContentResult | null>(null)
  const [isFileView, setIsFileView] = useState(false)

  // Fetch tree or file content based on path
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        // Determine if we're viewing a file or directory
        // We'll try fetching the tree first, if the path points to a file, we fetch file content
        const treeUrl = new URL(
          `/api/github/tree/${owner}/${repo}`,
          window.location.origin,
        )
        if (ref) treeUrl.searchParams.set("ref", ref)
        if (path) treeUrl.searchParams.set("path", path)

        const treeRes = await fetch(treeUrl)
        if (!treeRes.ok) {
          // Try fetching as a file
          const fileUrl = new URL(
            `/api/github/file/${owner}/${repo}/${path || ""}`,
            window.location.origin,
          )
          if (ref) fileUrl.searchParams.set("ref", ref)

          const fileRes = await fetch(fileUrl)
          if (!fileRes.ok) {
            throw new Error(`Failed to fetch: ${fileRes.status}`)
          }
          const fileData = (await fileRes.json()) as FileContentResult
          setFileContent(fileData)
          setIsFileView(true)
          setTreeData(null)
        } else {
          const data = (await treeRes.json()) as RepoTreeResult & { error?: string }
          if (data.error) {
            throw new Error(data.error)
          }
          setTreeData(data)
          setIsFileView(false)
          setFileContent(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [owner, repo, path, ref])

  const currentRef = treeData?.ref || ref || "main"
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
            <span>Loading repository...</span>
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
              Error Loading Repository
            </h2>
            <p className="text-slate-600 mb-4">{error}</p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
            >
              Go Home
            </button>
          </div>
        </main>
      </GitHubShell>
    )
  }

  // File view
  if (isFileView && fileContent) {
    const parentPath = path?.split("/").slice(0, -1).join("/") || ""

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
              <ArrowLeft className="w-4 h-4" />
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
            isBinary={fileContent.isBinary}
          />
        </main>
      </GitHubShell>
    )
  }

  // Directory view
  if (!treeData) return null

  const { repo: repoInfo, tree, readme } = treeData

  return (
    <GitHubShell subnav={repoSubnav}>
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-rise">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <img
              src={repoInfo.owner.avatar_url}
              alt={repoInfo.owner.login}
              className="h-14 w-14 rounded-full border border-slate-200"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-slate-900">
                <Link
                  to="/repo/$owner/$repo"
                  params={{ owner: repoInfo.owner.login, repo: repoInfo.name }}
                  className="hover:text-[#0969da]"
                >
                  {repoInfo.owner.login}/{repoInfo.name}
                </Link>
              </h1>
              {repoInfo.description && (
                <p className="mt-2 text-slate-600">{repoInfo.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  <Star className="h-4 w-4" />
                  {repoInfo.stargazers_count.toLocaleString()}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  <GitFork className="h-4 w-4" />
                  {repoInfo.forks_count.toLocaleString()}
                </span>
                {repoInfo.language && (
                  <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                    {repoInfo.language}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-slate-900 px-3 py-1.5 text-white shadow-sm"
              >
                Star
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-sm"
              >
                Fork
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-600 shadow-sm">
              <GitBranch className="h-4 w-4 text-slate-500" />
              <span>{currentRef}</span>
            </div>
            <Breadcrumbs
              owner={owner}
              repo={repo}
              path={path || ""}
              ref={currentRef}
            />
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm"
          >
            Code
          </button>
        </section>

        {path && (
          <Link
            to={
              path.includes("/") ? "/repo/$owner/$repo/$" : "/repo/$owner/$repo"
            }
            params={{
              owner,
              repo,
              _splat: path.split("/").slice(0, -1).join("/"),
            }}
            search={{ ref: currentRef }}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        )}

        <FileTreeView
          tree={tree}
          owner={owner}
          repo={repo}
          currentPath={path || ""}
          ref={currentRef}
        />

        {readme && <ReadmeView content={readme.content} path={readme.path} />}
      </main>
    </GitHubShell>
  )
}
