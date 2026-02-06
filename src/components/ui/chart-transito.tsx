import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, LabelList } from "recharts"

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

export const description = "Transito vehicular por peaje"

type TransitoAggregates = {
  totalTransitos: number
  porHora: { hora: string; cantidad: number }[]
  porHoraDia: { fecha: string; horas: { hora: string; cantidad: number }[] }[]
}

type TransitoResponse = {
  data: unknown[]
  aggregates?: TransitoAggregates | null
}

type ChartRow = {
  date: string
  congoma: number
  losAngeles: number
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL 
const ENDPOINT = "/transitos"

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

export function ChartTransito() {
  const [timeRange, setTimeRange] = React.useState("90d")
  const [turno, setTurno] = React.useState("all")
  const [data, setData] = React.useState<ChartRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        // Construir parámetros base según timeRange
        const baseParams = new URLSearchParams()
        
        if (timeRange === "7d") {
          baseParams.append("rango", "ultimos7d")
          baseParams.append("take", "50000")
        } else if (timeRange === "30d") {
          baseParams.append("rango", "ultimoMes")
          baseParams.append("take", "50000")
        } else if (timeRange === "mesActual") {
          baseParams.append("rango", "mesActual")
          baseParams.append("take", "50000")
        } else {
          baseParams.append("take", "50000")
        }

        if (turno !== "all") {
          baseParams.append("turno", turno)
        }

        // Hacer dos llamadas paralelas, una por cada peaje
        const paramsConoma = new URLSearchParams(baseParams)
        paramsConoma.append("nombrePeaje", "CONGOMA")
        
        const paramsLosAngeles = new URLSearchParams(baseParams)
        paramsLosAngeles.append("nombrePeaje", "LOS ANGELES")

        const urlConoma = `${BASE_URL}${ENDPOINT}?${paramsConoma.toString()}`
        const urlLosAngeles = `${BASE_URL}${ENDPOINT}?${paramsLosAngeles.toString()}`
        
        const [responseConoma, responseLosAngeles] = await Promise.all([
          fetch(urlConoma),
          fetch(urlLosAngeles)
        ])
        
        if (!responseConoma.ok || !responseLosAngeles.ok) {
          throw new Error(`Error ${!responseConoma.ok ? responseConoma.status : responseLosAngeles.status}`)
        }
        
        const [jsonConoma, jsonLosAngeles] = await Promise.all([
          responseConoma.json() as Promise<TransitoResponse>,
          responseLosAngeles.json() as Promise<TransitoResponse>
        ])
        
        if (isMounted) {
          const combined = new Map<string, ChartRow>()

          const applyAggregates = (aggregates: TransitoAggregates | null | undefined, key: "congoma" | "losAngeles") => {
            if (!aggregates?.porHoraDia?.length) return
            aggregates.porHoraDia.forEach((entry) => {
              entry.horas.forEach((horaEntry) => {
                const dateKey = `${entry.fecha}T${horaEntry.hora}:00`
                const current = combined.get(dateKey) || {
                  date: dateKey,
                  congoma: 0,
                  losAngeles: 0,
                }
                current[key] += horaEntry.cantidad
                combined.set(dateKey, current)
              })
            })
          }

          applyAggregates(jsonConoma.aggregates, "congoma")
          applyAggregates(jsonLosAngeles.aggregates, "losAngeles")

          const result = Array.from(combined.values()).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )
          setData(result)
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

  const hasNoData = !loading && !data.length

  return (
    <Card className="pt-0 mt-6">
      <CardHeader className="flex flex-col gap-3 border-b py-5 sm:flex-row sm:items-center sm:gap-4">
        <div className="grid flex-1 gap-1">
          <CardTitle>Tránsito Vehicular</CardTitle>
          <CardDescription>
            Cantidad de vehículos por día (Congoma vs Los Angeles)
          </CardDescription>
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
        {loading && (
          <div className="space-y-3">
            <div className="flex justify-between px-4">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-[260px] bg-muted animate-pulse rounded" />
          </div>
        )}
        {error && !loading && (
          <p className="text-sm text-destructive px-4">{error}</p>
        )}
        {hasNoData && (
          <p className="text-sm text-muted-foreground px-4">
            No hay datos para los filtros seleccionados.
          </p>
        )}
        {!loading && !error && data.length > 0 && (
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillCongomaTransito" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-congoma)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-congoma)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillLosAngelesTransito" x1="0" y1="0" x2="0" y2="1">
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
                minTickGap={60}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  // Mostrar solo hora si es el mismo día, sino fecha + hora
                  const now = new Date()
                  const isToday = date.toDateString() === now.toDateString()
                  
                  if (isToday) {
                    return date.toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  
                  return date.toLocaleDateString("es-ES", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${value}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleString("es-ES", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                    formatter={(val, name) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-mono font-medium">{Number(val).toLocaleString()} veh/hora</span>
                      </div>
                    )}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="congoma"
                type="natural"
                fill="url(#fillCongomaTransito)"
                stroke="var(--color-congoma)"
                name="Congoma"
              />
              <Area
                dataKey="losAngeles"
                type="natural"
                fill="url(#fillLosAngelesTransito)"
                stroke="var(--color-losAngeles)"
                name="Los Angeles"
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
