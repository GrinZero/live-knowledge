import { useEffect, useState } from 'react'
import { Activity, Brain, BookOpen, Clock } from 'lucide-react'
import KnowledgePanel from '../components/KnowledgePanel'

export default function Dashboard(): React.JSX.Element {
  const [insightCount, setInsightCount] = useState(0)
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const insights = await window.api.database.getInsights(100)
      const items = await window.api.database.getKnowledgeItems(100)
      setInsightCount(insights.length)
      setKnowledgeCount(items.length)
      const latest = insights[0]?.createdAt ?? null
      setLastUpdate(latest)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">概览</h1>
        <p className="text-sm text-gray-400">系统状态与知识/洞察统计</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Brain className="h-4 w-4 text-purple-600" />
              </span>
              <div className="text-sm text-gray-600">洞察总数</div>
            </div>
          </div>
          <div className="text-3xl font-bold mt-3">{insightCount}</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-blue-600" />
              </span>
              <div className="text-sm text-gray-600">知识项总数</div>
            </div>
          </div>
          <div className="text-3xl font-bold mt-3">{knowledgeCount}</div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </span>
              <div className="text-sm text-gray-600">最近更新</div>
            </div>
          </div>
          <div className="text-lg mt-3 text-gray-700">
            {lastUpdate ? new Date(lastUpdate).toLocaleString() : '-'}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Activity className="h-4 w-4 text-green-600" />
              </span>
              <div className="text-sm text-gray-600">运行状态</div>
            </div>
          </div>
          <div className="text-lg mt-3 text-gray-700">实时监控可在“监控”查看</div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        <KnowledgePanel />
      </div>
    </div>
  )
}
