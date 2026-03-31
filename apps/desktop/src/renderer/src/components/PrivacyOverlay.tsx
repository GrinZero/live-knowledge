import React, { useEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { Button } from './ui/button'

export const PrivacyOverlay: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    // 监听窗口失焦
    window.api.window.onBlur(() => {
      setIsLocked(true)
    })

    // 监听窗口获焦
    window.api.window.onFocus(() => {
      // 保持锁定状态，除非手动解锁
    })
  }, [])

  const handleUnlock = () => {
    setIsLocked(false)
  }

  if (!isLocked) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white/30 backdrop-blur-xl transition-all duration-300">
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-white/80 shadow-2xl border border-white/50 animate-in fade-in zoom-in duration-300">
        <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-200">
          <Lock className="h-8 w-8 text-white" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">应用已锁定</h2>
          <p className="text-sm text-gray-500 mt-1">请点击下方按钮以继续使用</p>
        </div>

        <Button
          onClick={handleUnlock}
          className="flex items-center gap-2 px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md transition-all active:scale-95 group h-auto text-base"
        >
          <Unlock className="h-5 w-5 group-hover:rotate-12 transition-transform" />
          <span>立即解锁</span>
        </Button>
      </div>
    </div>
  )
}
