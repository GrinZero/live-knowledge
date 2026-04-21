import * as ReactInstance from 'react'
import * as ReactDOMInstance from 'react-dom'
import * as ReactRouterDOMInstance from 'react-router-dom'
import * as ReactJSXRuntimeInstance from 'react/jsx-runtime'
import { ReactNode } from 'react'

export interface RendererPlugin {
  id: string
  routes?: {
    path: string
    element: ReactNode
    layout?: 'sidebar' | 'page'
    title?: string
  }[]
  sidebarItems?: {
    path: string
    label: string
    icon: ReactInstance.ComponentType<{ className?: string }>
  }[]
}

const registeredPlugins: RendererPlugin[] = []
const listeners: (() => void)[] = []
let pluginScriptVersion = 0

export function registerRendererPlugin(plugin: RendererPlugin) {
  // Avoid duplicates
  if (registeredPlugins.find((p) => p.id === plugin.id)) return
  registeredPlugins.push(plugin)
  notifyListeners()
}

function clearRegisteredPlugins() {
  if (registeredPlugins.length === 0) return
  registeredPlugins.splice(0, registeredPlugins.length)
  notifyListeners()
}

function removePluginScript(id: string) {
  const existingScript = document.getElementById(`plugin-script-${id}`)
  if (existingScript) {
    existingScript.remove()
  }
}

export function buildPluginScriptUrl(scriptPath: string): string {
  pluginScriptVersion += 1
  const separator = scriptPath.includes('?') ? '&' : '?'
  return `${scriptPath}${separator}v=${pluginScriptVersion}`
}

export function subscribeToPluginUpdates(listener: () => void) {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }
}

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function getPluginRoutes() {
  return registeredPlugins.flatMap((p) =>
    (p.routes || []).map((route) => ({ ...route, pluginId: p.id }))
  )
}

export function getPluginSidebarItems() {
  return registeredPlugins.flatMap((p) =>
    (p.sidebarItems || []).map((item) => ({ ...item, pluginId: p.id }))
  )
}

// Expose registration to global scope for external plugins
window.LiveKnowledge = {
  registerPlugin: registerRendererPlugin
}

// Expose React and other dependencies for plugins
window.React = ReactInstance
window.ReactDOM = ReactDOMInstance
window.ReactRouterDOM = ReactRouterDOMInstance
window.ReactJSXRuntime = ReactJSXRuntimeInstance

// Expose lowercase aliases for bundlers that might look for package names
// @ts-ignore: Allow string indexing for dynamic exposure
window['react'] = ReactInstance
// @ts-ignore: Allow string indexing
window['react-dom'] = ReactDOMInstance
// @ts-ignore: Allow string indexing
window['react-router-dom'] = ReactRouterDOMInstance
// @ts-ignore: Allow string indexing
window['react/jsx-runtime'] = ReactJSXRuntimeInstance

export async function loadInstalledPlugins() {
  try {
    const plugins = await window.api.plugins.getRendererPlugins()
    console.log('Loading renderer plugins:', plugins)

    clearRegisteredPlugins()

    document.querySelectorAll('[id^="plugin-script-"]').forEach((node) => node.remove())

    for (const plugin of plugins) {
      removePluginScript(plugin.id)

      const script = document.createElement('script')
      script.id = `plugin-script-${plugin.id}`
      script.src = buildPluginScriptUrl(plugin.scriptPath)
      script.async = true
      script.onload = () => console.log(`Loaded plugin script: ${plugin.id}`)
      script.onerror = (e) => console.error(`Failed to load plugin script: ${plugin.id}`, e)
      document.body.appendChild(script)
    }
  } catch (error) {
    console.error('Failed to load installed plugins:', error)
  }
}

export function __resetPluginRegistryForTests() {
  clearRegisteredPlugins()
  pluginScriptVersion = 0
  document.querySelectorAll('[id^="plugin-script-"]').forEach((node) => node.remove())
}
