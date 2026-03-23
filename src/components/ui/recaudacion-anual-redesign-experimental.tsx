import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { ArrowDown, ArrowUp, BarChart3, CalendarClock, Landmark, Minus, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

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

type AnualMesFila = {
  mesNumero: number
  mes: string
  valores: Record<string, number>
  totalGeneral: number
}

type TotalPorAnio = {
  anio: number
  total: number
}

type RecaudacionAnualResponse = {
  anios: number[]
  filas: AnualMesFila[]
  totalPorAnio: TotalPorAnio[]
  totalGeneral: number
}

type PivotMonthRow = {
  monthLabel: string
  monthNumber: number
  totalGeneral: number
  [key: string]: string | number | null
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/recaudacion/anual"
const CACHE_PREFIX = "recaudacion-anual-redesign-exp-v1:"
const CACHE_EXPIRY_MS = 30 * 60 * 1000
const DEFAULT_TIMEOUT_MS = "60000"

const amountFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("es-EC")
const usdTooltipFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

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

export function RecaudacionAnualRedesignExperimental() {
  const now = React.useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const [anio, setAnio] = React.useState("all")
  const [nombrePeaje, setNombrePeaje] = React.useState("all")
  const [tipoMonto, setTipoMonto] = React.useState("totalDepositado")

  const [anios, setAnios] = React.useState<number[]>([])
  const [filasMensuales, setFilasMensuales] = React.useState<AnualMesFila[]>([])
  const [totalesPorAnio, setTotalesPorAnio] = React.useState<Record<number, number>>({})
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
          const cacheKey = `anual:${queryString}`
          const cachedPayload = getCachedItem<RecaudacionAnualResponse>(cacheKey)
          if (cachedPayload) return cachedPayload
          
          const response = await apiFetch(`${BASE_URL}${ENDPOINT}?${queryString}`)
          if (!response.ok) throw new Error(`Error ${response.status}`)
          const json = (await response.json()) as RecaudacionAnualResponse
          setCachedItem(cacheKey, json)
          return json
        }

        let payload = await fetchForYear(anio)

        if (anio !== "all") {
          // Fetch previous year for comparisons if specific year selected
          const prevYear = String(Number(anio) - 1)
          const prevPayload = await fetchForYear(prevYear)
          
          // Merge payloads
          const mergedAnios = Array.from(new Set([...(prevPayload.anios || []), ...(payload.anios || [])])).sort((a,b)=>a-b)
          const mergedFilasMap = new Map<number, AnualMesFila>()
          
          ;[...(prevPayload.filas || []), ...(payload.filas || [])].forEach((f) => {
            const existing = mergedFilasMap.get(f.mesNumero)
            if (existing) {
              mergedFilasMap.set(f.mesNumero, {
                ...existing,
                valores: { ...existing.valores, ...f.valores },
                totalGeneral: existing.totalGeneral + f.totalGeneral
              })
            } else {
              mergedFilasMap.set(f.mesNumero, { ...f })
            }
          })
          
          payload = {
            ...payload,
            anios: mergedAnios,
            filas: Array.from(mergedFilasMap.values()),
            totalPorAnio: [...(prevPayload.totalPorAnio || []), ...(payload.totalPorAnio || [])]
          }
        }

        if (!isMounted) return

        setAnios(payload.anios ?? [])
        setFilasMensuales(payload.filas ?? [])
        setTotalGeneral(payload.totalGeneral ?? 0)

        const totalsMap = (payload.totalPorAnio ?? []).reduce<Record<number, number>>((acc, row) => {
          acc[row.anio] = row.total
          return acc
        }, {})
        setTotalesPorAnio(totalsMap)
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : "Error inesperado")
        setAnios([])
        setFilasMensuales([])
        setTotalesPorAnio({})
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

  const pivotRows = React.useMemo<PivotMonthRow[]>(() => {
    return [...filasMensuales]
      .sort((a, b) => a.mesNumero - b.mesNumero)
      .map((fila) => {
        const row: PivotMonthRow = {
          monthLabel: fila.mes,
          monthNumber: fila.mesNumero,
          totalGeneral: fila.totalGeneral,
        }

        anios.forEach((yearValue) => {
          const hasValue = Object.prototype.hasOwnProperty.call(fila.valores ?? {}, String(yearValue))
          row[`y${yearValue}`] = hasValue ? (fila.valores?.[String(yearValue)] ?? 0) : null
        })

        return row
      })
  }, [filasMensuales, anios])

  const selectedYear = anio === "all" ? null : Number(anio)

  const visiblePivotRows = React.useMemo(() => {
    const shouldTrimFutureMonths =
      selectedYear === currentYear || (selectedYear === null && anios.includes(currentYear))

    if (!shouldTrimFutureMonths) return pivotRows

    return pivotRows.filter((row) => row.monthNumber <= currentMonth)
  }, [pivotRows, selectedYear, currentYear, currentMonth, anios])

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

  const kpis = React.useMemo(() => {
    const selectedYearTotal = anio === "all" 
      ? visiblePivotRows.reduce((sum, row) => sum + Number(row.totalGeneral ?? 0), 0)
      : visiblePivotRows.reduce((sum, row) => sum + Number(row[`y${Number(anio)}`] ?? 0), 0)

    const visibleTotal = selectedYearTotal
    
    let avgMonthly = 0
    if (anio === "all") {
      avgMonthly = visiblePivotRows.length ? visibleTotal / visiblePivotRows.length : 0
    } else {
      const selectedAnioNum = Number(anio)
      const monthsWithData = visiblePivotRows.filter(r => Number(r[`y${selectedAnioNum}`] ?? 0) > 0).length || 1
      avgMonthly = visibleTotal / monthsWithData
    }

    const avgYearly = anios.length > 0 ? (anio === "all" ? visibleTotal / anios.length : visibleTotal) : 0
    
    const top3Months = [...visiblePivotRows]
      .sort((a, b) => Number(anio === "all" ? b.totalGeneral : b[`y${Number(anio)}`] ?? 0) - Number(anio === "all" ? a.totalGeneral : a[`y${Number(anio)}`] ?? 0))
      .slice(0, 3)
      .map(m => ({ label: m.monthLabel, value: Number(anio === "all" ? m.totalGeneral : m[`y${Number(anio)}`] ?? 0) }))

    let variationTotal = 0
    let variationAvgMonthly = 0
    let variationTopMonth = 0
    let showVariation = false

    if (anios.length > 1) { // Tenemos más de un año para comparar
      const sortedYears = [...anios].sort((a, b) => b - a)
      const latestYear = sortedYears[0]
      const prevYear = sortedYears[1]

      const latestYearTotal = visiblePivotRows.reduce((sum, row) => sum + Number(row[`y${latestYear}`] ?? 0), 0)
      const prevYearTotal = visiblePivotRows.reduce((sum, row) => sum + Number(row[`y${prevYear}`] ?? 0), 0)
      showVariation = prevYearTotal > 0

      variationTotal = prevYearTotal > 0 ? ((latestYearTotal - prevYearTotal) / prevYearTotal) * 100 : 0
      
      const latestMonthsWithData = visiblePivotRows.filter(r => (r[`y${latestYear}`] ?? 0) > 0).length || 1
      const prevMonthsWithData = visiblePivotRows.filter(r => (r[`y${prevYear}`] ?? 0) > 0).length || 1
      
      const latestAvg = latestYearTotal / latestMonthsWithData
      const prevAvg = prevYearTotal / prevMonthsWithData
      variationAvgMonthly = prevAvg > 0 ? ((latestAvg - prevAvg) / prevAvg) * 100 : 0

      const maxLatestMonth = visiblePivotRows.reduce((max, r) => Math.max(max, Number(r[`y${latestYear}`] ?? 0)), 0)
      const maxPrevMonth = visiblePivotRows.reduce((max, r) => Math.max(max, Number(r[`y${prevYear}`] ?? 0)), 0)
      variationTopMonth = maxPrevMonth > 0 ? ((maxLatestMonth - maxPrevMonth) / maxPrevMonth) * 100 : 0
    }

    return {
      totalGeneral: visibleTotal,
      avgMonthly,
      avgYearly,
      top3Months,
      showVariation,
      variationTotal,
      variationAvgMonthly,
      variationTopMonth
    }
  }, [visiblePivotRows, anios])

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
            <h2 className="text-xl font-semibold text-foreground">Recaudacion anual por meses</h2>
            <p className="text-sm text-muted-foreground">Vista consolidada anual con comparativo mensual</p>
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
                  setAnio("all")
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {anio === "all" ? "Promedio por año" : "Total del año"}
                  </CardTitle>
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </CardHeader>
              <CardContent className="flex flex-col justify-center h-[90px] gap-1 pb-4 pt-0">
                  <div className="flex min-h-[36px] items-center text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                    {loading ? <Skeleton className="h-9 w-32" /> : `$ ${formatAmount(anio === "all" ? kpis.avgYearly : kpis.totalGeneral)}`}
                    </div>
                    {!loading && kpis.showVariation && (
                      <TrendText variation={kpis.variationTotal} baselineText={anio === "all" ? "el histórico anual" : "el año anterior"} />
                    )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-emerald-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Promedio por mes</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
                  <Landmark className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-center h-[90px] gap-1 pb-4 pt-0">
                <div className="flex min-h-[36px] items-center text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : `$ ${formatAmount(kpis.avgMonthly)}`}
                </div>
                {!loading && kpis.showVariation && (
                  <TrendText variation={kpis.variationAvgMonthly} baselineText={anio === "all" ? "el promedio histórico" : "el año anterior"} className="mt-0" />
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-amber-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top 3 meses históricos</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/25">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-center h-[90px] items-start gap-1 pb-4 pt-0">
                {loading ? (
                  <Skeleton className="h-[46px] w-full" />
                ) : (
                  <div className="flex w-full flex-col space-y-1 mt-0">
                    {kpis.top3Months.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[13px]">
                        <span className="font-semibold text-muted-foreground">{idx + 1}. {m.label}</span>
                        <span className="font-bold tabular-nums text-amber-600 dark:text-amber-300">
                          $ {formatAmount(m.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/60 bg-card/80 shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.45)]">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Grafico mensual por año</CardTitle>
            <CardDescription>Barras comparativas por mes</CardDescription>
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
            {!loading && !error && visiblePivotRows.length === 0 && (
              <div className="flex h-[460px] flex-col items-center justify-center text-center text-muted-foreground">
                <BarChart3 className="mb-4 h-12 w-12 opacity-20" />
                <p>No hay datos de recaudación anual para graficar.</p>
              </div>
            )}
            {!loading && !error && visiblePivotRows.length > 0 && (
              <ChartContainer config={chartConfig} className="h-[460px] w-full">
                <BarChart
                  data={visiblePivotRows}
                  margin={{
                    top: 20,
                    right: 16,
                    left: 16,
                    bottom: 20,
                  }}
                >
                  <CartesianGrid vertical={true} />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={10} />
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
                  {anios.map((yearValue) => (
                    <Bar
                      key={yearValue}
                      dataKey={`y${yearValue}`}
                      name={String(yearValue)}
                      fill={`var(--color-y${yearValue})`}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                    >
                      <LabelList
                        dataKey={`y${yearValue}`}
                        position="top"
                        formatter={(value: number) => formatCompactNumber(value)}
                        className="fill-foreground text-[10px] font-semibold"
                      />
                    </Bar>
                  ))}
                  <ChartLegend content={<ChartLegendContent className="-mt-1 pb-2" />} verticalAlign="top" />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/60 bg-card/80 shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.45)]">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Detalle mensual anual</CardTitle>
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
            {!loading && !error && visiblePivotRows.length === 0 && (
              <div className="flex p-12 flex-col items-center justify-center text-center text-muted-foreground">
                <p>No se encontraron registros para generar el detalle anual.</p>
              </div>
            )}
            {!loading && !error && visiblePivotRows.length > 0 && (
              <div className="overflow-x-auto max-h-[560px]">
                <table className="w-full min-w-[920px] border-collapse">
                  <thead className="sticky top-0 z-20">
                    <tr className="border-b border-slate-200 bg-background/95 backdrop-blur dark:border-border/60">
                      <th className="sticky left-0 z-30 bg-background/95 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mes</th>
                      {anios.map((yearValue) => (
                        <th
                          key={yearValue}
                          className={`px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider ${
                            yearValue === currentYear ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                          }`}
                        >
                          {yearValue}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Total general</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePivotRows.map((row, index) => (
                      <motion.tr
                        key={`${row.monthNumber}-${row.monthLabel}`}
                        className={`border-b border-slate-200/80 transition-colors hover:bg-slate-50 dark:border-border/40 dark:hover:bg-white/5 ${index % 2 === 0 ? "bg-card/40" : "bg-muted/20"}`}
                        whileHover={{ scale: 1.003 }}
                        transition={{ duration: 0.12, ease: "easeOut" }}
                      >
                        <td className={`sticky left-0 z-10 px-3 py-2 text-sm ${index % 2 === 0 ? "bg-card/40" : "bg-muted/20"}`}>
                          <span className="inline-flex rounded-md border border-border/50 bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground/90">
                            {row.monthLabel}
                          </span>
                        </td>
                        {anios.map((yearValue) => {
                          const rawValue = row[`y${yearValue}`]
                          const hasValue = typeof rawValue === "number"
                          const value = hasValue ? Number(rawValue) : 0
                          const prevYearValue = Number(row[`y${yearValue - 1}`] ?? 0)
                          const isFutureMonth = yearValue === currentYear && row.monthNumber > now.getMonth() + 1
                          const isMissing = !hasValue || isFutureMonth
                          const showTrend = yearValue === currentYear && anios.includes(currentYear - 1)
                          const diffPct = prevYearValue !== 0 ? ((value - prevYearValue) / prevYearValue) * 100 : null

                          return (
                            <td key={`${row.monthLabel}-${yearValue}`} className={`px-3 py-1.5 text-right text-sm tabular-nums ${yearValue === currentYear ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-foreground/80"}`}>
                              <div title={!isMissing ? `${usdTooltipFormatter.format(value)} USD` : "Dato no disponible"}>
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {!isMissing ? <span className="tabular-nums">$ {formatAmount(value)}</span> : <span className="text-slate-400 dark:text-slate-500">—</span>}
                                  {!isMissing && showTrend && (
                                    prevYearValue < value ? (
                                      <span title={diffPct !== null ? `+${diffPct.toFixed(1)}% vs ${yearValue - 1}` : `Sin base de comparacion ${yearValue - 1}`}>
                                        <ArrowUp className="h-3 w-3 text-emerald-700 dark:text-emerald-300" />
                                      </span>
                                    ) : prevYearValue > value ? (
                                      <span title={diffPct !== null ? `${diffPct.toFixed(1)}% vs ${yearValue - 1}` : `Sin base de comparacion ${yearValue - 1}`}>
                                        <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                                      </span>
                                    ) : (
                                      <span title={`Sin variacion vs ${yearValue - 1}`}>
                                        <Minus className="h-3 w-3 text-muted-foreground" />
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            </td>
                          )
                        })}
                        <td className="bg-emerald-50 dark:bg-emerald-500/5 px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-foreground">
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-400/25 bg-emerald-100 dark:bg-emerald-500/12 px-2 py-0.5 text-emerald-900 dark:text-emerald-300 tabular-nums">
                            <span>$ {formatAmount(Number(row.totalGeneral ?? 0))}</span>
                            {index === 0 ? (
                              <Minus className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            ) : Number(row.totalGeneral ?? 0) > Number(visiblePivotRows[index - 1]?.totalGeneral ?? 0) ? (
                              <ArrowUp className="h-3 w-3 text-emerald-700 dark:text-emerald-300" />
                            ) : Number(row.totalGeneral ?? 0) < Number(visiblePivotRows[index - 1]?.totalGeneral ?? 0) ? (
                              <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                            ) : (
                              <Minus className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            )}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-muted/45 text-foreground dark:border-border">
                      <th className="px-3 py-2 text-left text-sm font-semibold">Total general</th>
                      {anios.map((yearValue) => (
                        <th key={`total-${yearValue}`} className="px-3 py-2 text-right text-sm font-semibold tabular-nums">
                          $ {formatAmount(totalesPorAnio[yearValue] ?? 0)}
                        </th>
                      ))}
                      <th className="bg-emerald-50 dark:bg-emerald-500/5 px-3 py-2 text-right text-sm font-semibold tabular-nums">
                        <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-400/30 bg-emerald-100 dark:bg-emerald-500/18 px-2 py-0.5 font-bold text-emerald-900 dark:text-emerald-200 tabular-nums">
                          $ {formatAmount(totalGeneral)}
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
