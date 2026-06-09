interface WelcomeModalProps {
  onClose: () => void
}

const KEYS = ['A', 'S', 'D', 'F', 'J', 'K', 'L', ';']

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 cursor-pointer"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-6 px-8 py-9 rounded-3xl w-full max-w-sm"
        style={{
          background: 'rgba(10,15,30,0.95)',
          border: '1px solid rgba(0,180,255,0.25)',
          boxShadow: '0 0 60px rgba(0,180,255,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 타이틀 */}
        <div className="flex flex-col items-center gap-1">
          <h2
            className="text-2xl font-black tracking-widest"
            style={{ color: '#00b4ff', textShadow: '0 0 20px rgba(0,180,255,0.6)' }}
          >
            PickerPicker
          </h2>
          <p className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
            KEYBOARD RHYTHM GAME
          </p>
        </div>

        <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* 키보드 조작법 */}
        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-xs font-bold tracking-widest" style={{ color: 'rgba(0,180,255,0.7)' }}>
            [ 게임 키 ]
          </p>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center justify-center rounded-lg text-sm font-black"
                style={{
                  width: 36,
                  height: 36,
                  background: 'rgba(0,180,255,0.1)',
                  border: '1px solid rgba(0,180,255,0.35)',
                  color: '#00b4ff',
                  boxShadow: '0 2px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                {key}
              </div>
            ))}
          </div>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
            화면에 표시된 키를 박자에 맞춰 입력하세요
          </p>
        </div>

        <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* PC 권장 안내 */}
        <p
          className="text-xs text-center tracking-wide"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          🖥️ 키보드 조작 특성상{' '}
          <span style={{ color: 'rgba(0,180,255,0.8)', fontWeight: 700 }}>PC 환경</span>을
          권장합니다
        </p>

        {/* 클릭 유도 */}
        <button
          className="btn btn-primary w-full font-black tracking-widest"
          style={{ letterSpacing: '0.15em' }}
          onClick={onClose}
        >
          클릭하여 시작
        </button>
      </div>
    </div>
  )
}
