import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { AlertCircle, ArrowUpDown, CalendarIcon, ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText, FileX, Info, Mail, MoreHorizontal, Pencil, Phone, Plus, Power, PowerOff, RefreshCw, Search, SlidersHorizontal, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiFetch } from "@/lib/api"

type DescuentoRfid = {
  id: number
  apellidosYNombres: string | null
  cedulaORuc: string | null
  placa: string | null
  documentoIngreso: string | null
  fecha: string | null
  asunto: string | null
  peaje: string | null
  autorizacion: string | null
  oficioAutorizacionNegacion: string | null
  fechaAutorizacionNegacion: string | null
  vigencia: string | null
  observacion: string | null
  fechaActivacionSiryc: string | null
  fechaVencimientoReal: string | null
  ultimaPasadaConDescuentoNoAutorizado: string | null
  correo: string | null
  telefono: string | null
  activo: boolean | null
}

type DescuentosRfidResponse = DescuentoRfid[] | { data?: DescuentoRfid[] }
type SortByVigencia = "asc" | "desc"
type AuthorizationTab = "approved" | "rejected" | "pending"

type CreateFormState = {
  apellidosYNombres: string
  cedulaORuc: string
  placa: string
  documentoIngreso: string
  asunto: string
  peaje: string
  autorizacion: string
  oficioAutorizacionNegacion: string
  observacion: string
}

const initialCreateFormState: CreateFormState = {
  apellidosYNombres: "",
  cedulaORuc: "",
  placa: "",
  documentoIngreso: "",
  asunto: "",
  peaje: "",
  autorizacion: "",
  oficioAutorizacionNegacion: "",
  observacion: "",
}

type EditFormState = {
  apellidosYNombres: string
  cedulaORuc: string
  placa: string
  documentoIngreso: string
  asunto: string
  peaje: string
  autorizacion: string
  oficioAutorizacionNegacion: string
  observacion: string
  correo: string
  telefono: string
}

const initialEditFormState: EditFormState = {
  apellidosYNombres: "",
  cedulaORuc: "",
  placa: "",
  documentoIngreso: "",
  asunto: "",
  peaje: "",
  autorizacion: "",
  oficioAutorizacionNegacion: "",
  observacion: "",
  correo: "",
  telefono: "",
}

function getStoredAccessToken(): string {
  if (typeof window === "undefined") return ""

  const sessionToken = sessionStorage.getItem("access_token") || ""
  if (sessionToken) return sessionToken

  return localStorage.getItem("access_token") || ""
}

function formatDate(value: string | null) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

type VigenciaStatus = "expired" | "near" | "valid" | "none"

function getVigenciaStatus(value: string | null): VigenciaStatus {
  if (!value) return "none"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "none"
  const now = Date.now()
  const diff = date.getTime() - now
  if (diff < 0) return "expired"
  if (diff < 30 * 24 * 60 * 60 * 1000) return "near"
  return "valid"
}

const vigenciaStatusClasses: Record<VigenciaStatus, string> = {
  expired: "bg-rose-50 text-rose-700 border-rose-200",
  near: "bg-amber-50 text-amber-700 border-amber-200",
  valid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  none: "hidden",
}

const vigenciaStatusLabels: Record<VigenciaStatus, string> = {
  expired: "Vencido",
  near: "Por vencer",
  valid: "Vigente",
  none: "",
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").toLowerCase()
}

function displayText(value: string | null | undefined) {
  const safeValue = String(value || "").trim()
  return safeValue || "-"
}

function formatPickerDate(date: Date | undefined) {
  if (!date) return null
  return date.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function DatePickerField({
  label,
  date,
  onSelect,
  open,
  onOpenChange,
}: {
  label: string
  date: Date | undefined
  onSelect: (date: Date | undefined) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start gap-2 text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            {date ? formatPickerDate(date) : "Seleccionar fecha"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              onSelect(d)
              onOpenChange(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ----- Report Generation -----

type ReportType =
  | "listado-general"
  | "proximos-vencer"
  | "vencidos-activos"
  | "por-peaje"
  | "altas-mes"
  | "pasadas-no-autorizadas"

const REPORT_TYPES: ReportType[] = [
  "listado-general",
  "proximos-vencer",
  "vencidos-activos",
  "por-peaje",
  "altas-mes",
  "pasadas-no-autorizadas",
]

const REPORT_LABELS: Record<ReportType, string> = {
  "listado-general": "Listado General (vista actual)",
  "proximos-vencer": "Próximos a Vencer (60 días)",
  "vencidos-activos": "Vencidos con Descuento Activo",
  "por-peaje": "Por Peaje",
  "altas-mes": "Altas del Mes Actual",
  "pasadas-no-autorizadas": "Pasadas No Autorizadas",
}

const FILENAME_MAP: Record<ReportType, string> = {
  "listado-general": "rfid-listado-general",
  "proximos-vencer": "rfid-proximos-vencer",
  "vencidos-activos": "rfid-vencidos-activos",
  "por-peaje": "rfid-por-peaje",
  "altas-mes": "rfid-altas-mes",
  "pasadas-no-autorizadas": "rfid-pasadas-no-autorizadas",
}

const PDF_COLUMNS = ["Apellidos y Nombres", "Cédula/RUC", "Placa", "Peaje", "Autorización", "Vigencia", "Vencimiento", "Estado"]

const EXCEL_HEADERS = [
  "Apellidos y Nombres", "Cédula/RUC", "Placa", "Doc. Ingreso",
  "Fecha Ingreso", "Asunto", "Peaje", "Autorización", "Vigencia",
  "Fecha Vencimiento", "Estado", "Correo", "Teléfono",
  "Observación", "Última Pasada No Aut.",
]

function loadLogoAsDataURL(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("No canvas 2d context")); return }
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = reject
    img.src = "/LOGO-COSAD25.webp"
  })
}

function mapRowForPDF(row: DescuentoRfid): string[] {
  return [
    displayText(row.apellidosYNombres),
    displayText(row.cedulaORuc),
    displayText(row.placa),
    displayText(row.peaje),
    displayText(row.autorizacion),
    formatDate(row.vigencia),
    formatDate(row.fechaVencimientoReal),
    row.activo === true ? "Activo" : row.activo === false ? "Inactivo" : "-",
  ]
}

function mapRowForExcel(row: DescuentoRfid): string[] {
  return [
    displayText(row.apellidosYNombres),
    displayText(row.cedulaORuc),
    displayText(row.placa),
    displayText(row.documentoIngreso),
    formatDate(row.fecha),
    displayText(row.asunto),
    displayText(row.peaje),
    displayText(row.autorizacion),
    formatDate(row.vigencia),
    formatDate(row.fechaVencimientoReal),
    row.activo === true ? "Activo" : row.activo === false ? "Inactivo" : "-",
    displayText(row.correo),
    displayText(row.telefono),
    displayText(row.observacion),
    formatDate(row.ultimaPasadaConDescuentoNoAutorizado),
  ]
}

function getReportRows(type: ReportType, rows: DescuentoRfid[], filteredRows: DescuentoRfid[]): DescuentoRfid[] {
  if (type === "listado-general") return filteredRows
  if (type === "por-peaje") return rows
  const now = Date.now()
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000
  if (type === "proximos-vencer") {
    return rows.filter((r) => {
      if (!r.fechaVencimientoReal) return false
      const d = new Date(r.fechaVencimientoReal).getTime()
      return !Number.isNaN(d) && d > now && d - now <= sixtyDaysMs
    })
  }
  if (type === "vencidos-activos") {
    return rows.filter((r) => {
      if (!r.fechaVencimientoReal || r.activo !== true) return false
      const d = new Date(r.fechaVencimientoReal).getTime()
      return !Number.isNaN(d) && d < now
    })
  }
  if (type === "altas-mes") {
    const current = new Date()
    const y = current.getFullYear()
    const m = current.getMonth()
    return rows.filter((r) => {
      if (!r.fecha) return false
      const d = new Date(r.fecha)
      return d.getFullYear() === y && d.getMonth() === m
    })
  }
  if (type === "pasadas-no-autorizadas") {
    return rows.filter((r) => Boolean(r.ultimaPasadaConDescuentoNoAutorizado))
  }
  return rows
}

async function generatePDF(type: ReportType, rows: DescuentoRfid[], filteredRows: DescuentoRfid[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const reportTitle = REPORT_LABELS[type]
  const dateStr = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  let logoDataUrl: string | null = null
  try { logoDataUrl = await loadLogoAsDataURL() } catch { /* sin logo */ }

  const drawHeader = (title: string) => {
    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, "PNG", 10, 6, 52, 14) } catch { /* skip */ }
    }
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 58, 95)
    doc.text(title, pageW / 2, 13, { align: "center" })
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(107, 114, 128)
    doc.text("Sistema de Peajes COSAD25", pageW / 2, 18, { align: "center" })
    doc.text(dateStr, pageW - 10, 13, { align: "right" })
    doc.setDrawColor(30, 58, 95)
    doc.setLineWidth(0.4)
    doc.line(10, 23, pageW - 10, 23)
  }

  const renderTable = (data: DescuentoRfid[], startY = 28) => {
    autoTable(doc, {
      head: [PDF_COLUMNS],
      body: data.map(mapRowForPDF),
      startY,
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: {
        fillColor: [30, 58, 95] as [number, number, number],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [240, 244, 248] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 28 },
        2: { cellWidth: 20 },
        3: { cellWidth: 30 },
        4: { cellWidth: 24 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 18 },
      },
      margin: { left: 10, right: 10, top: 28 },
      didDrawPage: (hookData: any) => {
        const pageCount = (doc.internal as any).getNumberOfPages()
        doc.setFontSize(7.5)
        doc.setTextColor(160)
        doc.text(
          `Generado por Sistema COSAD25  ·  Página ${hookData.pageNumber} de ${pageCount}`,
          pageW / 2,
          pageH - 5,
          { align: "center" },
        )
      },
    })
  }

  if (type === "por-peaje") {
    const congoma = rows.filter((r) => normalizeText(r.peaje).includes("congoma"))
    const losAngeles = rows.filter((r) => normalizeText(r.peaje).includes("angeles"))
    drawHeader("Descuentos RFID — Peaje CONGOMA")
    renderTable(congoma)
    doc.addPage()
    drawHeader("Descuentos RFID — Peaje LOS ANGELES")
    renderTable(losAngeles)
  } else {
    drawHeader(`Descuentos RFID — ${reportTitle}`)
    renderTable(getReportRows(type, rows, filteredRows))
  }

  doc.save(`${FILENAME_MAP[type]}.pdf`)
}

async function generateExcel(type: ReportType, rows: DescuentoRfid[], filteredRows: DescuentoRfid[]) {
  const exceljs = await import("exceljs")
  const ExcelJS = (exceljs as any).default ?? exceljs
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistema COSAD25"
  workbook.created = new Date()

  const dateStr = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" })
  const colCount = EXCEL_HEADERS.length

  const setupSheet = (sheet: any, data: DescuentoRfid[], title: string) => {
    // Row 1: Title
    sheet.addRow([title])
    sheet.mergeCells(1, 1, 1, colCount)
    const titleCell = sheet.getRow(1).getCell(1)
    titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14, name: "Calibri" }
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } }
    titleCell.alignment = { vertical: "middle", horizontal: "center" }
    sheet.getRow(1).height = 32

    // Row 2: Date
    sheet.addRow([`Generado el: ${dateStr}  ·  Sistema COSAD25`])
    sheet.mergeCells(2, 1, 2, colCount)
    const subtitleCell = sheet.getRow(2).getCell(1)
    subtitleCell.font = { color: { argb: "FF6b7280" }, size: 9, name: "Calibri" }
    subtitleCell.alignment = { horizontal: "right" }
    subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf1f5f9" } }
    sheet.getRow(2).height = 18

    // Row 3: Headers
    sheet.addRow(EXCEL_HEADERS)
    const headerRow = sheet.getRow(3)
    headerRow.height = 22
    headerRow.eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Calibri" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563eb" } }
      cell.alignment = { vertical: "middle", horizontal: "center" }
      cell.border = {
        top: { style: "thin", color: { argb: "FF1d4ed8" } },
        bottom: { style: "thin", color: { argb: "FF1d4ed8" } },
        left: { style: "thin", color: { argb: "FF1d4ed8" } },
        right: { style: "thin", color: { argb: "FF1d4ed8" } },
      }
    })

    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 3, topLeftCell: "A4", activeCell: "A4" }]

    // Data rows
    data.forEach((row, i) => {
      sheet.addRow(mapRowForExcel(row))
      const dataRow = sheet.getRow(4 + i)
      dataRow.height = 17
      const isEven = i % 2 === 0
      dataRow.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" } }
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFe2e8f0" } },
          right: { style: "thin", color: { argb: "FFe2e8f0" } },
        }
        cell.font = { size: 9, name: "Calibri" }
      })
    })

    // Auto column widths
    sheet.columns.forEach((col: any, ci: number) => {
      const maxContent = data.reduce((max, row) => Math.max(max, String(mapRowForExcel(row)[ci] ?? "").length), 0)
      const headerLen = EXCEL_HEADERS[ci]?.length ?? 10
      col.width = Math.min(Math.max(maxContent, headerLen) + 3, 45)
    })
  }

  if (type === "por-peaje") {
    const congoma = rows.filter((r) => normalizeText(r.peaje).includes("congoma"))
    const losAngeles = rows.filter((r) => normalizeText(r.peaje).includes("angeles"))
    setupSheet(workbook.addWorksheet("CONGOMA"), congoma, "Descuentos RFID — Peaje CONGOMA")
    setupSheet(workbook.addWorksheet("LOS ANGELES"), losAngeles, "Descuentos RFID — Peaje LOS ANGELES")
  } else {
    setupSheet(
      workbook.addWorksheet(REPORT_LABELS[type].slice(0, 31)),
      getReportRows(type, rows, filteredRows),
      `Descuentos RFID — ${REPORT_LABELS[type]}`,
    )
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${FILENAME_MAP[type]}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function DescuentosRfidAdmin() {
  const [rows, setRows] = React.useState<DescuentoRfid[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchText, setSearchText] = React.useState("")
  const [selectedPeaje, setSelectedPeaje] = React.useState("all")
  const [vigenciaSort, setVigenciaSort] = React.useState<SortByVigencia>("asc")
  const [statusTab, setStatusTab] = React.useState<AuthorizationTab>("approved")
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [createForm, setCreateForm] = React.useState<CreateFormState>(initialCreateFormState)

  const [fechaDate, setFechaDate] = React.useState<Date | undefined>(undefined)
  const [fechaAutDate, setFechaAutDate] = React.useState<Date | undefined>(undefined)
  const [vigenciaDate, setVigenciaDate] = React.useState<Date | undefined>(undefined)
  const [fechaOpen, setFechaOpen] = React.useState(false)
  const [fechaAutOpen, setFechaAutOpen] = React.useState(false)
  const [vigenciaOpen, setVigenciaOpen] = React.useState(false)

  const [contactRow, setContactRow] = React.useState<DescuentoRfid | null>(null)
  const [confirmToggle, setConfirmToggle] = React.useState<DescuentoRfid | null>(null)
  const [processingId, setProcessingId] = React.useState<number | null>(null)
  const [toggleError, setToggleError] = React.useState<string | null>(null)

  const [editRow, setEditRow] = React.useState<DescuentoRfid | null>(null)
  const [editForm, setEditForm] = React.useState<EditFormState>(initialEditFormState)
  const [editFechaDate, setEditFechaDate] = React.useState<Date | undefined>(undefined)
  const [editFechaAutDate, setEditFechaAutDate] = React.useState<Date | undefined>(undefined)
  const [editVigenciaDate, setEditVigenciaDate] = React.useState<Date | undefined>(undefined)
  const [editFechaOpen, setEditFechaOpen] = React.useState(false)
  const [editFechaAutOpen, setEditFechaAutOpen] = React.useState(false)
  const [editVigenciaOpen, setEditVigenciaOpen] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)
  const [updating, setUpdating] = React.useState(false)
  const [exportLoading, setExportLoading] = React.useState(false)

  const handleCreateFieldChange = (key: keyof CreateFormState, value: string) => {
    setCreateForm((previous) => ({ ...previous, [key]: value }))
  }

  const toNullable = (value: string) => {
    const parsed = value.trim()
    return parsed ? parsed : null
  }

  const handleCreateRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError(null)

    const token = getStoredAccessToken()
    if (!token) {
      setCreateError("No hay token de acceso disponible.")
      return
    }

    setCreating(true)

    try {
      const autorizacionUpper = (createForm.autorizacion || "").toUpperCase()
      const fechaStr = fechaDate ? fechaDate.toISOString().split("T")[0] : null
      const fechaAutStr = fechaAutDate ? fechaAutDate.toISOString().split("T")[0] : null
      const vigenciaStr = vigenciaDate ? vigenciaDate.toISOString().split("T")[0] : null

      // Derive computed dates based on authorization status
      const resolvedFechaAut =
        autorizacionUpper === "PENDIENTE" ? fechaStr : fechaAutStr
      const resolvedVigencia =
        autorizacionUpper === "PENDIENTE" ? null : vigenciaStr
      const resolvedFechaVencimientoReal =
        autorizacionUpper === "PENDIENTE" ? fechaStr
        : autorizacionUpper === "NEGADO" ? fechaAutStr
        : vigenciaStr

      const payload = {
        apellidosYNombres: toNullable(createForm.apellidosYNombres),
        cedulaORuc: toNullable(createForm.cedulaORuc),
        placa: toNullable(createForm.placa),
        documentoIngreso: toNullable(createForm.documentoIngreso),
        fecha: fechaStr,
        asunto: toNullable(createForm.asunto),
        peaje: toNullable(createForm.peaje),
        autorizacion: toNullable(createForm.autorizacion),
        oficioAutorizacionNegacion: toNullable(createForm.oficioAutorizacionNegacion),
        fechaAutorizacionNegacion: resolvedFechaAut,
        vigencia: resolvedVigencia,
        ...(resolvedFechaVencimientoReal ? { fechaVencimientoReal: resolvedFechaVencimientoReal } : {}),
        observacion: toNullable(createForm.observacion),
      }

      const response = await apiFetch(`/api/v2/descuentos-rfid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const fallbackMessage = `No se pudo crear el registro (HTTP ${response.status}).`
        let message = fallbackMessage

        try {
          const errorPayload = (await response.json()) as { message?: string }
          if (errorPayload?.message) {
            message = errorPayload.message
          }
        } catch {
          // Mantener fallback cuando backend no responde JSON.
        }

        throw new Error(message)
      }

      setCreateForm(initialCreateFormState)
      setFechaDate(undefined)
      setFechaAutDate(undefined)
      setVigenciaDate(undefined)
      setCreateDialogOpen(false)
      await fetchRows()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "No se pudo crear el registro.")
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async () => {
    if (!confirmToggle) return
    setToggleError(null)
    setProcessingId(confirmToggle.id)

    try {
      const response = await apiFetch(`/api/v2/descuentos-rfid/${confirmToggle.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ activo: !confirmToggle.activo }),
      })

      if (!response.ok) {
        const fallbackMessage = `No se pudo actualizar el registro (HTTP ${response.status}).`
        let message = fallbackMessage
        try {
          const errorPayload = (await response.json()) as { message?: string }
          if (errorPayload?.message) message = errorPayload.message
        } catch { /* mantener fallback */ }
        throw new Error(message)
      }

      setConfirmToggle(null)
      await fetchRows()
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "No se pudo actualizar el registro.")
    } finally {
      setProcessingId(null)
    }
  }

  const handleEditOpen = (row: DescuentoRfid) => {
    const parseDate = (str: string | null): Date | undefined => {
      if (!str) return undefined
      const d = new Date(str)
      return Number.isNaN(d.getTime()) ? undefined : d
    }
    setEditRow(row)
    setEditError(null)
    setEditForm({
      apellidosYNombres: row.apellidosYNombres || "",
      cedulaORuc: row.cedulaORuc || "",
      placa: row.placa || "",
      documentoIngreso: row.documentoIngreso || "",
      asunto: row.asunto || "",
      peaje: row.peaje || "",
      autorizacion: row.autorizacion || "",
      oficioAutorizacionNegacion: row.oficioAutorizacionNegacion || "",
      observacion: row.observacion || "",
      correo: row.correo || "",
      telefono: row.telefono || "",
    })
    setEditFechaDate(parseDate(row.fecha))
    setEditFechaAutDate(parseDate(row.fechaAutorizacionNegacion))
    setEditVigenciaDate(parseDate(row.vigencia))
  }

  const handleEditFieldChange = (key: keyof EditFormState, value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleUpdateRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editRow) return
    setEditError(null)
    setUpdating(true)
    try {
      const autorizacionUpper = (editForm.autorizacion || "").toUpperCase()
      const fechaStr = editFechaDate ? editFechaDate.toISOString().split("T")[0] : null
      const fechaAutStr = editFechaAutDate ? editFechaAutDate.toISOString().split("T")[0] : null
      const vigenciaStr = editVigenciaDate ? editVigenciaDate.toISOString().split("T")[0] : null

      const resolvedFechaAut =
        autorizacionUpper === "PENDIENTE" ? fechaStr : fechaAutStr
      const resolvedVigencia =
        autorizacionUpper === "PENDIENTE" ? null : vigenciaStr
      const resolvedFechaVencimientoReal =
        autorizacionUpper === "PENDIENTE" ? fechaStr
        : autorizacionUpper === "NEGADO" ? fechaAutStr
        : vigenciaStr

      const payload = {
        apellidosYNombres: toNullable(editForm.apellidosYNombres),
        cedulaORuc: toNullable(editForm.cedulaORuc),
        placa: toNullable(editForm.placa),
        documentoIngreso: toNullable(editForm.documentoIngreso),
        fecha: fechaStr,
        asunto: toNullable(editForm.asunto),
        peaje: toNullable(editForm.peaje),
        autorizacion: toNullable(editForm.autorizacion),
        oficioAutorizacionNegacion: toNullable(editForm.oficioAutorizacionNegacion),
        fechaAutorizacionNegacion: resolvedFechaAut,
        vigencia: resolvedVigencia,
        ...(resolvedFechaVencimientoReal ? { fechaVencimientoReal: resolvedFechaVencimientoReal } : {}),
        observacion: toNullable(editForm.observacion),
        correo: toNullable(editForm.correo),
        telefono: toNullable(editForm.telefono),
      }
      
      const response = await apiFetch(`/api/v2/descuentos-rfid/${editRow.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const fallbackMessage = `No se pudo actualizar el registro (HTTP ${response.status}).`
        let message = fallbackMessage
        try {
          const ep = (await response.json()) as { message?: string }
          if (ep?.message) message = ep.message
        } catch { /* mantener fallback */ }
        throw new Error(message)
      }
      setEditRow(null)
      await fetchRows()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "No se pudo actualizar el registro.")
    } finally {
      setUpdating(false)
    }
  }

  const isApproved = (value: string | null | undefined) => normalizeText(value) === "aprobado"
  const isRejectedOrDenied = (value: string | null | undefined) => normalizeText(value) === "negado"
  const isPending = (value: string | null | undefined) => normalizeText(value) === "pendiente"

  const getVigenciaTimestamp = (value: string | null | undefined) => {
    if (!value) return null

    const date = new Date(value)
    const timestamp = date.getTime()
    if (Number.isNaN(timestamp)) return null

    return timestamp
  }

  const toggleVigenciaSort = () => {
    setVigenciaSort((current) => (current === "asc" ? "desc" : "asc"))
  }

  const handleExport = async (format: "pdf" | "xlsx", type: ReportType) => {
    setExportLoading(true)
    try {
      if (format === "pdf") {
        await generatePDF(type, rows, filteredRows)
      } else {
        await generateExcel(type, rows, filteredRows)
      }
    } catch (e) {
      console.error("Export error:", e)
    } finally {
      setExportLoading(false)
    }
  }

  const fetchRows = React.useCallback(async () => {
    setLoading(true)

    try {
      const response = await apiFetch(`/api/v2/descuentos-rfid`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Tu sesion expiro. Inicia sesion nuevamente.")
        }

        throw new Error(`No se pudo cargar descuentos RFID (HTTP ${response.status}).`)
      }

      const payload = (await response.json()) as DescuentosRfidResponse
      const data = Array.isArray(payload) ? payload : payload.data || []

      setRows(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : "Error inesperado al cargar descuentos RFID.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const peajes = React.useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => row.peaje)
          .filter((value): value is string => Boolean(value && value.trim())),
      ),
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
  }, [rows])

  const filteredRows = React.useMemo(() => {
    const text = searchText.trim().toLowerCase()

    return rows
      .filter((row) => {
        const matchesText =
          !text ||
          normalizeText(row.apellidosYNombres).includes(text) ||
          normalizeText(row.cedulaORuc).includes(text) ||
          normalizeText(row.placa).includes(text) ||
          normalizeText(row.documentoIngreso).includes(text)

        const matchesPeaje = selectedPeaje === "all" || displayText(row.peaje) === selectedPeaje
        const matchesTab =
          (statusTab === "approved" && isApproved(row.autorizacion)) ||
          (statusTab === "rejected" && isRejectedOrDenied(row.autorizacion)) ||
          (statusTab === "pending" && isPending(row.autorizacion))

        return matchesText && matchesPeaje && matchesTab
      })
      .sort((a, b) => {
        const dateA = getVigenciaTimestamp(a.vigencia)
        const dateB = getVigenciaTimestamp(b.vigencia)

        const hasDateA = dateA !== null
        const hasDateB = dateB !== null

        if (!hasDateA && !hasDateB) return 0
        if (!hasDateA) return 1
        if (!hasDateB) return -1

        if (vigenciaSort === "asc") {
          return dateA - dateB
        }

        return dateB - dateA
      })
  }, [rows, searchText, selectedPeaje, statusTab, vigenciaSort])

  const containerVariants = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.08 },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  }

  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.015,
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    }),
  }

  return (
    <motion.div className="space-y-6 min-w-0 w-full" variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={cardVariants}>
        <Card className="overflow-hidden border border-border/40 bg-gradient-to-r from-card to-muted/20 shadow-sm relative">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6 relative z-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Gestión de Accesos</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Descuentos RFID</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredRows.length} registros visibles de {rows.length} totales
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={fetchRows} disabled={loading} className="gap-2 shadow-sm border-dashed hover:border-solid transition-all">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>

              {/* Export DropdownMenu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={exportLoading} className="gap-2 shadow-sm">
                    {exportLoading
                      ? <RefreshCw className="h-4 w-4 animate-spin" />
                      : <Download className="h-4 w-4" />
                    }
                    Exportar
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Exportar como PDF
                  </DropdownMenuLabel>
                  {REPORT_TYPES.map((type) => (
                    <DropdownMenuItem key={`pdf-${type}`} onClick={() => handleExport("pdf", type)} className="text-sm">
                      {REPORT_LABELS[type]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2">
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                    Exportar como Excel
                  </DropdownMenuLabel>
                  {REPORT_TYPES.map((type) => (
                    <DropdownMenuItem key={`xls-${type}`} onClick={() => handleExport("xlsx", type)} className="text-sm">
                      {REPORT_LABELS[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" className="gap-2 shadow-sm">
                    <Plus className="h-4 w-4" />
                    Nuevo registro
                  </Button>
                </DialogTrigger>
                  <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Nuevo Descuento RFID</DialogTitle>
                      <DialogDescription>
                        Completa la informacion para crear un registro de descuento.
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateRecord} className="mt-4 space-y-4">
                      {/* Datos del titular */}
                      <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary/80">
                          1. Datos del titular
                        </p>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="apellidosYNombres">
                            Apellidos y nombres <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="apellidosYNombres"
                            placeholder="Ej: Garcia Lopez, Juan Carlos"
                            value={createForm.apellidosYNombres}
                            onChange={(event) =>
                              handleCreateFieldChange("apellidosYNombres", event.target.value)
                            }
                            required
                            className="bg-background"
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="cedulaORuc">Cedula / RUC</Label>
                            <Input
                              id="cedulaORuc"
                              placeholder="0000000000"
                              value={createForm.cedulaORuc}
                              onChange={(event) =>
                                handleCreateFieldChange("cedulaORuc", event.target.value)
                              }
                              className="bg-background"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="placa">Placa</Label>
                            <Input
                              id="placa"
                              placeholder="ABC-1234"
                              value={createForm.placa}
                              onChange={(event) =>
                                handleCreateFieldChange("placa", event.target.value)
                              }
                              className="bg-background"
                            />
                          </div>
                        </div>
                      </div>

                  {/* Solicitud */}
                  <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary/80">
                      2. Solicitud
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="documentoIngreso">Documento de ingreso</Label>
                        <Input
                          id="documentoIngreso"
                          placeholder="Nro. de documento"
                          value={createForm.documentoIngreso}
                          onChange={(event) =>
                            handleCreateFieldChange("documentoIngreso", event.target.value)
                          }
                          className="bg-background"
                        />
                      </div>
                      <DatePickerField
                        label="Fecha de ingreso"
                        date={fechaDate}
                        onSelect={setFechaDate}
                        open={fechaOpen}
                        onOpenChange={setFechaOpen}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="asunto">Asunto</Label>
                      <Input
                        id="asunto"
                        placeholder="Descripcion del asunto"
                        value={createForm.asunto}
                        onChange={(event) =>
                          handleCreateFieldChange("asunto", event.target.value)
                        }
                        className="bg-background"
                      />
                    </div>
                  </div>

                  {/* Resolucion */}
                  <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary/80">
                      3. Resolucion
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="peaje">Peaje</Label>
                        <Input
                          id="peaje"
                          placeholder="Nombre del peaje"
                          value={createForm.peaje}
                          onChange={(event) =>
                            handleCreateFieldChange("peaje", event.target.value)
                          }
                          className="bg-background"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Estado</Label>
                        <Select
                          value={createForm.autorizacion}
                          onValueChange={(value) =>
                            handleCreateFieldChange("autorizacion", value)
                          }
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="APROBADO">Aprobado</SelectItem>
                            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                            <SelectItem value="NEGADO">Negado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="oficioAutorizacionNegacion">
                          Oficio de autorizacion / negacion
                        </Label>
                        <Input
                          id="oficioAutorizacionNegacion"
                          placeholder="Nro. de oficio"
                          value={createForm.oficioAutorizacionNegacion}
                          onChange={(event) =>
                            handleCreateFieldChange(
                              "oficioAutorizacionNegacion",
                              event.target.value,
                            )
                          }
                          className="bg-background"
                        />
                      </div>
                      {createForm.autorizacion !== "PENDIENTE" && (
                        <DatePickerField
                          label="Fecha de autorizacion / negacion"
                          date={fechaAutDate}
                          onSelect={setFechaAutDate}
                          open={fechaAutOpen}
                          onOpenChange={setFechaAutOpen}
                        />
                      )}
                    </div>
                  </div>

                  {/* Vigencia */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary/80">
                        4. Vigencia
                      </p>
                      {createForm.autorizacion === "PENDIENTE" ? (
                        <p className="text-xs text-muted-foreground">
                          Se asignará automáticamente la fecha de ingreso.
                        </p>
                      ) : (
                        <DatePickerField
                          label="Fecha de vigencia final"
                          date={vigenciaDate}
                          onSelect={setVigenciaDate}
                          open={vigenciaOpen}
                          onOpenChange={setVigenciaOpen}
                        />
                      )}
                    </div>

                    <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-primary/80">
                        5. Observación
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="observacion">Notas finales</Label>
                        <Input
                          id="observacion"
                          placeholder="Detalles adicionales (opcional)"
                          value={createForm.observacion}
                          onChange={(event) =>
                            handleCreateFieldChange("observacion", event.target.value)
                          }
                          className="bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {createError && <p className="text-sm text-destructive">{createError}</p>}

                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline">
                            Cerrar
                          </Button>
                        </DialogClose>
                        <Button type="submit" disabled={creating}>
                          {creating ? "Creando..." : "Guardar registro"}
                        </Button>
                      </DialogFooter>
                    </form>
                </DialogContent>
                </Dialog>
              </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-2 gap-4">
        <Tabs value={statusTab} onValueChange={(value) => setStatusTab(value as AuthorizationTab)} className="w-full md:w-auto max-w-full overflow-x-auto">
          <TabsList className="bg-muted/40 border border-border/40 shadow-sm p-1 rounded-xl inline-flex h-auto w-max">
            <TabsTrigger 
              value="approved"
              className="rounded-lg px-4 py-1.5 font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Aprobados
            </TabsTrigger>
            <TabsTrigger 
              value="rejected"
              className="rounded-lg px-4 py-1.5 font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Negados
            </TabsTrigger>
            <TabsTrigger 
              value="pending"
              className="rounded-lg px-4 py-1.5 font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Pendientes
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-2 grid-cols-1 sm:grid-cols-[1fr_220px] w-full md:w-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-full sm:w-64 pl-9 bg-background shadow-sm"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar registro..."
            />
          </div>
          <Select value={selectedPeaje} onValueChange={setSelectedPeaje}>
            <SelectTrigger className="bg-background shadow-sm">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por peaje" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los peajes</SelectItem>
              {peajes.map((peaje) => (
                <SelectItem key={peaje} value={peaje}>
                  {peaje}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <motion.div variants={cardVariants}>
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <CardContent className="p-0">
          {loading && (
            <div className="divide-y overflow-hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4">
                  {/* Titular / Cédula */}
                  <div className="flex flex-col gap-2 w-32 sm:w-48 shrink-0">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  {/* Vehículo */}
                  <Skeleton className="h-4 w-20 sm:w-28 shrink-0" />
                  {/* Peaje */}
                  <Skeleton className="h-4 w-24 shrink-0 hidden sm:block" />
                  {/* Estado */}
                  <Skeleton className="h-5 w-20 shrink-0 rounded-full hidden md:block" />
                  {/* Vigencia */}
                  <Skeleton className="h-4 w-24 shrink-0 hidden lg:block" />
                  {/* Resolución */}
                  <Skeleton className="h-4 w-32 shrink-0 hidden xl:block" />
                  {/* Acciones */}
                  <div className="ml-auto">
                    <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-destructive">Error al cargar</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRows} className="mt-1 gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && filteredRows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileX className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Sin resultados</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ningun registro coincide con los filtros aplicados.
              </p>
            </div>
          </div>
        )}

          {!loading && !error && filteredRows.length > 0 && (
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Titular / Cédula
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vehículo
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                      Peaje
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      Estado
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <button
                        type="button"
                        onClick={toggleVigenciaSort}
                        className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground"
                      >
                        Vigencia
                        {vigenciaSort === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : vigenciaSort === "desc" ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                      Resolución
                    </th>
                    <th className="w-16 px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => {
                    const vigStatus = getVigenciaStatus(row.vigencia)
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "group transition-colors hover:bg-muted/30 border-b border-border/40 last:border-0",
                          index % 2 === 0 ? "bg-card" : "bg-card/40",
                        )}
                      >
                      <td className="px-5 py-4 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ring-2 ring-background",
                            row.activo === false ? "bg-rose-500/15 text-rose-700" : "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground"
                          )}>
                            {String(row.apellidosYNombres || "U").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors pr-2 break-words">
                              {displayText(row.apellidosYNombres)}
                            </p>
                            <div className="mt-0.5 text-xs text-muted-foreground flex gap-2 items-center flex-wrap">
                              <span className="break-all">{displayText(row.cedulaORuc)}</span>
                              {row.activo === false && <Badge variant="outline" className="text-[9px] uppercase font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0 rounded-sm border-rose-200">Inactivo</Badge>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {row.placa ? (
                          <Badge variant="outline" className="bg-muted/40 font-mono text-xs font-semibold uppercase tracking-widest text-foreground/80 break-words text-center">
                            {row.placa}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground font-medium hidden sm:table-cell">
                        {displayText(row.peaje)}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "px-2.5 py-0.5 whitespace-nowrap",
                            isApproved(row.autorizacion)
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"
                              : isPending(row.autorizacion)
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-400 hover:bg-rose-500/25",
                          )}
                        >
                          {displayText(row.autorizacion)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium whitespace-nowrap">{formatDate(row.vigencia)}</p>
                        {vigenciaStatusLabels[vigStatus] && (
                          <Badge variant="secondary" className={cn("mt-1.5 text-[10px] px-2 py-0 uppercase tracking-widest block w-max", vigenciaStatusClasses[vigStatus])}>
                            {vigenciaStatusLabels[vigStatus]}
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 max-w-[200px] hidden lg:table-cell">
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground/80 truncate block font-medium" title={displayText(row.documentoIngreso)}>
                            Doc: {displayText(row.documentoIngreso)}
                          </span>
                          <span className="text-xs text-muted-foreground truncate block mt-0.5" title={displayText(row.asunto)}>
                            {displayText(row.asunto)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-60 hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Acciones</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setContactRow(row)}>
                              <Info className="mr-2 h-4 w-4" />
                              Info de contacto
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditOpen(row)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar información
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setToggleError(null)
                                setConfirmToggle(row)
                              }}
                              className={row.activo === false ? "text-emerald-600 focus:text-emerald-600" : "text-rose-600 focus:text-rose-600"}
                            >
                              {row.activo === false ? (
                                <Power className="mr-2 h-4 w-4" />
                              ) : (
                                <PowerOff className="mr-2 h-4 w-4" />
                              )}
                              {row.activo === false ? "Activar usuario" : "Desactivar usuario"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
      </motion.div>

      {/* Contact Info Dialog */}
      <Dialog open={contactRow !== null} onOpenChange={(open) => { if (!open) setContactRow(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Informacion de contacto</DialogTitle>
            <DialogDescription>
              Datos de contacto del titular del descuento RFID.
            </DialogDescription>
          </DialogHeader>
          {contactRow && (
            <div className="mt-2 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Titular
                </p>
                <p className="mt-1 text-sm font-medium">{displayText(contactRow.apellidosYNombres)}</p>
                <p className="text-xs text-muted-foreground">{displayText(contactRow.cedulaORuc)}</p>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15">
                    <Mail className="h-4 w-4 text-sky-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Correo electronico</p>
                    <p className="text-sm font-medium">
                      {contactRow.correo ? (
                        <a
                          href={`mailto:${contactRow.correo}`}
                          className="text-sky-600 hover:underline"
                        >
                          {contactRow.correo}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Phone className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefono</p>
                    <p className="text-sm font-medium">
                      {contactRow.telefono ? (
                        <a
                          href={`tel:${contactRow.telefono}`}
                          className="text-emerald-600 hover:underline"
                        >
                          {contactRow.telefono}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estado del usuario</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                    contactRow.activo === false
                      ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
                      : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
                  )}
                >
                  {contactRow.activo === false ? "Inactivo" : "Activo"}
                </span>
              </div>
            </div>
          )}
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={editRow !== null} onOpenChange={(open) => { if (!open) setEditRow(null) }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>
              Modifica los datos del descuento RFID.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateRecord} className="mt-4 space-y-4">
            <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/80">1. Datos del Titular</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-apellidos">Apellidos y nombres <span className="text-destructive">*</span></Label>
                <Input id="edit-apellidos" className="bg-background" placeholder="Ej: Garcia Lopez, Juan Carlos" value={editForm.apellidosYNombres} onChange={(e) => handleEditFieldChange("apellidosYNombres", e.target.value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-cedula">Cedula / RUC</Label>
                  <Input id="edit-cedula" className="bg-background" value={editForm.cedulaORuc} onChange={(e) => handleEditFieldChange("cedulaORuc", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-placa">Placa</Label>
                  <Input id="edit-placa" className="bg-background" value={editForm.placa} onChange={(e) => handleEditFieldChange("placa", e.target.value)} />
                </div>
              </div>
            </div>
            
            <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/80">2. Contacto</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-correo">Correo electrónico</Label>
                  <Input id="edit-correo" className="bg-background" type="email" placeholder="correo@ejemplo.com" value={editForm.correo} onChange={(e) => handleEditFieldChange("correo", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-tel">Teléfono</Label>
                  <Input id="edit-tel" className="bg-background" placeholder="09XXXXXXXX" value={editForm.telefono} onChange={(e) => handleEditFieldChange("telefono", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm h-full">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/80">3. Solicitud</p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-doc">Documento de ingreso</Label>
                  <Input id="edit-doc" className="bg-background" value={editForm.documentoIngreso} onChange={(e) => handleEditFieldChange("documentoIngreso", e.target.value)} />
                </div>
                <DatePickerField label="Fecha de ingreso" date={editFechaDate} onSelect={setEditFechaDate} open={editFechaOpen} onOpenChange={setEditFechaOpen} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-asunto">Asunto</Label>
                  <Input id="edit-asunto" className="bg-background" value={editForm.asunto} onChange={(e) => handleEditFieldChange("asunto", e.target.value)} />
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm h-full">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/80">4. Resolución</p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-peaje">Peaje</Label>
                  <Input id="edit-peaje" className="bg-background" value={editForm.peaje} onChange={(e) => handleEditFieldChange("peaje", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Estado</Label>
                  <Select value={editForm.autorizacion} onValueChange={(v) => handleEditFieldChange("autorizacion", v)}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APROBADO">Aprobado</SelectItem>
                      <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                      <SelectItem value="NEGADO">Negado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-oficio">Oficio (aut/neg)</Label>
                  <Input id="edit-oficio" className="bg-background" value={editForm.oficioAutorizacionNegacion} onChange={(e) => handleEditFieldChange("oficioAutorizacionNegacion", e.target.value)} />
                </div>
                {editForm.autorizacion !== "PENDIENTE" && (
                  <DatePickerField label="Fecha de resolución" date={editFechaAutDate} onSelect={setEditFechaAutDate} open={editFechaAutOpen} onOpenChange={setEditFechaAutOpen} />
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/80">5. Vigencia</p>
                {editForm.autorizacion === "PENDIENTE" ? (
                  <p className="text-xs text-muted-foreground">
                    Se asignará automáticamente la fecha de ingreso.
                  </p>
                ) : (
                  <DatePickerField label="Fecha de vigencia final" date={editVigenciaDate} onSelect={setEditVigenciaDate} open={editVigenciaOpen} onOpenChange={setEditVigenciaOpen} />
                )}
              </div>
              <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-primary/80">6. Notas finales</p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-obs">Observacion</Label>
                  <Input id="edit-obs" className="bg-background" placeholder="Detalles adicionales (opcional)" value={editForm.observacion} onChange={(e) => handleEditFieldChange("observacion", e.target.value)} />
                </div>
              </div>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cerrar</Button>
              </DialogClose>
              <Button type="submit" disabled={updating}>
                {updating ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Toggle Active Dialog */}
      <Dialog open={confirmToggle !== null} onOpenChange={(open) => { if (!open) { setConfirmToggle(null); setToggleError(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmToggle?.activo === false ? "Activar usuario" : "Desactivar usuario"}
            </DialogTitle>
            <DialogDescription>
              {confirmToggle?.activo === false
                ? "El usuario volvera a tener acceso al descuento RFID."
                : "El usuario perdera temporalmente el acceso al descuento RFID."}
            </DialogDescription>
          </DialogHeader>
          {confirmToggle && (
            <div className="rounded-md border bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium">{displayText(confirmToggle.apellidosYNombres)}</p>
              <p className="text-xs text-muted-foreground">
                {displayText(confirmToggle.cedulaORuc)} &middot; {displayText(confirmToggle.placa)}
              </p>
            </div>
          )}
          {toggleError && (
            <p className="text-sm text-destructive">{toggleError}</p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={processingId !== null}>Cancelar</Button>
            </DialogClose>
            <Button
              variant={confirmToggle?.activo === false ? "default" : "destructive"}
              onClick={handleToggleActive}
              disabled={processingId !== null}
            >
              {processingId !== null
                ? "Procesando..."
                : confirmToggle?.activo === false
                  ? "Activar"
                  : "Desactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
