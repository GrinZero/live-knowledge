import { useState, useEffect } from 'react'
import { Search, Calendar, Tag, Trash2, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImagePreview } from '@/components/ImagePreview'
import { apiClient } from '../lib/api-client'

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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'type'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(24)

  useEffect(() => {
    // Initial load
    loadKnowledgeItems()
    loadInsights()

    // Listen for real-time updates
    const handleInsightGenerated = (_: unknown, newInsight: Insight) => {
      setInsights((prev) => {
        // Prevent duplicates
        if (prev.some((i) => i.id === newInsight.id)) return prev
        return [newInsight, ...prev]
      })
      // Also reload knowledge items to update counts/relationships
      loadKnowledgeItems()
    }

    // Subscribe to events
    // @ts-ignore: Accessing internal electron API
    if (window.electron && window.electron.ipcRenderer) {
      // @ts-ignore: Accessing internal electron API
      window.electron.ipcRenderer.on('monitoring:insight', handleInsightGenerated)
    }

    return () => {
      // @ts-ignore: Accessing internal electron API
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore: Accessing internal electron API
        window.electron.ipcRenderer.removeAllListeners('monitoring:insight')
      }
    }
  }, [])

  useEffect(() => {
    filterAndSortItems()
    setPage(1)
  }, [knowledgeItems, searchQuery, selectedType, sortBy, sortOrder])

  const loadKnowledgeItems = async () => {
    setIsLoading(true)
    try {
      const items = await apiClient.database.getKnowledgeItems(100)
      setKnowledgeItems(items)
      // When knowledge items change (e.g. deletion), we should also update filtered items
      // But filteredItems is updated via useEffect dep on knowledgeItems, so this is fine.
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

    // Sort items
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

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleTypeFilter = (type: string) => {
    setSelectedType(type)
  }

  const handleItemClick = (item: KnowledgeItem) => {
    setSelectedItem(item)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this knowledge item?')) {
      try {
        await apiClient.database.deleteKnowledgeItem(itemId)
        // Manually update local state to reflect deletion immediately
        setKnowledgeItems((prev) => prev.filter((item) => item.id !== itemId))
        // Also remove related insights from local state
        setInsights((prev) => prev.filter((insight) => insight.knowledgeItemId !== itemId))
        if (selectedItem?.id === itemId) {
          setSelectedItem(null)
        }
      } catch (error) {
        console.error('Failed to delete item:', error)
        // Fallback to reload if local update fails or is out of sync
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
      meeting_schedule: 'bg-blue-100 text-blue-700 border border-blue-200',
      task_todo: 'bg-green-100 text-green-700 border border-green-200',
      topic_discussion: 'bg-purple-100 text-purple-700 border border-purple-200',
      data_table: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
      problem_solving: 'bg-red-100 text-red-700 border border-red-200',
      insight_context: 'bg-indigo-100 text-indigo-700 border border-indigo-200'
    }
    return colors[type] || 'bg-gray-100 text-gray-700 border border-gray-200'
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRelatedInsights = (itemId: string) => {
    return insights.filter((insight) => insight.knowledgeItemId === itemId)
  }

  return (
    <div>
      <div className="border-b border-gray-200 bg-white px-4 py-3 rounded-t-lg">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold">知识库</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
            </div>
            <span className="text-sm text-gray-400">{filteredItems.length} items</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => handleTypeFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer hover:bg-gray-100"
          >
            <option value="all">All Types</option>
            <option value="meeting">Meeting</option>
            <option value="task">Task</option>
            <option value="schedule">Schedule</option>
            <option value="problem">Problem</option>
            <option value="data">Data</option>
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-')
              setSortBy(field as 'date' | 'confidence' | 'type')
              setSortOrder(order as 'asc' | 'desc')
            }}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="confidence-desc">Highest Confidence</option>
            <option value="confidence-asc">Lowest Confidence</option>
            <option value="type-asc">Type A-Z</option>
            <option value="type-desc">Type Z-A</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value))
              setPage(1)
            }}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={10}>10 / page</option>
            <option value={24}>24 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </div>

      <div className="flex min-h-0 relative h-full">
        {/* Main Content */}
        <div className="flex-1 min-h-0 p-4 overflow-y-auto overflow-x-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading knowledge items...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="text-lg mb-2">No knowledge items found</div>
              <div className="text-sm">Start monitoring to capture knowledge items</div>
            </div>
          ) : (
            <>
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
                    : 'flex flex-col gap-3'
                }
              >
                {filteredItems.slice((page - 1) * pageSize, page * pageSize).map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer ${
                      selectedItem?.id === item.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`px-2 py-1 rounded-full text-xs ${getTypeColor(item.type)}`}
                        >
                          {item.type.replace('_', ' ').toUpperCase()}
                        </div>
                        <div
                          className={`text-xs font-medium ${getConfidenceColor(item.confidence)}`}
                        >
                          {Math.round(item.confidence * 100)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-gray-900"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExportItem(item)
                          }}
                          title="Export"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteItem(item.id)
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-1 truncate">{item.title}</h3>
                    <p className="text-gray-700 text-sm mb-2 line-clamp-3">{item.content}</p>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Tag className="h-3 w-3" />
                        <span>{getRelatedInsights(item.id).length} insights</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Showing {(page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, filteredItems.length)} of {filteredItems.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} / {Math.max(1, Math.ceil(filteredItems.length / pageSize))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(filteredItems.length / pageSize)}
                    onClick={() =>
                      setPage((p) => Math.min(Math.ceil(filteredItems.length / pageSize), p + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail Panel Overlay */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedItem(null)}
            />

            {/* Panel */}
            <div className="relative w-[32rem] h-full bg-white shadow-2xl overflow-y-auto border-l border-gray-200 animate-in slide-in-from-right duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Item Details</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedItem(null)}
                    className="rounded-full"
                  >
                    <span className="sr-only">Close</span>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Type
                    </label>
                    <div>
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(selectedItem.type)}`}
                      >
                        {selectedItem.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Title
                    </label>
                    <p className="text-gray-900 font-medium text-lg leading-snug">
                      {selectedItem.title}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Content
                    </label>
                    <div className="bg-gray-50 rounded-lg p-4 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap border border-gray-100">
                      {selectedItem.content}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Confidence
                      </label>
                      <div
                        className={`font-medium text-lg ${getConfidenceColor(selectedItem.confidence)}`}
                      >
                        {Math.round(selectedItem.confidence * 100)}%
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Created
                      </label>
                      <div className="text-gray-900 font-medium">
                        {new Date(selectedItem.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {new Date(selectedItem.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {(typeof selectedItem.metadata?.screenshotPath === 'string' ||
                    Array.isArray(selectedItem.metadata?.screenshotPath)) && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Screenshot
                      </label>
                      <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        {Array.isArray(selectedItem.metadata.screenshotPath) ? (
                          <div className="grid grid-cols-1 gap-2">
                            {selectedItem.metadata.screenshotPath.map((path, i) => (
                              <ImagePreview
                                key={i}
                                src={`media://${String(path)}`}
                                className="w-full h-auto object-cover"
                                alt={`screenshot-${i}`}
                              />
                            ))}
                          </div>
                        ) : (
                          <ImagePreview
                            src={`media://${selectedItem.metadata.screenshotPath as string}`}
                            alt="screenshot"
                            className="w-full h-auto object-cover"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Metadata
                      </label>
                      <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                        {Object.entries(selectedItem.metadata).map(([key, value], index) => (
                          <div
                            key={key}
                            className={`flex flex-col gap-1 px-4 py-2 ${index !== 0 ? 'border-t border-gray-100' : ''}`}
                          >
                            <span className="text-gray-500 text-xs font-medium">{key}</span>
                            <div className="text-gray-900 text-xs break-all whitespace-pre-wrap bg-white p-2 rounded border border-gray-100 max-h-60 overflow-y-auto">
                              {Array.isArray(value)
                                ? value
                                    .map((v) =>
                                      typeof v === 'object' ? JSON.stringify(v) : String(v)
                                    )
                                    .join(', ')
                                : typeof value === 'object' && value !== null
                                  ? JSON.stringify(value, null, 2)
                                  : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Related Insights
                    </label>
                    {getRelatedInsights(selectedItem.id).length === 0 ? (
                      <div className="text-gray-400 text-sm italic">No related insights found</div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {getRelatedInsights(selectedItem.id).map((insight) => (
                          <div
                            key={insight.id}
                            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3 shadow-sm text-white"
                          >
                            <div className="font-semibold text-sm mb-1">{insight.title}</div>
                            <div className="text-xs text-gray-300 leading-relaxed opacity-90">
                              {insight.content}
                            </div>
                            {((typeof insight.metadata?.screenshotPath === 'string' &&
                              insight.metadata.screenshotPath) ||
                              (Array.isArray(insight.metadata?.screenshotPath) &&
                                insight.metadata.screenshotPath.length > 0)) && (
                              <div className="mt-2 rounded overflow-hidden border border-white/10">
                                {Array.isArray(insight.metadata?.screenshotPath) ? (
                                  <div className="grid grid-cols-1 gap-2">
                                    {(insight.metadata.screenshotPath as string[]).map(
                                      (path, i) => (
                                        <ImagePreview
                                          key={i}
                                          src={`media://${path}`}
                                          alt={`insight screenshot ${i}`}
                                          className="w-full h-auto object-cover"
                                        />
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <ImagePreview
                                    src={`media://${insight.metadata?.screenshotPath as string}`}
                                    alt="insight screenshot"
                                    className="w-full h-auto object-cover"
                                  />
                                )}
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-medium uppercase tracking-wider">
                                {insight.type}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
