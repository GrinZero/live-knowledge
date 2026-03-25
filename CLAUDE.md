# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**Live Knowledge** 是一款智能实时屏幕上下文感知系统，基于 Electron + React 构建，通过 AI 分析屏幕内容并生成洞察。

### 技术栈

- **桌面应用**: Electron 39 + React 19 + TypeScript + TailwindCSS 4 + Vite
- **后端服务**: Node.js + Express (端口 3000) + SQLite
- **AI 集成**: OpenAI GPT-4o / Google Gemini 1.5
- **包管理**: pnpm 9 + Turbo

### 目录结构

```
apps/
  desktop/           # Electron 主应用 (live-knowledge-app)
  web-demo/          # Next.js Web Demo (@live-knowledge/web-demo，端口 3010)
packages/
  plugin-sdk/        # 插件 SDK (@live-knowledge/plugin-sdk)
  create-lk-plugin/  # 插件脚手架 CLI
plugins/
  problem-solver-plugin/
  webhook-plugin/
```

## 常用命令

```bash
# 安装依赖
pnpm install

# 全局开发（所有包）
pnpm dev

# 全局构建
pnpm build

# 代码检查与修复
pnpm lint
pnpm lint:fix

# 格式化
pnpm format

# 单个包操作
pnpm --filter live-knowledge-app dev    # 桌面应用
pnpm --filter live-knowledge-app build  # 构建桌面应用
pnpm --filter @live-knowledge/web-demo dev  # Web Demo (端口 3010)
```

## 核心架构

### 桌面应用主进程服务 (`apps/desktop/src/main/services/`)

| 模块 | 职责 |
|------|------|
| **ScreenWatcher** | 屏幕捕获与变化检测（感知哈希） |
| **ContentAnalyzer** | OCR (Tesseract.js) + AI 视觉分析 |
| **AIEngine** | LLM 对接，提示词管理，洞察生成 |
| **MonitoringService** | 中央协调器，管理捕获循环 |
| **PluginManager** | 插件生命周期管理 |
| **DatabaseService** | SQLite 持久化 |
| **APIServer** | Express HTTP 服务器 |
| **EventWorkflow** | 事件工作流编排（状态图模式） |

### 数据流向

```
屏幕 → ScreenWatcher → ContentAnalyzer → AIEngine → Database
                                    ↓
                             PluginManager (hooks)
                                    ↓
                              PresentationService (UI)
```

### 插件系统

插件通过 Hooks 与核心系统交互：

- `getContext()` - 注入额外上下文（如 Git 分支、日历事件）
- `enrichPrompt()` - 增强分析提示词
- `onAction()` - 处理 AI 触发的动作
- `onEvent()` - 监听系统事件

## 环境配置

根目录 `.env` 文件（可选）：

```env
AI_PROVIDER=gemini          # 'openai' 或 'gemini'
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
AI_MODEL=gemini-1.5-flash
```

## Webhook 开发

`webhook-plugin` 支持向外部系统推送事件：

- `POST /api/webhook` - 接收事件（JSON 或 multipart）
- `GET /api/events` - 查看已落盘事件
- `POST /api/analyze` - 对事件执行 AI 分析

本地联调：桌面应用推送 webhook 到 `http://127.0.0.1:3010/api/webhook`


>>> 必须用中文输出文档 <<<
