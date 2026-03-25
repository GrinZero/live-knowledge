import { EventEmitter } from 'events'
import {
  LiveKnowledgePlugin,
  PluginContext,
  EventTypeDefinition as SdkEventTypeDefinition,
  EventDispatchContext
} from '../../../../../packages/plugin-sdk/src'
import { Action } from '../../renderer/src/types'
import { AIEngine } from './AIEngine'
import { DatabaseService } from './DatabaseService'
import { ipcMain, app } from 'electron'
import { Router } from 'express'
import * as path from 'path'
import * as fs from 'fs'
// @ts-ignore: adm-zip types issue
import AdmZip from 'adm-zip'
import * as tar from 'tar'

type EventDomain = 'core' | 'knowledge' | 'information' | 'system'

interface EventTypeDefinition extends SdkEventTypeDefinition {
  source: 'core' | 'plugin'
}

interface EventEnvelope {
  type: string
  domain: EventDomain
  payload: Readonly<Record<string, unknown>>
  emittedAt: string
  source: string
}

const CORE_EVENT_TYPES: EventTypeDefinition[] = [
  {
    type: 'raw.created',
    domain: 'core',
    description:
      'Raw screen capture before any OCR/AI analysis. Emitted for each screenshot taken during context capture window.',
    source: 'core'
  },
  {
    type: 'knowledge.created',
    domain: 'knowledge',
    description: 'A new knowledge item is persisted by the monitoring pipeline.',
    source: 'core'
  },
  {
    type: 'insight.generated',
    domain: 'information',
    description: 'A new insight is generated from monitored context.',
    source: 'core'
  }
]

export class PluginManager extends EventEmitter {
  private plugins: Map<string, LiveKnowledgePlugin> = new Map()
  private enabledPlugins: Set<string> = new Set()
  private aiEngine: AIEngine
  private databaseService: DatabaseService
  // Map to store routers for each plugin
  public pluginRouters: Map<string, Router> = new Map()

  private pluginsDir: string
  // Track plugin paths to identify which are external/uninstallable
  private pluginPaths: Map<string, string> = new Map()
  // Track renderer entry points for plugins
  private rendererEntries: Map<string, string> = new Map()
  private eventTypeRegistry: Map<string, EventTypeDefinition> = new Map()

  constructor(aiEngine: AIEngine, databaseService: DatabaseService) {
    super()
    this.aiEngine = aiEngine
    this.databaseService = databaseService
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins')
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true })
    }

    this.registerEventTypes(CORE_EVENT_TYPES)
  }

  public async initialize(): Promise<void> {
    try {
      const paths = await this.databaseService.getInstalledPlugins()
      for (const path of paths) {
        try {
          await this.loadPluginFromFile(path, false)
        } catch (e) {
          console.error(`Failed to restore plugin from ${path}:`, e)
        }
      }
    } catch (error) {
      console.error('Failed to load installed plugins:', error)
    }
  }

  public async installPlugin(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.zip' || ext === '.lkp') {
      await this.installPluginFromZip(filePath)
    } else if (ext === '.tgz' || ext === '.gz') {
      await this.installPluginFromTarball(filePath)
    } else if (ext === '.js') {
      await this.loadPluginFromFile(filePath, true)
    } else {
      throw new Error(`Unsupported plugin format: ${ext}`)
    }
  }

  private async installPluginFromTarball(tarPath: string): Promise<void> {
    console.log(`Installing plugin from tarball: ${tarPath}`)
    try {
      // 1. Create a temporary directory to extract to
      const tempDir = path.join(app.getPath('temp'), `plugin-install-${Date.now()}`)
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      // 2. Extract tarball
      await tar.x({
        file: tarPath,
        cwd: tempDir
      })

      // 3. Find package.json
      // npm pack creates a 'package' folder.
      let packageRoot = tempDir
      if (fs.existsSync(path.join(tempDir, 'package', 'package.json'))) {
        packageRoot = path.join(tempDir, 'package')
      } else if (!fs.existsSync(path.join(tempDir, 'package.json'))) {
        // Try to find it recursively? Or just fail.
        // Let's look for the first package.json
        const findPackageJson = (dir: string): string | null => {
          const files = fs.readdirSync(dir)
          if (files.includes('package.json')) return dir
          for (const file of files) {
            const fullPath = path.join(dir, file)
            if (fs.statSync(fullPath).isDirectory()) {
              const found = findPackageJson(fullPath)
              if (found) return found
            }
          }
          return null
        }
        const found = findPackageJson(tempDir)
        if (!found) {
          throw new Error('Invalid plugin package: package.json not found')
        }
        packageRoot = found
      }

      const packageJsonContent = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
      const packageJson = JSON.parse(packageJsonContent)

      if (!packageJson.name || !packageJson.version) {
        throw new Error('Invalid plugin package: missing name or version in package.json')
      }

      const pluginId = packageJson.name
      const installPath = path.join(this.pluginsDir, pluginId)

      // Remove existing if any
      if (fs.existsSync(installPath)) {
        console.log(`Removing existing plugin at ${installPath}`)
        fs.rmSync(installPath, { recursive: true, force: true })
      }

      // Move from temp to install path
      fs.mkdirSync(installPath, { recursive: true })
      // We copy everything from packageRoot to installPath
      fs.cpSync(packageRoot, installPath, { recursive: true })

      // Cleanup temp
      fs.rmSync(tempDir, { recursive: true, force: true })

      // Find entry point
      const mainFile = packageJson.main || 'dist/index.js'
      const entryPath = path.join(installPath, mainFile)

      if (!fs.existsSync(entryPath)) {
        throw new Error(`Plugin entry point not found: ${entryPath}`)
      }

      // Load it
      await this.loadPluginFromFile(entryPath, true)
    } catch (error) {
      console.error(`Failed to install plugin from tarball ${tarPath}:`, error)
      throw error
    }
  }

  private async installPluginFromZip(zipPath: string): Promise<void> {
    console.log(`Installing plugin from zip: ${zipPath}`)
    try {
      const zip = new AdmZip(zipPath)
      const zipEntries = zip.getEntries()

      // Find package.json

      const packageJsonEntry = zipEntries.find(
        (
          entry: any // eslint-disable-line @typescript-eslint/no-explicit-any
        ) => entry.entryName === 'package.json' || entry.entryName.endsWith('/package.json')
      )
      if (!packageJsonEntry) {
        throw new Error('Invalid plugin package: package.json not found')
      }

      const packageJsonContent = packageJsonEntry.getData().toString('utf8')
      const packageJson = JSON.parse(packageJsonContent)

      if (!packageJson.name || !packageJson.version) {
        throw new Error('Invalid plugin package: missing name or version in package.json')
      }

      const pluginId = packageJson.name
      const installPath = path.join(this.pluginsDir, pluginId)

      // Remove existing if any
      if (fs.existsSync(installPath)) {
        console.log(`Removing existing plugin at ${installPath}`)
        fs.rmSync(installPath, { recursive: true, force: true })
      }

      // Extract
      console.log(`Extracting plugin to ${installPath}`)
      zip.extractAllTo(installPath, true)

      // Find entry point
      // If the zip has a root folder, we might need to adjust
      // But our pack script puts package.json at root.
      // So we expect package.json at installPath/package.json

      const mainFile = packageJson.main || 'dist/index.js'
      const entryPath = path.join(installPath, mainFile)

      if (!fs.existsSync(entryPath)) {
        throw new Error(`Plugin entry point not found: ${entryPath}`)
      }

      // Load it
      await this.loadPluginFromFile(entryPath, true)
    } catch (error) {
      console.error(`Failed to install plugin from zip ${zipPath}:`, error)
      throw error
    }
  }

  public async loadPluginFromFile(filePath: string, persist = true): Promise<void> {
    console.log(`Loading plugin from file: ${filePath}`)
    try {
      // Clear cache to allow reloading
      try {
        delete require.cache[require.resolve(filePath)]
      } catch {
        // Ignore if not in cache
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require(filePath)

      let PluginClass = module.default
      if (!PluginClass) {
        // Try to find an exported class that looks like a plugin
        const keys = Object.keys(module)
        for (const key of keys) {
          // Basic heuristic: check if it's a class/function
          if (typeof module[key] === 'function' && module[key].prototype) {
            PluginClass = module[key]
            break
          }
        }
      }

      if (!PluginClass) {
        throw new Error('No plugin class found in module exports')
      }

      const plugin = new PluginClass()
      if (!plugin.id || !plugin.name) {
        throw new Error('Invalid plugin instance: missing id or name')
      }

      await this.registerPlugin(plugin)

      if (persist) {
        await this.databaseService.addInstalledPlugin(filePath)
      }

      this.pluginPaths.set(plugin.id, filePath)

      // Try to find package.json to register renderer entry
      try {
        const findPackageJson = (dir: string): string | null => {
          if (fs.existsSync(path.join(dir, 'package.json'))) {
            return path.join(dir, 'package.json')
          }
          const parent = path.dirname(dir)
          if (parent === dir) return null
          return findPackageJson(parent)
        }

        const packageJsonPath = findPackageJson(path.dirname(filePath))
        if (packageJsonPath) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
          if (packageJson.renderer) {
            const rendererPath = path.resolve(path.dirname(packageJsonPath), packageJson.renderer)
            if (fs.existsSync(rendererPath)) {
              this.rendererEntries.set(plugin.id, rendererPath)
              console.log(`Registered renderer entry for plugin ${plugin.id}: ${rendererPath}`)
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to check renderer entry for plugin ${plugin.id}`, e)
      }

      console.log(`Successfully loaded plugin from ${filePath}`)
    } catch (error) {
      console.error(`Failed to load plugin from ${filePath}:`, error)
      throw error
    }
  }

  public async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    const pluginPath = this.pluginPaths.get(pluginId)
    if (!pluginPath) {
      throw new Error(`Plugin ${pluginId} cannot be uninstalled (likely a built-in plugin)`)
    }

    console.log(`Uninstalling plugin: ${pluginId} from ${pluginPath}`)

    try {
      // 1. Unregister
      this.plugins.delete(pluginId)
      this.enabledPlugins.delete(pluginId)
      this.pluginRouters.delete(pluginId)
      this.pluginPaths.delete(pluginId)
      this.rendererEntries.delete(pluginId)

      // 2. Remove from DB
      await this.databaseService.removeInstalledPlugin(pluginPath)

      // Also remove config? Maybe keep it in case of reinstall?
      // Let's keep config for now, or maybe remove it.
      // Usually uninstall implies removing everything.
      // But for now let's just remove the installation record.

      // 3. Delete files if in pluginsDir
      // If pluginPath is inside pluginsDir, delete the parent directory (the plugin folder)
      // Check if pluginPath starts with pluginsDir
      if (pluginPath.startsWith(this.pluginsDir)) {
        // pluginPath is typically .../plugins/<pluginId>/dist/index.js
        // We want to delete .../plugins/<pluginId>
        const pluginFolder = path.join(this.pluginsDir, pluginId)
        if (fs.existsSync(pluginFolder)) {
          console.log(`Deleting plugin folder: ${pluginFolder}`)
          fs.rmSync(pluginFolder, { recursive: true, force: true })
        }
      }

      console.log(`Plugin ${pluginId} uninstalled successfully`)
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginId}:`, error)
      throw error
    }
  }

  public async registerPlugin(plugin: LiveKnowledgePlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin with id ${plugin.id} is already registered. Overwriting.`)
    }
    this.plugins.set(plugin.id, plugin)
    this.enabledPlugins.add(plugin.id) // Enable by default

    // Initialize config from plugin default
    if (plugin.defaultConfig) {
      plugin.config = { ...plugin.defaultConfig }
    }

    // Try to load persisted config
    try {
      const persistedConfig = await this.databaseService.getPluginConfig(plugin.id)
      if (persistedConfig) {
        // Deep merge or shallow merge? Shallow merge is usually enough for top-level keys
        plugin.config = { ...plugin.config, ...persistedConfig }
        console.log(`Loaded persisted config for plugin ${plugin.id}`)
      }
    } catch (error) {
      console.error(`Failed to load config for plugin ${plugin.id}:`, error)
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
          handle: (
            channel: string,
            listener: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown
          ) => ipcMain.handle(channel, listener)
        },
        http: {
          router: router
        },
        database: this.databaseService,
        events: {
          registerTypes: (definitions: SdkEventTypeDefinition[]) =>
            this.registerEventTypes(definitions.map((d) => ({ ...d, source: 'plugin' as const }))),
          getTypes: () => this.getEventTypes() as SdkEventTypeDefinition[],
          emit: async (type: string, payload: Record<string, unknown>) => {
            await this.triggerEvent(type, payload, plugin.id)
          }
        }
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

  public async updatePluginConfig(
    pluginId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    plugin.config = { ...plugin.config, ...config }

    // Persist config
    try {
      await this.databaseService.savePluginConfig(pluginId, plugin.config)
    } catch (error) {
      console.error(`Failed to persist config for plugin ${pluginId}:`, error)
    }

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
    configSchema?: Record<string, unknown>
    canUninstall: boolean
  }> {
    return Array.from(this.plugins.values()).map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description || '',
      enabled: this.enabledPlugins.has(p.id),
      config: p.config,
      configSchema: p.configSchema,
      canUninstall: this.pluginPaths.has(p.id)
    }))
  }

  public getRendererPlugins(): Array<{ id: string; scriptPath: string }> {
    return Array.from(this.rendererEntries.entries())
      .filter(([id]) => this.enabledPlugins.has(id))
      .map(([id, scriptPath]) => ({
        id,
        // Convert to media URL for usage in renderer to bypass security restrictions
        // We use the custom media:// protocol which is registered in main/index.ts
        scriptPath: `media://${scriptPath}`
      }))
  }

  private normalizeEventTypeDefinition(
    definition: EventTypeDefinition
  ): EventTypeDefinition | null {
    const type = (definition.type || '').trim()
    const description = (definition.description || '').trim()

    if (!type || !description) {
      console.warn('[PluginManager] Skip invalid event type definition:', definition)
      return null
    }

    const normalizedDomain = definition.domain
    if (!normalizedDomain) {
      return null
    }

    return {
      type,
      domain: normalizedDomain as EventDomain,
      description,
      source: definition.source || 'plugin'
    }
  }

  private registerEventTypes(definitions: EventTypeDefinition[]): void {
    for (const definition of definitions) {
      const normalized = this.normalizeEventTypeDefinition(definition)
      if (!normalized) continue

      const existing = this.eventTypeRegistry.get(normalized.type)
      if (existing) {
        if (
          existing.domain !== normalized.domain ||
          existing.description !== normalized.description
        ) {
          console.warn(
            `[PluginManager] Event type ${normalized.type} already registered with different metadata. Keep first definition.`
          )
        }
        continue
      }

      this.eventTypeRegistry.set(normalized.type, normalized)
    }
  }

  public getEventTypes(options?: {
    domain?: EventDomain
    source?: 'core' | 'plugin'
  }): EventTypeDefinition[] {
    let types = Array.from(this.eventTypeRegistry.values()).sort((a, b) =>
      a.type.localeCompare(b.type)
    )

    if (options?.domain) {
      types = types.filter((t) => t.domain === options.domain)
    }

    if (options?.source) {
      types = types.filter((t) => t.source === options.source)
    }

    return types
  }

  public getEventType(type: string): EventTypeDefinition | undefined {
    return this.eventTypeRegistry.get(type)
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

  public async triggerEvent(
    event: string,
    payload: Record<string, unknown>,
    source = 'core.pipeline'
  ): Promise<void> {
    const definition = this.eventTypeRegistry.get(event)

    console.log(
      `[PluginManager] triggerEvent called: ${event}, payload.sessionId: ${payload.sessionId}`
    )

    if (!definition) {
      console.warn(`[PluginManager] Skip unregistered event type: ${event}`)
      console.log(
        `[PluginManager] Registered event types:`,
        Array.from(this.eventTypeRegistry.keys())
      )
      return
    }

    // Write to database first
    const sessionId = payload.sessionId as string | undefined
    console.log(`[PluginManager] sessionId: ${sessionId}, definition exists: ${!!definition}`)
    if (sessionId) {
      const confidence =
        Array.isArray((payload as { tags?: Array<{ confidence?: number }> }).tags) &&
        typeof (payload as { tags?: Array<{ confidence?: number }> }).tags![0]?.confidence ===
          'number'
          ? ((payload as { tags?: Array<{ confidence?: number }> }).tags![0]!.confidence as number)
          : 0.5

      console.log(`[PluginManager] Creating trigger event: ${event}, sessionId: ${sessionId}`)
      await this.databaseService.createTriggerEvent({
        sessionId,
        eventType: event,
        content: payload,
        confidence
      })
      console.log(`[PluginManager] Trigger event created successfully: ${event}`)
    } else {
      console.log(`[PluginManager] Skipping database write - no sessionId`)
    }

    // Convert screenshotPath to Buffer before sending to plugins
    let processedPayload = { ...payload }
    if (processedPayload.screenshotPath && typeof processedPayload.screenshotPath === 'string') {
      const screenshotPath = processedPayload.screenshotPath as string
      try {
        if (fs.existsSync(screenshotPath)) {
          const buffer = fs.readFileSync(screenshotPath)
          processedPayload = {
            ...processedPayload,
            screenshotBuffer: buffer,
            screenshotPath: undefined // Remove path, only send buffer
          }
          console.log(
            `[PluginManager] Converted screenshotPath to Buffer for plugin delivery: ${screenshotPath}`
          )
        }
      } catch (err) {
        console.error(`[PluginManager] Failed to read screenshot file: ${screenshotPath}`, err)
      }
    }

    const envelope: EventEnvelope = {
      type: definition.type,
      domain: definition.domain,
      payload: Object.freeze(processedPayload),
      emittedAt: new Date().toISOString(),
      source
    }

    const context: EventDispatchContext = {
      envelope,
      eventTypes: this.getEventTypes()
    }

    for (const plugin of this.plugins.values()) {
      if (!this.enabledPlugins.has(plugin.id)) continue

      if (plugin.hooks?.onEvent) {
        try {
          await plugin.hooks.onEvent(envelope.type, envelope.payload, context)
        } catch (error) {
          console.error(`Error in onEvent hook for plugin ${plugin.id}:`, error)
        }
      }
    }
  }
}
