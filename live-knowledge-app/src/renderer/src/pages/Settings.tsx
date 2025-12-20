import { useState, useEffect } from 'react'
import { Save, Bot, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '../lib/api-client'

const tabs = [
  { key: 'general', label: '通用' },
  { key: 'ai', label: 'AI 模型' },
  { key: 'triggers', label: '触发规则' },
  { key: 'integrations', label: '系统集成' },
  { key: 'personal', label: '个性化' }
]

export default function Settings(): React.JSX.Element {
  const [active, setActive] = useState('general')
  const [aiConfig, setAiConfig] = useState({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
    proxyUrl: '',
    language: 'zh'
  })
  // Cache for provider settings to restore when switching back
  const [providerCache, setProviderCache] = useState<
    Record<string, { apiKey: string; model: string }>
  >({})

  const [isLoading, setIsLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)

  useEffect(() => {
    loadAIConfig()
  }, [])

  useEffect(() => {
    // Clear available models when provider changes to prevent mismatch
    setAvailableModels([])

    // Update defaults or restore from cache when provider changes
    if (aiConfig.provider === 'openai') {
      const cached = providerCache['openai']
      setAiConfig((prev) => ({
        ...prev,
        apiKey: cached?.apiKey || '',
        model: cached?.model || 'gpt-4.1'
      }))
    } else if (aiConfig.provider === 'gemini') {
      const cached = providerCache['gemini']
      setAiConfig((prev) => ({
        ...prev,
        apiKey: cached?.apiKey || '',
        model: cached?.model || 'gemini-2.5-flash'
      }))
    }
  }, [aiConfig.provider])

  // Update cache when config changes
  useEffect(() => {
    if (aiConfig.provider && (aiConfig.apiKey || aiConfig.model)) {
      setProviderCache((prev) => ({
        ...prev,
        [aiConfig.provider]: {
          apiKey: aiConfig.apiKey,
          model: aiConfig.model
        }
      }))
    }
  }, [aiConfig.provider, aiConfig.apiKey, aiConfig.model])

  const loadAIConfig = async () => {
    try {
      const config = await apiClient.settings.getAIConfig()
      if (config) {
        setAiConfig({
          provider: config.provider || 'gemini',
          apiKey: config.apiKey || '',
          model: config.model || '',
          proxyUrl: config.proxyUrl || '',
          language: config.language || 'zh'
        })
        // Initialize cache with loaded config
        if (config.provider) {
          setProviderCache((prev) => ({
            ...prev,
            [config.provider]: {
              apiKey: config.apiKey,
              model: config.model
            }
          }))
        }

        // If we have a key and provider, try to fetch models immediately
        if (config.apiKey && config.provider) {
          fetchModels(config.apiKey, config.provider, config.proxyUrl)
        }
      }
    } catch (error) {
      console.error('Failed to load AI config:', error)
    }
  }

  const fetchModels = async (key: string, provider: string, proxy?: string) => {
    if (!key) return
    setIsFetchingModels(true)
    const proxyUrl = proxy !== undefined ? proxy : aiConfig.proxyUrl
    try {
      const models = await apiClient.settings.fetchModels({ apiKey: key, provider, proxyUrl })
      if (models && models.length > 0) {
        setAvailableModels(models)
        // If current model is not in list, select the first one or keep it if it's custom
        if (!models.includes(aiConfig.model) && !aiConfig.model) {
          setAiConfig((prev) => ({ ...prev, model: models[0] }))
        }
      } else {
        toast.warning('No models found for this API Key')
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
      toast.error('Failed to fetch available models')
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
      toast.success('AI configuration saved successfully')
    } catch (error) {
      console.error('Failed to save AI config:', error)
      toast.error('Failed to save AI configuration')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-gray-600">配置监控、触发、集成与个性化</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap rounded-t-lg transition-all cursor-pointer ${
              active === t.key
                ? 'bg-blue-50 text-blue-700 border border-gray-200 border-b-transparent font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <div className="text-sm font-medium text-gray-700 mb-2">采集间隔</div>
            <input
              type="number"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="毫秒"
            />
          </div>
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <div className="text-sm font-medium text-gray-700 mb-2">相似度阈值</div>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="0.85"
            />
          </div>
        </div>
      )}

      {active === 'ai' && (
        <div className="flex flex-col gap-4 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Bot className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">AI 模型配置</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={aiConfig.provider}
                  onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                >
                  <option value="gemini">Google Gemini (Recommended)</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={aiConfig.apiKey}
                    onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                    onBlur={() => {
                      if (aiConfig.apiKey) fetchModels(aiConfig.apiKey, aiConfig.provider)
                    }}
                    placeholder="Enter your API key..."
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-mono text-sm"
                  />
                  <button
                    onClick={() => fetchModels(aiConfig.apiKey, aiConfig.provider)}
                    disabled={isFetchingModels || !aiConfig.apiKey}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:scale-95 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Fetch available models"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingModels ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Keys are stored locally. Models will be fetched automatically when key is entered.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proxy URL (Optional)
                </label>
                <input
                  type="text"
                  value={aiConfig.proxyUrl}
                  onChange={(e) => setAiConfig({ ...aiConfig, proxyUrl: e.target.value })}
                  placeholder="http://127.0.0.1:7890"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Configure a proxy if you are having trouble connecting to the AI provider.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
                <div className="relative">
                  {availableModels.length > 0 ? (
                    <select
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-mono text-sm appearance-none"
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                      <option value="custom">Custom...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                      placeholder={aiConfig.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4.1'}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-mono text-sm"
                    />
                  )}

                  {availableModels.length > 0 && (
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                    </div>
                  )}
                </div>
                {availableModels.length === 0 && !isFetchingModels && aiConfig.apiKey && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>Could not fetch models automatically. You can enter one manually.</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language / 语言
                </label>
                <select
                  value={aiConfig.language}
                  onChange={(e) =>
                    setAiConfig({ ...aiConfig, language: e.target.value as 'zh' | 'en' })
                  }
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                >
                  <option value="zh">中文 (Chinese)</option>
                  <option value="en">English (英文)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the language for AI summaries and insights.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSaveAIConfig}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {active === 'triggers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 bg-white">触发规则设置</div>
          <div className="rounded-lg border border-gray-200 p-4 bg-white">去抖与节流</div>
        </div>
      )}

      {active === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 bg-white">系统集成设置</div>
          <div className="rounded-lg border border-gray-200 p-4 bg-white">云同步</div>
        </div>
      )}

      {active === 'personal' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 bg-white">主题与外观</div>
          <div className="rounded-lg border border-gray-200 p-4 bg-white">隐私偏好</div>
        </div>
      )}
    </div>
  )
}
