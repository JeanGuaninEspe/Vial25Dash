export const DASHBOARD_ALLOWED_ROLES = ["ADMIN", "FINANCIERO", "GERENTE"] as const
export const RFID_ALLOWED_ROLES = [
  "ADMIN",
  "FINANCIERO",
  "GERENTE",
  "JURIDICO",
  "SECRETARIA",
  "USER"
] as const

export type AllowedDashboardRole = (typeof DASHBOARD_ALLOWED_ROLES)[number]
export type AllowedRfidRole = (typeof RFID_ALLOWED_ROLES)[number]

export function normalizeRole(role: string | null | undefined) {
  return String(role || "").trim().toUpperCase()
}

export function canAccessDashboards(role: string | null | undefined) {
  return DASHBOARD_ALLOWED_ROLES.includes(normalizeRole(role) as AllowedDashboardRole)
}

export function canAccessRfidModule(role: string | null | undefined) {
  return RFID_ALLOWED_ROLES.includes(normalizeRole(role) as AllowedRfidRole)
}

export const ADMIN_PANEL_ROLES = ["ADMIN", "FINANCIERO"] as const
export type AllowedAdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number]

export function canAccessAdminPanel(role: string | null | undefined) {
  return ADMIN_PANEL_ROLES.includes(normalizeRole(role) as AllowedAdminPanelRole)
}
