import * as React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts"
import { addDays, format } from "date-fns"
import { type DateRange } from "react-day-picker"

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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { DatePickerWithRange } from "@/components/ui/range_picker"
import { apiFetch } from "@/lib/api"

export const description = "Ventas de TAG por peaje"

type VentaTagRow = {
  ID_CONCESION: number
  ID_PEAJE: number
  FECHA_FACTURA: string
  OBSERVACION: string
  USUARIO_CREACION: string
  FECHA_CREACION: string
  VALOR: number
  CLIENTE: string
  NUM_DOCUMENTO_CLIENTE: string
  NUMERO_FACTURA: string
  NOTA_CREDITO: string | null
  RETENCION: string | null
  FORMA_PAGO: string
}

type ApiComparison = {
  actual: { data: VentaTagRow[]; total: number }
  anterior: { data: VentaTagRow[]; total: number }
  changePercent: number
  footer: string
  arrow: string
}

type VentaTagAggregates = {
  totalPorPeaje: { congoma: number; losAngeles: number }
  totalGeneral: number
  cantidadTags: number
  changePercent: number
  arrow: "up" | "down"
  footer: string
}

type VentaTagResponse = {
  data: VentaTagRow[]
  aggregates?: VentaTagAggregates | null
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL 
const ENDPOINT = "/ventas-tag"

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

export function ChartRadialStacked() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -6),
    to: new Date(),
  })
  const includeData = false
  const [aggregates, setAggregates] = React.useState<VentaTagAggregates | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        
        if (dateRange?.from) {
          const desde = format(dateRange.from, "yyyy-MM-dd")
          const hasta = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : desde
          params.append("desde", desde)
          params.append("hasta", hasta)
        }

        if (includeData) {
          params.append("includeData", "true")
        }

        const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`
        const response = await apiFetch(url)
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}`)
        }
        const json = (await response.json()) as ApiComparison | VentaTagResponse
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
  }, [dateRange])

  const chartData = React.useMemo(() => {
    if (!aggregates) return null

    return [{
      congoma: aggregates.totalPorPeaje.congoma,
      losAngeles: aggregates.totalPorPeaje.losAngeles,
      total: aggregates.totalGeneral
    }]
  }, [aggregates])

  const totalVentas = chartData?.[0]?.total || 0
  const cantidadTags = aggregates?.cantidadTags ?? 0

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Ventas de TAG</CardTitle>
        <CardDescription>Distribución por peaje</CardDescription>
        <DatePickerWithRange
          value={dateRange}
          onChange={setDateRange}
          className="w-[240px] mt-2"
        />
      </CardHeader>
      <CardContent className="flex flex-1 items-center pb-0">
        {loading && <p className="text-sm text-muted-foreground">Cargando ventas...</p>}
        {error && !loading && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && chartData && (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square w-full max-w-[325px]"
          >
            <RadialBarChart
              data={chartData}
              endAngle={180}
              innerRadius={80}
              outerRadius={130}
            >
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) - 16}
                            className="fill-foreground text-2xl font-bold"
                          >
                            ${totalVentas.toFixed(2)}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 4}
                            className="fill-muted-foreground text-sm"
                          >
                            Total
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </PolarRadiusAxis>
              <RadialBar
                dataKey="congoma"
                stackId="a"
                cornerRadius={5}
                fill="var(--color-congoma)"
                className="stroke-transparent stroke-2"
              />
              <RadialBar
                dataKey="losAngeles"
                fill="var(--color-losAngeles)"
                stackId="a"
                cornerRadius={5}
                className="stroke-transparent stroke-2"
              />
            </RadialBarChart>
          </ChartContainer>
        )}
        {!loading && !error && !chartData && (
          <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          {cantidadTags} TAGs vendidos
        </div>
        {aggregates && (
          <div className="flex items-center gap-2 leading-none">
            {aggregates.arrow === "up" ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-green-600 text-s">
               {aggregates.footer}
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-red-600 text-s">
                 {aggregates.footer}
                </span>
              </>
            )}
          </div>
        )}
        <div className="text-muted-foreground leading-none text-center text-s">
          Congoma: ${chartData?.[0]?.congoma.toFixed(2) || '0.00'} • 
          Los Angeles: ${chartData?.[0]?.losAngeles.toFixed(2) || '0.00'}
        </div>
      </CardFooter>
    </Card>
  )
}
