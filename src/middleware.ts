import { defineMiddleware } from "astro:middleware"

const PUBLIC_FILE = /\.[\w]+$/

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const { pathname } = url

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_astro") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return next()
  }

  const isAuthed = Boolean(cookies.get("access_token")?.value)

  if (!isAuthed) {
    return redirect("/login")
  }

  return next()
})
