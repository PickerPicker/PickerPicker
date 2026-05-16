import { SoundButton } from './SoundButton'

interface CloseButtonProps {
  onClick: () => void
  label?: string
  className?: string
}

/**
 * 화면 우상단 공통 닫기/나가기 버튼.
 * 게임 방법(튜토리얼) · 모달 · 풀스크린 뷰 등에서 일관된 모양으로 사용한다.
 */
export function CloseButton({ onClick, label = '나가기', className = '' }: CloseButtonProps) {
  return (
    <SoundButton
      onClick={onClick}
      className={`btn btn-xs btn-ghost font-mono tracking-widest text-error border border-error/60 hover:bg-error/10 ${className}`}
    >
      ✕ {label} <kbd className="kbd kbd-xs ml-1">ESC</kbd>
    </SoundButton>
  )
}
