"use client"

import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"

export function LoginForm() {
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const usuario = String(formData.get("usuario") || "").trim()
    const clave = String(formData.get("clave") || "").trim()

    if (!usuario || !clave) {
      setError("Ingresa usuario y clave para continuar.")
      return
    }

    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: usuario,
          password: clave,
        }),
        skipAuthRefresh: true,
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          throw new Error("Usuario o clave incorrectos.")
        }
        throw new Error("No se pudo iniciar sesion. Intenta nuevamente.")
      }

      setSuccess(true)
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 700)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid w-full max-w-[520px] gap-4">
      {error && (
        <Alert variant="destructive" className="border-white/30 bg-white/95">
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-white/30 bg-white/95">
          <AlertTitle>Inicio exitoso</AlertTitle>
          <AlertDescription>Redirigiendo al panel...</AlertDescription>
        </Alert>
      )}
      <Card className="w-full border-white/30 bg-white/95 shadow-xl backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold">Bienvenido</CardTitle>
          <CardDescription>Accede al sistema de monitoreo de peajes</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="usuario">Usuario</Label>
              <Input id="usuario" name="usuario" placeholder="tu usuario" autoComplete="username" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clave">Clave</Label>
              <Input id="clave" name="clave" type="password" placeholder="••••••••" autoComplete="current-password" />
            </div>
            <Button type="submit" className="h-11 text-base font-semibold" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Acceso restringido a personal autorizado.
        </CardFooter>
      </Card>
    </div>
  )
}
