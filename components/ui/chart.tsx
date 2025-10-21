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
 
