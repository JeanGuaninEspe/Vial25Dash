import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { Activity, BarChart3, TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
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

  const reportTitle = idPeaje === "1" ? "PEAJE CÓNGOMA" : "PEAJE LOS ANGELES"

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

    // Variación del mejor año respecto al promedio
    const variationMaxVsAvg = avgYear > 0 ? ((maxYearEntry.value - avgYear) / avgYear) * 100 : 0

    // Variación de nuestro último año vs el promedio general
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
        delay: index * 0.01,
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    }),
  }

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={cardVariants}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Transito por años y meses</h2>
            <p className="text-sm text-muted-foreground">
              Resumen anual por mes y comparativo entre años
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 dark:bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary dark:text-primary/90 shadow-sm">
            {reportTitle}
          </span>
        </div>
      </motion.div>

      <motion.div variants={cardVariants}>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/40 bg-card/80 dark:bg-muted/10 p-4 shadow-sm backdrop-blur-md">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Peaje</p>
            <Select value={idPeaje} onValueChange={setIdPeaje}>
              <SelectTrigger className="h-8 w-[170px] bg-background/60 text-xs">
                <SelectValue placeholder="Peaje" />
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

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Forma de pago</p>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger className="h-8 w-[170px] bg-background/60 text-xs">
                <SelectValue placeholder="Forma de pago" />
              </SelectTrigger>
              <SelectContent>
                {formaPagoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Porc. desc</p>
            <Select value={porcDesc} onValueChange={setPorcDesc}>
              <SelectTrigger className="h-8 w-[140px] bg-background/60 text-xs">
                <SelectValue placeholder="Porcentaje" />
              </SelectTrigger>
              <SelectContent>
                {porcDescOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Categoria</p>
            <Select value={idCategoria} onValueChange={setIdCategoria}>
              <SelectTrigger className="h-8 w-[140px] bg-background/60 text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriaOptions.map((option) => (
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
            className="h-8 border-border/40 hover:bg-muted/60 dark:hover:bg-muted/50"
            onClick={() => {
              setIdPeaje("2")
              setFormaPago("all")
              setPorcDesc("all")
              setIdCategoria("all")
            }}
          >
            Reset
          </Button>
        </div>
      </motion.div>

      <motion.div variants={cardVariants}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <motion.div className="h-full" whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative h-full overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-primary/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.latestYearTitle}</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : numberFormatter.format(kpi.latestYearTotal)}
                </div>                  
                {!loading && kpi.hasPrevYearData && (
                    <TrendText variation={kpi.variationLatestYear} baselineText="el año anterior" />
                )}              
              </CardContent>
            </Card>
          </motion.div>

          <motion.div className="h-full" whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative h-full overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-emerald-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">Promedio anual general</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
                  <Activity className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : numberFormatter.format(Math.round(kpi.avgYear))}
                </div>                  
                {!loading && (
                    <TrendText variation={kpi.variationLatestVsAvg} baselineText="el último año" />
                )}              
              </CardContent>
            </Card>
          </motion.div>

          <motion.div className="h-full" whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative h-full overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-amber-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mejor año ({kpi.maxYear})</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/25">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-center gap-1 relative z-10">
                <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-7 w-24" /> : numberFormatter.format(kpi.maxYearTotal)}
                </div>
                {!loading && (
                    <TrendText variation={kpi.variationMaxVsAvg} baselineText="el promedio general" className="mt-1" />
                )}              
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="overflow-hidden border-border/50 bg-card/70 dark:bg-gradient-to-br dark:from-card dark:to-card/50 shadow-sm backdrop-blur-sm">
          <CardHeader className="border-b border-border/40 bg-muted/30 dark:bg-muted/10">
            <CardTitle className="text-base font-semibold text-foreground">
              Grafico estadistico de transito por años y meses
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loading && <Skeleton className="h-[520px] w-full rounded-xl" />}
            {!loading && !error && (
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
                  <CartesianGrid vertical={true} stroke="hsl(var(--border))" strokeOpacity={0.9} strokeWidth={1.05} />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => numberFormatter.format(value)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-mono font-medium tabular-nums">
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
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
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
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="overflow-hidden border-border/50 bg-card/70 dark:bg-gradient-to-br dark:from-card dark:to-card/50 shadow-sm backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/30 dark:bg-muted/10">
            <div>
              <CardTitle className="text-base">Detalle mensual</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && (
              <div className="p-4 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {error && !loading && <p className="px-3 py-3 text-sm text-destructive">{error}</p>}
            {!loading && !error && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 dark:bg-muted/30">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Mes
                      </th>
                      {anios.map((anio, idx) => (
                        <th key={anio} className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `var(--chart-${(idx % 5) + 1})` }} />
                            <span>{anio}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>Total general</span>
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
                        className={`border-b border-border/40 transition-colors hover:bg-muted/50 dark:hover:bg-muted/30 ${index % 2 === 0 ? "bg-card/40 dark:bg-card/20" : "bg-muted/20 dark:bg-muted/5"}`}
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                          <span className="inline-flex items-center rounded-md border border-border/50 bg-white/60 dark:bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground/90 shadow-sm backdrop-blur-sm">
                            {row.monthLabel}
                          </span>
                        </td>
                        {anios.map((anio) => (
                          <td key={`${row.monthLabel}-${anio}`} className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground/80">
                            <span className="font-medium">
                              {numberFormatter.format(Number(row[`y${anio}`] ?? 0))}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-foreground">
                          <span className="inline-flex items-center rounded-md border border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
                            {numberFormatter.format(Number(row.totalGeneral ?? 0))}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border/60 bg-muted/60 dark:bg-muted/40">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total general</th>
                      {anios.map((anio) => (
                        <th key={`total-${anio}`} className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                          {numberFormatter.format(totalesPorAnio[anio] ?? 0)}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                        <span className="inline-flex items-center rounded-md border border-emerald-300/50 dark:border-emerald-500/30 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 font-bold text-emerald-800 dark:text-emerald-300">
                          {numberFormatter.format(totalGeneral)}
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
