import * as React from "react"
import { LogOut } from "lucide-react"
import { AppSidebar } from "./app-sidebar"
import { Button } from "./ui/button"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "./ui/sidebar"
import { Toaster } from "./ui/sonner"
import { apiFetch } from "@/lib/api"

type SidebarLayoutProps = {
  title: string
  description: string
  children: React.ReactNode
}

export function SidebarLayout({ title, description, children }: SidebarLayoutProps) {
  const [validating, setValidating] = React.useState(true)

  React.useEffect(() => {
    const ensureSession = async () => {
      try {
        const me = await apiFetch("/auth/me")

        if (me.ok) {
          setValidating(false)
          return
        }
      } catch {
        // Ignorar para manejar el redirect abajo.
      }

      setValidating(false)
      window.location.href = "/login"
    }

    ensureSession()
  }, [])

  const handleLogout = async () => {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        skipAuthRefresh: true,
      })
    } finally {
      window.location.href = "/login"
    }
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-gradient-to-r from-amber-50 via-white to-emerald-50 px-4 shadow-sm">
          <SidebarTrigger />
          <img
            src="/LOGO-COSAD25.webp"
            alt="Logo COSAD"
            className="h-9 w-auto"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-base text-muted-foreground">{description}</p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" className="gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Cerrar sesion
            </Button>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-8 p-4 md:p-6">
          {validating ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                Validando sesion...
              </div>
            </div>
          ) : (
            children
          )}
        </main>
        <footer className="border-t bg-white/60 px-4 py-4 text-sm text-muted-foreground">
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
