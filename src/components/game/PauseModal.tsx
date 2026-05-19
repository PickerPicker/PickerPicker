import { useState } from 'react'

interface PauseModalProps {
  onResume: () => void
  onGiveUp: () => void
  offset: number
  onOffset: (v: number) => void
  sfxOn: boolean
  onToggleSfx: () => void
}

export function PauseModal({
  onResume,
  onGiveUp,
  offset,
  onOffset,
  sfxOn,
  onToggleSfx,
}: PauseModalProps) {
  const [view, setView] = useState<'menu' | 'settings'>('menu')

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {view === 'menu' ? (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs px-4">
          <div className="text-4xl font-black tracking-widest text-white">⏸ PAUSED</div>

          <button
            className="btn btn-outline btn-wide text-white border-white/40 hover:bg-white/10"
            onClick={() => setView('settings')}
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
      ) : (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs px-4">
          <div className="text-2xl font-black tracking-widest text-white">⚙️ 설정</div>

          <div className="flex flex-col items-center gap-2 w-full">
            <span className="text-sm text-white/60">오프셋 조정</span>
            <div className="flex items-center gap-4">
              <button
                className="btn btn-sm btn-outline text-white border-white/30"
                onClick={() => onOffset(offset - 10)}
              >
                ◀
              </button>
              <span className="font-mono text-white w-20 text-center">
                {offset > 0 ? `+${offset}ms` : `${offset}ms`}
              </span>
              <button
                className="btn btn-sm btn-outline text-white border-white/30"
                onClick={() => onOffset(offset + 10)}
              >
                ▶
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 w-full">
            <span className="text-sm text-white/60">사운드</span>
            <button
              className={`btn btn-wide ${sfxOn ? 'btn-success' : 'btn-outline text-white/40'}`}
              onClick={onToggleSfx}
            >
              {sfxOn ? '🔊 ON' : '🔇 OFF'}
            </button>
          </div>

          <button
            className="btn btn-outline btn-wide text-white border-white/30 hover:bg-white/10"
            onClick={() => setView('menu')}
          >
            ← 돌아가기
          </button>
        </div>
      )}
    </div>
  )
}
