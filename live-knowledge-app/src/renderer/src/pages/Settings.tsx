import { useState } from 'react'

const tabs = [
  { key: 'general', label: '通用' },
  { key: 'triggers', label: '触发规则' },
  { key: 'integrations', label: '系统集成' },
  { key: 'personal', label: '个性化' }
]

export default function Settings(): React.JSX.Element {
  const [active, setActive] = useState('general')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-gray-600">配置监控、触发、集成与个性化</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 text-sm rounded-t-lg ${active === t.key ? 'bg-blue-50 text-blue-700 border border-gray-200 border-b-transparent' : 'text-gray-700 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <div className="text-sm text-gray-600 mb-2">采集间隔</div>
            <input
              type="number"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded"
              placeholder="毫秒"
            />
          </div>
          <div className="rounded-lg border border-gray-200 p-4 bg-white">
            <div className="text-sm text-gray-600 mb-2">相似度阈值</div>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded"
              placeholder="0.85"
            />
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
