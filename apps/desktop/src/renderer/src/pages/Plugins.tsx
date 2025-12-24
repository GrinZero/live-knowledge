/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { Plug, Plus, Settings, Code, FileText, Trash2 } from 'lucide-react'
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

export default function Plugins(): React.JSX.Element {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
  const [configJson, setConfigJson] = useState('')
  const [mode, setMode] = useState<'form' | 'json'>('json')
  const [configObject, setConfigObject] = useState<Record<string, unknown>>({})

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
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mr-8">
              <DialogTitle className="text-base">配置: {selectedPlugin?.name}</DialogTitle>
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
          </DialogHeader>

          <div className="py-4">
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
