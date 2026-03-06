import * as React from "react"
import {
  Legend,
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  fetchDashboardAi,
  fetchDashboardAiInsights,
  toMultiSeriesChartData,
  type DashboardAiResponse,
} from "@/lib/dashboard-ai"

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

type PreferredChartType = "auto" | "line" | "area" | "bar" | "pie"
const COOLDOWN_SECONDS = 25

const getSeriesColor = (index: number) => {
  const paletteIndex = (index % PIE_COLORS.length) + 1
  return `var(--chart-${paletteIndex})`
}

type NormalizedInsights = {
  summary?: string
  highlights: string[]
  risks: string[]
  recommendations: string[]
}

function cleanInsightText(value: string): string {
  return value
    .replace(/^"|"$/g, "")
    .replace(/,$/, "")
    .trim()
}

function extractObjectFromText(value: string): Record<string, unknown> | null {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null

  try {
    return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanInsightText(String(item ?? "")))
      .filter(Boolean)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => cleanInsightText(String(item ?? "")))
          .filter(Boolean)
      }
    } catch {
      // continuar con parseo flexible.
    }

    const quoted = [...trimmed.matchAll(/"([^\"]+)"/g)]
      .map((match) => cleanInsightText(match[1] || ""))
      .filter(
        (item) =>
          item &&
          !/^(summary|highlights|risks|recommendations)$/i.test(item)
      )
    if (quoted.length) return quoted

    return trimmed
      .split(/\r?\n|;/)
      .map((line) => cleanInsightText(line))
      .filter(
        (line) =>
          Boolean(line) &&
          !/^(\{|\}|\[|\]|Highlights|Riesgos|Recomendaciones)$/i.test(line) &&
          !/^"?(summary|highlights|risks|recommendations)"?\s*:/i.test(line)
      )
  }

  return []
}

function normalizeSummary(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  if (!text) return undefined

  const summaryMatch = text.match(/"summary"\s*:\s*"([^"]+)"/i)
  if (summaryMatch?.[1]) {
    return cleanInsightText(summaryMatch[1])
  }

  if (/^[\[{]/.test(text)) {
    const parsedObject = extractObjectFromText(text)
    const parsedSummary = parsedObject?.summary
    if (typeof parsedSummary === "string") {
      return cleanInsightText(parsedSummary)
    }
  }

  return cleanInsightText(text)
}

function normalizeInsights(rawInsights: DashboardAiResponse["insights"]): NormalizedInsights {
  const fallback: NormalizedInsights = {
    summary: undefined,
    highlights: [],
    risks: [],
    recommendations: [],
  }

  if (!rawInsights) return fallback

  const maybeObjectFromSummary =
    typeof rawInsights.summary === "string"
      ? extractObjectFromText(rawInsights.summary)
      : null

  const merged = {
    summary: maybeObjectFromSummary?.summary ?? rawInsights.summary,
    highlights: maybeObjectFromSummary?.highlights ?? rawInsights.highlights,
    risks: maybeObjectFromSummary?.risks ?? rawInsights.risks,
    recommendations:
      maybeObjectFromSummary?.recommendations ?? rawInsights.recommendations,
  }

  return {
    summary: normalizeSummary(merged.summary),
    highlights: normalizeList(merged.highlights),
    risks: normalizeList(merged.risks),
    recommendations: normalizeList(merged.recommendations),
  }
}

export function ChartDashboardAi() {
  const [prompt, setPrompt] = React.useState("")
  const [allowChartTypeSelection, setAllowChartTypeSelection] = React.useState(false)
  const [preferredChartType, setPreferredChartType] =
    React.useState<PreferredChartType>("auto")
  const [loadingAction, setLoadingAction] = React.useState<"query" | "insights" | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [apiResponse, setApiResponse] = React.useState<DashboardAiResponse | null>(
    null
  )

  React.useEffect(() => {
    if (cooldownRemaining <= 0) return

    const timeoutId = window.setTimeout(() => {
      setCooldownRemaining((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [cooldownRemaining])

  const { rows, series } = React.useMemo(() => {
    if (!apiResponse) return { rows: [], series: [] }
    return toMultiSeriesChartData(apiResponse)
  }, [apiResponse])

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    series.forEach((item, index) => {
      config[item.key] = {
        label: item.label,
        color: getSeriesColor(index),
      }
    })
    return config
  }, [series])

  const pieData = React.useMemo(() => {
    return rows.map((row) => {
      const total = series.reduce((acc, serie) => {
        const raw = row[serie.key]
        return acc + (typeof raw === "number" ? raw : 0)
      }, 0)
      return {
        label: String(row.label),
        value: total,
      }
    })
  }, [rows, series])

  const firstSeriesKey = series[0]?.key

  const resolvedType = apiResponse?.chart?.type
  const isLoading = loadingAction !== null
  const canRequestInsights = Boolean(apiResponse?.query && apiResponse?.rows?.length)

  const handleQuery = async () => {
    if (isLoading || cooldownRemaining > 0) return

    if (!prompt.trim()) {
      setError("Escribe un prompt para consultar")
      return
    }

    setLoadingAction("query")
    setError(null)

    try {
      const response = await fetchDashboardAi({
        prompt,
        limit: 30,
        preferredChartType:
          allowChartTypeSelection && preferredChartType !== "auto"
            ? preferredChartType
            : undefined,
      })
      setApiResponse(response)
    } catch (err) {
      setApiResponse(null)
      setError(err instanceof Error ? err.message : "Error inesperado")
    } finally {
      setLoadingAction(null)
      setCooldownRemaining(COOLDOWN_SECONDS)
    }
  }

  const handleInsights = async () => {
    if (isLoading || cooldownRemaining > 0 || !canRequestInsights || !apiResponse) return

    const query = apiResponse.query
    const rowsPayload = apiResponse.rows

    if (!query || !rowsPayload?.length) {
      setError("No hay contexto suficiente para generar insights.")
      return
    }

    setLoadingAction("insights")
    setError(null)

    try {
      const insights = await fetchDashboardAiInsights({
        prompt,
        query,
        rows: rowsPayload,
        chart: apiResponse.chart,
      })

      setApiResponse((current) => {
        if (!current) return current
        return {
          ...current,
          insights,
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando insights")
    } finally {
      setLoadingAction(null)
      setCooldownRemaining(COOLDOWN_SECONDS)
    }
  }

  const isCooldown = cooldownRemaining > 0
  const queryButtonLabel = loadingAction === "query"
    ? "Consultando..."
    : isCooldown
      ? `Espera ${cooldownRemaining}s`
      : "Consultar gráfico"

  const insightsButtonLabel = loadingAction === "insights"
    ? "Generando insights..."
    : isCooldown
      ? `Espera ${cooldownRemaining}s`
      : "Generar análisis"

  const isPlannerUnavailable = Boolean(
    error && /(522|503|planner|Service Unavailable)/i.test(error)
  )

  const isManualInsightsDisabled =
    isLoading ||
    isCooldown ||
    !canRequestInsights

  const renderChart = () => {
    if (!apiResponse) {
      return (
        <p className="text-sm text-muted-foreground">
          Ejecuta una consulta para visualizar datos dinámicos.
        </p>
      )
    }

    if (!rows.length || !series.length) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Sin datos para el prompt actual.</p>
          <p className="text-xs text-muted-foreground">
            debug.sqlFiltersApplied: {JSON.stringify(apiResponse.debug?.sqlFiltersApplied ?? null)}
          </p>
        </div>
      )
    }

    if (resolvedType === "line") {
      return (
        <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
          <LineChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend content={<ChartLegendContent />} />
            {series.map((serie) => (
              <Line
                key={serie.key}
                dataKey={serie.key}
                name={serie.label}
                type="monotone"
                stroke={`var(--color-${serie.key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )
    }

    if (resolvedType === "area") {
      return (
        <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
          <AreaChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend content={<ChartLegendContent />} />
            {series.map((serie) => (
              <Area
                key={serie.key}
                dataKey={serie.key}
                name={serie.label}
                type="monotone"
                fill={`var(--color-${serie.key})`}
                fillOpacity={0.2}
                stroke={`var(--color-${serie.key})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      )
    }

    if (resolvedType === "bar") {
      return (
        <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend content={<ChartLegendContent />} />
            {series.map((serie) => (
              <Bar
                key={serie.key}
                dataKey={serie.key}
                name={serie.label}
                fill={`var(--color-${serie.key})`}
                radius={4}
              />
            ))}
          </BarChart>
        </ChartContainer>
      )
    }

    if (resolvedType === "pie") {
      return (
        <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      )
    }

    return (
      <Card className="py-4">
        <CardContent>
          <p className="text-sm text-muted-foreground">KPI</p>
          <p className="text-2xl font-semibold">
            {firstSeriesKey && typeof rows[0]?.[firstSeriesKey] === "number"
              ? (rows[0][firstSeriesKey] as number)
              : 0}
          </p>
        </CardContent>
      </Card>
    )
  }

  const renderInsights = () => {
    if (loadingAction === "insights") {
      return (
        <Card className="py-4">
          <CardHeader className="px-6 py-0 gap-2">
            <CardTitle className="text-base">Análisis</CardTitle>
            <CardDescription>Generando insights...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )
    }

    const insights = apiResponse?.insights
    if (!insights) return null
    const fallbackReason = apiResponse?.debug?.insightsFallbackReason
    const normalized = normalizeInsights(insights)

    const hasHighlights = normalized.highlights.length > 0
    const hasRisks = normalized.risks.length > 0
    const hasRecommendations = normalized.recommendations.length > 0

    return (
      <Card className="py-4">
        <CardHeader className="px-6 py-0 gap-2">
          <CardTitle className="text-base">Análisis</CardTitle>
          <CardDescription>
            source: {insights.source ?? "fallback"} · confidence: {insights.confidence ?? "low"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.source === "fallback" && fallbackReason && (
            <p className="text-xs text-muted-foreground">
              Fallback aplicado: {fallbackReason}
            </p>
          )}
          {normalized.summary && (
            <p className="text-sm text-foreground">{normalized.summary}</p>
          )}
          {hasHighlights && (
            <div>
              <p className="text-sm font-medium">Highlights</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {normalized.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {hasRisks && (
            <div>
              <p className="text-sm font-medium">Riesgos</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {normalized.risks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {hasRecommendations && (
            <div>
              <p className="text-sm font-medium">Recomendaciones</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {normalized.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="pt-0 mt-6">
      <CardHeader className="flex flex-col gap-3 border-b py-5">
        <CardTitle>Dashboard AI (Experimental)</CardTitle>
        <CardDescription>
          {apiResponse?.chart?.title || "Flujo: 1) consultar gráfico, 2) esperar 25s, 3) generar análisis."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3">
          <Input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ej: tráfico temporal últimos 7 días"
          />

          <div className="rounded-lg border px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="switch-chart-type" className="text-sm">
                  Elegir tipo de gráfico
                </Label>
                <Switch
                  id="switch-chart-type"
                  checked={allowChartTypeSelection}
                  onCheckedChange={setAllowChartTypeSelection}
                />
              </div>

              {allowChartTypeSelection && (
                <div className="w-full sm:w-[180px]">
                  <Select
                    value={preferredChartType}
                    onValueChange={(value) =>
                      setPreferredChartType(value as PreferredChartType)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tipo de gráfico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="pie">Pie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleQuery} disabled={isLoading || isCooldown}>
            {queryButtonLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleInsights}
            disabled={isManualInsightsDisabled}
          >
            {insightsButtonLabel}
          </Button>
          {isCooldown && !isLoading && (
            <span className="text-xs text-muted-foreground">Límite activo: nueva consulta al finalizar el contador.</span>
          )}
          {apiResponse?.chartDecision?.source && (
            <span className="text-xs text-muted-foreground">
              chartDecision.source: {apiResponse.chartDecision.source}
            </span>
          )}
        </div>

        {error && (
          <div className="space-y-1">
            <p className="text-sm text-destructive">{error}</p>
            {isPlannerUnavailable && (
              <p className="text-xs text-muted-foreground">
                El proveedor externo del planner está inestable. Reintenta en unos segundos.
              </p>
            )}
          </div>
        )}

        {renderChart()}
        {renderInsights()}
      </CardContent>
    </Card>
  )
}
