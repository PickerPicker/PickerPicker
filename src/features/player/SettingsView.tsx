import { SoundButton } from '../../components/common/SoundButton'

export function SettingsView({
  bgmVolume,
  sfxOn,
  offset,
  onBgmVolume,
  onToggleSfx,
  onOffset,
  onBack,
  statsToggle,
}: {
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
  onBack: () => void
  // 로그인 상태일 때만 전달 — 통계 공개/비공개 토글
  statsToggle?: { isPublic: boolean; onToggle: () => void }
}) {
  const offsetLabel = offset === 0 ? '0ms' : offset > 0 ? `+${offset}ms` : `${offset}ms`

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2
        className="text-2xl font-black tracking-widest text-primary text-center"
        style={{ textShadow: '0 0 12px rgba(0,180,255,0.7)' }}
      >
        ─ SETTINGS ─
      </h2>

      {/* BGM 볼륨 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold tracking-widest" style={{ color: 'rgba(0,180,255,0.8)' }}>
            [BGM]
          </span>
          <span className="font-mono text-primary">{bgmVolume}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={bgmVolume}
          className="range range-primary range-sm"
          onChange={(e) => onBgmVolume(Number(e.target.value))}
        />
        <div
          className="flex justify-between text-xs px-0.5"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* 효과음 */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span
          className="font-bold tracking-widest text-sm"
          style={{ color: 'rgba(0,180,255,0.8)' }}
        >
          [SFX]
        </span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={sfxOn}
          onChange={onToggleSfx}
        />
      </div>

      {/* 통계 공개 — 로그인 상태일 때만 표시 */}
      {statsToggle && (
        <div
          className="flex flex-col gap-1 px-4 py-3 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="font-bold tracking-widest text-sm"
              style={{ color: 'rgba(0,180,255,0.8)' }}
            >
              [STATS]
            </span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={statsToggle.isPublic}
              onChange={statsToggle.onToggle}
            />
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {statsToggle.isPublic
              ? '랭킹에서 다른 사람이 내 통계를 볼 수 있어요'
              : '끔 — 다른 사람이 내 통계를 볼 수 없어요'}
          </p>
        </div>
      )}

      {/* 판정 오프셋 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold tracking-widest" style={{ color: 'rgba(0,180,255,0.8)' }}>
            [OFFSET]
          </span>
          <span className="font-mono text-primary">{offsetLabel}</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <SoundButton
            className="btn btn-sm btn-outline w-10"
            onClick={() => onOffset(offset - 1)}
            disabled={offset <= -100}
          >
            −
          </SoundButton>
          <div className="flex flex-col items-center gap-0.5">
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={offset}
              className="range range-primary range-xs w-32"
              onChange={(e) => onOffset(Number(e.target.value))}
            />
            <div
              className="flex justify-between text-xs w-32 px-0.5"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <span>-100</span>
              <span>0</span>
              <span>+100</span>
            </div>
          </div>
          <SoundButton
            className="btn btn-sm btn-outline w-10"
            onClick={() => onOffset(offset + 1)}
            disabled={offset >= 100}
          >
            +
          </SoundButton>
        </div>
        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
          음수: 판정 앞당김 · 양수: 판정 늦춤
        </p>
      </div>

      <SoundButton
        className="btn btn-sm w-full mt-2"
        style={{
          background: 'rgba(60,80,120,0.45)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
        onClick={onBack}
      >
        ← BACK
      </SoundButton>
    </div>
  )
}
