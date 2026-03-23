import type { APIRoute } from "astro"

const v2BaseUrl = import.meta.env.V2_API_BASE_URL || ""

function missingConfig() {
  return new Response(
    JSON.stringify({ message: "V2_API_BASE_URL no esta configurado." }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  )
}

export const GET: APIRoute = async ({ request }) => {
  if (!v2BaseUrl) return missingConfig()

  const authorization = request.headers.get("authorization")
  const cookie = request.headers.get("cookie")

  const upstreamResponse = await fetch(`${v2BaseUrl}/users`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  })

  return upstreamResponse
}

export const POST: APIRoute = async ({ request }) => {
  if (!v2BaseUrl) return missingConfig()

  const authorization = request.headers.get("authorization")
  const cookie = request.headers.get("cookie")
  const bodyText = await request.text()

  const upstreamResponse = await fetch(`${v2BaseUrl}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: bodyText,
  })

  return upstreamResponse
}
