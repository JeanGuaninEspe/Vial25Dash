import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  CheckCircle2,
  FileX,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type UserRole = "ADMIN" | "USER" | "FINANCIERO" | "SECRETARIA" | "GERENTE" | "JURIDICO"

type SystemUser = {
  id: string
  fullName: string | null
  email: string | null
  username: string | null
  role: string | null
  isActive: boolean | null
  createdAt?: string | null
}

type UsersResponse = SystemUser[] | { data?: SystemUser[] }
type AdminTab = "usuarios" | "nuevo" | "estadisticas"

type NewUserForm = {
  fullName: string
  email: string
  password: string
}

type EditUserForm = {
  fullName: string
  email: string
  username: string
  password: string
  role: UserRole
  isActive: boolean
}

const VALID_ROLES: UserRole[] = ["ADMIN", "USER", "FINANCIERO", "SECRETARIA", "GERENTE", "JURIDICO"]

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  USER: "Usuario",
  FINANCIERO: "Financiero",
  SECRETARIA: "Secretaria",
  GERENTE: "Gerente",
  JURIDICO: "Juridico",
}

const initialNewUserForm: NewUserForm = {
  fullName: "",
  email: "",
  password: "",
}

function display(v: string | null | undefined) {
  const value = String(v || "").trim()
  return value || "—"
}

function normalizeRole(v: string | null | undefined): UserRole {
  const role = String(v || "USER").trim().toUpperCase()
  if (VALID_ROLES.includes(role as UserRole)) return role as UserRole
  return "USER"
}

function normalizeUser(raw: SystemUser): SystemUser {
  return {
    ...raw,
    role: normalizeRole(raw.role),
    isActive: raw.isActive !== false,
  }
}

function roleBadgeClass(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "bg-rose-50 text-rose-700 border-rose-200"
    case "FINANCIERO":
      return "bg-sky-50 text-sky-700 border-sky-200"
    case "SECRETARIA":
      return "bg-pink-50 text-pink-700 border-pink-200"
    case "GERENTE":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "JURIDICO":
      return "bg-teal-50 text-teal-700 border-teal-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function AdminPanel() {
  const [panelTab, setPanelTab] = React.useState<AdminTab>("usuarios")
  const [users, setUsers] = React.useState<SystemUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  const [search, setSearch] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const [viewUser, setViewUser] = React.useState<SystemUser | null>(null)
  const [editUser, setEditUser] = React.useState<SystemUser | null>(null)
  const [toggleUser, setToggleUser] = React.useState<SystemUser | null>(null)
  const [roleUser, setRoleUser] = React.useState<SystemUser | null>(null)

  const [editForm, setEditForm] = React.useState<EditUserForm | null>(null)
  const [newRole, setNewRole] = React.useState<UserRole>("USER")

  const [processingId, setProcessingId] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const [newUserForm, setNewUserForm] = React.useState<NewUserForm>(initialNewUserForm)
  const [creatingUser, setCreatingUser] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = React.useState(false)

  const fetchUsers = React.useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await apiFetch("/api/v2/users", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      })
      if (!res.ok) {
        if (res.status === 401) throw new Error("Tu sesion expiro. Inicia sesion nuevamente.")
        throw new Error(`Error al cargar usuarios (HTTP ${res.status}).`)
      }
      const payload = (await res.json()) as UsersResponse
      const rows = Array.isArray(payload) ? payload : payload.data || []
      setUsers(rows.map(normalizeUser))
    } catch (err) {
      setUsers([])
      setFetchError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  }

  const filteredUsers = React.useMemo(() => {
    const text = search.trim().toLowerCase()
    return users.filter((u) => {
      const byText =
        !text ||
        String(u.fullName || "").toLowerCase().includes(text) ||
        String(u.email || "").toLowerCase().includes(text) ||
        String(u.username || "").toLowerCase().includes(text)
      const role = normalizeRole(u.role)
      const byRole = roleFilter === "all" || role === roleFilter
      const byStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.isActive !== false) ||
        (statusFilter === "inactive" && u.isActive === false)
      return byText && byRole && byStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const stats = React.useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.isActive !== false).length
    const inactive = total - active
    const byRole = VALID_ROLES.map((role) => ({
      role,
      count: users.filter((u) => normalizeRole(u.role) === role).length,
    }))
    return { total, active, inactive, byRole }
  }, [users])

  function openEditDialog(user: SystemUser) {
    setActionError(null)
    setEditUser(user)
    setEditForm({
      fullName: String(user.fullName || ""),
      email: String(user.email || ""),
      username: String(user.username || ""),
      password: "",
      role: normalizeRole(user.role),
      isActive: user.isActive !== false,
    })
  }

  async function patchUser(id: string, payload: Record<string, unknown>) {
    const res = await apiFetch(`/api/v2/users/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      let message = `No se pudo actualizar (HTTP ${res.status}).`
      try {
        const err = (await res.json()) as { message?: string | string[] }
        if (Array.isArray(err.message)) message = err.message.join(". ")
        else if (typeof err.message === "string") message = err.message
      } catch {
        // Mantener fallback
      }
      throw new Error(message)
    }
  }

  async function changeRole(id: string, role: UserRole) {
    const res = await apiFetch(`/api/v2/users/${id}/role`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ role }),
    })
    if (!res.ok) {
      let message = `No se pudo cambiar el rol (HTTP ${res.status}).`
      try {
        const err = (await res.json()) as { message?: string | string[] }
        if (Array.isArray(err.message)) message = err.message.join(". ")
        else if (typeof err.message === "string") message = err.message
      } catch {
        // Mantener fallback
      }
      throw new Error(message)
    }
  }

  async function handleToggleActive() {
    if (!toggleUser) return
    setActionError(null)
    setProcessingId(toggleUser.id)
    try {
      await patchUser(toggleUser.id, { isActive: !(toggleUser.isActive !== false) })
      setToggleUser(null)
      await fetchUsers()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo cambiar el estado del usuario.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editUser || !editForm) return
    setActionError(null)
    setProcessingId(editUser.id)
    try {
      const payload: Record<string, unknown> = {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        username: editForm.username.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      }
      if (editForm.password.trim()) payload.password = editForm.password
      await patchUser(editUser.id, payload)
      setEditUser(null)
      setEditForm(null)
      await fetchUsers()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo editar el usuario.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleConfirmRoleChange() {
    if (!roleUser) return
    setActionError(null)
    setProcessingId(roleUser.id)
    try {
      await changeRole(roleUser.id, newRole)
      setRoleUser(null)
      await fetchUsers()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo cambiar el rol.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError(null)
    setCreateSuccess(false)

    const fullName = newUserForm.fullName.trim()
    const email = newUserForm.email.trim()
    if (!fullName) return setCreateError("El nombre completo es obligatorio.")
    if (!email) return setCreateError("El correo es obligatorio.")
    if (newUserForm.password.length < 6) {
      return setCreateError("La contrasena debe tener al menos 6 caracteres.")
    }

    setCreatingUser(true)
    try {
      const res = await apiFetch("/api/v2/users", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          password: newUserForm.password,
        }),
      })
      if (!res.ok) {
        let message = `No se pudo crear el usuario (HTTP ${res.status}).`
        try {
          const err = (await res.json()) as { message?: string | string[] }
          if (Array.isArray(err.message)) message = err.message.join(". ")
          else if (typeof err.message === "string") message = err.message
        } catch {
          // Mantener fallback
        }
        throw new Error(message)
      }

      setNewUserForm(initialNewUserForm)
      setCreateSuccess(true)
      await fetchUsers()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "No se pudo crear el usuario.")
    } finally {
      setCreatingUser(false)
    }
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-0 shadow-lg relative backdrop-blur-md bg-card/40">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 pointer-events-none" />
          <div className="absolute -left-32 -top-32 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -right-32 -bottom-32 w-64 h-64 bg-teal-500/20 rounded-full blur-[80px] pointer-events-none" />
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6 md:p-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-500 shadow-inner">
                <Users className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase tracking-widest text-[10px] font-bold">
                    Administración
                  </Badge>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Centro de Control de Usuarios
                </h2>
                <p className="mt-1 text-sm text-muted-foreground/80 max-w-xl">
                  Administra accesos, asigna roles de seguridad y supervisa la actividad del equipo desde un solo panel integrado.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              disabled={loading}
              className="gap-2 shadow-sm border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all backdrop-blur-md bg-background/50 h-10 px-5 rounded-full"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Sincronizar Datos
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={panelTab} onValueChange={(v) => setPanelTab(v as AdminTab)}>
        <motion.div variants={itemVariants} className="flex justify-between items-end border-b border-border/20 pb-2">
          <TabsList className="bg-transparent h-auto p-0 inline-flex space-x-2 sm:space-x-6">
            <TabsTrigger 
              value="usuarios" 
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 text-muted-foreground border border-transparent data-[state=active]:border-emerald-500/20 rounded-full px-4 py-2 transition-all"
            >
              <Users className="mr-2 h-4 w-4" />
              Directorio
            </TabsTrigger>
            <TabsTrigger 
              value="nuevo"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 text-muted-foreground border border-transparent data-[state=active]:border-emerald-500/20 rounded-full px-4 py-2 transition-all"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Alta de Usuario
            </TabsTrigger>
            <TabsTrigger 
              value="estadisticas"
              className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 text-muted-foreground border border-transparent data-[state=active]:border-emerald-500/20 rounded-full px-4 py-2 transition-all"
            >
              <Shield className="mr-2 h-4 w-4" />
              Métricas y Roles
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {!loading && fetchError && (
          <motion.div variants={itemVariants} className="mt-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive shadow-sm backdrop-blur-md">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="font-medium">{fetchError}</p>
          </motion.div>
        )}

        <TabsContent value="usuarios" className="mt-6 space-y-6 outline-none">
          <motion.div variants={containerVariants} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} className="h-full group">
              <Card className="h-full border-border/20 shadow-sm hover:shadow-xl transition-all backdrop-blur-md bg-card/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users className="w-16 h-16 text-primary" />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Usuarios</p>
                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary ring-1 ring-primary/20"><Users className="h-4 w-4"/></div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-foreground">{stats.total}</p>
                    <span className="text-sm font-medium text-muted-foreground">registrados</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} className="h-full group">
              <Card className="h-full border-emerald-500/20 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all backdrop-blur-md bg-emerald-50/10 dark:bg-emerald-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Usuarios Activos</p>
                    <div className="bg-emerald-500/15 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]"><CheckCircle2 className="h-4 w-4"/></div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-emerald-700 dark:text-emerald-400">{stats.active}</p>
                    <span className="text-sm font-medium text-emerald-600/70 dark:text-emerald-400/70">con acceso</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }} className="h-full group">
              <Card className="h-full border-rose-500/20 shadow-sm hover:shadow-xl hover:shadow-rose-500/10 transition-all backdrop-blur-md bg-rose-50/10 dark:bg-rose-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <PowerOff className="w-16 h-16 text-rose-500" />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Usuarios Inactivos</p>
                    <div className="bg-rose-500/15 p-2.5 rounded-xl text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]"><PowerOff className="h-4 w-4"/></div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-rose-700 dark:text-rose-400">{stats.inactive}</p>
                    <span className="text-sm font-medium text-rose-600/70 dark:text-rose-400/70">suspendidos</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-border/20 shadow-lg overflow-hidden backdrop-blur-md bg-card/60 rounded-xl relative">
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
              <CardHeader className="border-b border-border/10 pb-5 bg-background/20 relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Gestión de Empleados
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {loading ? "Sincronizando datos..." : `Mostrando ${filteredUsers.length} de ${users.length} usuarios en total`}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[150px] bg-background/60 backdrop-blur-sm border-border/30 rounded-xl h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/20 shadow-xl backdrop-blur-xl bg-background/95">
                      <SelectItem value="all">Estado: Todos</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="inactive">Suspendidos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full md:w-[170px] bg-background/60 backdrop-blur-sm border-border/30 rounded-xl h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/20 shadow-xl backdrop-blur-xl bg-background/95">
                      <SelectItem value="all">Rol: Todos</SelectItem>
                      {VALID_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1 md:flex-none">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                    <Input
                      className="w-full md:w-72 pl-10 bg-background/60 backdrop-blur-sm border-border/30 h-10 rounded-xl focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
                      placeholder="Buscar por nombre, correo..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 relative z-10">
              {loading && (
                <div className="divide-y divide-border/10">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <motion.div 
                      key={i} 
                      className="flex items-center gap-6 px-6 py-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Skeleton className="h-11 w-11 rounded-xl bg-muted/60" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-52 bg-muted/60" />
                        <Skeleton className="h-3 w-36 bg-muted/60" />
                      </div>
                      <Skeleton className="h-6 w-24 rounded-full bg-muted/60" />
                      <Skeleton className="h-8 w-8 rounded-xl bg-muted/60" />
                    </motion.div>
                  ))}
                </div>
              )}

              {!loading && filteredUsers.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="flex flex-col items-center justify-center gap-4 py-24 text-center px-4"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-[30px] rounded-full" />
                    <div className="bg-background/80 border border-border/30 p-6 rounded-3xl relative z-10 backdrop-blur-md shadow-xl">
                      <FileX className="h-10 w-10 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mt-2">No se encontraron empleados</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                      No hay registros que coincidan con la búsqueda actual o los filtros aplicados en el sistema.
                    </p>
                  </div>
                </motion.div>
              )}

              {!loading && filteredUsers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse">
                    <thead>
                      <tr className="border-b border-border/10 bg-muted/20">
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          Colaborador
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          Identificador
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          Nivel de Acceso
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          Estado en Sistema
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          Fecha de Registro
                        </th>
                        <th className="w-24 px-6 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          Opciones
                        </th>
                      </tr>
                    </thead>
                    <motion.tbody
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="divide-y divide-border/10"
                    >
                      <AnimatePresence>
                        {filteredUsers.map((user, index) => {
                          const role = normalizeRole(user.role)
                          return (
                            <motion.tr
                              key={user.id}
                              variants={itemVariants}
                              layout
                              className="group transition-colors hover:bg-muted/10 bg-transparent"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-sm font-bold text-primary shadow-inner">
                                    {String(user.fullName || user.email || "U").charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold tracking-tight group-hover:text-primary transition-colors">{display(user.fullName)}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground/80">{display(user.email)}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground/80 font-medium">@{display(user.username)}</td>
                              <td className="px-6 py-4">
                                <Badge variant="outline" className={cn("px-2.5 py-1 text-xs tracking-wide", roleBadgeClass(role))}>
                                  <Shield className="w-3 h-3 mr-1.5 opacity-70" />
                                  {ROLE_LABEL[role]}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                                    user.isActive !== false
                                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 border-rose-500/20",
                                  )}
                                >
                                  <span className={cn("h-1.5 w-1.5 rounded-full", user.isActive !== false ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                                  {user.isActive !== false ? "Operativo" : "Suspendido"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground/80">{formatDate(user.createdAt)}</td>
                              <td className="px-6 py-4 text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-muted/50 hover:bg-muted/50">
                                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 rounded-xl border-border/20 shadow-xl backdrop-blur-xl bg-background/95 p-2">
                                  <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground/70 font-bold px-2 py-1.5">Opciones de Empleado</DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-border/10 my-1" />
                                  <DropdownMenuItem
                                    className="rounded-lg cursor-pointer transition-colors focus:bg-primary/10 focus:text-primary"
                                    onClick={() => {
                                      setActionError(null)
                                      setViewUser(user)
                                    }}
                                  >
                                    Ver expediente
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg cursor-pointer transition-colors focus:bg-primary/10 focus:text-primary" onClick={() => openEditDialog(user)}>
                                    <Pencil className="mr-2 h-4 w-4 opacity-70" />
                                    Modificar datos
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-lg cursor-pointer transition-colors focus:bg-primary/10 focus:text-primary"
                                    onClick={() => {
                                      setActionError(null)
                                      setRoleUser(user)
                                      setNewRole(normalizeRole(user.role))
                                    }}
                                  >
                                    Reasignar permisos
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-border/10 my-1" />
                                  <DropdownMenuItem
                                    className={cn(
                                      "rounded-lg cursor-pointer transition-colors",
                                      user.isActive !== false
                                        ? "text-rose-600 focus:bg-rose-500/10 focus:text-rose-700"
                                        : "text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-700",
                                    )}
                                    onClick={() => {
                                      setActionError(null)
                                      setToggleUser(user)
                                    }}
                                  >
                                    {user.isActive !== false ? (
                                      <PowerOff className="mr-2 h-3.5 w-3.5" />
                                    ) : (
                                      <Power className="mr-2 h-3.5 w-3.5" />
                                    )}
                                    {user.isActive !== false ? "Desactivar usuario" : "Activar usuario"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </motion.tr>
                        )
                      })}
                      </AnimatePresence>
                    </motion.tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="nuevo" className="mt-6 outline-none">
          <motion.div variants={itemVariants}>
            <Card className="border-border/20 shadow-lg overflow-hidden max-w-4xl backdrop-blur-md bg-card/60 rounded-xl relative">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
              <CardHeader className="border-b border-border/10 bg-background/20 pb-6 relative z-10">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Alta de Nuevo Empleado
                </CardTitle>
                <CardDescription className="text-sm">
                  Registra un nuevo usuario en la plataforma. Por defecto, se asignará el rol <strong className="text-foreground font-medium">Usuario</strong>. Podrás modificar sus permisos posteriormente.
                </CardDescription>
              </CardHeader>
            <CardContent className="pt-8 relative z-10">
              {createSuccess && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-600 dark:text-emerald-400 shadow-sm backdrop-blur-md">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Usuario incorporado al sistema exitosamente.
                </div>
              )}
              {createError && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-600 dark:text-rose-400 shadow-sm backdrop-blur-md">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="grid gap-7 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="new-full-name" className="text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">Nombre Completo del Empleado</Label>
                  <Input
                    id="new-full-name"
                    placeholder="Ej. María Fernanda López"
                    value={newUserForm.fullName}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    className="bg-background/50 h-12 rounded-xl backdrop-blur-sm border-border/30 focus-visible:ring-primary/30 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email" className="text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">Correo Electrónico Institucional</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="empleado@empresa.com"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="bg-background/50 h-12 rounded-xl backdrop-blur-sm border-border/30 focus-visible:ring-primary/30 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-pass" className="text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">Contraseña de Acceso Temporal</Label>
                  <Input
                    id="new-pass"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUserForm.password}
                    onChange={(e) =>
                      setNewUserForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className="bg-background/50 h-12 rounded-xl backdrop-blur-sm border-border/30 focus-visible:ring-primary/30 text-base"
                  />
                </div>
                <div className="md:col-span-2 flex gap-4 pt-6 border-t border-border/10 mt-2">
                  <Button type="submit" disabled={creatingUser} className="gap-2 shadow-lg hover:shadow-primary/20 h-12 px-8 rounded-xl font-medium transition-all">
                    {creatingUser && <RefreshCw className="h-4 w-4 animate-spin" />}
                    Confirmar Registro
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="shadow-sm h-12 px-8 rounded-xl border-border/30 bg-background/50 backdrop-blur-sm hover:bg-muted/50 transition-all"
                    onClick={() => {
                      setNewUserForm(initialNewUserForm)
                      setCreateError(null)
                      setCreateSuccess(false)
                    }}
                  >
                    Borrar Formulario
                  </Button>
                </div>
              </form>
            </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="estadisticas" className="mt-6 outline-none">
          <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.byRole.map(({ role, count }) => (
              <motion.div key={role} variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
                <Card className="border-border/20 shadow-sm transition-all hover:shadow-xl h-full overflow-hidden bg-card/60 backdrop-blur-md relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-primary/20 transition-colors duration-500" />
                  <CardContent className="p-7 relative z-10">
                    <Badge variant="outline" className={cn("px-3 py-1 mb-5 text-[11px] font-bold tracking-wider", roleBadgeClass(role))}>
                      <Shield className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                      {ROLE_LABEL[role]}
                    </Badge>
                    <div className="flex items-baseline gap-3">
                      <p className="text-5xl font-black bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{count}</p>
                      <p className="text-sm font-medium text-muted-foreground/70 uppercase tracking-widest">Colaboradores</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={viewUser !== null}
        onOpenChange={(open) => {
          if (!open) setViewUser(null)
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl border-border/20 shadow-2xl backdrop-blur-3xl bg-background/95">
          <DialogHeader>
            <DialogTitle className="text-xl">Expediente del Empleado</DialogTitle>
            <DialogDescription>Resumen de la cuenta seleccionada.</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="grid grid-cols-1 gap-y-5 rounded-xl border border-border/10 bg-muted/10 p-6 text-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
              <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">Nombre Completo</span> <span className="font-semibold text-base mt-1">{display(viewUser.fullName)}</span></div>
              <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">Correo Electrónico</span> <span className="font-medium mt-1">{display(viewUser.email)}</span></div>
              <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">Identificador (Username)</span> <span className="font-medium mt-1">@{display(viewUser.username)}</span></div>
              <div className="flex gap-6 mt-2">
                <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold mb-2">Rol Asignado</span> <Badge variant="outline" className={cn("w-fit px-2.5 py-1 text-xs", roleBadgeClass(normalizeRole(viewUser.role)))}>{ROLE_LABEL[normalizeRole(viewUser.role)]}</Badge></div>
                <div className="flex flex-col"><span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold mb-2">Estado</span> <Badge variant="outline" className={cn("w-fit px-2.5 py-1 text-xs border", viewUser.isActive !== false ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20")}>{viewUser.isActive !== false ? "Operativo" : "Suspendido"}</Badge></div>
              </div>
              <div className="flex flex-col mt-2"><span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">Fecha de Ingreso al Sistema</span> <span className="font-medium mt-1">{formatDate(viewUser.createdAt)}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditUser(null)
            setEditForm(null)
            setActionError(null)
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl rounded-2xl border-border/20 shadow-2xl backdrop-blur-3xl bg-background/95">
          <DialogHeader>
            <DialogTitle className="text-xl">Modificar Datos del Empleado</DialogTitle>
            <DialogDescription>
              Actualiza la información personal, credenciales de acceso y estado operativo del usuario.
            </DialogDescription>
          </DialogHeader>

          {editUser && editForm && (
            <form onSubmit={handleSaveEdit} className="space-y-6 mt-2">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-full-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Nombre completo</Label>
                  <Input
                    id="edit-full-name"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, fullName: e.target.value } : prev)}
                    required
                    className="bg-background/50 h-11 rounded-xl backdrop-blur-sm border-border/30 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Correo Electrónico</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, email: e.target.value } : prev)}
                    required
                    className="bg-background/50 h-11 rounded-xl backdrop-blur-sm border-border/30 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-username" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Identificador</Label>
                  <Input
                    id="edit-username"
                    value={editForm.username}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, username: e.target.value } : prev)}
                    className="bg-background/50 h-11 rounded-xl backdrop-blur-sm border-border/30 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Nueva Clave <span className="text-[10px] font-normal lowercase">(Opcional)</span></Label>
                  <Input
                    id="edit-password"
                    type="password"
                    placeholder="Dejar vacío para no cambiar"
                    value={editForm.password}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, password: e.target.value } : prev)}
                    className="bg-background/50 h-11 rounded-xl backdrop-blur-sm border-border/30 focus-visible:ring-primary/30 placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Nivel de Acceso</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value) =>
                      setEditForm((prev) => prev ? { ...prev, role: value as UserRole } : prev)
                    }
                  >
                    <SelectTrigger className="bg-background/50 h-11 rounded-xl backdrop-blur-sm border-border/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/20 shadow-xl backdrop-blur-xl bg-background/95">
                      {VALID_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Estado en Sistema</Label>
                  <div className="flex h-12 items-center justify-between rounded-xl border border-border/30 bg-background/30 px-4 mt-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", editForm.isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                      <span className="text-sm font-medium text-foreground">
                        {editForm.isActive ? "Cuenta Operativa" : "Cuenta Suspendida"}
                      </span>
                    </div>
                    <Switch
                      checked={editForm.isActive}
                      className="data-[state=checked]:bg-emerald-500"
                      onCheckedChange={(checked) =>
                        setEditForm((prev) => prev ? { ...prev, isActive: checked } : prev)
                      }
                    />
                  </div>
                </div>
              </div>

              {actionError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {actionError}
                </div>
              )}

              <DialogFooter className="gap-3 pt-4 border-t border-border/10">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-11 px-6 border-border/30 bg-transparent hover:bg-muted/50"
                  onClick={() => {
                    setEditUser(null)
                    setEditForm(null)
                    setActionError(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={processingId === editUser.id} className="rounded-xl h-11 px-6 shadow-lg hover:shadow-primary/20 gap-2">
                  {processingId === editUser.id && (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  )}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={roleUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleUser(null)
            setActionError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl border-border/20 shadow-2xl backdrop-blur-3xl bg-background/95">
          <DialogHeader>
            <DialogTitle className="text-xl">Modificar Nivel de Acceso</DialogTitle>
            <DialogDescription>
              Selecciona el nuevo rol. Los nuevos permisos se aplicarán de inmediato.
            </DialogDescription>
          </DialogHeader>

          {roleUser && (
            <div className="space-y-6 mt-2">
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-[20px] pointer-events-none" />
                <p className="font-semibold text-foreground relative z-10">{display(roleUser.fullName)}</p>
                <p className="text-xs text-muted-foreground/80 mt-0.5 relative z-10">{display(roleUser.email)}</p>
              </div>
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Asignar Nuevo Rol</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                  <SelectTrigger className="bg-background/50 h-12 rounded-xl backdrop-blur-sm border-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/20 shadow-xl backdrop-blur-xl bg-background/95">
                    {VALID_ROLES.map((role) => (
                      <SelectItem key={role} value={role} className="py-2.5">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 opacity-70" />
                          <span>{ROLE_LABEL[role]}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {actionError && (
            <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {actionError}
            </div>
          )}

          <DialogFooter className="gap-3 pt-6 border-t border-border/10 mt-2">
            <Button type="button" variant="outline" onClick={() => setRoleUser(null)} className="rounded-xl h-11 px-6 border-border/30 bg-transparent hover:bg-muted/50">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRoleChange}
              disabled={!roleUser || processingId === roleUser.id}
              className="gap-2 rounded-xl h-11 px-6 shadow-lg hover:shadow-primary/20"
            >
              {roleUser && processingId === roleUser.id && (
                <RefreshCw className="h-4 w-4 animate-spin" />
              )}
              Confirmar Cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={toggleUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setToggleUser(null)
            setActionError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl border-border/20 shadow-2xl backdrop-blur-3xl bg-background/95">
          <DialogHeader>
            <DialogTitle className={cn("text-xl flex items-center gap-2", toggleUser?.isActive !== false ? "text-rose-500" : "text-emerald-500")}>
              {toggleUser?.isActive !== false ? <PowerOff className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
              {toggleUser?.isActive !== false ? "Suspender Empleado" : "Reactivar Empleado"}
            </DialogTitle>
            <DialogDescription>
              {toggleUser?.isActive !== false
                ? "El empleado perderá su acceso al sistema inmediatamente. Podrás reactivarlo en cualquier momento."
                : "El empleado recuperará su acceso al sistema usando sus credenciales existentes."}
            </DialogDescription>
          </DialogHeader>
          {toggleUser && (
            <div className={cn("mt-4 rounded-xl border px-5 py-4 shadow-inner relative overflow-hidden", toggleUser?.isActive !== false ? "bg-rose-500/5 border-rose-500/20" : "bg-emerald-500/5 border-emerald-500/20")}>
              <p className={cn("text-sm font-semibold relative z-10", toggleUser?.isActive !== false ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{display(toggleUser.fullName)}</p>
              <p className="text-xs text-muted-foreground/80 mt-1 relative z-10">{display(toggleUser.email)}</p>
            </div>
          )}
          {actionError && (
            <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {actionError}
            </div>
          )}
          <DialogFooter className="gap-3 sm:gap-2 pt-6 border-t border-border/10 mt-2">
            <Button type="button" variant="outline" onClick={() => setToggleUser(null)} className="rounded-xl h-11 px-6 border-border/30 bg-transparent hover:bg-muted/50">
              Cancelar
            </Button>
            <Button
              type="button"
              variant={toggleUser?.isActive !== false ? "destructive" : "default"}
              onClick={handleToggleActive}
              disabled={!toggleUser || processingId === toggleUser.id}
              className={cn("gap-2 rounded-xl h-11 px-6 shadow-lg", toggleUser?.isActive !== false ? "hover:shadow-rose-500/20" : "hover:shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white")}
            >
              {toggleUser && processingId === toggleUser.id && (
                <RefreshCw className="h-4 w-4 animate-spin" />
              )}
              {toggleUser?.isActive !== false ? "Suspender Acceso" : "Permitir Acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
