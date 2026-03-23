type ApiFetchOptions = RequestInit & {
  skipAuthRefresh?: boolean
}

const baseUrl = import.meta.env.PUBLIC_BASE_URL || ""

function buildUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl
  }
  // No usar PUBLIC_BASE_URL para las peticiones que van al proxy local de Astro de V2
  if (pathOrUrl.startsWith("/api/v2")) {
    return pathOrUrl
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
  })
}
