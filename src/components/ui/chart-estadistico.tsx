import * as React from "react"
import { addDays, format } from "date-fns"
import { type DateRange } from "react-day-picker"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Pie, PieChart, Cell, Legend } from "recharts"
import { toPng } from "html-to-image"
import { FileDown, TrendingUp, DollarSign, Users, Percent } from "lucide-react"

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
  ChartLegend,
  ChartLegendContent,
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

export const description = "Reporte Estadístico de Recaudación"

type EstadisticoRow = {
  ID_CONCESION: number
  ID_PEAJE: number
  FECHA: string
  AÑO: number
  MES: number
  FORMA_DE_PAGO: string
  CABINA: number
  CAT0: number
  VALOR_0: number | null
  CAT1: number
  VALOR_1: number
  CAT2: number
  VALOR_2: number
  CAT3: number
  VALOR_3: number
  CAT4: number
  VALOR_4: number
  CAT5: number
  VALOR_5: number
  CAT6: number
  VALOR_6: number
  CAT7: number
  VALOR_7: number
  CAT8: number
  VALOR_8: number
  CAT9: number
  VALOR_9: number
}

type EstadisticoAggregates = {
  ingresoTotal: number
  vehiculosEfec: number
  vehiculosExentos: number
  vehiculosRfid100: number
  porcentajeExentos: number
  ingresoPorCategoria: { categoria: string; valor: number }[]
  efecVsExentos: { categoria: string; efec: number; exentos: number }[]
  rfidPorTipo: { tipo: string; cantidad: number; valor: number }[]
  tiposExentos: { tipo: string; cantidad: number }[]
  evolucionMensual: { mes: string; valor: number }[]
}

type EstadisticoResponse = {
  data: EstadisticoRow[]
  aggregates?: EstadisticoAggregates | null
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL 
const ENDPOINT = "/r-estadistico"

const chartConfig = {
  cat1: { label: "CAT 1", color: "#3b82f6" },
  cat2: { label: "CAT 2", color: "#8b5cf6" },
  cat3: { label: "CAT 3", color: "#ec4899" },
  cat4: { label: "CAT 4", color: "#f59e0b" },
  cat5: { label: "CAT 5", color: "#10b981" },
  cat6: { label: "CAT 6", color: "#06b6d4" },
  efec: { label: "EFEC", color: "#3b82f6" },
  exentos: { label: "Exentos", color: "#94a3b8" },
} satisfies ChartConfig

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
]

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// Funciones de caché con sessionStorage
const CACHE_PREFIX = 'estadistico-cache-'
const CACHE_EXPIRY = 30 * 60 * 1000 // 30 minutos

// Helper para convertir rango de fechas a etiqueta legible
function getDateRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "el período seleccionado"
  const desde = format(range.from, "dd/MM/yyyy")
  const hasta = range.to ? format(range.to, "dd/MM/yyyy") : desde
  return `del ${desde} al ${hasta}`
}

function getDateRangeKey(range: DateRange | undefined): string {
  if (!range?.from) return "sin-fecha"
  const desde = format(range.from, "yyyy-MM-dd")
  const hasta = range.to ? format(range.to, "yyyy-MM-dd") : desde
  return `${desde}_${hasta}`
}

function getCachedData(key: string): EstadisticoResponse | null {
  try {
    const cached = sessionStorage.getItem(CACHE_PREFIX + key)
    if (!cached) return null
    
    const { data, aggregates, timestamp } = JSON.parse(cached)
    const now = Date.now()
    
    // Verificar si expiró
    if (now - timestamp > CACHE_EXPIRY) {
      sessionStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    
    if (Array.isArray(data)) {
      return { data, aggregates: aggregates ?? null }
    }
    return null
  } catch {
    return null
  }
}

function setCachedData(key: string, payload: EstadisticoResponse) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data: payload.data,
      aggregates: payload.aggregates ?? null,
      timestamp: Date.now()
    }))
  } catch {
    // Ignorar errores de almacenamiento (quota exceeded, etc)
  }
}

export function ChartEstadistico() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -6),
    to: new Date(),
  })
  const [peaje, setPeaje] = React.useState<string>("all")
  const includeData = false
  const [data, setData] = React.useState<EstadisticoRow[]>([])
  const [aggregates, setAggregates] = React.useState<EstadisticoAggregates | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = React.useState(false)

  // Refs para cada gráfico
  const kpisRef = React.useRef<HTMLDivElement>(null)
  const ingresoCategRef = React.useRef<HTMLDivElement>(null)
  const vehiculosCategRef = React.useRef<HTMLDivElement>(null)
  const donutRef = React.useRef<HTMLDivElement>(null)
  const fila3Ref = React.useRef<HTMLDivElement>(null)
  const rfidRef = React.useRef<HTMLDivElement>(null)
  const exentosRef = React.useRef<HTMLDivElement>(null)

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

      // Capturar secciones del dashboard
      if (kpisRef.current) {
        const dataUrl = await toPng(kpisRef.current, imageOptions)
        charts.push({
          title: 'KPIs',
          dataUrl,
          section: 'kpis'
        })
      }

      if (ingresoCategRef.current) {
        const dataUrl = await toPng(ingresoCategRef.current, imageOptions)
        charts.push({
          title: 'Ingreso por Categoría',
          dataUrl,
          section: 'full'
        })
      }

      if (fila3Ref.current) {
        const dataUrl = await toPng(fila3Ref.current, imageOptions)
        charts.push({
          title: 'Análisis por Categoría',
          dataUrl,
          section: 'row'
        })
      }

      if (rfidRef.current) {
        const dataUrl = await toPng(rfidRef.current, imageOptions)
        charts.push({
          title: 'RFID',
          dataUrl,
          section: 'half'
        })
      }

      if (exentosRef.current) {
        const dataUrl = await toPng(exentosRef.current, imageOptions)
        charts.push({
          title: 'Exentos',
          dataUrl,
          section: 'half'
        })
      }

      // Enviar al backend
      const response = await fetch(`${BASE_URL}/r-estadistico/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          charts,
          peaje: peaje === "all" ? "Congoma y Los Angeles" : peaje === "1" ? "Congoma" : "Los Angeles",
          timeRange: getDateRangeLabel(dateRange),
          kpis: {
            ingresoTotal: kpis.ingresoTotal,
            vehiculosEfec: kpis.vehiculosEfec,
            vehiculosExentos: kpis.vehiculosExentos,
            porcentajeExentos: kpis.porcentajeExentos
          }
        })
      })

      if (!response.ok) {
        throw new Error('Error al generar PDF')
      }

      // Descargar el PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-estadistico-${new Date().toISOString().split('T')[0]}.pdf`
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

        if (dateRange?.from) {
          const desde = format(dateRange.from, "yyyy-MM-dd")
          const hasta = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : desde
          params.append("desde", desde)
          params.append("hasta", hasta)
        }

        // Filtro de peaje
        if (peaje !== "all") {
          params.append("idPeaje", peaje)
        }

        if (includeData) {
          params.append("includeData", "true")
        }

        // Clave de caché
        const cacheKey = `${getDateRangeKey(dateRange)}-${peaje}`
        
        // Verificar caché en sessionStorage
        const cachedData = getCachedData(cacheKey)
        if (cachedData) {
          if (isMounted) {
            setData(cachedData.data)
            setAggregates(cachedData.aggregates ?? null)
            setError(null)
            setLoading(false)
          }
          return
        }

        const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}`)
        }
        const json = (await response.json()) as EstadisticoRow[] | EstadisticoResponse
        const payload: EstadisticoResponse = Array.isArray(json)
          ? { data: json, aggregates: null }
          : { data: json.data ?? [], aggregates: json.aggregates ?? null }
        if (isMounted) {
          // Guardar en caché
          setCachedData(cacheKey, payload)
          setData(payload.data)
          setAggregates(payload.aggregates ?? null)
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
  }, [dateRange, peaje])

  // KPIs
  const computedKpis = React.useMemo(() => {
    const efec = data.filter(row => row.FORMA_DE_PAGO === "EFEC.")
    const rfid0 = data.filter(row => row.FORMA_DE_PAGO === "RFID 0 %")
    const rfid50 = data.filter(row => row.FORMA_DE_PAGO === "RFID 50 %")
    const rfid100 = data.filter(row => row.FORMA_DE_PAGO === "RFID 100 %")
    
    // Exentos: todo lo que NO es EFEC ni RFID (0%, 50%, 100%)
    const exentos = data.filter(row => 
      row.FORMA_DE_PAGO !== "EFEC." && 
      !row.FORMA_DE_PAGO.startsWith("RFID")
    )

    // Ingreso total: EFEC + RFID 0% (sin descuento) + RFID 50% (con descuento)
    // RFID 100% NO genera ingreso
    const ingresoEfec = efec.reduce((sum, row) => {
      return sum + (row.VALOR_1 || 0) + (row.VALOR_2 || 0) + (row.VALOR_3 || 0) + 
             (row.VALOR_4 || 0) + (row.VALOR_5 || 0) + (row.VALOR_6 || 0) + (row.VALOR_7 || 0) + (row.VALOR_8 || 0) + (row.VALOR_9 || 0)
    }, 0)

    const ingresoRfid0 = rfid0.reduce((sum, row) => {
      return sum + (row.VALOR_1 || 0) + (row.VALOR_2 || 0) + (row.VALOR_3 || 0) + 
             (row.VALOR_4 || 0) + (row.VALOR_5 || 0) + (row.VALOR_6 || 0) + (row.VALOR_7 || 0) + (row.VALOR_8 || 0) + (row.VALOR_9 || 0)
    }, 0)

    const ingresoRfid50 = rfid50.reduce((sum, row) => {
      return sum + (row.VALOR_1 || 0) + (row.VALOR_2 || 0) + (row.VALOR_3 || 0) + 
             (row.VALOR_4 || 0) + (row.VALOR_5 || 0) + (row.VALOR_6 || 0) + (row.VALOR_7 || 0) + (row.VALOR_8 || 0) + (row.VALOR_9 || 0)
    }, 0)

    const ingresoTotal = ingresoEfec + ingresoRfid0 + ingresoRfid50

    // Cantidad de vehículos EFEC
    const vehiculosEfec = efec.reduce((sum, row) => {
      return sum + row.CAT1 + row.CAT2 + row.CAT3 + row.CAT4 + row.CAT5 + row.CAT6 + row.CAT7 + row.CAT8 + row.CAT9
    }, 0)

    // Vehículos exentos: solo los que NO son EFEC ni RFID
    const vehiculosExentos = exentos.reduce((sum, row) => {
      return sum + row.CAT1 + row.CAT2 + row.CAT3 + row.CAT4 + row.CAT5 + row.CAT6 + row.CAT7 + row.CAT8 + row.CAT9
    }, 0)

    // RFID 100% se cuenta como exento (no genera ingreso)
    const vehiculosRfid100 = rfid100.reduce((sum, row) => {
      return sum + row.CAT1 + row.CAT2 + row.CAT3 + row.CAT4 + row.CAT5 + row.CAT6 + row.CAT7 + row.CAT8 + row.CAT9
    }, 0)

    const totalVehiculos = vehiculosEfec + vehiculosExentos + vehiculosRfid100
    const porcentajeExentos = totalVehiculos > 0 ? ((vehiculosExentos + vehiculosRfid100) / totalVehiculos) * 100 : 0

    return { ingresoTotal, vehiculosEfec, vehiculosExentos, vehiculosRfid100, porcentajeExentos }
  }, [data])

  // Ingreso por categoría (EFEC y RFID que genera ingreso: 0% y 50%)
  const ingresoPorCategoria = React.useMemo(() => {
    const efec = data.filter(row => row.FORMA_DE_PAGO === "EFEC.")
    const rfidConIngreso = data.filter(row => row.FORMA_DE_PAGO === "RFID 0 %" || row.FORMA_DE_PAGO === "RFID 50 %")
    
    const categorias = [
      { 
        categoria: "CAT 1", 
        efec: efec.reduce((s, r) => s + (r.VALOR_1 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_1 || 0), 0)
      },
      { 
        categoria: "CAT 2", 
        efec: efec.reduce((s, r) => s + (r.VALOR_2 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_2 || 0), 0)
      },
      { 
        categoria: "CAT 3", 
        efec: efec.reduce((s, r) => s + (r.VALOR_3 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_3 || 0), 0)
      },
      { 
        categoria: "CAT 4", 
        efec: efec.reduce((s, r) => s + (r.VALOR_4 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_4 || 0), 0)
      },
      { 
        categoria: "CAT 5", 
        efec: efec.reduce((s, r) => s + (r.VALOR_5 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_5 || 0), 0)
      },
      { 
        categoria: "CAT 6", 
        efec: efec.reduce((s, r) => s + (r.VALOR_6 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_6 || 0), 0)
      },  
{        categoria: "CAT 7",
        efec: efec.reduce((s, r) => s + (r.VALOR_7 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_7 || 0), 0)
},
{        categoria: "CAT 8",
        efec: efec.reduce((s, r) => s + (r.VALOR_8 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_8 || 0), 0)
},
{        categoria: "CAT 9",
        efec: efec.reduce((s, r) => s + (r.VALOR_9 || 0), 0),
        rfid: rfidConIngreso.reduce((s, r) => s + (r.VALOR_9 || 0), 0)
}
    ]

    return categorias.filter(c => c.efec > 0 || c.rfid > 0)
  }, [data])


  // EFEC vs RFID por categoría
  const efecVsRfid = React.useMemo(() => {
    const efec = data.filter(row => row.FORMA_DE_PAGO === "EFEC.")
    const rfid = data.filter(row => row.FORMA_DE_PAGO.startsWith("RFID"))
    
    return [
      {
        categoria: "CAT 1",
        efec: efec.reduce((s, r) => s + r.CAT1, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT1, 0)
      },
      {
        categoria: "CAT 2",
        efec: efec.reduce((s, r) => s + r.CAT2, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT2, 0)
      },
      {
        categoria: "CAT 3",
        efec: efec.reduce((s, r) => s + r.CAT3, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT3, 0)
      },
      {
        categoria: "CAT 4",
        efec: efec.reduce((s, r) => s + r.CAT4, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT4, 0)
      },
      {
        categoria: "CAT 5",
        efec: efec.reduce((s, r) => s + r.CAT5, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT5, 0)
      },
      {
        categoria: "CAT 6",
        efec: efec.reduce((s, r) => s + r.CAT6, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT6, 0)
      },
      {        categoria: "CAT 7",
        efec: efec.reduce((s, r) => s + r.CAT7, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT7, 0)
      },
      {        categoria: "CAT 8",
        efec: efec.reduce((s, r) => s + r.CAT8, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT8, 0)
      },
      {        categoria: "CAT 9",
        efec: efec.reduce((s, r) => s + r.CAT9, 0),
        rfid: rfid.reduce((s, r) => s + r.CAT9, 0)
      }
    ].filter(c => c.efec > 0 || c.rfid > 0)
  }, [data])

  // Donut - % Ingreso por categoría (EFEC vs RFID o EFEC vs Exentos)
  const donutData = React.useMemo(() => {
    if (aggregates?.efecVsExentos?.length) {
      const totalEfec = aggregates.efecVsExentos.reduce((sum, item) => sum + item.efec, 0)
      const totalExentos = aggregates.efecVsExentos.reduce((sum, item) => sum + item.exentos, 0)
      return [
        {
          name: "EFEC",
          value: totalEfec,
          fill: "#3b82f6"
        },
        {
          name: "Exentos",
          value: totalExentos,
          fill: "#94a3b8"
        }
      ].filter(item => item.value > 0)
    }

    const totalEfec = ingresoPorCategoria.reduce((sum, item) => sum + item.efec, 0)
    const totalRfid = ingresoPorCategoria.reduce((sum, item) => sum + item.rfid, 0)
    
    return [
      {
        name: "EFEC",
        value: totalEfec,
        fill: "#3b82f6"
      },
      {
        name: "RFID",
        value: totalRfid,
        fill: "#10b981"
      }
    ].filter(item => item.value > 0)
  }, [aggregates, ingresoPorCategoria])

  // Tipos de exentos (excluir EFEC y RFID)
  const tiposExentos = React.useMemo(() => {
    const exentos = data.filter(row => 
      row.FORMA_DE_PAGO !== "EFEC." && 
      !row.FORMA_DE_PAGO.startsWith("RFID")
    )
    
    // Contar REGISTROS por tipo (cada fila es un vehículo)
    const grouped = new Map<string, number>()
    
    exentos.forEach(row => {
      const tipo = row.FORMA_DE_PAGO
      grouped.set(tipo, (grouped.get(tipo) || 0) + 1)
    })

    return Array.from(grouped.entries())
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [data])

  // RFID por tipo de descuento
  const rfidPorTipo = React.useMemo(() => {
    const rfid = data.filter(row => row.FORMA_DE_PAGO.startsWith("RFID"))
    
    const tipos = ["RFID 0 %", "RFID 50 %", "RFID 100 %"]
    
    return tipos.map(tipo => {
      const filtered = rfid.filter(row => row.FORMA_DE_PAGO === tipo)
      const cantidad = filtered.reduce((sum, row) => {
        return sum + row.CAT1 + row.CAT2 + row.CAT3 + row.CAT4 + row.CAT5 + row.CAT6 + row.CAT7 + row.CAT8 + row.CAT9
      }, 0)
      const valor = filtered.reduce((sum, row) => {
        return sum + (row.VALOR_1 || 0) + (row.VALOR_2 || 0) + (row.VALOR_3 || 0) + 
               (row.VALOR_4 || 0) + (row.VALOR_5 || 0) + (row.VALOR_6 || 0) + (row.VALOR_7 || 0) + (row.VALOR_8 || 0) + (row.VALOR_9 || 0)
      }, 0)
      return { tipo, cantidad, valor }
    }).filter(item => item.cantidad > 0)
  }, [data])

  const kpis = aggregates
    ? {
        ingresoTotal: aggregates.ingresoTotal,
        vehiculosEfec: aggregates.vehiculosEfec,
        vehiculosExentos: aggregates.vehiculosExentos,
        vehiculosRfid100: aggregates.vehiculosRfid100,
        porcentajeExentos: aggregates.porcentajeExentos,
      }
    : computedKpis

  const ingresoPorCategoriaTotal = aggregates?.ingresoPorCategoria ?? []
  const efecVsExentosChart = aggregates?.efecVsExentos ?? []
  const tiposExentosChart = aggregates?.tiposExentos?.length ? aggregates.tiposExentos : tiposExentos
  const rfidPorTipoChart = aggregates?.rfidPorTipo?.length ? aggregates.rfidPorTipo : rfidPorTipo
  const usesIngresoTotal = ingresoPorCategoriaTotal.length > 0
  const usesExentos = efecVsExentosChart.length > 0

  if (loading) {
    return (
      <div className="grid gap-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-10 w-[150px] bg-muted animate-pulse rounded-lg" />
        </div>

        {/* KPIs skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
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

        {/* Charts skeleton */}
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-64 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
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
      {/* Header con filtro */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            Reporte Estadístico {peaje === "all" ? "Congoma y Los Angeles" : peaje === "1" ? "Congoma" : "Los Angeles"}
          </h2>
          <p className="text-sm text-muted-foreground">Análisis de recaudación y tránsito</p>
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
            <SelectTrigger className="h-10 w-[160px] rounded-lg text-base font-semibold" aria-label="Peaje">
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
        </div>
      </div>

      {/* Fila 1: KPIs */}
      <div ref={kpisRef} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-2">
            <CardDescription>Ingreso Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${kpis.ingresoTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200/70 bg-gradient-to-br from-sky-50 to-white">
          <CardHeader className="pb-2">
            <CardDescription>Vehículos EFEC</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.vehiculosEfec.toLocaleString('es-ES')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="pb-2">
            <CardDescription>Vehículos Exentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.vehiculosExentos.toLocaleString('es-ES')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-200/70 bg-gradient-to-br from-violet-50 to-white">
          <CardHeader className="pb-2">
            <CardDescription>% Exentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.porcentajeExentos.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: Gráfico principal - Ingreso por Categoría */}
      <Card ref={ingresoCategRef}>
        <CardHeader>
          <CardTitle>{usesIngresoTotal ? "Ingreso por Categoría" : "Ingreso por Categoría (EFEC y RFID)"}</CardTitle>
          <CardDescription>Distribución de ingresos por categoría vehicular</CardDescription>
        </CardHeader>
        <CardContent>
          {(usesIngresoTotal ? ingresoPorCategoriaTotal.length > 0 : ingresoPorCategoria.length > 0) ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              {usesIngresoTotal ? (
                <BarChart data={ingresoPorCategoriaTotal}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="categoria"
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
                  <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total" />
                </BarChart>
              ) : (
                <BarChart data={ingresoPorCategoria}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="categoria"
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
                  <Bar dataKey="efec" fill="#3b82f6" radius={[4, 4, 0, 0]} name="EFEC" />
                  <Bar dataKey="rfid" fill="#10b981" radius={[4, 4, 0, 0]} name="RFID" />
                </BarChart>
              )}
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
          )}
        </CardContent>
        {(usesIngresoTotal ? ingresoPorCategoriaTotal.length > 0 : ingresoPorCategoria.length > 0) && (() => {
          if (usesIngresoTotal) {
            const maxCategoria = ingresoPorCategoriaTotal.reduce((max, cat) =>
              cat.valor > max.valor ? cat : max
            )
            return (
              <CardFooter>
                <div className="flex w-full items-start gap-2 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      <DollarSign className="h-4 w-4" />
                      La categoría con mayor ingreso fue {maxCategoria.categoria} con ${maxCategoria.valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en {getDateRangeLabel(dateRange)}
                    </div>
                  </div>
                </div>
              </CardFooter>
            )
          }
          const maxCategoria = ingresoPorCategoria.reduce((max, cat) => 
            (cat.efec + cat.rfid) > (max.efec + max.rfid) ? cat : max
          )
          const totalMax = maxCategoria.efec + maxCategoria.rfid
          return (
            <CardFooter>
              <div className="flex w-full items-start gap-2 text-sm">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 font-medium leading-none">
                    <DollarSign className="h-4 w-4" />
                    La categoría con mayor ingreso fue {maxCategoria.categoria} con ${totalMax.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en {getDateRangeLabel(dateRange)}
                  </div>
                </div>
              </div>
            </CardFooter>
          )
        })()}
      </Card>

      {/* Fila 3: Comparación EFEC vs Exentos y Donut */}
      <div ref={fila3Ref} className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vehículos por Categoría</CardTitle>
            <CardDescription>{usesExentos ? "EFEC vs Exentos por categoría" : "EFEC vs RFID por categoría"}</CardDescription>
          </CardHeader>
          <CardContent>
            {usesExentos ? (
              efecVsExentosChart.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={efecVsExentosChart}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="categoria"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="efec" fill="#3b82f6" radius={[4, 4, 0, 0]} name="EFEC" />
                    <Bar dataKey="exentos" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Exentos" />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
              )
            ) : (
              efecVsRfid.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={efecVsRfid}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="categoria"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="efec" fill="#3b82f6" radius={[4, 4, 0, 0]} name="EFEC" />
                    <Bar dataKey="rfid" fill="#10b981" radius={[4, 4, 0, 0]} name="RFID" />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
              )
            )}
          </CardContent>
          {(usesExentos ? efecVsExentosChart.length > 0 : efecVsRfid.length > 0) && (() => {
            if (usesExentos) {
              const maxCategoria = efecVsExentosChart.reduce((max, cat) => {
                const currentTotal = cat.efec + cat.exentos
                const maxTotal = max.efec + max.exentos
                return currentTotal > maxTotal ? cat : max
              })
              const totalMax = maxCategoria.efec + maxCategoria.exentos
              const totalVehiculos = efecVsExentosChart.reduce((sum, cat) => sum + cat.efec + cat.exentos, 0)
              const porcentaje = totalVehiculos > 0 ? ((totalMax / totalVehiculos) * 100).toFixed(1) : "0.0"
              return (
                <CardFooter>
                  <div className="flex w-full items-start gap-2 text-sm">
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2 font-medium leading-none">
                        <TrendingUp className="h-4 w-4" />
                        La categoría con mayor tránsito fue {maxCategoria.categoria} con {totalMax.toLocaleString('es-ES')} vehículos ({porcentaje}% del total)
                      </div>
                    </div>
                  </div>
                </CardFooter>
              )
            }
            const maxCategoria = efecVsRfid.reduce((max, cat) => {
              const currentTotal = cat.efec + cat.rfid
              const maxTotal = max.efec + max.rfid
              return currentTotal > maxTotal ? cat : max
            })
            const totalMax = maxCategoria.efec + maxCategoria.rfid
            const totalVehiculos = efecVsRfid.reduce((sum, cat) => sum + cat.efec + cat.rfid, 0)
            const porcentaje = totalVehiculos > 0 ? ((totalMax / totalVehiculos) * 100).toFixed(1) : "0.0"
            return (
              <CardFooter>
                <div className="flex w-full items-start gap-2 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      <TrendingUp className="h-4 w-4" />
                      La categoría con mayor tránsito fue {maxCategoria.categoria} con {totalMax.toLocaleString('es-ES')} vehículos ({porcentaje}% del total)
                    </div>
                  </div>
                </div>
              </CardFooter>
            )
          })()}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de Ingresos</CardTitle>
            <CardDescription>{usesExentos ? "EFEC vs Exentos" : "EFEC vs RFID"}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {donutData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(val) => `$${Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      />
                    }
                  />
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => {
                      const total = donutData.reduce((sum, item) => sum + item.value, 0)
                      const percent = ((entry.payload.value / total) * 100).toFixed(1)
                      return `${value} (${percent}%)`
                    }}
                  />
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
            )}
          </CardContent>
          {donutData.length > 0 && (() => {
            const total = donutData.reduce((sum, item) => sum + item.value, 0)
            const efecData = donutData.find(d => d.name === "EFEC")
            const efecPercent = efecData && total > 0 ? ((efecData.value / total) * 100).toFixed(1) : "0"
            return (
              <CardFooter>
                <div className="flex w-full items-start gap-2 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      <Percent className="h-4 w-4" />
                      Los pagos en efectivo representan el {efecPercent}% del total en {getDateRangeLabel(dateRange)}
                    </div>
                  </div>
                </div>
              </CardFooter>
            )
          })()}
        </Card>
      </div>

      {/* Fila 4: RFID y Exentos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card ref={rfidRef}>
          <CardHeader>
            <CardTitle>RFID por Tipo de Descuento</CardTitle>
            <CardDescription>Vehículos y valores con descuento RFID</CardDescription>
          </CardHeader>
          <CardContent>
            {rfidPorTipoChart.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={rfidPorTipoChart}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="tipo"
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
                        formatter={(val, name) => {
                          if (name === "cantidad") return `${val} vehículos`
                          return `$${Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        }}
                      />
                    }
                  />
                  <Bar dataKey="cantidad" fill="#10b981" radius={[4, 4, 0, 0]} name="Cantidad" />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos RFID disponibles</p>
            )}
          </CardContent>
          {rfidPorTipoChart.length > 0 && (() => {
            const total = rfidPorTipoChart.reduce((sum, item) => sum + item.cantidad, 0)
            const maxTipo = rfidPorTipoChart.reduce((max, tipo) => tipo.cantidad > max.cantidad ? tipo : max)
            const porcentaje = total > 0 ? ((maxTipo.cantidad / total) * 100).toFixed(1) : "0.0"
            
            // Convertir tipo a descripción más clara
            let descripcion = maxTipo.tipo.toLowerCase()
            if (maxTipo.tipo === "RFID 0 %") {
              descripcion = "no tienen descuento en su Tag RFID"
            } else if (maxTipo.tipo === "RFID 50 %") {
              descripcion = "tienen 50% de descuento en su Tag RFID"
            } else if (maxTipo.tipo === "RFID 100 %") {
              descripcion = "tienen 100% de descuento en su Tag RFID"
            }
            
            return (
              <CardFooter>
                <div className="flex w-full items-start gap-2 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      <Users className="h-4 w-4" />
                      El {porcentaje}% de usuarios RFID {descripcion} ({maxTipo.cantidad.toLocaleString('es-ES')} vehículos)
                    </div>
                  </div>
                </div>
              </CardFooter>
            )
          })()}
        </Card>

        <Card ref={exentosRef}>
          <CardHeader>
            <CardTitle>Tipos de Vehículos Exentos</CardTitle>
            <CardDescription>Distribución de vehículos sin pago</CardDescription>
          </CardHeader>
          <CardContent>
            {tiposExentosChart.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={tiposExentosChart}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="tipo"
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
                        formatter={(val) => `${val} vehículos`}
                      />
                    }
                  />
                  <Bar dataKey="cantidad" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos de exentos disponibles</p>
            )}
          </CardContent>
          {tiposExentosChart.length > 0 && (() => {
            const maxTipo = tiposExentosChart[0]
            const total = tiposExentosChart.reduce((sum, item) => sum + item.cantidad, 0)
            const porcentaje = total > 0 ? ((maxTipo.cantidad / total) * 100).toFixed(1) : "0.0"
            return (
              <CardFooter>
                <div className="flex w-full items-start gap-2 text-sm">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      <Users className="h-4 w-4" />
                      El tipo de exención más común es "{maxTipo.tipo}" con {maxTipo.cantidad.toLocaleString('es-ES')} vehículos ({porcentaje}% de exentos)
                    </div>
                  </div>
                </div>
              </CardFooter>
            )
          })()}
        </Card>
      </div>
    </div>
  )
}
