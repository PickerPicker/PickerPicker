import { useState } from 'react'
import { SettingsModal } from '../SettingsModal'

interface PauseModalProps {
  onResume: () => void
  onGiveUp: () => void
  offset: number
  onOffset: (v: number) => void
  sfxOn: boolean
  onToggleSfx: () => void
  bgmVolume: number
  onBgmVolume: (v: number) => void
}

export function PauseModal({
  onResume,
  onGiveUp,
  offset,
  onOffset,
  sfxOn,
  onToggleSfx,
  bgmVolume,
  onBgmVolume,
}: PauseModalProps) {
  const [showSettings, setShowSettings] = useState(false)

  if (showSettings) {
    return (
      <SettingsModal
        bgmVolume={bgmVolume}
        sfxOn={sfxOn}
        offset={offset}
        onBgmVolume={onBgmVolume}
        onToggleSfx={onToggleSfx}
        onOffset={onOffset}
        onClose={() => setShowSettings(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 w-full max-w-xs px-4">
        <div className="text-4xl font-black tracking-widest text-white">⏸ PAUSED</div>

        <button
          className="btn btn-outline btn-wide text-white border-white/40 hover:bg-white/10"
          onClick={() => setShowSettings(true)}
        >
          ⚙️ 설정
        </button>

        <button
          className="btn btn-primary btn-wide text-lg"
          onClick={onResume}
        >
          계속하기
        </button>

        <button
          className="btn btn-error btn-outline btn-wide"
          onClick={onGiveUp}
        >
          포기하기
        </button>

        <p className="text-xs text-white/30">ESC 키로 재개</p>
      </div>
    </div>
  )
}
