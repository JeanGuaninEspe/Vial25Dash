import * as React from "react"
import { getISOWeek, getISOWeeksInYear } from "date-fns"

import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch } from "@/lib/api"

type RecaudacionDetalle = {
  fecha: string
  nombrePeaje: string
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

type RecaudacionTotales = {
  nombrePeaje: string
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

type RecaudacionTotalGeneral = {
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

type ReporteDiarioPeajesResponse = {
  data: RecaudacionDetalle[]
  totalPorPeaje: RecaudacionTotales[]
  totalGeneral: RecaudacionTotalGeneral
}

type RecaudacionAcumuladaDia = {
  fecha: string
  recaudacionEfectivo: number
  recargasRfid: number
  sobrante: number
  notasCredito: number
  totalEfectivo: number
  recaudaCheque: number
  totalDepositado: number
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL
const ENDPOINT = "/recaudacion/reporte-diario-peajes"
const CACHE_PREFIX = "recaudacion-diario-peajes-exp-v3:"
const CACHE_EXPIRY_MS = 30 * 60 * 1000

const amountFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

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
      JSON.stringify({ timestamp: Date.now(), data })
    )
  } catch {
    // Ignorar errores de caché
  }
}

function formatAmount(value: number) {
  return amountFormatter.format(value ?? 0)
}

function parseApiDate(value: string) {
  const datePart = value.includes("T") ? value.split("T")[0] : value
  const [year, month, day] = datePart.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function getIsoWeekRange(year: number, week: number) {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - jan4Day + 1)

  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (week - 1) * 7)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  monday.setHours(0, 0, 0, 0)
  sunday.setHours(23, 59, 59, 999)

  return { monday, sunday }
}

export function RecaudacionReporteDiarioPeajesExperimental() {
  const now = React.useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()

  const [nombrePeaje, setNombrePeaje] = React.useState("all")
  const [anio, setAnio] = React.useState(String(currentYear))
  const [numSemana, setNumSemana] = React.useState(String(getISOWeek(now)))
  const [turno, setTurno] = React.useState("all")

  const [payload, setPayload] = React.useState<ReporteDiarioPeajesResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const yearOptions = React.useMemo(() => {
    const from = currentYear - 4
    return Array.from({ length: 7 }, (_, idx) => String(from + idx))
  }, [currentYear])

  const weekOptions = React.useMemo(() => {
    const selectedYear = Number(anio)
    if (Number.isNaN(selectedYear)) return []

    const maxWeek =
      selectedYear === currentYear
        ? getISOWeek(now)
        : getISOWeeksInYear(new Date(`${selectedYear}-06-15T00:00:00`))

    return Array.from({ length: maxWeek }, (_, idx) => String(idx + 1))
  }, [anio, currentYear, now])

  React.useEffect(() => {
    if (weekOptions.length === 0) return
    if (!weekOptions.includes(numSemana)) {
      setNumSemana(weekOptions[weekOptions.length - 1])
    }
  }, [weekOptions, numSemana])

  React.useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        const selectedYear = Number(anio)
        const selectedWeek = Number(numSemana)

        const fetchWeek = async (yearValue: number, weekValue: number) => {
          const params = new URLSearchParams()
          params.append("anio", String(yearValue))
          params.append("numSemana", String(weekValue))

          if (nombrePeaje !== "all") {
            params.append("nombrePeaje", nombrePeaje)
          }

          if (turno !== "all") {
            params.append("turno", turno)
          }

          const query = params.toString()
          const cacheKey = `q:${query}`
          const cached = getCachedItem<ReporteDiarioPeajesResponse>(cacheKey)
          if (cached) return cached

          const response = await apiFetch(`${BASE_URL}${ENDPOINT}?${query}`)
          if (!response.ok) throw new Error(`Error ${response.status}`)
          const json = (await response.json()) as ReporteDiarioPeajesResponse
          setCachedItem(cacheKey, json)
          return json
        }

        const currentWeekPayload = await fetchWeek(selectedYear, selectedWeek)

        const weeksInSelectedYear = getISOWeeksInYear(new Date(`${selectedYear}-06-15T00:00:00`))
        const nextWeekYear = selectedWeek < weeksInSelectedYear ? selectedYear : selectedYear + 1
        const nextWeekValue = selectedWeek < weeksInSelectedYear ? selectedWeek + 1 : 1
        const nextWeekPayload = await fetchWeek(nextWeekYear, nextWeekValue)

        const mergedDataMap = new Map<string, RecaudacionDetalle>()
        ;[...currentWeekPayload.data, ...nextWeekPayload.data].forEach((row) => {
          const key = `${row.nombrePeaje}|${row.fecha}|${row.recaudacionEfectivo}|${row.totalDepositado}`
          mergedDataMap.set(key, row)
        })

        const mergedPayload: ReporteDiarioPeajesResponse = {
          data: Array.from(mergedDataMap.values()),
          totalPorPeaje: [],
          totalGeneral: {
            recaudacionEfectivo: 0,
            recargasRfid: 0,
            sobrante: 0,
            notasCredito: 0,
            totalEfectivo: 0,
            recaudaCheque: 0,
            totalDepositado: 0,
          },
        }

        if (isMounted) setPayload(mergedPayload)
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error inesperado")
          setPayload(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [anio, numSemana, turno, nombrePeaje])

  const isoFilteredRows = React.useMemo(() => {
    const rows = payload?.data ?? []
    const year = Number(anio)
    const week = Number(numSemana)
    if (Number.isNaN(year) || Number.isNaN(week)) return rows

    const { monday, sunday } = getIsoWeekRange(year, week)

    return rows.filter((row) => {
      const rowDate = parseApiDate(row.fecha)
      if (!rowDate) return false
      return rowDate >= monday && rowDate <= sunday
    })
  }, [payload, anio, numSemana])

  const groupedData = React.useMemo(() => {
    const rows = isoFilteredRows
    const map = new Map<string, RecaudacionDetalle[]>()

    rows.forEach((row) => {
      const list = map.get(row.nombrePeaje) ?? []
      list.push(row)
      map.set(row.nombrePeaje, list)
    })

    map.forEach((list, key) => {
      map.set(
        key,
        [...list].sort((a, b) => a.fecha.localeCompare(b.fecha))
      )
    })

    return map
  }, [isoFilteredRows])

  const totalsByPeaje = React.useMemo(() => {
    const map = new Map<string, RecaudacionTotales>()

    isoFilteredRows.forEach((row) => {
      const current = map.get(row.nombrePeaje) ?? {
        nombrePeaje: row.nombrePeaje,
        recaudacionEfectivo: 0,
        recargasRfid: 0,
        sobrante: 0,
        notasCredito: 0,
        totalEfectivo: 0,
        recaudaCheque: 0,
        totalDepositado: 0,
      }

      current.recaudacionEfectivo += row.recaudacionEfectivo
      current.recargasRfid += row.recargasRfid
      current.sobrante += row.sobrante
      current.notasCredito += row.notasCredito
      current.totalEfectivo += row.totalEfectivo
      current.recaudaCheque += row.recaudaCheque
      current.totalDepositado += row.totalDepositado
      map.set(row.nombrePeaje, current)
    })

    return Array.from(map.values())
  }, [isoFilteredRows])

  const totalGeneral = React.useMemo<RecaudacionTotalGeneral | null>(() => {
    if (isoFilteredRows.length === 0) return null

    return isoFilteredRows.reduce<RecaudacionTotalGeneral>(
      (acc, row) => {
        acc.recaudacionEfectivo += row.recaudacionEfectivo
        acc.recargasRfid += row.recargasRfid
        acc.sobrante += row.sobrante
        acc.notasCredito += row.notasCredito
        acc.totalEfectivo += row.totalEfectivo
        acc.recaudaCheque += row.recaudaCheque
        acc.totalDepositado += row.totalDepositado
        return acc
      },
      {
        recaudacionEfectivo: 0,
        recargasRfid: 0,
        sobrante: 0,
        notasCredito: 0,
        totalEfectivo: 0,
        recaudaCheque: 0,
        totalDepositado: 0,
      }
    )
  }, [isoFilteredRows])

  const acumuladoPorFecha = React.useMemo<RecaudacionAcumuladaDia[]>(() => {
    const rows = isoFilteredRows
    const map = new Map<string, RecaudacionAcumuladaDia>()

    rows.forEach((row) => {
      const current = map.get(row.fecha) ?? {
        fecha: row.fecha,
        recaudacionEfectivo: 0,
        recargasRfid: 0,
        sobrante: 0,
        notasCredito: 0,
        totalEfectivo: 0,
        recaudaCheque: 0,
        totalDepositado: 0,
      }

      current.recaudacionEfectivo += row.recaudacionEfectivo
      current.recargasRfid += row.recargasRfid
      current.sobrante += row.sobrante
      current.notasCredito += row.notasCredito
      current.totalEfectivo += row.totalEfectivo
      current.recaudaCheque += row.recaudaCheque
      current.totalDepositado += row.totalDepositado
      map.set(row.fecha, current)
    })

    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [isoFilteredRows])

  return (
    <div className="space-y-4">
      <div className="rounded-sm bg-[#555] px-4 py-1.5 text-center text-lg font-bold text-white">
        REPORTE DE RECAUDACIÓN DIARIA POR PEAJES
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          <div className="grid max-w-[460px] grid-cols-[130px_1fr] gap-0 border border-[#6b6b6b] bg-[#555] text-white">
            <p className="px-2 py-1 text-sm font-extrabold">NOMBRE_PEAJE</p>
            <Select value={nombrePeaje} onValueChange={setNombrePeaje}>
              <SelectTrigger className="h-8 rounded-none border-0 border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
                <SelectValue placeholder="(Todas)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">(Todas)</SelectItem>
                <SelectItem value="CONGOMA">CONGOMA</SelectItem>
                <SelectItem value="LOS ANGELES">LOS ANGELES</SelectItem>
              </SelectContent>
            </Select>

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">AÑO</p>
            <Select value={anio} onValueChange={setAnio}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">SEMANA</p>
            <Select value={numSemana} onValueChange={setNumSemana}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((week) => (
                  <SelectItem key={week} value={week}>
                    {week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="border-t border-[#6b6b6b] px-2 py-1 text-sm font-extrabold">TURNO</p>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger className="h-8 rounded-none border-0 border-t border-l border-[#6b6b6b] bg-[#555] text-sm font-semibold text-white focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">(Todas)</SelectItem>
                <SelectItem value="1">Turno 1</SelectItem>
                <SelectItem value="2">Turno 2</SelectItem>
                <SelectItem value="3">Turno 3</SelectItem>
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
                    <th className="px-2 py-1 text-left text-sm font-bold" colSpan={2}>Valores</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">RECAUDACIÓN EFECTIVO</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">RECARGAS TAG Efectivo</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">SOBRANTE</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">(-) NOTAS CRÉDITO</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">TOTAL EFECTIVO</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">RECAUDACIÓN Depos-Transf</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">TOTAL RECAUDADO</th>
                  </tr>
                  <tr className="border-t border-white/30">
                    <th className="px-2 py-1 text-left text-sm font-extrabold">NOMBRE_PEAJE</th>
                    <th className="px-2 py-1 text-left text-sm font-extrabold">FECHA</th>
                    <th className="px-2 py-1" />
                    <th className="px-2 py-1" />
                    <th className="px-2 py-1" />
                    <th className="px-2 py-1" />
                    <th className="px-2 py-1" />
                    <th className="px-2 py-1" />
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from(groupedData.entries()).map(([peaje, rows]) => {
                    const peajeTotal = totalsByPeaje.find((t) => t.nombrePeaje === peaje)

                    return (
                      <React.Fragment key={peaje}>
                        {rows.map((row, index) => (
                          <tr key={`${peaje}-${row.fecha}-${index}`} className="border-b bg-[#bfc8db]">
                            <td className="px-2 py-1 text-sm font-bold">{index === 0 ? peaje : ""}</td>
                            <td className="px-2 py-1 text-sm">{row.fecha}</td>
                            <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.recaudacionEfectivo)}</td>
                            <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.recargasRfid)}</td>
                            <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.sobrante)}</td>
                            <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.notasCredito)}</td>
                            <td className="px-2 py-1 text-right text-sm font-semibold tabular-nums">$ {formatAmount(row.totalEfectivo)}</td>
                            <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.recaudaCheque)}</td>
                            <td className="px-2 py-1 text-right text-sm font-bold tabular-nums">$ {formatAmount(row.totalDepositado)}</td>
                          </tr>
                        ))}

                        {peajeTotal && (
                          <tr className="border-b bg-[#afbdd8]">
                            <td className="px-2 py-1 text-sm font-extrabold" colSpan={2}>{`Total ${peaje}`}</td>
                            <td className="px-2 py-1 text-right text-sm font-extrabold tabular-nums">$ {formatAmount(peajeTotal.recaudacionEfectivo)}</td>
                            <td className="px-2 py-1 text-right text-sm font-extrabold tabular-nums">$ {formatAmount(peajeTotal.recargasRfid)}</td>
                            <td className="px-2 py-1 text-right text-sm font-extrabold tabular-nums">$ {formatAmount(peajeTotal.sobrante)}</td>
                            <td className="px-2 py-1 text-right text-sm font-extrabold tabular-nums">$ {formatAmount(peajeTotal.notasCredito)}</td>
                            <td className="px-2 py-1 text-right text-sm font-extrabold tabular-nums">$ {formatAmount(peajeTotal.totalEfectivo)}</td>
                            <td className="px-2 py-1 text-right text-sm font-extrabold tabular-nums">$ {formatAmount(peajeTotal.recaudaCheque)}</td>
                            <td className="px-2 py-1 text-right text-sm font-extrabold tabular-nums">$ {formatAmount(peajeTotal.totalDepositado)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}

                  {totalGeneral && (
                    <tr className="bg-[#213764] text-white">
                      <td className="px-2 py-2 text-base font-extrabold" colSpan={2}>Total general</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.recaudacionEfectivo)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.recargasRfid)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.sobrante)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.notasCredito)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.totalEfectivo)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.recaudaCheque)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.totalDepositado)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-sm bg-[#555] px-4 py-1.5 text-center text-lg font-bold text-white">
        REPORTE DE RECAUDACIÓN DIARIA ACUMULADO
      </div>

      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-[#555] text-white">
                  <tr>
                    <th className="px-2 py-1 text-left text-sm font-extrabold">FECHA</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">RECAUDACIÓN EFECTIVO</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">RECARGAS TAG Efectivo</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">SOBRANTE</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">(-) NOTAS CRÉDITO</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">TOTAL EFECTIVO</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">RECAUDACIÓN Depos-Transf</th>
                    <th className="px-2 py-1 text-right text-sm font-bold">TOTAL RECAUDADO</th>
                  </tr>
                </thead>
                <tbody>
                  {acumuladoPorFecha.map((row) => (
                    <tr key={row.fecha} className="border-b bg-[#c5c5c7]">
                      <td className="px-2 py-1 text-sm">{row.fecha}</td>
                      <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.recaudacionEfectivo)}</td>
                      <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.recargasRfid)}</td>
                      <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.sobrante)}</td>
                      <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.notasCredito)}</td>
                      <td className="px-2 py-1 text-right text-sm font-semibold tabular-nums">$ {formatAmount(row.totalEfectivo)}</td>
                      <td className="px-2 py-1 text-right text-sm tabular-nums">$ {formatAmount(row.recaudaCheque)}</td>
                      <td className="px-2 py-1 text-right text-sm font-bold tabular-nums">$ {formatAmount(row.totalDepositado)}</td>
                    </tr>
                  ))}

                  {totalGeneral && (
                    <tr className="bg-[#555] text-white">
                      <td className="px-2 py-2 text-base font-extrabold">Total general</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.recaudacionEfectivo)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.recargasRfid)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.sobrante)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.notasCredito)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.totalEfectivo)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.recaudaCheque)}</td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums">$ {formatAmount(totalGeneral.totalDepositado)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
