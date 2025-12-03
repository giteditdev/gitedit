import { createFileRoute } from "@tanstack/react-router"
import { RepoPage } from "@/components/repo/RepoPage"

type RepoSearch = {
  ref?: string
}

export const Route = createFileRoute("/repo/$owner/$repo")({
  validateSearch: (search: Record<string, unknown>): RepoSearch => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  component: RepoRoute,
})

function RepoRoute() {
  const { owner, repo } = Route.useParams()
  const { ref } = Route.useSearch()

  return <RepoPage owner={owner} repo={repo} ref={ref} />
}
