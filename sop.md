# Live Knowledge - 产品需求文档（SOP）

## 🧭 概述

**Live Knowledge** 是一款智能实时知识提取与增强系统。  
它通过持续监控屏幕内容变化，识别潜在的知识点、任务、会议信息等，将其转化为结构化的 Tag，并通过 AI 引擎实时生成洞察或行动建议。

系统的目标是让用户在任何场景下都能 **自动获得上下文知识辅助与任务联动能力**，实现「知识即现」。

---

## 🧩 系统组成

### 1. Screen Watcher（屏幕监听器）

- 实时监控屏幕内容变化（可选区域或全局）
- 采用增量检测（Diff 模式），仅在内容显著变化时触发
- 对视觉层面（文字/图片）进行 OCR + DOM + Context 混合识别
- 通过 throttling + debounce 控制触发频率（例如：1000ms throttle + 3000ms debounce）

**触发条件示例：**

- 用户完成一条聊天信息发送
- 用户停止输入超过 2 秒
- 页面结构（如卡片、列表）新增或移除节点
- 当前窗口焦点切换

---

### 2. Content Analyzer（内容解析器）

- 对截取的屏幕文本内容进行快速语义分类与结构化
- 提取 **Tag 集合**，例如：
  - `meeting_schedule`
  - `task_todo`
  - `topic_discussion`
  - `data_table`
  - `problem_solving`
  - `insight_context`
- 提供自定义规则与 AI 混合解析模式（Hybrid Rule + LLM）

**实现方式：**

- NLP 模块快速识别关键模式（如时间、动作、任务）
- 调用 LLM 进行语义扩展与结构化输出
- 统一输出结构：
  ```json
  {
    "type": "meeting_schedule",
    "title": "Discuss Q4 Marketing Plan",
    "time": "2025-11-07T14:00:00Z",
    "participants": ["Alice", "Bob"]
  }
  ```



### 3. AI Engine（智能知识引擎）

* 接收来自内容解析器的结构化 Tag 数据
* 依据上下文动态决定响应类型：

  * 💬 洞察（Insight）
  * ✅ 任务卡片（Task）
  * 📅 日程安排（Schedule）
  * 🧠 智能求解（Solver）
  * 📊 数据分析（Analytics）
* 内部具备优先级与去重策略，防止频繁触发

**去重与稳定策略：**

* 对同类型事件进行内容哈希（如对会议标题、任务描述计算 hash）
* 若短时间内重复触发相同 hash，则忽略（例如 30 秒内同内容不重复生成）
* 使用「Context TTL」机制，记忆上下文状态（例如当前聊天话题、会议上下文）

---

### 4. Presentation Layer（知识呈现层）

* 以非侵入式方式显示 AI 生成结果
* 模式可选：

  * 🪟 悬浮面板（随页面边缘显示）
  * 💡 智能气泡（贴近触发区域）
  * 🧭 侧边知识栏（Persistent Sidebar）
* 支持用户交互（收藏、复制、发送到任务系统）

**示例交互：**

* 「在会议内容中检测到下一个会议：明天下午 3 点」 → 提供一键添加到日历
* 「检测到任务：修复登录接口延迟问题」 → 提供“创建 Issue”按钮

---

### 5. Trigger Control（触发控制策略）

| 控制方式               | 说明                        |
| ------------------ | ------------------------- |
| **Throttle**       | 限制触发频率，例如不超过每秒 1 次        |
| **Debounce**       | 在用户停止操作一定时间后再触发           |
| **Hash 去重**        | 对同类型事件内容进行哈希比对，防止重复触发     |
| **Context TTL**    | 上下文保持时间，例如 60 秒内相同话题不重复响应 |
| **Semantic Diff**  | 若新内容与旧内容语义相似度高（>0.9）则不触发  |
| **Priority Queue** | 按优先级调度触发事件，避免低优先事件打断主流程   |

**典型策略组合：**

* 聊天：debounce(2000) + hash 去重 + context ttl(30s)
* 会议：throttle(5000) + semantic diff
* 代码/文档编辑：debounce(1500) + priority queue

---

### 6. Context Memory（上下文记忆）

* 临时缓存最近 3~5 次屏幕上下文
* 提供短期“记忆窗口”，使 AI 能理解当前连续场景
* 可选择性同步到长期知识库（Knowledge Graph）

示例：

```json
{
  "context_window": [
    "User is discussing quarterly sales goals",
    "A spreadsheet with columns 'Q1', 'Q2', 'Q3'",
    "Chat mentions 'prepare the marketing summary'"
  ]
}
````

---

### 7. Knowledge Graph Integration（知识图谱融合）

- 将提取出的 Tag、任务、会议节点与现有知识图谱关联
- 可与 Notion、Obsidian、Slack、Linear、Calendar 等系统集成
- 自动生成「知识节点」：

  ```
  Meeting → Task → Document → Person → Insight
  ```

---

## 🔧 技术实现建议

| 模块           | 技术栈建议                                                                                |
| -------------- | ----------------------------------------------------------------------------------------- |
| Screen Watcher | Electron / macOS Accessibility API / Windows UI Automation / Puppeteer / Chrome Extension |
| OCR & Vision   | Tesseract.js / PaddleOCR / Vision API                                                     |
| NLP + LLM      | spaCy / HuggingFace / OpenAI GPT-4 API                                                    |
| AI Engine      | LangGraph / LangChain / ReAct-style agent / event queue                                   |
| UI 层          | Electron + React (Overlay 模式)                                                            |
| Storage        | IndexedDB / SQLite / GraphQL endpoint                                                     |

---

## 🚀 潜在拓展方向

1. **多模态识别**

   - 除文字外识别图片、表格、图表信息，自动生成解释或摘要。

2. **主动问答模式**

   - 当检测到任务或文档时，AI 自动提问：“是否要将此转为任务卡？”。

3. **团队协同场景**

   - 多人会议中自动同步知识上下文，形成「会议纪要 + 待办列表」。

4. **跨设备同步**

   - 桌面端识别结果可同步至移动端提醒。

5. **开发者模式**

   - 提供 API 接口，可将识别结果接入外部系统。

---

## 📈 关键指标（KPI）

| 指标             | 目标值 |
| ---------------- | ------ |
| 误触发率         | < 5%   |
| 响应延迟         | < 2s   |
| 上下文识别准确率 | > 90%  |
| 重复触发率       | < 3%   |
| 用户满意度       | ≥ 85%  |

---

## 📋 流程示意

```
[Screen Change]
   ↓
[Content Analyzer] → [Tags]
   ↓
[AI Engine]
   ↓
[Knowledge Display]
   ↓
[User Action / Knowledge Graph Update]
```

---

## 🧠 总结

Live Knowledge 是一种「实时知识觉察系统」，结合视觉感知、语义理解与 AI 决策，使得信息能在被用户感知的瞬间自动被提炼与转化。
核心价值在于 **让知识“主动出现”而非“被搜索”**。

---
