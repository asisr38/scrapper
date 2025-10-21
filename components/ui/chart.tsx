"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type ChartConfig = Record<string, { label?: string; color?: string }>

export function ChartContainer({
  className,
  config,
  children,
}: React.PropsWithChildren<{ className?: string; config?: ChartConfig }>) {
  const style = React.useMemo(() => {
    const css: React.CSSProperties = {}
    Object.entries(config || {}).forEach(([key, v]) => {
      ;(css as any)[`--color-${key}`] = v?.color
    })
    return css
  }, [config])

  return (
    <div className={cn("relative w-full", className)} style={style}>
      {children}
    </div>
  )
}

export function ChartTooltipContent({ hideLabel, indicator }: { hideLabel?: boolean; indicator?: "line" | "dot" }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
      <div className="flex items-center gap-2">
        {!hideLabel && <span className="font-medium">Value</span>}
        {indicator === "line" ? (
          <span className="h-3 w-3 bg-foreground" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-foreground" />
        )}
      </div>
    </div>
  )
}

export const ChartTooltip = ({ children }: React.PropsWithChildren) => <>{children}</>


