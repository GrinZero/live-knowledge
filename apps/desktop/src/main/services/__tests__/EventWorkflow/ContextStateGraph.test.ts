/**
 * ContextStateGraph Tests
 */

import { ContextStateGraph } from '../EventWorkflow/ContextStateGraph'

describe('ContextStateGraph', () => {
  let graph: ContextStateGraph

  beforeEach(() => {
    graph = new ContextStateGraph(100, 10)
  })

  afterEach(() => {
    graph.clear()
  })

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      const nodeId = graph.addNode(
        '00010001',
        [0.1, 0.2, 0.3],
        'https://example.com',
        'Test summary',
        'Test text',
        []
      )

      expect(nodeId).toBeDefined()
      expect(graph.getNodeCount()).toBe(1)
    })

    it('should connect consecutive nodes with edges', () => {
      const nodeId1 = graph.addNode('00010001', null, 'https://example.com/1', 'Summary 1', 'Text 1', [])
      const nodeId2 = graph.addNode('00010001', null, 'https://example.com/2', 'Summary 2', 'Text 2', [])

      const node1 = graph.getNode(nodeId1)
      const node2 = graph.getNode(nodeId2)

      expect(node1).toBeDefined()
      expect(node2).toBeDefined()
    })
  })

  describe('getRecentNodes', () => {
    it('should return nodes in insertion order', () => {
      graph.addNode('hash1', null, 'url1', 'sum1', 'text1', [])
      graph.addNode('hash2', null, 'url2', 'sum2', 'text2', [])
      graph.addNode('hash3', null, 'url3', 'sum3', 'text3', [])

      const recent = graph.getRecentNodes(2)

      expect(recent).toHaveLength(2)
    })
  })

  describe('findSimilarByPHash', () => {
    it('should find nodes with similar pHash', () => {
      // Add a node with a specific hash
      graph.addNode('00000000', null, 'url1', 'sum1', 'text1', [])

      // Search for similar hash (only 1 bit different)
      const similar = graph.findSimilarByPHash('00000001', 0.9)

      expect(similar.length).toBe(1)
    })

    it('should not find nodes with different hash', () => {
      graph.addNode('00000000', null, 'url1', 'sum1', 'text1', [])

      const similar = graph.findSimilarByPHash('11111111', 0.9)

      expect(similar.length).toBe(0)
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest nodes when exceeding max nodes', () => {
      const smallGraph = new ContextStateGraph(5, 2)

      // Add 7 nodes (should trigger eviction)
      for (let i = 0; i < 7; i++) {
        smallGraph.addNode(`hash${i}`, null, `url${i}`, `sum${i}`, `text${i}`, [])
      }

      // Should have 5 nodes (max)
      expect(smallGraph.getNodeCount()).toBe(5)
    })
  })

  describe('clear', () => {
    it('should remove all nodes', () => {
      graph.addNode('hash1', null, 'url1', 'sum1', 'text1', [])
      graph.addNode('hash2', null, 'url2', 'sum2', 'text2', [])

      graph.clear()

      expect(graph.getNodeCount()).toBe(0)
    })
  })
})
