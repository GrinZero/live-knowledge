# 实现计划：插件脚手架工具

## 概述

本实现计划采用**模板项目 + 复制替换**的架构。首先创建一个真实可运行的模板插件项目，然后脚手架工具负责复制模板并根据用户配置进行变量替换和文件过滤。

## 任务

- [x] 1. 初始化脚手架项目结构
  - [x] 1.1 创建 packages/create-lk-plugin 目录和 package.json
    - 配置 bin 入口指向 dist/cli.js
    - 添加必要的依赖：commander、inquirer、chalk、fs-extra
    - 配置 build 脚本使用 tsup
    - _Requirements: 1.1, 3.3_
  - [x] 1.2 创建 tsconfig.json 和 eslint.config.mjs
    - 配置 TypeScript 编译选项
    - 配置 ESLint 规则
    - _Requirements: 4.2_
  - [x] 1.3 编写属性测试：插件名称验证
    - **Property 8: 插件名称验证**
    - **Validates: Requirements 1.1**

- [x] 2. 实现核心数据模型和工具函数
  - [x] 2.1 创建 src/types.ts 定义核心接口
    - 定义 PluginConfig、GeneratorOptions 接口
    - 定义 ScaffoldError 错误类和错误码枚举
    - _Requirements: 2.7, 3.1_
  - [x] 2.2 创建 src/utils.ts 实现工具函数
    - 实现 kebab-case 验证函数 validatePluginName
    - 实现 kebab-case 转 PascalCase 函数 toPascalCase
    - 实现目录存在检查函数
    - _Requirements: 1.1, 2.1_
  - [x] 2.3 编写属性测试：名称转换函数
    - **Property 8: 插件名称验证**
    - 测试 validatePluginName 对所有有效/无效输入的行为
    - **Validates: Requirements 1.1**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 创建模板插件项目
  - [x] 4.1 创建 template/package.json
    - 使用 `__PLUGIN_ID__` 等占位符
    - 包含完整的依赖和脚本配置
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 4.2 创建 template/src/index.ts 主进程代码
    - 实现 LiveKnowledgePlugin 接口
    - 使用 `#if/#endif` 标记条件性代码块
    - 包含 configSchema 和 httpApi 的条件性代码
    - _Requirements: 3.4, 3.5, 4.1, 4.5_
  - [x] 4.3 创建 template/src/renderer.tsx 渲染进程代码
    - 使用 `#if/#endif` 标记 sidebar 和 page 功能
    - 包含 window.LiveKnowledge.registerPlugin 调用
    - _Requirements: 3.6, 3.7_
  - [x] 4.4 创建 template/src/components/ExamplePage.tsx
    - 示例页面组件
    - _Requirements: 3.7_
  - [x] 4.5 创建 template/src/env.d.ts 类型声明
    - window.LiveKnowledge 类型声明
    - _Requirements: 4.3_
  - [x] 4.6 创建 template 配置文件
    - tsconfig.json
    - vite.main.config.ts
    - vite.renderer.config.ts
    - eslint.config.mjs
    - _Requirements: 1.3, 4.2_
  - [x] 4.7 创建 template/README.md
    - 项目说明和开发指南
    - _Requirements: 4.4_

- [x] 5. 检查点 - 验证模板项目可构建
  - 确保模板项目可以成功构建
  - 如有问题请询问用户

- [x] 6. 实现模板复制器
  - [x] 6.1 创建 src/copier.ts
    - 实现 copyTemplate 函数
    - 复制模板目录到目标位置
    - 支持排除特定文件/目录
    - _Requirements: 1.1, 1.3_
  - [x] 6.2 编写单元测试：模板复制
    - 测试目录复制
    - 测试文件排除
    - _Requirements: 1.3_

- [x] 7. 实现变量替换器
  - [x] 7.1 创建 src/replacer.ts
    - 实现 replaceVariables 函数替换占位符
    - 实现 processConditionalBlocks 函数处理 `#if/#endif` 块
    - 实现 processDirectory 函数处理整个目录
    - _Requirements: 2.7, 3.4-3.7_
  - [x] 7.2 编写属性测试：变量替换
    - **Property 3: 变量替换完整性**
    - 测试所有占位符都被正确替换
    - **Validates: Requirements 2.7**
  - [x] 7.3 编写单元测试：条件块处理
    - 测试 `#if/#endif` 块的移除
    - 测试嵌套条件块
    - _Requirements: 3.7, 4.5_

- [x] 8. 实现文件过滤器
  - [x] 8.1 创建 src/filter.ts
    - 实现 filterFiles 函数
    - 根据插件类型删除不需要的文件
    - 根据功能选项删除可选文件
    - _Requirements: 2.3-2.6_
  - [x] 8.2 编写属性测试：文件过滤
    - **Property 9: 插件类型文件过滤**
    - 测试 main-only 和 renderer-only 的文件过滤
    - **Validates: Requirements 2.3**

- [x] 9. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [x] 10. 实现项目生成器
  - [x] 10.1 创建 src/generator.ts
    - 整合 copier、replacer、filter 模块
    - 实现 generateProject 函数
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 10.2 编写属性测试：项目生成
    - **Property 1: 项目目录创建**
    - **Property 2: 模板文件完整复制**
    - **Validates: Requirements 1.1, 1.3, 1.4**

- [x] 11. 实现交互式提示
  - [x] 11.1 创建 src/prompts.ts
    - 使用 inquirer 实现交互式问答
    - 实现插件名称、类型、功能选项的提示
    - 实现条件性提示逻辑
    - _Requirements: 2.1-2.6_
  - [x] 11.2 编写单元测试：提示逻辑
    - 测试默认值应用
    - 测试条件性提示触发
    - _Requirements: 2.3-2.6_

- [x] 12. 实现 CLI 入口
  - [x] 12.1 创建 src/cli.ts
    - 使用 commander 解析命令行参数
    - 集成交互式提示和项目生成器
    - 实现错误处理和用户反馈
    - _Requirements: 1.1, 1.2, 1.5_
  - [x] 12.2 添加 shebang 和 bin 配置
    - 确保可以通过 npx 执行
    - _Requirements: 1.1_

- [x] 13. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [x] 14. 集成测试
  - [x] 14.1 编写属性测试：生成项目结构
    - **Property 4: Package.json 完整性**
    - **Property 5: 主进程代码结构**
    - **Property 6: 渲染进程代码结构**
    - **Validates: Requirements 3.1-3.6**
  - [x] 14.2 编写属性测试：条件性功能
    - **Property 7: 条件性功能过滤**
    - **Validates: Requirements 3.7, 4.5**

- [x] 15. 最终检查点
  - 确保所有测试通过
  - 验证生成的项目可以成功构建
  - 如有问题请询问用户

## 备注

- 采用模板项目 + 复制替换的架构，模板本身是可运行的真实项目
- 模板项目位于 `packages/create-lk-plugin/template/`
- 使用 `__PLUGIN_*__` 占位符进行变量替换
- 使用 `#if FEATURE_*/#endif FEATURE_*` 标记条件性代码块
- 每个任务都引用了具体的需求以确保可追溯性
- 检查点任务用于确保增量验证
