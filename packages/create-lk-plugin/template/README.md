# __PLUGIN_NAME__

__PLUGIN_DESCRIPTION__

## 开发

### 安装依赖

```bash
npm install
```

### 构建插件

```bash
npm run build
```

### 代码检查

```bash
npm run lint
npm run lint:fix
```

### 打包插件

```bash
npm run pack
```

## 项目结构

```
__PLUGIN_ID__/
├── package.json          # 插件清单
├── tsconfig.json         # TypeScript 配置
├── vite.main.config.ts   # 主进程构建配置
├── vite.renderer.config.ts # 渲染进程构建配置
├── eslint.config.mjs     # ESLint 配置
└── src/
    ├── index.ts          # 主进程入口
    ├── renderer.tsx      # 渲染进程入口
    ├── env.d.ts          # 类型声明
    └── components/       # React 组件
        └── ExamplePage.tsx
```

## 插件 API

### 主进程 (index.ts)

主进程代码实现 `LiveKnowledgePlugin` 接口：

- `initialize(context)` - 插件初始化，接收插件上下文
- `hooks.getContext()` - 返回插件上下文数据
- `hooks.enrichPrompt()` - 丰富 AI 提示词
- `hooks.onAction(action)` - 处理动作

### 渲染进程 (renderer.tsx)

渲染进程通过 `window.LiveKnowledge.registerPlugin()` 注册插件：

- `routes` - 页面路由配置
- `sidebarItems` - 侧边栏菜单项

## 许可证

MIT
