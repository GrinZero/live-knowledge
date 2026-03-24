## Why

当前的事件派发机制缺乏跨事件维度的智能去重能力。当用户在相似页面长期停留时，系统仍会重复派发类似事件，导致：
- 重复的事件处理浪费 AI API 调用
- 插件（如 webhook）接收到大量重复事件
- 无法感知"用户仍在同一上下文中"的状态

此外，纯依赖 AI API 调用进行上下文分析的方式过于简单，缺乏可维护的状态管理和工作流编排能力。

## What Changes

1. **引入事件状态图（Event State Graph）**：基于 LangGraph.js 构建事件工作流，通过图结构管理事件的生命周期和状态转换
2. **实现智能去重层（Smart Deduplication Layer）**：在事件派发前，基于多维度（页面相似度、时间窗口、上下文语义）判断是否需要派发
3. **重构 MonitoringService**：将现有的监控-分析-派发流程迁移到 LangGraph 工作流中
4. **新增上下文记忆组件**：使用图结构存储历史上下文，支持跨事件的状态推理

## Capabilities

### New Capabilities

- `event-workflow-orchestration`: 基于 LangGraph.js 的事件工作流编排，支持条件分支、状态持久化、回溯重试
- `smart-event-deduplication`: 多维度智能去重，包括视觉相似度（pHash）、语义相似度（embedding）、时间衰减
- `context-state-graph`: 上下文状态图，维护用户会话中的页面/事件历史，支持图遍历查询相似上下文

### Modified Capabilities

- `monitoring-service`: 现有的 MonitoringService 需要适配新的工作流架构，从轮询模式迁移到事件驱动状态机

## Impact

- **依赖变更**：新增 `@langchain/langgraph`、`zod` 等库
- **核心服务重构**：`MonitoringService.ts` 需要重构为 LangGraph 工作流
- **事件派发流程变化**：`PluginManager.triggerEvent()` 前的去重检查将更加智能
- **插件影响**：现有插件的 `onEvent` 语义不变，但事件频率将显著降低
