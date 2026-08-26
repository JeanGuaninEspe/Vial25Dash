import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Ambulance,
  Truck,
  ShieldAlert,
  Activity,
  AlertTriangle,
  Clock,
  Flame,
  Calendar,
  Download,
  RefreshCw,
  FileSpreadsheet,
  TrendingUp,
  MapPin,
  Car,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  PlusCircle,
  Radio,
  FileText,
  SlidersHorizontal,
  Compass,
  ArrowUpRight,
  Sparkles,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { rescateVialApi } from "@/lib/rescate-vial-api"
import type {
  DashboardEjecutivoResponse,
  KPITiemposRespuestaResponse,
  TramosScoringResponse,
  PatronesTemporalesResponse,
  RecomendacionesDespliegueResponse,
  PersonalItem,
  VehiculoItem,
} from "@/lib/rescate-vial-api"

const RISK_COLORS: Record<string, string> = {
  EXTREMO: "#EF4444", // Rojo
  ALTO: "#F97316",    // Naranja
  MEDIO: "#EAB308",   // Amarillo
  BAJO: "#10B981",    // Verde
}

export function RescateVialDashboard() {
  const [activeTab, setActiveTab] = React.useState("dashboard")
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)

  // Datos principales del microservicio
  const [dashboard, setDashboard] = React.useState<DashboardEjecutivoResponse | null>(null)
  const [kpis, setKpis] = React.useState<KPITiemposRespuestaResponse | null>(null)
  const [scoring, setScoring] = React.useState<TramosScoringResponse | null>(null)
  const [patrones, setPatrones] = React.useState<PatronesTemporalesResponse | null>(null)
  const [despliegue, setDespliegue] = React.useState<RecomendacionesDespliegueResponse | null>(null)

  // Catálogos
  const [personal, setPersonal] = React.useState<PersonalItem[]>([])
  const [vehiculos, setVehiculos] = React.useState<VehiculoItem[]>([])

  // Filtros de Scoring
  const [tamanoTramoKm, setTamanoTramoKm] = React.useState<number>(5.0)

  // Estado del Exportador MTOP
  const [mtopServicio, setMtopServicio] = React.useState<"ambulancia" | "grua" | "patrullaje">("ambulancia")
  const [mtopMes, setMtopMes] = React.useState<number>(new Date().getMonth() + 1)
  const [mtopAnio, setMtopAnio] = React.useState<number>(new Date().getFullYear())
  const [downloadingExcel, setDownloadingExcel] = React.useState(false)

  // Modal Registro Rápido
  const [modalRegistroOpen, setModalRegistroOpen] = React.useState(false)
  const [tipoRegistro, setTipoRegistro] = React.useState<"AMBULANCIA" | "GRUA" | "PATRULLAJE">("AMBULANCIA")

  // Carga inicial de datos
  const loadAllData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [dashData, kpiData, scoringData, patronesData, despliegueData, persData, vehData] =
        await Promise.allSettled([
          rescateVialApi.getDashboardEjecutivo(),
          rescateVialApi.getTiemposRespuesta(),
          rescateVialApi.getTramosScoring({ tamano_tramo_km: tamanoTramoKm }),
          rescateVialApi.getPatronesTemporales(),
          rescateVialApi.getRecomendacionesDespliegue(),
          rescateVialApi.getPersonal({ activo: true }),
          rescateVialApi.getVehiculos({ activo: true }),
        ])

      if (dashData.status === "fulfilled") setDashboard(dashData.value)
      if (kpiData.status === "fulfilled") setKpis(kpiData.value)
      if (scoringData.status === "fulfilled") setScoring(scoringData.value)
      if (patronesData.status === "fulfilled") setPatrones(patronesData.value)
      if (despliegueData.status === "fulfilled") setDespliegue(despliegueData.value)
      if (persData.status === "fulfilled") setPersonal(persData.value)
      if (vehData.status === "fulfilled") setVehiculos(vehData.value)

      if (isRefresh) toast.success("Métricas y analítica vial sincronizadas con SQL Server.")
    } catch (err: any) {
      console.error("Error al cargar datos de Rescate Vial:", err)
      toast.error("No se pudo conectar al microservicio de Rescate Vial.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tamanoTramoKm])

  React.useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Recarga al cambiar tamaño de tramo
  const handleCambioTamanoTramo = async (val: string) => {
    const num = parseFloat(val)
    setTamanoTramoKm(num)
    try {
      const res = await rescateVialApi.getTramosScoring({ tamano_tramo_km: num })
      setScoring(res)
      toast.info(`Scoring recalculado en intervalos de ${num} km.`)
    } catch (err) {
      toast.error("Error al recalcular scoring por tramos.")
    }
  }

  // Manejador de descarga Excel MTOP
  const handleDescargarExcel = async () => {
    setDownloadingExcel(true)
    try {
      await rescateVialApi.descargarReporteExcel(mtopServicio, mtopMes, mtopAnio)
      toast.success(`Reporte MTOP (${mtopServicio.toUpperCase()}) descargado exitosamente.`)
    } catch (err: any) {
      toast.error(`Error al descargar Excel: ${err.message || "Fallo en servidor"}`)
    } finally {
      setDownloadingExcel(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* ============================================================ */}
      {/* HEADER PRINCIPAL */}
      {/* ============================================================ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl border border-red-500/20 shadow-xs">
            <Ambulance className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Gestión y Analítica de Rescate Vial
              </h1>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                SQL Server VIALPROD
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Control operativo de flota (Ambulancias, Grúas, Patrullas), análisis de criticidad vial y reportes MTOP.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Actualizar Datos
          </Button>

          <Button
            size="sm"
            onClick={() => setModalRegistroOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-xs"
          >
            <PlusCircle className="size-3.5" />
            Nueva Asistencia
          </Button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* NAVEGACIÓN POR TABS */}
      {/* ============================================================ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full h-auto p-1 bg-muted/70 rounded-xl">
          <TabsTrigger value="dashboard" className="gap-2 py-2 text-xs sm:text-sm">
            <Activity className="size-4" />
            Dashboard & KPIs
          </TabsTrigger>
          <TabsTrigger value="hotspots" className="gap-2 py-2 text-xs sm:text-sm">
            <Flame className="size-4 text-red-500" />
            Tramos Críticos (ICV)
          </TabsTrigger>
          <TabsTrigger value="temporal" className="gap-2 py-2 text-xs sm:text-sm">
            <Clock className="size-4 text-amber-500" />
            Patrones Temporales
          </TabsTrigger>
          <TabsTrigger value="despliegue" className="gap-2 py-2 text-xs sm:text-sm">
            <ShieldCheck className="size-4 text-blue-500" />
            Plan de Despliegue
          </TabsTrigger>
          <TabsTrigger value="reportes" className="gap-2 py-2 text-xs sm:text-sm">
            <FileSpreadsheet className="size-4 text-emerald-600" />
            Reportes MTOP Excel
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: DASHBOARD EJECUTIVO & KPIS */}
        {/* ============================================================ */}
        <TabsContent value="dashboard" className="flex flex-col gap-6 mt-6">
          {/* BANNER TRAMO CRÍTICO */}
          {dashboard?.tramo_mas_critico && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-red-500/15 via-red-500/5 to-amber-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600 text-white rounded-lg shadow-sm">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                    PUNTO DE MAYOR CRITICIDAD IDENTIFICADO (HOTSPOT #1)
                  </span>
                  <h3 className="text-base font-bold text-foreground">
                    {dashboard.tramo_mas_critico.tramo_label} (Índice de Peligrosidad: {dashboard.tramo_mas_critico.indice_criticidad})
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dashboard.recomendacion_ejecutiva}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("hotspots")}
                className="border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/10 self-end md:self-center shrink-0 gap-1.5"
              >
                Ver Análisis Completo
                <ChevronRight className="size-3.5" />
              </Button>
            </motion.div>
          )}

          {/* TARJETAS DE MÉTRICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-xs hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                  Total Asistencias Históricas
                </CardTitle>
                <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                  <Activity className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboard ? dashboard.total_asistencias_historicas.toLocaleString("es-EC") : "--"}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="text-emerald-600 font-medium">
                    {dashboard?.total_ambulancias || 0} Ambulancias
                  </span>
                  <span>•</span>
                  <span className="text-amber-600 font-medium">
                    {dashboard?.total_gruas || 0} Grúas
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-xs hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                  Tiempo Promedio Despacho-Arribo
                </CardTitle>
                <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                  <Clock className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboard?.tiempo_promedio_llegada_min ? `${dashboard.tiempo_promedio_llegada_min} min` : "--"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Meta KPI Concesión: &lt; 15.0 min
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-xs hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                  Tasa de Accidentabilidad
                </CardTitle>
                <div className="p-2 bg-red-500/10 text-red-600 rounded-lg">
                  <Flame className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboard?.tasa_accidentabilidad_porcentaje ? `${dashboard.tasa_accidentabilidad_porcentaje}%` : "--"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboard?.tasa_asistencia_mecanica_porcentaje || 0}% Auxilios mecánicos (Grúa)
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-xs hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                  Total Km Recorridos Flota
                </CardTitle>
                <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                  <Car className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboard?.km_totales_atendidos ? `${dashboard.km_totales_atendidos.toLocaleString("es-EC")} km` : "--"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboard?.total_patrullajes || 0} Bitácoras de patrullaje registradas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* GRÁFICOS DE TIEMPOS Y SERVICIOS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* GRÁFICO TIEMPOS PROMEDIO POR SERVICIO */}
            <Card className="lg:col-span-2 border shadow-xs">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Tiempos Operativos por Tipo de Asistencia (Minutos)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Desglose de tiempo de despacho-arribo, permanencia en sitio y ciclo total.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">Vista KPI MTOP</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={kpis?.resumen_por_servicio || []}
                      margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="tipo_servicio" tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                      <YAxis unit=" min" tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.95)", borderColor: "#374151", borderRadius: 8, color: "#fff" }}
                        formatter={(val: any) => [`${val} min`, ""]}
                      />
                      <Legend wrapperStyle={{ paddingTop: 8 }} />
                      <Bar isAnimationActive={false} dataKey="promedio_despacho_arribo_min" name="Arribo a Sitio" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar isAnimationActive={false} dataKey="promedio_sitio_min" name="Atención en Sitio" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      <Bar isAnimationActive={false} dataKey="promedio_ciclo_total_min" name="Ciclo Total Retorno" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* DISTRIBUCIÓN POR SERVICIO */}
            <Card className="border shadow-xs flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Proporción de Eventos
                </CardTitle>
                <CardDescription className="text-xs">
                  Siniestros Sanitarios vs Remolques Mecánicos
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        isAnimationActive={false}
                        data={[
                          { name: "Ambulancias", value: dashboard?.total_ambulancias || 1, fill: "#EF4444" },
                          { name: "Grúas", value: dashboard?.total_gruas || 1, fill: "#3B82F6" },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#EF4444" />
                        <Cell fill="#3B82F6" />
                      </Pie>
                      <Tooltip formatter={(val: any) => [`${val} asistencias`, "Total"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-center gap-6 mt-2 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-red-500"></span>
                    <span>Ambulancias ({dashboard?.total_ambulancias || 0})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-blue-500"></span>
                    <span>Grúas ({dashboard?.total_gruas || 0})</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: HOTSPOTS & TRAMOS CRÍTICOS (SCORING ICV) */}
        {/* ============================================================ */}
        <TabsContent value="hotspots" className="flex flex-col gap-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Flame className="size-5 text-red-500" />
                Modelo de Scoring de Peligrosidad Vial e Identificación de Hotspots
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clustering espacial ponderado: Fatales (x10), Graves (x5), Leves (x2) y Asistencias Mecánicas (x1).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Agrupación Tramo:
              </Label>
              <Select value={String(tamanoTramoKm)} onValueChange={handleCambioTamanoTramo}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-background">
                  <SelectValue placeholder="Intervalo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Cada 1.0 km</SelectItem>
                  <SelectItem value="2">Cada 2.0 km</SelectItem>
                  <SelectItem value="5">Cada 5.0 km</SelectItem>
                  <SelectItem value="10">Cada 10.0 km</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* RESUMEN DE RIESGO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(scoring?.resumen_niveles_riesgo || { EXTREMO: 0, ALTO: 0, MEDIO: 0, BAJO: 0 }).map(
              ([nivel, cantidad]) => (
                <Card key={nivel} className="border shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">RIESGO {nivel}</span>
                      <div className="text-xl font-bold mt-0.5 text-foreground">{cantidad} Tramos</div>
                    </div>
                    <div
                      className="size-3.5 rounded-full"
                      style={{ backgroundColor: RISK_COLORS[nivel] || "#9CA3AF" }}
                    />
                  </CardContent>
                </Card>
              )
            )}
          </div>

          {/* GRÁFICO RANKING DE PELIGROSIDAD */}
          <Card className="border shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Top Tramos con Mayor Índice de Peligrosidad (ICV)
              </CardTitle>
              <CardDescription className="text-xs">
                Evaluación comparativa de tramos según severidad y volumen de accidentes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={scoring?.top_tramos_criticos.slice(0, 8) || []}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                    <YAxis
                      dataKey="tramo_label"
                      type="category"
                      width={130}
                      interval={0}
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.95)", borderColor: "#374151", borderRadius: 8, color: "#fff" }}
                      formatter={(val: any) => [`ICV: ${val}`, "Índice de Peligrosidad"]}
                    />
                    <Bar isAnimationActive={false} dataKey="indice_criticidad" radius={[0, 4, 4, 0]}>
                      {scoring?.top_tramos_criticos.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.nivel_riesgo] || "#3B82F6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* TABLA DETALLADA DE TRAMOS CRÍTICOS */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-foreground">Detalle y Medidas Tácticas Sugeridas por Tramo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scoring?.top_tramos_criticos.map((tramo, idx) => (
                <Card key={idx} className="border shadow-xs overflow-hidden">
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: RISK_COLORS[tramo.nivel_riesgo] }}
                  />
                  <CardHeader className="pb-3 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-red-500" />
                        <CardTitle className="text-base font-bold">{tramo.tramo_label}</CardTitle>
                      </div>
                      <Badge
                        className="text-xs font-bold"
                        style={{
                          backgroundColor: `${RISK_COLORS[tramo.nivel_riesgo]}20`,
                          color: RISK_COLORS[tramo.nivel_riesgo],
                          borderColor: `${RISK_COLORS[tramo.nivel_riesgo]}40`,
                        }}
                      >
                        RIESGO {tramo.nivel_riesgo} (ICV {tramo.indice_criticidad})
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-lg text-center">
                      <div>
                        <span className="text-muted-foreground block">Eventos</span>
                        <span className="font-bold text-foreground text-sm">{tramo.total_eventos}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Fatales / Graves</span>
                        <span className="font-bold text-red-600 dark:text-red-400 text-sm">
                          {tramo.total_fatales} / {tramo.total_graves}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Sentido</span>
                        <span className="font-semibold text-foreground text-xs">{tramo.sentido_predominante}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">Principal causa / incidente:</span>{" "}
                        {tramo.principal_motivo_o_causa}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">Horario pico de incidencia:</span>{" "}
                        {tramo.franja_horaria_mayor_incidencia}
                      </div>
                    </div>

                    {tramo.recomendacion_tactica && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 text-xs text-foreground">
                        <span className="font-bold block text-primary mb-0.5">Acción Táctica Sugerida:</span>
                        {tramo.recomendacion_tactica}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: PATRONES TEMPORALES & HORAS PICO */}
        {/* ============================================================ */}
        <TabsContent value="temporal" className="flex flex-col gap-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                  <Clock className="size-5" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium">HORA PICO MÁXIMA</span>
                  <div className="text-lg font-bold text-foreground">{patrones?.hora_pico_maxima || "--"}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-red-500/10 text-red-600 rounded-xl">
                  <Calendar className="size-5" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium">DÍA DE MAYOR DEMANDA</span>
                  <div className="text-lg font-bold text-foreground">{patrones?.dia_pico_maximo || "--"}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                  <Car className="size-5" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium">FIN DE SEMANA VS SEMANA</span>
                  <div className="text-lg font-bold text-foreground">
                    {patrones?.porcentaje_fin_de_semana}% en Fin de Semana
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DISTRIBUCIÓN POR HORA */}
          <Card className="border shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Distribución Horaria de Asistencias y Siniestros (00:00 a 23:00)
              </CardTitle>
              <CardDescription className="text-xs">
                Volumen de atenciones por hora del día. Las barras rojas destacan accidentes graves y fatales.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patrones?.distribucion_por_hora || []} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="hora" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.95)", borderColor: "#374151", borderRadius: 8, color: "#fff" }}
                      labelFormatter={(h) => `Hora: ${h}:00`}
                    />
                    <Legend wrapperStyle={{ paddingTop: 6 }} />
                    <Bar isAnimationActive={false} dataKey="total_ambulancias" name="Ambulancias" fill="#EF4444" stackId="a" />
                    <Bar isAnimationActive={false} dataKey="total_gruas" name="Grúas" fill="#3B82F6" stackId="a" />
                    <Bar isAnimationActive={false} dataKey="total_accidentes_graves_o_fatales" name="Accidentes Graves/Fatales" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* DISTRIBUCIÓN POR DÍAS DE LA SEMANA */}
          <Card className="border shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Siniestralidad por Día de la Semana
              </CardTitle>
              <CardDescription className="text-xs">
                Permite dimensionar los refuerzos de guardia los fines de semana.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patrones?.distribucion_por_dia || []} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="dia_nombre" tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#9CA3AF" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "rgba(17, 24, 39, 0.95)", borderColor: "#374151", borderRadius: 8, color: "#fff" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 6 }} />
                    <Bar isAnimationActive={false} dataKey="total_ambulancias" name="Ambulancias" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar isAnimationActive={false} dataKey="total_gruas" name="Grúas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 4: PLAN DE DESPLIEGUE ESTRATÉGICO */}
        {/* ============================================================ */}
        <TabsContent value="despliegue" className="flex flex-col gap-6 mt-6">
          <div className="bg-gradient-to-r from-blue-500/10 via-primary/5 to-transparent border border-blue-500/20 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-lg">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Estrategia de Despliegue Táctico y Posicionamiento Óptimo
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {despliegue?.estrategia_general || "Recomendaciones basadas en criticidad espacial y horas pico."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {despliegue?.recomendaciones.map((rec, idx) => (
              <Card key={idx} className="border shadow-xs hover:border-primary/50 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Badge className="bg-primary text-primary-foreground font-bold">
                        Prioridad #{rec.prioridad}
                      </Badge>
                      <CardTitle className="text-base font-bold text-foreground">
                        {rec.recurso_recomendado}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs bg-muted font-semibold w-fit">
                      📍 {rec.tramo_cobertura}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg">
                    <div>
                      <span className="font-bold text-foreground block mb-0.5">Diagnóstico Estadístico:</span>
                      <span className="text-muted-foreground">{rec.diagnostico_problema}</span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground block mb-0.5">Ventana de Horario Óptimo:</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{rec.horario_optimo}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                    <div>
                      <span className="font-bold text-foreground">Acción Operativa: </span>
                      <span className="text-muted-foreground">{rec.accion_preventiva}</span>
                    </div>
                    <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-300 shrink-0">
                      🎯 {rec.impacto_esperado}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 5: REPORTES MINISTERIALES MTOP */}
        {/* ============================================================ */}
        <TabsContent value="reportes" className="flex flex-col gap-6 mt-6">
          <Card className="border shadow-xs max-w-2xl mx-auto w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                  <FileSpreadsheet className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">
                    Exportación Oficial de Reportes MTOP (Excel)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Genera en tiempo real archivos .xlsx con formato y estilos corporativos para el Ministerio de Transporte.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tipo de Servicio Ministerial:</Label>
                <Select
                  value={mtopServicio}
                  onValueChange={(val: any) => setMtopServicio(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambulancia">🚑 Asistencias de Ambulancia (dbo.vw_mtop_ambulancias)</SelectItem>
                    <SelectItem value="grua">🏗️ Remolques y Auxilios de Grúa (dbo.vw_mtop_gruas)</SelectItem>
                    <SelectItem value="patrullaje">🚓 Bitácora de Patrullaje e Inspección (dbo.vw_mtop_patrullaje)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Mes:</Label>
                  <Select
                    value={String(mtopMes)}
                    onValueChange={(val) => setMtopMes(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Enero</SelectItem>
                      <SelectItem value="2">Febrero</SelectItem>
                      <SelectItem value="3">Marzo</SelectItem>
                      <SelectItem value="4">Abril</SelectItem>
                      <SelectItem value="5">Mayo</SelectItem>
                      <SelectItem value="6">Junio</SelectItem>
                      <SelectItem value="7">Julio</SelectItem>
                      <SelectItem value="8">Agosto</SelectItem>
                      <SelectItem value="9">Septiembre</SelectItem>
                      <SelectItem value="10">Octubre</SelectItem>
                      <SelectItem value="11">Noviembre</SelectItem>
                      <SelectItem value="12">Diciembre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Año:</Label>
                  <Input
                    type="number"
                    value={mtopAnio}
                    onChange={(e) => setMtopAnio(parseInt(e.target.value) || 2026)}
                    min={2020}
                    max={2030}
                  />
                </div>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 text-muted-foreground border">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Características del archivo generado:
                </div>
                <p>• Cabecera oficial institucional del MTOP y Concesión Vial.</p>
                <p>• Formato de celdas según tipo de dato (moneda, decimales, fechas, kilómetros).</p>
                <p>• Ajuste automático de ancho de columnas y estilos de tabla ejecutiva.</p>
              </div>

              <Button
                onClick={handleDescargarExcel}
                disabled={downloadingExcel}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs py-5 text-sm font-semibold"
              >
                {downloadingExcel ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Generando Reporte Excel en Memoria...
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Descargar Reporte Excel (.xlsx)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* MODAL DE REGISTRO RÁPIDO */}
      {/* ============================================================ */}
      <Dialog open={modalRegistroOpen} onOpenChange={setModalRegistroOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="size-5 text-red-600" />
              Registro de Operación Vial
            </DialogTitle>
            <DialogDescription className="text-xs">
              Inserta un nuevo formulario en SQL Server con validación estricta de cronología y odometría.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de Operación:</Label>
              <Select value={tipoRegistro} onValueChange={(val: any) => setTipoRegistro(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMBULANCIA">🚑 Asistencia de Ambulancia</SelectItem>
                  <SelectItem value="GRUA">🏗️ Asistencia / Remolque de Grúa</SelectItem>
                  <SelectItem value="PATRULLAJE">🚓 Bitácora de Patrullaje</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <RegistroOperacionForm
              tipo={tipoRegistro}
              personal={personal}
              vehiculos={vehiculos}
              onSuccess={() => {
                setModalRegistroOpen(false)
                loadAllData(true)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RegistroOperacionForm({
  tipo,
  personal,
  vehiculos,
  onSuccess,
}: {
  tipo: "AMBULANCIA" | "GRUA" | "PATRULLAJE"
  personal: PersonalItem[]
  vehiculos: VehiculoItem[]
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = React.useState(false)

  const [codigo, setCodigo] = React.useState(`OP-${Date.now().toString().slice(-5)}`)
  const [supervisorId, setSupervisorId] = React.useState<string>("")
  const [choferId, setChoferId] = React.useState<string>("")
  const [paramedicoId, setParamedicoId] = React.useState<string>("")
  const [vehiculoId, setVehiculoId] = React.useState<string>("")
  const [turno, setTurno] = React.useState<string>("1")
  const [abscisaKm, setAbscisaKm] = React.useState<string>("25.000")
  const [sentido, setSentido] = React.useState<string>("ASCENDENTE")
  const [sector, setSector] = React.useState<string>("Sector Peaje Central")
  const [motivo, setMotivo] = React.useState<string>("Auxilio de emergencia")
  const [severidad, setSeveridad] = React.useState<string>("LEVE")
  const [odoSalida, setOdoSalida] = React.useState<string>("10000")
  const [odoLlegada, setOdoLlegada] = React.useState<string>("10025")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (tipo === "AMBULANCIA") {
        const payload = {
          codigo_formulario: codigo,
          id_supervisor: parseInt(supervisorId) || personal[0]?.id_personal || 1,
          id_paramedico: parseInt(paramedicoId) || personal[1]?.id_personal || 1,
          id_chofer: parseInt(choferId) || personal[2]?.id_personal || 1,
          id_vehiculo: parseInt(vehiculoId) || vehiculos[0]?.id_vehiculo || 1,
          turno: parseInt(turno) || 1,
          ts_llamada: new Date().toISOString(),
          ts_arribo: new Date(Date.now() + 10 * 60000).toISOString(),
          ts_termino: new Date(Date.now() + 30 * 60000).toISOString(),
          ts_retorno: new Date(Date.now() + 50 * 60000).toISOString(),
          sector_referencia: sector,
          abscisa_km: parseFloat(abscisaKm) || 0,
          sentido: sentido,
          motivo_atencion: motivo,
          severidad: severidad,
          odometro_salida_km: parseFloat(odoSalida) || 0,
          odometro_llegada_km: parseFloat(odoLlegada) || 0,
        }
        await rescateVialApi.registrarAmbulancia(payload)
        toast.success("Asistencia de ambulancia registrada correctamente.")
      } else if (tipo === "GRUA") {
        const payload = {
          codigo_formulario: codigo,
          id_supervisor: parseInt(supervisorId) || personal[0]?.id_personal || 1,
          id_chofer: parseInt(choferId) || personal[2]?.id_personal || 1,
          id_vehiculo: parseInt(vehiculoId) || vehiculos[0]?.id_vehiculo || 1,
          turno: parseInt(turno) || 1,
          tipo_grua: "PLATAFORMA",
          ts_llamada: new Date().toISOString(),
          ts_arribo: new Date(Date.now() + 15 * 60000).toISOString(),
          ts_termino: new Date(Date.now() + 35 * 60000).toISOString(),
          ts_retorno: new Date(Date.now() + 60 * 60000).toISOString(),
          sector_referencia: sector,
          abscisa_km: parseFloat(abscisaKm) || 0,
          sentido: sentido,
          motivo_atencion: motivo,
          severidad: severidad,
          odometro_salida_km: parseFloat(odoSalida) || 0,
          odometro_llegada_km: parseFloat(odoLlegada) || 0,
        }
        await rescateVialApi.registrarGrua(payload)
        toast.success("Asistencia de grúa registrada correctamente.")
      } else {
        const payload = {
          codigo_patrullaje: codigo,
          id_supervisor: parseInt(supervisorId) || personal[0]?.id_personal || 1,
          id_chofer: parseInt(choferId) || personal[2]?.id_personal || 1,
          id_vehiculo: parseInt(vehiculoId) || vehiculos[0]?.id_vehiculo || 1,
          fecha_recorrido: new Date().toISOString().slice(0, 10),
          hora_salida: "08:00:00",
          hora_retorno: "16:00:00",
          ruta_descripcion: sector,
          odometro_inicial_km: parseFloat(odoSalida) || 0,
          odometro_final_km: parseFloat(odoLlegada) || 0,
          novedad_en_via: false,
        }
        await rescateVialApi.registrarPatrullaje(payload)
        toast.success("Bitácora de patrullaje registrada correctamente.")
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Error al registrar la operación.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Código:</Label>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
        </div>
        <div>
          <Label className="text-xs">Turno:</Label>
          <Select value={turno} onValueChange={setTurno}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Turno 1 (Mañana)</SelectItem>
              <SelectItem value="2">Turno 2 (Tarde)</SelectItem>
              <SelectItem value="3">Turno 3 (Noche)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Ubicación (Km):</Label>
          <Input type="number" step="0.001" value={abscisaKm} onChange={(e) => setAbscisaKm(e.target.value)} required />
        </div>
        <div>
          <Label className="text-xs">Sentido:</Label>
          <Select value={sentido} onValueChange={setSentido}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ASCENDENTE">ASCENDENTE</SelectItem>
              <SelectItem value="DESCENDENTE">DESCENDENTE</SelectItem>
              <SelectItem value="BIDIRECCIONAL">BIDIRECCIONAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Sector Referencia:</Label>
        <Input value={sector} onChange={(e) => setSector(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Motivo / Incidente:</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        </div>
        <div>
          <Label className="text-xs">Severidad:</Label>
          <Select value={severidad} onValueChange={setSeveridad}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LEVE">LEVE</SelectItem>
              <SelectItem value="GRAVE">GRAVE</SelectItem>
              <SelectItem value="FATAL">FATAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Odómetro Salida (Km):</Label>
          <Input type="number" value={odoSalida} onChange={(e) => setOdoSalida(e.target.value)} required />
        </div>
        <div>
          <Label className="text-xs">Odómetro Llegada (Km):</Label>
          <Input type="number" value={odoLlegada} onChange={(e) => setOdoLlegada(e.target.value)} required />
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white">
        {submitting ? "Guardando en SQL Server..." : "Registrar en Base de Datos"}
      </Button>
    </form>
  )
}
