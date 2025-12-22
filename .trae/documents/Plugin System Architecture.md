# Live Knowledge - 插件系统架构

## 1. 概述

Live Knowledge 的目标是构建一个高度可扩展的插件系统，允许外部模块接入应用的生命周期。插件系统覆盖以下三个核心阶段：

- **输入 (Context)**: 在 AI 分析前收集额外的环境上下文。
- **AI 核心 (Prompting)**: 修改系统提示词 (Prompt) 以识别特定场景或注入规则。
- **输出 (Actions)**: 处理 AI 生成的洞察并执行自定义动作。

## 2. 架构组件

### 2.1 插件接口定义

所有插件必须实现标准的 `LiveKnowledgePlugin` 接口：

```typescript
export interface LiveKnowledgePlugin {
  id: string;
  name: string;
  version: string;
  description?: string;

  hooks?: {
    // 输入阶段：收集额外上下文（例如：Git 分支信息、日历事件）
    getContext?: () => Promise<Record<string, unknown>>;

    // 核心阶段：修改系统提示词或注入规则
    enrichPrompt?: (
      currentContext: Record<string, unknown>,
    ) => Promise<string | void>;

    // 输出阶段：处理特定动作
    onAction?: (action: Action) => Promise<boolean>;

    // 事件监听：监听系统事件
    onEvent?: (event: string, payload: any) => Promise<void>;
  };

  // 初始化方法，系统注入 API 能力
  initialize?: (context: PluginContext) => void;
}
```

### 2.2 插件管理器 (`src/main/services/PluginManager.ts`)

`PluginManager` 是核心服务，负责：

- **加载与注册**：从磁盘加载插件（支持文件夹、ZIP、TGZ）。
- **Hook 执行**：暴露方法供其他服务调用 (`getContexts`, `getPromptAdditions`, `executeAction`)。
- **生命周期管理**：启用、禁用、卸载插件。
- **沙箱隔离**：为插件提供受限的执行环境（通过 `PluginContext`）。

### 2.3 集成点

#### A. 监控服务 (`MonitoringService`)

- **上下文收集**：在调用 AI 引擎前，调用 `pluginManager.getContexts()` 聚合所有插件的上下文数据。
- **事件触发**：当知识被创建或洞察生成时，触发 `pluginManager.triggerEvent()`。

#### B. AI 引擎 (`AIEngine`)

- **提示词构建**：在 `buildPrompt` 方法中，调用 `pluginManager.getPromptAdditions()` 将插件规则注入到 System Prompt 中。
  - _示例_：“如果你看到类似 Jira ID 的文本，请提取它。”
- **动作执行**：当 AI 生成 `suggestedActions` 后，`MonitoringService` 会尝试调用 `pluginManager.executeAction()` 来执行这些动作。

## 3. 开发指南

### 步骤 1：创建插件

创建一个实现 `LiveKnowledgePlugin` 接口的类：

```typescript
export default class MyPlugin implements LiveKnowledgePlugin {
  id = "my-plugin";
  name = "My Custom Plugin";
  version = "1.0.0";

  hooks = {
    async getContext() {
      return { myData: "hello" };
    },
    async enrichPrompt(ctx) {
      return 'Please pay attention to "myData".';
    },
  };
}
```

### 步骤 2：打包与安装

1.  使用 `npm pack` 或 `zip` 打包插件。
2.  在 Live Knowledge 应用设置中上传插件包。
3.  系统会自动解压并加载插件。

## 4. 扩展性设计

- **新输入源**：插件只需实现 `getContext` 即可接入新的数据源（如音频转录、IDE 状态）。
- **新场景支持**：通过 `enrichPrompt` 教会 AI 识别新场景，无需修改核心代码。
- **新输出能力**：注册 `onAction` 处理程序，实现与外部系统（Linear, Slack, Notion）的对接。
