import { createFileRoute } from "@tanstack/react-router"

// GitHub API types
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

const serve = async ({ params }: { params: { owner: string; repo: string } }) => {
  try {
    const { owner, repo } = params
    const repoInfo = await fetchGitHubRepo(owner, repo)
    return Response.json(repoInfo)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export const Route = createFileRoute("/api/github/repo/$owner/$repo")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
