import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Github, ArrowRight, Loader2 } from "lucide-react"
import { GitHubShell } from "@/components/layout/GitHubShell"

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
    <GitHubShell>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] items-center">
          <section className="space-y-6 animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 shadow-sm">
              <Github className="h-3.5 w-3.5" />
              Your GitHub workspace, reimagined
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              Explore repositories with a familiar GitHub feel.
            </h1>
            <p className="text-lg text-slate-600">
              Jump straight into any public repo, keep the GitHub ergonomics,
              and layer on focused insights when you are ready.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    setError(null)
                  }}
                  placeholder="Paste a GitHub URL or owner/repo (e.g., facebook/react)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-base text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[#1f6feb] p-2 text-white shadow-sm transition-colors hover:bg-[#0969da] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-5 w-5" />
                  )}
                </button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>

            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-medium uppercase tracking-wide text-slate-400">
                Examples
              </span>
              {[
                "facebook/react",
                "vercel/next.js",
                "microsoft/vscode",
                "tailwindlabs/tailwindcss",
              ].map((repo) => (
                <button
                  key={repo}
                  onClick={() => setInput(repo)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  {repo}
                </button>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm animate-rise">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              What you get
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#1f6feb]" />
                Repo trees and file views styled to feel like GitHub.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#1f6feb]" />
                Branch-aware browsing and readable file previews.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#1f6feb]" />
                Space to add custom insights later without losing familiarity.
              </li>
            </ul>
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              Tip: Add your favorite repo formats. We accept URLs, repo slugs,
              and shortcut paths.
            </div>
          </aside>
        </div>
      </main>
    </GitHubShell>
  )
}
