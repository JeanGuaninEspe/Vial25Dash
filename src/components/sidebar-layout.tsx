import * as React from "react"
import { motion } from "framer-motion"
import { Moon, Sun, User } from "lucide-react"
import { AppSidebar } from "./app-sidebar"
import { Button } from "./ui/button"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "./ui/sidebar"
import { Toaster } from "./ui/sonner"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiFetch } from "@/lib/api"

type SidebarLayoutProps = {
  title: string
  description: string
  children: React.ReactNode
}

export function SidebarLayout({ title, description, children }: SidebarLayoutProps) {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark")
  const [userRole, setUserRole] = React.useState("")
  const [userFullName, setUserFullName] = React.useState("")

  const hasStoredToken = React.useCallback(() => {
    if (typeof window === "undefined") return false
    return Boolean(
      sessionStorage.getItem("access_token") || localStorage.getItem("access_token")
    )
  }, [])

  React.useEffect(() => {
    const storedTheme = localStorage.getItem("theme")
    const initialTheme = storedTheme === "light" ? "light" : "dark"
    setTheme(initialTheme)
    document.documentElement.classList.toggle("dark", initialTheme === "dark")

    const sessionRole = sessionStorage.getItem("user_role")
    const localRole = localStorage.getItem("user_role")
    setUserRole(sessionRole || localRole || "")

    const sessionName = sessionStorage.getItem("user_full_name")
    const localName = localStorage.getItem("user_full_name")
    setUserFullName(sessionName || localName || "Usuario")

    if (!hasStoredToken() && typeof window !== "undefined") {
      window.location.href = "/login"
    }
  }, [hasStoredToken])

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    localStorage.setItem("theme", nextTheme)
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
  }

  const handleLogout = async () => {
    sessionStorage.removeItem("session_validated")
    sessionStorage.removeItem("access_token")
    localStorage.removeItem("access_token")
    sessionStorage.removeItem("user_role")
    localStorage.removeItem("user_role")
    sessionStorage.removeItem("user_full_name")
    localStorage.removeItem("user_full_name")
    document.cookie = "user_role=; Path=/; Max-Age=0; SameSite=Lax"
    window.location.href = "/login"
  }

  // Generar las iniciales basadas en el nombre completo (ej. "Juan Perez" -> "JP")
  const getInitials = (name: string) => {
    if (!name) return ""
    const parts = name.trim().split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar onLogout={handleLogout} />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background px-4 shadow-sm">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <SidebarTrigger />
          </motion.div>
          <img
            src="/LOGO-COSAD25.webp"
            alt="Logo COSAD"
            className="h-9 w-auto"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
                    aria-label="Cuenta"
                    title="Cuenta"
                  >
                    {userFullName ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300">
                        {getInitials(userFullName)}
                      </span>
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </motion.div>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex flex-col space-y-1">
                  <span className="text-sm font-medium leading-none">{userFullName || "Usuario"}</span>
                  <div className="mt-1">
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                      {userRole || "Usuario"}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout} className="cursor-pointer">
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={handleThemeToggle}
                aria-label="Cambiar tema"
                title="Cambiar tema"
              >
                {theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-8 p-4 md:p-6">
          {children}
        </main>
        <footer className="border-t border-border/60 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span>Desarrollado: Febrero 2026 · Jean Guanin</span>
            <span>© 2026 Sistema Integral de Peajes. Todos los derechos reservados.</span>
          </div>
        </footer>
        <Toaster position="top-center" />
      </SidebarInset>
    </SidebarProvider>
  )
}
