'use client'

import {
    Toast, ToastActionElement, ToastProps, ToastProvider,
    ToastViewport
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export { ToastProvider, ToastViewport }
export type { ToastActionElement, ToastProps }

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <div className="text-sm font-semibold">{title}</div>}
              {description && (
                <div className="text-sm opacity-90">{description}</div>
              )}
            </div>
            {action}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
