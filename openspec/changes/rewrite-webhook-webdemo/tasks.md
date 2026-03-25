## 1. Webhook Plugin 重写

- [x] 1.1 清空 `plugins/webhook-plugin/src/index.ts`，重写为纯事件转发器：`onEvent` → 过滤 → Buffer 字段转 base64（`screenshotBuffer` → `screenshotBase64`）→ `fetch POST` JSON → emit 结果事件
- [x] 1.2 精简 `plugins/webhook-plugin/package.json`：移除 `form-data` 依赖，更新描述
- [x] 1.3 更新 `defaultConfig` 为 `{ webhooks: [] }`，`configSchema` 仅包含 `webhooks` 数组（每项 `url` + `events`）
- [x] 1.4 删除 `plugins/webhook-plugin/src/WebhookHistory.tsx`（不再需要独立 UI 组件）
- [x] 1.5 验证插件能在桌面应用中正常加载，`raw.created` 事件能正确转发到 `http://127.0.0.1:3010/api/webhook`

## 2. Web-Demo API 路由重写

- [x] 2.1 重写 `apps/web-demo/src/app/api/webhook/route.ts`：仅接受 JSON，仅处理 `raw.created`，落盘到 `data/events.json`，异步触发 AI 分析
- [x] 2.2 重写 `apps/web-demo/src/app/api/events/route.ts`（如不存在则新建）：返回已存储事件列表，按时间降序
- [x] 2.3 重写 `apps/web-demo/src/app/api/analyze/route.ts`：接受 `{ eventId }`，重新触发 AI 分析并更新 `analysis` 字段
- [x] 2.4 实现事件存储模块 `apps/web-demo/src/lib/store.ts`：读写 `data/events.json`，写入队列，200 条上限 FIFO，内容哈希去重

## 3. Web-Demo AI 模块重写

- [x] 3.1 重写 `apps/web-demo/src/lib/ai.ts`：简化为单一函数 `analyzeEvent(payload) → string`，直接调用 OpenAI API；若 payload 包含 `screenshotBase64` 则使用 Vision API 多模态分析，移除递归 base64 提取和多路径尝试逻辑

## 4. 清理

- [x] 4.1 删除 `apps/web-demo/src/lib/markitdown.ts`（如存在）
- [x] 4.2 删除 `apps/web-demo/src/lib/multimodal.ts`（如存在）
- [x] 4.3 清理 `apps/web-demo/package.json` 中不再需要的依赖
- [x] 4.4 更新 web-demo 前端 `page.tsx`：移除手动分析触发逻辑，事件列表直接显示 `analysis` 字段状态（pending/completed/error）

## 5. 集成验证

- [x] 5.1 启动桌面应用 + web-demo，验证 `raw.created` 事件从桌面应用 → webhook 插件 → web-demo → AI 分析的完整链路
- [x] 5.2 验证非 `raw.created` 事件被 web-demo 正确忽略（返回 200 + ignored）
- [x] 5.3 验证事件去重：重复投递同一事件不产生重复记录
