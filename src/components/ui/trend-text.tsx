import * as React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TrendTextProps {
  variation?: number
  baselineText?: string
  className?: string
  badgeClassName?: string
}

export function generateMockVariation(value: number) {
  if (!value) return 0;
  const fakeRandom = ((value * 137.5) % 100) / 100; 
  return (fakeRandom * 30) - 15; // Between -15.0 and +15.0
}

export function TrendText({ variation, baselineText = "el periodo anterior", className, badgeClassName }: TrendTextProps) {
  if (variation === undefined || variation === null) return null

  const isPositive = variation > 0
  const isNeutral = variation === 0
  const absVar = Math.abs(variation).toFixed(1)

  if (isNeutral) {
    return (
      <div className={cn("flex items-center gap-1.5 mt-2", className)}>
        <Badge variant="secondary" className={cn("rounded-full px-1.5 py-0 text-[10px] uppercase font-bold border-none shrink-0 bg-muted text-muted-foreground", badgeClassName)}>
          Igual
        </Badge>
        <span className="text-[11px] text-muted-foreground/80 font-medium leading-none mt-0.5">que {baselineText}</span>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-1.5 mt-2", className)}>
      <Badge variant="secondary" className={cn(
        "rounded-full px-1.5 py-0 text-[11px] font-bold border-none shrink-0 h-5 flex items-center justify-center",
        isPositive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/15 text-rose-700 dark:text-rose-400",
        badgeClassName
      )}>
        {isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" strokeWidth={2.5} /> : <TrendingDown className="h-3 w-3 mr-0.5" strokeWidth={2.5} />}
        {absVar}%
      </Badge>
      <span className="text-[11px] text-muted-foreground/80 font-medium leading-none mt-0.5">
        {isPositive ? "más de" : "menos de"} {baselineText}
      </span>
    </div>
  )
}

