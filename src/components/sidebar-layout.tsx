import * as React from "react"
import { AppSidebar } from "./app-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "./ui/sidebar"

type SidebarLayoutProps = {
  title: string
  description: string
  children: React.ReactNode
}

export function SidebarLayout({ title, description, children }: SidebarLayoutProps) {
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
        </header>
        <main className="flex flex-1 flex-col gap-8 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
