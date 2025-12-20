import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { MonitoringService } from './services/MonitoringService'
import type { MonitorConfig } from '../renderer/src/types'
import { DatabaseService } from './services/DatabaseService'
import { AIEngine } from './services/AIEngine'
import { ScreenWatcher } from './services/ScreenWatcher'
import { ContentAnalyzer } from './services/ContentAnalyzer'
import { PresentationService } from './services/PresentationService'
import { APIServer } from './services/APIServer'
import { PluginManager } from './services/PluginManager'
import { DevToolsPlugin } from './services/plugins/DevToolsPlugin'
import { ProblemSolverPlugin } from './services/plugins/ProblemSolverPlugin'
import { pathToFileURL } from 'url'

// Inject system proxy settings if provided in env
// We do not hardcode defaults anymore, relying on process.env passed from shell
// const proxyUrl = 'http://127.0.0.1:7890'
// process.env.https_proxy = proxyUrl
// process.env.http_proxy = proxyUrl
// process.env.all_proxy = 'socks5://127.0.0.1:7890'

let monitoringService: MonitoringService | null = null
let databaseService: DatabaseService | null = null
let presentationService: PresentationService | null = null
let apiServer: APIServer | null = null
let aiEngine: AIEngine | null = null
let pluginManager: PluginManager | null = null

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// Initialize services
async function initializeServices(): Promise<void> {
  try {
    // Initialize database
    databaseService = new DatabaseService()
    await databaseService.initialize()
    console.log('Database service initialized')

    // Initialize AI engine (with persistence check)
    aiEngine = new AIEngine()

    // Try to load persisted config for default user
    try {
      const persistedConfig = await databaseService.getAIConfig('default_user')
      if (persistedConfig) {
        const apiKey = persistedConfig.credentials.apiKey as string
        const provider = persistedConfig.settings.provider as 'openai' | 'gemini'
        const model = persistedConfig.settings.model as string
        const proxyUrl = persistedConfig.settings.proxyUrl as string
        const language = persistedConfig.settings.language as 'zh' | 'en'

        if (apiKey && provider) {
          aiEngine.updateConfig({ apiKey, provider, model, proxyUrl, language })
        }
      } else {
        // Fallback to env vars if no persisted config
        const envProvider = process.env.GEMINI_API_KEY ? 'gemini' : 'openai'
        const envKey =
          envProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY
        const envModel = process.env.AI_MODEL

        if (envKey) {
          aiEngine.updateConfig({ apiKey: envKey, provider: envProvider, model: envModel })
        }
      }
    } catch (e) {
      console.error('Failed to load AI config:', e)
    }

    console.log('AI engine initialized')

    // Initialize screen watcher
    const screenWatcher = new ScreenWatcher()
    console.log('Screen watcher initialized')

    // Initialize content analyzer
    const contentAnalyzer = new ContentAnalyzer(aiEngine)
    console.log('Content analyzer initialized')

    // Initialize presentation service
    presentationService = new PresentationService()
    console.log('Presentation service initialized')

    // Initialize plugin manager
    pluginManager = new PluginManager(aiEngine)

    // Register default plugins
    pluginManager.registerPlugin(new DevToolsPlugin())
    pluginManager.registerPlugin(new ProblemSolverPlugin())

    console.log('Plugin manager initialized')

    // Initialize monitoring service
    monitoringService = new MonitoringService(
      screenWatcher,
      contentAnalyzer,
      aiEngine,
      databaseService,
      presentationService,
      pluginManager
    )
    console.log('Monitoring service initialized')

    // Initialize API server
    apiServer = new APIServer(
      databaseService,
      monitoringService,
      presentationService,
      pluginManager,
      aiEngine,
      3000
    )
    await apiServer.start()
    console.log('API server initialized on port 3000')
  } catch (error) {
    console.error('Failed to initialize services:', error)
    throw error
  }
}

// Setup IPC handlers
function setupIpcHandlers(): void {
  // Monitoring control IPC handlers
  ipcMain.handle('monitoring:start', async (_, config: MonitorConfig) => {
    if (!monitoringService) throw new Error('Monitoring service not initialized')
    return await monitoringService.startMonitoring(config)
  })

  ipcMain.handle('monitoring:stop', async () => {
    if (!monitoringService) throw new Error('Monitoring service not initialized')
    return await monitoringService.stopMonitoring()
  })

  ipcMain.handle('monitoring:pause', async () => {
    if (!monitoringService) throw new Error('Monitoring service not initialized')
    return await monitoringService.pauseMonitoring()
  })

  ipcMain.handle('monitoring:resume', async () => {
    if (!monitoringService) throw new Error('Monitoring service not initialized')
    return await monitoringService.resumeMonitoring()
  })

  ipcMain.handle('monitoring:getStatus', async () => {
    if (!monitoringService) return { status: 'not_initialized' }
    return await monitoringService.getStatus()
  })

  ipcMain.handle('settings:getAIConfig', async () => {
    if (!databaseService) throw new Error('Database service not initialized')
    // Assuming single user mode for now
    const config = await databaseService.getAIConfig('default_user')
    if (!config) return null
    return {
      apiKey: config.credentials.apiKey,
      provider: config.settings.provider,
      model: config.settings.model,
      proxyUrl: config.settings.proxyUrl,
      language: config.settings.language
    }
  })

  ipcMain.handle(
    'settings:saveAIConfig',
    async (
      _,
      config: {
        apiKey: string
        provider: string
        model: string
        proxyUrl?: string
        language?: 'zh' | 'en'
      }
    ) => {
      if (!databaseService) throw new Error('Database service not initialized')
      await databaseService.saveAIConfig('default_user', config)

      // Update running instance
      if (aiEngine) {
        aiEngine.updateConfig({
          ...config,
          provider: config.provider as 'openai' | 'gemini'
        })
      }
    }
  )

  ipcMain.handle(
    'settings:fetchModels',
    async (_, config: { apiKey: string; provider: string; proxyUrl?: string }) => {
      if (!aiEngine) throw new Error('AI Engine not initialized')
      return await aiEngine.fetchModels(config)
    }
  )

  // Database IPC handlers
  ipcMain.handle('db:getUser', async (_, userId: string) => {
    if (!databaseService) throw new Error('Database service not initialized')
    return await databaseService.getUser(userId)
  })

  ipcMain.handle('db:createUser', async (_, userData) => {
    if (!databaseService) throw new Error('Database service not initialized')
    return await databaseService.createUser(userData)
  })

  ipcMain.handle('db:getInsights', async (_, limit: number = 50) => {
    if (!databaseService) throw new Error('Database service not initialized')
    return await databaseService.getInsights(limit)
  })

  ipcMain.handle('db:getKnowledgeItems', async (_, limit: number = 100) => {
    if (!databaseService) throw new Error('Database service not initialized')
    return await databaseService.getKnowledgeItems(limit)
  })

  ipcMain.handle('db:searchKnowledge', async (_, query: string) => {
    if (!databaseService) throw new Error('Database service not initialized')
    return await databaseService.searchKnowledge(query)
  })

  ipcMain.handle('db:deleteKnowledgeItem', async (_, id: string) => {
    if (!databaseService) throw new Error('Database service not initialized')
    return await databaseService.deleteKnowledgeItem(id)
  })

  ipcMain.handle('db:getUserStats', async (_, userId: string) => {
    if (!databaseService) throw new Error('Database service not initialized')
    return await databaseService.getUserStatistics(userId)
  })

  // Plugin Management IPC
  ipcMain.handle('plugins:list', async () => {
    if (!pluginManager) return []
    return pluginManager.getPluginStatus()
  })

  ipcMain.handle('plugins:toggle', async (_, id: string, enabled: boolean) => {
    if (!pluginManager) throw new Error('Plugin manager not initialized')
    pluginManager.togglePlugin(id, enabled)
    return true
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register custom protocol for serving local media files
  // Standard and secure way to load local files in Electron
  protocol.handle('media', (request) => {
    // 1. Strip 'media://' to get the raw path
    let urlPath = request.url.replace('media://', '')

    // 2. Decode URI component to handle spaces (%20) and other special characters
    urlPath = decodeURIComponent(urlPath)

    // 3. Handle path normalization based on OS
    // On Windows, paths might look like /C:/Users/... or C:/Users/...
    // On macOS/Linux, paths look like /Users/...
    let finalPath = urlPath

    if (process.platform === 'win32') {
      // Remove leading slash if it precedes a drive letter (e.g., /C:/... -> C:/...)
      if (finalPath.startsWith('/') && finalPath.includes(':')) {
        finalPath = finalPath.slice(1)
      }
    } else {
      // Ensure leading slash for POSIX paths (e.g., Users/... -> /Users/...)
      if (!finalPath.startsWith('/')) {
        finalPath = '/' + finalPath
      }
    }

    // 4. Use net.fetch with file:// protocol
    // pathToFileURL handles conversion to proper file URL (e.g., spaces -> %20, backslashes on windows)
    try {
      return net.fetch(pathToFileURL(finalPath).toString())
    } catch (error) {
      console.error('Failed to fetch media:', error)
      return new Response('Not Found', { status: 404 })
    }
  })

  // Initialize services
  try {
    await initializeServices()
    setupIpcHandlers()
    console.log('All services initialized successfully')
  } catch (error) {
    console.error('Failed to initialize application:', error)
    app.quit()
    return
  }

  const mainWindow = createWindow()

  // Set up monitoring service event handlers
  if (monitoringService) {
    monitoringService.on('insightGenerated', (insight) => {
      mainWindow.webContents.send('monitoring:insight', insight)
    })

    monitoringService.on('statusChanged', (status) => {
      mainWindow.webContents.send('monitoring:status', status)
    })

    monitoringService.on('error', (error) => {
      mainWindow.webContents.send('monitoring:error', error)
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Clean up services before quitting
  if (monitoringService) {
    monitoringService.stopMonitoring().catch(console.error)
  }
  if (databaseService) {
    databaseService.close().catch(console.error)
  }
  if (apiServer) {
    apiServer.stop().catch(console.error)
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
