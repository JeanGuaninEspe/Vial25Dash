import * as React from "react"
import { io } from "socket.io-client"

type TransitoHoyPayload = {
  nombrePeaje?: string
  totalTransitos?: number
  total?: number
  cantidad?: number
  actualizadoEn?: string
  fecha?: string
}

type UseTransitoHoyLiveOptions = {
  peajes?: string[]
  seedCounts?: Record<string, number>
}

type UseTransitoHoyLiveResult = {
  liveTotal: number | null
  liveUpdatedAt: Date | null
  isConnected: boolean
}

const SOCKET_IO_PATH = import.meta.env.PUBLIC_SOCKET_IO_PATH || "/v1/socket.io"

function normalizePeaje(value?: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function getEventTimestamp(payload: TransitoHoyPayload) {
  const fromUpdated = payload.actualizadoEn ? Date.parse(payload.actualizadoEn) : Number.NaN
  if (Number.isFinite(fromUpdated)) return fromUpdated

  const fromDate = payload.fecha ? Date.parse(`${payload.fecha}T12:00:00`) : Number.NaN
  if (Number.isFinite(fromDate)) return fromDate

  return Date.now()
}

export function useTransitoHoyLive(options?: UseTransitoHoyLiveOptions): UseTransitoHoyLiveResult {
  const peajes = React.useMemo(() => options?.peajes ?? ["CONGOMA", "LOS ANGELES"], [options?.peajes])

  const normalizedPeajes = React.useMemo(() => peajes.map((name) => normalizePeaje(name)), [peajes])

  const [liveTotal, setLiveTotal] = React.useState<number | null>(null)
  const [liveUpdatedAt, setLiveUpdatedAt] = React.useState<Date | null>(null)
  const [isConnected, setIsConnected] = React.useState(false)

  const countsRef = React.useRef<Record<string, number | null>>({})
  const lastTimestampRef = React.useRef<Record<string, number>>({})
  const aggregateTimestampRef = React.useRef<number>(0)

  React.useEffect(() => {
    normalizedPeajes.forEach((peaje) => {
      if (!(peaje in countsRef.current)) {
        countsRef.current[peaje] = null
      }
    })
  }, [normalizedPeajes])

  React.useEffect(() => {
    if (!options?.seedCounts) return

    let touched = false
    normalizedPeajes.forEach((peaje) => {
      const seeded = options.seedCounts?.[peaje]
      if (!Number.isFinite(seeded)) return

      if (countsRef.current[peaje] == null) {
        countsRef.current[peaje] = Number(seeded)
        touched = true
      }
    })

    if (!touched) return

    const values = normalizedPeajes.map((peaje) => countsRef.current[peaje])
    if (values.every((value) => typeof value === "number")) {
      const seededTotal = (values as number[]).reduce((sum, value) => sum + value, 0)
      setLiveTotal((prev) => (prev === seededTotal ? prev : seededTotal))
    }
  }, [options?.seedCounts, normalizedPeajes])

  React.useEffect(() => {
    let baseUrl = import.meta.env.PUBLIC_BASE_URL || ""
    let socketUrl = ""

    try {
      const urlObj = new URL(baseUrl)
      socketUrl = `${urlObj.origin}/r-estadistico-live`
    } catch {
      socketUrl = "https://api.vial25.dpdns.org/r-estadistico-live"
    }

    const socket = io(socketUrl, {
      path: SOCKET_IO_PATH,
      reconnectionDelayMax: 10000,
    })

    socket.on("connect", () => {
      setIsConnected(true)

      normalizedPeajes.forEach((nombrePeaje) => {
        socket.emit("subscribe-transito-hoy", { nombrePeaje }, (ack?: { totalSubscriptions?: number }) => {
          if (ack?.totalSubscriptions != null) {
            console.log(`[Websocket] Suscrito a ${nombrePeaje}. Total subs activas: ${ack.totalSubscriptions}`)
          }
        })
      })
    })

    socket.on("transito-hoy-update", (data: TransitoHoyPayload) => {
      if (!data || typeof data !== "object") return

      const rawConteo = data.totalTransitos ?? data.total ?? data.cantidad ?? 0
      const conteo = Number(rawConteo)
      if (!Number.isFinite(conteo) || conteo < 0) return

      const peaje = normalizePeaje(data.nombrePeaje)
      const eventTimestamp = getEventTimestamp(data)

      if (peaje && normalizedPeajes.includes(peaje)) {
        const lastTimestamp = lastTimestampRef.current[peaje] ?? 0
        if (eventTimestamp <= lastTimestamp) {
          return
        }

        lastTimestampRef.current[peaje] = eventTimestamp
        countsRef.current[peaje] = conteo

        const values = normalizedPeajes.map((key) => countsRef.current[key])
        if (values.every((value) => typeof value === "number")) {
          const newTotal = (values as number[]).reduce((sum, value) => sum + value, 0)
          setLiveTotal((prev) => (prev === newTotal ? prev : newTotal))
          setLiveUpdatedAt(new Date(eventTimestamp))
        }
        return
      }

      if (!peaje) {
        if (eventTimestamp <= aggregateTimestampRef.current) {
          return
        }

        aggregateTimestampRef.current = eventTimestamp
        setLiveTotal((prev) => (prev === conteo ? prev : conteo))
        setLiveUpdatedAt(new Date(eventTimestamp))
      }
    })

    socket.on("disconnect", () => {
      setIsConnected(false)
    })

    return () => {
      normalizedPeajes.forEach((nombrePeaje) => {
        socket.emit("unsubscribe-transito-hoy", { nombrePeaje })
      })
      socket.emit("unsubscribe-transito-hoy")
      socket.disconnect()
    }
  }, [normalizedPeajes])

  return { liveTotal, liveUpdatedAt, isConnected }
}
