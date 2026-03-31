// 日志拦截器 - 必须在其他导入之前初始化
import './utils/logInterceptor'

import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  protocol,
  net,
  dialog,
  Tray,
  Menu,
  nativeImage,
  globalShortcut
} from 'electron'
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
import { pathToFileURL } from 'url'
import { log, getLogFilePath } from './utils/logInterceptor'

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
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let refreshTrayMenu: (() => void) | null = null

function createTray(): void {
  if (tray) {
    return
  }

  const trayIcon = nativeImage.createFromPath(icon)
  const traySizedIcon =
    process.platform === 'darwin'
      ? trayIcon.resize({ width: 18, height: 18 })
      : process.platform === 'win32'
        ? trayIcon.resize({ width: 16, height: 16 })
        : trayIcon.resize({ width: 24, height: 24 })

  if (process.platform === 'darwin') {
    traySizedIcon.setTemplateImage(true)
  }

  tray = new Tray(traySizedIcon)
  tray.setToolTip('Live Knowledge')

  const updateTrayMenu = (): void => {
    const isVisible = mainWindow?.isVisible() ?? false
    const menu = Menu.buildFromTemplate([
      {
        label: isVisible ? '隐藏窗口' : '显示窗口',
        click: () => {
          if (!mainWindow) return

          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])

    tray?.setContextMenu(menu)
  }
  refreshTrayMenu = updateTrayMenu

  updateTrayMenu()
}

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

  mainWindow.on('show', () => {
    if (tray) {
      tray.setToolTip('Live Knowledge')
    }
    // macOS: 窗口显示时恢复 Dock 图标
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show()
    }
    refreshTrayMenu?.()
  })

  mainWindow.on('blur', () => {
    mainWindow?.webContents.send('window:blur')
  })

  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('window:focus')
  })

  mainWindow.on('hide', () => {
    // macOS: 窗口隐藏到托盘时隐藏 Dock 图标
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide()
    }
    refreshTrayMenu?.()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
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
        const provider = persistedConfig.settings.provider as 'openai' | 'gemini' | 'custom'
        const model = persistedConfig.settings.model as string
        const proxyUrl = persistedConfig.settings.proxyUrl as string
        const baseUrl = persistedConfig.settings.baseUrl as string
        const language = persistedConfig.settings.language as 'zh' | 'en'

        if (apiKey && provider) {
          aiEngine.updateConfig({ apiKey, provider, model, proxyUrl, baseUrl, language })
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

    // 从数据库加载通知设置并同步
    try {
      const appSettings = await databaseService.getAppSettings('default_user')
      presentationService.setNotificationsEnabled(appSettings.notificationsEnabled)
    } catch (e) {
      console.error('Failed to load app settings:', e)
    }

    console.log('Presentation service initialized')

    // Initialize plugin manager
    pluginManager = new PluginManager(aiEngine, databaseService)

    // Register default plugins
    await pluginManager.registerPlugin(new DevToolsPlugin())

    // Load installed plugins
    await pluginManager.initialize()

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
      baseUrl: config.settings.baseUrl,
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
        baseUrl?: string
        language?: 'zh' | 'en'
      }
    ) => {
      if (!databaseService) throw new Error('Database service not initialized')
      await databaseService.saveAIConfig('default_user', config)

      // Update running instance
      if (aiEngine) {
        aiEngine.updateConfig({
          ...config,
          provider: config.provider as 'openai' | 'gemini' | 'custom'
        })
      }
    }
  )

  ipcMain.handle(
    'settings:fetchModels',
    async (
      _,
      config: { apiKey: string; provider: string; proxyUrl?: string; baseUrl?: string }
    ) => {
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

  ipcMain.handle('plugins:getRendererPlugins', async () => {
    if (!pluginManager) return []
    return pluginManager.getRendererPlugins()
  })

  ipcMain.handle('plugins:toggle', async (_, id: string, enabled: boolean) => {
    if (!pluginManager) throw new Error('Plugin manager not initialized')
    pluginManager.togglePlugin(id, enabled)
    return true
  })

  ipcMain.handle('plugins:updateConfig', async (_, id: string, config: Record<string, unknown>) => {
    if (!pluginManager) throw new Error('Plugin manager not initialized')
    await pluginManager.updatePluginConfig(id, config)
    return true
  })

  ipcMain.handle('plugins:install', async (_, filePath: string) => {
    if (!pluginManager) throw new Error('Plugin manager not initialized')
    await pluginManager.installPlugin(filePath)
    return true
  })

  ipcMain.handle('plugins:uninstall', async (_, id: string) => {
    if (!pluginManager) throw new Error('Plugin manager not initialized')
    await pluginManager.uninstallPlugin(id)
    return true
  })

  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Plugins', extensions: ['zip', 'lkp', 'tgz', 'gz', 'js'] }]
    })
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Logs API - 导出日志文件
  ipcMain.handle('logs:export', async () => {
    try {
      const logPath = getLogFilePath()
      const fs = await import('fs')
      const content = await fs.promises.readFile(logPath, 'utf-8')
      return { success: true, content, path: logPath }
    } catch (error) {
      console.error('Failed to export logs:', error)
      return { success: false, error: String(error) }
    }
  })
}

// Global shortcut management
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+S'
let currentShortcut: string = DEFAULT_SHORTCUT

function registerQuickCaptureShortcut(shortcut: string): boolean {
  // Unregister all first
  globalShortcut.unregisterAll()

  try {
    const success = globalShortcut.register(shortcut, () => {
      console.log('[Shortcut] Quick capture triggered')
      if (monitoringService) {
        monitoringService.triggerManualCapture().catch((err) => {
          console.error('[Shortcut] Manual capture failed:', err)
        })
      }
    })

    if (success) {
      currentShortcut = shortcut
      console.log(`[Shortcut] Registered: ${shortcut}`)
    } else {
      console.warn(`[Shortcut] Failed to register: ${shortcut}`)
    }
    return success
  } catch (error) {
    console.error('[Shortcut] Registration error:', error)
    return false
  }
}

function setupShortcutHandlers(): void {
  // IPC handler to get current shortcut
  ipcMain.handle('shortcut:get', async () => {
    return { shortcut: currentShortcut }
  })

  // IPC handler to update shortcut
  ipcMain.handle('shortcut:set', async (_, newShortcut: string) => {
    if (!newShortcut || newShortcut.trim() === '') {
      throw new Error('Shortcut cannot be empty')
    }

    const success = registerQuickCaptureShortcut(newShortcut)
    if (success) {
      // Save to database
      if (databaseService) {
        await databaseService.saveAppSettings('default_user', { quickCaptureShortcut: newShortcut })
      }
    }
    return { success }
  })
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
    setupShortcutHandlers()
    console.log('All services initialized successfully')

    // Load saved shortcut and register
    try {
      const appSettings = await databaseService!.getAppSettings('default_user')
      const savedShortcut = appSettings.quickCaptureShortcut || DEFAULT_SHORTCUT
      registerQuickCaptureShortcut(savedShortcut)
    } catch (e) {
      console.error('Failed to load shortcut settings:', e)
      registerQuickCaptureShortcut(DEFAULT_SHORTCUT)
    }
  } catch (error) {
    console.error('Failed to initialize application:', error)
    app.quit()
    return
  }

  mainWindow = createWindow()
  createTray()

  // Set up monitoring service event handlers
  if (monitoringService) {
    monitoringService.on('insightGenerated', (insight) => {
      mainWindow?.webContents.send('monitoring:insight', insight)
    })

    monitoringService.on('statusChanged', (status) => {
      mainWindow?.webContents.send('monitoring:status', status)
    })

    monitoringService.on('error', (error) => {
      mainWindow?.webContents.send('monitoring:error', error)
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      createTray()
      refreshTrayMenu?.()
      return
    }

    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
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

app.on('before-quit', () => {
  isQuitting = true
  // Cleanup global shortcuts
  globalShortcut.unregisterAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
