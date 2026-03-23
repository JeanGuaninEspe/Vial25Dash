import * as React from "react"
import {
  Home,
  LayoutDashboard,
  FileText,
  BarChart3,
  Building2,
  Clock,
  Bot,
  Activity,
  Route,
  CalendarClock,
  PieChart,
  CreditCard,
  Settings2,
  ChevronDown,
  Compass,
  ShieldCheck,
} from "lucide-react"
import { motion } from "framer-motion"
import { canAccessAdminPanel, canAccessDashboards, canAccessRfidModule, normalizeRole } from "@/lib/roles"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const data = {
  navMain: [
    {
      title: "Navegación",
      items: [
        { title: "Vista General", url: "/overview", icon: Home, disabled: false, access: "dashboards" },
        {
          title: "Analítica Comparativa",
          url: "/experimental/analitica-comparativa",
          icon: PieChart,
          disabled: false,
          access: "dashboards",
        },
        { title: "Descuentos RFID", url: "/descuentos-rfid", icon: CreditCard, disabled: false, access: "rfid" },
        { title: "Dashboard AI", url: "/experimental/dashboard-ai", icon: Bot, disabled: false, access: "dashboards" },
        { title: "Reporte TPDA", url: "/experimental/tpda-reporte", icon: Activity, disabled: false, access: "dashboards" },
        { title: "Tránsito Años/Meses", url: "/experimental/transito-anios-meses", icon: Route, disabled: false, access: "dashboards" },
        {
          title: "Recaudación",
          url: "/experimental/recaudacion-reporte-diario-peajes",
          icon: CalendarClock,
          disabled: false,
          access: "dashboards",
          children: [
            { title: "Diario por peajes", url: "/experimental/recaudacion-reporte-diario-peajes" },
            { title: "Diario acumulado", url: "/experimental/recaudacion-reporte-diario-acumulado" },
            { title: "Anual por meses", url: "/experimental/recaudacion-anual" },
            { title: "Reporte semanal", url: "/experimental/recaudacion-semanal" },
          ],
        },
      ],
    },
    {
      title: "Administración",
      items: [
        { title: "Panel de Administrador", url: "/panel-admin", icon: Settings2, disabled: false, access: "admin" },
      ],
    },
  ],
}

const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Navegación": Compass,
  "Administración": ShieldCheck,
}

const SIDEBAR_SCROLL_KEY = "app-sidebar-scroll-top"
const SIDEBAR_CONTENT_ID = "app-sidebar-content"

export function AppSidebar({ onLogout, ...props }: React.ComponentProps<typeof Sidebar> & { onLogout?: () => void }) {
  const [userRole, setUserRole] = React.useState("")
  const [currentPath, setCurrentPath] = React.useState("")
  const { state, isMobile } = useSidebar()
  const [openMenu, setOpenMenu] = React.useState<string | null>(null)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = React.useCallback((title: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpenMenu(title)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setOpenMenu(null)
    }, 150) // Small delay to prevent flickering between trigger and content
  }, [])

  console.log("AppSidebar Rendering -> state:", state, "isMobile:", isMobile);

  const restoreSidebarScroll = React.useCallback(() => {
    const sidebarContent = document.getElementById(SIDEBAR_CONTENT_ID)
    const savedScroll = sessionStorage.getItem(SIDEBAR_SCROLL_KEY)
    if (!sidebarContent || !savedScroll) return
    const scrollTop = Number(savedScroll)
    if (Number.isNaN(scrollTop)) return
    sidebarContent.scrollTop = scrollTop
  }, [])

  const persistSidebarScroll = React.useCallback(() => {
    const sidebarContent = document.getElementById(SIDEBAR_CONTENT_ID)
    if (!sidebarContent) return
    sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(sidebarContent.scrollTop))
  }, [])

  React.useEffect(() => {
    const sessionRole = sessionStorage.getItem("user_role")
    const localRole = localStorage.getItem("user_role")
    setUserRole(normalizeRole(sessionRole || localRole))
    const syncPath = () => {
      setCurrentPath(window.location.pathname)
      // Delay one frame so DOM settles after client-side navigation.
      window.requestAnimationFrame(() => restoreSidebarScroll())
    }

    syncPath()

    const onPageLoad = () => syncPath()
    const onAfterSwap = () => syncPath()

    window.addEventListener("popstate", syncPath)
    document.addEventListener("astro:page-load", onPageLoad as EventListener)
    document.addEventListener("astro:after-swap", onAfterSwap as EventListener)

    return () => {
      window.removeEventListener("popstate", syncPath)
      document.removeEventListener("astro:page-load", onPageLoad as EventListener)
      document.removeEventListener("astro:after-swap", onAfterSwap as EventListener)
    }
  }, [restoreSidebarScroll])

  React.useEffect(() => {
    const sidebarContent = document.getElementById(SIDEBAR_CONTENT_ID)
    if (!sidebarContent) return

    restoreSidebarScroll()

    const handleScroll = () => persistSidebarScroll()
    sidebarContent.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      sidebarContent.removeEventListener("scroll", handleScroll)
    }
  }, [persistSidebarScroll, restoreSidebarScroll])

  const isActive = React.useCallback(
    (url: string) => currentPath === url || currentPath.startsWith(url + "/"),
    [currentPath]
  )

  const handleSidebarLinkClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
      if (currentPath === url) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      persistSidebarScroll()
    },
    [currentPath, persistSidebarScroll]
  )

  const visibleGroups = React.useMemo(() => {
    return data.navMain
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.access === "dashboards") return canAccessDashboards(userRole)
          if (item.access === "rfid") return canAccessRfidModule(userRole)
          if (item.access === "admin") return canAccessAdminPanel(userRole)
          return false
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [userRole])

  const sidebarVariants = {
    hidden: { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.08, delayChildren: 0.06 },
    },
  }

  const groupVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <Sidebar
      {...props}
      collapsible="icon"
      className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border/60"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <SidebarHeader className="h-16 p-0">
        <motion.div
          className="flex h-full items-center gap-3 bg-sidebar/70 px-4 py-0 backdrop-blur group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h2 className="truncate text-sm font-semibold text-sidebar-foreground">
              Sistema de Peajes
            </h2>
            <p className="text-[11px] text-sidebar-foreground/60">
              Panel Operativo · COSAD
            </p>
          </div>
        </motion.div>
      </SidebarHeader>

      {/* ── Navigation ─────────────────────────────────────── */}
      <SidebarContent
        id={SIDEBAR_CONTENT_ID}
        className="py-4 group-data-[collapsible=icon]:pt-2"
        onClickCapture={() => persistSidebarScroll()}
      >
        <motion.div
          className="flex flex-col gap-2"
          variants={sidebarVariants}
          initial={false}
          animate="show"
        >
          {visibleGroups.map((group, groupIdx) => (
            <motion.div key={group.title} variants={groupVariants}>
              <SidebarGroup className="mb-2 px-3 py-0 group-data-[collapsible=icon]:px-0">
                <SidebarGroupContent>

                  {/* Navegación */}
                  {group.title === "Navegación" ? (
                    <details className="group/nav" open>
                      <summary className="mb-1 flex cursor-pointer list-none items-center rounded-lg px-2 py-1.5 transition-all select-none hover:bg-sidebar-accent/40 group-open/nav:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.6)] group-data-[collapsible=icon]:hidden">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60">
                          <ChevronDown className="-rotate-90 h-4 w-4 transition-transform duration-200 group-open/nav:rotate-0" />
                          {group.title}
                        </span>
                      </summary>

                      <SidebarMenu className="gap-0.5">
                        {group.items.map((menuItem) => (
                          <SidebarMenuItem key={menuItem.title}>
                            {menuItem.children?.length ? (
                              state === "collapsed" ? (
                                <DropdownMenu
                                  modal={false}
                                  open={openMenu === menuItem.title}
                                  onOpenChange={(nextOpen) => {
                                    if (nextOpen) handleMouseEnter(menuItem.title)
                                    else handleMouseLeave()
                                  }}
                                >
                                  <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton
                                      className={`h-10 rounded-lg px-2 transition-all duration-150 group-data-[collapsible=icon]:!p-0 ${menuItem.children.some((child) => isActive(child.url))
                                          ? "bg-emerald-400/15 hover:bg-emerald-400/20"
                                          : "hover:bg-sidebar-accent/50"
                                        }`}
                                      onMouseEnter={() => handleMouseEnter(menuItem.title)}
                                      onMouseLeave={handleMouseLeave}
                                    >
                                      <span className="flex w-full items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
                                        <span
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${menuItem.children.some((child) => isActive(child.url))
                                              ? "bg-emerald-500 text-white"
                                              : "bg-sidebar-accent/40 text-sidebar-foreground/60"
                                            }`}
                                        >
                                          <menuItem.icon className="h-4 w-4 text-sidebar-foreground/70" />
                                        </span>
                                        <span
                                          className={`text-sm font-medium transition-colors group-data-[collapsible=icon]:hidden ${menuItem.children.some((child) => isActive(child.url))
                                              ? "text-emerald-300"
                                              : "text-sidebar-foreground/80"
                                            }`}
                                        >
                                          {menuItem.title}
                                        </span>
                                      </span>
                                    </SidebarMenuButton>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    side="right"
                                    align="start"
                                    className="min-w-48"
                                    onMouseEnter={() => handleMouseEnter(menuItem.title)}
                                    onMouseLeave={handleMouseLeave}
                                  >
                                    {menuItem.children.map((child) => (
                                      <DropdownMenuItem key={child.title} asChild>
                                        <a
                                          href={child.url}
                                          className="text-sm"
                                          aria-label={child.title}
                                          onClick={(event) => handleSidebarLinkClick(event, child.url)}
                                        >
                                          {child.title}
                                        </a>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <details className="group/recaudacion" open={menuItem.children.some((child) => isActive(child.url))}>
                                  <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg px-2 transition-all hover:bg-sidebar-accent/50 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center">
                                    <span className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
                                      <span
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${menuItem.children.some((child) => isActive(child.url))
                                            ? "bg-emerald-500 text-white"
                                            : "bg-sidebar-accent/40 text-sidebar-foreground/60"
                                          }`}
                                      >
                                        <menuItem.icon className="h-4 w-4 text-sidebar-foreground/70" />
                                      </span>
                                      <span
                                        className={`text-sm font-medium transition-colors ${menuItem.children.some((child) => isActive(child.url))
                                            ? "text-emerald-300"
                                            : "text-sidebar-foreground/80"
                                          }`}
                                      >
                                        {menuItem.title}
                                      </span>
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-sidebar-foreground/70 -rotate-90 text-sidebar-foreground/50 transition-transform duration-200 group-open/recaudacion:rotate-0 group-data-[collapsible=icon]:hidden" />
                                  </summary>

                                  <div className="ml-9 mt-1 flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
                                    {menuItem.children.map((child) => (
                                      <a
                                        key={child.title}
                                        href={child.url}
                                        aria-label={child.title}
                                        onClick={(event) => handleSidebarLinkClick(event, child.url)}
                                        className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${isActive(child.url)
                                            ? "bg-emerald-400/15 text-emerald-300"
                                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                                          }`}
                                      >
                                        {child.title}
                                      </a>
                                    ))}
                                  </div>
                                </details>
                              )
                            ) : menuItem.disabled ? (
                              <motion.div
                                className="flex h-10 w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-2 opacity-30 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-0"
                                  initial={false}
                                animate={{ opacity: 1, y: 0 }}
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent/30 group-data-[collapsible=icon]:shrink-0">
                                  <menuItem.icon className="h-4 w-4 text-sidebar-foreground/70 text-sidebar-foreground/50" />
                                </span>
                                <span className="text-sm font-medium text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                                  {menuItem.title}
                                </span>
                              </motion.div>
                            ) : (
                              <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}>
                                <SidebarMenuButton
                                  asChild
                                  tooltip={menuItem.title}
                                  className={`h-10 rounded-lg px-2 transition-all duration-150 group-data-[collapsible=icon]:!p-0 ${isActive(menuItem.url)
                                      ? "bg-emerald-400/15 hover:bg-emerald-400/20"
                                      : "hover:bg-sidebar-accent/50"
                                    }`}
                                >
                                  <a
                                    href={menuItem.url}
                                    aria-label={menuItem.title}
                                    className="flex w-full items-center gap-2.5 group-data-[collapsible=icon]:justify-center"
                                    onClick={(event) => handleSidebarLinkClick(event, menuItem.url)}
                                  >
                                    <span
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${isActive(menuItem.url)
                                          ? "bg-emerald-500 text-white"
                                          : "bg-sidebar-accent/40 text-sidebar-foreground/60"
                                        }`}
                                    >
                                      <menuItem.icon className="h-4 w-4 text-sidebar-foreground/70" />
                                    </span>
                                    <span
                                      className={`text-sm font-medium transition-colors group-data-[collapsible=icon]:hidden ${isActive(menuItem.url)
                                          ? "text-emerald-300"
                                          : "text-sidebar-foreground/80"
                                        }`}
                                    >
                                      {menuItem.title}
                                    </span>
                                  </a>
                                </SidebarMenuButton>
                              </motion.div>
                            )}
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </details>
                  ) : (
                    /* Todos los demás grupos */
                    <>
                      <div className="mb-1 flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                        {sectionIcons[group.title] ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sidebar-accent/40 text-sidebar-foreground/70">
                            {React.createElement(sectionIcons[group.title], { className: "h-4 w-4" })}
                          </span>
                        ) : null}
                        <span>{group.title}</span>
                      </div>
                      <SidebarMenu className="gap-0.5">
                        {group.items.map((menuItem) => (
                          <SidebarMenuItem key={menuItem.title}>
                            <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}>
                              <SidebarMenuButton
                                asChild
                                tooltip={menuItem.title}
                                className={`h-10 rounded-lg px-2 transition-all duration-150 group-data-[collapsible=icon]:!p-0 ${isActive(menuItem.url)
                                    ? "bg-emerald-400/15 hover:bg-emerald-400/20"
                                    : "hover:bg-sidebar-accent/50"
                                  }`}
                              >
                                <a
                                  href={menuItem.url}
                                  aria-label={menuItem.title}
                                  className="flex w-full items-center gap-2.5 group-data-[collapsible=icon]:justify-center"
                                  onClick={(event) => handleSidebarLinkClick(event, menuItem.url)}
                                >
                                  <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${isActive(menuItem.url)
                                        ? "bg-emerald-500 text-white"
                                        : "bg-sidebar-accent/40 text-sidebar-foreground/60"
                                      }`}
                                  >
                                    <menuItem.icon className="h-4 w-4 text-sidebar-foreground/70" />
                                  </span>
                                  <span
                                    className={`text-sm font-medium transition-colors group-data-[collapsible=icon]:hidden ${isActive(menuItem.url)
                                        ? "text-emerald-300"
                                        : "text-sidebar-foreground/80"
                                      }`}
                                  >
                                    {menuItem.title}
                                  </span>
                                </a>
                              </SidebarMenuButton>
                            </motion.div>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>

                      {/* Separador entre grupos (excepto el último) */}
                      {groupIdx < visibleGroups.length - 1 && (
                        <div className="mt-4 border-t border-sidebar-border/60" />
                      )}
                    </>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>
            </motion.div>
          ))}
        </motion.div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 px-3 py-3" />

      <SidebarRail />
    </Sidebar>
  )
}
