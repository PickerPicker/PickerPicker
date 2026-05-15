import { useState } from 'react'

type PinMode = 'login' | 'create' | 'confirm'

interface PinModalProps {
  nickname: string
  mode: PinMode
  /** 로그인 성공 또는 신규 PIN 확인 완료 시 호출 */
  onSuccess: (pin: string) => void
  /** 닉네임 다시 입력 */
  onBack: () => void
  /** PIN 검증 함수 (login 모드에서만 사용) */
  verifyPin?: (pin: string) => Promise<boolean>
}

export function PinModal({ nickname, mode, onSuccess, onBack, verifyPin }: PinModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const title = mode === 'login'
    ? `${nickname}님, PIN 입력`
    : mode === 'create'
    ? 'PIN 설정 (4자리 숫자)'
    : 'PIN 확인 (다시 입력)'

  const handleInput = (val: string) => {
    // 숫자만, 최대 4자리
    const digits = val.replace(/\D/g, '').slice(0, 4)
    setPin(digits)
    setError('')
  }

  const handleConfirm = async () => {
    if (pin.length !== 4) {
      setError('4자리 숫자를 입력하세요')
      return
    }

    if (mode === 'login') {
      setLoading(true)
      const ok = await verifyPin?.(pin)
      setLoading(false)
      if (!ok) {
        setError('PIN이 틀렸습니다')
        setPin('')
        return
      }
    }

    onSuccess(pin)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box flex flex-col gap-4">
        <h3 className="font-bold text-lg">{title}</h3>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="● ● ● ●"
          className="input input-bordered w-full text-center tracking-widest text-2xl"
          value={pin}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        {error && <p className="text-error text-sm">{error}</p>}
        <div className="modal-action justify-between">
          <button className="btn btn-ghost" onClick={onBack} disabled={loading}>
            닉네임 변경
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={pin.length !== 4 || loading}
          >
            {loading ? <span className="loading loading-spinner loading-sm" /> : '확인'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
