import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Cell, PieChart, Pie, Legend } from "recharts"
import { toPng } from "html-to-image"
import { FileDown, TrendingUp, DollarSign, Users, Percent } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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

export const description = "Análisis de Tráfico por Cabinas"

type CabinasAggregates = {
  totalTransitos: number
  promedioDiario: number
  cabinaTop: { cabina: number; cantidad: number }
  cabinaBottom: { cabina: number; cantidad: number }
  horaPico: { hora: string; cantidad: number }
  transitosPorCabina: { cabina: number; cantidad: number; porcentaje: number; ingreso: number }[]
  tendenciaPorCabina: { fecha: string; cabina: number; cantidad: number }[]
  transitosPorCabinaTurno: { cabina: number; turno: number; cantidad: number }[]
  pagoPorCabina: { cabina: number; metodo: "EFEC" | "RFID" | "EXENTO"; cantidad: number }[]
  top5Cabinas: { cabina: number; cantidad: number }[]
  bottom5Cabinas: { cabina: number; cantidad: number }[]
}

type CabinasResponse = {
  aggregates?: CabinasAggregates | null
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL 
const ENDPOINT = "/r-estadistico/analisis-cabinas"

const chartConfig = {
  vehiculos: { label: "Vehículos", color: "#8b5cf6" },
  ingreso: { label: "Ingreso", color: "#f59e0b" },
  promedio: { label: "Promedio", color: "#06b6d4" },
} satisfies ChartConfig

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", 
  "#06b6d4", "#ef4444", "#84cc16", "#a855f7", "#f97316"
]

const getTimeRangeLabel = (timeRange: string) => {
  switch (timeRange) {
    case "ultimos7d": return "los últimos 7 días"
    case "mesActual": return "el mes actual"
    case "ultimoMes": return "el último mes"
    case "ultimos90d": return "los últimos 90 días"
    default: return "el período seleccionado"
  }
}

// Funciones de caché
const CACHE_PREFIX = 'cabinas-cache-'
const CACHE_EXPIRY = 30 * 60 * 1000 // 30 minutos

function getCachedData(key: string): CabinasAggregates | null {
  try {
    const cached = sessionStorage.getItem(CACHE_PREFIX + key)
    if (!cached) return null
    
    const { aggregates, timestamp } = JSON.parse(cached)
    const now = Date.now()
    
    if (now - timestamp > CACHE_EXPIRY) {
      sessionStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    
    return aggregates ?? null
  } catch {
    return null
  }
}

function setCachedData(key: string, aggregates: CabinasAggregates | null) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      aggregates,
      timestamp: Date.now()
    }))
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export function ChartCabinas() {
  const [timeRange, setTimeRange] = React.useState("ultimos7d")
  const [peaje, setPeaje] = React.useState<string>("all")
  const [aggregates, setAggregates] = React.useState<CabinasAggregates | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = React.useState(false)

  // Refs para PDF
  const kpisRef = React.useRef<HTMLDivElement>(null)
  const vehiculosPorCabinaRef = React.useRef<HTMLDivElement>(null)
  const ingresosPorCabinaRef = React.useRef<HTMLDivElement>(null)
  const categoriaPorCabinaRef = React.useRef<HTMLDivElement>(null)
  const distribucionPorcentualRef = React.useRef<HTMLDivElement>(null)
  const efecVsRfidCabinasRef = React.useRef<HTMLDivElement>(null)

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true)
    try {
      const charts = []

      const imageOptions = {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      }

      if (kpisRef.current) {
        const dataUrl = await toPng(kpisRef.current, imageOptions)
        charts.push({ title: 'KPIs', dataUrl, section: 'kpis' })
      }

      if (vehiculosPorCabinaRef.current) {
        const dataUrl = await toPng(vehiculosPorCabinaRef.current, imageOptions)
        charts.push({ title: 'Vehículos por Cabina', dataUrl, section: 'half' })
      }

      if (ingresosPorCabinaRef.current) {
        const dataUrl = await toPng(ingresosPorCabinaRef.current, imageOptions)
        charts.push({ title: 'Ingresos por Cabina', dataUrl, section: 'half' })
      }

      if (categoriaPorCabinaRef.current) {
        const dataUrl = await toPng(categoriaPorCabinaRef.current, imageOptions)
        charts.push({ title: 'Categorías por Cabina', dataUrl, section: 'full' })
      }

      if (distribucionPorcentualRef.current) {
        const dataUrl = await toPng(distribucionPorcentualRef.current, imageOptions)
        charts.push({ title: 'Distribución', dataUrl, section: 'half' })
      }

      if (efecVsRfidCabinasRef.current) {
        const dataUrl = await toPng(efecVsRfidCabinasRef.current, imageOptions)
        charts.push({ title: 'EFEC vs RFID', dataUrl, section: 'half' })
      }

      // Enviar al backend
      const response = await fetch(`${BASE_URL}/r-estadistico/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charts,
          peaje: peaje === "all" ? "Congoma y Los Angeles" : peaje === "1" ? "Congoma" : "Los Angeles",
          timeRange: timeRange === "ultimos7d" ? "Últimos 7 días" :
                     timeRange === "mesActual" ? "Mes actual" :
                     timeRange === "ultimoMes" ? "Último mes" : "Últimos 90 días",
          reportType: "Cabinas"
        })
      })

      if (!response.ok) throw new Error('Error al generar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-cabinas-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('Error al generar el PDF. Por favor, intenta nuevamente.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  React.useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        
        if (timeRange === "ultimos7d") {
          params.append("take", peaje === "all" ? "10000" : "10000")
        } else if (timeRange === "mesActual") {
          params.append("rango", "mesActual")
          params.append("take", peaje === "all" ? "30000" : "30000")
        } else if (timeRange === "ultimoMes") {
          params.append("rango", "ultimoMes")
          params.append("take", peaje === "all" ? "30000" : "35000")
        } else if (timeRange === "ultimos90d") {
          params.append("rango", "ultimos90d")
          params.append("take", peaje === "all" ? "30000" : "30000")
        }

        if (peaje !== "all") {
          params.append("idPeaje", peaje)
        }

        const cacheKey = `${timeRange}-${peaje}`
        const cachedData = getCachedData(cacheKey)
        if (cachedData) {
          if (isMounted) {
            setAggregates(cachedData)
            setError(null)
            setLoading(false)
          }
          return
        }

        const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`
        const response = await fetch(url)
        
        if (!response.ok) throw new Error(`Error ${response.status}`)
        
        const json = (await response.json()) as CabinasResponse
        const aggregatesPayload = json.aggregates ?? null
        if (isMounted) {
          setCachedData(cacheKey, aggregatesPayload)
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
  }, [timeRange, peaje])

  const kpisCabinas = React.useMemo(() => {
    if (!aggregates) {
      return { totalCabinas: 0, totalVehiculos: 0, totalIngreso: 0, promedioVehiculos: 0, promedioIngreso: 0 }
    }

    const totalCabinas = aggregates.transitosPorCabina.length
    const totalVehiculos = aggregates.totalTransitos
    const totalIngreso = aggregates.transitosPorCabina.reduce((sum, row) => sum + (row.ingreso || 0), 0)
    const promedioVehiculos = totalCabinas > 0 ? Math.round(totalVehiculos / totalCabinas) : 0
    const promedioIngreso = totalCabinas > 0 ? totalIngreso / totalCabinas : 0

    return { totalCabinas, totalVehiculos, totalIngreso, promedioVehiculos, promedioIngreso }
  }, [aggregates])

  const traficoPorCabina = React.useMemo(() => {
    if (!aggregates) return []

    return aggregates.transitosPorCabina
      .map((row) => ({
        cabina: `Cabina ${row.cabina}`,
        cabinaNum: row.cabina,
        vehiculos: row.cantidad,
        ingreso: row.ingreso,
        porcentaje: row.porcentaje,
      }))
      .sort((a, b) => b.vehiculos - a.vehiculos)
  }, [aggregates])

  const pagosPorCabina = React.useMemo(() => {
    if (!aggregates) return []

    const grouped = new Map<number, { efec: number; rfid: number; exento: number }>()

    aggregates.pagoPorCabina.forEach((row) => {
      const current = grouped.get(row.cabina) || { efec: 0, rfid: 0, exento: 0 }
      if (row.metodo === "EFEC") current.efec += row.cantidad
      if (row.metodo === "RFID") current.rfid += row.cantidad
      if (row.metodo === "EXENTO") current.exento += row.cantidad
      grouped.set(row.cabina, current)
    })

    return Array.from(grouped.entries())
      .map(([cabina, valores]) => ({
        cabina: `Cab ${cabina}`,
        ...valores,
      }))
      .sort((a, b) => {
        const numA = parseInt(a.cabina.split(" ")[1])
        const numB = parseInt(b.cabina.split(" ")[1])
        return numA - numB
      })
  }, [aggregates])

  // Distribución porcentual del tráfico
  const distribucionPorcentual = React.useMemo(() => {
    return traficoPorCabina.map((item, index) => ({
      name: item.cabina,
      value: item.vehiculos,
      porcentaje: item.porcentaje?.toFixed ? item.porcentaje.toFixed(1) : String(item.porcentaje ?? "0"),
      fill: COLORS[index % COLORS.length]
    }))
  }, [traficoPorCabina])

  // EFEC vs RFID por cabina
  const efecVsRfidCabinas = React.useMemo(() => {
    if (!aggregates) return []

    const grouped = new Map<number, { efec: number; rfid: number }>()

    aggregates.pagoPorCabina.forEach((row) => {
      const current = grouped.get(row.cabina) || { efec: 0, rfid: 0 }
      if (row.metodo === "EFEC") current.efec += row.cantidad
      if (row.metodo === "RFID") current.rfid += row.cantidad
      grouped.set(row.cabina, current)
    })

    return Array.from(grouped.entries())
      .map(([cabina, datos]) => ({
        cabina: `Cabina ${cabina}`,
        efec: datos.efec,
        rfid: datos.rfid
      }))
      .sort((a, b) => {
        const totalA = a.efec + a.rfid
        const totalB = b.efec + b.rfid
        return totalB - totalA
      })
  }, [aggregates])

  // Categoría dominante
  const metodoDominante = React.useMemo(() => {
    if (!aggregates) return null

    const totales = aggregates.pagoPorCabina.reduce(
      (acc, row) => {
        acc[row.metodo] += row.cantidad
        return acc
      },
      { EFEC: 0, RFID: 0, EXENTO: 0 }
    )

    const maxMetodo = Object.entries(totales).reduce(
      (max, [metodo, cantidad]) => (cantidad > max.cantidad ? { metodo, cantidad } : max),
      { metodo: "EFEC", cantidad: 0 }
    )

    const total = Object.values(totales).reduce((sum, val) => sum + val, 0)
    const porcentaje = total > 0 ? (maxMetodo.cantidad / total) * 100 : 0

    return { ...maxMetodo, porcentaje }
  }, [aggregates])

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-10 w-[150px] bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid gap-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {/* Header con filtros */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            Análisis de Cabinas {peaje === "all" ? "Congoma y Los Angeles" : peaje === "1" ? "Congoma" : "Los Angeles"}
          </h2>
          <p className="text-sm text-muted-foreground">Análisis detallado de tráfico y rendimiento por cabina</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            onClick={handleGeneratePdf}
            disabled={generatingPdf || loading}
            variant="outline"
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {generatingPdf ? "Generando..." : "Generar PDF"}
          </Button>
          <Select value={peaje} onValueChange={setPeaje}>
            <SelectTrigger className="w-[160px] rounded-lg" aria-label="Peaje">
              <SelectValue placeholder="Todos los peajes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">Todos los peajes</SelectItem>
              <SelectItem value="1" className="rounded-lg">Congoma</SelectItem>
              <SelectItem value="2" className="rounded-lg">Los Angeles</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[160px] rounded-lg" aria-label="Rango de tiempo">
              <SelectValue placeholder="Últimos 7 días" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ultimos7d" className="rounded-lg">Últimos 7 días</SelectItem>
              <SelectItem value="mesActual" className="rounded-lg">Mes actual</SelectItem>
              <SelectItem value="ultimoMes" className="rounded-lg">Último mes</SelectItem>
              <SelectItem value="ultimos90d" className="rounded-lg">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div ref={kpisRef} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cabinas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisCabinas.totalCabinas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Vehículos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpisCabinas.totalVehiculos.toLocaleString('es-ES')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ingreso Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${kpisCabinas.totalIngreso.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Promedio Vehículos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpisCabinas.promedioVehiculos.toLocaleString('es-ES')}
            </div>
            <p className="text-xs text-muted-foreground">por cabina</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Promedio Ingreso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${kpisCabinas.promedioIngreso.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">por cabina</p>
          </CardContent>
        </Card>
      </div>

      {/* Tráfico e Ingresos por cabina - Separados */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card ref={vehiculosPorCabinaRef}>
          <CardHeader>
            <CardTitle>Vehículos por Cabina</CardTitle>
            <CardDescription>Volumen de tráfico por cabina</CardDescription>
          </CardHeader>
          <CardContent>
            {traficoPorCabina.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart data={traficoPorCabina}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="cabina"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(val) => `${Number(val).toLocaleString()} vehículos`}
                      />
                    }
                  />
                  <Bar
                    dataKey="vehiculos"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                    name="Vehículos"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
            )}
          </CardContent>
          {traficoPorCabina.length > 0 && (
            <CardFooter className="flex-col items-start gap-2 text-sm">
              <div className="flex gap-2 font-medium leading-none">
                <TrendingUp className="h-4 w-4" />
                La {traficoPorCabina[0].cabina} tuvo el mayor tráfico con {traficoPorCabina[0].vehiculos.toLocaleString()} vehículos en {getTimeRangeLabel(timeRange)}
              </div>
            </CardFooter>
          )}
        </Card>

        <Card ref={ingresosPorCabinaRef}>
          <CardHeader>
            <CardTitle>Ingresos por Cabina</CardTitle>
            <CardDescription>Recaudación generada por cabina</CardDescription>
          </CardHeader>
          <CardContent>
            {traficoPorCabina.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart data={traficoPorCabina}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="cabina"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(val) => `$${Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      />
                    }
                  />
                  <Bar
                    dataKey="ingreso"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                    name="Ingreso"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
            )}
          </CardContent>
          {traficoPorCabina.length > 0 && (
            <CardFooter className="flex-col items-start gap-2 text-sm">
              <div className="flex gap-2 font-medium leading-none">
                <DollarSign className="h-4 w-4" />
                La {traficoPorCabina[0].cabina} generó los mayores ingresos con ${traficoPorCabina[0].ingreso.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en {getTimeRangeLabel(timeRange)}
              </div>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Métodos de pago por cabina */}
      <Card ref={categoriaPorCabinaRef}>
        <CardHeader>
          <CardTitle>Métodos de Pago por Cabina</CardTitle>
          <CardDescription>EFEC, RFID y Exentos por cabina</CardDescription>
        </CardHeader>
        <CardContent>
          {pagosPorCabina.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <BarChart data={pagosPorCabina}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="cabina"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="efec" stackId="a" fill="#3b82f6" name="EFEC" />
                <Bar dataKey="rfid" stackId="a" fill="#10b981" name="RFID" />
                <Bar dataKey="exento" stackId="a" fill="#94a3b8" name="Exentos" />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
          )}
        </CardContent>
        {metodoDominante && (
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="flex gap-2 font-medium leading-none">
              <Users className="h-4 w-4" />
              El método {metodoDominante.metodo} es el más frecuente con {metodoDominante.cantidad.toLocaleString()} transacciones ({metodoDominante.porcentaje.toFixed(1)}% del total)
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Fila: Distribución y EFEC vs RFID */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card ref={distribucionPorcentualRef}>
          <CardHeader>
            <CardTitle>Distribución del Tráfico</CardTitle>
            <CardDescription>Porcentaje de vehículos por cabina</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {distribucionPorcentual.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(val, name, entry: any) => 
                          `${Number(val).toLocaleString()} vehículos (${entry.payload.porcentaje}%)`
                        }
                      />
                    }
                  />
                  <Pie
                    data={distribucionPorcentual}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    paddingAngle={2}
                    label={(entry) => `${entry.name}: ${entry.porcentaje}%`}
                  >
                    {distribucionPorcentual.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
            )}
          </CardContent>
          {distribucionPorcentual.length > 0 && (
            <CardFooter className="flex-col items-start gap-2 text-sm">
              <div className="flex gap-2 font-medium leading-none">
                <Percent className="h-4 w-4" />
                {distribucionPorcentual[0].name} concentra el {distribucionPorcentual[0].porcentaje}% del tráfico total en {getTimeRangeLabel(timeRange)}
              </div>
            </CardFooter>
          )}
        </Card>

        <Card ref={efecVsRfidCabinasRef}>
          <CardHeader>
            <CardTitle>EFEC vs RFID por Cabina</CardTitle>
            <CardDescription>Comparación de métodos de pago por cabina</CardDescription>
          </CardHeader>
          <CardContent>
            {efecVsRfidCabinas.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart data={efecVsRfidCabinas}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="cabina"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(val) => `${Number(val).toLocaleString()} vehículos`}
                      />
                    }
                  />
                  <Bar
                    dataKey="efec"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    name="EFEC"
                  />
                  <Bar
                    dataKey="rfid"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    name="RFID"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
            )}
          </CardContent>
          {efecVsRfidCabinas.length > 0 && (() => {
            const totalEfec = efecVsRfidCabinas.reduce((sum, item) => sum + item.efec, 0)
            const totalRfid = efecVsRfidCabinas.reduce((sum, item) => sum + item.rfid, 0)
            const total = totalEfec + totalRfid
            const porcentajeRfid = total > 0 ? (totalRfid / total) * 100 : 0
            return (
              <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none">
                  <TrendingUp className="h-4 w-4" />
                  El RFID representa el {porcentajeRfid.toFixed(1)}% del total de transacciones en {getTimeRangeLabel(timeRange)}
                </div>
              </CardFooter>
            )
          })()}
        </Card>
      </div>

    </div>
  )
}
