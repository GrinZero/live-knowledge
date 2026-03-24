import { Link, useLocation } from 'react-router-dom'
import { Activity, LayoutDashboard, Settings, Plug, Sparkles, History } from 'lucide-react'
import type React from 'react'

import { getPluginSidebarItems, subscribeToPluginUpdates } from '../plugin-registry'
import { PluginErrorBoundary } from './PluginErrorBoundary'
import { useEffect, useState } from 'react'

const navItems = [
  { path: '/', label: '监控', icon: Activity },
  { path: '/dashboard', label: '知识库', icon: LayoutDashboard },
  { path: '/events', label: '事件历史', icon: History },
  { path: '/plugins', label: '插件', icon: Plug },
  { path: '/settings', label: '设置', icon: Settings },
]

export default function Layout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const location = useLocation()
  const [pluginItems, setPluginItems] = useState(getPluginSidebarItems())

  useEffect(() => {
    const unsubscribe = subscribeToPluginUpdates(() => {
      setPluginItems(getPluginSidebarItems())
    })
    return unsubscribe
  }, [])

  return (
    <div className="h-screen bg-gray-50 text-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-56 flex-none h-screen flex flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-gray-100">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold text-gray-900">Live Knowledge</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                <span>{label}</span>
              </Link>
            )
          })}

          {/* Plugin Items */}
          {pluginItems.length > 0 && (
            <>
              <div className="pt-4 pb-2 px-3">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  插件
                </span>
              </div>
              {pluginItems.map(({ path, label, icon: Icon, pluginId }) => {
                const active = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <PluginErrorBoundary pluginId={pluginId} variant="icon">
                      <Icon className={`h-[18px] w-[18px] ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                    </PluginErrorBoundary>
                    <span>{label}</span>
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="text-xs text-gray-400">v1.0.0</div>
        </div>
      </aside>

      {/* Main Content - 移除了冗余的 header */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-8 py-6">{children}</div>
      </main>
    </div>
  )
}
