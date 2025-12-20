import { useState, useEffect } from 'react'
import { Plug, Plus, Settings } from 'lucide-react'
import { apiClient } from '../lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'

interface Plugin {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  config?: Record<string, unknown>
}

export default function Plugins(): React.JSX.Element {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
  const [configJson, setConfigJson] = useState('')

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
    setConfigJson(JSON.stringify(plugin.config || {}, null, 2))
  }

  const saveConfig = async () => {
    if (!selectedPlugin) return
    try {
      const config = JSON.parse(configJson)
      await apiClient.plugins.updateConfig(selectedPlugin.id, config)
      loadPlugins()
      setSelectedPlugin(null)
    } catch (error) {
      console.error('Failed to update config:', error)
      alert('Update failed: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">插件管理</h1>
          <p className="mt-1 text-sm text-gray-500">扩展知识助手的能力，集成更多工具和工作流</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
                      <h3 className="text-base font-semibold text-gray-900">{plugin.name}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        v{plugin.version}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 max-w-2xl">{plugin.description}</p>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>配置插件: {selectedPlugin?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-2 text-sm text-gray-500">JSON 配置:</p>
            <textarea
              className="w-full h-96 font-mono text-sm p-4 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              spellCheck={false}
            />
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
