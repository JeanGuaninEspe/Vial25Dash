# 📊 Guía de Implementación: Tablas Financieras y UX

Este documento detalla los estándares visuales y técnicos para los módulos financieros del proyecto, utilizando el stack **Astro + React + Tailwind + Shadcn/UI**.

---

## 🎨 Estándares de Color (Temas)

Para mantener la legibilidad, los colores de los valores financieros deben adaptarse al tema:

| Elemento | Dark Mode (Fondo Oscuro) | Light Mode (Fondo Claro) |
| :--- | :--- | :--- |
| **Saldos Positivos** | `text-emerald-400` | `text-emerald-700` |
| **Saldos Negativos** | `text-red-400` | `text-red-600` |
| **Datos Nulos/Futuros** | `text-muted-foreground/30` | `text-slate-300` |
| **Resalte de Totales** | `bg-emerald-500/10` | `bg-emerald-50` |

---
# Sistema de Diseño y Reglas Globales de UX/UI

Este documento define los estándares visuales, de interacción y de código para toda la aplicación. El stack oficial es: **Astro, React, Framer Motion, Tailwind CSS y shadcn/ui**.

## 1. Tema y Colores de Acentuación (Light / Dark Mode)
Todas las vistas deben respetar el esquema de colores basado en variables CSS, con especial énfasis en el color de acentuación (`accent` y `primary`).

- **Modo Dark:** El color de acento principal debe ser un verde fosforescente/neón (ej. Tailwind `emerald-400` o `green-400`).
- **Modo Light:** El color de acento principal debe ser un verde financiero/bosque oscuro (ej. Tailwind `green-800` o `emerald-800`).
- **Uso en Tailwind:** Utiliza siempre variables de utilidad (ej. `text-accent`, `bg-accent/10`, `border-accent/20`) en lugar de colores fijos (`text-green-500`), para asegurar que el cambio de tema sea automático.

## 2. Tarjetas (Cards) y KPIs
Todo indicador clave de rendimiento (KPI) o bloque de información debe seguir esta estructura exacta usando los componentes de `shadcn/ui`:

- **Contenedores Grid:** Las tarjetas agrupadas deben ir siempre en un contenedor de cuadrícula para garantizar anchos iguales: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` (o `gap-6`). Nunca forzar anchos fijos con `w-[Xpx]`.
- **Estructura Interna:**
  - `<Card>`: Contenedor principal.
  - `<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">`: Debe contener el `<CardTitle>` (texto descriptivo) y el icono.
  - `<CardTitle className="text-sm font-medium text-muted-foreground">`: Títulos de KPIs siempre en gris suave y tamaño pequeño.
  - `<CardContent>`: Contiene el valor principal (`text-2xl font-bold tabular-nums` para que los números no salten) y cualquier texto secundario.
- **Iconos:** Los iconos dentro de las cards deben tener un fondo sutil del color de acento y estar redondeados: `className="h-8 w-8 rounded-full bg-accent/10 text-accent flex items-center justify-center"`.
- **Badges:** Los valores destacados adicionales (ej. montos secundarios) deben ir dentro del componente `<Badge variant="outline">` o usar un contenedor con `bg-accent/10 text-accent border border-accent/20`.

## 3. Formularios, Filtros y Controles
Cualquier barra de herramientas o formulario de filtrado debe verse unificado:

- **Componentes:** Prohibido usar etiquetas `<select>` o `<input>` nativas. Usar siempre `<Select>`, `<Input>`, `<Popover>` (para fechas) y `<Button>` de `shadcn/ui`.
- **Labels (Etiquetas):** Todo filtro debe tener su label superior con las clases: `text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5`.
- **Alineación:** En barras horizontales, los botones de acción (ej. "Reset", "Buscar") deben alinearse en la parte inferior (baseline) junto a los inputs, no flotar al nivel de los labels. Usar `flex items-end gap-4`.
- **Botones Secundarios:** Acciones como "Limpiar filtros" deben usar `variant="outline"` o `variant="ghost"`.

## 4. Tipografía y Jerarquía
- **Títulos de Página:** `text-3xl font-bold tracking-tight`.
- **Subtítulos de Página:** `text-muted-foreground mt-1`.
- **Números Financieros:** Siempre añadir la clase `tabular-nums` a las cantidades monetarias para mantener un espaciado consistente.

## 5. Animaciones Globales (Framer Motion)
Toda interacción y carga de datos debe sentirse fluida pero no exagerada:

- **Carga de Listas/Cards (Stagger):** Al montar vistas con múltiples tarjetas o filas, el contenedor padre debe usar `staggerChildren: 0.1` y los hijos deben entrar con un `Fade-In` y leve desplazamiento desde abajo (`y: 10`, `opacity: 0` a `y: 0`, `opacity: 1`).
- **Hover en Cards Interactivas:** Si una `<Card>` es clickeable, debe tener un sutil efecto de elevación al hacer hover: `whileHover={{ y: -2, transition: { duration: 0.2 } }}` o implementar clases de Tailwind como `hover:border-accent/50 transition-colors`.