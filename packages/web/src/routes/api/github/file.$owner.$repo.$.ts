import { createFileRoute } from "@tanstack/react-router"

type FileContentResult = {
  content: string
  path: string
  size: number
  isBinary: boolean
  encoding: string
}

async function getFileContent(
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

  return {
    content,
    path: data.path,
    size: data.size,
    isBinary,
    encoding: data.encoding,
  }
}

const serve = async ({
  params,
  request,
}: {
  params: { owner: string; repo: string; _splat: string }
  request: Request
}) => {
  try {
    const { owner, repo, _splat: path } = params
    const url = new URL(request.url)
    const ref = url.searchParams.get("ref") || undefined

    const result = await getFileContent(owner, repo, path, ref)
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export const Route = createFileRoute("/api/github/file/$owner/$repo/$")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
