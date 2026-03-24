import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { getISOWeek, getISOWeeksInYear, startOfISOWeekYear } from "date-fns"
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
import { Area, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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

type RecaudacionTotalGeneral = {
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

type RecaudacionAcumuladaDia = {
  fecha: string
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
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/recaudacion/reporte-diario-peajes"
const CACHE_PREFIX = "recaudacion-diario-acumulado-exp-v1:"
const CACHE_EXPIRY_MS = 30 * 60 * 1000

const amountFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("es-EC")

const chartConfig = {
  totalEfectivo: {
    label: "TOTAL EFECTIVO",
    color: "var(--chart-1)",
  },
  totalDepositado: {
    label: "TOTAL RECAUDADO",
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

export function RecaudacionReporteDiarioAcumuladoExperimental() {
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

        // Obtener semana anterior
        const prevWeekYear = selectedWeek > 1 ? selectedYear : selectedYear - 1
        const prevWeekValue = selectedWeek > 1 
          ? selectedWeek - 1 
          : getISOWeeksInYear(new Date(`${selectedYear - 1}-06-15T00:00:00`))
        const prevWeekPayload = await fetchWeek(prevWeekYear, prevWeekValue)

        const weeksInSelectedYear = getISOWeeksInYear(new Date(`${selectedYear}-06-15T00:00:00`))
        const nextWeekYear = selectedWeek < weeksInSelectedYear ? selectedYear : selectedYear + 1
        const nextWeekValue = selectedWeek < weeksInSelectedYear ? selectedWeek + 1 : 1
        const nextWeekPayload = await fetchWeek(nextWeekYear, nextWeekValue)

        // CASO ESPECIAL: Si es semana 1, el backend podria haber asignado los ultimos dias de diciembre
        // al (año previo, sem 1) o (año previo, sem 53) dependiendo del motor de SQL.
        let extraPayload1 = { data: [] as RecaudacionDetalle[] }
        let extraPayload53 = { data: [] as RecaudacionDetalle[] }
        if (selectedWeek === 1) {
          try { extraPayload1 = await fetchWeek(selectedYear - 1, 1) } catch { /* ignore */ }
          try { extraPayload53 = await fetchWeek(selectedYear - 1, 53) } catch { /* ignore */ }
        }

        const mergedDataMap = new Map<string, RecaudacionDetalle>()
        ;[
          ...prevWeekPayload.data, 
          ...currentWeekPayload.data, 
          ...nextWeekPayload.data,
          ...extraPayload1.data,
          ...extraPayload53.data
        ].forEach((row) => {
          const key = `${row.nombrePeaje}|${row.fecha}|${row.recaudacionEfectivo}|${row.totalDepositado}`
          mergedDataMap.set(key, row)
        })

        if (isMounted) {
          setPayload({ data: Array.from(mergedDataMap.values()) })
        }
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

  const acumuladoPorFecha = React.useMemo<RecaudacionAcumuladaDia[]>(() => {
    const map = new Map<string, RecaudacionAcumuladaDia>()

    isoFilteredRows.forEach((row) => {
      const current = map.get(row.fecha) ?? {
        fecha: row.fecha,
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
      map.set(row.fecha, current)
    })

    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [isoFilteredRows])

  const totalGeneral = React.useMemo<RecaudacionTotalGeneral | null>(() => {
    if (acumuladoPorFecha.length === 0) return null

    return acumuladoPorFecha.reduce<RecaudacionTotalGeneral>(
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
  }, [acumuladoPorFecha])

  const averageTotalDepositado = React.useMemo(() => {
    if (acumuladoPorFecha.length === 0) return null
    const total = acumuladoPorFecha.reduce((acc, row) => acc + row.totalDepositado, 0)
    return total / acumuladoPorFecha.length
  }, [acumuladoPorFecha])

  const kpi = React.useMemo(() => {
    const total = totalGeneral?.totalDepositado ?? 0
    const avgByDay = acumuladoPorFecha.length ? total / acumuladoPorFecha.length : 0
    const topDay = acumuladoPorFecha.reduce(
      (acc, row) => (row.totalDepositado > acc.totalDepositado ? row : acc),
      { fecha: "-", totalDepositado: 0 } as Pick<RecaudacionAcumuladaDia, "fecha" | "totalDepositado">
    )

    // Calculo de semana pasada
    const prevTotal = prevWeekFilteredRows.reduce((sum, r) => sum + r.totalDepositado, 0)
    
    // Agrupar por dia para la semana pasada para promedio diario
    const prevDatesSet = new Set(prevWeekFilteredRows.map(r => r.fecha))
    const prevDatesCount = prevDatesSet.size || 1
    const prevAvgByDay = prevTotal / prevDatesCount

    const maxDailyPrevIter = Array.from(prevDatesSet.values()).reduce((max, fecha) => {
      const dayTotal = prevWeekFilteredRows.filter(r => r.fecha === fecha).reduce((s, r)=> s + r.totalDepositado, 0)
      return dayTotal > max ? dayTotal : max
    }, 0)

    const variationTotal = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
    const variationAvg = prevAvgByDay > 0 ? ((avgByDay - prevAvgByDay) / prevAvgByDay) * 100 : 0
    const variationTop = maxDailyPrevIter > 0 ? ((topDay.totalDepositado - maxDailyPrevIter) / maxDailyPrevIter) * 100 : 0

    return {
      total,
      avgByDay,
      topDate: topDay.fecha,
      topValue: topDay.totalDepositado,
      showVariation: prevTotal > 0,
      variationTotal,
      variationAvg,
      variationTop
    }
  }, [totalGeneral, acumuladoPorFecha, prevWeekFilteredRows])

  const highlightedIndexesByKey = React.useMemo(() => {
    const buildIndexSet = (key: "totalEfectivo" | "totalDepositado") => {
      const set = new Set<number>()
      if (acumuladoPorFecha.length === 0) return set

      set.add(acumuladoPorFecha.length - 1)

      let maxIndex = 0
      let minIndex = 0

      acumuladoPorFecha.forEach((row, index) => {
        if (row[key] > acumuladoPorFecha[maxIndex][key]) maxIndex = index
        if (row[key] < acumuladoPorFecha[minIndex][key]) minIndex = index
      })

      set.add(maxIndex)
      set.add(minIndex)
      return set
    }

    return {
      totalEfectivo: buildIndexSet("totalEfectivo"),
      totalDepositado: buildIndexSet("totalDepositado"),
    }
  }, [acumuladoPorFecha])

  const renderSparseLabel = React.useCallback(
    (props: any, seriesKey: "totalEfectivo" | "totalDepositado") => {
      const { index, value, x, y, stroke } = props
      const xPos = typeof x === "number" ? x : Number(x)
      const yPos = typeof y === "number" ? y : Number(y)
      if (
        typeof index !== "number" ||
        Number.isNaN(xPos) ||
        Number.isNaN(yPos)
      ) {
        return null
      }

      if (!highlightedIndexesByKey[seriesKey].has(index)) return null

      const row = acumuladoPorFecha[index]
      const otherKey = seriesKey === "totalEfectivo" ? "totalDepositado" : "totalEfectivo"
      const currentValue = Number(row?.[seriesKey] ?? 0)
      const otherValue = Number(row?.[otherKey] ?? 0)
      const isClose = Math.abs(currentValue - otherValue) < 3000

      const isFirstPoint = index === 0
      const isLastPoint = index === acumuladoPorFecha.length - 1

      let yOffset = seriesKey === "totalEfectivo" ? -10 : 16
      if (isClose) {
        yOffset += seriesKey === "totalEfectivo" ? -12 : 12
      }

      let xLabel = xPos
      let textAnchor: "start" | "middle" | "end" = "middle"

      if (isFirstPoint) {
        xLabel += 12
        textAnchor = "start"
      }

      if (isLastPoint) {
        xLabel -= 4
        textAnchor = "end"
      }

      return (
        <text
          x={xLabel}
          y={yPos + yOffset}
          textAnchor={textAnchor}
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
    [highlightedIndexesByKey, acumuladoPorFecha]
  )

  const sortedDates = React.useMemo(
    () => [...acumuladoPorFecha.map((row) => row.fecha)].sort((a, b) => a.localeCompare(b)),
    [acumuladoPorFecha]
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

  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 6 },
    show: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.012,
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
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Recaudación diaria acumulado
            </h2>
            <p className="text-sm text-muted-foreground">Acumulado semanal consolidado por fecha</p>
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
        <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-md">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peaje</label>
                <Select value={nombrePeaje} onValueChange={setNombrePeaje} disabled={loading}>
                  <SelectTrigger className="h-9 w-[180px] bg-background/60 text-xs transition-colors hover:bg-background/80">
                    <SelectValue placeholder="(Todas)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">(Todas)</SelectItem>
                    <SelectItem value="CONGOMA">CONGOMA</SelectItem>
                    <SelectItem value="LOS ANGELES">LOS ANGELES</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Año</label>
                <Select value={anio} onValueChange={setAnio} disabled={loading}>
                  <SelectTrigger className="h-9 w-[130px] bg-background/60 text-xs transition-colors hover:bg-background/80">
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semana</label>
                <Select value={numSemana} onValueChange={setNumSemana} disabled={loading}>
                  <SelectTrigger className="h-9 w-[130px] bg-background/60 text-xs transition-colors hover:bg-background/80">
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Turno</label>
                <Select value={turno} onValueChange={setTurno} disabled={loading}>
                  <SelectTrigger className="h-9 w-[130px] bg-background/60 text-xs transition-colors hover:bg-background/80">
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
                className="h-9 border-border/60 transition-colors hover:bg-accent hover:text-accent-foreground"
                disabled={loading}
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
          </CardContent>
        </Card>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Promedio por día</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
                  <Landmark className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                  {loading ? <Skeleton className="h-9 w-32" /> : `$ ${formatAmount(kpi.avgByDay)}`}
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Día destacado</CardTitle>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/25">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/70">
                    {loading ? <Skeleton className="h-7 w-24" /> : kpi.topDate}
                  </div>
                  {!loading && kpi.topValue > 0 && (
                    <span className="text-xl font-semibold text-amber-600 dark:text-amber-300">
                      $ {formatAmount(kpi.topValue)}
                    </span>
                  )}
                </div>
                {!loading && kpi.showVariation && kpi.topValue > 0 && (
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
                <CardTitle className="text-base">Total recaudación diaria</CardTitle>
                <p className="text-sm text-muted-foreground">Comparativo Total Efectivo vs Total Recaudado</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--chart-1)" }} />
                <span>TOTAL EFECTIVO</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--chart-2)" }} />
                <span>TOTAL RECAUDADO</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading && (
              <div className="flex h-[480px] w-full flex-col items-center justify-center gap-4">
                <Skeleton className="h-[400px] w-full rounded-xl" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            )}
            {error && !loading && (
              <div className="flex h-[480px] flex-col items-center justify-center text-center">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {!loading && !error && acumuladoPorFecha.length === 0 && (
              <div className="flex h-[480px] flex-col items-center justify-center text-center text-muted-foreground">
                <LineChartIcon className="mb-4 h-12 w-12 opacity-20" />
                <p>No hay datos de recaudación en este periodo.</p>
              </div>
            )}
            {!loading && !error && acumuladoPorFecha.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <ChartContainer config={chartConfig} className="h-[480px] w-full">
                  <ComposedChart
                    data={acumuladoPorFecha}
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
                          labelFormatter={(value) => `FECHA_EVENTO: ${formatShortDate(String(value))}`}
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
                      dataKey="totalEfectivo"
                      type="monotone"
                      stroke="none"
                      fill="var(--color-totalEfectivo)"
                      fillOpacity={0.12}
                      tooltipType="none"
                      isAnimationActive
                    />
                    <Area
                      dataKey="totalDepositado"
                      type="monotone"
                      stroke="none"
                      fill="var(--color-totalDepositado)"
                      fillOpacity={0.08}
                      tooltipType="none"
                      isAnimationActive
                    />
                    {averageTotalDepositado !== null && (
                      <ReferenceLine
                        y={averageTotalDepositado}
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
                      dataKey="totalEfectivo"
                      type="monotone"
                      stroke="var(--color-totalEfectivo)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="TOTAL EFECTIVO"
                      isAnimationActive
                    >
                      <LabelList
                        dataKey="totalEfectivo"
                        content={(props) => renderSparseLabel(props, "totalEfectivo")}
                      />
                    </Line>
                    <Line
                      dataKey="totalDepositado"
                      type="monotone"
                      stroke="var(--color-totalDepositado)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="TOTAL RECAUDADO"
                      isAnimationActive
                    >
                      <LabelList
                        dataKey="totalDepositado"
                        content={(props) => renderSparseLabel(props, "totalDepositado")}
                      />
                    </Line>
                  </ComposedChart>
                </ChartContainer>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card className="border-border/60 bg-card/80 shadow-[0_16px_40px_-30px_hsl(var(--foreground)/0.45)] transition-colors hover:border-primary/50">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Detalle diario acumulado</CardTitle>
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
            {!loading && !error && acumuladoPorFecha.length === 0 && (
              <div className="flex p-12 flex-col items-center justify-center text-center text-muted-foreground">
                <p>No se encontraron registros para generar este detalle.</p>
              </div>
            )}

            {!loading && !error && acumuladoPorFecha.length > 0 && (
              <div className="overflow-hidden rounded-b-xl">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/35 backdrop-blur">
                      <th rowSpan={2} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fecha</th>
                      <th colSpan={5} className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recaudación efectivo</th>
                      <th rowSpan={2} className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Depósitos</th>
                      <th rowSpan={2} className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Total día</th>
                    </tr>
                    <tr className="border-b border-border/60 bg-muted/30">
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Efectivo</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tag</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sobrante</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notas crédito</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total efectivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acumuladoPorFecha.map((row, index) => (
                      <motion.tr
                        key={row.fecha}
                        variants={rowVariants}
                        custom={index}
                        initial="hidden"
                        animate="show"
                        className={cn(
                          "border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30",
                          index % 2 === 0 ? "bg-card/40" : "bg-muted/20"
                        )}
                      >
                        <td className="px-3 py-2 text-sm text-foreground">
                          <span className="inline-flex rounded-md border border-border/50 bg-background/60 px-2 py-0.5 text-xs font-medium text-foreground/90">
                            {formatTableDate(row.fecha)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground/80">$ {formatAmount(row.recaudacionEfectivo)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground/80">$ {formatAmount(row.recargasRfid)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">$ {formatAmount(row.sobrante)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-muted-foreground">$ {formatAmount(row.notasCredito)}</td>
                        <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-foreground">$ {formatAmount(row.totalEfectivo)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-foreground/80">$ {formatAmount(row.recaudaCheque)}</td>
                        <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-emerald-300">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5">
                            <span>$ {formatAmount(row.totalDepositado)}</span>
                            {index > 0 && (
                              <span
                                className={cn(
                                  "inline-flex items-center",
                                  row.totalDepositado > acumuladoPorFecha[index - 1].totalDepositado
                                    ? "text-emerald-300"
                                    : row.totalDepositado < acumuladoPorFecha[index - 1].totalDepositado
                                      ? "text-rose-300"
                                      : "text-muted-foreground"
                                )}
                              >
                                {row.totalDepositado > acumuladoPorFecha[index - 1].totalDepositado
                                  ? <ArrowUp className="h-3 w-3" />
                                  : row.totalDepositado < acumuladoPorFecha[index - 1].totalDepositado
                                    ? <ArrowDown className="h-3 w-3" />
                                    : <Minus className="h-3 w-3" />}
                              </span>
                            )}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {totalGeneral && (
                      <tr className="border-t-2 border-border bg-muted/40 text-foreground">
                        <th className="px-3 py-2 text-left text-sm font-semibold">Total general</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">$ {formatAmount(totalGeneral.recaudacionEfectivo)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">$ {formatAmount(totalGeneral.recargasRfid)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-muted-foreground">$ {formatAmount(totalGeneral.sobrante)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-muted-foreground">$ {formatAmount(totalGeneral.notasCredito)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">$ {formatAmount(totalGeneral.totalEfectivo)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums">$ {formatAmount(totalGeneral.recaudaCheque)}</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-emerald-300">$ {formatAmount(totalGeneral.totalDepositado)}</th>
                      </tr>
                    )}
                  </tfoot>
                </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}




