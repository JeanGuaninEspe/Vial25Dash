import { defineMiddleware } from "astro:middleware"

const PUBLIC_FILE = /\.[\w]+$/

export const onRequest = defineMiddleware(async ({ url }, next) => {
  const { pathname } = url

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_astro") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return next()
  }

  return next()
})
