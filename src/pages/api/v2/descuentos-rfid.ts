import type { APIRoute } from "astro"

const v2BaseUrl = import.meta.env.V2_API_BASE_URL || ""

export const GET: APIRoute = async ({ request, url }) => {
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

  const targetUrl = new URL(`${v2BaseUrl}/descuentos-rfid`)
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value)
  })

  const authorization = request.headers.get("authorization")
  const cookie = request.headers.get("cookie")

  const upstreamResponse = await fetch(targetUrl, {
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

  const authorization = request.headers.get("authorization")
  const cookie = request.headers.get("cookie")
  const contentType = request.headers.get("content-type") || "application/json"
  const bodyText = await request.text()

  const upstreamResponse = await fetch(`${v2BaseUrl}/descuentos-rfid`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Accept: "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: bodyText,
  })

  return upstreamResponse
}
