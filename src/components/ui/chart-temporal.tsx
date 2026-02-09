import * as React from "react"
import { addDays, format } from "date-fns"
import { type DateRange } from "react-day-picker"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from "recharts"
import { toPng } from "html-to-image"
import { FileDown, TrendingUp, Calendar, Clock, Activity } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { DatePickerWithRange } from "@/components/ui/range_picker"

export const description = "Análisis Temporal Avanzado"

type TemporalAggregates = {
  totalTransito: number
  promedioDiario: number
  diaPico: { fecha: string; cantidad: number }
  horaPico: { hora: string; cantidad: number }
  tendenciaDiaria: { fecha: string; cantidad: number }[]
  promedioPorDiaSemana: { dia: string; cantidad: number; total: number }[]
  heatmapDiaHora: { dia: string; hora: string; cantidad: number }[]
  top5Dias: { fecha: string; cantidad: number }[]
  bottom5Dias: { fecha: string; cantidad: number }[]
}

type TemporalResponse = {
  aggregates?: TemporalAggregates | null
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL 
const ENDPOINT = "/r-estadistico/analisis-temporal"

const chartConfig = {
  cantidad: { label: "Tráfico", color: "#3b82f6" },
  promedio: { label: "Promedio", color: "#10b981" },
} satisfies ChartConfig

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

const HORAS_DIA = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ':00')

// Funciones de caché
const CACHE_PREFIX = 'temporal-cache-'
const CACHE_EXPIRY = 30 * 60 * 1000 // 30 minutos

function getCacheKey(key: string): string {
  return `${CACHE_PREFIX}${key}`
}

function getCachedData(key: string): TemporalAggregates | null {
  try {
    const cached = sessionStorage.getItem(key)
    if (!cached) return null
    
    const { aggregates, timestamp } = JSON.parse(cached)
    const now = Date.now()
    
    // Verificar si expiró
    if (now - timestamp > CACHE_EXPIRY) {
      sessionStorage.removeItem(key)
      return null
    }
    
    return aggregates ?? null
  } catch {
    return null
  }
}

function setCachedData(key: string, aggregates: TemporalAggregates | null): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      aggregates,
      timestamp: Date.now()
    }))
  } catch {
    // Ignorar errores de almacenamiento (quota exceeded, etc)
  }
}

function getDateRangeKey(range: DateRange | undefined): string {
  if (!range?.from) return "sin-fecha"
  const from = format(range.from, "yyyy-MM-dd")
  const to = range.to ? format(range.to, "yyyy-MM-dd") : from
  return `${from}_${to}`
}

async function fetchTemporalAggregates(dateRange: DateRange | undefined, peaje: string = "all"): Promise<TemporalAggregates | null> {
  const cacheKey = getCacheKey(`${getDateRangeKey(dateRange)}-${peaje}`)
  const cached = getCachedData(cacheKey)
  
  if (cached) {
    return cached
  }

  const params = new URLSearchParams()

  if (dateRange?.from) {
    const desde = format(dateRange.from, "yyyy-MM-dd")
    const hasta = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : desde
    params.append("desde", desde)
    params.append("hasta", hasta)
  }

  if (peaje !== "all") {
    params.append("idPeaje", peaje)
  }

  const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Error al cargar datos: ${response.statusText}`)
  }
  
  const json = (await response.json()) as TemporalResponse
  const aggregates = json.aggregates ?? null
  setCachedData(cacheKey, aggregates)
  return aggregates
}

const DIA_KEY_TO_LABEL: Record<string, string> = {
  Dom: "Domingo",
  Lun: "Lunes",
  Mar: "Martes",
  Mie: "Miércoles",
  Jue: "Jueves",
  Vie: "Viernes",
  Sab: "Sábado",
}

function buildHeatmapData(rows: TemporalAggregates["heatmapDiaHora"]) {
  const heatmap: Record<string, Record<string, number>> = {}

  DIAS_SEMANA.forEach(dia => {
    heatmap[dia] = {}
    HORAS_DIA.forEach(hora => {
      heatmap[dia][hora] = 0
    })
  })

  rows.forEach(row => {
    const diaSemana = DIA_KEY_TO_LABEL[row.dia] || row.dia
    if (!heatmap[diaSemana]) return
    if (!heatmap[diaSemana][row.hora]) {
      heatmap[diaSemana][row.hora] = 0
    }
    heatmap[diaSemana][row.hora] += row.cantidad
  })

  return heatmap
}


// Componente Heatmap
function HeatmapChart({ data }: { data: Record<string, Record<string, number>> }) {
  // Calcular min y max para normalización
  const allValues = Object.values(data).flatMap(horas => Object.values(horas))
  const maxVal = Math.max(...allValues)
  const minVal = Math.min(...allValues.filter(v => v > 0))
  
  // Función para obtener color según intensidad
  const getColor = (value: number) => {
    if (value === 0) return 'rgb(241, 245, 249)' // slate-100
    const intensity = (value - minVal) / (maxVal - minVal)
    
    // Gradiente de azul
    if (intensity < 0.25) return 'rgb(191, 219, 254)' // blue-200
    if (intensity < 0.5) return 'rgb(147, 197, 253)' // blue-300
    if (intensity < 0.75) return 'rgb(96, 165, 250)' // blue-400
    return 'rgb(59, 130, 246)' // blue-500
  }
  
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="grid grid-cols-25 gap-1 text-xs">
          {/* Header con horas */}
          <div className="col-span-1"></div>
          {HORAS_DIA.map((hora, idx) => (
            <div key={hora} className={`text-center text-[10px] text-muted-foreground ${idx % 3 !== 0 ? 'hidden sm:block' : ''}`}>
              {hora}
            </div>
          ))}
          
          {/* Filas por día */}
          {DIAS_SEMANA.map(dia => (
            <React.Fragment key={dia}>
              <div className="flex items-center text-right pr-2 text-[11px] font-medium">
                {dia.substring(0, 3)}
              </div>
              {HORAS_DIA.map(hora => {
                const value = data[dia][hora]
                return (
                  <div
                    key={`${dia}-${hora}`}
                    className="aspect-square rounded-sm relative group cursor-pointer"
                    style={{ backgroundColor: getColor(value) }}
                    title={`${dia} ${hora}: ${value} vehículos`}
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 flex items-center justify-center text-[8px] font-semibold">
                      {value > 0 ? value : ''}
                    </span>
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
        
        {/* Leyenda */}
        <div className="flex items-center justify-center gap-2 mt-4 text-xs">
          <span className="text-muted-foreground">Menos</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgb(241, 245, 249)' }}></div>
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgb(191, 219, 254)' }}></div>
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgb(147, 197, 253)' }}></div>
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgb(96, 165, 250)' }}></div>
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgb(59, 130, 246)' }}></div>
          </div>
          <span className="text-muted-foreground">Más</span>
        </div>
      </div>
    </div>
  )
}

export function ChartTemporal() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -6),
    to: new Date(),
  })
  const [peaje, setPeaje] = React.useState<string>("all")
  const [aggregates, setAggregates] = React.useState<TemporalAggregates | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  const chartRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let isMounted = true
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchTemporalAggregates(dateRange, peaje)
        if (isMounted) {
          setAggregates(result)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error desconocido')
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
  }, [dateRange, peaje])

  const handleExportImage = async () => {
    if (!chartRef.current) return
    
    try {
      const dataUrl = await toPng(chartRef.current, {
        quality: 0.95,
        pixelRatio: 2,
      })
      
      const link = document.createElement('a')
      const dateKey = getDateRangeKey(dateRange)
      link.download = `analisis-temporal-${dateKey}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error al exportar imagen:', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-8 bg-muted animate-pulse rounded"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted animate-pulse rounded"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!aggregates) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay datos disponibles para el período y peaje seleccionados.</p>
        </CardContent>
      </Card>
    )
  }

  const heatmapData = buildHeatmapData(aggregates.heatmapDiaHora)
  const diaSemanaData = aggregates.promedioPorDiaSemana.map(item => ({
    dia: item.dia,
    cantidad: Math.round(item.cantidad),
    total: item.total,
  }))
  const tendenciaData = aggregates.tendenciaDiaria.map(item => ({
    fecha: new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    cantidad: item.cantidad,
  }))
  const kpis = {
    totalTransito: aggregates.totalTransito,
    promedioDiario: aggregates.promedioDiario,
    diaPico: {
      fecha: new Date(aggregates.diaPico.fecha).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }),
      cantidad: aggregates.diaPico.cantidad,
    },
    horaPico: aggregates.horaPico,
    top5Dias: aggregates.top5Dias.map(item => ({
      fecha: new Date(item.fecha).toLocaleDateString('es-ES', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }),
      cantidad: item.cantidad,
    })),
    bottom5Dias: aggregates.bottom5Dias.map(item => ({
      fecha: new Date(item.fecha).toLocaleDateString('es-ES', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }),
      cantidad: item.cantidad,
    })),
  }

  return (
    <div className="space-y-6" ref={chartRef}>
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análisis Temporal</h2>
          <p className="text-muted-foreground">
            Patrones de tráfico por día y hora - {peaje === "all" ? "Congoma y Los Angeles" : peaje === "1" ? "Congoma" : "Los Angeles"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={peaje} onValueChange={setPeaje}>
            <SelectTrigger className="h-10 w-[160px] text-base font-semibold">
              <SelectValue placeholder="Todos los peajes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">
                Todos los peajes
              </SelectItem>
              <SelectItem value="1" className="rounded-lg">
                Congoma
              </SelectItem>
              <SelectItem value="2" className="rounded-lg">
                Los Angeles
              </SelectItem>
            </SelectContent>
          </Select>
          
          <DatePickerWithRange
            value={dateRange}
            onChange={setDateRange}
            className="w-[240px]"
          />
          
          <Button variant="outline" size="icon" onClick={handleExportImage}>
            <FileDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tránsito</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalTransito.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">vehículos en el período</p>
          </CardContent>
        </Card>
        
        <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio Diario</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.promedioDiario.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">vehículos por día</p>
          </CardContent>
        </Card>
        
        <Card className="border-sky-200/70 bg-gradient-to-br from-sky-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Día Pico</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.diaPico.cantidad.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{kpis.diaPico.fecha}</p>
          </CardContent>
        </Card>
        
        <Card className="border-violet-200/70 bg-gradient-to-br from-violet-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hora Pico</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.horaPico.cantidad.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{kpis.horaPico.hora}</p>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Mapa de Calor - Tráfico por Día y Hora</CardTitle>
          <CardDescription>
            Visualización de patrones de tráfico según día de la semana y hora del día
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HeatmapChart data={heatmapData} />
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            Los colores más intensos indican mayor volumen de tráfico
          </div>
          <div className="leading-none text-muted-foreground">
            Identifica fácilmente los períodos de mayor y menor actividad
          </div>
        </CardFooter>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Tendencia diaria */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia Diaria</CardTitle>
            <CardDescription>Evolución del tráfico día a día</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <LineChart
                data={tendenciaData}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={Math.floor(tendenciaData.length / 8)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="cantidad"
                  stroke="var(--color-cantidad)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Por día de semana */}
        <Card>
          <CardHeader>
            <CardTitle>Promedio por Día de Semana</CardTitle>
            <CardDescription>Comparación de días laborables vs fin de semana</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <BarChart
                data={diaSemanaData}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="cantidad"
                  fill="var(--color-cantidad)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tablas Top/Bottom */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 5 días */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 - Días con Mayor Tráfico</CardTitle>
            <CardDescription>Los días más congestionados del período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpis.top5Dias.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-medium">{item.fecha}</span>
                  </div>
                  <span className="text-sm font-bold">{item.cantidad.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bottom 5 días */}
        <Card>
          <CardHeader>
            <CardTitle>Bottom 5 - Días con Menor Tráfico</CardTitle>
            <CardDescription>Los días menos congestionados del período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpis.bottom5Dias.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-bold">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-medium">{item.fecha}</span>
                  </div>
                  <span className="text-sm font-bold">{item.cantidad.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
