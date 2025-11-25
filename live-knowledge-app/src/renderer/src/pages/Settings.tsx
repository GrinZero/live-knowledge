export default function Settings(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">设置配置页面</h1>
      <p className="text-sm text-gray-300">触发规则配置、集成设置、个性化选项（占位）</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-700 p-4">触发规则设置（预留）</div>
        <div className="rounded-lg border border-gray-700 p-4">系统集成设置（预留）</div>
      </div>
    </div>
  )
}