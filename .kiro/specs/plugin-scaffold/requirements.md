# 需求文档

## 简介

本功能旨在为 Live Knowledge 插件系统提供一个统一的脚手架工具（CLI）和模板仓库，帮助开发者快速创建、开发和发布插件。脚手架将自动生成符合规范的插件项目结构，包含必要的配置文件、类型定义和示例代码。

## 术语表

- **Scaffold**: 脚手架工具，用于自动生成项目模板的命令行工具
- **Plugin_SDK**: Live Knowledge 插件开发工具包 (@live-knowledge/plugin-sdk)
- **Main_Process**: Electron 主进程，插件的后端逻辑运行环境
- **Renderer_Process**: Electron 渲染进程，插件的前端 UI 运行环境
- **Plugin_Context**: 插件上下文对象，提供 AI、IPC、HTTP、数据库等服务接口
- **Plugin_Manifest**: 插件清单文件 (package.json)，描述插件元数据和入口点

## 需求

### 需求 1：CLI 脚手架工具

**用户故事：** 作为插件开发者，我希望通过一个简单的命令行工具快速创建插件项目，以便我能专注于业务逻辑开发而非项目配置。

#### 验收标准

1. WHEN 开发者执行 `npx create-lk-plugin <plugin-name>` 命令 THEN Scaffold SHALL 创建一个以 `<plugin-name>` 命名的目录并生成完整的插件项目结构
2. WHEN 开发者未提供插件名称 THEN Scaffold SHALL 进入交互模式并提示用户输入必要信息
3. WHEN Scaffold 生成项目 THEN Scaffold SHALL 包含以下核心文件：package.json、tsconfig.json、vite.main.config.ts、vite.renderer.config.ts、eslint.config.mjs
4. WHEN Scaffold 生成项目 THEN Scaffold SHALL 创建 src/index.ts（主进程入口）和 src/renderer.tsx（渲染进程入口）
5. WHEN 项目生成完成 THEN Scaffold SHALL 显示后续步骤指引，包括安装依赖和启动开发的命令

### 需求 2：交互式配置

**用户故事：** 作为插件开发者，我希望在创建项目时能够选择插件类型和功能模块，以便生成最适合我需求的项目模板。

#### 验收标准

1. WHEN Scaffold 进入交互模式 THEN Scaffold SHALL 提示用户输入插件名称（kebab-case 格式）
2. WHEN Scaffold 进入交互模式 THEN Scaffold SHALL 提示用户输入插件显示名称和描述
3. WHEN Scaffold 进入交互模式 THEN Scaffold SHALL 提供插件类型选择：仅后端（Main Only）、仅前端（Renderer Only）、完整插件（Full Plugin）
4. WHEN 用户选择包含前端的插件类型 THEN Scaffold SHALL 询问是否需要侧边栏菜单项
5. WHEN 用户选择包含前端的插件类型 THEN Scaffold SHALL 询问是否需要独立页面路由
6. WHEN 用户选择包含后端的插件类型 THEN Scaffold SHALL 询问是否需要配置 Schema（configSchema）
7. WHEN 用户完成所有选择 THEN Scaffold SHALL 根据选择生成定制化的项目模板

### 需求 3：项目模板结构

**用户故事：** 作为插件开发者，我希望生成的项目结构清晰且符合最佳实践，以便我能快速理解和扩展代码。

#### 验收标准

1. THE Plugin_Manifest SHALL 包含正确的 main 和 renderer 入口点配置
2. THE Plugin_Manifest SHALL 包含 @live-knowledge/plugin-sdk 作为依赖
3. THE Plugin_Manifest SHALL 包含 build、lint、lint:fix、pack 脚本命令
4. WHEN 生成主进程代码 THEN Scaffold SHALL 创建实现 LiveKnowledgePlugin 接口的类
5. WHEN 生成主进程代码 THEN Scaffold SHALL 包含 initialize 方法和基础 hooks 结构
6. WHEN 生成渲染进程代码 THEN Scaffold SHALL 包含 window.LiveKnowledge.registerPlugin 调用
7. WHEN 生成渲染进程代码 THEN Scaffold SHALL 包含示例路由和组件

### 需求 4：开发体验优化

**用户故事：** 作为插件开发者，我希望有完善的类型提示和文档注释，以便我能高效地开发插件。

#### 验收标准

1. THE Scaffold SHALL 生成包含完整 JSDoc 注释的示例代码
2. THE Scaffold SHALL 在 tsconfig.json 中配置正确的类型引用
3. THE Scaffold SHALL 生成 src/env.d.ts 文件，包含 window.LiveKnowledge 类型声明
4. WHEN 项目生成完成 THEN Scaffold SHALL 创建 README.md 文件，包含开发指南和 API 说明
5. IF 用户选择了 configSchema THEN Scaffold SHALL 生成示例配置 Schema 和默认配置

### 需求 5：构建和打包

**用户故事：** 作为插件开发者，我希望能够一键构建和打包插件，以便我能方便地分发插件。

#### 验收标准

1. WHEN 开发者执行 `npm run build` THEN 构建系统 SHALL 编译主进程代码到 dist/index.js
2. WHEN 开发者执行 `npm run build` THEN 构建系统 SHALL 编译渲染进程代码到 dist/renderer.global.js
3. WHEN 开发者执行 `npm run pack` THEN 打包工具 SHALL 生成 `<plugin-name>-<version>.zip` 文件
4. THE 打包文件 SHALL 包含 package.json、dist 目录、README.md（如存在）、assets 目录（如存在）

### 需求 6：模板仓库

**用户故事：** 作为插件开发者，我希望有一个公开的模板仓库可以参考和 fork，以便我能学习最佳实践并快速开始开发。

#### 验收标准

1. THE 模板仓库 SHALL 包含完整的示例插件代码
2. THE 模板仓库 SHALL 包含详细的 README 文档，说明项目结构和开发流程
3. THE 模板仓库 SHALL 包含 CONTRIBUTING.md 文件，说明如何贡献代码
4. THE 模板仓库 SHALL 包含 .github 目录，配置 Issue 和 PR 模板
5. WHEN 开发者 fork 模板仓库 THEN 开发者 SHALL 能够直接修改并开发自己的插件
