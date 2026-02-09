import * as React from "react"
import { LayoutDashboard, FileText, BarChart3, Building2, Clock } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Navegación",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Análisis Temporal",
          url: "/analisis-temporal",
          icon: Clock,
        },
        {
          title: "Reporte Estadístico",
          url: "/estadistico",
          icon: BarChart3,
        },
        {
          title: "Análisis de Cabinas",
          url: "/cabinas",
          icon: Building2,
        },
        {
          title: "Facturación",
          url: "/facturacion",
          icon: FileText,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      {...props}
      className="bg-gradient-to-b from-slate-50 via-white to-slate-50 border-r border-slate-200/70"
    >
      <SidebarHeader>
        <div className="px-4 py-4 border-b border-slate-200/70 bg-gradient-to-r from-emerald-50/60 via-white to-amber-50/60">
          <div className="flex items-center gap-3">
            <img
              src="/LOGO-COSAD25.webp"
              alt="Logo COSAD"
              className="h-9 w-auto"
            />
            <div className="leading-tight">
              <h2 className="text-lg font-semibold">Sistema de Peajes</h2>
              <p className="text-xs text-muted-foreground">Panel Operativo</p>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {item.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((menuItem) => (
                  <SidebarMenuItem key={menuItem.title} className="mb-2 last:mb-0">
                    <SidebarMenuButton
                      asChild
                      className="rounded-lg px-3 py-2 text-base font-semibold border border-slate-200/70 bg-white/80 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-100/80 hover:shadow-md"
                    >
                      <a href={menuItem.url}>
                        {menuItem.icon && (
                          <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
                            <menuItem.icon className="h-4 w-4" />
                          </span>
                        )}
                        {menuItem.title}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
