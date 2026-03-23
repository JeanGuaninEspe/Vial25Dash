import { defineMiddleware } from "astro:middleware"
import { canAccessAdminPanel, canAccessDashboards, canAccessRfidModule, normalizeRole } from "@/lib/roles"

const PUBLIC_FILE = /\.[\w]+$/
const DASHBOARD_PATHS = [
  "/overview",
  "/dashboard",
  "/analisis-temporal",
  "/estadistico",
  "/cabinas",
  "/facturacion",
]
const RFID_PATH = "/descuentos-rfid"
const ADMIN_PANEL_PATH = "/panel-admin"

function getCookieValue(cookieHeader: string | null, key: string) {
  if (!cookieHeader) return ""

  const target = `${key}=`
  const pair = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))

  if (!pair) return ""
  return decodeURIComponent(pair.slice(target.length))
}

export const onRequest = defineMiddleware(async ({ url, request }, next) => {
  const { pathname } = url

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_astro") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return next()
  }

  const role = normalizeRole(getCookieValue(request.headers.get("cookie"), "user_role"))
  const isDashboardRoute =
    DASHBOARD_PATHS.includes(pathname) || pathname.startsWith("/experimental")
  const isRfidRoute = pathname === RFID_PATH
  const isAdminPanelRoute = pathname === ADMIN_PANEL_PATH

  if (!role) {
    return Response.redirect(new URL("/login", url), 302)
  }

  if (isDashboardRoute && !canAccessDashboards(role)) {
    if (canAccessRfidModule(role)) {
      return Response.redirect(new URL(RFID_PATH, url), 302)
    }

    return Response.redirect(new URL("/login", url), 302)
  }

  if (isRfidRoute && !canAccessRfidModule(role)) {
    if (canAccessDashboards(role)) {
      return Response.redirect(new URL("/overview", url), 302)
    }

    return Response.redirect(new URL("/login", url), 302)
  }

  if (isAdminPanelRoute && !canAccessAdminPanel(role)) {
    if (canAccessRfidModule(role)) {
      return Response.redirect(new URL(RFID_PATH, url), 302)
    }

    return Response.redirect(new URL("/login", url), 302)
  }

  if (pathname === "/") {
    if (canAccessDashboards(role)) {
      return Response.redirect(new URL("/overview", url), 302)
    }

    if (canAccessRfidModule(role)) {
      return Response.redirect(new URL(RFID_PATH, url), 302)
    }

    return Response.redirect(new URL("/login", url), 302)
  }

  return next()
})
