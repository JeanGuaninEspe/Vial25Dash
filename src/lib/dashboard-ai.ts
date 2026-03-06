export type DashboardAiChartType = "line" | "area" | "bar" | "pie" | string

export type DashboardAiResponse = {
  schemaVersion?: string
  query?: {
    dataset?: string
    dimension?: string
    breakdown?: string
    metric?: string
    aggregation?: string
    filters?: Record<string, unknown>
    limit?: number
  }
  rows?: Array<{ label: string; value: number }>
  chart?: {
    type?: DashboardAiChartType
    title?: string
    labels?: string[]
    series?: Array<{ name?: string; data?: number[] }>
  }
  chartDecision?: {
    source?: string
  }
  debug?: {
    sqlFiltersApplied?: unknown
    insightsFallbackReason?: string
  }
  insights?: {
    summary?: string
    highlights?: string[]
    risks?: string[]
    recommendations?: string[]
    source?: "ai" | "fallback" | string
    confidence?: "low" | "medium" | "high" | string
  }
}

export type DashboardAiChartRow = {
  label: string
  value: number
}

export type DashboardAiSeriesKey = {
  key: string
  label: string
}

export type DashboardAiMultiSeriesRow = {
  label: string
} & Record<string, string | number>

type FetchDashboardAiInput = {
  prompt: string
  limit?: number
  preferredChartType?: "line" | "area" | "bar" | "pie"
}

type FetchDashboardAiInsightsInput = {
  prompt: string
  query: NonNullable<DashboardAiResponse["query"]>
  rows: Array<{ label: string; value: number }>
  chart?: NonNullable<DashboardAiResponse["chart"]>
}

const baseUrl = import.meta.env.PUBLIC_BASE_URL || ""

function buildDashboardAiUrl() {
  if (!baseUrl) return "/dashboard-ai/query"
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  return `${normalized}/dashboard-ai/query`
}

function getCookieValue(name: string): string {
  if (typeof document === "undefined") return ""
  const encodedName = encodeURIComponent(name)
  const cookies = document.cookie.split(";")
  for (const part of cookies) {
    const cookie = part.trim()
    if (cookie.startsWith(`${encodedName}=`)) {
      return decodeURIComponent(cookie.substring(encodedName.length + 1))
    }
  }
  return ""
}

function getStoredAccessToken(): string {
  if (typeof window === "undefined") return ""

  const sessionToken = sessionStorage.getItem("access_token") || ""
  if (sessionToken) return sessionToken

  const localToken = localStorage.getItem("access_token") || ""
  if (localToken) return localToken

  return getCookieValue("access_token")
}

async function parseApiError(response: Response, fallbackMessage: string): Promise<Error> {
  const statusText = response.statusText || "Error"

  try {
    const payload = (await response.json()) as {
      message?: string | string[]
      error?: string
      statusCode?: number
    }

    const message = Array.isArray(payload.message)
      ? payload.message.join(". ")
      : payload.message

    if (message) {
      const suffix = payload.statusCode ? ` (status ${payload.statusCode})` : ""
      return new Error(`${message}${suffix}`)
    }

    if (payload.error) {
      return new Error(`${payload.error} (${response.status})`)
    }
  } catch {
    // Intentar recuperar texto plano/HTML devuelto por el backend o proveedor.
  }

  return new Error(`${fallbackMessage}: ${statusText} (${response.status})`)
}

export async function fetchDashboardAi({
  prompt,
  limit = 30,
  preferredChartType,
}: FetchDashboardAiInput): Promise<DashboardAiResponse> {
  const token = getStoredAccessToken()
  if (!token) {
    throw new Error("No hay access token disponible. Inicia sesión nuevamente.")
  }

  const res = await fetch(buildDashboardAiUrl(), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt,
      limit,
      ...(preferredChartType ? { preferredChartType } : {}),
    }),
  })

  if (!res.ok) {
    throw await parseApiError(res, "Error consultando dashboard-ai")
  }

  return (await res.json()) as DashboardAiResponse
}

export async function fetchDashboardAiInsights({
  prompt,
  query,
  rows,
  chart,
}: FetchDashboardAiInsightsInput): Promise<DashboardAiResponse["insights"]> {
  const token = getStoredAccessToken()
  if (!token) {
    throw new Error("No hay access token disponible. Inicia sesión nuevamente.")
  }

  const base = buildDashboardAiUrl()
  const insightsUrl = base.endsWith("/query") ? base.replace(/\/query$/, "/insights") : `${base}/insights`

  const res = await fetch(insightsUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt,
      query,
      rows,
      ...(chart ? { chart } : {}),
    }),
  })

  if (!res.ok) {
    throw await parseApiError(res, "Error consultando insights")
  }

  const payload = (await res.json()) as DashboardAiResponse
  return payload.insights
}

export function toChartData(api: DashboardAiResponse): DashboardAiChartRow[] {
  const labels = api.chart?.labels ?? []
  const values = api.chart?.series?.[0]?.data ?? []

  return labels.map((label, i) => ({
    label,
    value: values[i] ?? 0,
  }))
}

function normalizeSeriesKey(name: string, index: number): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return sanitized || `series_${index + 1}`
}

export function toMultiSeriesChartData(api: DashboardAiResponse): {
  rows: DashboardAiMultiSeriesRow[]
  series: DashboardAiSeriesKey[]
} {
  const labels = api.chart?.labels ?? []
  const inputSeries = api.chart?.series ?? []

  const series = inputSeries.map((item, index) => {
    const label = item.name?.trim() || `Serie ${index + 1}`
    return {
      key: normalizeSeriesKey(label, index),
      label,
    }
  })

  const rows = labels.map((label, labelIndex) => {
    const row: DashboardAiMultiSeriesRow = { label }
    series.forEach((seriesItem, seriesIndex) => {
      const value = inputSeries[seriesIndex]?.data?.[labelIndex] ?? 0
      row[seriesItem.key] = value
    })
    return row
  })

  return { rows, series }
}
