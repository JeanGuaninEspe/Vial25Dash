import type { APIRoute } from "astro"

const v2BaseUrl = import.meta.env.V2_API_BASE_URL || ""

export const PATCH: APIRoute = async ({ request, params }) => {
  const { id } = params

  if (!v2BaseUrl) {
    return new Response(
      JSON.stringify({ message: "V2_API_BASE_URL no esta configurado." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  const authorization = request.headers.get("authorization")
  const cookie = request.headers.get("cookie")
  const contentType = request.headers.get("content-type") || "application/json"
  const bodyText = await request.text()

  const upstreamResponse = await fetch(`${v2BaseUrl}/descuentos-rfid/${id}`, {
    method: "PATCH",
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
