import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { TrendingUp, TrendingDown } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

export const description = "Recaudacion por peaje"

type ApiRow = {
  NUM_SEMANA: number
  FECHA_HORARIO: string
  dia: number
  mes: string
  YEAR: number
  NOMBRE_PEAJE: string
  TURNO: number
  TOTAL_DEPOSITADO: string
}

type RecaudacionAggregates = {
  totalesPorDia: { fecha: string; congoma: number; losAngeles: number }[]
  totalPeriodo: { congoma: number; losAngeles: number }
  totalGeneral: number
  changePercent: number
  arrow: "up" | "down"
  footer: string
}

type RecaudacionResponse = {
  data: ApiRow[]
  aggregates?: RecaudacionAggregates | null
}

type ChartRow = {
  date: string
  congoma: number
  losAngeles: number
}

type ApiComparison = {
  actual: { data: ApiRow[]; total: number }
  anterior: { data: ApiRow[]; total: number }
  changePercent: number
  footer: string
  arrow: string
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/recaudacion"

const chartConfig = {
  congoma: {
    label: "Congoma",
    color: "var(--chart-1)",
  },
  losAngeles: {
    label: "Los Angeles",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const [timeRange, setTimeRange] = React.useState("90d")
  const [turno, setTurno] = React.useState("all")
  const includeData = false
  const [aggregates, setAggregates] = React.useState<RecaudacionAggregates | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()

        let rangoParam = ""
        if (timeRange === "7d") {
          rangoParam = "ultimos7dAnterior"
          params.append("take", "1000")
        } else if (timeRange === "30d") {
          rangoParam = "ultimoMesAnterior"
          params.append("take", "2000")
        } else if (timeRange === "90d") {
          rangoParam = "ultimos90dAnterior"
          params.append("take", "5000")
        } else if (timeRange === "mesActual") {
          rangoParam = "mesActual"
          params.append("take", "2000")
        }

        if (turno !== "all") {
          params.append("turno", turno)
        }

        if (includeData) {
          params.append("includeData", "true")
        }

        params.append("rango", rangoParam)
        const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Error ${response.status}`)
        }
        const json = (await response.json()) as ApiComparison | RecaudacionResponse
        const aggregatesPayload = "aggregates" in json ? json.aggregates ?? null : null

        if (isMounted) {
          setAggregates(aggregatesPayload)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error inesperado")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [timeRange, turno])

  const chartData = React.useMemo<ChartRow[]>(() => {
    if (!aggregates?.totalesPorDia?.length) return []

    return aggregates.totalesPorDia
      .map((row) => ({
        date: row.fecha,
        congoma: row.congoma,
        losAngeles: row.losAngeles,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [aggregates])

  const comparison = React.useMemo(() => {
    if (!aggregates) return null

    const isPositive = aggregates.arrow === "up"

    return {
      isPositive,
      label: aggregates.footer,
    }
  }, [aggregates])

  const totalesPeriodo = React.useMemo(() => {
    if (!aggregates) return null

    const congoma = aggregates.totalPeriodo.congoma
    const losAngeles = aggregates.totalPeriodo.losAngeles

    return { congoma, losAngeles, total: aggregates.totalGeneral }
  }, [aggregates])

  const hasNoData = !loading && !chartData.length

  return (
    <Card className="pt-0">
      <CardHeader className="flex flex-col gap-3 border-b py-5 sm:flex-row sm:items-center sm:gap-4">
        <div className="grid flex-1 gap-1">
          <CardTitle>Recaudacion Total Depositado</CardTitle>
          <CardDescription>
            Comparativo diario por peaje
          </CardDescription>
          {totalesPeriodo && (
            <div className="flex gap-4 mt-3">
              <div className="flex flex-col gap-1 rounded-lg border bg-card p-3 shadow-sm min-w-[180px]">
                <span className="text-xs text-muted-foreground font-medium">Congoma</span>
                <span className="text-2xl font-bold">${totalesPeriodo.congoma.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border bg-card p-3 shadow-sm min-w-[180px]">
                <span className="text-xs text-muted-foreground font-medium">Los Angeles</span>
                <span className="text-2xl font-bold">${totalesPeriodo.losAngeles.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px] rounded-lg" aria-label="Rango de tiempo">
              <SelectValue placeholder="Ultimos 90 dias" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="mesActual" className="rounded-lg">
                Mes actual
              </SelectItem>
              <SelectItem value="90d" className="rounded-lg">
                Ultimos 90 dias
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Ultimos 30 dias
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Ultimos 7 dias
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={turno} onValueChange={setTurno}>
            <SelectTrigger className="w-[140px] rounded-lg" aria-label="Turno">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">
                Todos los turnos
              </SelectItem>
              <SelectItem value="1" className="rounded-lg">
                Turno 1
              </SelectItem>
              <SelectItem value="2" className="rounded-lg">
                Turno 2
              </SelectItem>
              <SelectItem value="3" className="rounded-lg">
                Turno 3
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading && <p className="text-sm text-muted-foreground px-4">Cargando recaudacion...</p>}
        {error && !loading && (
          <p className="text-sm text-destructive px-4">{error}</p>
        )}
        {hasNoData && (
          <p className="text-sm text-muted-foreground px-4">
            No hay datos para los filtros seleccionados.
          </p>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillCongoma" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-congoma)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-congoma)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillLosAngeles" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-losAngeles)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-losAngeles)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value + "T12:00:00")
                  return date.toLocaleDateString("es-ES", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value + "T12:00:00").toLocaleDateString("es-ES", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    formatter={(val, name) => (
                      <div className="flex w-full justify-between">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono font-medium">{Number(val).toLocaleString()}</span>
                      </div>
                    )}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="congoma"
                type="natural"
                fill="url(#fillCongoma)"
                stroke="var(--color-congoma)"
                stackId="a"
                name="Congoma"
              />
              <Area
                dataKey="losAngeles"
                type="natural"
                fill="url(#fillLosAngeles)"
                stroke="var(--color-losAngeles)"
                stackId="a"
                name="Los Angeles"
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
      {!loading && !error && comparison && (
        <CardFooter className="flex-col gap-2 text-sm pt-4 border-t">
          <div className="flex items-center gap-2 leading-none font-medium">
            {comparison.isPositive ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-green-600">{comparison.label}</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-red-600">{comparison.label}</span>
              </>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  )
}
