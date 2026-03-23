type ApiFetchOptions = RequestInit & {
  skipAuthRefresh?: boolean
}

const baseUrl = import.meta.env.PUBLIC_BASE_URL || ""
const v2BaseUrl = import.meta.env.PUBLIC_V2_API_BASE_URL || ""

function trimSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function buildUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl
  }

  // Convertir rutas locales del proyecto a endpoints directos V2.
  if (pathOrUrl.startsWith("/auth/")) {
    return `${trimSlash(v2BaseUrl)}${pathOrUrl}`
  }

  // Convertir /api/v2/* a PUBLIC_V2_API_BASE_URL/*
  if (pathOrUrl.startsWith("/api/v2")) {
    const v2Path = pathOrUrl.replace(/^\/api\/v2/, "")
    return `${trimSlash(v2BaseUrl)}${v2Path || ""}`
  }

  return `${baseUrl}${pathOrUrl}`
}

function shouldSkipRefresh(url: string, options?: ApiFetchOptions) {
  if (options?.skipAuthRefresh) return true
  if (url.includes("/auth/login")) return true
  if (url.includes("/auth/refresh")) return true
  return false
}

function getStoredAccessToken(): string {
  if (typeof window === "undefined") return ""
  const sessionToken = sessionStorage.getItem("access_token")
  if (sessionToken) return sessionToken
  return localStorage.getItem("access_token") || ""
}

export async function apiFetch(pathOrUrl: string, options: ApiFetchOptions = {}) {
  const url = buildUrl(pathOrUrl)
  
  const headers = new Headers(options.headers || {})
  const token = getStoredAccessToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  })

  if (response.status !== 401 || shouldSkipRefresh(url, options)) {
    return response
  }

  const refreshUrl = buildUrl("/auth/refresh")
  const refresh = await fetch(refreshUrl, {
    method: "POST",
    credentials: "include",
  })

  if (!refresh.ok) {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("access_token")
      localStorage.removeItem("access_token")
      window.location.href = "/login"
    }
    return response
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  })
}
