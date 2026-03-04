# Web Demo (Next.js)

独立部署的 webhook 分析面板。

## 主要能力

1. 接收 webhook（JSON / multipart）。
2. 保存事件与截图到本地磁盘。
3. 对历史事件执行 AI 二次分析。

## 本地开发

在仓库根目录执行：

```bash
pnpm install
pnpm --filter @live-knowledge/web-demo dev
```

默认访问：`http://127.0.0.1:3010`

## 与 Desktop 主程序联调

### 1) 启动两个进程

终端 A：

```bash
pnpm --filter @live-knowledge/web-demo dev
```

终端 B：

```bash
pnpm --filter live-knowledge-app dev
```

### 2) 在 webhook-plugin 中配置目标地址

建议使用 multipart 直传截图：

```json
{
  "webhooks": [
    {
      "url": "http://127.0.0.1:3010/api/webhook",
      "transferMode": "multipart",
      "maxAttachmentCount": 3,
      "events": ["insight_generated", "knowledge_created"]
    }
  ]
}
```

### 3) 验证联调是否成功

触发一次桌面洞察后，执行：

```bash
curl http://127.0.0.1:3010/api/events
```

若返回事件列表且 `attachments` 有 `/uploads/<eventId>/...` 路径，说明截图直传与落盘成功。

## 接口

- `POST /api/webhook`
- `GET /api/events`
- `POST /api/analyze`

## AI 配置

在 `apps/web-demo/.env.local` 中配置（可选）：

```env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

未配置 `OPENAI_API_KEY` 时，`/api/analyze` 会返回回退提示文本。
