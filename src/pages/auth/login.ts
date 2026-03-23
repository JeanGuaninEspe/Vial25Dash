import type { APIRoute } from "astro"

const v2BaseUrl = import.meta.env.V2_API_BASE_URL || ""

export const POST: APIRoute = async ({ request }) => {
  if (!v2BaseUrl) {
    return new Response(
      JSON.stringify({ message: "V2_API_BASE_URL no esta configurado." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }

  const targetUrl = `${v2BaseUrl}/auth/login`
  const requestBody = await request.text()

  const upstreamResponse = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
      Accept: "application/json",
    },
    body: requestBody,
  })

  if (!import.meta.env.DEV) {
    return upstreamResponse
  }

  const setCookieHeader = upstreamResponse.headers.get("set-cookie") || ""
  const hasRefreshTokenCookie = setCookieHeader.toLowerCase().includes("refresh_token=")

  console.info("[auth/login] V2 login debug", {
    status: upstreamResponse.status,
    hasSetCookie: Boolean(setCookieHeader),
    hasRefreshTokenCookie,
  })

  const debugHeaders = new Headers(upstreamResponse.headers)
  debugHeaders.set(
    "x-v2-login-debug-refresh-cookie",
    hasRefreshTokenCookie ? "present" : "missing",
  )

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: debugHeaders,
  })
}
