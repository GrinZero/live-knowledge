export default function Overlay(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">悬浮窗展示层</h1>
      <p className="text-sm text-gray-300">在其他应用上层显示结果（占位）</p>
      <div className="rounded-lg border border-gray-700 p-4">Overlay 预览（预留）</div>
    </div>
  )
}
