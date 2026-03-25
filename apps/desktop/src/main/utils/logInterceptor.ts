/**
 * 日志拦截器 - 为核心代码和插件日志自动添加颜色前缀
 * 核心代码: 蓝色 [Core]
 * 插件代码: 洋红色 [Plugin:xxx]
 */
import chalk from 'chalk'

// 保存原始 console 方法
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

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
 * 格式化日志消息，添加颜色前缀
 */
function formatMessage(
  _type: 'log' | 'warn' | 'error',
  isPlugin: boolean,
  moduleName: string,
  args: unknown[]
): unknown[] {
  const prefix = isPlugin ? chalk.magenta(`[Plugin:${moduleName}]`) : chalk.blue('[Core]')

  return [prefix, ...args]
}

// 拦截 console.log
console.log = (...args: unknown[]) => {
  const { isPlugin, moduleName } = getCallerInfo()
  originalLog.apply(console, formatMessage('log', isPlugin, moduleName, args))
}

// 拦截 console.warn
console.warn = (...args: unknown[]) => {
  const { isPlugin, moduleName } = getCallerInfo()
  originalWarn.apply(console, formatMessage('warn', isPlugin, moduleName, args))
}

// 拦截 console.error
console.error = (...args: unknown[]) => {
  const { isPlugin, moduleName } = getCallerInfo()
  originalError.apply(console, formatMessage('error', isPlugin, moduleName, args))
}
