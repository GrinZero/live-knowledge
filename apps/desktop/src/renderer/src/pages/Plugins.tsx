/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { Plug, Plus, Settings, Code, FileText, Trash2 } from 'lucide-react'
import { apiClient } from '../lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { SchemaForm } from '../components/SchemaForm'

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
      alert('Update failed: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleInstall = async () => {
    try {
      const filePath = await window.api.plugins.openFileDialog()
      if (filePath) {
        await window.api.plugins.install(filePath)
        loadPlugins()
        alert('Plugin installed successfully!')
      }
    } catch (error) {
      console.error('Failed to install plugin:', error)
      alert('Failed to install plugin: ' + String(error))
    }
  }

  const handleUninstall = async (pluginId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要卸载该插件吗？卸载后将删除插件文件。')) return

    try {
      await window.api.plugins.uninstall(pluginId)
      loadPlugins()
      // If we uninstalled the currently selected plugin, clear selection
      if (selectedPlugin?.id === pluginId) {
        setSelectedPlugin(null)
      }
      alert('Plugin uninstalled successfully!')
    } catch (error) {
      console.error('Failed to uninstall plugin:', error)
      alert('Failed to uninstall plugin: ' + String(error))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 selectable">插件管理</h1>
          <p className="mt-1 text-sm text-gray-500 selectable">
            扩展知识助手的能力，集成更多工具和工作流
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>安装插件</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : plugins.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <Plug className="w-12 h-12 text-gray-300 mb-4" />
            <p>暂无已安装的插件</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className="p-6 flex items-start justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                    <Plug className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900 selectable">
                        {plugin.name}
                      </h3>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full selectable">
                        v{plugin.version}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 max-w-2xl selectable">
                      {plugin.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => openConfig(plugin)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    title="Configure"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  {(plugin as any).canUninstall && (
                    <button
                      onClick={(e) => handleUninstall(plugin.id, e)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="卸载插件"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => togglePlugin(plugin.id, !plugin.enabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      plugin.enabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        plugin.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedPlugin} onOpenChange={(open) => !open && setSelectedPlugin(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mr-8">
              <DialogTitle>配置插件: {selectedPlugin?.name}</DialogTitle>
              {selectedPlugin?.configSchema && (
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => handleModeSwitch('form')}
                    className={`p-1.5 rounded-md transition-all ${
                      mode === 'form'
                        ? 'bg-white shadow-sm text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="表单模式"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleModeSwitch('json')}
                    className={`p-1.5 rounded-md transition-all ${
                      mode === 'json'
                        ? 'bg-white shadow-sm text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
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
                <p className="mb-2 text-sm text-gray-500">JSON 配置 (可直接编辑):</p>
                <textarea
                  className="w-full h-96 font-mono text-sm p-4 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none resize-none selectable"
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
            <Button onClick={saveConfig}>保存配置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
