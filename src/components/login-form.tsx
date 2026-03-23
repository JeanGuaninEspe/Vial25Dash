"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { User, Lock, Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { normalizeRole } from "@/lib/roles"

const V2_BASE_URL = import.meta.env.PUBLIC_V2_API_BASE_URL || ""

export function LoginForm() {
  const [loading, setLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const usuario = String(formData.get("usuario") || "").trim()
    const clave = String(formData.get("clave") || "").trim()

    if (!usuario || !clave) {
      toast.error("Datos incompletos", {
        description: "Ingresa usuario y clave para continuar."
      })
      return
    }

    setLoading(true)

    try {
      if (!V2_BASE_URL) {
        throw new Error("PUBLIC_V2_API_BASE_URL no esta configurado.")
      }

      const response = await fetch(`${V2_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: usuario,
          password: clave,
        }),
      })

      if (!response.ok) {
        if (import.meta.env.DEV) {
          console.info("[login] Error response", {
            status: response.status,
            refreshCookieDebug: response.headers.get("x-v2-login-debug-refresh-cookie"),
          })
        }

        if (response.status === 401 || response.status === 400) {
          throw new Error("Usuario o clave incorrectos.")
        }
        throw new Error("No se pudo iniciar sesion. Intenta nuevamente.")
      }

      const payload = (await response.json()) as {
        accessToken?: string
        access_token?: string
        user?: {
          role?: string
          fullName?: string
          username?: string
        }
      }
      const accessToken = payload?.accessToken || payload?.access_token
      const userRole = normalizeRole(payload?.user?.role)
      const userFullName = payload?.user?.fullName || payload?.user?.username || ""

      if (import.meta.env.DEV) {
        console.info("[login] V2 debug", {
          status: response.status,
          hasAccessToken: Boolean(accessToken),
          refreshCookieDebug: response.headers.get("x-v2-login-debug-refresh-cookie"),
        })
      }

      if (accessToken) {
        sessionStorage.setItem("access_token", accessToken)
        localStorage.setItem("access_token", accessToken)

        if (userRole) {
          sessionStorage.setItem("user_role", userRole)
          localStorage.setItem("user_role", userRole)
          document.cookie = `user_role=${encodeURIComponent(userRole)}; Path=/; SameSite=Lax`
        }
        if (userFullName) {
          sessionStorage.setItem("user_full_name", userFullName)
          localStorage.setItem("user_full_name", userFullName)
        }
      } else {
        sessionStorage.removeItem("access_token")
        localStorage.removeItem("access_token")
        sessionStorage.removeItem("user_role")
        localStorage.removeItem("user_role")
        sessionStorage.removeItem("user_full_name")
        localStorage.removeItem("user_full_name")
        document.cookie = "user_role=; Path=/; Max-Age=0; SameSite=Lax"
      }

      toast.success("Inicio exitoso", {
        description: "Redirigiendo al panel..."
      })
      
      setTimeout(() => {
        window.location.href = "/overview"
      }, 1200)
    } catch (err) {
      sessionStorage.removeItem("access_token")
      localStorage.removeItem("access_token")
      sessionStorage.removeItem("user_role")
      localStorage.removeItem("user_role")
      sessionStorage.removeItem("user_full_name")
      localStorage.removeItem("user_full_name")
      document.cookie = "user_role=; Path=/; Max-Age=0; SameSite=Lax"
      
      toast.error("Acceso denegado", {
        description: err instanceof Error ? err.message : "Error al iniciar sesion"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="grid w-full max-w-[480px] gap-4"
    >
      <Card className="w-full border-border/40 bg-background/60 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-3xl font-bold tracking-tight">Bienvenido</CardTitle>
          <CardDescription className="text-muted-foreground">Accede al sistema de monitoreo de peajes</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2 relative">
              <Label htmlFor="usuario" className="text-foreground/80 font-medium">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="usuario" name="usuario" placeholder="Tu usuario" autoComplete="username" className="pl-10 bg-background/50 border-border/40 transition-colors focus:border-emerald-500/50 focus:ring-emerald-500/20" />
              </div>
            </div>
            <div className="grid gap-2 relative">
              <Label htmlFor="clave" className="text-foreground/80 font-medium">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="clave" name="clave" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" className="pl-10 pr-10 bg-background/50 border-border/40 transition-colors focus:border-emerald-500/50 focus:ring-emerald-500/20" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-3 text-muted-foreground hover:text-foreground transition-colors outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="h-11 mt-2 text-base font-semibold shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:-translate-y-0.5" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground flex justify-center pb-6">
          <span className="flex items-center gap-1.5 opacity-80">
            <Lock className="h-3 w-3" /> Acceso restringido a personal autorizado.
          </span>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
