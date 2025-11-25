import { useState, useEffect } from 'react'
import { Search, Filter, Calendar, Tag, Eye, Trash2, Edit, Star, Download, Share2 } from 'lucide-react'

interface KnowledgeItem {
  id: string
  userId: string
  type: string
  title: string
  content: string
  metadata: Record<string, any>
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
  suggestedActions: any[]
  metadata: Record<string, any>
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

  useEffect(() => {
    loadKnowledgeItems()
    loadInsights()
  }, [])

  useEffect(() => {
    filterAndSortItems()
  }, [knowledgeItems, searchQuery, selectedType, sortBy, sortOrder])

  const loadKnowledgeItems = async () => {
    setIsLoading(true)
    try {
      const items = await window.api?.database?.getKnowledgeItems(100) || []
      setKnowledgeItems(items)
    } catch (error) {
      console.error('Failed to load knowledge items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadInsights = async () => {
    try {
      const insightsData = await window.api?.database?.getInsights(100) || []
      setInsights(insightsData)
    } catch (error) {
      console.error('Failed to load insights:', error)
    }
  }

  const filterAndSortItems = () => {
    let filtered = knowledgeItems.filter(item => {
      const matchesSearch = searchQuery === '' || 
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
      'meeting_schedule': 'bg-blue-500',
      'task_todo': 'bg-green-500',
      'topic_discussion': 'bg-purple-500',
      'data_table': 'bg-yellow-500',
      'problem_solving': 'bg-red-500',
      'insight_context': 'bg-indigo-500'
    }
    return colors[type] || 'bg-gray-500'
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400'
    if (confidence >= 0.5) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getRelatedInsights = (itemId: string) => {
    return insights.filter(insight => insight.knowledgeItemId === itemId)
  }

  return (
    <div className="h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm rounded ${viewMode === 'grid' ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                Grid
              </button>
            </div>
            <span className="text-sm text-gray-400">
              {filteredItems.length} items
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search knowledge items..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={selectedType}
            onChange={(e) => handleTypeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="confidence-desc">Highest Confidence</option>
            <option value="confidence-asc">Lowest Confidence</option>
            <option value="type-asc">Type A-Z</option>
            <option value="type-desc">Type Z-A</option>
          </select>
        </div>
      </div>

      <div className="flex h-[calc(100vh-140px)]">
        {/* Main Content */}
        <div className="flex-1 p-4 overflow-y-auto">
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
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-3'}>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer ${
                    selectedItem?.id === item.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className={`px-2 py-1 rounded-full text-xs text-white ${getTypeColor(item.type)}`}>
                        {item.type.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className={`text-xs font-medium ${getConfidenceColor(item.confidence)}`}>
                        {Math.round(item.confidence * 100)}%
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleExportItem(item)
                        }}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Export"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteItem(item.id)
                        }}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-white mb-1 truncate">{item.title}</h3>
                  <p className="text-gray-300 text-sm mb-2 line-clamp-3">{item.content}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center space-x-1">
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
          )}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div className="w-96 border-l border-gray-700 p-4 overflow-y-auto bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Item Details</h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                <div className={`inline-block px-2 py-1 rounded text-xs text-white ${getTypeColor(selectedItem.type)}`}>
                  {selectedItem.type.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                <p className="text-white">{selectedItem.title}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Content</label>
                <p className="text-gray-300 text-sm leading-relaxed">{selectedItem.content}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Confidence</label>
                <div className={`font-medium ${getConfidenceColor(selectedItem.confidence)}`}>
                  {Math.round(selectedItem.confidence * 100)}%
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Created</label>
                <p className="text-gray-300 text-sm">
                  {new Date(selectedItem.createdAt).toLocaleString()}
                </p>
              </div>

              {selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Metadata</label>
                  <div className="bg-gray-700 rounded p-3">
                    {Object.entries(selectedItem.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-1">
                        <span className="text-gray-400 text-sm">{key}:</span>
                        <span className="text-white text-sm">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Related Insights</label>
                {getRelatedInsights(selectedItem.id).length === 0 ? (
                  <p className="text-gray-500 text-sm">No related insights</p>
                ) : (
                  <div className="space-y-2">
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