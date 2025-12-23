import { type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Github } from "lucide-react"

type GitHubShellProps = {
  children: ReactNode
  subnav?: ReactNode
}

export function GitHubShell({ children, subnav }: GitHubShellProps) {
  return (
    <div className="min-h-screen text-[color:var(--gh-text)]">
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Github className="h-5 w-5" />
            <span className="tracking-tight">GitEdit</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-slate-300">
            <Link to="/" className="hover:text-white transition-colors">
              Explore
            </Link>
            <Link to="/chat" className="hover:text-white transition-colors">
              Discussions
            </Link>
            <Link to="/users" className="hover:text-white transition-colors">
              People
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link to="/login" className="text-slate-300 hover:text-white">
              Sign in
            </Link>
            <span className="hidden sm:inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
              Public preview
            </span>
          </div>
        </div>
      </header>

      {subnav ? (
        <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4">{subnav}</div>
        </div>
      ) : null}

      {children}
    </div>
  )
}
