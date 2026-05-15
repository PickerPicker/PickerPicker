interface AudioSettingsModalProps {
  bgmVolume: number        // 0~100
  sfxOn: boolean
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onClose: () => void
}

export function AudioSettingsModal({ bgmVolume, sfxOn, onBgmVolume, onToggleSfx, onClose }: AudioSettingsModalProps) {
  return (
    // 오버레이
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 모달 패널 — 클릭 전파 차단 */}
      <div
        className="card bg-base-200 shadow-2xl w-80"
        onClick={e => e.stopPropagation()}
      >
        <div className="card-body gap-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg tracking-wide">음향 설정</h2>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>✕</button>
          </div>

          {/* BGM 볼륨 슬라이더 */}
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

          {/* 효과음 ON/OFF */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">효과음</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={sfxOn}
              onChange={onToggleSfx}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
