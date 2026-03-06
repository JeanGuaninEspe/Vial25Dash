import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

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
import { apiFetch } from "@/lib/api"

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

  return (
    <div className="space-y-4">
      <div className="rounded-sm bg-[#555] px-4 py-1.5 text-center text-lg font-bold text-white">
        REPORTE DE TRÁNSITO POR AÑOS Y MESES
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          <div className="grid max-w-[520px] grid-cols-[150px_1fr] gap-0 border border-[#6b6b6b] bg-[#555] text-white">
            <p className="px-2 py-1 text-sm font-extrabold">ID_PEAJE</p>
            <Select value={idPeaje} onValueChange={setIdPeaje}>
              <SelectTrigger className="h-8 rounded-none border-0 border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
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

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">FORMA_PAGO</p>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
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

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">PORC_DESC</p>
            <Select value={porcDesc} onValueChange={setPorcDesc}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
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

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">ID_CATEGORIA</p>
            <Select value={idCategoria} onValueChange={setIdCategoria}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
                <SelectValue placeholder="Categoría" />
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
                    {anios.map((anio) => (
                      <th key={anio} className="px-2 py-1 text-right text-sm font-bold">
                        {anio}
                      </th>
                    ))}
                    <th className="px-2 py-1 text-right text-sm font-bold">TOTAL GENERAL</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((row) => (
                    <tr key={`${row.monthNumber}-${row.monthLabel}`} className="border-b bg-[#bfc8db]">
                      <td className="px-2 py-1 text-sm font-medium">{row.monthLabel}</td>
                      {anios.map((anio) => (
                        <td key={`${row.monthLabel}-${anio}`} className="px-2 py-1 text-right text-sm tabular-nums">
                          {numberFormatter.format(Number(row[`y${anio}`] ?? 0))}
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
                    {anios.map((anio) => (
                      <th key={`total-${anio}`} className="px-2 py-2 text-right text-base font-bold tabular-nums">
                        {numberFormatter.format(totalesPorAnio[anio] ?? 0)}
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
        GRÁFICO ESTADÍSTICO DE TRÁNSITO POR AÑOS Y MESES
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader className="items-center text-center pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">{reportTitle}</CardTitle>
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
    </div>
  )
}
