import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Github, ArrowRight, Loader2 } from "lucide-react"

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  // Handle various GitHub URL formats:
  // - https://github.com/owner/repo
  // - https://github.com/owner/repo.git
  // - github.com/owner/repo
  // - owner/repo
  const trimmed = input.trim()

  // Try full URL first
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/\s.]+)/i,
  )
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, "") }
  }

  // Try owner/repo format
  const shortMatch = trimmed.match(/^([^\/\s]+)\/([^\/\s]+)$/)
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/, "") }
  }

  return null
}

export function HomePage() {
  const navigate = useNavigate()
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsed = parseGitHubUrl(input)
    if (!parsed) {
      setError("Please enter a valid GitHub URL or owner/repo format")
      return
    }

    setIsLoading(true)

    try {
      // Verify the repo exists by fetching its info
      const res = await fetch(
        `/api/github/tree/${parsed.owner}/${parsed.repo}`,
      )
      if (!res.ok) {
        throw new Error("Repository not found")
      }

      // Navigate to the repo page
      navigate({
        to: "/repo/$owner/$repo",
        params: { owner: parsed.owner, repo: parsed.repo },
      })
    } catch {
      setError("Repository not found. Please check the URL and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
          {/* Logo/Title */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <Github className="w-12 h-12 text-blue-400" />
            <h1 className="text-4xl font-bold">GitEdit</h1>
          </div>

          <p className="text-slate-400 text-lg mb-8">
            Explore GitHub repositories with enhanced changelogs and insights
          </p>

          {/* URL Input Form */}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setError(null)
                }}
                placeholder="Enter GitHub URL or owner/repo (e.g., facebook/react)"
                className="w-full px-6 py-4 pr-14 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-lg transition-colors"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-red-400 text-sm text-left">{error}</p>
            )}
          </form>

          {/* Example repos */}
          <div className="mt-8">
            <p className="text-slate-500 text-sm mb-3">Try these examples:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "facebook/react",
                "vercel/next.js",
                "microsoft/vscode",
                "tailwindlabs/tailwindcss",
              ].map((repo) => (
                <button
                  key={repo}
                  onClick={() => setInput(repo)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  {repo}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-600 text-sm">
        <p>View any public GitHub repository with enhanced features</p>
      </footer>
    </div>
  )
}
