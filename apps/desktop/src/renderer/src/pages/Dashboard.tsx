import { useEffect, useState } from 'react'
import { Brain, BookOpen, Clock, Activity } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import KnowledgePanel from '../components/KnowledgePanel'
import { apiClient } from '../lib/api-client'

export default function Dashboard(): React.JSX.Element {
  const [insightCount, setInsightCount] = useState(0)
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  useEffect(() => {
    const load = async (): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insights: any[] = await apiClient.database.getInsights(100)
      const items = await apiClient.database.getKnowledgeItems(100)
      setInsightCount(insights.length)
      setKnowledgeCount(items.length)
      const latest = insights[0]?.createdAt ?? null
      setLastUpdate(latest)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">知识库</h1>
        <p className="text-sm text-gray-500 mt-1">管理和浏览 AI 提取的知识条目</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Brain}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          label="洞察总数"
          value={insightCount}
          size="md"
        />
        <StatCard
          icon={BookOpen}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          label="知识条目"
          value={knowledgeCount}
          size="md"
        />
        <StatCard
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          label="最近更新"
          value={lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '-'}
          size="md"
        />
        <StatCard
          icon={Activity}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          label="系统状态"
          value="运行中"
          size="md"
        />
      </div>

      {/* Knowledge Panel */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <KnowledgePanel />
      </div>
    </div>
  )
}
