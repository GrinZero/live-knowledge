/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { Plug, Plus, Settings, Code, FileText, Trash2, FileCode, Trash, CheckCircle, XCircle } from 'lucide-react'
import { apiClient } from '../lib/api-client'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { SchemaForm } from '../components/SchemaForm'
import { cn } from '@/lib/utils'

interface Plugin {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  config?: Record<string, unknown>
  configSchema?: Record<string, unknown>
}

interface WebhookLogEntry {
  id: string
  url: string
  event: string
  status: 'success' | 'failed'
  statusCode?: number
  error?: string
  timestamp: string
  requestBody?: Record<string, unknown>
}

export default function Plugins(): React.JSX.Element {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
  const [configJson, setConfigJson] = useState('')
  const [mode, setMode] = useState<'form' | 'json'>('json')
  const [configObject, setConfigObject] = useState<Record<string, unknown>>({})
  const [pluginTab, setPluginTab] = useState<'config' | 'logs'>('config')
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const loadPlugins = async () => {
    setLoading(true)
    try {
      const list = await apiClient.plugins.list()
      setPlugins(list)
    } catch (error) {
      console.error('Failed to load plugins:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlugins()
  }, [])

  const togglePlugin = async (id: string, enabled: boolean) => {
    try {
      await apiClient.plugins.toggle(id, enabled)
      loadPlugins()
    } catch (error) {
      console.error('Failed to toggle plugin:', error)
    }
  }

  const openConfig = (plugin: Plugin) => {
    setSelectedPlugin(plugin)
    const currentConfig = plugin.config || {}
    setConfigObject(currentConfig)
    setConfigJson(JSON.stringify(currentConfig, null, 2))
    setMode(plugin.configSchema ? 'form' : 'json')
    setPluginTab('config')
    // Load webhook logs if it's webhook-plugin
    if (plugin.id === 'webhook-plugin') {
      loadWebhookLogs()
    }
  }

  const loadWebhookLogs = async () => {
    setLogsLoading(true)
    try {
      const logs = (await window.api.plugins.invoke('webhook-plugin:getLogs')) as WebhookLogEntry[] | null
      setWebhookLogs(logs || [])
    } catch (error) {
      console.error('Failed to load webhook logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const clearWebhookLogs = async () => {
    try {
      await window.api.plugins.invoke('webhook-plugin:clearLogs')
      setWebhookLogs([])
    } catch (error) {
      console.error('Failed to clear webhook logs:', error)
    }
  }

  const handleModeSwitch = (newMode: 'form' | 'json') => {
    if (newMode === mode) return
    if (newMode === 'form') {
      try {
        const parsed = JSON.parse(configJson)
        setConfigObject(parsed)
        setMode('form')
      } catch {
        alert('JSON 格式错误，无法切换到表单模式')
      }
    } else {
      setConfigJson(JSON.stringify(configObject, null, 2))
      setMode('json')
    }
  }

  const saveConfig = async () => {
    if (!selectedPlugin) return
    try {
      let configToSave = configObject
      if (mode === 'json') {
        configToSave = JSON.parse(configJson)
      }
      await apiClient.plugins.updateConfig(selectedPlugin.id, configToSave)
      loadPlugins()
      setSelectedPlugin(null)
    } catch (error) {
      console.error('Failed to update config:', error)
      alert('保存失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleInstall = async () => {
    try {
      const filePath = await window.api.plugins.openFileDialog()
      if (filePath) {
        await window.api.plugins.install(filePath)
        loadPlugins()
        alert('插件安装成功！')
      }
    } catch (error) {
      console.error('Failed to install plugin:', error)
      alert('安装失败: ' + String(error))
    }
  }

  const handleUninstall = async (pluginId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要卸载该插件吗？卸载后将删除插件文件。')) return
    try {
      await window.api.plugins.uninstall(pluginId)
      loadPlugins()
      if (selectedPlugin?.id === pluginId) {
        setSelectedPlugin(null)
      }
      alert('插件已卸载')
    } catch (error) {
      console.error('Failed to uninstall plugin:', error)
      alert('卸载失败: ' + String(error))
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">插件管理</h1>
          <p className="text-sm text-gray-500 mt-1">扩展知识助手的能力，集成更多工具和工作流</p>
        </div>
        <button
          onClick={handleInstall}
          className="flex items-center gap-2 h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>安装插件</span>
        </button>
      </div>

      {/* Plugin List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : plugins.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="暂无已安装的插件"
            description="安装插件来扩展知识助手的功能"
            action={
              <button
                onClick={handleInstall}
                className="flex items-center gap-2 h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                安装插件
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className="group p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                    <Plug className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">{plugin.name}</h3>
                      <span className="text-xs text-gray-400">v{plugin.version}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1 max-w-md">
                      {plugin.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Actions - visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openConfig(plugin)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all"
                      title="配置"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    {(plugin as any).canUninstall && (
                      <button
                        onClick={(e) => handleUninstall(plugin.id, e)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="卸载"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => togglePlugin(plugin.id, !plugin.enabled)}
                    className={cn(
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                      plugin.enabled ? 'bg-blue-600' : 'bg-gray-200'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        plugin.enabled ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Config Dialog */}
      <Dialog open={!!selectedPlugin} onOpenChange={(open) => !open && setSelectedPlugin(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mr-8">
              <DialogTitle className="text-base">配置: {selectedPlugin?.name}</DialogTitle>
              <div className="flex items-center gap-2">
                {/* Tab buttons for webhook-plugin */}
                {selectedPlugin?.id === 'webhook-plugin' && (
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mr-2">
                    <button
                      onClick={() => setPluginTab('config')}
                      className={cn(
                        'px-3 py-1.5 rounded-md transition-all text-sm',
                        pluginTab === 'config'
                          ? 'bg-white shadow-sm text-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      )}
                    >
                      配置
                    </button>
                    <button
                      onClick={() => {
                        setPluginTab('logs')
                        loadWebhookLogs()
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-md transition-all text-sm flex items-center gap-1.5',
                        pluginTab === 'logs'
                          ? 'bg-white shadow-sm text-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      )}
                    >
                      日志
                      {webhookLogs.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                          {webhookLogs.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}
                {selectedPlugin?.configSchema && (
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => handleModeSwitch('form')}
                      className={cn(
                        'p-1.5 rounded-md transition-all',
                        mode === 'form'
                          ? 'bg-white shadow-sm text-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      )}
                      title="表单模式"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleModeSwitch('json')}
                      className={cn(
                        'p-1.5 rounded-md transition-all',
                        mode === 'json'
                          ? 'bg-white shadow-sm text-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      )}
                      title="JSON 模式"
                    >
                      <Code className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            {/* Config Tab */}
            {pluginTab === 'config' && (
              <>
                {mode === 'form' && selectedPlugin?.configSchema ? (
                  <SchemaForm
                    schema={selectedPlugin.configSchema}
                    value={configObject}
                    onChange={setConfigObject}
                  />
                ) : (
                  <div>
                    <p className="mb-2 text-sm text-gray-500">JSON 配置:</p>
                    <textarea
                      className="w-full h-80 font-mono text-sm p-4 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                      value={configJson}
                      onChange={(e) => setConfigJson(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                )}
              </>
            )}

            {/* Logs Tab - Only for webhook-plugin */}
            {pluginTab === 'logs' && selectedPlugin?.id === 'webhook-plugin' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Webhook 事件发送日志</p>
                  {webhookLogs.length > 0 && (
                    <button
                      onClick={clearWebhookLogs}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash className="w-3 h-3" />
                      清空日志
                    </button>
                  )}
                </div>

                {logsLoading ? (
                  <div className="py-8 text-center text-gray-400">加载中...</div>
                ) : webhookLogs.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无日志记录</p>
                    <p className="text-xs mt-1">发送 webhook 后将显示日志</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {webhookLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {log.status === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            )}
                            <span
                              className={cn(
                                'font-medium',
                                log.status === 'success' ? 'text-green-600' : 'text-red-600'
                              )}
                            >
                              {log.status === 'success' ? '成功' : '失败'}
                            </span>
                            {log.statusCode && (
                              <span className="text-xs text-gray-400">HTTP {log.statusCode}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(log.timestamp).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-gray-400 text-xs flex-shrink-0">URL:</span>
                            <code className="text-xs text-gray-600 break-all">{log.url}</code>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-gray-400 text-xs flex-shrink-0">事件:</span>
                            <code className="text-xs text-gray-600">{log.event}</code>
                          </div>
                          {log.error && (
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-xs flex-shrink-0">错误:</span>
                              <span className="text-xs text-red-500">{log.error}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPlugin(null)}>
              取消
            </Button>
            <Button onClick={saveConfig}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
