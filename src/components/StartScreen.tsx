import { useState } from 'react'
import { SettingsModal } from './SettingsModal'

interface StartScreenProps {
  onRanking: () => void
  onStart: () => void
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
}

export function StartScreen({ onRanking, onStart, bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset }: StartScreenProps) {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen gap-8"
      style={{
        backgroundImage: 'url(/bg-home.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="flex flex-col items-center gap-8 px-16 py-12 rounded-3xl w-[480px] max-w-[90vw]"
        style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h1 className="text-5xl font-black text-primary tracking-widest text-center" style={{ textShadow: '0 2px 24px rgba(0,180,255,0.5)' }}>
          PickerPicker
        </h1>
        <div className="flex flex-col gap-3 w-full">
          <button className="btn btn-primary btn-lg w-full text-lg" onClick={onStart}>
            시작
          </button>
          <button
            className="btn btn-lg w-full text-lg border-0"
            style={{ background: 'rgba(120,60,200,0.55)', color: '#fff' }}
            onClick={onRanking}
          >
            랭킹
          </button>
          <button
            className="btn btn-lg w-full text-lg"
            style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
            onClick={() => setShowSettings(true)}
          >
            설정
          </button>
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          bgmVolume={bgmVolume}
          sfxOn={sfxOn}
          offset={offset}
          onBgmVolume={onBgmVolume}
          onToggleSfx={onToggleSfx}
          onOffset={onOffset}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
