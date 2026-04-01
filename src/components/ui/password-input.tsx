import * as React from "react"
import type { ChangeEvent } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface PasswordInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
}

function PasswordInput({ className, type, onChange, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-10 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        onChange={onChange}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute right-0 top-0 h-full w-8 px-2 hover:bg-transparent"
        onClick={() => setShowPassword(!showPassword)}
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  )
}

export { PasswordInput }