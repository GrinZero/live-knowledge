import { cn } from '@/lib/utils'

type Status = 'running' | 'paused' | 'stopped' | 'error' | 'idle' | 'not_initialized'

interface StatusBadgeProps {
  status: Status
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig: Record<Status, { color: string; bg: string; label: string; pulse?: boolean }> = {
  running: { color: 'bg-emerald-500', bg: 'bg-emerald-50', label: '运行中', pulse: true },
  paused: { color: 'bg-amber-500', bg: 'bg-amber-50', label: '已暂停' },
  stopped: { color: 'bg-gray-400', bg: 'bg-gray-50', label: '已停止' },
  error: { color: 'bg-red-500', bg: 'bg-red-50', label: '错误' },
  idle: { color: 'bg-blue-500', bg: 'bg-blue-50', label: '就绪' },
  not_initialized: { color: 'bg-gray-400', bg: 'bg-gray-50', label: '未初始化' },
}

export function StatusBadge({ status, showLabel = true, size = 'md', className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.idle
  
  const dotSizes = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="relative flex">
        {config.pulse && (
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', config.color)} />
        )}
        <span className={cn('relative inline-flex rounded-full', config.color, dotSizes[size])} />
      </span>
      {showLabel && (
        <span className={cn('font-medium text-gray-700', textSizes[size])}>
          {config.label}
        </span>
      )}
    </div>
  )
}
