interface SettingsModalProps {
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
  onClose: () => void
}

export function SettingsModal({ bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset, onClose }: SettingsModalProps) {
  const offsetLabel = offset === 0 ? '0ms' : offset > 0 ? `+${offset}ms` : `${offset}ms`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card bg-base-200 shadow-2xl w-80"
        onClick={e => e.stopPropagation()}
      >
        <div className="card-body gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg tracking-wide">게임 설정</h2>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>✕</button>
          </div>

          {/* BGM 볼륨 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">BGM 볼륨</span>
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
            <div className="flex justify-between text-xs text-base-content/40 px-0.5">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          {/* 효과음 */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">효과음</span>
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
              <span className="font-medium">판정 오프셋</span>
              <span className="font-mono text-primary w-16 text-right">{offsetLabel}</span>
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
                <div className="flex justify-between text-xs text-base-content/40 w-32 px-0.5">
                  <span>-100</span>
                  <span>0</span>
                  <span>+100</span>
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
            <p className="text-xs text-base-content/40 text-center">
              음수: 판정 앞당김 · 양수: 판정 늦춤
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
