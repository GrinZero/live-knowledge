import { ReactNode } from 'react'

export interface RendererPlugin {
  id: string
  routes?: {
    path: string
    element: ReactNode
  }[]
}

const registeredPlugins: RendererPlugin[] = []

export function registerRendererPlugin(plugin: RendererPlugin) {
  // Avoid duplicates
  if (registeredPlugins.find((p) => p.id === plugin.id)) return
  registeredPlugins.push(plugin)
}

export function getPluginRoutes() {
  return registeredPlugins.flatMap((p) => p.routes || [])
}
