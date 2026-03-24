## 1. 数据库/设置扩展

- [x] 1.1 扩展 `app_settings` 添加 `quickCaptureShortcut` 字段（存储默认快捷键字符串）
- [x] 1.2 在 `DatabaseService` 添加获取/保存快捷键配置的方法

## 2. MonitoringService 手动触发方法

- [x] 2.1 在 `MonitoringService` 添加 `triggerManualCapture()` 方法
- [x] 2.2 方法内部调用 `captureScreen()` 触发截图
- [x] 2.3 截图后通过 `processAggregatedContext()` 处理

## 3. 主进程快捷键注册

- [x] 3.1 在 `main/index.ts` 引入 `globalShortcut` 模块
- [x] 3.2 应用启动时从设置读取快捷键并注册 `globalShortcut.register()`
- [x] 3.3 快捷键回调调用 `monitoringService.triggerManualCapture()`

## 4. 快捷键设置变更监听

- [x] 4.1 添加 IPC handler 监听快捷键设置变更
- [x] 4.2 设置变更时先 `globalShortcut.unregisterAll()` 再重新注册新快捷键

## 5. 前端快捷键设置 UI

- [x] 5.1 在 `Settings.tsx` 的 Triggers 标签页添加快捷键配置组件
- [x] 5.2 实现快捷键输入框，支持捕获按键组合
- [x] 5.3 保存时调用 API 持久化快捷键配置
- [x] 5.4 加载设置时显示当前配置的快捷键

## 6. API 路由

- [x] 6.1 添加 `GET /api/settings/shortcut` 获取快捷键配置
- [x] 6.2 添加 `POST /api/settings/shortcut` 保存快捷键配置

## 7. 验证与测试

- [x] 7.1 测试默认快捷键 `Cmd+Shift+S` 触发截图采集
- [x] 7.2 测试修改快捷键后新快捷键生效
- [x] 7.3 测试快捷键触发时监控窗口不打开
- [x] 7.4 测试应用重启后快捷键设置保持
