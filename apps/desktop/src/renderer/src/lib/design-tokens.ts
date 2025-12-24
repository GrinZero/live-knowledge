// Design Tokens - 统一的设计系统
export const tokens = {
  // 圆角
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
  
  // 间距 (基于 8px 网格)
  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  
  // 颜色
  colors: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    danger: '#ef4444',
    dangerLight: '#fee2e2',
    muted: '#6b7280',
    mutedLight: '#f3f4f6',
  },
} as const

// Tailwind class 映射
export const tw = {
  // 卡片样式
  card: 'bg-white rounded-xl border border-gray-100 shadow-sm',
  cardHover: 'bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow',
  
  // 输入框样式
  input: 'h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all',
  
  // 标签样式
  label: 'text-sm font-medium text-gray-700',
  helper: 'text-xs text-gray-500 mt-1',
  
  // 页面标题
  pageTitle: 'text-2xl font-semibold text-gray-900',
  pageSubtitle: 'text-sm text-gray-500 mt-1',
  
  // 区块标题
  sectionTitle: 'text-base font-medium text-gray-900',
  
  // 状态颜色
  statusRunning: 'bg-emerald-500',
  statusPaused: 'bg-amber-500',
  statusStopped: 'bg-gray-400',
  statusError: 'bg-red-500',
} as const
