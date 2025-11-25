
## 二、技术设计（Technical Design）

### 2.1 系统总体架构

```
┌──────────────────────────────┐
│        Screen Watcher         │ ← 捕获视觉/DOM变更
│ (MutationObserver / OCR / API)│
└───────────────┬───────────────┘
                │
                ▼
┌──────────────────────────────┐
│       Content Analyzer        │ ← 提取 tag、语义结构、上下文
│ (NLP / 模式匹配 / OCR / Regex)│
└───────────────┬───────────────┘
                │
                ▼
┌──────────────────────────────┐
│          AI Engine            │ ← 负责理解、生成、联动逻辑
│ (LLM, Context Store, Actions) │
└───────────────┬───────────────┘
                │
                ▼
┌──────────────────────────────┐
│       Presentation Layer      │ ← 呈现分析结果（悬浮窗/侧栏/新屏）
│ (Overlay / Electron / Webview)│
└──────────────────────────────┘
```

---

### 2.2 模块职责说明

| 模块                      | 职责                        | 关键挑战          | 关键技术                                                            |
| ----------------------- | ------------------------- | ------------- | --------------------------------------------------------------- |
| **Screen Watcher**      | 监听屏幕变化或 DOM 改动            | 噪声过滤、变化节流     | `MutationObserver`, `IntersectionObserver`, `OCR`, `Vision API` |
| **Content Analyzer**    | 从画面/文本提取结构化知识（如任务、会议、题目等） | 语义识别精度、跨应用上下文 | 正则规则、NLP、Embedding 相似度                                          |
| **AI Engine**           | 对知识进行理解、生成响应、决策触发         | 上下文保持、一致性     | `LangGraph`, `LangChain`, `RAG`, `Action Agents`                |
| **Presentation Layer**  | 将结果以自然方式反馈                | 不打扰用户的 UX     | Web Overlay, Electron Layer, OS-level Window                    |

---

### 2.3 屏幕变化触发策略（Debounce/Throttling 机制）

**目标**：防止频繁触发，确保“恰到好处”的响应。

#### 策略一：基于变化速率的动态节流

* 若用户正在快速输入（如聊天），则延后触发。
* 若页面长时间稳定，则立即触发分析。

```ts
if (lastChange < 1s) → ignore  
if (stableTime > 2s) → trigger  
if (changeDensity > 10/s) → debounce longer
```

#### 策略二：基于内容相似度去重

* 用哈希或 embedding 判断前后页面差异：

  ```js
  if (cosineSimilarity(prevEmbedding, currentEmbedding) < 0.85)
      triggerAI()
  else
      skip()
  ```

#### 策略三：基于场景的分级触发

| 场景         | 优先级 | 触发方式             |
| ---------- | --- | ---------------- |
| 聊天输入       | 低   | 延迟 2~5 秒、文本稳定后触发 |
| 会议日程/日历    | 中   | 每次新会议框检测时触发一次    |
| 屏幕OCR/网页段落 | 高   | 检测到关键字或模板匹配时立即触发 |

---

### 2.4 AI Engine 的上下文存储策略

| 存储层                       | 内容                  | 作用        |
| ------------------------- | ------------------- | --------- |
| **短期上下文（Local Memory）**   | 当前页面的语义片段、最近提取的 tag | 保持连续分析    |
| **中期记忆（Session Memory）**  | 当天的交互、任务、会议         | 建立任务上下文   |
| **长期知识库（Knowledge Base）** | 用户项目、文档、领域知识        | 提供长期理解与推理 |

---

### 2.5 AI Engine 的动作类型（Action Types）

| 类型       | 示例                          | 响应方式      |
| -------- | --------------------------- | --------- |
| **任务生成** | “明天开会讨论UI调整” → 生成任务卡        | 插入到任务管理器  |
| **会议纪要** | 检测到会议界面 + 对话 → 自动提取摘要       | 弹窗显示纪要    |
| **学习助手** | 用户在看教程或题目 → 实时讲解            | 侧边浮窗显示    |
| **数据洞察** | 表格或指标面板 → 自动分析趋势            | 生成图表/文字分析 |
| **自动标注** | 屏幕出现 PDF / 图片 / 图表 → 标注关键要素 | 覆盖层标注显示   |

---

### 2.6 用户交互层设计（UX）

* **低侵入式原则**：不遮挡主要操作界面
* **即时召唤**：用户可用快捷键或鼠标悬浮调出结果
* **多模态反馈**：文字 + 图标 + 动画提示
* **可控自动化**：允许用户设定触发策略（实时/半自动/手动）

---

### 2.7 插件系统设计（Plugin Architecture）

**目标**：让输入端与消费端都具备可插拔能力；其中 `Screen Watcher` 是我们默认提供的最基础输入插件。AI Engine 除了主动推送，还向所有插件开放上下文查询接口。

#### 插件类型

| 类别 | 说明 | 示例 |
| --- | --- | --- |
| **输入插件（Input Plugins）** | 负责感知与采集 | 默认 Screen Watcher、浏览器 DOM 监听、应用适配器（VSCode/Zoom）、Webhook 数据源 |
| **消费插件（Presentation Plugins）** | 负责知识呈现与外部同步 | Overlay/Sidebar 渲染器、Notion/Slack/Calendar 同步器、自定义可视化 |

#### 插件生命周期

1. 安装 → 提交 `manifest`（权限/订阅主题）
2. 注册 → 插件中心分配 `pluginId` 与令牌
3. 启用 → 权限校验与沙箱环境创建
4. 订阅事件 → 通过事件总线接收主题消息
5. 执行 → 读取上下文或推送洞察、渲染 UI
6. 卸载 → 清理资源与取消订阅

#### 统一事件总线（Topics）

- `screen.change`：输入端上报的屏幕/DOM 变化
- `content.extracted`：解析器输出的结构化内容（tags）
- `ai.insight`：AI Engine 生成的洞察/行动建议
- `present.render`：呈现层渲染请求（卡片/侧栏/气泡）
- `action.execute`：用户确认后的具体执行动作

#### AI Engine 插件接口

- 主动推送：`POST /api/ai/push`
  - 请求：`{ insights: Insight[], actions: Action[], source: pluginId }`
  - 作用：由插件触发洞察进入系统调度与展示层
- 上下文查询：`GET /api/ai/context?window=<n>&keys=<k1,k2>`
  - 响应：`{ recentContexts: string[], knowledgeItems: KnowledgeItem[] }`
  - 作用：所有插件在权限允许范围内查询当前上下文窗口

#### 插件 Manifest 示例

```json
{
  "name": "live-knowledge-overlay",
  "id": "lk.overlay.basic",
  "version": "0.1.0",
  "permissions": [
    "ai.context.read",
    "ai.push.write",
    "present.overlay"
  ],
  "subscriptions": ["ai.insight", "present.render"],
  "config": { "position": "right", "width": 320 }
}
```

#### 权限与安全

- 最小权限原则：按需声明 `screen.read`、`dom.read`、`ai.context.read`、`ai.push.write`、`present.overlay` 等
- 沙箱隔离：插件运行在受限环境，禁止直接访问敏感系统资源
- 速率限制：对 `ai.push.write`、外部网络请求施加配额与限流
- 审计日志：记录插件注册、订阅、推送与渲染调用

#### 扩展点与钩子（Hooks）

- `onScreenChange(change)`：输入插件介入变化检测前/后处理
- `onContentExtracted(tags)`：在进入 AI 前进行增强或过滤
- `onInsightGenerated(insights)`：对洞察进行重排或去重
- `render(presentContext)`：消费插件实现具体呈现逻辑
