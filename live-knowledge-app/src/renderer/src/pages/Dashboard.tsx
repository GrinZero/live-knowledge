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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="mt-2 text-base text-gray-500">
          Real-time system monitoring and knowledge insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl border border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </span>
              <div className="text-sm font-medium text-gray-500">Total Insights</div>
            </div>
          </div>
          <div className="text-4xl font-bold mt-4 text-gray-900">{insightCount}</div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </span>
              <div className="text-sm font-medium text-gray-500">Knowledge Items</div>
            </div>
          </div>
          <div className="text-4xl font-bold mt-4 text-gray-900">{knowledgeCount}</div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </span>
              <div className="text-sm font-medium text-gray-500">Last Update</div>
            </div>
          </div>
          <div className="text-lg font-semibold mt-4 text-gray-900 truncate">
            {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '-'}
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                <Activity className="h-5 w-5 text-emerald-600" />
              </span>
              <div className="text-sm font-medium text-gray-500">System Status</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-lg font-semibold text-emerald-700">Active</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        <KnowledgePanel />
      </div>
    </div>
  )
}
