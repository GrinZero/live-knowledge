## Context

### 背景
- 用户需要在不打开监控面板的情况下快速触发截图采集
- 现有 `MonitoringService` 的 `startMonitoring()` 方法需要先打开监控窗口才能工作
- 设置页面已有"触发规则"标签页，但功能显示"即将推出"

### 约束
- 使用 Electron 的 `globalShortcut` 模块注册全局快捷键
- 快捷键设置需要持久化存储
- 需要复用现有的 `EventWorkflow` 进行截图处理

### 干系人
- 桌面应用用户

## Goals / Non-Goals

**Goals:**
- 实现全局快捷键触发单次截图采集
- 提供快捷键自定义配置界面
- 快捷键触发时静默执行，不打开任何窗口

**Non-Goals:**
- 不改变现有监控自动采集逻辑
- 不实现复杂的快捷键组合验证（如冲突检测）
- 不实现每次启动时的快捷键冲突提示

## Decisions

### 1. 快捷键存储位置

**选择**：扩展 `app_settings` 表/配置，添加 `quickCaptureShortcut` 字段

**理由**：
- 与现有设置系统保持一致
- 已是 Electron 主进程熟悉的存储机制

**备选方案**：
- 单独建表存储 → 过度设计
- 存储在本地文件 → 与现有架构不一致

### 2. 手动触发方法

**选择**：在 `MonitoringService` 中添加 `triggerManualCapture()` 方法

**理由**：
- 复用现有 `performScreenCheck()` 和 `EventWorkflow` 的处理逻辑
- 保持代码内聚性

**备选方案**：
- 新建独立服务 → 增加复杂度
- 直接在主进程调用 → 破坏现有架构分层

### 3. 快捷键默认配置

**选择**：`CommandOrControl+Shift+S`

**理由**：
- 与常见截图工具（如 macOS 截图、Lightshot 等）习惯一致
- 避免与系统快捷键冲突
- `CommandOrControl` 跨平台兼容 macOS 和 Windows

### 4. 快捷键注册时机

**选择**：应用启动时注册，`Settings` 变化时重新注册

**理由**：
- 符合 Electron globalShortcut 最佳实践
- 用户修改设置后立即生效

## Risks / Trade-offs

[风险] 快捷键与其他应用冲突
→ **缓解**：提供设置界面让用户自定义；macOS 系统快捷键优先

[风险] 全局快捷键在某些全屏应用中失效
→ **缓解**：这是 Electron globalShortcut 的已知限制，在设计中文档化

[风险] 快捷键设置未保存导致无法恢复
→ **缓解**：使用数据库持久化存储

## Open Questions

1. 是否需要显示通知提示用户截图已采集？
2. 快捷键触发时，如果监控正在运行，是否需要跳过？
