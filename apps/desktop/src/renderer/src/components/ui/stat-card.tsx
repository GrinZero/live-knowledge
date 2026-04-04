import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  label: string
  value: string | number
  subValue?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function StatCard({
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBg = 'bg-blue-50',
  label,
  value,
  subValue,
  size = 'md',
  className
}: StatCardProps) {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6'
  }

  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10'
  }

  const valueSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  }

  return (
    <div className={cn('bg-white rounded-xl border border-gray-100', sizeClasses[size], className)}>
      <div className="flex items-center gap-3 mb-3">
        <span
          className={cn('rounded-lg flex items-center justify-center', iconBg, iconSizes[size])}
        >
          <Icon className={cn('h-4 w-4', iconColor)} />
        </span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className={cn('font-semibold text-gray-900', valueSizes[size])}>{value}</div>
      {subValue && <div className="text-xs text-gray-400 mt-1">{subValue}</div>}
    </div>
  )
}
