/**
 * Cliente API para el Microservicio de Gestión y Analítica de Rescate Vial (FastAPI + SQL Server).
 */

const RESCATE_VIAL_BASE_URL =
  import.meta.env.PUBLIC_RESCATE_VIAL_API_URL || "http://localhost:8000/api/v1"

function buildUrl(endpoint: string, params?: Record<string, any>): string {
  const url = new URL(`${RESCATE_VIAL_BASE_URL.replace(/\/$/, "")}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value))
      }
    })
  }
  return url.toString()
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `Error en servidor (${res.status})`
    try {
      const json = await res.json()
      if (json.detalles && Array.isArray(json.detalles)) {
        errorDetail = json.detalles.map((d: any) => `${d.campo}: ${d.mensaje}`).join(" | ")
      } else if (json.detail) {
        errorDetail = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail)
      } else if (json.mensaje) {
        errorDetail = json.mensaje
      }
    } catch {
      errorDetail = await res.text()
    }
    throw new Error(errorDetail)
  }
  return res.json()
}

export interface KPITiemposItem {
  tipo_servicio: string
  codigo_formulario: string
  fecha?: string
  turno?: number
  abscisa_km?: number
  sentido?: string
  tiempo_despacho_arribo_min?: number
  tiempo_en_sitio_min?: number
  ciclo_total_min?: number
  km_recorridos?: number
}

export interface KPIServicioResumen {
  tipo_servicio: string
  total_eventos: number
  promedio_despacho_arribo_min?: number
  promedio_sitio_min?: number
  promedio_ciclo_total_min?: number
  total_km_recorridos?: number
}

export interface KPITiemposRespuestaResponse {
  total_registros: number
  promedio_despacho_arribo_min?: number
  promedio_sitio_min?: number
  promedio_ciclo_total_min?: number
  total_km_recorridos?: number
  resumen_por_servicio: KPIServicioResumen[]
  detalles: KPITiemposItem[]
}

export interface TramoScoringItem {
  km_inicio: number
  km_fin: number
  tramo_label: string
  total_eventos: number
  total_ambulancias: number
  total_gruas: number
  total_fatales: number
  total_graves: number
  total_leves: number
  indice_criticidad: number
  nivel_riesgo: "EXTREMO" | "ALTO" | "MEDIO" | "BAJO"
  sentido_predominante?: string
  principal_tipo_accidente?: string
  principal_motivo_o_causa?: string
  franja_horaria_mayor_incidencia?: string
  recomendacion_tactica?: string
}

export interface TramosScoringResponse {
  criterio_agrupacion_km: number
  total_tramos_analizados: number
  total_eventos_evaluados: number
  resumen_niveles_riesgo: {
    EXTREMO: number
    ALTO: number
    MEDIO: number
    BAJO: number
  }
  top_tramos_criticos: TramoScoringItem[]
}

export interface PatronHoraItem {
  hora: number
  franja_label: string
  total_eventos: number
  total_ambulancias: number
  total_gruas: number
  total_accidentes_graves_o_fatales: number
  porcentaje: number
}

export interface PatronDiaItem {
  dia_nombre: string
  total_eventos: number
  total_ambulancias: number
  total_gruas: number
  porcentaje: number
}

export interface PatronesTemporalesResponse {
  total_eventos_analizados: number
  hora_pico_maxima: string
  dia_pico_maximo: string
  eventos_fin_de_semana: number
  eventos_entre_semana: number
  porcentaje_fin_de_semana: number
  distribucion_por_franja: Record<string, number>
  distribucion_por_hora: PatronHoraItem[]
  distribucion_por_dia: PatronDiaItem[]
}

export interface RecomendacionDespliegueItem {
  prioridad: number
  recurso_recomendado: string
  tramo_cobertura: string
  horario_optimo: string
  diagnostico_problema: string
  accion_preventiva: string
  impacto_esperado: string
}

export interface RecomendacionesDespliegueResponse {
  fecha_generacion: string
  total_recomendaciones: number
  estrategia_general: string
  recomendaciones: RecomendacionDespliegueItem[]
}

export interface DashboardEjecutivoResponse {
  total_asistencias_historicas: number
  total_ambulancias: number
  total_gruas: number
  total_patrullajes: number
  tasa_accidentabilidad_porcentaje: number
  tasa_asistencia_mecanica_porcentaje: number
  km_totales_atendidos: number
  tiempo_promedio_llegada_min: number
  tiempo_promedio_sitio_min: number
  tiempo_promedio_ciclo_min: number
  tramo_mas_critico?: TramoScoringItem
  franja_horaria_mas_critica: string
  dia_mas_critico: string
  recomendacion_ejecutiva: string
}

export interface PersonalItem {
  id_personal: number
  nombre_completo: string
  rol: string
  activo: boolean
}

export interface VehiculoItem {
  id_vehiculo: number
  codigo_interno: string
  placa: string
  tipo_flota: string
  descripcion?: string
  activo: boolean
}

export const rescateVialApi = {
  // Analítica & KPIs
  getDashboardEjecutivo: async (): Promise<DashboardEjecutivoResponse> => {
    const res = await fetch(buildUrl("/analitica/dashboard-ejecutivo"))
    return handleResponse<DashboardEjecutivoResponse>(res)
  },

  getTiemposRespuesta: async (params?: {
    fecha_inicio?: string
    fecha_fin?: string
    servicio?: string
    turno?: number
    limit?: number
  }): Promise<KPITiemposRespuestaResponse> => {
    const res = await fetch(buildUrl("/analitica/tiempos-respuesta", params))
    return handleResponse<KPITiemposRespuestaResponse>(res)
  },

  getTramosScoring: async (params?: {
    tamano_tramo_km?: number
    fecha_inicio?: string
    fecha_fin?: string
    servicio?: string
    top_n?: number
  }): Promise<TramosScoringResponse> => {
    const res = await fetch(buildUrl("/analitica/tramos-criticos-scoring", params))
    return handleResponse<TramosScoringResponse>(res)
  },

  getPatronesTemporales: async (params?: {
    fecha_inicio?: string
    fecha_fin?: string
  }): Promise<PatronesTemporalesResponse> => {
    const res = await fetch(buildUrl("/analitica/patrones-temporales", params))
    return handleResponse<PatronesTemporalesResponse>(res)
  },

  getRecomendacionesDespliegue: async (): Promise<RecomendacionesDespliegueResponse> => {
    const res = await fetch(buildUrl("/analitica/recomendaciones-despliegue"))
    return handleResponse<RecomendacionesDespliegueResponse>(res)
  },

  // Catálogos
  getPersonal: async (params?: { rol?: string; activo?: boolean }): Promise<PersonalItem[]> => {
    const res = await fetch(buildUrl("/catalogos/personal", params))
    return handleResponse<PersonalItem[]>(res)
  },

  getVehiculos: async (params?: { tipo_flota?: string; activo?: boolean }): Promise<VehiculoItem[]> => {
    const res = await fetch(buildUrl("/catalogos/vehiculos", params))
    return handleResponse<VehiculoItem[]>(res)
  },

  // Operaciones (Registro)
  registrarAmbulancia: async (data: any) => {
    const res = await fetch(buildUrl("/operaciones/ambulancias"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  registrarGrua: async (data: any) => {
    const res = await fetch(buildUrl("/operaciones/gruas"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  registrarPatrullaje: async (data: any) => {
    const res = await fetch(buildUrl("/operaciones/patrullaje"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  // Reportes MTOP
  descargarReporteExcel: async (servicio: "ambulancia" | "grua" | "patrullaje", mes: number, anio: number) => {
    const url = buildUrl("/reportes-mtop/exportar-excel", { servicio, mes, anio })
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Error al generar reporte ministerial: ${res.statusText}`)
    }
    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = downloadUrl
    a.download = `reporte_mtop_${servicio}_${anio}_${String(mes).padStart(2, "0")}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(downloadUrl)
  },
}
