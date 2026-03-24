## Context

### 背景

当前的 Live Knowledge 系统使用 `MonitoringService` 进行屏幕监控，通过 `ScreenWatcher` 检测画面变化，使用 `AIEngine` 进行上下文分析，最后通过 `PluginManager` 派发事件给各个插件。

**现有架构问题：**

1. **去重机制薄弱**：`MonitoringService` 仅使用 `lastContextHash` 对连续帧进行简单 hash 去重，无法处理语义层面的重复
2. **状态管理缺失**：每次监控循环都是独立的，缺乏跨事件的状态记忆
3. **流程僵化**：监控-分析-派发的流程硬编码，难以扩展条件分支或回溯重试
4. **AI 调用浪费**：用户在相似页面停留时，仍会重复调用 AI API 进行上下文分析

### 技术约束

- 桌面应用基于 Electron + TypeScript
- 需要保持向后兼容，不破坏现有插件接口
- 性能敏感，屏幕监控不能明显占用系统资源

## Goals / Non-Goals

**Goals:**

- 实现多维度智能去重（视觉 pHash + 语义 embedding + 时间衰减）
- 引入 LangGraph 工作流，替代现有的线性流程
- 支持事件状态的持久化和回溯
- 降低重复事件对插件的干扰

**Non-Goals:**

- 不改变现有的 `PluginManager` 和 `onEvent` 接口契约
- 不实现完整的 AI Agent，仅用于上下文分析和去重判断
- 不引入数据库，状态存储使用内存 + 可选的序列化持久化

## Decisions

### Decision 1: 使用 LangGraph.js 而非自建状态机

**选择**：引入 `@langchain/langgraph`

**理由**：
- LangGraph 提供图结构状态管理，原生支持条件分支、循环、回溯
- 内置 checkpointing 机制，支持状态持久化和恢复
- 与 LangChain生态兼容，便于后续扩展 AI 能力
- 比 XState 更轻量，学习曲线平缓

**替代方案**：
- XState：过于重量，XML配置复杂
- 自建状态机：维护成本高，容易出错
- 水分子工作流：功能太弱，不支持复杂分支

### Decision 2: 去重策略采用多维度加权

**选择**：视觉相似度（40%）+ 语义相似度（40%）+ 时间衰减（20%）

**理由**：
- 纯视觉相似度会漏掉同一页面不同状态的情况
- 纯语义相似度计算成本高，且可能误判不同页面的相似描述
- 时间衰减可以区分"用户仍在阅读"和"用户已跳转新页面"

**阈值设定**：
- 综合相似度 > 0.85：判定为重复事件，跳过派发
- 综合相似度 < 0.6：判定为新事件，正常派发
- 0.6 - 0.85：进入人工确认队列（可选）

**Embedding 支持**：系统 SHALL 支持 OpenAI 和 Gemini 双端嵌入计算，通过 AIEngine 统一抽象

### Decision 3: ContextMemory 重构为状态图

**选择**：将 `ContextMemory` 重构为 `ContextStateGraph`

**理由**：
- 现有 `ContextMemory.findSimilarKnowledge()` 使用简单词频匹配
- 图结构可以表示页面间的跳转关系
- 支持高效的相似子图查询

**实现**：
- 使用 `dagre` 或 `graphology` 作为底层图库
- 节点：页面/事件
- 边：页面跳转、事件关联
- 节点属性：pHash、embedding、时间戳

### Decision 4: 工作流节点设计

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ screen_check │────>│ capture_frame│────>│ analyze_context │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                  │
                                                  v
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ trigger_event│<────│ deduplicate  │<────│ compute_similarity│
└─────────────┘     └──────────────┘     └─────────────────┘
                                                  │
                                                  v
                                         ┌─────────────────┐
                                         │ update_state_graph│
                                         └─────────────────┘
```

**节点职责**：
- `screen_check`：检测屏幕变化（复用 ScreenWatcher）
- `capture_frame`：捕获帧并计算 pHash
- `analyze_context`：调用 AIEngine 分析上下文
- `compute_similarity`：与历史状态比较，计算多维度相似度
- `deduplicate`：根据相似度决定是否去重
- `trigger_event`：调用 PluginManager 派发事件
- `update_state_graph`：更新 ContextStateGraph

## Risks / Trade-offs

**[Risk] LangGraph 引入增加包体积**
→ **Mitigation**：使用 `@langchain/langgraph` 的 minimal 版本，核心包仅约 200KB

**[Risk] 语义 embedding 计算延迟**
→ **Mitigation**：对 embedding 结果进行缓存，页面 URL 作为缓存 key

**[Risk] 状态图内存膨胀**
→ **Mitigation**：配置最大节点数（默认 1000），超出后淘汰最旧节点

**[Risk] 重构破坏现有功能**
→ **Mitigation**：保留原有 `MonitoringService` 作为 fallback，新工作流通过 feature flag 启用

## Migration Plan

### Phase 1: 引入阶段
1. 安装 `@langchain/langgraph`、`graphology` 依赖
2. 创建 `ContextStateGraph` 类，复用现有 `ContextMemory` 接口
3. 实现基础的图存储和相似度查询

### Phase 2: 工作流搭建
1. 将 `MonitoringService` 逻辑拆分为独立节点
2. 使用 `StateGraph` 组装新工作流
3. 保留原有方法为代理，渐进式切换

### Phase 3: 去重上线
1. 配置 feature flag，默认关闭
2. 小流量验证，监控去重率和事件派发量
3. 全量开启

### Rollback
- 通过 feature flag 一键关闭
- 状态图内存清空，恢复原有逻辑

## Open Questions

~~1. **Embedding 模型选择**：使用 OpenAI 的 ada-002 还是本地部署的轻量模型？~~ → 已确认：支持 OpenAI 和 Gemini
~~2. **去重阈值调优**：0.85/0.6 的阈值是否需要做成可配置？~~ → 保持固定，后续可配置化
~~3. **状态持久化**：是否需要在应用重启后恢复状态图？~~ → 已确认：仅内存存储
4. **多显示器支持**：现有 ScreenWatcher 对多显示器的处理是否需要改进？
