import * as React from "react"
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"
import { getISOWeek } from "date-fns"

import {
  Card,
  CardContent,
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
import { apiFetch } from "@/lib/api"

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

  const [year, setYear] = React.useState(String(currentYear))
  const [month, setMonth] = React.useState("all")
  const [semana, setSemana] = React.useState("all")
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
        const range = month === "all"
          ? buildYearRange(selectedYear, now)
          : buildMonthRange(selectedYear, selectedMonth)

        const rowsCacheKey = `rows:${year}:${month}:${formaPago}`
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
  }, [year, month, formaPago])

  const weekOptions = React.useMemo(() => {
    return Array.from(new Set(rows.map((row) => getIsoWeekFromFecha(row.fecha)))).sort((a, b) => a - b)
  }, [rows])

  const isMonthLocked = semana !== "all"
  const isWeekLocked = month !== "all"

  React.useEffect(() => {
    if (semana === "all") return
    if (!weekOptions.includes(Number(semana))) {
      setSemana("all")
    }
  }, [semana, weekOptions])

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

  const selectedMonthLabel = monthOptions.find((option) => option.value === month)?.label ?? month
  const hasNoData = !loading && !error && filteredRows.length === 0
  const fromDate = filteredRows[0]?.fecha
  const toDate = filteredRows[filteredRows.length - 1]?.fecha

  return (
    <div className="space-y-4">
      <div className="rounded-sm bg-[#555] px-4 py-1.5 text-center text-lg font-bold text-white">
        REPORTE DE TPDA PEAJES CÓNGOMA Y LOS ANGELES
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          <div className="grid max-w-[520px] grid-cols-[150px_1fr] gap-0 border border-[#6b6b6b] bg-[#555] text-white">
            <p className="px-2 py-1 text-sm font-extrabold">AÑO</p>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-8 rounded-none border-0 border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
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

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">MES</p>
            <Select
              value={month}
              onValueChange={(value) => {
                setMonth(value)
                if (value !== "all") setSemana("all")
              }}
              disabled={isMonthLocked}
            >
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0 disabled:opacity-60">
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

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">SEMANA</p>
            <Select
              value={semana}
              onValueChange={(value) => {
                setSemana(value)
                if (value !== "all") setMonth("all")
              }}
              disabled={isWeekLocked}
            >
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0 disabled:opacity-60">
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

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">FORMA_PAGO</p>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
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
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          {loading && <p className="px-3 py-3 text-sm text-muted-foreground">Cargando datos...</p>}
          {error && !loading && <p className="px-3 py-3 text-sm text-destructive">{error}</p>}
          {hasNoData && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No hay datos disponibles para los filtros seleccionados.
            </p>
          )}

          {!loading && !error && filteredRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-[#555] text-white">
                  <tr>
                    <th className="px-2 py-1 text-left text-sm font-bold">FECHA_EVENTO</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">CÓNGOMA</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">LOS ANGELES</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">TOTAL GENERAL</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const totalDia = row.congoma + row.losAngeles
                    return (
                      <tr key={row.fecha} className="border-b bg-[#bfc8db]">
                        <td className="px-2 py-1 text-sm font-medium">{row.fecha}</td>
                        <td className="px-2 py-1 text-right text-sm tabular-nums">
                          {numberFormatter.format(row.congoma)}
                        </td>
                        <td className="px-2 py-1 text-right text-sm tabular-nums">
                          {numberFormatter.format(row.losAngeles)}
                        </td>
                        <td className="px-2 py-1 text-right text-sm font-semibold tabular-nums">
                          {numberFormatter.format(totalDia)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#213764] text-white">
                    <th className="px-2 py-2 text-left text-base font-bold">Total general</th>
                    <th className="px-2 py-2 text-right text-base font-bold tabular-nums">
                      {numberFormatter.format(totals.congoma)}
                    </th>
                    <th className="px-2 py-2 text-right text-base font-bold tabular-nums">
                      {numberFormatter.format(totals.losAngeles)}
                    </th>
                    <th className="px-2 py-2 text-right text-base font-bold tabular-nums">
                      {numberFormatter.format(totals.general)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-sm bg-[#555] px-4 py-1.5 text-center text-lg font-bold text-white">
        TOTAL TRÁNSITO DIARIO PEAJES CÓNGOMA Y LOS ANGELES
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader className="items-center text-center pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            {fromDate && toDate
              ? `De ${fromDate.split("-").reverse().join("/")} a ${toDate.split("-").reverse().join("/")}`
              : month === "all"
                ? `Año ${year}`
                : `Mes de ${selectedMonthLabel} ${year}`}
          </CardTitle>
          <div className="flex items-center justify-center gap-6 text-sm font-semibold">
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
          {loading && <p className="text-sm text-muted-foreground">Cargando gráfico...</p>}
          {!loading && !error && filteredRows.length > 0 && (
            <ChartContainer config={chartConfig} className="h-[500px] w-full">
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
