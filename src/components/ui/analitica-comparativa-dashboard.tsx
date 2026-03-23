import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, startOfMonth, endOfMonth, getDaysInMonth, subMonths, parse, startOfWeek, endOfWeek, subWeeks, subDays } from "date-fns"
import { TrendingUp, TrendingDown, Banknote, Car, ArrowRightLeft, CreditCard, Activity } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const amountFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
const numberFormatter = new Intl.NumberFormat("es-EC")
const tarifaFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 3 })

const BASE_URL = import.meta.env.PUBLIC_BASE_URL || ""
const RECAUDACION_DIARIO_ENDPOINT = "/recaudacion"
const TRANSITO_ENDPOINT = "/r-estadistico/reporte-mensual-semanal"

export function AnaliticaComparativaDashboard() {
  const [loading, setLoading] = React.useState(true)

  const [modo, setModo] = React.useState<"mes" | "semana" | "dia">("mes")
  const hoy = React.useMemo(() => new Date(), [])

  // Default: A = Actual, B = Anterior
  const [periodoA, setPeriodoA] = React.useState(format(hoy, "yyyy-MM"))
  const [periodoB, setPeriodoB] = React.useState(format(subMonths(hoy, 1), "yyyy-MM"))

  const handleModoChange = (m: "mes" | "semana" | "dia") => {
    setModo(m)
    if (m === "mes") {
      setPeriodoA(format(hoy, "yyyy-MM"))
      setPeriodoB(format(subMonths(hoy, 1), "yyyy-MM"))
    } else if (m === "semana") {
      setPeriodoA(format(hoy, "RRRR-'W'II"))
      setPeriodoB(format(subWeeks(hoy, 1), "RRRR-'W'II"))
    } else {
      setPeriodoA(format(hoy, "yyyy-MM-dd"))
      setPeriodoB(format(subDays(hoy, 1), "yyyy-MM-dd"))
    }
  }

  const [chartData, setChartData] = React.useState<any[]>([])
  const [metrics, setMetrics] = React.useState({
    recA: 0, recB: 0, deltaRec: 0,
    trafA: 0, trafB: 0, deltaTraf: 0,
    tarifaA: 0, tarifaB: 0, deltaTarifa: 0,
    promA: 0, promB: 0, deltaProm: 0,
  })

  const fetchData = React.useCallback(async () => {
    setLoading(true)

    // Boundaries map
    let startA, endA, startB, endB;
    let daysA = 1, daysB = 1;
    let labelFormatter = (i: number) => `Día ${i}`;

    try {
      if (modo === "mes") {
        const dateA = new Date(`${periodoA}-01T12:00:00`)
        const dateB = new Date(`${periodoB}-01T12:00:00`)
        startA = format(startOfMonth(dateA), "yyyy-MM-dd")
        endA = format(endOfMonth(dateA), "yyyy-MM-dd")
        startB = format(startOfMonth(dateB), "yyyy-MM-dd")
        endB = format(endOfMonth(dateB), "yyyy-MM-dd")
        daysA = getDaysInMonth(dateA)
        daysB = getDaysInMonth(dateB)
        labelFormatter = (i: number) => i.toString()
      } else if (modo === "semana") {
        const dateA = parse(periodoA, "RRRR-'W'II", new Date())
        const dateB = parse(periodoB, "RRRR-'W'II", new Date())
        startA = format(startOfWeek(dateA, { weekStartsOn: 1 }), "yyyy-MM-dd")
        endA = format(endOfWeek(dateA, { weekStartsOn: 1 }), "yyyy-MM-dd")
        startB = format(startOfWeek(dateB, { weekStartsOn: 1 }), "yyyy-MM-dd")
        endB = format(endOfWeek(dateB, { weekStartsOn: 1 }), "yyyy-MM-dd")
        daysA = 7
        daysB = 7
        const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        labelFormatter = (i: number) => weekDays[i - 1] || `${i}`
      } else {
        startA = periodoA
        endA = periodoA
        startB = periodoB
        endB = periodoB
        daysA = 1
        daysB = 1
      }

      console.log(`[Comparativa] Mode: ${modo} | Fetching Data. A: ${startA} to ${endA}, B: ${startB} to ${endB}`)

      // 1. Fetch Recaudación
      const [resRecA, resRecB] = await Promise.all([
        apiFetch(`${BASE_URL}${RECAUDACION_DIARIO_ENDPOINT}?desde=${startA}&hasta=${endA}`),
        apiFetch(`${BASE_URL}${RECAUDACION_DIARIO_ENDPOINT}?desde=${startB}&hasta=${endB}`)
      ])

      const mapRecA = new Map<number, number>()
      const mapRecB = new Map<number, number>()
      let totalRecA = 0
      let totalRecB = 0

      const processRecData = (payload: any, mapResult: Map<number, number>) => {
        let total = 0
        const agg = payload?.aggregates?.totalesPorDia || payload?.totalesPorDia || payload?.data?.totalesPorDia || []
        agg.forEach((i: any) => {
          if (i?.fecha) {
            const dStr = String(i.fecha).includes("T") ? String(i.fecha).split("T")[0] : String(i.fecha)
            let idx = 1
            if (modo === "mes") {
              idx = parseInt(dStr.split("-")[2], 10)
            } else if (modo === "semana") {
              const dayRaw = new Date(`${dStr}T12:00:00`).getDay()
              idx = dayRaw === 0 ? 7 : dayRaw
            } else {
              idx = 1
            }
            const t = (Number(i.congoma) || 0) + (Number(i.losAngeles) || 0)
            mapResult.set(idx, (mapResult.get(idx) || 0) + t)
            total += t
          }
        })
        return total
      }

      if (resRecA.ok) totalRecA = processRecData(await resRecA.json(), mapRecA)
      if (resRecB.ok) totalRecB = processRecData(await resRecB.json(), mapRecB)

      // 2. Fetch Tráfico
      const pTrans = [
        apiFetch(`${BASE_URL}${TRANSITO_ENDPOINT}?desde=${startA}&hasta=${endA}&nombrePeaje=CONGOMA`),
        apiFetch(`${BASE_URL}${TRANSITO_ENDPOINT}?desde=${startA}&hasta=${endA}&nombrePeaje=LOS ANGELES`),
        apiFetch(`${BASE_URL}${TRANSITO_ENDPOINT}?desde=${startB}&hasta=${endB}&nombrePeaje=CONGOMA`),
        apiFetch(`${BASE_URL}${TRANSITO_ENDPOINT}?desde=${startB}&hasta=${endB}&nombrePeaje=LOS ANGELES`),
      ]

      const transRes = await Promise.all(pTrans)
      const mapTrafA = new Map<number, number>()
      const mapTrafB = new Map<number, number>()
      let totalTrafA = 0
      let totalTrafB = 0

      const processTransData = (arr: any[], mapResult: Map<number, number>) => {
        let total = 0
        arr.forEach((i: any) => {
          if (i?.fecha) {
            const dStr = String(i.fecha).includes("T") ? String(i.fecha).split("T")[0] : String(i.fecha)
            let idx = 1
            if (modo === "mes") {
              idx = parseInt(dStr.split("-")[2], 10)
            } else if (modo === "semana") {
              const dayRaw = new Date(`${dStr}T12:00:00`).getDay()
              idx = dayRaw === 0 ? 7 : dayRaw
            } else {
              idx = 1
            }
            const t = Number(i.cantidad) || 0
            mapResult.set(idx, (mapResult.get(idx) || 0) + t)
            total += t
          }
        })
        return total
      }

      if (transRes[0].ok && transRes[1].ok) {
        const dCA = await transRes[0].json()
        const dLA = await transRes[1].json()
        const arrCA = dCA?.conteoPorDia || dCA?.data?.conteoPorDia || []
        const arrLA = dLA?.conteoPorDia || dLA?.data?.conteoPorDia || []
        totalTrafA += processTransData(arrCA, mapTrafA)
        totalTrafA += processTransData(arrLA, mapTrafA)
      }

      if (transRes[2].ok && transRes[3].ok) {
        const dCB = await transRes[2].json()
        const dLB = await transRes[3].json()
        const arrCB = dCB?.conteoPorDia || dCB?.data?.conteoPorDia || []
        const arrLB = dLB?.conteoPorDia || dLB?.data?.conteoPorDia || []
        totalTrafB += processTransData(arrCB, mapTrafB)
        totalTrafB += processTransData(arrLB, mapTrafB)
      }

      // Build joint array
      const merged = []
      const maxDays = Math.max(daysA, daysB)

      if (modo === "dia") {
        // En diario simplemente renderizamos barras vs
        merged.push({
          label: "Recaudación Total",
          recA: mapRecA.get(1) || 0,
          recB: mapRecB.get(1) || 0,
        })
        merged.push({
          label: "Tráfico Total",
          trafA: mapTrafA.get(1) || 0,
          trafB: mapTrafB.get(1) || 0,
        })
      } else {
        for (let i = 1; i <= maxDays; i++) {
          merged.push({
            dayIndex: i,
            label: labelFormatter(i),
            recA: mapRecA.get(i) || 0,
            recB: mapRecB.get(i) || 0,
            trafA: mapTrafA.get(i) || 0,
            trafB: mapTrafB.get(i) || 0,
          })
        }
      }

      const tarifaA = totalTrafA > 0 ? totalRecA / totalTrafA : 0
      const tarifaB = totalTrafB > 0 ? totalRecB / totalTrafB : 0
      const promA = totalRecA / daysA
      const promB = totalRecB / daysB

      setChartData(merged)
      setMetrics({
        recA: totalRecA,
        recB: totalRecB,
        deltaRec: totalRecB > 0 ? ((totalRecA - totalRecB) / totalRecB) * 100 : 0,
        trafA: totalTrafA,
        trafB: totalTrafB,
        deltaTraf: totalTrafB > 0 ? ((totalTrafA - totalTrafB) / totalTrafB) * 100 : 0,
        tarifaA, tarifaB,
        deltaTarifa: tarifaB > 0 ? ((tarifaA - tarifaB) / tarifaB) * 100 : 0,
        promA, promB,
        deltaProm: promB > 0 ? ((promA - promB) / promB) * 100 : 0
      })

    } catch (e) {
      console.error(e)
      toast.error("Error cargando comparativa", { description: "Revisa la consola." })
      setChartData([])
    } finally {
      setLoading(false)
    }
  }, [modo, periodoA, periodoB])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  function BadgeTrend({ val }: { val: number }) {
    if (val === 0) return <Badge variant="secondary" className="px-2 py-0.5 text-xs border-none text-muted-foreground">0%</Badge>
    const isPositive = val > 0
    return (
      <Badge variant="secondary" className={cn(
        "px-2 py-0.5 text-[11px] font-semibold border-none whitespace-nowrap",
        isPositive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
      )}>
        {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
        {isPositive ? "+" : ""}{val.toFixed(1)}%
      </Badge>
    )
  }

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Analítica Comparativa
            <Badge variant="outline" className="bg-primary/5 text-primary text-xs uppercase tracking-widest font-semibold flex shrink-0">Beta</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Compara el rendimiento financiero y operativo entre dos {modo === 'mes' ? 'meses' : modo === 'semana' ? 'semanas' : 'días'}.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-border/40 shadow-sm w-full xl:w-auto">
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest leading-none px-1">Agrupación</span>
            <Select value={modo} onValueChange={(v) => handleModoChange(v as any)}>
              <SelectTrigger className="h-[34px] text-xs font-medium border-border/60 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mensual</SelectItem>
                <SelectItem value="semana">Semanal</SelectItem>
                <SelectItem value="dia">Diario</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-10 bg-border/40 mx-1 hidden sm:block" />

          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-[10px] uppercase font-bold text-emerald-600/80 dark:text-emerald-400/80 tracking-widest leading-none px-1">Periodo A</span>
              <Input 
                type={modo === "mes" ? "month" : modo === "semana" ? "week" : "date"} 
                value={periodoA} 
                onChange={(e) => setPeriodoA(e.target.value)} 
                className="h-[34px] text-sm border-border/60" 
              />
            </div>
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground shrink-0 mx-1 mb-1 self-end" />
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest leading-none px-1">Periodo B</span>
              <Input 
                type={modo === "mes" ? "month" : modo === "semana" ? "week" : "date"} 
                value={periodoB} 
                onChange={(e) => setPeriodoB(e.target.value)} 
                className="h-[34px] text-sm border-border/60" 
              />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[105px] w-full rounded-xl" />)}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-[350px] w-full rounded-2xl" />
              <Skeleton className="h-[350px] w-full rounded-2xl" />
            </div>
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
            {/* KPIs Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/60 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/10 dark:to-card">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                      <Banknote className="w-4 h-4 text-emerald-500" /> Recaudación
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-2xl font-bold truncate text-emerald-700 dark:text-emerald-400">{amountFormatter.format(metrics.recA)}</p>
                    <BadgeTrend val={metrics.deltaRec} />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground/80 font-medium tracking-tight">
                    <span className="line-through decoration-emerald-500/30 text-emerald-600/60 dark:text-emerald-400/50">{amountFormatter.format(metrics.recB)}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-sm border">Período B</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                      <Car className="w-4 h-4 text-blue-500" /> Tráfico (Veh)
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-2xl font-bold truncate text-blue-700 dark:text-blue-400">{numberFormatter.format(metrics.trafA)}</p>
                    <BadgeTrend val={metrics.deltaTraf} />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground/80 font-medium tracking-tight">
                    <span className="line-through decoration-blue-500/30 text-blue-600/60 dark:text-blue-400/50">{numberFormatter.format(metrics.trafB)}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-sm border">Período B</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                      <CreditCard className="w-4 h-4 text-amber-500" /> Tarifa Media
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-2xl font-bold truncate">{tarifaFormatter.format(metrics.tarifaA)} <span className="text-xs font-normal text-muted-foreground lowercase">/veh</span></p>
                    <BadgeTrend val={metrics.deltaTarifa} />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground/80 font-medium tracking-tight">
                    <span className="line-through decoration-amber-500/30 text-amber-600/60 dark:text-amber-400/50">{tarifaFormatter.format(metrics.tarifaB)}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-sm border">Período B</span>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn("border-border/60 shadow-sm", modo === 'dia' && "opacity-50 grayscale pointer-events-none")}>
                <CardContent className="p-4 relative">
                  {modo === 'dia' && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]"><span className="text-xs font-semibold px-2 py-1 bg-muted rounded-md border shadow-sm">N/A en Diario</span></div>}
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                      <Activity className="w-4 h-4 text-indigo-500" /> Prom. Diario
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-2xl font-bold truncate">{amountFormatter.format(metrics.promA)}</p>
                    <BadgeTrend val={metrics.deltaProm} />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground/80 font-medium tracking-tight">
                    <span className="line-through decoration-indigo-500/30 text-indigo-600/60 dark:text-indigo-400/50">{amountFormatter.format(metrics.promB)}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-sm border">Período B</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60 shadow-sm flex flex-col h-[400px]">
                <CardHeader className="pb-4 border-b border-border/40">
                  <CardTitle className="text-base font-semibold">Tendencia de Recaudación</CardTitle>
                  <CardDescription>Superposición ({modo}) — A vs B</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    {modo === "dia" ? (
                      <BarChart data={chartData.filter(d => d.label.includes('Recaudación'))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.6 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} tickFormatter={(val) => val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val}`} />
                        <Tooltip
                          cursor={{ fill: 'currentColor', opacity: 0.05 }}
                          contentStyle={{ borderRadius: '12px', borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                          formatter={(val: number, name: string) => [amountFormatter.format(val), name === 'recA' ? `Periodo A` : `Periodo B`]}
                        />
                        <Bar dataKey="recB" name="recB" fill="hsl(var(--muted-foreground))" fillOpacity={0.2} radius={[4, 4, 0, 0]} maxBarSize={120} />
                        <Bar dataKey="recA" name="recA" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={120} />
                      </BarChart>
                    ) : (
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRecA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} dy={10} minTickGap={15} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} tickFormatter={(val) => val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val}`} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                          formatter={(val: number, name: string) => [amountFormatter.format(val), name === 'recA' ? `Periodo A` : `Periodo B`]}
                        />
                        <Area type="monotone" dataKey="recB" name="recB" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" fillOpacity={0} />
                        <Area type="monotone" dataKey="recA" name="recA" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRecA)" activeDot={{ r: 6, fill: "#10b981", stroke: "#fff" }} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm flex flex-col h-[400px]">
                <CardHeader className="pb-4 border-b border-border/40">
                  <CardTitle className="text-base font-semibold">Tendencia de Tráfico</CardTitle>
                  <CardDescription>Superposición ({modo}) — A vs B</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    {modo === "dia" ? (
                      <BarChart data={chartData.filter(d => d.label.includes('Tráfico'))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.6 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val} />
                        <Tooltip
                          cursor={{ fill: 'currentColor', opacity: 0.05 }}
                          contentStyle={{ borderRadius: '12px', borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                          formatter={(val: number, name: string) => [numberFormatter.format(val), name === 'trafA' ? `Periodo A` : `Periodo B`]}
                        />
                        <Bar dataKey="trafB" name="trafB" fill="hsl(var(--muted-foreground))" fillOpacity={0.2} radius={[4, 4, 0, 0]} maxBarSize={120} />
                        <Bar dataKey="trafA" name="trafA" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={120} />
                      </BarChart>
                    ) : (
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTrafA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} dy={10} minTickGap={15} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                          formatter={(val: number, name: string) => [numberFormatter.format(val), name === 'trafA' ? `Periodo A` : `Periodo B`]}
                        />
                        <Area type="monotone" dataKey="trafB" name="trafB" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" fillOpacity={0} />
                        <Area type="monotone" dataKey="trafA" name="trafA" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTrafA)" activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff" }} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
