## Why

webhook-plugin 和 web-demo 的当前实现已严重过度设计。webhook 插件承担了文件转换（MarkItDown Python 调用）、内容类型检测（关键词匹配分类）、截图收集（双路径 Buffer/Path 遍历）等不属于它的职责。web-demo 的 webhook 接收端有 Buffer 反序列化、递归 base64 猜测提取、multimodal 归一化、内存去重等脆弱逻辑，但实际上只处理 `raw.created` 事件，其他事件全部静默丢弃。两个模块都需要完全重写，回归简洁。

## What Changes

- **BREAKING** 删除 webhook-plugin 现有实现，重写为纯事件转发器：收到事件 → 原样 POST 到目标 URL，不做任何内容转换、文件处理或类型检测
- **BREAKING** 删除 web-demo 现有 API 路由和 AI 逻辑，重写为：仅接收 `raw.created` 事件 → 落盘 → 自动触发 AI 分析
- 移除 MarkItDown Python 依赖（两个模块中均移除）
- 移除 webhook-plugin 的内容类型检测、截图收集、multipart 发送模式
- 移除 web-demo 的 Buffer 反序列化、递归 base64 提取、multimodal 归一化
- 移除 web-demo 的内存去重机制
- 简化 webhook-plugin 配置项：仅保留 `url` 和 `events` 过滤
- 简化 web-demo 前端：移除手动分析触发，改为接收即分析

## Capabilities

### New Capabilities

- `webhook-forwarding`: webhook 插件的纯事件转发能力——收到 onEvent 回调后，将事件信封原样 JSON POST 到配置的目标 URL
- `raw-event-receiver`: web-demo 接收 raw.created 事件、落盘存储、并自动触发 AI 分析的完整流程

### Modified Capabilities

（无修改，两个模块均为完全重写替换）

## Impact

- **plugins/webhook-plugin/**: 整个 `src/` 目录重写，`package.json` 精简依赖（移除 form-data 等）
- **apps/web-demo/**: `src/app/api/` 路由重写，`src/lib/` 工具库重写，前端 `page.tsx` 简化
- **配置**: webhook-plugin 的 `defaultConfig` 大幅精简，现有用户配置中的 `transferMode`、`resourceMode`、`enableTypeDetection`、`markitdownEnabled` 等字段失效
- **依赖**: 移除 `form-data`（webhook-plugin）、移除 `markitdown` Python 依赖（两侧）
- **API 契约变更**: webhook POST 体从复杂信封格式变为标准 EventEnvelope JSON；web-demo `/api/webhook` 仅接受 JSON（移除 multipart 支持）
