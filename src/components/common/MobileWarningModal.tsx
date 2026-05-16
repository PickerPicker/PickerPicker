import { SoundButton } from './SoundButton'

interface MobileWarningModalProps {
  onClose: () => void
}

export function MobileWarningModal({ onClose }: MobileWarningModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="flex flex-col items-center gap-5 px-7 py-8 rounded-3xl w-full max-w-sm"
        style={{
          background: 'rgba(10,15,30,0.92)',
          border: '1px solid rgba(0,180,255,0.25)',
          boxShadow: '0 0 40px rgba(0,180,255,0.15)',
        }}
      >
        {/* 아이콘 */}
        <div style={{ filter: 'drop-shadow(0 0 16px rgba(0,180,255,0.7))' }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke="#00b4ff" strokeWidth="1.5" fill="rgba(0,180,255,0.08)"/>
            <path d="M8 21h8" stroke="#00b4ff" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M12 17v4" stroke="#00b4ff" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="5" y="6" width="14" height="8" rx="1" fill="rgba(0,180,255,0.12)" stroke="rgba(0,180,255,0.3)" strokeWidth="0.5"/>
          </svg>
        </div>

        {/* 타이틀 */}
        <h2
          className="text-xl font-black tracking-widest text-center"
          style={{
            color: '#00b4ff',
            textShadow: '0 0 16px rgba(0,180,255,0.6)',
          }}
        >
          PC 플레이 권장
        </h2>

        {/* 설명 */}
        <div className="flex flex-col items-center gap-3 text-sm text-center tracking-wide">
          <p style={{ color: 'rgba(255,255,255,0.65)' }}>
            PickerPicker는{' '}
            <span style={{ color: '#00b4ff', fontWeight: 700 }}>키보드 조작 기반</span>
            <br />
            리듬 게임입니다.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)' }}>
            안정적인 플레이를 위해{' '}
            <span style={{ color: '#00b4ff', fontWeight: 700 }}>PC 환경</span>을 권장합니다.
          </p>
        </div>

        {/* 구분선 */}
        <div
          className="w-full h-px"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />

        {/* 계속하기 버튼 */}
        <SoundButton
          className="btn btn-sm w-full"
          style={{
            background: 'rgba(0,180,255,0.15)',
            color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(0,180,255,0.3)',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
          }}
          onClick={onClose}
        >
          확인
        </SoundButton>
      </div>
    </div>
  )
}
