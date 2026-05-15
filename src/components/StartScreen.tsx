import { useState } from 'react'
import { AudioSettingsModal } from './AudioSettingsModal'

interface StartScreenProps {
  onRanking: () => void
  onStart: () => void
  bgmVolume: number
  sfxOn: boolean
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
}

export function StartScreen({ onRanking, onStart, bgmVolume, sfxOn, onBgmVolume, onToggleSfx }: StartScreenProps) {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen gap-8">

      {/* 설정 아이콘 — 오른쪽 위 */}
      <button
        className="btn btn-ghost btn-circle absolute top-4 right-4"
        onClick={() => setShowSettings(true)}
        aria-label="음향 설정"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <h1 className="text-6xl font-black text-primary tracking-widest">
        PickerPicker
      </h1>
      <div className="flex gap-4">
        <button className="btn btn-outline btn-lg" onClick={onRanking}>
          랭킹
        </button>
        <button className="btn btn-primary btn-lg" onClick={onStart}>
          시작
        </button>
      </div>

      {/* 음향 설정 모달 */}
      {showSettings && (
        <AudioSettingsModal
          bgmVolume={bgmVolume}
          sfxOn={sfxOn}
          onBgmVolume={onBgmVolume}
          onToggleSfx={onToggleSfx}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
