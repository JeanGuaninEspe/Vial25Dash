import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { getISOWeek } from "date-fns"
import { BarChart3, CalendarClock, Landmark, TrendingUp } from "lucide-react"
import { CartesianGrid, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { TrendText, generateMockVariation } from "@/components/ui/trend-text"

type AnualSemanaFila = {
  semana: number
  valores: Record<string, number>
  totalGeneral: number
}

type RecaudacionSemanalResponse = {
  anios: number[]
  filasSemanales: AnualSemanaFila[]
  totalGeneral: number
}

type PivotWeekRow = {
  weekLabel: string
  weekNumber: number
  totalGeneral: number
  [key: string]: string | number
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/recaudacion/anual"
const CACHE_PREFIX = "recaudacion-semanal-exp-v1:"
const CACHE_EXPIRY_MS = 30 * 60 * 1000
const DEFAULT_TIMEOUT_MS = "60000"

const amountFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("es-EC")

const peajeOptions = [
  { value: "all", label: "(Todos)" },
  { value: "CONGOMA", label: "CONGOMA" },
  { value: "LOS ANGELES", label: "LOS ANGELES" },
]

const tipoMontoOptions = [
  { value: "totalDepositado", label: "TOTAL RECAUDADO" },
  { value: "efectivo", label: "RECAUDA_EFECTIVO" },
  { value: "recargasTag", label: "RECARGAS_RFID" },
]

function getCachedItem<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { timestamp: number; data: T }
    if (Date.now() - parsed.timestamp > CACHE_EXPIRY_MS) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${key}`)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function setCachedItem<T>(key: string, data: T) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ timestamp: Date.now(), data }))
  } catch {
    // Ignorar errores de cache
  }
}

function formatAmount(value: number) {
  return amountFormatter.format(value ?? 0)
}

function formatCompactNumber(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0
  const abs = Math.abs(safeValue)

  if (abs >= 1_000_000) {
    const formatted = (safeValue / 1_000_000).toFixed(1).replace(/\.0$/, "")
    return `${formatted}M`
  }

  if (abs >= 1_000) {
    const formatted = (safeValue / 1_000).toFixed(1).replace(/\.0$/, "")
    return `${formatted}k`
  }

  return numberFormatter.format(safeValue)
}

export function RecaudacionSemanalExperimental() {
  const now = React.useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentISOWeek = React.useMemo(() => getISOWeek(now), [now])

  const [anio, setAnio] = React.useState(String(currentYear))
  const [nombrePeaje, setNombrePeaje] = React.useState("all")
  const [tipoMonto, setTipoMonto] = React.useState("totalDepositado")

  const [anios, setAnios] = React.useState<number[]>([])
  const [weeklyRowsRaw, setWeeklyRowsRaw] = React.useState<AnualSemanaFila[]>([])
  const [totalGeneral, setTotalGeneral] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const yearOptions = React.useMemo(() => {
    const start = 2021
    const totalYears = Math.max(currentYear - start + 1, 1)
    return [
      { value: "all", label: "(Todos)" },
      ...Array.from({ length: totalYears }, (_, idx) => {
        const year = start + idx
        return { value: String(year), label: String(year) }
      }),
    ]
  }, [currentYear])

  React.useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const fetchForYear = async (yearStr: string) => {
          const params = new URLSearchParams()
          params.append("timeoutMs", DEFAULT_TIMEOUT_MS)
          params.append("tipoMonto", tipoMonto)
          if (yearStr !== "all") params.append("anio", yearStr)
          if (nombrePeaje !== "all") params.append("nombrePeaje", nombrePeaje)
          
          const queryString = params.toString()
          const cacheKey = `semanal:${queryString}`
          const cachedPayload = getCachedItem<RecaudacionSemanalResponse>(cacheKey)
          if (cachedPayload) return cachedPayload
          
          const response = await apiFetch(`${BASE_URL}${ENDPOINT}?${queryString}`)
          if (!response.ok) throw new Error(`Error ${response.status}`)
          const json = (await response.json()) as RecaudacionSemanalResponse
          setCachedItem(cacheKey, json)
          return json
        }

        let payload = await fetchForYear(anio)

        if (anio !== "all") {
          // Fetch previous year to enable comparisons
          const prevYear = String(Number(anio) - 1)
          const prevPayload = await fetchForYear(prevYear)
          
          // Merge payloads
          const mergedAnios = Array.from(new Set([...(prevPayload.anios || []), ...(payload.anios || [])])).sort((a,b)=>a-b)
          const mergedFilasMap = new Map<number, AnualSemanaFila>()
          
          ;[...(prevPayload.filasSemanales || []), ...(payload.filasSemanales || [])].forEach((f) => {
            const existing = mergedFilasMap.get(f.semana)
            if (existing) {
              mergedFilasMap.set(f.semana, {
                ...existing,
                valores: { ...existing.valores, ...f.valores },
                totalGeneral: existing.totalGeneral + f.totalGeneral
              })
            } else {
              mergedFilasMap.set(f.semana, { ...f })
            }
          })
          
          payload = {
            ...payload,
            anios: mergedAnios,
            filasSemanales: Array.from(mergedFilasMap.values()),
            totalGeneral: payload.totalGeneral // mantenemos totalGeneral del año base seleccionado
          }
        }

        if (!isMounted) return

        setAnios(payload.anios ?? [])
        setWeeklyRowsRaw(payload.filasSemanales ?? [])
        setTotalGeneral(payload.totalGeneral ?? 0)
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : "Error inesperado")
        setAnios([])
        setWeeklyRowsRaw([])
        setTotalGeneral(0)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [anio, nombrePeaje, tipoMonto])

  const weeklyRows = React.useMemo<PivotWeekRow[]>(() => {
    return [...weeklyRowsRaw]
      .sort((a, b) => a.semana - b.semana)
      .map((fila) => {
        const row: PivotWeekRow = {
          weekLabel: `Semana ${fila.semana}`,
          weekNumber: fila.semana,
          totalGeneral: fila.totalGeneral,
        }

        anios.forEach((yearValue) => {
          row[`y${yearValue}`] = fila.valores?.[String(yearValue)] ?? 0
        })

        return row
      })
  }, [weeklyRowsRaw, anios])

  const selectedYear = anio === "all" ? null : Number(anio)

  const visibleWeeklyRows = React.useMemo(() => {
    if (selectedYear === currentYear) {
      return weeklyRows.filter((row) => row.weekNumber <= currentISOWeek)
    }
    return weeklyRows
  }, [weeklyRows, selectedYear, currentYear, currentISOWeek])

  const chartWeeklyRows = React.useMemo(() => {
    if (selectedYear === currentYear) {
      return visibleWeeklyRows.filter((row) => row.weekNumber < currentISOWeek)
    }
    return visibleWeeklyRows
  }, [visibleWeeklyRows, selectedYear, currentYear, currentISOWeek])

  const getDisplayValue = React.useCallback(
    (row: PivotWeekRow, yearValue: number) => {
      const isFutureWeekInCurrentYear = yearValue === currentYear && row.weekNumber > currentISOWeek
      if (isFutureWeekInCurrentYear) return null
      return Number(row[`y${yearValue}`] ?? 0)
    },
    [currentYear, currentISOWeek]
  )

  const metricTitle = tipoMontoOptions.find((item) => item.value === tipoMonto)?.label ?? "TOTAL RECAUDADO"

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    anios.forEach((yearValue, idx) => {
      config[`y${yearValue}`] = {
        label: String(yearValue),
        color: `var(--chart-${(idx % 5) + 1})`,
      }
    })
    return config
  }, [anios])

  const avgWeekly = visibleWeeklyRows.length
    ? visibleWeeklyRows.reduce((acc, row) => acc + Number(row.totalGeneral), 0) / visibleWeeklyRows.length
    : 0

  const avgWeeklyChart = chartWeeklyRows.length
    ? chartWeeklyRows.reduce((acc, row) => acc + Number(row.totalGeneral), 0) / chartWeeklyRows.length
    : 0

  const kpis = React.useMemo(() => {
    const topWeek = visibleWeeklyRows.reduce(
      (acc, row) => (Number(row.totalGeneral) > Number(acc.totalGeneral) ? row : acc),
      { weekLabel: "-", totalGeneral: 0 } as Pick<PivotWeekRow, "weekLabel" | "totalGeneral">
    )

    let variationTotal = 0
    let variationAvgWeekly = 0
    let variationTopWeek = 0
    let showVariation = false

    if (anios.length > 1) {
      const sortedYears = [...anios].sort((a, b) => b - a)
      const latestYear = sortedYears[0]
      const prevYear = sortedYears[1]

      const latestYearTotal = visibleWeeklyRows.reduce((sum, row) => sum + Number(row[`y${latestYear}`] ?? 0), 0)
      const prevYearTotal = visibleWeeklyRows.reduce((sum, row) => sum + Number(row[`y${prevYear}`] ?? 0), 0)
      showVariation = prevYearTotal > 0

      variationTotal = prevYearTotal > 0 ? ((latestYearTotal - prevYearTotal) / prevYearTotal) * 100 : 0
      
      const latestWeeksWithData = visibleWeeklyRows.filter(r => (r[`y${latestYear}`] ?? 0) > 0).length || 1
      const prevWeeksWithData = visibleWeeklyRows.filter(r => (r[`y${prevYear}`] ?? 0) > 0).length || 1
      
      const latestAvg = latestYearTotal / latestWeeksWithData
      const prevAvg = prevYearTotal / prevWeeksWithData
      variationAvgWeekly = prevAvg > 0 ? ((latestAvg - prevAvg) / prevAvg) * 100 : 0

      const maxLatestWeek = visibleWeeklyRows.reduce((max, r) => Math.max(max, Number(r[`y${latestYear}`] ?? 0)), 0)
      const maxPrevWeek = visibleWeeklyRows.reduce((max, r) => Math.max(max, Number(r[`y${prevYear}`] ?? 0)), 0)
      variationTopWeek = maxPrevWeek > 0 ? ((maxLatestWeek - maxPrevWeek) / maxPrevWeek) * 100 : 0
    }

    return {
      totalGeneral,
      avgWeekly,
      topWeekLabel: topWeek.weekLabel,
      topWeekValue: Number(topWeek.totalGeneral),
      showVariation,
      variationTotal,
      variationAvgWeekly,
      variationTopWeek,
      isAll: anio === "all"
    }
  }, [visibleWeeklyRows, totalGeneral, avgWeekly, anios, anio])

  const highlightedIndexesByKey = React.useMemo(() => {
    const map: Record<string, Set<number>> = {}

    anios.forEach((yearValue) => {
      const key = `y${yearValue}`
      const set = new Set<number>()
      if (visibleWeeklyRows.length === 0) {
        map[key] = set
        return
      }

      set.add(visibleWeeklyRows.length - 1)
      let maxIndex = 0
      let minIndex = 0

      visibleWeeklyRows.forEach((row, index) => {
        const current = Number(row[key] ?? 0)
        const maxValue = Number(visibleWeeklyRows[maxIndex][key] ?? 0)
        const minValue = Number(visibleWeeklyRows[minIndex][key] ?? 0)
        if (current > maxValue) maxIndex = index
        if (current < minValue) minIndex = index
      })

      set.add(maxIndex)
      set.add(minIndex)
      map[key] = set
    })

    return map
  }, [visibleWeeklyRows, anios])

  const renderSparseLabel = React.useCallback(
    (props: any, seriesKey: string) => {
      const { index, value, x, y, stroke } = props
      const xPos = typeof x === "number" ? x : Number(x)
      const yPos = typeof y === "number" ? y : Number(y)

      if (typeof index !== "number" || Number.isNaN(xPos) || Number.isNaN(yPos)) return null
      if (anio === "all") return null
      if (!highlightedIndexesByKey[seriesKey]?.has(index)) return null

      return (
        <text
          x={xPos}
          y={yPos - 10}
          textAnchor="middle"
          fill={typeof stroke === "string" ? stroke : "currentColor"}
          className="text-[11px] font-semibold"
          stroke="hsl(var(--background))"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {formatCompactNumber(Number(value))}
        </text>
      )
    },
    [highlightedIndexesByKey, anio]
  )

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.07 } },
  }

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={cardVariants}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Reporte semanal de recaudacion</h2>
            <p className="text-sm text-muted-foreground">Comparativo por semanas acumuladas del periodo seleccionado</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Metrica: {metricTitle}
          </span>
        </div>
      </motion.div>

      <motion.div variants={cardVariants}>
        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-md">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Año</label>
                <Select value={anio} onValueChange={setAnio} disabled={loading}>
                  <SelectTrigger className="h-9 w-[150px] bg-background/60 text-xs transition-colors hover:bg-background/80">
                    <SelectValue placeholder="(Todos)" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peaje</label>
                <Select value={nombrePeaje} onValueChange={setNombrePeaje} disabled={loading}>
                  <SelectTrigger className="h-9 w-[180px] bg-background/60 text-xs transition-colors hover:bg-background/80">
                    <SelectValue placeholder="(Todos)" />
                  </SelectTrigger>
                  <SelectContent>
                    {peajeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo monto</label>
                <Select value={tipoMonto} onValueChange={setTipoMonto} disabled={loading}>
                  <SelectTrigger className="h-9 w-[190px] bg-background/60 text-xs transition-colors hover:bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoMontoOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-border/60 transition-colors hover:bg-accent hover:text-accent-foreground"
                disabled={loading}
                onClick={() => {
                  setAnio(String(currentYear))
                  setNombrePeaje("all")
                  setTipoMonto("totalDepositado")
                }}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-primary/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total semanal</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex min-h-[36px] items-center text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : `$ ${formatAmount(kpis.totalGeneral)}`}
                </div>                  {!loading && kpis.showVariation && (
                    <TrendText variation={kpis.variationTotal} baselineText={kpis.isAll ? "el total histórico" : "el año anterior"} />
                  )}              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-emerald-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Promedio por semana</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
                  <Landmark className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex min-h-[36px] items-center text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : `$ ${formatAmount(kpis.avgWeekly)}`}
                </div>                  {!loading && kpis.showVariation && (
                    <TrendText variation={kpis.variationAvgWeekly} baselineText={kpis.isAll ? "el promedio histórico" : "el año anterior"} />
                  )}              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-amber-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Semana pico</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/25">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardHeader>
                <CardContent className="flex flex-col justify-center min-h-[36px] items-start gap-1">
                  <div className="flex w-full items-center justify-between">
                    <div className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                      {loading ? <Skeleton className="h-8 w-24" /> : kpis.topWeekLabel}
                    </div>
                    {!loading && kpis.topWeekValue > 0 && (
                      <span className="text-xl font-semibold text-amber-600 dark:text-amber-300">
                        $ {formatAmount(kpis.topWeekValue)}
                      </span>
                    )}
                  </div>
                  {!loading && kpis.showVariation && kpis.topWeekValue > 0 && (
                    <TrendText variation={kpis.variationTopWeek} baselineText={kpis.isAll ? "el pico histórico" : "el mejor pico pasado"} className="mt-0" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/60 bg-card/80 shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.45)]">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Grafico semanal por anio</CardTitle>
            <CardDescription>Comparativo de recaudacion semanal</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loading && (
              <div className="flex h-[460px] w-full flex-col items-center justify-center gap-4">
                <Skeleton className="h-[380px] w-full rounded-xl" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            )}
            {error && !loading && (
              <div className="flex h-[460px] flex-col items-center justify-center text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {!loading && !error && chartWeeklyRows.length === 0 && (
              <div className="flex h-[460px] flex-col items-center justify-center text-center text-muted-foreground">
                <BarChart3 className="mb-4 h-12 w-12 opacity-20" />
                <p>No hay datos de recaudación semanal para graficar.</p>
              </div>
            )}
            {!loading && !error && chartWeeklyRows.length > 0 && (
              <ChartContainer config={chartConfig} className="h-[460px] w-full">
                <LineChart
                  data={chartWeeklyRows}
                  margin={{
                    top: 30,
                    right: 16,
                    left: 16,
                    bottom: 24,
                  }}
                >
                  <CartesianGrid vertical={true} />
                  <XAxis
                    dataKey="weekLabel"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={28}
                    tickMargin={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCompactNumber(Number(value))}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-mono font-medium tabular-nums">$ {formatAmount(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ReferenceLine
                    y={avgWeeklyChart}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                    label={{
                      value: "Promedio semanal",
                      position: "insideTopRight",
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  {anios.map((yearValue) => {
                    const key = `y${yearValue}`
                    return (
                      <Line
                        key={key}
                        dataKey={key}
                        type="monotone"
                        stroke={`var(--color-${key})`}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name={String(yearValue)}
                        isAnimationActive
                      >
                        <LabelList dataKey={key} content={(props) => renderSparseLabel(props, key)} />
                      </Line>
                    )
                  })}
                  <ChartLegend content={<ChartLegendContent className="-mt-1 pb-2" />} verticalAlign="top" />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/60 bg-card/80 shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.45)]">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Detalle semanal</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && (
              <div className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            )}
            {error && !loading && (
              <div className="flex p-12 flex-col items-center justify-center text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {!loading && !error && visibleWeeklyRows.length === 0 && (
              <div className="flex p-12 flex-col items-center justify-center text-center text-muted-foreground">
                <p>No se encontraron registros para generar el detalle semanal.</p>
              </div>
            )}
            {!loading && !error && visibleWeeklyRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-background/95 backdrop-blur dark:border-border/60">
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Semana</th>
                      {anios.map((yearValue) => (
                        <th
                          key={yearValue}
                          className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {yearValue}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total recaudado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWeeklyRows.map((row, index) => (
                      <tr
                        key={row.weekNumber}
                        className={`border-b border-slate-200/80 transition-colors hover:bg-slate-50 dark:border-border/40 dark:hover:bg-white/5 ${index % 2 === 0 ? "bg-card/40" : "bg-muted/20"}`}
                      >
                        <td className="px-3 py-2 text-sm text-foreground">
                          <span className="inline-flex rounded-md border border-border/50 bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground/90">
                            {row.weekLabel}
                          </span>
                        </td>
                        {anios.map((yearValue) => {
                          const displayValue = getDisplayValue(row, yearValue)
                          return (
                            <td key={`${row.weekNumber}-${yearValue}`} className="px-3 py-1.5 text-right text-sm tabular-nums text-foreground/80">
                              {displayValue === null ? (
                                <span className="text-muted-foreground/60">-</span>
                              ) : (
                                `$ ${formatAmount(displayValue)}`
                              )}
                            </td>
                          )
                        })}
                        <td className="px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-foreground">
                          <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-400/25 bg-emerald-100 dark:bg-emerald-500/12 px-2 py-0.5 text-emerald-900 dark:text-emerald-300">
                            $ {formatAmount(Number(row.totalGeneral ?? 0))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-muted/40 text-foreground dark:border-border">
                      <th className="px-3 py-2 text-left text-sm font-semibold">Total general</th>
                      {anios.map((yearValue) => {
                        const totalByYear = visibleWeeklyRows.reduce((acc, row) => {
                          const displayValue = getDisplayValue(row, yearValue)
                          return acc + (displayValue ?? 0)
                        }, 0)
                        return (
                          <th key={`total-${yearValue}`} className="px-3 py-2 text-right text-sm font-semibold tabular-nums">
                            $ {formatAmount(totalByYear)}
                          </th>
                        )
                      })}
                      <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">
                        <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-400/25 bg-emerald-100 dark:bg-emerald-500/12 px-2 py-0.5 text-emerald-900 dark:text-emerald-300">
                          $ {formatAmount(visibleWeeklyRows.reduce((acc, row) => acc + Number(row.totalGeneral ?? 0), 0))}
                        </span>
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
