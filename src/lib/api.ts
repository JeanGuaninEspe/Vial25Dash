type ApiFetchOptions = RequestInit & {
  skipAuthRefresh?: boolean
}

const baseUrl = import.meta.env.PUBLIC_BASE_URL || ""

function buildUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
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

export async function apiFetch(pathOrUrl: string, options: ApiFetchOptions = {}) {
  const url = buildUrl(pathOrUrl)
  const response = await fetch(url, {
    credentials: "include",
    ...options,
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
    return response
  }

  return fetch(url, {
    credentials: "include",
    ...options,
  })
}
