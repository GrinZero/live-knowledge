## 三、数据流与触发流程（Data Flow & Trigger Lifecycle）

这一部分的目标是定义 **从“屏幕变化”到“AI 输出结果”** 的完整生命周期，确保系统既响应灵敏，又稳定可控。

---

### 3.1 全局数据流（Overview）

```
┌──────────────┐
│ Screen Event │   ← 用户操作、界面变化、DOM改动
└───────┬──────┘
        │
        ▼
┌────────────────────────┐
│   Change Analyzer       │ ← 差分计算、噪声过滤、稳定检测
└────────┬────────────────┘
         │
         ▼
┌────────────────────────┐
│   Content Analyzer      │ ← 提取 tag、关键词、结构化数据
└────────┬────────────────┘
         │
         ▼
┌────────────────────────┐
│ AI Engine (Analysis)    │ ← 语义理解、推理、任务生成
└────────┬────────────────┘
         │
         ▼
┌────────────────────────┐
│ Action Dispatcher       │ ← 判断触发何种展示或系统操作
└────────┬────────────────┘
         │
         ▼
┌────────────────────────┐
│ Presentation Layer      │ ← 展示结果、弹窗、悬浮、侧栏
└────────────────────────┘
```

---

### 3.2 事件流阶段定义

| 阶段        | 名称                       | 描述                               | 核心逻辑                               |
| ----------- | -------------------------- | ---------------------------------- | -------------------------------------- |
| **Stage 1** | 变化检测 (Detection)       | 捕获界面或内容的变化               | DOM diff、OCR、截图 hash、window focus |
| **Stage 2** | 稳定判断 (Stabilization)   | 判断是否为稳定状态（避免频繁触发） | 时间阈值 + 相似度计算                  |
| **Stage 3** | 内容提取 (Extraction)      | 从文本/视觉中抽取 tag              | NLP 模型、规则模板、LLM 解析           |
| **Stage 4** | 语义分析 (Analysis)        | AI 理解场景意图、生成响应          | context embedding + reasoning          |
| **Stage 5** | 动作执行 (Action Dispatch) | 根据意图选择对应动作               | 任务生成、摘要生成、洞察展示           |
| **Stage 6** | 展示反馈 (Presentation)    | 将结果可视化呈现给用户             | 弹窗、侧边栏、语音、动画等             |

---

### 3.3 状态流转图（State Machine）

```
 ┌───────────────┐
 │ Idle          │
 └───────┬───────┘
         │ Screen changed
         ▼
 ┌───────────────┐
 │ Observing     │ ← 记录变化片段
 └───────┬───────┘
         │ stable for > 2s ?
         ▼
 ┌───────────────┐
 │ Extracting    │ ← 提取 tags & content
 └───────┬───────┘
         │ tags found ?
         ▼
 ┌───────────────┐
 │ Analyzing     │ ← 调用 AI Engine
 └───────┬───────┘
         │ has result ?
         ▼
 ┌───────────────┐
 │ Dispatching   │ ← 选择动作类型
 └───────┬───────┘
         │ executed
         ▼
 ┌───────────────┐
 │ Presenting    │ ← 用户看到结果
 └───────┬───────┘
         │ user confirms / ignores
         ▼
 ┌───────────────┐
 │ Idle          │ ← 等待下一轮变化
 └───────────────┘
```

---

### 3.4 示例触发例程

#### 示例 1：聊天生成任务卡

1. **ScreenWatcher** 发现聊天框更新。
2. 检测输入稳定 3 秒。
3. **Extractor** 抽取文本：「明天记得更新登陆页」。
4. 匹配关键词「明天」「更新」「登陆页」。
5. **AI Engine** → 推理出：「创建任务卡：更新登陆页（明天）」。
6. **Dispatcher** → 调用任务 API / 显示卡片。
7. **Presentation Layer** → 弹出任务确认窗。

✅ 若用户点击“确认”，任务写入；
🚫 若继续聊天，系统不重复触发。

---

#### 示例 2：会议识别与纪要生成

1. 检测到 Google Meet / Zoom 窗口进入焦点。
2. **Extractor** 抽取会议标题、参与人、字幕。
3. 稳定 10 秒后触发分析。
4. **AI Engine** → 总结会议主题与行动项。
5. **Presentation Layer** → 右侧展示纪要草稿。

---

#### 示例 3：网页内容洞察

1. 用户浏览数据图表页面。
2. **Watcher** 捕获大面积 DOM 改动。
3. **Extractor** 抽取表格、指标。
4. **AI Engine** → 自动生成分析摘要。
5. **Presentation Layer** → 显示洞察卡。

---

### 3.5 事件防抖与重复触发控制

| 机制           | 说明                            |
| -------------- | ------------------------------- |
| **时间防抖**   | 同一屏幕片段内 3 秒内不重复触发 |
| **语义哈希**   | 对提取内容计算哈希，相同则忽略  |
| **上下文缓存** | 最近 5 次相似输出不重复分析     |
| **用户交互锁** | 在展示层交互期间暂停触发        |

---

### 3.6 性能与容错设计

| 问题          | 策略                             |
| ------------- | -------------------------------- |
| 高频 DOM 变化 | 批量合并、差分处理               |
| 大量 OCR 请求 | 缓存相似图像区域结果             |
| AI 响应超时   | 采用回退策略（简化模型或跳过）   |
| 内存积压      | 周期性清理缓存与 embedding store |

---

### 3.7 插件钩子与扩展点（Plugin Hooks）

**说明**：事件流的每一阶段均提供插件扩展点。输入端支持可插拔采集（默认提供 `Screen Watcher`），消费端支持可插拔呈现（Overlay/Sidebar/Bubble）。AI Engine 面向所有插件开放上下文查询接口。

| 阶段          | 钩子                           | 触发时机                 | 插件能力                                            |
| ------------- | ------------------------------ | ------------------------ | --------------------------------------------------- |
| Detection     | `onScreenChange(change)`       | 变化捕获后（或前置过滤） | 输入插件可上报/过滤变化，推送 `screen.change`       |
| Stabilization | `onStabilize(state)`           | 判断稳定前后             | 可调整阈值或暂停后续流程                            |
| Extraction    | `onContentExtracted(tags)`     | 提取完成                 | 可增强/去重/补充 metadata，推送 `content.extracted` |
| Analysis      | `onInsightGenerated(insights)` | AI 输出后                | 可重排/合并/降噪，推送 `ai.insight`                 |
| Dispatch      | `onActionDispatch(action)`     | 行动选择时               | 可拦截或替换行动目标（如同步到外部系统）            |
| Presentation  | `render(presentContext)`       | 展示层渲染时             | 消费插件实现自定义 UI，响应 `present.render`        |

#### 事件总线主题（与插件交互）

- `screen.change` → `Change Analyzer` 处理差分与稳定
- `content.extracted` → `AI Engine (Analysis)`
- `ai.insight` → `Action Dispatcher`/`Presentation Layer`
- `present.render` → 消费插件渲染器（overlay/sidebar/bubble）

#### AI Engine 接口（对插件开放）

- `GET /api/ai/context`：查询最近上下文窗口与知识项
- `POST /api/ai/push`：插件主动推送洞察/行动进入队列

#### 示例：自定义呈现插件（Bubble Renderer）

1. 订阅 `ai.insight` 与 `present.render`
2. 收到洞察后，调用 `GET /api/ai/context` 合并上下文
3. 将数据转为轻量气泡 UI 并调用 `POST /api/present/render`
4. 用户点击确认后，系统触发 `action.execute` 写入外部系统
