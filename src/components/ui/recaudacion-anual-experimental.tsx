import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { apiFetch } from "@/lib/api"

type AnualMesFila = {
  mesNumero: number
  mes: string
  valores: Record<string, number>
  totalGeneral: number
}

type AnualSemanaFila = {
  semana: number
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
  filasSemanales: AnualSemanaFila[]
  totalPorAnio: TotalPorAnio[]
  totalGeneral: number
}

type PivotMonthRow = {
  monthLabel: string
  monthNumber: number
  totalGeneral: number
  [key: string]: string | number
}

type WeeklyDetailRow = {
  semana: number
  anio: number
  recaudacionEfectivo: number
  recargasTagEfectivo: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaDeposTransf: number
  totalRecaudado: number
}

type RecaudacionDiarioTotalGeneral = {
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

type RecaudacionDiarioResponse = {
  totalGeneral?: RecaudacionDiarioTotalGeneral
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/recaudacion/anual"
const DAILY_ENDPOINT = "/recaudacion/reporte-diario-peajes"
const CACHE_PREFIX = "recaudacion-anual-exp-cache-v1:"
const CACHE_EXPIRY_MS = 30 * 60 * 1000
const DEFAULT_TIMEOUT_MS = "60000"

const numberFormatter = new Intl.NumberFormat("es-EC", {
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
    // Ignorar errores de caché
  }
}

export function RecaudacionAnualExperimental() {
  const now = React.useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()

  const [anio, setAnio] = React.useState("all")
  const [nombrePeaje, setNombrePeaje] = React.useState("all")
  const [tipoMonto, setTipoMonto] = React.useState("totalDepositado")

  const [anios, setAnios] = React.useState<number[]>([])
  const [filasMensuales, setFilasMensuales] = React.useState<AnualMesFila[]>([])
  const [filasSemanales, setFilasSemanales] = React.useState<AnualSemanaFila[]>([])
  const [weeklyDetailRows, setWeeklyDetailRows] = React.useState<WeeklyDetailRow[]>([])
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

    const fetchAnual = async (params: URLSearchParams) => {
      const queryString = params.toString()
      const cacheKey = `anual:${queryString}`
      const cachedPayload = getCachedItem<RecaudacionAnualResponse>(cacheKey)
      if (cachedPayload) return cachedPayload

      const response = await apiFetch(`${BASE_URL}${ENDPOINT}?${queryString}`)
      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }
      const json = (await response.json()) as RecaudacionAnualResponse
      setCachedItem(cacheKey, json)
      return json
    }

    const fetchDiarioWeek = async (yearValue: number, weekValue: number, peajeValue: string) => {
      const params = new URLSearchParams()
      params.append("anio", String(yearValue))
      params.append("numSemana", String(weekValue))
      if (peajeValue !== "all") {
        params.append("nombrePeaje", peajeValue)
      }

      const queryString = params.toString()
      const cacheKey = `diario-week:${queryString}`
      const cachedPayload = getCachedItem<RecaudacionDiarioResponse>(cacheKey)
      if (cachedPayload) return cachedPayload

      const response = await apiFetch(`${BASE_URL}${DAILY_ENDPOINT}?${queryString}`)
      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }

      const json = (await response.json()) as RecaudacionDiarioResponse
      setCachedItem(cacheKey, json)
      return json
    }

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const buildParams = (tipoMontoValue: string) => {
          const params = new URLSearchParams()
          params.append("timeoutMs", DEFAULT_TIMEOUT_MS)
          params.append("tipoMonto", tipoMontoValue)

          if (anio !== "all") {
            params.append("anio", anio)
          }

          if (nombrePeaje !== "all") {
            params.append("nombrePeaje", nombrePeaje)
          }

          return params
        }

        const payload = await fetchAnual(buildParams(tipoMonto))

        let detailRows: WeeklyDetailRow[] = []
        if (anio !== "all") {
          const selectedYear = Number(anio)
          if (!Number.isNaN(selectedYear)) {
            const weekNumbers = Array.from(new Set((payload.filasSemanales ?? []).map((row) => row.semana))).sort(
              (a, b) => a - b
            )

            const weeklyTotals = await Promise.all(
              weekNumbers.map(async (weekValue) => {
                const diario = await fetchDiarioWeek(selectedYear, weekValue, nombrePeaje)
                const total = diario.totalGeneral

                return {
                  semana: weekValue,
                  anio: selectedYear,
                  recaudacionEfectivo: total?.recaudacionEfectivo ?? 0,
                  recargasTagEfectivo: total?.recargasRfid ?? 0,
                  sobrante: total?.sobrante ?? 0,
                  notasCredito: total?.notasCredito ?? 0,
                  totalEfectivo: total?.totalEfectivo ?? 0,
                  recaudaDeposTransf: total?.recaudaCheque ?? 0,
                  totalRecaudado: total?.totalDepositado ?? 0,
                } satisfies WeeklyDetailRow
              })
            )

            detailRows = weeklyTotals
          }
        }

        if (!isMounted) return

        setAnios(payload.anios ?? [])
        setFilasMensuales(payload.filas ?? [])
        setFilasSemanales(payload.filasSemanales ?? [])
        setWeeklyDetailRows(detailRows)
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
        setFilasSemanales([])
        setWeeklyDetailRows([])
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
          row[`y${yearValue}`] = fila.valores?.[String(yearValue)] ?? 0
        })

        return row
      })
  }, [filasMensuales, anios])

  const weeklyRows = React.useMemo(() => {
    return [...filasSemanales].sort((a, b) => a.semana - b.semana)
  }, [filasSemanales])

  const isSingleYearView = anios.length === 1
  const singleYear = isSingleYearView ? anios[0] : null

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

  const metricTitle = tipoMontoOptions.find((item) => item.value === tipoMonto)?.label ?? "TOTAL RECAUDADO"

  return (
    <div className="space-y-4">
      <div className="rounded-sm bg-[#555] px-4 py-1.5 text-center text-lg font-bold text-white">
        REPORTE DE RECAUDACIÓN ANUAL POR MESES
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          <div className="grid max-w-[520px] grid-cols-[150px_1fr] gap-0 border border-[#6b6b6b] bg-[#555] text-white">
            <p className="px-2 py-1 text-sm font-extrabold">AÑO</p>
            <Select value={anio} onValueChange={setAnio}>
              <SelectTrigger className="h-8 rounded-none border-0 border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
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

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">NOMBRE_PEAJE</p>
            <Select value={nombrePeaje} onValueChange={setNombrePeaje}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
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

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">TIPO_MONTO</p>
            <Select value={tipoMonto} onValueChange={setTipoMonto}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
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
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          {loading && <p className="px-3 py-3 text-sm text-muted-foreground">Cargando reporte...</p>}
          {error && !loading && <p className="px-3 py-3 text-sm text-destructive">{error}</p>}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="bg-[#555] text-white">
                  <tr>
                    <th className="px-2 py-1 text-left text-sm font-bold">MES</th>
                    {anios.map((yearValue) => (
                      <th key={yearValue} className="px-2 py-1 text-right text-sm font-bold">
                        {yearValue}
                      </th>
                    ))}
                    <th className="px-2 py-1 text-right text-sm font-bold">TOTAL GENERAL</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((row) => (
                    <tr key={`${row.monthNumber}-${row.monthLabel}`} className="border-b bg-[#bfc8db]">
                      <td className="px-2 py-1 text-sm font-medium">{row.monthLabel}</td>
                      {anios.map((yearValue) => (
                        <td key={`${row.monthLabel}-${yearValue}`} className="px-2 py-1 text-right text-sm tabular-nums">
                          {numberFormatter.format(Number(row[`y${yearValue}`] ?? 0))}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right text-sm font-semibold tabular-nums">
                        {numberFormatter.format(Number(row.totalGeneral ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#213764] text-white">
                    <th className="px-2 py-2 text-left text-base font-bold">Total general</th>
                    {anios.map((yearValue) => (
                      <th key={`total-${yearValue}`} className="px-2 py-2 text-right text-base font-bold tabular-nums">
                        {numberFormatter.format(totalesPorAnio[yearValue] ?? 0)}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right text-base font-bold tabular-nums">
                      {numberFormatter.format(totalGeneral)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-sm bg-[#555] px-4 py-1.5 text-center text-lg font-bold text-white">
        REPORTE SEMANAL (1-53)
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          {!loading && !error && (
            <div className="overflow-x-auto">
              {isSingleYearView && singleYear ? (
                <table className="w-full min-w-[1220px]">
                  <thead className="bg-[#b9c8d6] text-black">
                    <tr>
                      <th className="px-2 py-1 text-left text-sm font-bold" colSpan={2}>
                        Valores
                      </th>
                      <th className="px-2 py-1 text-right text-sm font-bold">RECAUDACIÓN EFECTIVO</th>
                      <th className="px-2 py-1 text-right text-sm font-bold">RECARGAS TAG Efectivo</th>
                      <th className="px-2 py-1 text-right text-sm font-bold">SOBRANTE</th>
                      <th className="px-2 py-1 text-right text-sm font-bold">(-) NOTAS CRÉDITO</th>
                      <th className="bg-[#efe3bf] px-2 py-1 text-right text-sm font-bold">TOTAL EFECTIVO</th>
                      <th className="px-2 py-1 text-right text-sm font-bold">RECAUDACIÓN Depos-Transf</th>
                      <th className="bg-[#efe3bf] px-2 py-1 text-right text-sm font-bold">TOTAL RECAUDADO</th>
                    </tr>
                    <tr className="border-t border-black/15">
                      <th className="px-2 py-1 text-left text-sm font-extrabold">AÑO</th>
                      <th className="px-2 py-1 text-left text-sm font-extrabold">SEMANA</th>
                      <th className="px-2 py-1" />
                      <th className="px-2 py-1" />
                      <th className="px-2 py-1" />
                      <th className="px-2 py-1" />
                      <th className="bg-[#efe3bf] px-2 py-1" />
                      <th className="px-2 py-1" />
                      <th className="bg-[#efe3bf] px-2 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyDetailRows.map((row, index) => {
                      return (
                        <tr key={`wk-${row.semana}`} className="border-b bg-[#bfc8db]">
                          <td className="px-2 py-1 text-sm font-bold">{index === 0 ? singleYear : ""}</td>
                          <td className="px-2 py-1 text-sm font-medium">{row.semana}</td>
                          <td className="px-2 py-1 text-right text-sm tabular-nums">
                            {numberFormatter.format(row.recaudacionEfectivo)}
                          </td>
                          <td className="px-2 py-1 text-right text-sm tabular-nums">
                            {numberFormatter.format(row.recargasTagEfectivo)}
                          </td>
                          <td className="px-2 py-1 text-right text-sm tabular-nums">
                            {numberFormatter.format(row.sobrante)}
                          </td>
                          <td className="px-2 py-1 text-right text-sm tabular-nums">
                            {numberFormatter.format(row.notasCredito)}
                          </td>
                          <td className="bg-[#efe3bf] px-2 py-1 text-right text-sm font-semibold tabular-nums">
                            {numberFormatter.format(row.totalEfectivo)}
                          </td>
                          <td className="px-2 py-1 text-right text-sm tabular-nums">
                            {numberFormatter.format(row.recaudaDeposTransf)}
                          </td>
                          <td className="bg-[#efe3bf] px-2 py-1 text-right text-sm font-semibold tabular-nums">
                            {numberFormatter.format(row.totalRecaudado)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[920px]">
                  <thead className="bg-[#b9c8d6] text-black">
                    <tr>
                      <th className="px-2 py-1 text-left text-sm font-bold">SEMANA</th>
                      {anios.map((yearValue) => (
                        <th key={`w-${yearValue}`} className="px-2 py-1 text-right text-sm font-bold">
                          {yearValue}
                        </th>
                      ))}
                      <th className="bg-[#efe3bf] px-2 py-1 text-right text-sm font-bold">TOTAL RECAUDADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyRows.map((row) => (
                      <tr key={`wk-${row.semana}`} className="border-b bg-[#bfc8db]">
                        <td className="px-2 py-1 text-sm font-medium">Semana {row.semana}</td>
                        {anios.map((yearValue) => (
                          <td key={`wk-${row.semana}-${yearValue}`} className="px-2 py-1 text-right text-sm tabular-nums">
                            {numberFormatter.format(Number(row.valores?.[String(yearValue)] ?? 0))}
                          </td>
                        ))}
                        <td className="bg-[#efe3bf] px-2 py-1 text-right text-sm font-semibold tabular-nums">
                          {numberFormatter.format(Number(row.totalGeneral ?? 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-sm bg-[#555] px-4 py-1.5 text-center text-lg font-bold text-white">
        GRÁFICO ESTADÍSTICO DE RECAUDACIÓN POR AÑOS Y MESES
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader className="items-center text-center pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Métrica: {metricTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Cargando gráfico...</p>}
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
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => numberFormatter.format(Number(value))}
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
                {anios.map((yearValue, index) => (
                  <Bar
                    key={yearValue}
                    dataKey={`y${yearValue}`}
                    name={String(yearValue)}
                    fill={`var(--color-y${yearValue})`}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  >
                    <LabelList
                      dataKey={`y${yearValue}`}
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
    </div>
  )
}
