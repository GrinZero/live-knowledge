/**
 * 日志拦截器 - 使用 electron-log 将日志写入文件
 * 核心代码: [Core]
 * 插件代码: [Plugin:xxx]
 *
 * 打包后日志文件位置:
 * - macOS: ~/Library/Logs/<appName>/
 * - Windows: %USERPROFILE%\AppData\Roaming\<appName>\logs\
 * - Linux: ~/.config/<appName>/logs/
 */
import log from 'electron-log'
import chalk from 'chalk'
import { app } from 'electron'
import { join } from 'path'

// electron-log v5 配置
const logDir = join(app.getPath('home'), `Library/Logs/${app.getName()}`)
const logFile = join(logDir, 'main.log')

log.transports.file.resolvePathFn = () => logFile
log.transports.file.level = 'debug'
log.transports.console.level = 'debug'

// 日志文件最大 5MB，保留 3 个旧文件
log.transports.file.maxSize = 5 * 1024 * 1024

// 自定义格式化，添加颜色前缀（仅控制台）
log.transports.console.format = '{y} {h}{m}{s}{r} [{level}] {text}'

// 插件路径关键字
const PLUGIN_PATHS = ['plugins/']

/**
 * 从调用栈中提取调用者信息
 */
function getCallerInfo(): { isPlugin: boolean; moduleName: string } {
  const stack = new Error().stack || ''
  const lines = stack.split('\n')

  for (const line of lines) {
    for (const pluginPath of PLUGIN_PATHS) {
      if (line.includes(pluginPath)) {
        // 提取插件目录名，如 "WebhookPlugin" 从 "...plugins/WebhookPlugin/src/index.ts" 中
        const match = line.match(/plugins\/([^/]+)/)
        const moduleName = match ? match[1] : 'UnknownPlugin'
        return { isPlugin: true, moduleName }
      }
    }
  }
  return { isPlugin: false, moduleName: '' }
}

/**
 * 获取带颜色的前缀
 */
function getPrefix(isPlugin: boolean, moduleName: string): string {
  return isPlugin ? chalk.magenta(`[Plugin:${moduleName}]`) : chalk.blue('[Core]')
}

// 保存原始方法用于避免递归
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

// 拦截 console.log
console.log = (...args: unknown[]) => {
  const { isPlugin, moduleName } = getCallerInfo()
  const prefix = getPrefix(isPlugin, moduleName)

  // electron-log 写入文件
  const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  log.info(`${isPlugin ? `[Plugin:${moduleName}]` : '[Core]'} ${message}`)

  // 保留原始控制台输出（带颜色）
  originalLog.apply(console, [prefix, ...args])
}

// 拦截 console.warn
console.warn = (...args: unknown[]) => {
  const { isPlugin, moduleName } = getCallerInfo()
  const prefix = getPrefix(isPlugin, moduleName)

  const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  log.warn(`${isPlugin ? `[Plugin:${moduleName}]` : '[Core]'} ${message}`)

  originalWarn.apply(console, [prefix, ...args])
}

// 拦截 console.error
console.error = (...args: unknown[]) => {
  const { isPlugin, moduleName } = getCallerInfo()
  const prefix = getPrefix(isPlugin, moduleName)

  const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
  log.error(`${isPlugin ? `[Plugin:${moduleName}]` : '[Core]'} ${message}`)

  originalError.apply(console, [prefix, ...args])
}

// 捕获未处理的 Promise  rejection
process.on('unhandledRejection', (reason) => {
  log.error('[UnhandledRejection]', reason)
})

// 捕获未捕获的异常
process.on('uncaughtException', (error) => {
  log.error('[UncaughtException]', error)
})

// 导出 log 实例供其他模块直接使用
export { log }

// 导出获取日志文件路径的函数
export const getLogFilePath = (): string => logFile
