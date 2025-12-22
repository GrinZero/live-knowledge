import { Link, useLocation } from 'react-router-dom'
import { Activity, LayoutDashboard, BookOpen, Settings, PanelsTopLeft, Plug } from 'lucide-react'
import type React from 'react'

import { getPluginSidebarItems, subscribeToPluginUpdates } from '../plugin-registry'
import { PluginErrorBoundary } from './PluginErrorBoundary'
import { useEffect, useState } from 'react'

const navItems = [
  { path: '/', label: '监控', icon: Activity },
  { path: '/dashboard', label: '展示', icon: LayoutDashboard },
  { path: '/plugins', label: '插件', icon: Plug },
  { path: '/overlay', label: '悬浮窗', icon: PanelsTopLeft },
  { path: '/settings', label: '设置', icon: Settings }
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
    <div className="h-screen bg-white text-gray-900 flex">
      <aside className="w-64 min-w-64 flex-none h-screen overflow-y-auto border-r border-gray-200 bg-white">
        <div className="h-14 px-5 border-b border-gray-200 flex items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <div className="text-lg font-semibold">Live Knowledge</div>
          </div>
        </div>
        <nav className="px-2 py-3 flex flex-col gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer active:scale-95 ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            )
          })}

          {/* Plugin Items */}
          {pluginItems.length > 0 && (
            <>
              <div className="px-3 py-2 mt-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Plugins
              </div>
              {pluginItems.map(({ path, label, icon: Icon, pluginId }) => {
                const active = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer active:scale-95 ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                  >
                    <PluginErrorBoundary pluginId={pluginId} variant="icon">
                      <Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                    </PluginErrorBoundary>
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                )
              })}
            </>
          )}
        </nav>
      </aside>

      <div className="flex-1 h-screen flex flex-col">
        <header className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-600">实时知识助手</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50">
          <div className="max-w-[1400px] mx-auto p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
