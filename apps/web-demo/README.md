# Web Demo (Next.js)

独立部署的 webhook 分析面板。

## 主要能力

1. 接收 webhook（JSON / multipart）。
2. 保存事件与截图到本地磁盘。
3. 对历史事件执行 AI 二次分析。

## 启动

```bash
pnpm install
pnpm dev
```

## 接口

- `POST /api/webhook`
- `GET /api/events`
- `POST /api/analyze`

