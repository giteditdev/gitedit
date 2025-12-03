import { createFileRoute } from "@tanstack/react-router"
import { RepoPage } from "@/components/repo/RepoPage"

type RepoSearch = {
  ref?: string
}

export const Route = createFileRoute("/repo/$owner/$repo/$")({
  validateSearch: (search: Record<string, unknown>): RepoSearch => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  component: RepoPathRoute,
})

function RepoPathRoute() {
  const { owner, repo, _splat } = Route.useParams()
  const { ref } = Route.useSearch()

  return <RepoPage owner={owner} repo={repo} path={_splat} ref={ref} />
}
