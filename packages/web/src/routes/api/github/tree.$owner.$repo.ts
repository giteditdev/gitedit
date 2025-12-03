import { createFileRoute } from "@tanstack/react-router"

// GitHub API types
type GitHubTreeEntry = {
  path: string
  mode: string
  type: "blob" | "tree"
  sha: string
  size?: number
  url: string
}

type GitHubTree = {
  sha: string
  url: string
  tree: GitHubTreeEntry[]
  truncated: boolean
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

async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitedit-app",
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch repo: ${response.status}`)
  }

  return response.json()
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<{ content: string; isBinary: boolean }> {
  const refParam = ref ? `?ref=${ref}` : ""
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}${refParam}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitedit-app",
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }

  const data = (await response.json()) as {
    content: string
    encoding: string
    size: number
    path: string
  }

  const binaryExtensions = [
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".pdf",
    ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib",
    ".woff", ".woff2", ".ttf", ".eot",
  ]
  const isBinary = binaryExtensions.some((ext) =>
    path.toLowerCase().endsWith(ext),
  )

  let content = data.content
  if (data.encoding === "base64" && !isBinary) {
    content = atob(data.content.replace(/\n/g, ""))
  }

  return { content, isBinary }
}

async function getRepoTree(
  owner: string,
  repo: string,
  ref?: string,
  path?: string,
): Promise<RepoTreeResult> {
  const repoInfo = await fetchGitHubRepo(owner, repo)
  const targetRef = ref || repoInfo.default_branch

  const treeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetRef}?recursive=1`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "gitedit-app",
      },
    },
  )

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch tree: ${treeResponse.status}`)
  }

  const fullTree: GitHubTree = await treeResponse.json()

  const currentPath = path || ""
  const pathPrefix = currentPath ? `${currentPath}/` : ""

  const filteredTree = fullTree.tree.filter((entry) => {
    if (currentPath === "") {
      return !entry.path.includes("/")
    }
    if (!entry.path.startsWith(pathPrefix)) return false
    const remainingPath = entry.path.slice(pathPrefix.length)
    return !remainingPath.includes("/")
  })

  filteredTree.sort((a, b) => {
    if (a.type === "tree" && b.type !== "tree") return -1
    if (a.type !== "tree" && b.type === "tree") return 1
    return a.path.localeCompare(b.path)
  })

  let readme: { content: string; path: string } | undefined
  const readmeEntry = filteredTree.find(
    (entry) =>
      entry.type === "blob" &&
      entry.path.toLowerCase().startsWith("readme") &&
      (entry.path.toLowerCase().endsWith(".md") ||
        entry.path.toLowerCase().endsWith(".markdown")),
  )

  if (readmeEntry) {
    try {
      const readmePath = currentPath
        ? `${currentPath}/${readmeEntry.path.split("/").pop()}`
        : readmeEntry.path
      const readmeContent = await fetchFileContent(owner, repo, readmePath, targetRef)
      if (!readmeContent.isBinary) {
        readme = { content: readmeContent.content, path: readmePath }
      }
    } catch {
      // Ignore README fetch errors
    }
  }

  return {
    repo: repoInfo,
    tree: filteredTree,
    readme,
    currentPath,
    ref: targetRef,
  }
}

const serve = async ({
  params,
  request,
}: {
  params: { owner: string; repo: string }
  request: Request
}) => {
  try {
    const { owner, repo } = params
    const url = new URL(request.url)
    const ref = url.searchParams.get("ref") || undefined
    const path = url.searchParams.get("path") || undefined

    const result = await getRepoTree(owner, repo, ref, path)
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export const Route = createFileRoute("/api/github/tree/$owner/$repo")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
