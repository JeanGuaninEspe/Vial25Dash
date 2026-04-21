import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { Activity, BarChart3, RefreshCw, TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { TrendText, generateMockVariation } from "@/components/ui/trend-text"

type AnualFila = {
  mesNumero: number
  mes: string
  valores: Record<string, number>
  totalGeneral: number
}

type TotalPorAnio = {
  anio: number
  total: number
}

type TransitoAnualResponse = {
  anios: number[]
  filas: AnualFila[]
  totalPorAnio: TotalPorAnio[]
  totalGeneral: number
}

type PivotMonthRow = {
  monthLabel: string
  monthNumber: number
  totalGeneral: number
  [key: string]: string | number
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/r-estadistico/anual"
const CACHE_PREFIX = "transito-anual-exp-cache-v1:"
const CACHE_EXPIRY_MS = 30 * 60 * 1000

const numberFormatter = new Intl.NumberFormat("es-EC")

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
    sessionStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    )
  } catch {
    // Ignorar errores de caché
  }
}

const peajeOptions = [
  { value: "1", label: "Congoma" },
  { value: "2", label: "Los Angeles" },
]

const formaPagoOptions = [
  { value: "all", label: "(Todas)" },
  { value: "EFECTIVO", label: "EFECTIVO" },
  { value: "RFID", label: "RFID" },
  { value: "EXENTO", label: "EXENTO" },
  { value: "VIOLACION", label: "VIOLACION" },
]

const porcDescOptions = [
  { value: "all", label: "(Todas)" },
  { value: "0", label: "0%" },
  { value: "50", label: "50%" },
  { value: "100", label: "100%" },
]

const categoriaOptions = [
  { value: "all", label: "(Todas)" },
  ...Array.from({ length: 9 }, (_, idx) => ({ value: String(idx + 1), label: String(idx + 1) })),
]

async function fetchTransitoAnual(params: URLSearchParams): Promise<TransitoAnualResponse> {
  const response = await apiFetch(`${BASE_URL}${ENDPOINT}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Error ${response.status}`)
  }

  return (await response.json()) as TransitoAnualResponse
}

export function TransitoAniosMesesExperimental() {
  const [idPeaje, setIdPeaje] = React.useState("2")
  const [formaPago, setFormaPago] = React.useState("all")
  const [porcDesc, setPorcDesc] = React.useState("all")
  const [idCategoria, setIdCategoria] = React.useState("all")

  const [anios, setAnios] = React.useState<number[]>([])
  const [filas, setFilas] = React.useState<AnualFila[]>([])
  const [totalesPorAnio, setTotalesPorAnio] = React.useState<Record<number, number>>({})
  const [totalGeneral, setTotalGeneral] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.append("idPeaje", idPeaje)

        if (formaPago !== "all") {
          params.append("formaPago", formaPago)
        }

        if (porcDesc !== "all") {
          params.append("porcDesc", porcDesc)
        }

        if (idCategoria !== "all") {
          params.append("idCategoria", idCategoria)
        }

        const queryString = params.toString()
        const cacheKey = `anual:${queryString}`
        const cachedPayload = getCachedItem<TransitoAnualResponse>(cacheKey)
        const payload = cachedPayload ?? (await fetchTransitoAnual(params))

        if (!cachedPayload) {
          setCachedItem(cacheKey, payload)
        }

        if (isMounted) {
          setAnios(payload.anios ?? [])
          setFilas(payload.filas ?? [])
          setTotalGeneral(payload.totalGeneral ?? 0)

          const totalsMap = (payload.totalPorAnio ?? []).reduce<Record<number, number>>((acc, row) => {
            acc[row.anio] = row.total
            return acc
          }, {})
          setTotalesPorAnio(totalsMap)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error inesperado")
          setAnios([])
          setFilas([])
          setTotalesPorAnio({})
          setTotalGeneral(0)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [idPeaje, formaPago, porcDesc, idCategoria])

  const pivotRows = React.useMemo<PivotMonthRow[]>(() => {
    return [...filas]
      .sort((a, b) => a.mesNumero - b.mesNumero)
      .map((fila) => {
        const row: PivotMonthRow = {
          monthLabel: fila.mes,
          monthNumber: fila.mesNumero,
          totalGeneral: fila.totalGeneral,
        }

        anios.forEach((anio) => {
          row[`y${anio}`] = fila.valores?.[String(anio)] ?? 0
        })

        return row
      })
  }, [filas, anios])

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {}
    anios.forEach((anio, idx) => {
      config[`y${anio}`] = {
        label: String(anio),
        color: `var(--chart-${(idx % 5) + 1})`,
      }
    })
    return config
  }, [anios])

  const reportTitle = idPeaje === "1" ? "PEAJE CONGOMA" : "PEAJE LOS ANGELES"

  const kpi = React.useMemo(() => {
    const total = totalGeneral
    const avgYear = anios.length ? total / anios.length : 0

    const sortedAnios = [...anios].sort((a, b) => b - a)
    const latestYear = sortedAnios[0]
    const prevYear = sortedAnios[1]

    const latestYearTotal = latestYear ? totalesPorAnio[latestYear] ?? 0 : 0
    const prevYearTotal = prevYear ? totalesPorAnio[prevYear] ?? 0 : 0

    const variationLatestYear = prevYearTotal > 0 ? ((latestYearTotal - prevYearTotal) / prevYearTotal) * 100 : 0

    const maxYearEntry = Object.entries(totalesPorAnio).reduce(
      (acc, [year, value]) => (value > acc.value ? { year, value } : acc),
      { year: "-", value: 0 }
    )

    const variationMaxVsAvg = avgYear > 0 ? ((maxYearEntry.value - avgYear) / avgYear) * 100 : 0

    // Variacion de nuestro ultimo ano vs el promedio general
    const variationLatestVsAvg = avgYear > 0 ? ((latestYearTotal - avgYear) / avgYear) * 100 : 0

    return {
      total,
      latestYearTotal,
      latestYearTitle: latestYear ? `Total año ${latestYear}` : "Total general",
      variationLatestYear,
      hasPrevYearData: prevYearTotal > 0,
      
      avgYear,
      variationLatestVsAvg,
      
      maxYear: maxYearEntry.year,
      maxYearTotal: maxYearEntry.value,
      variationMaxVsAvg,
    }
  }, [anios, totalGeneral, totalesPorAnio])

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.08 },
    },
  }

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  }

  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 6 },
    show: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.015,
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    }),
  }

  return (
    <motion.div className="space-y-8 p-6" variants={containerVariants} initial="hidden" animate="show">
      {/* Header Section */}
      <motion.div variants={cardVariants}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Tránsito por años y meses</h2>
              <p className="text-sm text-muted-foreground">
                Resumen anual por mes y comparativo entre años
              </p>
            </div>
            <span className="inline-flex items-center gap-2.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary ring-1 ring-inset ring-primary/20">
              <BarChart3 className="h-4 w-4" />
              {reportTitle}
            </span>
          </div>

          {/* Filters Section */}
          <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border/50 bg-muted/30 p-4 backdrop-blur-sm">
            <motion.div className="space-y-2" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
              <p className="ml-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Peaje</p>
              <Select value={idPeaje} onValueChange={setIdPeaje}>
                <SelectTrigger className="h-10 w-[150px] rounded-xl bg-background/80 text-sm font-medium shadow-sm transition-all hover:bg-background hover:shadow-md focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Peaje" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {peajeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            <motion.div className="space-y-2" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
              <p className="ml-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Forma de pago</p>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger className="h-10 w-[150px] rounded-xl bg-background/80 text-sm font-medium shadow-sm transition-all hover:bg-background hover:shadow-md focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Forma de pago" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {formaPagoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            <motion.div className="space-y-2" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
              <p className="ml-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Porc. desc</p>
              <Select value={porcDesc} onValueChange={setPorcDesc}>
                <SelectTrigger className="h-10 w-[130px] rounded-xl bg-background/80 text-sm font-medium shadow-sm transition-all hover:bg-background hover:shadow-md focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Porcentaje" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {porcDescOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            <motion.div className="space-y-2" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
              <p className="ml-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Categoria</p>
              <Select value={idCategoria} onValueChange={setIdCategoria}>
                <SelectTrigger className="h-10 w-[130px] rounded-xl bg-background/80 text-sm font-medium shadow-sm transition-all hover:bg-background hover:shadow-md focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {categoriaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-all hover:bg-background hover:text-foreground hover:shadow-md"
                onClick={() => {
                  setIdPeaje("2")
                  setFormaPago("all")
                  setPorcDesc("all")
                  setIdCategoria("all")
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Restablecer
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={cardVariants}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Card 1: Total ultimo ano */}
          <motion.div className="h-full" whileHover={{ y: -4, scale: 1.01 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <Card className="relative flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/10">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.latestYearTitle}</CardTitle>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 shadow-sm dark:text-blue-400">
                  <TrendingUp className="h-5 w-5" />
                </span>
              </CardHeader>
              <CardContent className="relative flex flex-grow flex-col gap-2">
                <div className="text-3xl font-bold tracking-tight text-foreground">
                  {loading ? <Skeleton className="h-9 w-36 rounded-lg" /> : numberFormatter.format(kpi.latestYearTotal)}
                </div>
                {!loading && kpi.hasPrevYearData && (
                  <TrendText variation={kpi.variationLatestYear} baselineText="el año anterior" />
                )}
                {!loading && !kpi.hasPrevYearData && (
                  <span className="text-xs text-muted-foreground/80">Sin datos del año anterior</span>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 2: Promedio anual */}
          <motion.div className="h-full" whileHover={{ y: -4, scale: 1.01 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <Card className="relative flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/10">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Promedio anual general</CardTitle>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 shadow-sm dark:text-emerald-400">
                  <Activity className="h-5 w-5" />
                </span>
              </CardHeader>
              <CardContent className="relative flex flex-grow flex-col gap-2">
                <div className="text-3xl font-bold tracking-tight text-foreground">
                  {loading ? <Skeleton className="h-9 w-36 rounded-lg" /> : numberFormatter.format(Math.round(kpi.avgYear))}
                </div>
                {!loading && (
                  <TrendText variation={kpi.variationLatestVsAvg} baselineText="el último año" />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 3: Mejor año */}
          <motion.div className="h-full" whileHover={{ y: -4, scale: 1.01 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <Card className="relative flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/10">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
              <CardHeader className="relative flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mejor año ({kpi.maxYear})</CardTitle>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 shadow-sm dark:text-amber-400">
                  <BarChart3 className="h-5 w-5" />
                </span>
              </CardHeader>
              <CardContent className="relative flex flex-grow flex-col gap-2">
                <div className="text-3xl font-bold tracking-tight text-foreground">
                  {loading ? <Skeleton className="h-9 w-36 rounded-lg" /> : numberFormatter.format(kpi.maxYearTotal)}
                </div>
                {!loading && (
                  <TrendText variation={kpi.variationMaxVsAvg} baselineText="el promedio general" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      {/* Chart Card */}
      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.25, ease: "easeOut" }}>
        <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-xl ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30 px-6 py-5">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <BarChart3 className="h-6 w-6" />
              </span>
              <div>
                <CardTitle className="text-lg font-semibold">Gráfico estadístico de tránsito</CardTitle>
                <CardDescription className="mt-0.5 text-sm">
                  Comparativo por años y meses
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loading && (
              <div className="p-4">
                <Skeleton className="h-[520px] w-full rounded-2xl" />
              </div>
            )}
            {!loading && !error && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <ChartContainer config={chartConfig} className="h-[520px] w-full">
                  <BarChart
                    data={pivotRows}
                    margin={{
                      top: 70,
                      right: 16,
                      left: 16,
                      bottom: 72,
                    }}
                  >
                    <CartesianGrid vertical={true} strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="monthLabel"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                      tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex w-full justify-between gap-4">
                              <span className="text-muted-foreground">{name}</span>
                              <span className="font-mono font-semibold tabular-nums">
                                {numberFormatter.format(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    {anios.map((anio, index) => (
                      <Bar
                        key={anio}
                        dataKey={`y${anio}`}
                        name={String(anio)}
                        fill={`var(--color-y${anio})`}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      >
                        <LabelList
                          dataKey={`y${anio}`}
                          position="top"
                          angle={-90}
                          offset={8 + (index % 3) * 8}
                          formatter={(value: number) => numberFormatter.format(value)}
                          className="fill-foreground text-[9px] font-semibold"
                        />
                      </Bar>
                    ))}
                    <ChartLegend content={<ChartLegendContent className="-mt-2 pb-3" />} verticalAlign="top" />
                  </BarChart>
                </ChartContainer>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Table Card */}
      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.25, ease: "easeOut" }}>
        <Card className="overflow-hidden rounded-2xl border-0 bg-card shadow-xl ring-1 ring-border/50">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30 px-6 py-5">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <Activity className="h-6 w-6" />
              </span>
              <div>
                <CardTitle className="text-lg font-semibold">Detalle mensual</CardTitle>
                <CardDescription className="mt-0.5 text-sm">
                  {pivotRows.length} meses disponibles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && (
              <div className="divide-y divide-border/30">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between px-6 py-4">
                    <Skeleton className="h-6 w-28 rounded-lg" />
                    <Skeleton className="h-6 w-20 rounded-lg" />
                    <Skeleton className="h-6 w-20 rounded-lg" />
                    <Skeleton className="h-6 w-24 rounded-lg" />
                  </div>
                ))}
              </div>
            )}
            {error && !loading && (
              <div className="px-6 py-8 text-center">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}
            {!loading && !error && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/50">
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Mes
                      </th>
                      {anios.map((anio, idx) => (
                        <th key={anio} className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          <div className="flex items-center justify-end gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `var(--chart-${(idx % 5) + 1})` }} />
                            {anio}
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <div className="flex items-center justify-end gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          Total general
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotRows.map((row, index) => (
                      <motion.tr
                        key={`${row.monthNumber}-${row.monthLabel}`}
                        variants={rowVariants}
                        custom={index}
                        initial="hidden"
                        animate="show"
                        className={cn(
                          "border-b border-border/30 transition-colors last:border-0",
                          index % 2 === 0 ? "bg-transparent" : "bg-muted/20",
                          "hover:bg-primary/5"
                        )}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          {row.monthLabel}
                        </td>
                        {anios.map((anio) => (
                          <td key={`${row.monthLabel}-${anio}`} className="px-6 py-4 text-right font-mono text-sm tabular-nums text-muted-foreground">
                            {numberFormatter.format(Number(row[`y${anio}`] ?? 0))}
                          </td>
                        ))}
                        <td className="px-6 py-4 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                          {numberFormatter.format(Number(row.totalGeneral ?? 0))}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border/50 bg-muted/40">
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-foreground">
                        Total general
                      </th>
                      {anios.map((anio) => (
                        <th key={`total-${anio}`} className="px-6 py-4 text-right font-mono text-sm font-bold tabular-nums text-muted-foreground">
                          {numberFormatter.format(totalesPorAnio[anio] ?? 0)}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-right font-mono text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {numberFormatter.format(totalGeneral)}
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