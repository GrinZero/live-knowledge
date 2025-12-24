import { useState, useEffect } from 'react'
import { Search, Trash2, Download, ChevronDown, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidePanel } from '@/components/ui/side-panel'
import { EmptyState } from '@/components/ui/empty-state'
import { ImagePreview } from '@/components/ImagePreview'
import { apiClient } from '../lib/api-client'
import { cn } from '@/lib/utils'

interface KnowledgeItem {
  id: string
  userId: string
  type: string
  title: string
  content: string
  metadata: Record<string, unknown>
  confidence: number
  createdAt: string
}

import { Action } from '@/types'

interface Insight {
  id: string
  knowledgeItemId?: string
  type: 'task' | 'schedule' | 'note' | 'analysis' | 'reminder'
  title: string
  content: string
  priority: 'low' | 'medium' | 'high'
  suggestedActions: Action[]
  metadata: Record<string, unknown>
  createdAt?: string
}

export default function KnowledgePanel(): React.JSX.Element {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [filteredItems, setFilteredItems] = useState<KnowledgeItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'type'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const pageSize = 20

  useEffect(() => {
    loadKnowledgeItems()
    loadInsights()

    const handleInsightGenerated = (_: unknown, newInsight: Insight) => {
      setInsights((prev) => {
        if (prev.some((i) => i.id === newInsight.id)) return prev
        return [newInsight, ...prev]
      })
      loadKnowledgeItems()
    }

    // @ts-ignore - Electron IPC API
    if (window.electron && window.electron.ipcRenderer) {
      // @ts-ignore - Electron IPC API
      window.electron.ipcRenderer.on('monitoring:insight', handleInsightGenerated)
    }

    return () => {
      // @ts-ignore - Electron IPC API
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore - Electron IPC API
        window.electron.ipcRenderer.removeAllListeners('monitoring:insight')
      }
    }
  }, [])

  useEffect(() => {
    filterAndSortItems()
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeItems, searchQuery, selectedType, sortBy, sortOrder])

  const loadKnowledgeItems = async () => {
    setIsLoading(true)
    try {
      const items = await apiClient.database.getKnowledgeItems(100)
      setKnowledgeItems(items)
    } catch (error) {
      console.error('Failed to load knowledge items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadInsights = async () => {
    try {
      const insightsData = await apiClient.database.getInsights(100)
      setInsights(insightsData as unknown as Insight[])
    } catch (error) {
      console.error('Failed to load insights:', error)
    }
  }

  const filterAndSortItems = () => {
    const filtered = knowledgeItems.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = selectedType === 'all' || item.type === selectedType
      return matchesSearch && matchesType
    })

    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'confidence':
          comparison = a.confidence - b.confidence
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredItems(filtered)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('确定要删除这条知识吗？')) {
      try {
        await apiClient.database.deleteKnowledgeItem(itemId)
        setKnowledgeItems((prev) => prev.filter((item) => item.id !== itemId))
        setInsights((prev) => prev.filter((insight) => insight.knowledgeItemId !== itemId))
        if (selectedItem?.id === itemId) {
          setSelectedItem(null)
        }
      } catch (error) {
        console.error('Failed to delete item:', error)
        await loadKnowledgeItems()
      }
    }
  }

  const handleExportItem = (item: KnowledgeItem) => {
    const data = {
      title: item.title,
      content: item.content,
      type: item.type,
      confidence: item.confidence,
      createdAt: item.createdAt,
      metadata: item.metadata
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-${item.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      meeting_schedule: 'bg-blue-500',
      task_todo: 'bg-green-500',
      topic_discussion: 'bg-purple-500',
      data_table: 'bg-amber-500',
      problem_solving: 'bg-red-500',
      insight_context: 'bg-indigo-500'
    }
    return colors[type] || 'bg-gray-400'
  }

  const getRelatedInsights = (itemId: string) => {
    return insights.filter((insight) => insight.knowledgeItemId === itemId)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  }

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索知识..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'h-10 px-3 flex items-center gap-2 rounded-lg border text-sm font-medium transition-all',
              showFilters
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            <Filter className="h-4 w-4" />
            筛选
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showFilters && 'rotate-180')}
            />
          </button>

          {/* Count */}
          <span className="text-sm text-gray-400">{filteredItems.length} 条</span>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">全部类型</option>
              <option value="meeting_schedule">会议</option>
              <option value="task_todo">任务</option>
              <option value="topic_discussion">讨论</option>
              <option value="problem_solving">问题</option>
              <option value="data_table">数据</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field as 'date' | 'confidence' | 'type')
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="date-desc">最新优先</option>
              <option value="date-asc">最早优先</option>
              <option value="confidence-desc">置信度高</option>
              <option value="confidence-asc">置信度低</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">加载中...</div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={Search}
            title="暂无知识条目"
            description="开始监控后，AI 将自动提取和保存知识"
          />
        ) : (
          <>
            {/* List */}
            <div className="space-y-2">
              {paginatedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    'flex gap-3 p-4 rounded-lg border cursor-pointer transition-all',
                    selectedItem?.id === item.id
                      ? 'border-blue-200 bg-blue-50/50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                  )}
                >
                  {/* Type indicator */}
                  <div className={cn('w-1 rounded-full flex-none', getTypeColor(item.type))} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 uppercase font-medium">
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">{item.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{item.content}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExportItem(item)
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                      title="导出"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteItem(item.id)
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  第 {page} / {totalPages} 页
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Panel */}
      <SidePanel
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="详情"
        width="lg"
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                类型
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', getTypeColor(selectedItem.type))} />
                <span className="text-sm font-medium text-gray-700">
                  {selectedItem.type.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                标题
              </label>
              <p className="mt-1.5 text-gray-900 font-medium">{selectedItem.title}</p>
            </div>

            {/* Content */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                内容
              </label>
              <div className="mt-1.5 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {selectedItem.content}
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  置信度
                </label>
                <p className="mt-1.5 text-sm font-medium text-gray-900">
                  {Math.round(selectedItem.confidence * 100)}%
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  创建时间
                </label>
                <p className="mt-1.5 text-sm text-gray-900">
                  {new Date(selectedItem.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>

            {/* Screenshot */}
            {(typeof selectedItem.metadata?.screenshotPath === 'string' ||
              Array.isArray(selectedItem.metadata?.screenshotPath)) && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  截图
                </label>
                <div className="mt-1.5 rounded-lg overflow-hidden border border-gray-200">
                  {Array.isArray(selectedItem.metadata.screenshotPath) ? (
                    <div className="space-y-2">
                      {selectedItem.metadata.screenshotPath.map((path, i) => (
                        <ImagePreview
                          key={i}
                          src={`media://${String(path)}`}
                          className="w-full h-auto"
                          alt={`screenshot-${i}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <ImagePreview
                      src={`media://${selectedItem.metadata.screenshotPath as string}`}
                      alt="screenshot"
                      className="w-full h-auto"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Related Insights */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                相关洞察 ({getRelatedInsights(selectedItem.id).length})
              </label>
              {getRelatedInsights(selectedItem.id).length === 0 ? (
                <p className="mt-1.5 text-sm text-gray-400 italic">暂无相关洞察</p>
              ) : (
                <div className="mt-1.5 space-y-2">
                  {getRelatedInsights(selectedItem.id).map((insight) => (
                    <div key={insight.id} className="p-3 bg-gray-900 rounded-lg text-white">
                      <div className="font-medium text-sm mb-1">{insight.title}</div>
                      <div className="text-xs text-gray-300 line-clamp-2">{insight.content}</div>
                      <div className="mt-2">
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-medium uppercase">
                          {insight.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportItem(selectedItem)}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteItem(selectedItem.id)}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </Button>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  )
}
