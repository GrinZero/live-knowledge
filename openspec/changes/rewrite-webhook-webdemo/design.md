## Context

当前 webhook-plugin 是一个 ~500 行的"瑞士军刀"，承担了事件转发、截图收集（双路径遍历）、Buffer 序列化、multipart 构建、Python MarkItDown 调用、关键词内容分类等职责。web-demo 是一个 Next.js 应用，其 webhook 接收端有 Buffer 反序列化、递归 base64 猜测提取、multimodal 归一化、内存去重等逻辑，但实际只处理 `raw.created` 事件。

两个模块的核心问题是**职责边界模糊**：webhook 插件不应该做内容转换，web-demo 不应该猜测有效负载结构。

## Goals / Non-Goals

**Goals:**

- webhook-plugin 重写为 <100 行的纯事件转发器：收到 `onEvent` → 过滤 → `fetch POST` JSON → 记录结果
- web-demo 重写为 `raw.created` 专用接收器：接收 JSON → 校验事件类型 → 落盘 → 自动调用 AI 分析
- 两个模块的代码行数各自减少 70% 以上
- 保持插件 SDK 接口（`LiveKnowledgePlugin`）不变

**Non-Goals:**

- 不修改插件 SDK 或 PluginContext 接口
- 不修改桌面应用主进程的事件发射逻辑
- 不支持 multipart 文件传输（移除此能力）
- 不支持 MarkItDown 转换（两侧均移除）
- 不实现 webhook 签名验证或认证（未来可加）
- 不重写 web-demo 前端 UI（仅简化数据流）

## Decisions

### D1: webhook-plugin 只做 JSON POST，移除 multipart 模式

**选择**: 所有 webhook 投递统一使用 `application/json` + 标准 `fetch`。

**理由**: multipart 模式的存在是为了传输截图文件，但这引入了 `form-data` 依赖、Buffer/Path 双路径收集、附件计数等复杂逻辑。事件系统的职责是通知，不是文件传输。如果下游需要截图，应通过事件负载中的 URL 或路径自行获取。

**替代方案**: 保留 multipart 作为可选模式 → 拒绝，因为维护两条代码路径正是当前问题的根源。

### D2: webhook-plugin 转发 EventEnvelope，Buffer 转 base64

**选择**: `onEvent` 收到的 `(event, payload, context)` 中，以 `context.envelope` 为基础构建 POST body。在序列化前，遍历 payload 将所有 `Buffer` 类型字段替换为 base64 字符串（字段名从 `screenshotBuffer` 变为 `screenshotBase64`）。

**理由**: `raw.created` 事件的 payload 中 `screenshotBuffer` 是 Node.js Buffer（PNG 字节），直接 `JSON.stringify` 会序列化为 `{ type: "Buffer", data: [0, 255, ...] }`——数字数组体积膨胀 3-5 倍。转为 base64 仅膨胀 ~33%，且下游可直接用作 `data:image/png;base64,...` 显示或传给 Vision API。

**替代方案**:
- 写磁盘 + 暴露 HTTP URL → 需要桌面应用增加文件服务端点，过度设计
- 剥离 Buffer 不转发 → web-demo 拿不到截图，分析能力受限
- base64 → 最简单，本地场景 1-4MB JSON 无延迟问题

### D3: web-demo 仅接受 JSON，移除 multipart 接收

**选择**: `/api/webhook` 路由仅解析 `application/json` body。

**理由**: 与 D1 配套。上游只发 JSON，下游无需处理 multipart。如果需要截图，可从 `payload` 中的 base64 或 URL 字段获取。

### D4: web-demo 接收即分析，移除手动触发

**选择**: `/api/webhook` 收到 `raw.created` 事件后，同步落盘 + 异步触发 AI 分析。移除 `/api/analyze` 的手动调用入口（前端不再需要"分析"按钮）。

**理由**: 用户明确要求"只支持 raw.created 事件的 AI 自动触发"。当前前端的 1.2s 延迟 + 手动触发是多余的。

**替代方案**: 保留 `/api/analyze` 作为补充入口 → 保留，因为重试失败的分析仍有价值，但前端不主动调用。

### D5: 移除内存去重，用事件 ID 幂等替代

**选择**: 每个 `EventEnvelope` 必须包含唯一 `id` 字段（已由 SDK 的 `emittedAt` + `type` 可推导）。web-demo 用事件 ID 作为存储 key，天然幂等。

**理由**: 内存 Map 去重在服务器重启或多实例场景下失效。基于 ID 的幂等不依赖进程状态。

### D6: 文件存储保持 JSON 文件方案

**选择**: 继续使用 `data/events.json` 作为存储，保持简单。

**理由**: web-demo 是演示应用，不需要数据库。300 条记录上限已足够。

## Risks / Trade-offs

- **[破坏性变更]** 现有配置了 `transferMode: multipart` 的用户升级后 webhook 投递行为改变 → 在 CHANGELOG 中明确说明，提供迁移指南
- **[功能缩减]** 移除内容类型检测意味着下游无法按类型过滤 → 如需过滤，下游自行实现；webhook 只负责转发
- **[截图传输]** base64 编码后单条 JSON 约 1-4MB（1920x1080 PNG），本地回环传输无性能问题；生产环境应考虑对象存储 + URL 方案
- **[AI 分析失败]** 自动触发意味着每条事件都消耗 API 额度 → 保留 `/api/analyze` 端点供手动重试，前端显示分析状态
