import { useState } from 'react'

type Screen = 'home' | 'settings' | 'credits'

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

const CREDITS = [
  { role: 'PM',      name: '이하경' },
  { role: 'DESIGN',  name: '배나현' },
  { role: 'BACKEND', name: '황시선' },
  { role: 'FRONT',   name: '이건희' },
  { role: 'LEAD',    name: '서새찬' },
]

function CreditsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex flex-col items-center gap-1">
        <h2
          className="text-2xl font-black tracking-widest text-primary"
          style={{ textShadow: '0 0 12px rgba(0,180,255,0.7)', fontFamily: 'monospace' }}
        >
          ─ CREDITS ─
        </h2>
        <p className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
          2026 INTERCON
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        {CREDITS.map(({ role, name }) => (
          <div
            key={role}
            className="flex items-center justify-between px-4 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span
              className="text-xs font-black tracking-widest"
              style={{ color: 'rgba(0,180,255,0.7)', fontFamily: 'monospace', minWidth: '80px' }}
            >
              [{role}]
            </span>
            <span
              className="text-base font-bold tracking-wider"
              style={{ fontFamily: 'monospace', color: '#e2e8f0' }}
            >
              {name}
            </span>
          </div>
        ))}
      </div>

      <p
        className="text-xs tracking-widest text-center"
        style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}
      >
        © 2026 PickerPicker Team
      </p>

      <button
        className="btn btn-sm w-full"
        style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontFamily: 'monospace' }}
        onClick={onBack}
      >
        ← BACK
      </button>
    </div>
  )
}

function SettingsView({
  bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset, onBack,
}: {
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
  onBack: () => void
}) {
  const offsetLabel = offset === 0 ? '0ms' : offset > 0 ? `+${offset}ms` : `${offset}ms`

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2
        className="text-2xl font-black tracking-widest text-primary text-center"
        style={{ textShadow: '0 0 12px rgba(0,180,255,0.7)', fontFamily: 'monospace' }}
      >
        ─ SETTINGS ─
      </h2>

      {/* BGM 볼륨 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold tracking-widest" style={{ fontFamily: 'monospace', color: 'rgba(0,180,255,0.8)' }}>[BGM]</span>
          <span className="font-mono text-primary">{bgmVolume}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={bgmVolume}
          className="range range-primary range-sm"
          onChange={e => onBgmVolume(Number(e.target.value))}
        />
        <div className="flex justify-between text-xs px-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span>0</span><span>50</span><span>100</span>
        </div>
      </div>

      {/* 효과음 */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="font-bold tracking-widest text-sm" style={{ fontFamily: 'monospace', color: 'rgba(0,180,255,0.8)' }}>[SFX]</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={sfxOn}
          onChange={onToggleSfx}
        />
      </div>

      {/* 판정 오프셋 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold tracking-widest" style={{ fontFamily: 'monospace', color: 'rgba(0,180,255,0.8)' }}>[OFFSET]</span>
          <span className="font-mono text-primary">{offsetLabel}</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            className="btn btn-sm btn-outline w-10"
            onClick={() => onOffset(offset - 1)}
            disabled={offset <= -100}
          >
            −
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={offset}
              className="range range-primary range-xs w-32"
              onChange={e => onOffset(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs w-32 px-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span>-100</span><span>0</span><span>+100</span>
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline w-10"
            onClick={() => onOffset(offset + 1)}
            disabled={offset >= 100}
          >
            +
          </button>
        </div>
        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
          음수: 판정 앞당김 · 양수: 판정 늦춤
        </p>
      </div>

      <button
        className="btn btn-sm w-full mt-2"
        style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontFamily: 'monospace' }}
        onClick={onBack}
      >
        ← BACK
      </button>
    </div>
  )
}

export function StartScreen({ onRanking, onStart, bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset }: StartScreenProps) {
  const [screen, setScreen] = useState<Screen>('home')

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
        {screen === 'home' && (
          <>
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-5xl font-black text-primary tracking-widest text-center" style={{ textShadow: '0 2px 24px rgba(0,180,255,0.5)' }}>
                PickerPicker
              </h1>
              <p className="text-xs tracking-widest text-center" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                2026 INTERCON
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button className="btn btn-primary btn-lg w-full text-lg" onClick={onStart}>시작</button>
              <button
                className="btn btn-lg w-full text-lg"
                style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={onRanking}
              >
                랭킹
              </button>
              <button
                className="btn btn-lg w-full text-lg"
                style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={() => setScreen('settings')}
              >
                설정
              </button>
              <button
                className="btn btn-lg w-full text-lg"
                style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={() => setScreen('credits')}
              >
                크레딧
              </button>
            </div>
          </>
        )}

        {screen === 'settings' && (
          <SettingsView
            bgmVolume={bgmVolume}
            sfxOn={sfxOn}
            offset={offset}
            onBgmVolume={onBgmVolume}
            onToggleSfx={onToggleSfx}
            onOffset={onOffset}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'credits' && (
          <CreditsView onBack={() => setScreen('home')} />
        )}
      </div>
    </div>
  )
}
