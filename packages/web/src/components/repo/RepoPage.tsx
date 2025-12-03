import { useState, useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
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
    <div className="flex items-center gap-1 text-sm">
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
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <table className="w-full">
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
                className="border-b border-slate-700 last:border-b-0 hover:bg-slate-800/50"
              >
                <td className="py-2 px-4">
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
                    className="flex items-center gap-2 text-slate-200 hover:text-blue-400"
                  >
                    {isDir ? (
                      <Folder className="w-4 h-4 text-blue-400" />
                    ) : (
                      <File className="w-4 h-4 text-slate-400" />
                    )}
                    <span>{name}</span>
                  </Link>
                </td>
                <td className="py-2 px-4 text-right text-slate-500 text-sm">
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
    <div className="mt-6 border border-slate-700 rounded-lg overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
        <span className="text-sm text-slate-300">{path}</span>
      </div>
      <div className="p-4 prose prose-invert prose-sm max-w-none">
        <pre className="whitespace-pre-wrap text-slate-300 text-sm font-mono">
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
      <div className="border border-slate-700 rounded-lg p-8 text-center">
        <p className="text-slate-400">Binary file not shown</p>
      </div>
    )
  }

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
        <span className="text-sm text-slate-300">{path}</span>
        <span className="text-xs text-slate-500">
          {lines.length} lines | {language}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-slate-800/30">
                <td className="py-0 px-3 text-right text-slate-600 select-none text-xs w-12 border-r border-slate-700">
                  {i + 1}
                </td>
                <td className="py-0 px-3">
                  <pre className="text-sm text-slate-300 whitespace-pre">
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-slate-400">Loading repository...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Repository</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  // File view
  if (isFileView && fileContent) {
    const parentPath = path?.split("/").slice(0, -1).join("/") || ""

    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Link
                to={
                  parentPath
                    ? "/repo/$owner/$repo/$"
                    : "/repo/$owner/$repo"
                }
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
            isBinary={fileContent.isBinary}
          />
        </div>
      </div>
    )
  }

  // Directory view
  if (!treeData) return null

  const { repo: repoInfo, tree, readme } = treeData

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Repo header */}
        <div className="mb-6">
          <div className="flex items-start gap-4 mb-4">
            <img
              src={repoInfo.owner.avatar_url}
              alt={repoInfo.owner.login}
              className="w-12 h-12 rounded-full"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">
                <Link
                  to="/repo/$owner/$repo"
                  params={{ owner: repoInfo.owner.login, repo: repoInfo.name }}
                  className="hover:text-blue-400 transition-colors"
                >
                  {repoInfo.owner.login}/{repoInfo.name}
                </Link>
              </h1>
              {repoInfo.description && (
                <p className="text-slate-400 mt-1">{repoInfo.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  {repoInfo.stargazers_count.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <GitFork className="w-4 h-4" />
                  {repoInfo.forks_count.toLocaleString()}
                </span>
                {repoInfo.language && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-yellow-400" />
                    {repoInfo.language}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Branch selector and breadcrumbs */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
              <GitBranch className="w-4 h-4 text-slate-400" />
              <span className="text-sm">{currentRef}</span>
            </div>
            {path && (
              <Breadcrumbs
                owner={owner}
                repo={repo}
                path={path}
                ref={currentRef}
              />
            )}
          </div>

          {/* Back button if in a subdirectory */}
          {path && (
            <Link
              to={
                path.includes("/")
                  ? "/repo/$owner/$repo/$"
                  : "/repo/$owner/$repo"
              }
              params={{
                owner,
                repo,
                _splat: path.split("/").slice(0, -1).join("/"),
              }}
              search={{ ref: currentRef }}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              ..
            </Link>
          )}
        </div>

        {/* File tree */}
        <FileTreeView
          tree={tree}
          owner={owner}
          repo={repo}
          currentPath={path || ""}
          ref={currentRef}
        />

        {/* README */}
        {readme && <ReadmeView content={readme.content} path={readme.path} />}
      </div>
    </div>
  )
}
