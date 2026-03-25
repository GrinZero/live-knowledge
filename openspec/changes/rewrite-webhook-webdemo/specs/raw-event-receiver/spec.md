## ADDED Requirements

### Requirement: 接收 raw.created 事件

web-demo 的 `/api/webhook` 路由 SHALL 仅接受 `application/json` 请求。路由 SHALL 从 JSON body 中读取 `type` 字段（EventEnvelope 结构），仅处理 `type === "raw.created"` 的事件，其余事件返回 `200 OK` 并标记 `ignored: true`。

#### Scenario: 接收 raw.created 事件
- **WHEN** 收到 POST `/api/webhook`，body 为 `{ type: "raw.created", payload: {...}, emittedAt: "..." }`
- **THEN** 路由 SHALL 返回 `200 OK`，body 为 `{ success: true, eventId: "<生成的ID>" }`

#### Scenario: 忽略非 raw.created 事件
- **WHEN** 收到 POST `/api/webhook`，body 为 `{ type: "insight.generated", ... }`
- **THEN** 路由 SHALL 返回 `200 OK`，body 为 `{ success: true, ignored: true }`

#### Scenario: 拒绝非 JSON 请求
- **WHEN** 收到 POST `/api/webhook`，Content-Type 为 `multipart/form-data`
- **THEN** 路由 SHALL 返回 `415 Unsupported Media Type`

### Requirement: 事件持久化

收到有效的 `raw.created` 事件后，路由 SHALL 生成唯一事件 ID，将事件记录追加到 `data/events.json` 文件中。

事件记录格式 SHALL 为：
```json
{
  "id": "<uuid>",
  "type": "raw.created",
  "payload": { ... },
  "receivedAt": "<ISO 8601>",
  "analysis": null
}
```

文件 SHALL 保持最多 200 条记录（FIFO，超出时移除最旧的）。

#### Scenario: 正常落盘
- **WHEN** 收到有效 `raw.created` 事件
- **THEN** 事件记录 SHALL 被追加到 `data/events.json`，`id` 为新生成的 UUID，`receivedAt` 为当前时间，`analysis` 为 null

#### Scenario: 超出容量限制
- **WHEN** `data/events.json` 已有 200 条记录，又收到新事件
- **THEN** SHALL 移除最旧的记录后追加新记录，保持总数不超过 200

#### Scenario: 幂等性
- **WHEN** 同一个 EventEnvelope（相同 `emittedAt` + `type` + `payload`）被重复投递
- **THEN** SHALL 基于内容哈希去重，不创建重复记录，返回已存在的 eventId

### Requirement: 自动触发 AI 分析

事件落盘后，路由 SHALL 异步触发 AI 分析。分析完成后，SHALL 将结果写回该事件记录的 `analysis` 字段。

AI 分析 SHALL 使用 OpenAI API。如果 payload 中存在 `screenshotBase64` 字段，SHALL 将其作为图片传给 Vision API 进行多模态分析；同时将 payload 中的文本内容（`timestamp`、`sessionId` 等）作为上下文发送。

#### Scenario: 自动分析成功
- **WHEN** `raw.created` 事件成功落盘
- **THEN** 系统 SHALL 异步调用 AI 分析，完成后将 `analysis` 字段更新为 `{ result: "<分析文本>", analyzedAt: "<ISO 8601>" }`

#### Scenario: 分析失败
- **WHEN** AI API 调用失败（网络错误、超额等）
- **THEN** `analysis` 字段 SHALL 更新为 `{ error: "<错误信息>", analyzedAt: "<ISO 8601>" }`

#### Scenario: 分析不阻塞响应
- **WHEN** 收到 `raw.created` 事件
- **THEN** webhook 路由 SHALL 在落盘完成后立即返回 200 响应，不等待 AI 分析完成

### Requirement: 查询事件列表

`GET /api/events` SHALL 返回所有已存储的事件记录（包含 `analysis` 字段），按 `receivedAt` 降序排列。

#### Scenario: 查询所有事件
- **WHEN** 收到 GET `/api/events`
- **THEN** SHALL 返回 `{ events: [...] }`，按时间降序排列，每条记录包含 `id`、`type`、`payload`、`receivedAt`、`analysis` 字段

### Requirement: 手动重试分析

`POST /api/analyze` SHALL 接受 `{ eventId: string }` 参数，对指定事件重新触发 AI 分析。

#### Scenario: 重试分析
- **WHEN** 收到 POST `/api/analyze`，body 为 `{ eventId: "xxx" }`
- **THEN** SHALL 重新调用 AI 分析，更新该事件的 `analysis` 字段

#### Scenario: 事件不存在
- **WHEN** 收到 POST `/api/analyze`，但 eventId 对应的事件不存在
- **THEN** SHALL 返回 `404 Not Found`
