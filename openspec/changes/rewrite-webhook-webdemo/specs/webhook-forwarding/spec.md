## ADDED Requirements

### Requirement: 事件转发（Buffer 转 base64）

webhook-plugin 在收到 `onEvent` 回调时，SHALL 以 `context.envelope` 为基础构建 POST body。在 JSON 序列化前，插件 SHALL 遍历 `payload` 对象，将所有 `Buffer` 类型的值转换为 base64 字符串，并将字段名中的 `Buffer` 后缀替换为 `Base64`（如 `screenshotBuffer` → `screenshotBase64`）。

插件 SHALL NOT 做任何其他转换（无截图路径收集、无内容分类、无 MarkItDown 调用）。

#### Scenario: 正常转发 raw.created 事件（含截图 base64）
- **WHEN** 系统触发 `raw.created` 事件，payload 包含 `screenshotBuffer: Buffer`，且存在一个配置了 `url: "http://example.com/hook"` 且 `events` 包含 `"raw.created"` 的 webhook 端点
- **THEN** 插件 SHALL 向 `http://example.com/hook` 发送 POST 请求，Content-Type 为 `application/json`，body 中 `payload.screenshotBase64` 为 base64 编码字符串，原 `screenshotBuffer` 字段不存在

#### Scenario: 无 Buffer 字段的事件原样转发
- **WHEN** 系统触发 `insight.generated` 事件，payload 中不包含任何 Buffer 类型字段
- **THEN** 插件 SHALL 原样转发 `context.envelope`，payload 不做任何修改

#### Scenario: 事件不匹配时不转发
- **WHEN** 系统触发 `insight.generated` 事件，但 webhook 端点配置的 `events` 列表中不包含此事件
- **THEN** 插件 SHALL NOT 向该端点发送任何请求

#### Scenario: 无 context.envelope 时降级
- **WHEN** `onEvent` 被调用但 `context` 为 undefined 或 `context.envelope` 不存在
- **THEN** 插件 SHALL 自行构建信封结构 `{ type: event, payload, emittedAt: new Date().toISOString() }` 并在 Buffer 转 base64 后转发

### Requirement: 事件过滤配置

每个 webhook 端点 SHALL 支持 `events: string[]` 配置项，用于指定该端点接收哪些事件类型。匹配规则为精确匹配（exact match）。

如果 `events` 为空数组或未配置，SHALL 转发所有事件。

#### Scenario: 精确匹配过滤
- **WHEN** 端点配置 `events: ["raw.created", "insight.generated"]`，系统触发 `raw.created` 事件
- **THEN** 该端点 SHALL 收到转发

#### Scenario: 不匹配的事件被过滤
- **WHEN** 端点配置 `events: ["raw.created"]`，系统触发 `knowledge.created` 事件
- **THEN** 该端点 SHALL NOT 收到转发

#### Scenario: 空 events 列表接收所有事件
- **WHEN** 端点配置 `events: []`（或未配置 events 字段），系统触发任意事件
- **THEN** 该端点 SHALL 收到转发

### Requirement: 投递结果记录

插件 SHALL 通过 `context.events.emit` 发出投递结果事件：
- 成功: `webhook.delivered`，payload 包含 `{ url, event, statusCode }`
- 失败: `webhook.delivery_failed`，payload 包含 `{ url, event, error }`

#### Scenario: 投递成功记录
- **WHEN** POST 请求返回 HTTP 2xx 响应
- **THEN** 插件 SHALL emit `webhook.delivered` 事件，payload 包含目标 URL、原始事件类型和响应状态码

#### Scenario: 投递失败记录
- **WHEN** POST 请求超时或返回非 2xx 响应
- **THEN** 插件 SHALL emit `webhook.delivery_failed` 事件，payload 包含目标 URL、原始事件类型和错误信息

### Requirement: 最小配置

插件的 `defaultConfig` SHALL 仅包含：
- `webhooks: WebhookEndpoint[]`，其中每个 `WebhookEndpoint` 只有 `url: string` 和 `events: string[]` 两个字段

移除所有其他配置项（`transferMode`、`resourceMode`、`enableTypeDetection`、`markitdownEnabled`、`maxAttachmentCount`、`eventMatchMode`、`customEvents`、`allowedContentTypes`）。

#### Scenario: 默认配置结构
- **WHEN** 插件以默认配置初始化
- **THEN** `defaultConfig` SHALL 等于 `{ webhooks: [] }`

#### Scenario: 配置示例
- **WHEN** 用户配置一个 webhook 端点
- **THEN** 配置 SHALL 形如 `{ webhooks: [{ url: "http://localhost:3010/api/webhook", events: ["raw.created"] }] }`
