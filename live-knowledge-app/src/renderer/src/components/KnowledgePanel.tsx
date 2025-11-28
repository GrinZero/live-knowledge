/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { useState, useEffect } from 'react'
import { Search, Calendar, Tag, Trash2, Download } from 'lucide-react'

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

interface Insight {
  id: string
  knowledgeItemId: string
  type: 'task' | 'schedule' | 'note' | 'analysis' | 'reminder'
  title: string
  content: string
  priority: 'low' | 'medium' | 'high'
  suggestedActions: Array<Record<string, unknown>>
  metadata: Record<string, unknown>
  createdAt: string
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
    loadKnowledgeItems()
    loadInsights()
  }, [])

  useEffect(() => {
    filterAndSortItems()
    setPage(1)
  }, [knowledgeItems, searchQuery, selectedType, sortBy, sortOrder])

  const loadKnowledgeItems = async () => {
    setIsLoading(true)
    try {
      const items = await window.api.database.getKnowledgeItems(100)
      setKnowledgeItems(items)
    } catch (error) {
      console.error('Failed to load knowledge items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadInsights = async () => {
    try {
      const insightsData = await window.api.database.getInsights(100)
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
        // TODO: Implement delete functionality in database service
        console.log('Deleting item:', itemId)
        await loadKnowledgeItems()
      } catch (error) {
        console.error('Failed to delete item:', error)
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
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                Grid
              </button>
            </div>
            <span className="text-sm text-gray-400">{filteredItems.length} items</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search knowledge items..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => handleTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="meeting_schedule">Meeting Schedule</option>
            <option value="task_todo">Task Todo</option>
            <option value="topic_discussion">Topic Discussion</option>
            <option value="data_table">Data Table</option>
            <option value="problem_solving">Problem Solving</option>
            <option value="insight_context">Insight Context</option>
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

      <div className="flex min-h-0">
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExportItem(item)
                          }}
                          className="text-gray-500 hover:text-gray-900 transition-colors"
                          title="Export"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteItem(item.id)
                          }}
                          className="text-gray-500 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} / {Math.max(1, Math.ceil(filteredItems.length / pageSize))}
                  </span>
                  <button
                    disabled={page >= Math.ceil(filteredItems.length / pageSize)}
                    onClick={() =>
                      setPage((p) => Math.min(Math.ceil(filteredItems.length / pageSize), p + 1))
                    }
                    className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div className="w-[28rem] min-h-0 border-l border-gray-200 p-4 overflow-y-auto bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Item Details</h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                <div
                  className={`inline-block px-2 py-1 rounded text-xs ${getTypeColor(selectedItem.type)}`}
                >
                  {selectedItem.type.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                <p className="text-gray-900">{selectedItem.title}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Content</label>
                <p className="text-gray-700 text-sm leading-relaxed">{selectedItem.content}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Confidence</label>
                <div className={`font-medium ${getConfidenceColor(selectedItem.confidence)}`}>
                  {Math.round(selectedItem.confidence * 100)}%
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Created</label>
                <p className="text-gray-600 text-sm">
                  {new Date(selectedItem.createdAt).toLocaleString()}
                </p>
              </div>

              {typeof selectedItem.metadata?.screenshotPath === 'string' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Screenshot</label>
                  <img
                    src={`file://${selectedItem.metadata.screenshotPath as string}`}
                    alt="screenshot"
                    className="max-h-64 w-auto rounded border border-gray-200"
                  />
                </div>
              )}

              {selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Metadata</label>
                  <div className="bg-gray-100 rounded p-3 border border-gray-200">
                    {Object.entries(selectedItem.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-1">
                        <span className="text-gray-500 text-sm">{key}:</span>
                        <span className="text-gray-800 text-sm">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Related Insights
                </label>
                {getRelatedInsights(selectedItem.id).length === 0 ? (
                  <p className="text-gray-500 text-sm">No related insights</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {getRelatedInsights(selectedItem.id).map((insight) => (
                      <div key={insight.id} className="bg-gray-700 rounded p-2">
                        <div className="font-medium text-sm text-white">{insight.title}</div>
                        <div className="text-xs text-gray-300">{insight.content}</div>
                        <div className="text-xs text-gray-400 mt-1">{insight.type}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
