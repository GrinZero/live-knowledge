import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface SidePanelProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
  className?: string
}

const widthClasses = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[28rem]'
}

export function SidePanel({
  open,
  onClose,
  title,
  children,
  width = 'md',
  className
}: SidePanelProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/10 transition-opacity" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          'relative h-full bg-white shadow-xl overflow-y-auto border-l border-gray-200',
          'animate-in slide-in-from-right duration-200',
          widthClasses[width],
          className
        )}
      >
        {title && (
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
