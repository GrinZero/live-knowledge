import { BrowserWindow, screen, ipcMain, Notification } from 'electron'
import { join } from 'path'
import { Insight } from '../../renderer/src/types'

export type PresentationMode = 'overlay' | 'sidebar' | 'bubble' | 'notification'

export interface PresentationConfig {
  mode: PresentationMode
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  opacity?: number
  autoHide?: boolean
  hideDelay?: number
}

export class PresentationService {
  private presentationWindow: BrowserWindow | null = null
  private currentMode: PresentationMode = 'notification'
  private notificationsEnabled: boolean = true
  private config: PresentationConfig = {
    mode: 'notification',
    opacity: 0.9,
    autoHide: true,
    hideDelay: 5000
  }

  constructor() {
    this.setupIpcHandlers()
  }

  private setupIpcHandlers(): void {
    ipcMain.handle(
      'presentation:show',
      async (_, insight: Insight, config?: PresentationConfig) => {
        return await this.showInsight(insight, config)
      }
    )

    ipcMain.handle('presentation:hide', async () => {
      return await this.hidePresentation()
    })

    ipcMain.handle('presentation:setMode', async (_, mode: PresentationMode) => {
      this.currentMode = mode
      return { success: true }
    })

    ipcMain.handle('presentation:getConfig', async () => {
      return this.config
    })

    ipcMain.handle('presentation:updateConfig', async (_, config: Partial<PresentationConfig>) => {
      this.config = { ...this.config, ...config }
      return { success: true }
    })
  }

  async showInsight(insight: Insight, config?: PresentationConfig): Promise<void> {
    if (!this.notificationsEnabled) return

    const mergedConfig = { ...this.config, ...config }

    switch (mergedConfig.mode) {
      case 'overlay':
        await this.showOverlay(insight, mergedConfig)
        break
      case 'sidebar':
        await this.showSidebar(insight, mergedConfig)
        break
      case 'bubble':
        await this.showBubble(insight, mergedConfig)
        break
      case 'notification':
        await this.showNotification(insight, mergedConfig)
        break
      default:
        await this.showNotification(insight, mergedConfig)
    }
  }

  private async showOverlay(insight: Insight, config: PresentationConfig): Promise<void> {
    if (this.presentationWindow && !this.presentationWindow.isDestroyed()) {
      this.presentationWindow.close()
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    this.presentationWindow = new BrowserWindow({
      width: Math.min(600, width - 100),
      height: Math.min(400, height - 100),
      x: Math.max(50, (width - 600) / 2),
      y: Math.max(50, (height - 400) / 2),
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      opacity: config.opacity || 0.9,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // Load the presentation component
    if (process.env.NODE_ENV === 'development') {
      this.presentationWindow.loadURL(
        `http://localhost:5174#/presentation/overlay?insight=${encodeURIComponent(JSON.stringify(insight))}`
      )
    } else {
      this.presentationWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: `/presentation/overlay?insight=${encodeURIComponent(JSON.stringify(insight))}`
      })
    }

    this.setupAutoHide(config)
  }

  private async showSidebar(insight: Insight, config: PresentationConfig): Promise<void> {
    if (this.presentationWindow && !this.presentationWindow.isDestroyed()) {
      this.presentationWindow.close()
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    this.presentationWindow = new BrowserWindow({
      width: 350,
      height: height - 100,
      x: width - 350 - 20,
      y: 50,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      opacity: config.opacity || 0.95,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // Load the sidebar presentation component
    if (process.env.NODE_ENV === 'development') {
      this.presentationWindow.loadURL(
        `http://localhost:5174#/presentation/sidebar?insight=${encodeURIComponent(JSON.stringify(insight))}`
      )
    } else {
      this.presentationWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: `/presentation/sidebar?insight=${encodeURIComponent(JSON.stringify(insight))}`
      })
    }

    this.setupAutoHide(config)
  }

  private async showBubble(insight: Insight, config: PresentationConfig): Promise<void> {
    if (this.presentationWindow && !this.presentationWindow.isDestroyed()) {
      this.presentationWindow.close()
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    this.presentationWindow = new BrowserWindow({
      width: 300,
      height: 150,
      x: width - 320,
      y: height - 200,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      opacity: config.opacity || 0.9,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // Load the bubble presentation component
    if (process.env.NODE_ENV === 'development') {
      this.presentationWindow.loadURL(
        `http://localhost:5174#/presentation/bubble?insight=${encodeURIComponent(JSON.stringify(insight))}`
      )
    } else {
      this.presentationWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: `/presentation/bubble?insight=${encodeURIComponent(JSON.stringify(insight))}`
      })
    }

    this.setupAutoHide(config)
  }

  private async showNotification(insight: Insight, config: PresentationConfig): Promise<void> {
    // Use system notification for minimal disruption
    if (process.platform === 'win32' || process.platform === 'darwin') {
      if (Notification.isSupported()) {
        new Notification({
          title: insight.title,
          body: insight.content,
          icon: join(__dirname, '../../resources/icon.png'),
          silent: false
        }).show()
      }
    } else {
      // Fallback to bubble for Linux
      await this.showBubble(insight, config)
    }
  }

  private setupAutoHide(config: PresentationConfig): void {
    if (config.autoHide && config.hideDelay) {
      setTimeout(() => {
        this.hidePresentation()
      }, config.hideDelay)
    }
  }

  async hidePresentation(): Promise<void> {
    if (this.presentationWindow && !this.presentationWindow.isDestroyed()) {
      this.presentationWindow.close()
      this.presentationWindow = null
    }
  }

  updateConfig(config: Partial<PresentationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getCurrentMode(): PresentationMode {
    return this.currentMode
  }

  getConfig(): PresentationConfig {
    return this.config
  }

  setNotificationsEnabled(enabled: boolean): void {
    this.notificationsEnabled = enabled
  }

  getNotificationsEnabled(): boolean {
    return this.notificationsEnabled
  }

  destroy(): void {
    if (this.presentationWindow && !this.presentationWindow.isDestroyed()) {
      this.presentationWindow.close()
    }
  }
}
