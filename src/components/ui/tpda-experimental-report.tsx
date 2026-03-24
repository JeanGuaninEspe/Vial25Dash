import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"
import { getISOWeek, getISOWeeksInYear, startOfISOWeekYear } from "date-fns"
import { Activity, CalendarClock, Filter, LineChart as LineChartIcon, Table, TrendingUp, RefreshCw } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
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

type TpdaRow = {
  fecha: string
  congoma: number
  losAngeles: number
}

type TransitoAggregates = {
  totalTransitos: number
  porHora: { hora: string; cantidad: number }[]
  porHoraDia: { fecha: string; horas: { hora: string; cantidad: number }[] }[]
}

type ReporteMensualSemanalItem = {
  formaPago?: string
  totalTransitos?: number
}

type ReporteMensualSemanalDia = {
  fecha: string
  cantidad: number
}

type ReporteMensualSemanalResponse = {
  data?: ReporteMensualSemanalItem[]
  conteoPorDia?: ReporteMensualSemanalDia[]
}

type TransitoDataRow = {
  formaPago?: string
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/r-estadistico/reporte-mensual-semanal"
const CACHE_PREFIX = "tpda-exp-cache-v1:"
const CACHE_EXPIRY_MS = 30 * 60 * 1000

const chartConfig = {
  congoma: {
    label: "CÓNGOMA",
    color: "var(--chart-1)",
  },
  losAngeles: {
    label: "LOS ANGELES",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const monthOptions = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
]

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

function buildMonthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const toDate = new Date(year, month, 0)
  const to = `${year}-${String(month).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`

  return { from, to }
}

function buildYearRange(year: number, currentDate: Date) {
  const from = `${year}-01-01`
  const isCurrentYear = year === currentDate.getFullYear()
  const to = isCurrentYear
    ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(
        currentDate.getDate()
      ).padStart(2, "0")}`
    : `${year}-12-31`

  return { from, to }
}

function toDateInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function getIsoWeekFromFecha(fecha: string) {
  return getISOWeek(new Date(`${fecha}T00:00:00`))
}

function sumByDay(conteoPorDia: ReporteMensualSemanalDia[] | undefined) {
  if (!conteoPorDia?.length) return new Map<string, number>()

  const map = new Map<string, number>()

  conteoPorDia.forEach((day) => {
    map.set(day.fecha, day.cantidad ?? 0)
  })

  return map
}

async function fetchTpdaPeaje(
  nombrePeaje: string,
  from: string,
  to: string,
  formaPago: string
): Promise<Map<string, number>> {
  const params = new URLSearchParams()
  params.append("desde", from)
  params.append("hasta", to)
  params.append("nombrePeaje", nombrePeaje)

  if (formaPago !== "all") {
    params.append("tipo1", formaPago)
  }

  const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`
  const cacheKey = `peaje:${url}`
  const cachedPayload = getCachedItem<ReporteMensualSemanalResponse>(cacheKey)
  if (cachedPayload) {
    return sumByDay(cachedPayload.conteoPorDia)
  }

  const response = await apiFetch(url)

  if (!response.ok) {
    throw new Error(`Error ${response.status}`)
  }

  const payload = (await response.json()) as ReporteMensualSemanalResponse
  setCachedItem(cacheKey, payload)
  return sumByDay(payload.conteoPorDia)
}

export function TpdaExperimentalReport() {
  const now = React.useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentWeek = getISOWeek(now)
  const defaultWeekSelection = React.useMemo(() => {
    if (currentWeek > 1) {
      return { year: currentYear, week: currentWeek - 1 }
    }

    const previousYear = currentYear - 1
    const previousYearWeeks = getISOWeeksInYear(new Date(`${previousYear}-06-15T00:00:00`))
    return { year: previousYear, week: previousYearWeeks }
  }, [currentWeek, currentYear])

  const [year, setYear] = React.useState(String(defaultWeekSelection.year))
  const [month, setMonth] = React.useState("all")
  const [semana, setSemana] = React.useState(String(defaultWeekSelection.week))
  const [formaPago, setFormaPago] = React.useState("all")

  const [formaPagoOptions, setFormaPagoOptions] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<TpdaRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingFormaPago, setLoadingFormaPago] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const yearOptions = React.useMemo(() => {
    const start = 2021
    const totalYears = Math.max(currentYear - start + 1, 1)
    return Array.from({ length: totalYears }, (_, index) => String(start + index))
  }, [currentYear])

  React.useEffect(() => {
    let isMounted = true

    const fetchFormasPago = async () => {
      setLoadingFormaPago(true)
      try {
        const selectedYear = Number(year)
        const selectedMonth = Number(month)
        const range = month === "all"
          ? buildYearRange(selectedYear, now)
          : buildMonthRange(selectedYear, selectedMonth)

        const optionsCacheKey = `formasPago:${range.from}:${range.to}`
        const cachedOptions = getCachedItem<string[]>(optionsCacheKey)

        let values: string[] = []

        if (cachedOptions) {
          values = cachedOptions
        } else {
          const params = new URLSearchParams()
          params.append("desde", range.from)
          params.append("hasta", range.to)
          params.append("nombrePeaje", "CONGOMA")

          const response = await apiFetch(`${BASE_URL}${ENDPOINT}?${params.toString()}`)

          if (!response.ok) {
            throw new Error(`Error ${response.status}`)
          }

          const payload = (await response.json()) as ReporteMensualSemanalResponse
          const source = (payload.data as TransitoDataRow[] | undefined) ?? []

          values = Array.from(
            new Set(
              source
                .map((row) => row?.formaPago?.trim())
                .filter((value): value is string => Boolean(value))
            )
          ).sort((a, b) => a.localeCompare(b, "es"))

          setCachedItem(optionsCacheKey, values)
        }

        if (isMounted) {
          setFormaPagoOptions(values)
          if (formaPago !== "all" && !values.includes(formaPago)) {
            setFormaPago("all")
          }
        }
      } catch {
        if (isMounted) {
          setFormaPagoOptions([])
          setFormaPago("all")
        }
      } finally {
        if (isMounted) {
          setLoadingFormaPago(false)
        }
      }
    }

    fetchFormasPago()

    return () => {
      isMounted = false
    }
  }, [year, month, now])

  React.useEffect(() => {
    let isMounted = true

    const fetchRows = async () => {
      setLoading(true)
      setError(null)

      try {
        const selectedYear = Number(year)
        const selectedMonth = Number(month)
        const range = (() => {
          if (month !== "all") {
            return buildMonthRange(selectedYear, selectedMonth)
          }

          const baseRange = buildYearRange(selectedYear, now)
          // Caso especial: semana 1 debe incluir los dias ISO del anio previo.
          if (semana === "1") {
            const isoYearStart = startOfISOWeekYear(new Date(`${selectedYear}-06-15T12:00:00`))
            return {
              from: toDateInputValue(isoYearStart),
              to: baseRange.to,
            }
          }

          return baseRange
        })()

        const rowsCacheKey = `rows:${year}:${month}:${semana}:${formaPago}`
        const cachedRows = getCachedItem<TpdaRow[]>(rowsCacheKey)

        let data: TpdaRow[]

        if (cachedRows) {
          data = cachedRows
        } else {
          const [congomaMap, losAngelesMap] = await Promise.all([
            fetchTpdaPeaje("CONGOMA", range.from, range.to, formaPago),
            fetchTpdaPeaje("LOS ANGELES", range.from, range.to, formaPago),
          ])

          const allDates = Array.from(new Set([...congomaMap.keys(), ...losAngelesMap.keys()])).sort((a, b) =>
            a.localeCompare(b)
          )

          data = allDates.map((fecha) => ({
            fecha,
            congoma: congomaMap.get(fecha) ?? 0,
            losAngeles: losAngelesMap.get(fecha) ?? 0,
          }))

          setCachedItem(rowsCacheKey, data)
        }

        if (isMounted) {
          setRows(data)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error inesperado")
          setRows([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchRows()

    return () => {
      isMounted = false
    }
  }, [year, month, semana, formaPago, now])

  const weekOptions = React.useMemo(() => {
    return Array.from(new Set(rows.map((row) => getIsoWeekFromFecha(row.fecha)))).sort((a, b) => a - b)
  }, [rows])

  const isMonthLocked = semana !== "all"
  const isWeekLocked = month !== "all"

  const hasInitializedWeek = React.useRef(false)

  React.useEffect(() => {
    if (!weekOptions.length) return
    if (!hasInitializedWeek.current) {
      if (Number(year) === defaultWeekSelection.year && weekOptions.includes(defaultWeekSelection.week)) {
        setSemana(String(defaultWeekSelection.week))
      } else {
        setSemana("all")
      }
      hasInitializedWeek.current = true
      return
    }

    if (semana !== "all" && !weekOptions.includes(Number(semana))) {
      setSemana("all")
    }
  }, [year, semana, weekOptions, defaultWeekSelection])

  const filteredRows = React.useMemo(() => {
    if (semana === "all") return rows
    const selectedWeek = Number(semana)
    return rows.filter((row) => getIsoWeekFromFecha(row.fecha) === selectedWeek)
  }, [rows, semana])

  const totals = React.useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.congoma += row.congoma
        acc.losAngeles += row.losAngeles
        acc.general += row.congoma + row.losAngeles
        return acc
      },
      { congoma: 0, losAngeles: 0, general: 0 }
    )
  }, [filteredRows])

  const weeklyData = React.useMemo(() => {
    const byWeek = new Map<number, number>()
    filteredRows.forEach((row) => {
      const week = getIsoWeekFromFecha(row.fecha)
      const total = row.congoma + row.losAngeles
      byWeek.set(week, (byWeek.get(week) ?? 0) + total)
    })
    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, total]) => ({ week: `Semana ${week}`, total }))
  }, [filteredRows])

  const kpi = React.useMemo(() => {
    const total = totals.general

    if (semana !== "all") {
      // Comparación real con la semana anterior
      const currentWeek = Number(semana)
      const prevWeekNum = currentWeek - 1
      const prevWeekRows = rows.filter(r => getIsoWeekFromFecha(r.fecha) === prevWeekNum)
      
      const prevTotal = prevWeekRows.reduce((acc, r) => acc + r.congoma + r.losAngeles, 0)
      const prevAvg = prevWeekRows.length ? prevTotal / prevWeekRows.length : 0
      
      const variationTotal = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
      
      const avgSecondary = filteredRows.length ? total / filteredRows.length : 0
      const variationAvg = prevAvg > 0 ? ((avgSecondary - prevAvg) / prevAvg) * 100 : 0

      const days = filteredRows.map(r => ({ label: r.fecha.split("-").reverse().slice(0,2).join("/"), total: r.congoma + r.losAngeles }))
      const maxSecondary = days.reduce(
        (acc, item) => (item.total > acc.total ? item : acc),
        { label: "-", total: 0 }
      )

      return {
        total,
        showVariation: true,
        variationTotal,
        baselineTotal: "la semana pasada",
        avgSecondary,
        variationAvg,
        baselineAvg: "la semana pasada",
        avgSecondaryLabel: "Promedio diario",
        maxSecondaryLabel: maxSecondary.label,
        maxSecondaryTotal: maxSecondary.total,
        maxSecondaryTitle: "Día más alto"
      }
    } else if (month !== "all") {
      const avgSecondary = filteredRows.length ? total / filteredRows.length : 0
      const days = filteredRows.map(r => ({ label: r.fecha.split("-").reverse().slice(0,2).join("/"), total: r.congoma + r.losAngeles }))
      const maxSecondary = days.reduce(
        (acc, item) => (item.total > acc.total ? item : acc),
        { label: "-", total: 0 }
      )

      return {
        total,
        showVariation: false,
        variationTotal: 0,
        baselineTotal: "",
        avgSecondary,
        variationAvg: 0,
        baselineAvg: "",
        avgSecondaryLabel: "Promedio diario",
        maxSecondaryLabel: maxSecondary.label,
        maxSecondaryTotal: maxSecondary.total,
        maxSecondaryTitle: "Día más alto"
      }
    }

    // Vista anual
    const avgSecondary = weeklyData.length ? total / weeklyData.length : 0
    const maxWeek = weeklyData.reduce(
      (acc, item) => (item.total > acc.total ? item : acc),
      { week: "-", total: 0 }
    )

    return { 
      total, 
      showVariation: false,
      variationTotal: 0,
      baselineTotal: "",
      avgSecondary, 
      variationAvg: 0,
      baselineAvg: "",
      avgSecondaryLabel: "Promedio semanal",
      maxSecondaryLabel: maxWeek.week,
      maxSecondaryTotal: maxWeek.total,
      maxSecondaryTitle: "Semana más alta"
    }
  }, [totals.general, weeklyData, filteredRows, semana, month, rows])

  const totalKpiLabel = React.useMemo(() => {
    if (semana !== "all") return "Total semanal"
    if (month !== "all") return "Total mensual"
    return "Total anual"
  }, [semana, month])

  const selectedMonthLabel = monthOptions.find((option) => option.value === month)?.label ?? month
  const hasNoData = !loading && !error && filteredRows.length === 0
  const fromDate = filteredRows[0]?.fecha
  const toDate = filteredRows[filteredRows.length - 1]?.fecha

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
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={cardVariants}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">Reporte TPDA (Experimental)</h2>
              <p className="text-sm text-muted-foreground">
                Vista comparativa diaria Cóngoma vs Los Angeles
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <CalendarClock className="h-3.5 w-3.5" />
              {fromDate && toDate
                ? `${fromDate.split("-").reverse().join("/")} - ${toDate.split("-").reverse().join("/")}`
                : month === "all"
                  ? `Año ${year}`
                  : `Mes de ${selectedMonthLabel} ${year}`}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
            <motion.div className="space-y-1.5" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Año</p>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-9 w-[140px] bg-background shadow-sm text-sm">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
            <motion.div className="space-y-1.5" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Mes</p>
              <Select
                value={month}
                onValueChange={(value) => {
                  setMonth(value)
                  if (value !== "all") setSemana("all")
                }}
                disabled={isMonthLocked}
              >
                <SelectTrigger className="h-9 w-[140px] bg-background shadow-sm text-sm">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
            <motion.div className="space-y-1.5" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Semana</p>
              <Select
                value={semana}
                onValueChange={(value) => {
                  setSemana(value)
                  if (value !== "all") setMonth("all")
                }}
                disabled={isWeekLocked}
              >
                <SelectTrigger className="h-9 w-[140px] bg-background shadow-sm text-sm">
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {weekOptions.map((week) => (
                    <SelectItem key={week} value={String(week)}>
                      Semana {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
            <motion.div className="space-y-1.5" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Forma de pago</p>
              <Select value={formaPago} onValueChange={setFormaPago}>
                <SelectTrigger className="h-9 w-[180px] bg-background shadow-sm text-sm">
                  <SelectValue placeholder={loadingFormaPago ? "Cargando..." : "Forma de pago"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">(Todas)</SelectItem>
                  {formaPagoOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="ml-auto sm:ml-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-2 shadow-sm border-dashed hover:border-solid transition-all"
                onClick={() => {
                  setYear(String(defaultWeekSelection.year))
                  setMonth("all")
                  setSemana(String(defaultWeekSelection.week))
                  setFormaPago("all")
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={cardVariants}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <motion.div className="h-full" whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative h-full overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-primary/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">{totalKpiLabel}</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : numberFormatter.format(kpi.total)}
                </div>
                {!loading && kpi.showVariation && (
                  <TrendText variation={kpi.variationTotal} baselineText={kpi.baselineTotal} />
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div className="h-full" whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative h-full overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-emerald-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.avgSecondaryLabel}</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
                  <Activity className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : numberFormatter.format(Math.round(kpi.avgSecondary))}
                </div>
                {!loading && kpi.showVariation && (
                  <TrendText variation={kpi.variationAvg} baselineText={kpi.baselineAvg} />
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div className="h-full" whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative h-full overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-amber-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.maxSecondaryTitle}</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/25">
                  <LineChartIcon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-center gap-1 relative z-10">
                <div className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-7 w-24" /> : kpi.maxSecondaryLabel}
                </div>
                {!loading && (
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {numberFormatter.format(kpi.maxSecondaryTotal)} tránsitos
                  </span>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/40 bg-gradient-to-r from-card to-muted/10 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/5 pb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <LineChartIcon className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">Total tránsito diario</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Comparativo Cóngoma vs Los Angeles
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-5 text-xs font-semibold text-muted-foreground mr-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: "var(--color-congoma, var(--chart-1))" }} />
                <span className="tracking-wide">CÓNGOMA</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: "var(--color-losAngeles, var(--chart-2))" }} />
                <span className="tracking-wide">LOS ANGELES</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="p-4">
                <Skeleton className="h-[480px] w-full rounded-xl" />
              </div>
            )}
            {!loading && !error && filteredRows.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <ChartContainer config={chartConfig} className="h-[480px] w-full">
                  <LineChart
                    data={filteredRows}
                    margin={{
                      top: 64,
                      right: 16,
                      left: 16,
                      bottom: 80,
                    }}
                  >
                    <CartesianGrid vertical={true} />
                    <XAxis
                      dataKey="fecha"
                      angle={-45}
                      textAnchor="end"
                      height={74}
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
                          labelFormatter={(value) => `FECHA_EVENTO: ${value}`}
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
                    <Line
                      dataKey="congoma"
                      type="monotone"
                      stroke="var(--color-congoma)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      name="CÓNGOMA"
                      isAnimationActive
                    >
                      <LabelList
                        dataKey="congoma"
                        position="top"
                        angle={-90}
                        offset={26}
                        formatter={(value: number) => numberFormatter.format(value)}
                        className="fill-foreground text-xs font-semibold"
                      />
                    </Line>
                    <Line
                      dataKey="losAngeles"
                      type="monotone"
                      stroke="var(--color-losAngeles)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      name="LOS ANGELES"
                      isAnimationActive
                    >
                      <LabelList
                        dataKey="losAngeles"
                        position="bottom"
                        angle={-90}
                        offset={20}
                        formatter={(value: number) => numberFormatter.format(value)}
                        className="fill-muted-foreground text-xs font-semibold"
                      />
                    </Line>
                  </LineChart>
                </ChartContainer>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/40 bg-gradient-to-r from-card to-muted/10 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/5 pb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <Table className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base font-semibold">Detalle diario</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {filteredRows.length} registros visibles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && (
              <div className="divide-y border-t border-border/40">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between px-6 py-4">
                    <Skeleton className="h-6 w-28 shrink-0" />
                    <Skeleton className="h-6 w-20 shrink-0" />
                    <Skeleton className="h-6 w-20 shrink-0" />
                    <Skeleton className="h-6 w-24 shrink-0" />
                  </div>
                ))}
              </div>
            )}
            {error && !loading && <p className="px-4 py-4 text-sm text-destructive">{error}</p>}
            {hasNoData && (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                No hay datos disponibles para los filtros seleccionados.
              </p>
            )}

            {!loading && !error && filteredRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 backdrop-blur">
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Fecha evento
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: "var(--color-congoma, var(--chart-1))" }} />
                          Cóngoma
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: "var(--color-losAngeles, var(--chart-2))" }} />
                          Los Angeles
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Total general
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => {
                      const totalDia = row.congoma + row.losAngeles
                      return (
                        <motion.tr
                          key={row.fecha}
                          variants={rowVariants}
                          custom={index}
                          initial="hidden"
                          animate="show"
                          className={cn(
                            "border-b border-border/40 transition-colors last:border-0 hover:bg-muted/50",
                            index % 2 === 0 ? "bg-card/40" : "bg-muted/10",
                          )}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            <span className="inline-flex rounded-md border border-border/50 bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                              {row.fecha}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium">
                              {numberFormatter.format(row.congoma)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm tabular-nums">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 font-medium">
                              {numberFormatter.format(row.losAngeles)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                            <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-400/25 bg-emerald-100 dark:bg-emerald-500/12 px-2.5 py-0.5 text-emerald-900 dark:text-emerald-300">
                              {numberFormatter.format(totalDia)}
                            </span>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border/60 bg-muted/40 text-foreground">
                      <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Total general</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                        <span className="inline-flex items-center rounded-md bg-blue-500/15 px-2.5 py-1 text-blue-800 dark:text-blue-300">
                          {numberFormatter.format(totals.congoma)}
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                        <span className="inline-flex items-center rounded-md bg-purple-500/15 px-2.5 py-1 text-purple-800 dark:text-purple-300">
                          {numberFormatter.format(totals.losAngeles)}
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                        <span className="inline-flex items-center rounded-md border border-emerald-300 dark:border-emerald-400/40 bg-emerald-200 dark:bg-emerald-500/20 px-2.5 py-1 font-bold text-emerald-950 dark:text-emerald-200">
                          {numberFormatter.format(totals.general)}
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
