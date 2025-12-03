import { Hono } from "hono"
import { cors } from "hono/cors"
import { WorkerRpc } from "./rpc"

// Create a new Hono app
const app = new Hono()

// Enable CORS for all routes
app.use("/*", cors())

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", message: "Worker is running!" })
})

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "Welcome to the Cloudflare Worker API",
    endpoints: {
      health: "/health",
      api: "/api/v1",
      github: "/api/github",
    },
  })
})

// Example API endpoint
app.get("/api/v1/hello", (c) => {
  const name = c.req.query("name") || "World"
  return c.json({ message: `Hello, ${name}!` })
})

// GitHub API routes - helper to create RPC instance with context
function createRpc(c: { executionCtx: ExecutionContext; env: unknown }) {
  return new WorkerRpc(c.executionCtx, c.env as never)
}

app.get("/api/github/repo/:owner/:repo", async (c) => {
  const { owner, repo } = c.req.param()
  try {
    const rpc = createRpc(c)
    const repoInfo = await rpc.getGitHubRepo(owner, repo)
    return c.json(repoInfo)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    )
  }
})

app.get("/api/github/tree/:owner/:repo", async (c) => {
  const { owner, repo } = c.req.param()
  const ref = c.req.query("ref")
  const path = c.req.query("path")
  try {
    const rpc = createRpc(c)
    const tree = await rpc.getRepoTree(owner, repo, ref, path)
    return c.json(tree)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    )
  }
})

app.get("/api/github/file/:owner/:repo/*", async (c) => {
  const { owner, repo } = c.req.param()
  const path = c.req.path.replace(`/api/github/file/${owner}/${repo}/`, "")
  const ref = c.req.query("ref")
  try {
    const rpc = createRpc(c)
    const content = await rpc.getFileContent(owner, repo, path, ref)
    return c.json(content)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    )
  }
})

app.get("/api/github/branches/:owner/:repo", async (c) => {
  const { owner, repo } = c.req.param()
  try {
    const rpc = createRpc(c)
    const branches = await rpc.getRepoBranches(owner, repo)
    return c.json(branches)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    )
  }
})

app.get("/api/github/commits/:owner/:repo", async (c) => {
  const { owner, repo } = c.req.param()
  const ref = c.req.query("ref")
  const page = parseInt(c.req.query("page") || "1", 10)
  const perPage = parseInt(c.req.query("per_page") || "30", 10)
  try {
    const rpc = createRpc(c)
    const commits = await rpc.getRepoCommits(owner, repo, ref, page, perPage)
    return c.json(commits)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    )
  }
})

// Export the Hono app as default (handles HTTP requests)
export default app

// Export the RPC worker for RPC calls via service bindings
export { WorkerRpc } from "./rpc"
