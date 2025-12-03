import { WorkerEntrypoint } from "cloudflare:workers"

// GitHub API types
export type GitHubTreeEntry = {
  path: string
  mode: string
  type: "blob" | "tree"
  sha: string
  size?: number
  url: string
}

export type GitHubTree = {
  sha: string
  url: string
  tree: GitHubTreeEntry[]
  truncated: boolean
}

export type GitHubBranch = {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
}

export type GitHubCommit = {
  sha: string
  commit: {
    author: {
      name: string
      email: string
      date: string
    }
    message: string
  }
  html_url: string
  parents: { sha: string }[]
}

export type GitHubRepo = {
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

export type RepoTreeResult = {
  repo: GitHubRepo
  tree: GitHubTreeEntry[]
  readme?: {
    content: string
    path: string
  }
  currentPath: string
  ref: string
}

export type FileContentResult = {
  content: string
  path: string
  size: number
  isBinary: boolean
  encoding: string
}

/**
 * RPC Worker Entrypoint
 * This class enables RPC-style calls to the worker from service bindings.
 * Methods defined here can be called directly from other workers or systems
 * that have a service binding to this worker.
 */
export class WorkerRpc extends WorkerEntrypoint {
  /**
   * Example RPC method - returns a greeting message
   */
  async sayHello(
    name: string,
  ): Promise<{ message: string; timestamp: number }> {
    return {
      message: `Hello, ${name}!`,
      timestamp: Date.now(),
    }
  }

  /**
   * Example RPC method - performs a calculation
   */
  async calculate(
    operation: "add" | "subtract" | "multiply" | "divide",
    a: number,
    b: number,
  ): Promise<number> {
    switch (operation) {
      case "add":
        return a + b
      case "subtract":
        return a - b
      case "multiply":
        return a * b
      case "divide":
        if (b === 0) throw new Error("Division by zero")
        return a / b
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  }

  /**
   * Example RPC method - fetches data (could interact with bindings)
   */
  async getData(
    key: string,
  ): Promise<{ key: string; found: boolean; value?: string }> {
    // Example: You could interact with KV, D1, R2, etc. here
    // For now, just return a mock response
    return {
      key,
      found: false,
      value: undefined,
    }
  }

  /**
   * Example RPC method - processes batch operations
   */
  async processBatch(
    items: string[],
  ): Promise<{ processed: number; items: string[] }> {
    const processed = items.map((item) => item.toUpperCase())
    return {
      processed: items.length,
      items: processed,
    }
  }

  /**
   * Fetch GitHub repository information
   */
  async getGitHubRepo(owner: string, repo: string): Promise<GitHubRepo> {
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

  /**
   * Fetch repository tree (file listing) at a specific path
   */
  async getRepoTree(
    owner: string,
    repo: string,
    ref?: string,
    path?: string,
  ): Promise<RepoTreeResult> {
    // First get repo info to know default branch
    const repoInfo = await this.getGitHubRepo(owner, repo)
    const targetRef = ref || repoInfo.default_branch

    // Get the tree recursively
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

    // Filter tree to only show entries at the current path level
    const currentPath = path || ""
    const pathPrefix = currentPath ? `${currentPath}/` : ""

    const filteredTree = fullTree.tree.filter((entry) => {
      if (currentPath === "") {
        // Root level: only show entries without slashes (direct children)
        return !entry.path.includes("/")
      }
      // Specific path: show entries that start with pathPrefix and are direct children
      if (!entry.path.startsWith(pathPrefix)) return false
      const remainingPath = entry.path.slice(pathPrefix.length)
      return !remainingPath.includes("/")
    })

    // Sort: directories first, then files, both alphabetically
    filteredTree.sort((a, b) => {
      if (a.type === "tree" && b.type !== "tree") return -1
      if (a.type !== "tree" && b.type === "tree") return 1
      return a.path.localeCompare(b.path)
    })

    // Try to find and fetch README
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
        const readmeContent = await this.getFileContent(
          owner,
          repo,
          readmePath,
          targetRef,
        )
        if (!readmeContent.isBinary) {
          readme = {
            content: readmeContent.content,
            path: readmePath,
          }
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

  /**
   * Fetch file content from GitHub
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<FileContentResult> {
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

    // Check if binary by looking at file extension
    const binaryExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".ico",
      ".webp",
      ".pdf",
      ".zip",
      ".tar",
      ".gz",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
    ]
    const isBinary = binaryExtensions.some((ext) =>
      path.toLowerCase().endsWith(ext),
    )

    let content = data.content
    if (data.encoding === "base64" && !isBinary) {
      // Decode base64 content for text files
      content = atob(data.content.replace(/\n/g, ""))
    }

    return {
      content,
      path: data.path,
      size: data.size,
      isBinary,
      encoding: data.encoding,
    }
  }

  /**
   * Fetch branches for a repository
   */
  async getRepoBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "gitedit-app",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch branches: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Fetch recent commits for a repository
   */
  async getRepoCommits(
    owner: string,
    repo: string,
    ref?: string,
    page = 1,
    perPage = 30,
  ): Promise<GitHubCommit[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    })
    if (ref) params.set("sha", ref)

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?${params}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "gitedit-app",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch commits: ${response.status}`)
    }

    return response.json()
  }
}

// Export the RPC worker as the default export
export default WorkerRpc
