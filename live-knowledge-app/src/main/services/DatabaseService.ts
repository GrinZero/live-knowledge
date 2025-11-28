import sqlite3 from 'sqlite3'
//
import { v4 as uuidv4 } from 'uuid'
import {
  User,
  MonitoringSession,
  KnowledgeItem,
  Tag,
  Insight,
  UserAction,
  IntegrationConfig,
  Screenshot,
  TriggerEvent
} from '../../renderer/src/types'

export class DatabaseService {
  private db: sqlite3.Database | null = null
  private dbPath: string

  constructor(dbPath: string = './live-knowledge.db') {
    this.dbPath = dbPath
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err)
          reject(err)
        } else {
          console.log('Connected to SQLite database')
          this.createTables()
            .then(() => resolve())
            .catch(reject)
        }
      })
    })
  }

  private async createTables(): Promise<void> {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        preferences TEXT DEFAULT '{}',
        plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createMonitoringSessionsTable = `
      CREATE TABLE IF NOT EXISTS monitoring_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        config TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'stopped')),
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        ended_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createKnowledgeItemsTable = `
      CREATE TABLE IF NOT EXISTS knowledge_items (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        confidence REAL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createTagsTable = `
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        item_id TEXT REFERENCES knowledge_items(id) ON DELETE CASCADE,
        tag_type TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createInsightsTable = `
      CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        item_id TEXT REFERENCES knowledge_items(id) ON DELETE CASCADE,
        insight_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        suggested_actions TEXT DEFAULT '[]',
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createUserActionsTable = `
      CREATE TABLE IF NOT EXISTS user_actions (
        id TEXT PRIMARY KEY,
        item_id TEXT REFERENCES knowledge_items(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
        executed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createIntegrationConfigsTable = `
      CREATE TABLE IF NOT EXISTS integration_configs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        credentials TEXT NOT NULL,
        settings TEXT DEFAULT '{}',
        enabled BOOLEAN DEFAULT true,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createScreenshotsTable = `
      CREATE TABLE IF NOT EXISTS screenshots (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
        image_path TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        captured_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const createTriggerEventsTable = `
      CREATE TABLE IF NOT EXISTS trigger_events (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence REAL DEFAULT 0.0,
        triggered_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `

    const tables = [
      createUsersTable,
      createMonitoringSessionsTable,
      createKnowledgeItemsTable,
      createTagsTable,
      createInsightsTable,
      createUserActionsTable,
      createIntegrationConfigsTable,
      createScreenshotsTable,
      createTriggerEventsTable
    ]

    for (const tableSql of tables) {
      await this.run(tableSql)
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_knowledge_items_user_id ON knowledge_items(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_knowledge_items_type ON knowledge_items(type)',
      'CREATE INDEX IF NOT EXISTS idx_knowledge_items_created_at ON knowledge_items(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_tags_item_id ON tags(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_tags_tag_type ON tags(tag_type)',
      'CREATE INDEX IF NOT EXISTS idx_insights_item_id ON insights(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_actions_item_id ON user_actions(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_monitoring_sessions_user_id ON monitoring_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_integration_configs_user_id ON integration_configs(user_id)'
    ]

    for (const indexSql of indexes) {
      await this.run(indexSql)
    }
  }

  private run(
    sql: string,
    params: Array<string | number | boolean | null | Buffer> = []
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.run(sql, params, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  private get(
    sql: string,
    params: Array<string | number | boolean | null | Buffer> = []
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve((row ?? null) as Record<string, unknown> | null)
        }
      })
    })
  }

  private all(
    sql: string,
    params: Array<string | number | boolean | null | Buffer> = []
  ): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows as Record<string, unknown>[])
        }
      })
    })
  }

  // User operations
  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = uuidv4()
    const now = new Date().toISOString()

    await this.run(
      'INSERT INTO users (id, email, name, preferences, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, user.email, user.name, JSON.stringify(user.preferences), user.plan || 'free', now, now]
    )

    const created = await this.getUserById(id)
    if (!created) throw new Error('Failed to create user')
    return created
  }

  async getUserById(id: string): Promise<User | null> {
    const row = await this.get('SELECT * FROM users WHERE id = ?', [id])
    if (!row) return null
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      email: String(r.email),
      name: String(r.name),
      preferences: JSON.parse(String(r.preferences ?? '{}')),
      plan: (r.plan as 'free' | 'premium') ?? 'free',
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at)
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const row = await this.get('SELECT * FROM users WHERE email = ?', [email])
    if (!row) return null
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      email: String(r.email),
      name: String(r.name),
      preferences: JSON.parse(String(r.preferences ?? '{}')),
      plan: (r.plan as 'free' | 'premium') ?? 'free',
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at)
    }
  }

  // Monitoring Session operations
  async createMonitoringSession(
    session: Omit<MonitoringSession, 'id' | 'createdAt'>
  ): Promise<MonitoringSession> {
    const id = uuidv4()

    await this.run(
      'INSERT INTO monitoring_sessions (id, user_id, config, status, started_at, ended_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        session.userId,
        JSON.stringify(session.config),
        session.status,
        session.startedAt,
        session.endedAt || null,
        new Date().toISOString()
      ]
    )

    const created = await this.getMonitoringSessionById(id)
    if (!created) throw new Error('Failed to create session')
    return created
  }

  async getMonitoringSessionById(id: string): Promise<MonitoringSession | null> {
    const row = await this.get('SELECT * FROM monitoring_sessions WHERE id = ?', [id])
    if (!row) return null
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      userId: String(r.user_id),
      config: JSON.parse(String(r.config ?? '{}')),
      status: (r.status as MonitoringSession['status']) ?? 'active',
      startedAt: String(r.started_at),
      endedAt: (r.ended_at as string | undefined) ?? undefined,
      createdAt: String(r.created_at)
    }
  }

  async getActiveMonitoringSessions(userId: string): Promise<MonitoringSession[]> {
    const rows = await this.all(
      'SELECT * FROM monitoring_sessions WHERE user_id = ? AND status = ? ORDER BY created_at DESC',
      [userId, 'active']
    )

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        userId: String(r.user_id),
        config: JSON.parse(String(r.config ?? '{}')),
        status: (r.status as MonitoringSession['status']) ?? 'active',
        startedAt: String(r.started_at),
        endedAt: (r.ended_at as string | undefined) ?? undefined,
        createdAt: String(r.created_at)
      }
    })
  }

  async updateMonitoringSessionStatus(
    id: string,
    status: 'active' | 'paused' | 'stopped'
  ): Promise<void> {
    const endedAt = status === 'stopped' ? new Date().toISOString() : null

    await this.run('UPDATE monitoring_sessions SET status = ?, ended_at = ? WHERE id = ?', [
      status,
      endedAt,
      id
    ])
  }

  // Knowledge Item operations
  async createKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'createdAt'>): Promise<KnowledgeItem> {
    const id = uuidv4()

    await this.run(
      'INSERT INTO knowledge_items (id, user_id, type, title, content, metadata, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        item.userId,
        item.type,
        item.title,
        item.content,
        JSON.stringify(item.metadata),
        item.confidence,
        new Date().toISOString()
      ]
    )

    const created = await this.getKnowledgeItemById(id)
    if (!created) throw new Error('Failed to create knowledge item')
    return created
  }

  async getKnowledgeItemById(id: string): Promise<KnowledgeItem | null> {
    const row = await this.get('SELECT * FROM knowledge_items WHERE id = ?', [id])
    if (!row) return null
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      userId: String(r.user_id),
      type: String(r.type),
      title: String(r.title),
      content: String(r.content),
      metadata: JSON.parse(String(r.metadata ?? '{}')),
      confidence: Number(r.confidence ?? 0),
      createdAt: String(r.created_at)
    }
  }

  async getKnowledgeItemsByUser(userId: string, limit: number = 50): Promise<KnowledgeItem[]> {
    const rows = await this.all(
      'SELECT * FROM knowledge_items WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    )

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        userId: String(r.user_id),
        type: String(r.type),
        title: String(r.title),
        content: String(r.content),
        metadata: JSON.parse(String(r.metadata ?? '{}')),
        confidence: Number(r.confidence ?? 0),
        createdAt: String(r.created_at)
      }
    })
  }

  async searchKnowledgeItems(
    userId: string,
    query: string,
    limit: number = 20
  ): Promise<KnowledgeItem[]> {
    const rows = await this.all(
      'SELECT * FROM knowledge_items WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY created_at DESC LIMIT ?',
      [userId, `%${query}%`, `%${query}%`, limit]
    )

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        userId: String(r.user_id),
        type: String(r.type),
        title: String(r.title),
        content: String(r.content),
        metadata: JSON.parse(String(r.metadata ?? '{}')),
        confidence: Number(r.confidence ?? 0),
        createdAt: String(r.created_at)
      }
    })
  }

  async deleteKnowledgeItem(id: string): Promise<void> {
    await this.run('DELETE FROM knowledge_items WHERE id = ?', [id])
  }

  // Tag operations
  async createTag(tag: Omit<Tag, 'id' | 'timestamp'> & { itemId: string }): Promise<Tag> {
    const id = uuidv4()
    await this.run(
      'INSERT INTO tags (id, item_id, tag_type, value, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, tag.itemId, tag.type, tag.title, tag.confidence, new Date().toISOString()]
    )
    return {
      id,
      type: tag.type as Tag['type'],
      title: tag.title,
      content: '',
      metadata: tag.metadata ?? {},
      timestamp: new Date().toISOString(),
      confidence: tag.confidence
    }
  }

  async getTagsByItem(itemId: string): Promise<Tag[]> {
    const rows = await this.all('SELECT * FROM tags WHERE item_id = ? ORDER BY created_at DESC', [
      itemId
    ])

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        type: String(r.tag_type) as Tag['type'],
        title: String(r.value),
        content: '',
        metadata: {},
        timestamp: String(r.created_at),
        confidence: Number(r.confidence ?? 0)
      }
    })
  }

  // Insight operations
  async createInsight(
    itemId: string,
    insight: Omit<Insight, 'id' | 'createdAt'>
  ): Promise<Insight> {
    const id = uuidv4()

    await this.run(
      'INSERT INTO insights (id, item_id, insight_type, title, content, suggested_actions, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        itemId,
        insight.type,
        insight.title,
        insight.content,
        JSON.stringify(insight.suggestedActions),
        insight.priority,
        new Date().toISOString()
      ]
    )

    return {
      id,
      type: insight.type,
      title: insight.title,
      content: insight.content,
      priority: insight.priority,
      suggestedActions: insight.suggestedActions,
      metadata: insight.metadata
    }
  }

  async getInsightsByItem(itemId: string): Promise<Insight[]> {
    const rows = await this.all(
      'SELECT * FROM insights WHERE item_id = ? ORDER BY created_at DESC',
      [itemId]
    )

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        type: String(r.insight_type) as Insight['type'],
        title: String(r.title),
        content: String(r.content),
        priority: String(r.priority) as Insight['priority'],
        suggestedActions: JSON.parse(
          String(r.suggested_actions ?? '[]')
        ) as Insight['suggestedActions'],
        metadata: {}
      }
    })
  }

  // User Action operations
  async createUserAction(action: Omit<UserAction, 'id' | 'createdAt'>): Promise<UserAction> {
    const id = uuidv4()

    await this.run(
      'INSERT INTO user_actions (id, item_id, action_type, payload, status, executed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        action.itemId,
        action.actionType,
        JSON.stringify(action.payload),
        action.status,
        action.executedAt || null,
        new Date().toISOString()
      ]
    )

    return {
      id,
      itemId: action.itemId,
      actionType: action.actionType,
      payload: action.payload,
      status: action.status,
      executedAt: action.executedAt,
      createdAt: new Date().toISOString()
    }
  }

  async updateUserActionStatus(
    id: string,
    status: 'pending' | 'completed' | 'failed',
    executedAt?: string
  ): Promise<void> {
    const execAt = executedAt || (status === 'completed' ? new Date().toISOString() : null)

    await this.run('UPDATE user_actions SET status = ?, executed_at = ? WHERE id = ?', [
      status,
      execAt,
      id
    ])
  }

  // Screenshot operations
  async createScreenshot(screenshot: Omit<Screenshot, 'id' | 'capturedAt'>): Promise<Screenshot> {
    const id = uuidv4()

    await this.run(
      'INSERT INTO screenshots (id, session_id, image_path, metadata, captured_at) VALUES (?, ?, ?, ?, ?)',
      [
        id,
        screenshot.sessionId,
        screenshot.imagePath,
        JSON.stringify(screenshot.metadata),
        new Date().toISOString()
      ]
    )

    return {
      id,
      sessionId: screenshot.sessionId,
      imagePath: screenshot.imagePath,
      metadata: screenshot.metadata,
      capturedAt: new Date().toISOString()
    }
  }

  async getScreenshotsBySession(sessionId: string, limit: number = 50): Promise<Screenshot[]> {
    const rows = await this.all(
      'SELECT * FROM screenshots WHERE session_id = ? ORDER BY captured_at DESC LIMIT ?',
      [sessionId, limit]
    )

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        sessionId: String(r.session_id),
        imagePath: String(r.image_path),
        metadata: JSON.parse(String(r.metadata ?? '{}')),
        capturedAt: String(r.captured_at)
      }
    })
  }

  // Trigger Event operations
  async createTriggerEvent(event: Omit<TriggerEvent, 'id' | 'triggeredAt'>): Promise<TriggerEvent> {
    const id = uuidv4()

    await this.run(
      'INSERT INTO trigger_events (id, session_id, event_type, content, confidence, triggered_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        event.sessionId,
        event.eventType,
        JSON.stringify(event.content),
        event.confidence,
        new Date().toISOString()
      ]
    )

    return {
      id,
      sessionId: event.sessionId,
      eventType: event.eventType,
      content: event.content,
      confidence: event.confidence,
      triggeredAt: new Date().toISOString()
    }
  }

  async getTriggerEventsBySession(sessionId: string, limit: number = 100): Promise<TriggerEvent[]> {
    const rows = await this.all(
      'SELECT * FROM trigger_events WHERE session_id = ? ORDER BY triggered_at DESC LIMIT ?',
      [sessionId, limit]
    )

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        sessionId: String(r.session_id),
        eventType: String(r.event_type),
        content: JSON.parse(String(r.content ?? '{}')) as Record<string, unknown>,
        confidence: Number(r.confidence ?? 0),
        triggeredAt: String(r.triggered_at)
      }
    })
  }

  // Integration Config operations
  async createIntegrationConfig(
    config: Omit<IntegrationConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IntegrationConfig> {
    const id = uuidv4()
    const now = new Date().toISOString()

    await this.run(
      'INSERT INTO integration_configs (id, user_id, provider, credentials, settings, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        config.userId,
        config.provider,
        JSON.stringify(config.credentials),
        JSON.stringify(config.settings),
        config.enabled,
        now,
        now
      ]
    )

    const created = await this.getIntegrationConfigById(id)
    if (!created) throw new Error('Failed to create integration config')
    return created
  }

  async getIntegrationConfigById(id: string): Promise<IntegrationConfig | null> {
    const row = await this.get('SELECT * FROM integration_configs WHERE id = ?', [id])
    if (!row) return null
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      userId: String(r.user_id),
      provider: String(r.provider),
      credentials: JSON.parse(String(r.credentials ?? '{}')),
      settings: JSON.parse(String(r.settings ?? '{}')),
      enabled: Boolean(r.enabled),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at)
    }
  }

  async getIntegrationConfigsByUser(userId: string): Promise<IntegrationConfig[]> {
    const rows = await this.all(
      'SELECT * FROM integration_configs WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    )

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        userId: String(r.user_id),
        provider: String(r.provider),
        credentials: JSON.parse(String(r.credentials ?? '{}')),
        settings: JSON.parse(String(r.settings ?? '{}')),
        enabled: Boolean(r.enabled),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at)
      }
    })
  }

  async updateIntegrationConfigStatus(id: string, enabled: boolean): Promise<void> {
    await this.run('UPDATE integration_configs SET enabled = ?, updated_at = ? WHERE id = ?', [
      enabled,
      new Date().toISOString(),
      id
    ])
  }

  // Statistics
  async getUserStatistics(userId: string): Promise<{
    totalKnowledgeItems: number
    totalInsights: number
    totalActions: number
    activeSessions: number
  }> {
    const [knowledgeItemsCount, insightsCount, actionsCount, activeSessionsCount] =
      await Promise.all([
        this.get('SELECT COUNT(*) as count FROM knowledge_items WHERE user_id = ?', [userId]),
        this.get(
          'SELECT COUNT(*) as count FROM insights i JOIN knowledge_items ki ON i.item_id = ki.id WHERE ki.user_id = ?',
          [userId]
        ),
        this.get(
          'SELECT COUNT(*) as count FROM user_actions ua JOIN knowledge_items ki ON ua.item_id = ki.id WHERE ki.user_id = ?',
          [userId]
        ),
        this.get(
          'SELECT COUNT(*) as count FROM monitoring_sessions WHERE user_id = ? AND status = ?',
          [userId, 'active']
        )
      ])

    const k = (knowledgeItemsCount as Record<string, unknown> | null)?.count
    const i = (insightsCount as Record<string, unknown> | null)?.count
    const a = (actionsCount as Record<string, unknown> | null)?.count
    const s = (activeSessionsCount as Record<string, unknown> | null)?.count

    return {
      totalKnowledgeItems: Number(k ?? 0),
      totalInsights: Number(i ?? 0),
      totalActions: Number(a ?? 0),
      activeSessions: Number(s ?? 0)
    }
  }

  // Additional methods for IPC handlers
  async getUser(userId: string): Promise<User | null> {
    const row = await this.get('SELECT * FROM users WHERE id = ?', [userId])
    if (!row) return null
    return {
      id: String(row.id),
      email: String(row.email),
      name: String(row.name),
      preferences: JSON.parse(String(row.preferences ?? '{}')),
      plan: (row.plan as 'free' | 'premium') ?? 'free',
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }
  }

  async getInsights(limit: number = 50): Promise<
    Array<{
      id: string
      knowledgeItemId: string
      title: string
      content: string
      type: string
      confidence: number
      tags: string[]
      createdAt: string
      itemTitle: string
      itemType: string
      screenshotPath?: string
    }>
  > {
    const rows = await this.all(
      `
      SELECT i.*, ki.title as item_title, ki.type as item_type, ki.metadata as item_metadata
      FROM insights i
      JOIN knowledge_items ki ON i.item_id = ki.id
      ORDER BY i.created_at DESC
      LIMIT ?
    `,
      [limit]
    )

    return rows.map((row) => {
      let screenshotPath: string | undefined
      try {
        const meta = row.item_metadata ? JSON.parse(String(row.item_metadata)) : {}
        screenshotPath = (meta as { screenshotPath?: string }).screenshotPath
      } catch {
        void 0
      }

      return {
        id: String(row.id),
        knowledgeItemId: String(row.item_id),
        title: String(row.title),
        content: String(row.content),
        type: String(row.insight_type),
        confidence: 0.8,
        tags: [],
        createdAt: String(row.created_at),
        itemTitle: String(row.item_title),
        itemType: String(row.item_type),
        screenshotPath
      }
    })
  }

  async getKnowledgeItems(limit: number = 100): Promise<KnowledgeItem[]> {
    const rows = await this.all(
      `
      SELECT * FROM knowledge_items
      ORDER BY created_at DESC
      LIMIT ?
    `,
      [limit]
    )

    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      content: String(row.content),
      type: String(row.type),
      confidence: Number(row.confidence),
      createdAt: String(row.created_at),
      userId: String(row.user_id),
      metadata: JSON.parse(String(row.metadata ?? '{}'))
    }))
  }

  async searchKnowledge(query: string): Promise<KnowledgeItem[]> {
    const searchTerm = `%${query}%`
    const rows = await this.all(
      `
      SELECT * FROM knowledge_items
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY created_at DESC
      LIMIT 50
    `,
      [searchTerm, searchTerm]
    )

    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      content: String(row.content),
      type: String(row.type),
      confidence: Number(row.confidence),
      createdAt: String(row.created_at),
      userId: String(row.user_id),
      metadata: JSON.parse(String(row.metadata ?? '{}'))
    }))
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve()
        return
      }

      this.db.close((err) => {
        if (err) {
          reject(err)
        } else {
          console.log('Database connection closed')
          resolve()
        }
      })
    })
  }
}
