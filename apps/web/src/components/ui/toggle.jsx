"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const toggleVariants = (props) => {
  const { variant = "default", size = "default", checked, disabled } = props
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
  
  const variants = {
    default: "bg-transparent",
    outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
  }
  
  const sizes = {
    default: "h-10 px-3",
    sm: "h-9 px-2.5",
    lg: "h-11 px-5",
  }

  return cn(
    base,
    variants[variant],
    sizes[size],
    disabled && "opacity-50"
  )
}

const Toggle = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(toggleVariants({ variant, size }), className)}
    {...props}
  />
))
Toggle.displayName = "Toggle"

export { Toggle, toggleVariants }