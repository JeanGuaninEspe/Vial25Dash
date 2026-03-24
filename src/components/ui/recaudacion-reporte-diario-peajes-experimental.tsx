import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { getISOWeek, getISOWeeksInYear, startOfISOWeekYear } from "date-fns"
import { Area, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, XAxis, YAxis } from "recharts"
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarClock,
  Landmark,
  LineChart as LineChartIcon,
  Minus,
  RefreshCcw,
  TrendingUp,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

type RecaudacionDetalle = {
  fecha: string
  nombrePeaje: string
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

type RecaudacionTotales = {
  nombrePeaje: string
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

type RecaudacionTotalGeneral = {
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

type ReporteDiarioPeajesResponse = {
  data: RecaudacionDetalle[]
  totalPorPeaje: RecaudacionTotales[]
  totalGeneral: RecaudacionTotalGeneral
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/recaudacion/reporte-diario-peajes"
const CACHE_PREFIX = "recaudacion-diario-peajes-exp-v4:"
const CACHE_EXPIRY_MS = 30 * 60 * 1000

const amountFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("es-EC")

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
      JSON.stringify({ timestamp: Date.now(), data })
    )
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

function formatShortDate(dateValue: string) {
  const date = parseApiDate(dateValue)
  if (!date) return dateValue
  const day = String(date.getDate()).padStart(2, "0")
  const month = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][
    date.getMonth()
  ]
  return `${day} ${month}`
}

function formatTableDate(dateValue: string) {
  const date = parseApiDate(dateValue)
  if (!date) return dateValue
  const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]
  const dayName = dayNames[date.getDay()]
  return `${dayName} ${formatShortDate(dateValue)}`
}

function parseApiDate(value: string) {
  const datePart = value.includes("T") ? value.split("T")[0] : value
  const [year, month, day] = datePart.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function getIsoWeekRange(year: number, week: number) {
  const week1Monday = startOfISOWeekYear(new Date(`${year}-06-15T12:00:00`))

  // Caso especial solicitado: la semana 1 incluye dias del anio previo.
  const monday = new Date(week1Monday)
  if (week > 1) {
    monday.setDate(week1Monday.getDate() + (week - 1) * 7)
  }

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  monday.setHours(0, 0, 0, 0)
  sunday.setHours(23, 59, 59, 999)

  return { monday, sunday }
}

export function RecaudacionReporteDiarioPeajesExperimental() {
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

  const [nombrePeaje, setNombrePeaje] = React.useState("all")
  const [anio, setAnio] = React.useState(String(defaultWeekSelection.year))
  const [numSemana, setNumSemana] = React.useState(String(defaultWeekSelection.week))
  const [turno, setTurno] = React.useState("all")

  const [payload, setPayload] = React.useState<ReporteDiarioPeajesResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const yearOptions = React.useMemo(() => {
    const from = currentYear - 4
    return Array.from({ length: 7 }, (_, idx) => String(from + idx))
  }, [currentYear])

  const weekOptions = React.useMemo(() => {
    const selectedYear = Number(anio)
    if (Number.isNaN(selectedYear)) return []

    const maxWeek =
      selectedYear === currentYear
        ? getISOWeek(now)
        : getISOWeeksInYear(new Date(`${selectedYear}-06-15T00:00:00`))

    return Array.from({ length: maxWeek }, (_, idx) => String(idx + 1))
  }, [anio, currentYear, now])

  React.useEffect(() => {
    if (weekOptions.length === 0) return
    if (!weekOptions.includes(numSemana)) {
      setNumSemana(weekOptions[weekOptions.length - 1])
    }
  }, [weekOptions, numSemana])

  React.useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const selectedYear = Number(anio)
        const selectedWeek = Number(numSemana)

        const fetchWeek = async (yearValue: number, weekValue: number) => {
          const params = new URLSearchParams()
          params.append("anio", String(yearValue))
          params.append("numSemana", String(weekValue))

          if (nombrePeaje !== "all") {
            params.append("nombrePeaje", nombrePeaje)
          }

          if (turno !== "all") {
            params.append("turno", turno)
          }

          const query = params.toString()
          const cacheKey = `q:${query}`
          const cached = getCachedItem<ReporteDiarioPeajesResponse>(cacheKey)
          if (cached) return cached

          const response = await apiFetch(`${BASE_URL}${ENDPOINT}?${query}`)
          if (!response.ok) throw new Error(`Error ${response.status}`)
          const json = (await response.json()) as ReporteDiarioPeajesResponse
          setCachedItem(cacheKey, json)
          return json
        }

        const currentWeekPayload = await fetchWeek(selectedYear, selectedWeek)

        // Obtener semana anterior para comparaciones
        const prevWeekYear = selectedWeek > 1 ? selectedYear : selectedYear - 1
        const prevWeekValue = selectedWeek > 1 
          ? selectedWeek - 1 
          : getISOWeeksInYear(new Date(`${selectedYear - 1}-06-15T00:00:00`))
        const prevWeekPayload = await fetchWeek(prevWeekYear, prevWeekValue)

        // Obtener semana siguiente por si getIsoWeekRange cruza fronteras
        const weeksInSelectedYear = getISOWeeksInYear(new Date(`${selectedYear}-06-15T00:00:00`))
        const nextWeekYear = selectedWeek < weeksInSelectedYear ? selectedYear : selectedYear + 1
        const nextWeekValue = selectedWeek < weeksInSelectedYear ? selectedWeek + 1 : 1
        const nextWeekPayload = await fetchWeek(nextWeekYear, nextWeekValue)

        const mergedDataMap = new Map<string, RecaudacionDetalle>()
        ;[...prevWeekPayload.data, ...currentWeekPayload.data, ...nextWeekPayload.data].forEach((row) => {
          const key = `${row.nombrePeaje}|${row.fecha}|${row.recaudacionEfectivo}|${row.totalDepositado}`
          mergedDataMap.set(key, row)
        })

        const mergedPayload: ReporteDiarioPeajesResponse = {
          data: Array.from(mergedDataMap.values()),
          totalPorPeaje: [],
          totalGeneral: {
            recaudacionEfectivo: 0,
            recargasRfid: 0,
            sobrante: 0,
            notasCredito: 0,
            totalEfectivo: 0,
            recaudaCheque: 0,
            totalDepositado: 0,
          },
        }

        if (isMounted) setPayload(mergedPayload)
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error inesperado")
          setPayload(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [anio, numSemana, turno, nombrePeaje])

  const isoFilteredRows = React.useMemo(() => {
    const rows = payload?.data ?? []
    const year = Number(anio)
    const week = Number(numSemana)
    if (Number.isNaN(year) || Number.isNaN(week)) return rows

    const { monday, sunday } = getIsoWeekRange(year, week)

    return rows.filter((row) => {
      const rowDate = parseApiDate(row.fecha)
      if (!rowDate) return false
      return rowDate >= monday && rowDate <= sunday
    })
  }, [payload, anio, numSemana])

  const prevWeekFilteredRows = React.useMemo(() => {
    const rows = payload?.data ?? []
    const year = Number(anio)
    const week = Number(numSemana)
    if (Number.isNaN(year) || Number.isNaN(week)) return []

    const prevWeekYear = week > 1 ? year : year - 1
    const prevWeekValue = week > 1 
      ? week - 1 
      : getISOWeeksInYear(new Date(`${year - 1}-06-15T00:00:00`))

    const { monday, sunday } = getIsoWeekRange(prevWeekYear, prevWeekValue)

    return rows.filter((row) => {
      const rowDate = parseApiDate(row.fecha)
      if (!rowDate) return false
      return rowDate >= monday && rowDate <= sunday
    })
  }, [payload, anio, numSemana])

  const groupedData = React.useMemo(() => {
    const map = new Map<string, RecaudacionDetalle[]>()

    isoFilteredRows.forEach((row) => {
      const list = map.get(row.nombrePeaje) ?? []
      list.push(row)
      map.set(row.nombrePeaje, list)
    })

    map.forEach((list, key) => {
      map.set(
        key,
        [...list].sort((a, b) => a.fecha.localeCompare(b.fecha))
      )
    })

    return map
  }, [isoFilteredRows])

  const totalsByPeaje = React.useMemo(() => {
    const map = new Map<string, RecaudacionTotales>()

    isoFilteredRows.forEach((row) => {
      const current = map.get(row.nombrePeaje) ?? {
        nombrePeaje: row.nombrePeaje,
        recaudacionEfectivo: 0,
        recargasRfid: 0,
        sobrante: 0,
        notasCredito: 0,
        totalEfectivo: 0,
        recaudaCheque: 0,
        totalDepositado: 0,
      }

      current.recaudacionEfectivo += row.recaudacionEfectivo
      current.recargasRfid += row.recargasRfid
      current.sobrante += row.sobrante
      current.notasCredito += row.notasCredito
      current.totalEfectivo += row.totalEfectivo
      current.recaudaCheque += row.recaudaCheque
      current.totalDepositado += row.totalDepositado
      map.set(row.nombrePeaje, current)
    })

    return Array.from(map.values())
  }, [isoFilteredRows])

  const totalGeneral = React.useMemo<RecaudacionTotalGeneral | null>(() => {
    if (isoFilteredRows.length === 0) return null

    return isoFilteredRows.reduce<RecaudacionTotalGeneral>(
      (acc, row) => {
        acc.recaudacionEfectivo += row.recaudacionEfectivo
        acc.recargasRfid += row.recargasRfid
        acc.sobrante += row.sobrante
        acc.notasCredito += row.notasCredito
        acc.totalEfectivo += row.totalEfectivo
        acc.recaudaCheque += row.recaudaCheque
        acc.totalDepositado += row.totalDepositado
        return acc
      },
      {
        recaudacionEfectivo: 0,
        recargasRfid: 0,
        sobrante: 0,
        notasCredito: 0,
        totalEfectivo: 0,
        recaudaCheque: 0,
        totalDepositado: 0,
      }
    )
  }, [isoFilteredRows])

  const dailyPeajeData = React.useMemo(() => {
    const byDate = new Map<
      string,
      { fecha: string; congoma: number; losAngeles: number }
    >()

    isoFilteredRows.forEach((row) => {
      const current = byDate.get(row.fecha) ?? {
        fecha: row.fecha,
        congoma: 0,
        losAngeles: 0,
      }

      if (row.nombrePeaje === "CONGOMA") {
        current.congoma += row.totalDepositado
      } else if (row.nombrePeaje === "LOS ANGELES") {
        current.losAngeles += row.totalDepositado
      }

      byDate.set(row.fecha, current)
    })

    return Array.from(byDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [isoFilteredRows])

  const kpi = React.useMemo(() => {
    const total = totalGeneral?.totalDepositado ?? 0
    const avgByPeaje = totalsByPeaje.length ? total / totalsByPeaje.length : 0
    const top = totalsByPeaje.reduce(
      (acc, row) => (row.totalDepositado > acc.totalDepositado ? row : acc),
      { nombrePeaje: "-", totalDepositado: 0 } as Pick<RecaudacionTotales, "nombrePeaje" | "totalDepositado">
    )

    // Calculo de semana pasada
    const prevTotal = prevWeekFilteredRows.reduce((sum, r) => sum + r.totalDepositado, 0)
    
    // Agrupar prevWeekFilteredRows por peaje para sacar promedio por peaje semanal previo
    const prevPeajesSet = new Set(prevWeekFilteredRows.map(r => r.nombrePeaje))
    const prevPeajesCount = prevPeajesSet.size || 1 // Avoid division by zero
    const prevAvgByPeaje = prevTotal / prevPeajesCount

    const maxDailyPrev = prevWeekFilteredRows.reduce((max, r) => r.totalDepositado > max ? r.totalDepositado : max, 0)
    const maxDailyCurrent = isoFilteredRows.reduce((max, r) => r.totalDepositado > max ? r.totalDepositado : max, 0)

    const variationTotal = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
    const variationAvg = prevAvgByPeaje > 0 ? ((avgByPeaje - prevAvgByPeaje) / prevAvgByPeaje) * 100 : 0
    const variationTop = maxDailyPrev > 0 ? ((maxDailyCurrent - maxDailyPrev) / maxDailyPrev) * 100 : 0

    return {
      total,
      avgByPeaje,
      topPeaje: top.nombrePeaje,
      topTotal: top.totalDepositado,
      showVariation: prevTotal > 0,
      variationTotal,
      variationAvg,
      variationTop
    }
  }, [totalGeneral, totalsByPeaje, prevWeekFilteredRows, isoFilteredRows])

  const averageDailyTotal = React.useMemo(() => {
    if (dailyPeajeData.length === 0) return null
    const total = dailyPeajeData.reduce((acc, row) => acc + row.congoma + row.losAngeles, 0)
    return total / dailyPeajeData.length
  }, [dailyPeajeData])

  const sortedDates = React.useMemo(
    () => [...isoFilteredRows.map((row) => row.fecha)].sort((a, b) => a.localeCompare(b)),
    [isoFilteredRows]
  )
  const fromDate = sortedDates[0]
  const toDate = sortedDates[sortedDates.length - 1]

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

  const highlightedIndexesByKey = React.useMemo(() => {
    const buildIndexSet = (key: "congoma" | "losAngeles") => {
      const set = new Set<number>()
      if (dailyPeajeData.length === 0) return set

      set.add(dailyPeajeData.length - 1)

      let maxIndex = 0
      let minIndex = 0

      dailyPeajeData.forEach((row, index) => {
        if (row[key] > dailyPeajeData[maxIndex][key]) maxIndex = index
        if (row[key] < dailyPeajeData[minIndex][key]) minIndex = index
      })

      set.add(maxIndex)
      set.add(minIndex)
      return set
    }

    return {
      congoma: buildIndexSet("congoma"),
      losAngeles: buildIndexSet("losAngeles"),
    }
  }, [dailyPeajeData])

  const renderSparseLabel = React.useCallback(
    (props: any, seriesKey: "congoma" | "losAngeles") => {
      const { index, value, x, y, stroke } = props
      const xPos = typeof x === "number" ? x : Number(x)
      const yPos = typeof y === "number" ? y : Number(y)

      if (typeof index !== "number" || Number.isNaN(xPos) || Number.isNaN(yPos)) {
        return null
      }

      if (!highlightedIndexesByKey[seriesKey].has(index)) return null

      const yOffset = seriesKey === "congoma" ? -10 : 16

      return (
        <text
          x={xPos}
          y={yPos + yOffset}
          textAnchor="middle"
          fill={typeof stroke === "string" ? stroke : "currentColor"}
          className="text-[11px] font-semibold"
        >
          {formatCompactNumber(Number(value))}
        </text>
      )
    },
    [highlightedIndexesByKey]
  )

  const kpiGridVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const kpiCardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={cardVariants}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Recaudación diaria por peajes
            </h2>
            <p className="text-sm text-muted-foreground">Comparativo semanal por peaje y turno</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {fromDate && toDate
              ? `${fromDate.split("-").reverse().join("/")} - ${toDate.split("-").reverse().join("/")}`
              : `Semana ${numSemana} - ${anio}`}
          </span>
        </div>
      </motion.div>

      <motion.div variants={cardVariants}>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/40 bg-card/80 dark:bg-muted/10 p-4 shadow-sm backdrop-blur-md">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Peaje</p>
            <Select value={nombrePeaje} onValueChange={setNombrePeaje} disabled={loading}>
              <SelectTrigger className="h-8 w-[170px] bg-background/60 text-xs">
                <SelectValue placeholder="(Todas)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">(Todas)</SelectItem>
                <SelectItem value="CONGOMA">CONGOMA</SelectItem>
                <SelectItem value="LOS ANGELES">LOS ANGELES</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Año</p>
            <Select value={anio} onValueChange={setAnio} disabled={loading}>
              <SelectTrigger className="h-8 w-[130px] bg-background/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Semana</p>
            <Select value={numSemana} onValueChange={setNumSemana} disabled={loading}>
              <SelectTrigger className="h-8 w-[130px] bg-background/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((week) => (
                  <SelectItem key={week} value={week}>
                    Semana {week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Turno</p>
            <Select value={turno} onValueChange={setTurno} disabled={loading}>
              <SelectTrigger className="h-8 w-[130px] bg-background/60 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">(Todas)</SelectItem>
                <SelectItem value="1">Turno 1</SelectItem>
                <SelectItem value="2">Turno 2</SelectItem>
                <SelectItem value="3">Turno 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-8 border-border/40 hover:bg-muted/60 dark:hover:bg-muted/50"
            onClick={() => {
              setNombrePeaje("all")
              setAnio(String(defaultWeekSelection.year))
              setNumSemana(String(defaultWeekSelection.week))
              setTurno("all")
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </motion.div>

      <motion.div variants={cardVariants}>
        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
          variants={kpiGridVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={kpiCardVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-primary/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total recaudado</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : `$ ${formatAmount(kpi.total)}`}
                </div>
                  {!loading && kpi.showVariation && (
                    <TrendText variation={kpi.variationTotal} baselineText="la semana pasada" />
                  )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={kpiCardVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-emerald-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Prom. por peaje</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
                  <Landmark className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : `$ ${formatAmount(kpi.avgByPeaje)}`}
                </div>
                  {!loading && kpi.showVariation && (
                    <TrendText variation={kpi.variationAvg} baselineText="la semana pasada" />
                  )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={kpiCardVariants} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
            <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl transition-colors hover:border-amber-500/50">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Peaje destacado</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/25">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                    {loading ? <Skeleton className="h-7 w-24" /> : kpi.topPeaje}
                  </div>
                  {!loading && kpi.topTotal > 0 && (
                    <span className="text-lg font-semibold text-amber-600 dark:text-amber-300">
                      $ {formatAmount(kpi.topTotal)}
                    </span>
                  )}
                </div>
                {!loading && kpi.showVariation && kpi.topTotal > 0 && (
                  <TrendText variation={kpi.variationTop} baselineText="el pico la semana pasada" className="mt-0" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/60 bg-card/80 shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.45)] transition-colors hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent/40 text-sidebar-foreground/80">
                <LineChartIcon className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base">Total recaudación diaria por peaje</CardTitle>
                <CardDescription>
                  Comparativo Cóngoma vs Los Angeles
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--chart-1)" }} />
                <span>CÓNGOMA</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--chart-2)" }} />
                <span>LOS ANGELES</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[480px] w-full" />
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : dailyPeajeData.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <ChartContainer config={chartConfig} className="h-[480px] w-full">
                  <ComposedChart
                    data={dailyPeajeData}
                    margin={{
                      top: 32,
                      right: 16,
                      left: 16,
                      bottom: 24,
                    }}
                  >
                    <CartesianGrid vertical={true} />
                    <XAxis
                      dataKey="fecha"
                      tickFormatter={formatShortDate}
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
                          labelFormatter={(value) => `Fecha: ${formatShortDate(String(value))}`}
                          formatter={(value, name) => (
                            <div className="flex w-full justify-between gap-4">
                              <span className="text-muted-foreground">{name}</span>
                              <span className="font-mono font-medium tabular-nums">
                                $ {formatAmount(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Area
                      dataKey="congoma"
                      type="monotone"
                      stroke="none"
                      fill="var(--color-congoma)"
                      fillOpacity={0.12}
                      tooltipType="none"
                      isAnimationActive
                    />
                    <Area
                      dataKey="losAngeles"
                      type="monotone"
                      stroke="none"
                      fill="var(--color-losAngeles)"
                      fillOpacity={0.08}
                      tooltipType="none"
                      isAnimationActive
                    />
                    {averageDailyTotal !== null && (
                      <ReferenceLine
                        y={averageDailyTotal}
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
                    )}
                    <Line
                      dataKey="congoma"
                      type="monotone"
                      stroke="var(--color-congoma)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="CÓNGOMA"
                      isAnimationActive
                    >
                      <LabelList
                        dataKey="congoma"
                        content={(props) => renderSparseLabel(props, "congoma")}
                      />
                    </Line>
                    <Line
                      dataKey="losAngeles"
                      type="monotone"
                      stroke="var(--color-losAngeles)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="LOS ANGELES"
                      isAnimationActive
                    >
                      <LabelList
                        dataKey="losAngeles"
                        content={(props) => renderSparseLabel(props, "losAngeles")}
                      />
                    </Line>
                  </ComposedChart>
                </ChartContainer>
              </motion.div>
            ) : (
              <div className="flex h-[480px] w-full flex-col items-center justify-center text-muted-foreground">
                <p>No se encontraron datos para la semana seleccionada.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/60 bg-card/80 shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.45)] transition-colors hover:border-primary/50 overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Detalle diario por peaje</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : error ? (
              <p className="px-3 py-3 text-sm text-destructive">{error}</p>
            ) : groupedData.size === 0 ? (
              <div className="flex px-3 py-8 w-full flex-col items-center justify-center text-muted-foreground">
                <p>No hay detalle disponible para mostrar.</p>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-background/95 backdrop-blur dark:border-border/60">
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Peaje</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fecha</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recaudación efectivo</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recargas tag</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sobrante</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notas credito</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total efectivo</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Depos/Transf</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Total recaudado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(groupedData.entries()).map(([peaje, rows]) => {
                      const peajeTotal = totalsByPeaje.find((t) => t.nombrePeaje === peaje)

                      return (
                        <React.Fragment key={peaje}>
                          <tr className="border-b border-slate-200/80 bg-slate-50/70 dark:border-border/60 dark:bg-muted/35">
                            <td className="px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground" colSpan={9}>
                              {peaje}
                            </td>
                          </tr>
                          {rows.map((row, index) => (
                            <motion.tr
                              key={`${peaje}-${row.fecha}-${index}`}
                              variants={rowVariants}
                              custom={index}
                              initial="hidden"
                              animate="show"
                              whileHover={{ scale: 1.002 }}
                              transition={{ duration: 0.12, ease: "easeOut" }}
                              className={cn(
                                "border-b border-slate-200/80 transition-colors hover:bg-slate-50 dark:border-border/40 dark:hover:bg-white/5",
                                index % 2 === 0 ? "bg-card/40" : "bg-muted/20"
                              )}
                            >
                              <td className="px-3 py-1.5 text-sm text-foreground/70">{peaje}</td>
                              <td className="px-3 py-2 text-sm text-foreground">
                                <span className="inline-flex rounded-md border border-border/50 bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground/90">
                                  {formatTableDate(row.fecha)}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-foreground/80">$ {formatAmount(row.recaudacionEfectivo)}</td>
                              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-foreground/80">$ {formatAmount(row.recargasRfid)}</td>
                              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-muted-foreground">$ {formatAmount(row.sobrante)}</td>
                              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-muted-foreground">$ {formatAmount(row.notasCredito)}</td>
                              <td className="px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-foreground">$ {formatAmount(row.totalEfectivo)}</td>
                              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-foreground/80">$ {formatAmount(row.recaudaCheque)}</td>
                              <td className="px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-foreground">
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-400/25 bg-emerald-100 dark:bg-emerald-500/12 px-2 py-0.5 text-emerald-900 dark:text-emerald-300">
                                  <span>$ {formatAmount(row.totalDepositado)}</span>
                                  {index === 0 ? (
                                    <Minus className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                  ) : row.totalDepositado > rows[index - 1].totalDepositado ? (
                                    <ArrowUp className="h-3 w-3 text-emerald-700 dark:text-emerald-300" />
                                  ) : row.totalDepositado < rows[index - 1].totalDepositado ? (
                                    <ArrowDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                                  ) : (
                                    <Minus className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                  )}
                                </span>
                              </td>
                            </motion.tr>
                          ))}

                          {peajeTotal && (
                            <tr className="border-y-2 border-slate-200 bg-slate-50/80 dark:border-border/70 dark:bg-sidebar-accent/30">
                              <td className="px-3 py-2 text-sm font-extrabold text-foreground" colSpan={2}>{`Subtotal ${peaje}`}</td>
                              <td className="px-3 py-2 text-right text-sm font-extrabold tabular-nums text-foreground">$ {formatAmount(peajeTotal.recaudacionEfectivo)}</td>
                              <td className="px-3 py-2 text-right text-sm font-extrabold tabular-nums text-foreground">$ {formatAmount(peajeTotal.recargasRfid)}</td>
                              <td className="px-3 py-2 text-right text-sm font-extrabold tabular-nums text-muted-foreground">$ {formatAmount(peajeTotal.sobrante)}</td>
                              <td className="px-3 py-2 text-right text-sm font-extrabold tabular-nums text-muted-foreground">$ {formatAmount(peajeTotal.notasCredito)}</td>
                              <td className="px-3 py-2 text-right text-sm font-extrabold tabular-nums text-foreground">$ {formatAmount(peajeTotal.totalEfectivo)}</td>
                              <td className="px-3 py-2 text-right text-sm font-extrabold tabular-nums text-foreground">$ {formatAmount(peajeTotal.recaudaCheque)}</td>
                              <td className="px-3 py-2 text-right text-sm font-extrabold tabular-nums text-foreground">
                                <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-400/25 bg-emerald-100 dark:bg-emerald-500/12 px-2 py-0.5 text-emerald-900 dark:text-emerald-300">
                                  $ {formatAmount(peajeTotal.totalDepositado)}
                                </span>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    {totalGeneral && (
                      <tr className="border-t-2 border-slate-200 bg-muted/40 text-foreground dark:border-border">
                        <th className="px-3 py-2 text-left text-sm font-semibold" colSpan={2}>Total general</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">$ {formatAmount(totalGeneral.recaudacionEfectivo)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">$ {formatAmount(totalGeneral.recargasRfid)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-muted-foreground">$ {formatAmount(totalGeneral.sobrante)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-muted-foreground">$ {formatAmount(totalGeneral.notasCredito)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">$ {formatAmount(totalGeneral.totalEfectivo)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">$ {formatAmount(totalGeneral.recaudaCheque)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">
                          <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-400/30 bg-emerald-100 dark:bg-emerald-500/12 px-2 py-0.5 text-emerald-900 dark:text-emerald-300">
                            $ {formatAmount(totalGeneral.totalDepositado)}
                          </span>
                        </th>
                      </tr>
                    )}
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





