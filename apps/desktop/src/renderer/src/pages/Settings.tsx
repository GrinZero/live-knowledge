import { useState, useEffect } from 'react'
import { Save, Bot, RefreshCw, AlertCircle, Settings2, Zap, Link2, Palette, BellOff, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '../lib/api-client'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'general', label: '通用设置', icon: Settings2 },
  { key: 'ai', label: 'AI 模型', icon: Bot },
  { key: 'triggers', label: '触发规则', icon: Zap },
  { key: 'integrations', label: '系统集成', icon: Link2 },
  { key: 'personal', label: '个性化', icon: Palette }
]

export default function Settings(): React.JSX.Element {
  const [active, setActive] = useState('ai')
  const [aiConfig, setAiConfig] = useState({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
    proxyUrl: '',
    baseUrl: '',
    language: 'zh'
  })
  const [providerCache, setProviderCache] = useState<
    Record<string, { apiKey: string; model: string; baseUrl?: string }>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  useEffect(() => {
    loadAIConfig()
    loadAppSettings()
  }, [])

  useEffect(() => {
    setAvailableModels([])
    if (aiConfig.provider === 'openai') {
      const cached = providerCache['openai']
      if (
        cached?.apiKey !== aiConfig.apiKey ||
        cached?.model !== aiConfig.model ||
        cached?.baseUrl !== aiConfig.baseUrl
      ) {
        setAiConfig((prev) => ({
          ...prev,
          apiKey: cached?.apiKey || '',
          model: cached?.model || 'gpt-4.1',
          baseUrl: cached?.baseUrl || ''
        }))
      }
    } else if (aiConfig.provider === 'gemini') {
      const cached = providerCache['gemini']
      if (
        cached?.apiKey !== aiConfig.apiKey ||
        cached?.model !== aiConfig.model ||
        cached?.baseUrl !== aiConfig.baseUrl
      ) {
        setAiConfig((prev) => ({
          ...prev,
          apiKey: cached?.apiKey || '',
          model: cached?.model || 'gemini-2.5-flash',
          baseUrl: ''
        }))
      }
    } else if (aiConfig.provider === 'custom') {
      const cached = providerCache['custom']
      if (
        cached?.apiKey !== aiConfig.apiKey ||
        cached?.model !== aiConfig.model ||
        cached?.baseUrl !== aiConfig.baseUrl
      ) {
        setAiConfig((prev) => ({
          ...prev,
          apiKey: cached?.apiKey || '',
          model: cached?.model || '',
          baseUrl: cached?.baseUrl || ''
        }))
      }
    }
  }, [aiConfig.provider, providerCache])

  useEffect(() => {
    if (aiConfig.provider && (aiConfig.apiKey || aiConfig.model || aiConfig.baseUrl)) {
      setProviderCache((prev) => ({
        ...prev,
        [aiConfig.provider]: {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          baseUrl: aiConfig.baseUrl
        }
      }))
    }
  }, [aiConfig.provider, aiConfig.apiKey, aiConfig.model, aiConfig.baseUrl])

  const loadAIConfig = async () => {
    try {
      const config = await apiClient.settings.getAIConfig()
      if (config) {
        setAiConfig({
          provider: config.provider || 'gemini',
          apiKey: config.apiKey || '',
          model: config.model || '',
          proxyUrl: config.proxyUrl || '',
          baseUrl: config.baseUrl || '',
          language: config.language || 'zh'
        })
        if (config.provider) {
          setProviderCache((prev) => ({
            ...prev,
            [config.provider]: {
              apiKey: config.apiKey,
              model: config.model,
              baseUrl: config.baseUrl
            }
          }))
        }
        if (config.apiKey && config.provider) {
          fetchModels(config.apiKey, config.provider, config.proxyUrl, config.baseUrl)
        }
      }
    } catch (error) {
      console.error('Failed to load AI config:', error)
    }
  }

  const loadAppSettings = async () => {
    try {
      const settings = await apiClient.settings.getAppSettings()
      if (settings) {
        setNotificationsEnabled(settings.notificationsEnabled !== false)
      }
    } catch (error) {
      console.error('Failed to load app settings:', error)
    }
  }

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    try {
      await apiClient.settings.saveAppSettings({ notificationsEnabled: enabled })
      toast.success(enabled ? '通知已开启' : '通知已关闭')
    } catch (error) {
      console.error('Failed to save notification setting:', error)
      setNotificationsEnabled(!enabled)
      toast.error('保存通知设置失败')
    }
  }

  const fetchModels = async (key: string, provider: string, proxy?: string, baseUrl?: string) => {
    if (!key) return
    setIsFetchingModels(true)
    const proxyUrl = proxy !== undefined ? proxy : aiConfig.proxyUrl
    const url = baseUrl !== undefined ? baseUrl : aiConfig.baseUrl
    try {
      const models = await apiClient.settings.fetchModels({
        apiKey: key,
        provider,
        proxyUrl,
        baseUrl: url
      })
      if (models && models.length > 0) {
        setAvailableModels(models)
        if (!models.includes(aiConfig.model) && !aiConfig.model) {
          setAiConfig((prev) => ({ ...prev, model: models[0] }))
        }
      } else {
        toast.warning('未找到可用模型')
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
      toast.error('获取模型列表失败')
    } finally {
      setIsFetchingModels(false)
    }
  }

  const handleSaveAIConfig = async () => {
    setIsLoading(true)
    try {
      await apiClient.settings.saveAIConfig({
        ...aiConfig,
        language: aiConfig.language as 'zh' | 'en'
      })
      toast.success('配置已保存')
    } catch (error) {
      console.error('Failed to save AI config:', error)
      toast.error('保存配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass =
    'w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
  const helperClass = 'text-xs text-gray-500 mt-1.5'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">设置</h1>
        <p className="text-sm text-gray-500 mt-1">配置监控、AI 模型和系统集成</p>
      </div>

      {/* Settings Layout */}
      <div className="flex gap-6">
        {/* Left Sidebar - Tabs */}
        <div className="w-48 flex-none">
          <nav className="space-y-1">
            {tabs.map((t) => {
              const Icon = t.icon
              const isActive = active === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setActive(t.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive ? 'text-blue-600' : 'text-gray-400')} />
                  <span>{t.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            {active === 'general' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-medium text-gray-900 mb-4">通用设置</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>采集间隔</label>
                      <input type="number" className={inputClass} placeholder="15000" />
                      <p className={helperClass}>屏幕捕获的时间间隔（毫秒）</p>
                    </div>
                    <div>
                      <label className={labelClass}>相似度阈值</label>
                      <input type="number" step="0.01" className={inputClass} placeholder="0.85" />
                      <p className={helperClass}>内容去重的相似度阈值</p>
                    </div>
                  </div>
                </div>

                {/* 通知开关 */}
                <div className="border-t border-gray-100 pt-6">
                  <h2 className="text-base font-medium text-gray-900 mb-4">通知</h2>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {notificationsEnabled ? (
                        <Bell className="h-5 w-5 text-blue-600" />
                      ) : (
                        <BellOff className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">系统通知</p>
                        <p className="text-xs text-gray-500">
                          {notificationsEnabled
                            ? '洞察生成时会推送系统通知'
                            : '已关闭所有系统通知'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleNotifications(!notificationsEnabled)}
                      role="switch"
                      aria-checked={notificationsEnabled}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                        notificationsEnabled ? 'bg-blue-600' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {active === 'ai' && (
              <div className="space-y-6 max-w-lg">
                <div>
                  <h2 className="text-base font-medium text-gray-900 mb-4">AI 模型配置</h2>
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>服务提供商</label>
                      <select
                        value={aiConfig.provider}
                        onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
                        className={inputClass}
                      >
                        <option value="gemini">Google Gemini（推荐）</option>
                        <option value="openai">OpenAI</option>
                        <option value="custom">自定义（OpenAI 兼容）</option>
                      </select>
                    </div>

                    {aiConfig.provider === 'custom' && (
                      <div>
                        <label className={labelClass}>Base URL</label>
                        <input
                          type="text"
                          value={aiConfig.baseUrl}
                          onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                          placeholder="https://api.example.com/v1"
                          className={cn(inputClass, 'font-mono')}
                        />
                        <p className={helperClass}>自定义 API 的基础地址</p>
                      </div>
                    )}

                    <div>
                      <label className={labelClass}>API Key</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={aiConfig.apiKey}
                          onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                          onBlur={() => {
                            if (aiConfig.apiKey)
                              fetchModels(
                                aiConfig.apiKey,
                                aiConfig.provider,
                                aiConfig.proxyUrl,
                                aiConfig.baseUrl
                              )
                          }}
                          placeholder="输入 API Key..."
                          className={cn(inputClass, 'flex-1 font-mono')}
                        />
                        <button
                          onClick={() =>
                            fetchModels(
                              aiConfig.apiKey,
                              aiConfig.provider,
                              aiConfig.proxyUrl,
                              aiConfig.baseUrl
                            )
                          }
                          disabled={isFetchingModels || !aiConfig.apiKey}
                          className="h-10 w-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="获取模型列表"
                        >
                          <RefreshCw
                            className={cn('w-4 h-4', isFetchingModels && 'animate-spin')}
                          />
                        </button>
                      </div>
                      <p className={helperClass}>密钥仅存储在本地，输入后自动获取可用模型</p>
                    </div>

                    {aiConfig.provider !== 'custom' && (
                      <div>
                        <label className={labelClass}>代理地址（可选）</label>
                        <input
                          type="text"
                          value={aiConfig.proxyUrl}
                          onChange={(e) => setAiConfig({ ...aiConfig, proxyUrl: e.target.value })}
                          placeholder="http://127.0.0.1:7890"
                          className={cn(inputClass, 'font-mono')}
                        />
                        <p className={helperClass}>如果无法直接连接 API，可配置代理</p>
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-sm font-medium text-gray-700">模型名称</label>
                        {availableModels.length > 0 && (
                          <button
                            onClick={() => setAvailableModels([])}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            手动输入
                          </button>
                        )}
                      </div>
                      {availableModels.length > 0 ? (
                        <select
                          value={aiConfig.model}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              setAvailableModels([])
                              setAiConfig({ ...aiConfig, model: '' })
                            } else {
                              setAiConfig({ ...aiConfig, model: e.target.value })
                            }
                          }}
                          className={cn(inputClass, 'font-mono')}
                        >
                          {availableModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                          <option value="custom">自定义...</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={aiConfig.model}
                          onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                          placeholder={
                            aiConfig.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4.1'
                          }
                          className={cn(inputClass, 'font-mono')}
                        />
                      )}
                      {availableModels.length === 0 && !isFetchingModels && aiConfig.apiKey && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>无法自动获取模型列表，请手动输入</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>输出语言</label>
                      <select
                        value={aiConfig.language}
                        onChange={(e) =>
                          setAiConfig({ ...aiConfig, language: e.target.value as 'zh' | 'en' })
                        }
                        className={inputClass}
                      >
                        <option value="zh">中文</option>
                        <option value="en">English</option>
                      </select>
                      <p className={helperClass}>AI 生成摘要和洞察的语言</p>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleSaveAIConfig}
                        disabled={isLoading}
                        className="flex items-center gap-2 h-10 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        {isLoading ? '保存中...' : '保存配置'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {active === 'triggers' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-medium text-gray-900 mb-2">触发规则</h2>
                  <p className="text-sm text-gray-500">配置屏幕捕获的触发条件和去抖策略</p>
                </div>
                <div className="py-12 text-center text-gray-400">
                  <Zap className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>即将推出</p>
                </div>
              </div>
            )}

            {active === 'integrations' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-medium text-gray-900 mb-2">系统集成</h2>
                  <p className="text-sm text-gray-500">连接外部服务和云同步</p>
                </div>
                <div className="py-12 text-center text-gray-400">
                  <Link2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>即将推出</p>
                </div>
              </div>
            )}

            {active === 'personal' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-medium text-gray-900 mb-2">个性化</h2>
                  <p className="text-sm text-gray-500">主题、外观和隐私偏好</p>
                </div>
                <div className="py-12 text-center text-gray-400">
                  <Palette className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>即将推出</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
