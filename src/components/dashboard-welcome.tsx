"use client"

import * as React from "react"

import { toast } from "sonner"
import { apiFetch } from "@/lib/api"

type AuthMeResponse = {
  nombre?: string
  usuario?: string
  user?: {
    nombre?: string
    usuario?: string
  }
}

export function DashboardWelcome() {
  const [nombre, setNombre] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState(false)
  const hasShownRef = React.useRef(false)

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await apiFetch("/auth/me")

        if (!response.ok) {
          setLoaded(true)
          return
        }

        const payload = (await response.json()) as AuthMeResponse
        const displayName =
          payload.user?.nombre ||
          payload.user?.usuario ||
          payload.nombre ||
          payload.usuario ||
          null
        setNombre(displayName)
        setLoaded(true)
      } catch {
        // Ignorar errores de lectura de usuario.
        setLoaded(true)
      }
    }

    loadUser()
  }, [])

  React.useEffect(() => {
    if (!loaded || hasShownRef.current) return
    hasShownRef.current = true
    toast.success("Bienvenido", {
      description: nombre ?? "Usuario",
    })
  }, [loaded, nombre])

  return null
}
