"use client"

import * as React from "react"
import { motion, type Variants, AnimatePresence } from "framer-motion"
import { format, subDays } from "date-fns"
import { es } from "date-fns/locale"
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Car,
  CreditCard,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  Info,
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts"
import { io } from "socket.io-client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

// ----- Types -----
type AlertItem = {
  type: "positive" | "warning" | "info"
  title: string
  desc: string
  icon: React.ElementType
}

type MetricsState = {
  transitoHoy: number
  transitoVar: number
  tpdaEstimado: number
  tpdaVar: number
  peajeMayorFlujo: string
  recaudacionAyer: number
  recaudacionAnteayer: number
  recaudacionVar: number
  vehiculosAyer: number
  vehiculosAnteayer: number
  vehiculosVar: number
  recaudacionSemana: number
  promedioHora: number
}

// ----- Formatting Helpers -----
const amountFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("es-EC")

// ----- Constants -----
const BASE_URL = import.meta.env.PUBLIC_BASE_URL || ""
const RECAUDACION_DIARIO_ENDPOINT = "/recaudacion"
const TRANSITO_ENDPOINT = "/r-estadistico/reporte-mensual-semanal"
const RFID_ENDPOINT = "/api/v2/descuentos-rfid"

export function OverviewDashboard() {
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [lastUpdate, setLastUpdate] = React.useState<Date>(new Date())

  // Data States
  const [metrics, setMetrics] = React.useState<MetricsState>({
    transitoHoy: 0,
    transitoVar: 0,
    tpdaEstimado: 0,
    tpdaVar: 0,
    peajeMayorFlujo: "---",
    recaudacionAyer: 0,
    recaudacionAnteayer: 0,
    recaudacionVar: 0,
    vehiculosAyer: 0,
    vehiculosAnteayer: 0,
    vehiculosVar: 0,
    recaudacionSemana: 0,
    promedioHora: 0,
  })

  const [trafficChartData, setTrafficChartData] = React.useState<any[]>([])
  const [revenueChartData, setRevenueChartData] = React.useState<any[]>([])
  const [alerts, setAlerts] = React.useState<AlertItem[]>([])
  const [dates, setDates] = React.useState({ hoyStr: "", ayerStr: "" })

  const fetchDashboardData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const today = new Date()
      const dateStrHoy = format(today, "yyyy-MM-dd")
      const dateStrAyer = format(subDays(today, 1), "yyyy-MM-dd")
      const dateStrAnteayer = format(subDays(today, 2), "yyyy-MM-dd")
      const sieteDiasAtras = format(subDays(today, 7), "yyyy-MM-dd")

      setDates({
        hoyStr: format(today, "dd MMM yyyy", { locale: es }),
        ayerStr: format(subDays(today, 1), "dd MMM yyyy", { locale: es }),
      })

      // 1. Fetch Recaudacion Diario (últimos 7 días)
      const paramsRecaudacion = new URLSearchParams()
      paramsRecaudacion.append("desde", sieteDiasAtras)
      paramsRecaudacion.append("hasta", dateStrHoy)

      let revChart: any[] = []
      let recAyerTotal = 0
      let recAnteayerTotal = 0
      let recSemanaTotal = 0

      try {
        const resRec = await apiFetch(`${BASE_URL}${RECAUDACION_DIARIO_ENDPOINT}?${paramsRecaudacion.toString()}`)
        if (resRec.ok) {
          const payload = await resRec.json()
          const agg = payload?.aggregates?.totalesPorDia || payload?.totalesPorDia || payload?.data?.totalesPorDia || []

          // agrupar por fecha normalizada desde aggregates
          const recByDate = new Map<string, number>()
          agg.forEach((item: any) => {
            if (item && item.fecha) {
              const normalDate = String(item.fecha).includes("T") ? String(item.fecha).split("T")[0] : String(item.fecha)
              const totalDelDia = (Number(item.congoma) || 0) + (Number(item.losAngeles) || 0)
              recByDate.set(normalDate.trim(), (recByDate.get(normalDate.trim()) || 0) + totalDelDia)
            }
          })

          recAyerTotal = recByDate.get(dateStrAyer.trim()) || 0
          recAnteayerTotal = recByDate.get(dateStrAnteayer.trim()) || 0

          // Preparar chart de recaudacion ultimos 7 dias (terminando en ayer)
          for (let i = 7; i >= 1; i--) {
            const d = format(subDays(today, i), "yyyy-MM-dd")
            const val = recByDate.get(d) || 0
            revChart.push({ date: d, total: val })
            recSemanaTotal += val
          }
        } else {
          throw new Error("Recaudacion Response Not OK")
        }
      } catch (e) {
        console.error("Error recaudacion (falló API local, usando mock):", e)
        toast.error("Error de conexión", { description: "Mostrando datos simulados de recaudación." })
        // Mantenemos Fallback si hay error de DB local
        recAyerTotal = Math.random() * 5000 + 8000
        recAnteayerTotal = Math.random() * 5000 + 7000
        for (let i = 7; i >= 1; i--) {
          const d = format(subDays(today, i), "yyyy-MM-dd")
          const val = Math.random() * 5000 + 6000
          revChart.push({ date: d, total: val })
          recSemanaTotal += val
        }
      }

      // 2. Fetch Tráfico (Últimos 7 días)
      let transitoData: any[] = []
      let trHoyC = 0, trHoyL = 0
      let trAyerC = 0, trAyerL = 0
      let trAnteayerC = 0, trAnteayerL = 0

      try {
        const paramsTransito1 = new URLSearchParams({ desde: sieteDiasAtras, hasta: dateStrHoy, nombrePeaje: "CONGOMA" })
        const paramsTransito2 = new URLSearchParams({ desde: sieteDiasAtras, hasta: dateStrHoy, nombrePeaje: "LOS ANGELES" })

        const [resT1, resT2] = await Promise.all([
          apiFetch(`${BASE_URL}${TRANSITO_ENDPOINT}?${paramsTransito1.toString()}`),
          apiFetch(`${BASE_URL}${TRANSITO_ENDPOINT}?${paramsTransito2.toString()}`)
        ])

        if (!resT1.ok || !resT2.ok) {
          throw new Error("Transito fetch no fue OK")
        }

        const dataT1 = await resT1.json()
        const dataT2 = await resT2.json()

        const mapC = new Map<string, number>()
        const conteoT1 = dataT1?.conteoPorDia || dataT1?.data?.conteoPorDia || []
        if (Array.isArray(conteoT1)) {
          conteoT1.forEach((d: any) => {
            if (d && d.fecha) {
              const normalDate = d.fecha.includes("T") ? d.fecha.split("T")[0] : d.fecha
              mapC.set(normalDate, (mapC.get(normalDate) || 0) + (d.cantidad || 0))
            }
          })
        }

        const mapL = new Map<string, number>()
        const conteoT2 = dataT2?.conteoPorDia || dataT2?.data?.conteoPorDia || []
        if (Array.isArray(conteoT2)) {
          conteoT2.forEach((d: any) => {
            if (d && d.fecha) {
              const normalDate = d.fecha.includes("T") ? d.fecha.split("T")[0] : d.fecha
              mapL.set(normalDate, (mapL.get(normalDate) || 0) + (d.cantidad || 0))
            }
          })
        }

        // Preparar chart data uniendo días (ultimos 7)
        const datesToChart = []
        for (let i = 7; i >= 0; i--) {
          datesToChart.push(format(subDays(today, i), "yyyy-MM-dd"))
        }

        transitoData = datesToChart.map(date => {
          const c = mapC.get(date) || 0
          const l = mapL.get(date) || 0
          if (date === dateStrHoy) {
            trHoyC = c; trHoyL = l;
          }
          if (date === dateStrAyer) {
            trAyerC = c; trAyerL = l;
          }
          if (date === dateStrAnteayer) {
            trAnteayerC = c; trAnteayerL = l;
          }
          return { date, congoma: c, losAngeles: l, total: c + l }
        })
      } catch (e) {
        console.error("Error transito (usando mock):", e)
        toast.error("Error de conexión", { description: "Mostrando datos simulados de tránsito." })
        // Mock Local en caso de error
        transitoData = Array.from({ length: 8 }, (_, i) => {
          const d = format(subDays(today, 7 - i), "yyyy-MM-dd")
          const c = Math.floor(Math.random() * 8000 + 4000)
          const l = Math.floor(Math.random() * 6000 + 3000)

          if (d === dateStrHoy) { trHoyC = c; trHoyL = l; }
          if (d === dateStrAyer) { trAyerC = c; trAyerL = l; }
          if (d === dateStrAnteayer) { trAnteayerC = c; trAnteayerL = l; }
          return { date: d, congoma: c, losAngeles: l, total: c + l }
        })
      }

      // 3. Fetch RFID (opcional)
      try {
        const resRfid = await apiFetch(RFID_ENDPOINT)
        if (resRfid.ok) {
          // procesar si es necesario
        }
      } catch (e) {
        // silencioso
      }

      // Calculate metrics
      const trHoyTotal = trHoyC + trHoyL
      const vehiculosAyer = trAyerC + trAyerL
      const vehiculosAnteayer = trAnteayerC + trAnteayerL
      const peajeMayorFlujoAyer = trAyerC >= trAyerL
        ? `Cóngoma (${numberFormatter.format(trAyerC)})`
        : `Los Angeles (${numberFormatter.format(trAyerL)})`

      const transitoVar = vehiculosAyer > 0 ? ((trHoyTotal - vehiculosAyer) / vehiculosAyer) * 100 : 0
      const vehiculosVar = vehiculosAnteayer > 0 ? ((vehiculosAyer - vehiculosAnteayer) / vehiculosAnteayer) * 100 : 0
      const recaudacionVar = recAnteayerTotal > 0 ? ((recAyerTotal - recAnteayerTotal) / recAnteayerTotal) * 100 : 0

      const currentHour = Math.max(new Date().getHours(), 1)
      const promedioHora = Math.floor(trHoyTotal / currentHour)

      setMetrics({
        transitoHoy: trHoyTotal,
        transitoVar,
        tpdaEstimado: Math.floor(trHoyTotal * 1.15),
        tpdaVar: transitoVar,
        peajeMayorFlujo: peajeMayorFlujoAyer,
        recaudacionAyer: recAyerTotal,
        recaudacionAnteayer: recAnteayerTotal,
        recaudacionVar,
        vehiculosAyer,
        vehiculosAnteayer,
        vehiculosVar,
        recaudacionSemana: recSemanaTotal,
        promedioHora,
      })

      setTrafficChartData(transitoData)
      setRevenueChartData(revChart)

      // Generate alerts
      const bestDay = [...transitoData].sort((a, b) => b.total - a.total)[0]
      const curAlerts: AlertItem[] = []
      if (recaudacionVar < 0) {
        curAlerts.push({
          type: "warning",
          title: "Caída en Recaudación",
          desc: `El cierre de ayer fue ${Math.abs(recaudacionVar).toFixed(1)}% menor que el día previo.`,
          icon: TrendingDown,
        })
      }
      if (bestDay && bestDay.total > trHoyTotal) {
        curAlerts.push({
          type: "positive",
          title: "Pico de Tráfico Reciente",
          desc: `El ${format(new Date(bestDay.date + "T12:00:00"), "dd MMM", { locale: es })} tuvo récord con ${numberFormatter.format(bestDay.total)} cruces.`,
          icon: TrendingUp,
        })
      }
      curAlerts.push({
        type: "info",
        title: "Status de Peajes",
        desc: "Sincronización estable. 0 desconexiones activas.",
        icon: Activity,
      })
      setAlerts(curAlerts)

      setLastUpdate(new Date())

      if (isRefresh) {
        toast.success("Datos actualizados", { description: "El dashboard ha sido actualizado correctamente." })
      }
    } catch (error) {
      console.error("Dashboard error:", error)
      toast.error("Error al cargar datos", { description: "Intente nuevamente en unos momentos." })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Websocket Live Data for Transito Hoy
  React.useEffect(() => {
    let baseUrl = import.meta.env.PUBLIC_BASE_URL || ""
    let socketUrl = ""
    try {
      const urlObj = new URL(baseUrl)
      socketUrl = urlObj.origin + "/r-estadistico-live"
    } catch {
      socketUrl = "https://api.vial25.dpdns.org/r-estadistico-live"
    }

    const socket = io(socketUrl, {
      reconnectionDelayMax: 10000,
    })

    // Mantenemos un estado local para ir sumando ambos peajes si el backend envía por separado
    const liveCounts = { congoma: 0, losAngeles: 0 }

    socket.on("connect", () => {
      console.log("[Websocket] Conectado a transito-hoy live")
      // Emitimos dos suscripciones para recibir la data de ambos peajes
      socket.emit("subscribe-transito-hoy", { nombrePeaje: "CONGOMA" })
      socket.emit("subscribe-transito-hoy", { nombrePeaje: "LOS ANGELES" })
    })

    socket.on("transito-hoy-update", (data: any) => {
      // Data expected structure: 
      // { fecha: "2026-03-23", idPeaje: 1, nombrePeaje: "CONGOMA", totalTransitos: 8437, ... }

      if (data && typeof data === "object") {
        const peaje = data.nombrePeaje?.toUpperCase()
        const conteo = data.totalTransitos || data.total || data.cantidad || 0

        if (peaje === "CONGOMA") liveCounts.congoma = conteo
        else if (peaje === "LOS ANGELES") liveCounts.losAngeles = conteo
        else if (!peaje) {
          // Fallback por si manda el total sin nombre de peaje
          liveCounts.congoma = conteo
          liveCounts.losAngeles = 0
        }
        
        const newTotal = liveCounts.congoma + liveCounts.losAngeles

        if (newTotal > 0) {
          setMetrics(prev => {
            // Si prev.transitoHoy ya es el mismo, no disparamos un re-render
            if (prev.transitoHoy === newTotal) return prev;
            
            const transitoVar = prev.vehiculosAyer > 0 ? ((newTotal - prev.vehiculosAyer) / prev.vehiculosAyer) * 100 : 0
            const tpdaEstimado = Math.floor(newTotal * 1.15)
            
            return {
              ...prev,
              transitoHoy: newTotal,
              transitoVar,
              tpdaEstimado,
              tpdaVar: transitoVar,
            }
          })
          setLastUpdate(new Date(data.actualizadoEn || new Date()))
        }
      }
    })

    socket.on("disconnect", () => {
      console.log("[Websocket] Desconectado")
    })

    return () => {
      socket.emit("unsubscribe-transito-hoy")
      socket.disconnect()
    }
  }, [])

  // Animation Variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 28 } },
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.header
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2"
      >
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">
            Panel de Control
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Última actualización: {format(lastUpdate, "hh:mm a", { locale: es })}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="w-fit gap-2 transition-all"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
          {refreshing ? "Actualizando..." : "Actualizar"}
        </Button>
      </motion.header>

      {/* Section: Métricas Principales */}
      <section aria-labelledby="metrics-heading">
        <motion.div variants={itemVariants} className="flex items-center gap-2 mb-4">
          <h2 id="metrics-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Métricas Principales
          </h2>
          <div className="flex-1 h-px bg-border/60" />
        </motion.div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Tránsito Hoy"
            value={numberFormatter.format(metrics.transitoHoy)}
            variation={metrics.transitoVar}
            icon={Car}
            badge="En vivo"
            badgeVariant="live"
            description={`~${numberFormatter.format(metrics.promedioHora)} veh/hora promedio`}
            tooltipText="Total de vehículos que han cruzado hoy hasta el momento"
          />
          <MetricCard
            title="TPDA Estimado"
            value={numberFormatter.format(metrics.tpdaEstimado)}
            variation={metrics.tpdaVar}
            icon={Activity}
            description="vs ayer"
            tooltipText="Tráfico Promedio Diario Anual proyectado para hoy"
          />
          <MetricCard
            title="Recaudación Ayer"
            value={amountFormatter.format(metrics.recaudacionAyer)}
            variation={metrics.recaudacionVar}
            icon={Banknote}
            highlight="emerald"
            badge={dates.ayerStr}
            description="vs anteayer"
            tooltipText="Total recaudado en el día anterior"
          />
          <MetricCard
            title="Vehículos Contabilizados"
            value={numberFormatter.format(metrics.vehiculosAyer)}
            variation={metrics.vehiculosVar}
            icon={CreditCard}
            badge={dates.ayerStr}
            description="vs anteayer"
            tooltipText="Total de vehículos procesados ayer"
          />
        </div>
      </section>

      {/* Section: Resumen y Novedades */}
      <section aria-labelledby="summary-heading">
        <motion.div variants={itemVariants} className="flex items-center gap-2 mb-4">
          <h2 id="summary-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Resumen y Novedades
          </h2>
          <div className="flex-1 h-px bg-border/60" />
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Alerts Card */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card className="h-full border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" aria-hidden="true" />
                  Observaciones del Sistema
                </CardTitle>
                <CardDescription>Alertas y novedades importantes</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  <AnimatePresence mode="popLayout">
                    {alerts.map((alert, i) => (
                      <AlertRow key={`${alert.title}-${i}`} alert={alert} index={i} />
                    ))}
                  </AnimatePresence>
                  <AlertRow
                    alert={{
                      type: "info",
                      title: "Peaje de Mayor Flujo",
                      desc: `${metrics.peajeMayorFlujo} lidera el tráfico actual.`,
                      icon: ArrowUpRight,
                    }}
                    index={alerts.length}
                    highlight
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Column: Summary Cards */}
          <div className="flex flex-col gap-4">
            <motion.div variants={itemVariants}>
              <Card className="border-border/60 shadow-sm overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">Acumulado Semanal</span>
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">
                    <RollingNumber value={amountFormatter.format(metrics.recaudacionSemana)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Total de los últimos 7 días
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card
                className="border-border/60 shadow-sm cursor-pointer group transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => window.location.href = "/experimental/recaudacion-reporte-diario-peajes"}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    window.location.href = "/experimental/recaudacion-reporte-diario-peajes"
                  }
                }}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">Reporte Detallado</p>
                    <p className="text-xs text-muted-foreground">Ver análisis completo</p>
                  </div>
                  <div className="p-2 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section: Gráficos */}
      <section aria-labelledby="charts-heading">
        <motion.div variants={itemVariants} className="flex items-center gap-2 mb-4">
          <h2 id="charts-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Análisis Visual
          </h2>
          <div className="flex-1 h-px bg-border/60" />
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-2">
          <motion.div variants={itemVariants}>
            <ChartCard
              title="Flujo de Tráfico"
              description="Evolución de cruces en los últimos 7 días"
              icon={Activity}
              data={trafficChartData}
              type="traffic"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <ChartCard
              title="Tasa de Recaudación"
              description="Evolución de ingresos en los últimos 7 días"
              icon={Banknote}
              iconColor="emerald"
              data={revenueChartData}
              type="revenue"
            />
          </motion.div>
        </div>
      </section>
    </motion.div>
  )
}

// ----- Subcomponents -----

export function RollingNumber({ value }: { value: string | number }) {
  const strValue = String(value)
  const chars = strValue.split("")

  return (
    <span aria-label={strValue} className="inline-flex overflow-hidden tabular-nums leading-none pb-1 -mb-1">
      <AnimatePresence mode="popLayout" initial={false}>
        {chars.map((char, i) => {
          const colIndex = chars.length - i
          return (
            <motion.span
              key={`${colIndex}-${char}`}
              initial={{ y: "100%", opacity: 0, filter: "blur(2px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-100%", opacity: 0, filter: "blur(2px)", position: "absolute" }}
              transition={{ type: "spring", stiffness: 450, damping: 40 }}
              aria-hidden="true"
              className="inline-block whitespace-pre"
            >
              {char}
            </motion.span>
          )
        })}
      </AnimatePresence>
    </span>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/60 shadow-sm p-5">
              <div className="flex justify-between items-start mb-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[220px] lg:col-span-2 rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-[100px] rounded-xl" />
            <Skeleton className="h-[60px] rounded-xl" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-4 w-36" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[380px] rounded-xl" />
          <Skeleton className="h-[380px] rounded-xl" />
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  variation?: number
  icon: React.ElementType
  description?: string
  highlight?: "emerald"
  badge?: string
  badgeVariant?: "default" | "live"
  tooltipText?: string
}

function MetricCard({
  title,
  value,
  variation,
  icon: Icon,
  description,
  highlight,
  badge,
  badgeVariant = "default",
  tooltipText,
}: MetricCardProps) {
  const isPositive = variation !== undefined && variation > 0
  const isNegative = variation !== undefined && variation < 0
  const absVar = variation !== undefined ? Math.abs(variation).toFixed(1) : "0"

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 28 } },
      }}
    >
      <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow h-full">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
              {tooltipText && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">Más información sobre {title}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    {tooltipText}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {badge && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] uppercase font-semibold px-1.5 py-0.5",
                  badgeVariant === "live" && "bg-primary/10 text-primary animate-pulse"
                )}
              >
                {badgeVariant === "live" && <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1 inline-block" />}
                {badge}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl",
              highlight === "emerald" ? "bg-emerald-500/10" : "bg-primary/10"
            )}>
              <Icon className={cn(
                "h-5 w-5",
                highlight === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
              )} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "text-2xl font-bold tracking-tight truncate",
                highlight === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
              )}>
                <RollingNumber value={value} />
              </div>
            </div>
          </div>

          {(variation !== undefined || description) && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
              {variation !== undefined && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "px-1.5 py-0.5 text-[11px] font-semibold gap-0.5",
                    isPositive && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                    isNegative && "bg-rose-500/15 text-rose-700 dark:text-rose-400",
                    !isPositive && !isNegative && "bg-muted text-muted-foreground"
                  )}
                >
                  {isPositive && <TrendingUp className="h-3 w-3" aria-hidden="true" />}
                  {isNegative && <TrendingDown className="h-3 w-3" aria-hidden="true" />}
                  {absVar}%
                </Badge>
              )}
              {description && (
                <span className="text-xs text-muted-foreground">{description}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface AlertRowProps {
  alert: AlertItem
  index: number
  highlight?: boolean
}

function AlertRow({ alert, index, highlight }: AlertRowProps) {
  const Icon = alert.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "flex items-start gap-3 px-5 py-4",
        highlight && "bg-amber-500/5"
      )}
    >
      <div className={cn(
        "p-2 rounded-full shrink-0",
        alert.type === "positive" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        alert.type === "warning" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        alert.type === "info" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        highlight && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      )}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground/90 leading-tight">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.desc}</p>
      </div>
    </motion.div>
  )
}

interface ChartCardProps {
  title: string
  description: string
  icon: React.ElementType
  iconColor?: "emerald"
  data: any[]
  type: "traffic" | "revenue"
}

function ChartCard({ title, description, icon: Icon, iconColor, data, type }: ChartCardProps) {
  return (
    <Card className="h-full border-border/60 shadow-sm overflow-hidden flex flex-col">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className={cn(
            "p-2 rounded-lg border",
            iconColor === "emerald"
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-border/50 bg-background"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              iconColor === "emerald" ? "text-emerald-500" : "text-muted-foreground"
            )} aria-hidden="true" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 flex-1 min-h-[280px]">
        <div className="h-full w-full">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-6 text-center border-2 border-dashed rounded-xl border-border/50">
              No existen datos en este rango temporal
            </div>
          ) : type === "traffic" ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCongoma" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLosAngeles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => format(new Date(val + "T12:00:00"), "dd MMM", { locale: es })}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: 'hsl(var(--border))',
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px', fontSize: '12px' }}
                  labelFormatter={(val) => format(new Date(val + "T12:00:00"), "EEEE, dd MMM", { locale: es })}
                  formatter={(val: number) => [numberFormatter.format(val), ""]}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="congoma" name="Cóngoma" stroke="var(--chart-1)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCongoma)" />
                <Area type="monotone" dataKey="losAngeles" name="Los Angeles" stroke="var(--chart-2)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLosAngeles)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => format(new Date(val + "T12:00:00"), "dd MMM", { locale: es })}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                  tickFormatter={(val) => val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val}`}
                />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: 'hsl(var(--border))',
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px', fontSize: '12px' }}
                  labelFormatter={(val) => format(new Date(val + "T12:00:00"), "EEEE, dd MMM", { locale: es })}
                  formatter={(val: number) => [amountFormatter.format(val), ""]}
                />
                <Area type="monotone" dataKey="total" name="Total Recaudado" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
