/**
 * ContextStateGraph
 * Graph-based context storage for event history
 *
 * Stores context history using a directed graph structure.
 * Nodes represent events or page states, edges represent transitions.
 * In-memory only - fresh graph on restart (no persistence).
 */

import { v4 as uuidv4 } from 'uuid'
import type { EventNodeData, Tag } from './types'

interface GraphNode {
  id: string
  data: EventNodeData
  timestamp: number
  // Simple adjacency list for edges
  outgoingEdges: Set<string>
  incomingEdges: Set<string>
}

export class ContextStateGraph {
  private nodes: Map<string, GraphNode> = new Map()
  private nodeOrder: string[] = [] // Track insertion order for LRU
  private maxNodes: number
  private evictionBatchSize: number

  constructor(maxNodes: number = 1000, evictionBatchSize: number = 100) {
    this.maxNodes = maxNodes
    this.evictionBatchSize = evictionBatchSize
  }

  /**
   * Add a new node to the graph
   */
  addNode(
    pHash: string,
    embedding: number[] | null,
    url: string,
    summary: string,
    text: string,
    tags: Tag[]
  ): string {
    // Evict old nodes if necessary
    this.evictIfNeeded()

    const nodeId = uuidv4()
    const timestamp = Date.now()

    const nodeData: EventNodeData = {
      id: nodeId,
      timestamp,
      pHash,
      embedding,
      url,
      summary,
      text,
      tags
    }

    const newNode: GraphNode = {
      id: nodeId,
      data: nodeData,
      timestamp,
      outgoingEdges: new Set(),
      incomingEdges: new Set()
    }

    // Connect to previous node if exists
    if (this.nodeOrder.length > 0) {
      const lastNodeId = this.nodeOrder[this.nodeOrder.length - 1]
      const lastNode = this.nodes.get(lastNodeId)
      if (lastNode) {
        lastNode.outgoingEdges.add(nodeId)
        newNode.incomingEdges.add(lastNodeId)
      }
    }

    this.nodes.set(nodeId, newNode)
    this.nodeOrder.push(nodeId)

    return nodeId
  }

  /**
   * Connect two existing nodes with an edge
   */
  addEdge(fromId: string, toId: string): void {
    const fromNode = this.nodes.get(fromId)
    const toNode = this.nodes.get(toId)

    if (fromNode && toNode) {
      fromNode.outgoingEdges.add(toId)
      toNode.incomingEdges.add(fromId)
    }
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): EventNodeData | null {
    return this.nodes.get(nodeId)?.data ?? null
  }

  /**
   * Get all nodes as an array
   */
  getAllNodes(): EventNodeData[] {
    return this.nodeOrder.map((id) => this.nodes.get(id)!.data)
  }

  /**
   * Get recent N nodes
   */
  getRecentNodes(count: number): EventNodeData[] {
    const start = Math.max(0, this.nodeOrder.length - count)
    return this.nodeOrder.slice(start).map((id) => this.nodes.get(id)!.data)
  }

  /**
   * Find similar nodes based on pHash similarity
   */
  findSimilarByPHash(pHash: string, threshold: number = 0.85): EventNodeData[] {
    const results: EventNodeData[] = []

    for (const node of this.nodes.values()) {
      const similarity = this.pHashSimilarity(pHash, node.data.pHash)
      if (similarity >= threshold) {
        results.push(node.data)
      }
    }

    return results
  }

  /**
   * Find similar nodes based on embedding similarity
   */
  findSimilarByEmbedding(
    embedding: number[],
    threshold: number = 0.8
  ): EventNodeData[] {
    const results: EventNodeData[] = []

    for (const node of this.nodes.values()) {
      if (!node.data.embedding) continue
      const similarity = this.cosineSimilarity(embedding, node.data.embedding)
      if (similarity >= threshold) {
        results.push(node.data)
      }
    }

    return results
  }

  /**
   * Find the most recent node similar to the given pHash
   */
  findMostRecentSimilarPHash(pHash: string): EventNodeData | null {
    let mostRecent: EventNodeData | null = null
    let highestSimilarity = 0

    for (let i = this.nodeOrder.length - 1; i >= 0; i--) {
      const node = this.nodes.get(this.nodeOrder[i])!
      const similarity = this.pHashSimilarity(pHash, node.data.pHash)
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity
        mostRecent = node.data
      }
    }

    return mostRecent
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    return this.nodes.size
  }

  /**
   * Clear all nodes (for testing or reset)
   */
  clear(): void {
    this.nodes.clear()
    this.nodeOrder = []
  }

  /**
   * Evict oldest nodes if count exceeds maxNodes
   */
  private evictIfNeeded(): void {
    while (this.nodes.size >= this.maxNodes) {
      this.evictOldestBatch()
    }
  }

  /**
   * Evict the oldest batch of nodes (LRU policy)
   */
  private evictOldestBatch(): void {
    const toEvict = this.nodeOrder.slice(0, this.evictionBatchSize)

    for (const nodeId of toEvict) {
      const node = this.nodes.get(nodeId)
      if (!node) continue

      // Remove edges referencing this node
      for (const incomingId of node.incomingEdges) {
        const incomingNode = this.nodes.get(incomingId)
        if (incomingNode) {
          incomingNode.outgoingEdges.delete(nodeId)
        }
      }

      for (const outgoingId of node.outgoingEdges) {
        const outgoingNode = this.nodes.get(outgoingId)
        if (outgoingNode) {
          outgoingNode.incomingEdges.delete(nodeId)
        }
      }

      this.nodes.delete(nodeId)
    }

    // Remove evicted nodes from order array
    this.nodeOrder = this.nodeOrder.slice(toEvict.length)
  }

  /**
   * Calculate pHash similarity using Hamming distance
   * Returns similarity score between 0 and 1
   */
  private pHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      // Different lengths = very different
      return 0
    }

    const distance = this.hammingDistance(hash1, hash2)
    // Hamming distance 0 = similarity 1.0
    // Hamming distance 64 (max for 8x8 hash) = similarity 0.0
    return 1 - distance / 64
  }

  /**
   * Calculate Hamming distance between two binary strings
   */
  private hammingDistance(str1: string, str2: string): number {
    let distance = 0
    for (let i = 0; i < str1.length; i++) {
      if (str1[i] !== str2[i]) {
        distance++
      }
    }
    return distance
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    if (denominator === 0) {
      return 0
    }

    return dotProduct / denominator
  }
}
