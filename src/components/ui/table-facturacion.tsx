import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FacturaRow = {
  FECHA_FACTURA: string
  dia: number
  mes: number
  YEAR: number
  NOMBRE_PEAJE: string
  PTO_EMISION: string
  NUM_FACTURA: string
  AUTORIZACION_SRI: string
  SUBTOTAL: number
  IVA: number
  TOTAL: number
  NUMERO_DOCUMENTO: string
  RAZON_SOCIAL: string
  PLACA: string
  CATEGORIA_FINAL: number
  TIPO: string
  TURNO: number
  FECHA_TURNO: string
  NOTA_CREDITO: string
  FECHA_NOTA_CREDITO: string | null
}

const BASE_URL = import.meta.env.PUBLIC_BASE_URL 
const ENDPOINT = "/facturacion"

export function TableFacturacion() {
  const [timeRange, setTimeRange] = React.useState("7d")
  const [peaje, setPeaje] = React.useState("all")
  const [turno, setTurno] = React.useState("all")
  const [data, setData] = React.useState<FacturaRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        
        if (timeRange === "7d") {
          params.append("rango", "ultimos7d")
          params.append("take", "1000")
        } else if (timeRange === "30d") {
          params.append("rango", "ultimoMes")
          params.append("take", "3000")
        } else if (timeRange === "mesActual") {
          params.append("rango", "mesActual")
          params.append("take", "3000")
        } else {
          params.append("take", "5000")
        }

        if (peaje !== "all") {
          params.append("nombrePeaje", peaje)
        }

        const url = `${BASE_URL}${ENDPOINT}?${params.toString()}`
        const response = await fetch(url)
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}`)
        }
        const json = (await response.json()) as FacturaRow[]
        if (isMounted) {
          setData(json)
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

  const filteredData = React.useMemo(() => {
    if (!data.length) return []

    return data
      .filter((row) => turno === "all" || String(row.TURNO) === turno)
      .sort((a, b) => new Date(b.FECHA_FACTURA).getTime() - new Date(a.FECHA_FACTURA).getTime())
  }, [data, turno])

  const totalFacturado = React.useMemo(() => {
    return filteredData.reduce((sum, row) => sum + row.TOTAL, 0)
  }, [filteredData])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 border-b py-5 sm:flex-row sm:items-center sm:gap-4">
        <div className="grid flex-1 gap-1">
          <CardTitle>Facturas Emitidas</CardTitle>
          <CardDescription>
            {filteredData.length} facturas - Total: ${totalFacturado.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px] rounded-lg" aria-label="Rango de tiempo">
              <SelectValue placeholder="Últimos 7 días" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
                <SelectItem value="mesActual" className="rounded-lg">
                  Mes actual
                </SelectItem>
              <SelectItem value="90d" className="rounded-lg">
                Últimos 90 días
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Últimos 30 días
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Últimos 7 días
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={peaje} onValueChange={setPeaje}>
            <SelectTrigger className="w-[150px] rounded-lg" aria-label="Peaje">
              <SelectValue placeholder="Todos los peajes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">
                Todos los peajes
              </SelectItem>
              <SelectItem value="CONGOMA" className="rounded-lg">
                Congoma
              </SelectItem>
              <SelectItem value="LOS ANGELES" className="rounded-lg">
                Los Angeles
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
      <CardContent className="p-0">
        {loading && (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Cargando facturas...</p>
          </div>
        )}
        {error && !loading && (
          <div className="p-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {!loading && !error && filteredData.length === 0 && (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              No hay facturas para los filtros seleccionados.
            </p>
          </div>
        )}
        {!loading && !error && filteredData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Peaje
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    N° Factura
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Placa
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                    Cat.
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                    Turno
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                    Estado SRI
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredData.map((row, idx) => {
                  // Parsear fecha local
                  const dateParts = row.FECHA_FACTURA.split('T')[0].split('-')
                  const year = parseInt(dateParts[0])
                  const month = parseInt(dateParts[1]) - 1
                  const day = parseInt(dateParts[2])
                  const fecha = new Date(year, month, day)
                  
                  return (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {fecha.toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium">{row.NOMBRE_PEAJE}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {row.NUM_FACTURA}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[200px] truncate" title={row.RAZON_SOCIAL}>
                        {row.RAZON_SOCIAL}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {row.PLACA || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {row.CATEGORIA_FINAL}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {row.TURNO}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {row.AUTORIZACION_SRI ? (
                          <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            Autorizada
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        ${row.TOTAL.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
