import { EventEmitter } from 'events'
import { LiveKnowledgePlugin, PluginContext } from '../types/plugin'
import { Action } from '../../renderer/src/types'
import { AIEngine } from './AIEngine'
import { DatabaseService } from './DatabaseService'
import { ipcMain } from 'electron'
import { Router } from 'express'

export class PluginManager extends EventEmitter {
  private plugins: Map<string, LiveKnowledgePlugin> = new Map()
  private enabledPlugins: Set<string> = new Set()
  private aiEngine: AIEngine
  private databaseService: DatabaseService
  // Map to store routers for each plugin
  public pluginRouters: Map<string, Router> = new Map()

  constructor(aiEngine: AIEngine, databaseService: DatabaseService) {
    super()
    this.aiEngine = aiEngine
    this.databaseService = databaseService
  }

  public registerPlugin(plugin: LiveKnowledgePlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin with id ${plugin.id} is already registered. Overwriting.`)
    }
    this.plugins.set(plugin.id, plugin)
    this.enabledPlugins.add(plugin.id) // Enable by default

    // Initialize config from plugin default
    if (plugin.defaultConfig) {
      plugin.config = { ...plugin.defaultConfig }
    }

    // Create a new router for this plugin
    const router = Router()
    this.pluginRouters.set(plugin.id, router)

    // Initialize plugin with dependencies
    if (plugin.initialize) {
      const context: PluginContext = {
        ai: {
          generateCompletion: (prompt: string) => this.aiEngine.generateCompletion(prompt),
          generateCompletionStream: (prompt: string, images?: string[]) =>
            this.aiEngine.generateCompletionStream(prompt, images)
        },
        ipc: {
          handle: (channel, listener) => ipcMain.handle(channel, listener)
        },
        http: {
          router: router
        },
        database: this.databaseService
      }
      try {
        plugin.initialize(context)
        console.log(`Plugin initialized: ${plugin.name}`)
      } catch (error) {
        console.error(`Error initializing plugin ${plugin.name}:`, error)
      }
    }

    console.log(`Plugin registered: ${plugin.name} (${plugin.version})`)
  }

  public updatePluginConfig(pluginId: string, config: Record<string, unknown>): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    plugin.config = { ...plugin.config, ...config }

    if (plugin.onConfigUpdated) {
      try {
        plugin.onConfigUpdated(plugin.config)
      } catch (error) {
        console.error(`Error updating config for plugin ${plugin.name}:`, error)
      }
    }
    console.log(`Plugin ${pluginId} config updated`)
  }

  public togglePlugin(pluginId: string, enabled: boolean): void {
    if (enabled) {
      this.enabledPlugins.add(pluginId)
    } else {
      this.enabledPlugins.delete(pluginId)
    }
    console.log(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`)
  }

  public getPluginStatus(): Array<{
    id: string
    name: string
    version: string
    description: string
    enabled: boolean
    config?: Record<string, unknown>
  }> {
    return Array.from(this.plugins.values()).map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description || '',
      enabled: this.enabledPlugins.has(p.id),
      config: p.config
    }))
  }

  // Hook Execution Methods

  public async getContexts(): Promise<Record<string, unknown>> {
    let aggregatedContext: Record<string, unknown> = {}

    for (const plugin of this.plugins.values()) {
      if (!this.enabledPlugins.has(plugin.id)) continue

      if (plugin.hooks?.getContext) {
        try {
          const context = await plugin.hooks.getContext()
          aggregatedContext = { ...aggregatedContext, ...context }
        } catch (error) {
          console.error(`Error in getContext hook for plugin ${plugin.id}:`, error)
        }
      }
    }

    return aggregatedContext
  }

  public async getPromptAdditions(currentContext: Record<string, unknown>): Promise<string> {
    const additions: string[] = []

    for (const plugin of this.plugins.values()) {
      if (!this.enabledPlugins.has(plugin.id)) continue

      if (plugin.hooks?.enrichPrompt) {
        try {
          const addition = await plugin.hooks.enrichPrompt(currentContext)
          if (addition) {
            additions.push(addition)
          }
        } catch (error) {
          console.error(`Error in enrichPrompt hook for plugin ${plugin.id}:`, error)
        }
      }
    }

    return additions.join('\n\n')
  }

  public async executeAction(action: Action): Promise<boolean> {
    let handled = false

    for (const plugin of this.plugins.values()) {
      if (!this.enabledPlugins.has(plugin.id)) continue

      if (plugin.hooks?.onAction) {
        try {
          const result = await plugin.hooks.onAction(action)
          if (result) {
            handled = true
            console.log(`Action ${action.type} handled by plugin ${plugin.id}`)
            // We assume multiple plugins can handle the same action if they want,
            // or we could stop at the first one. For now, let's allow all to try but report handled.
          }
        } catch (error) {
          console.error(`Error in onAction hook for plugin ${plugin.id}:`, error)
        }
      }
    }

    return handled
  }
}
