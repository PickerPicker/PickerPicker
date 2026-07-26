import { useState } from 'react'
import { SoundButton } from '../../components/common/SoundButton'

export function PinView({
  mode,
  nickname,
  onConfirm,
  onBack,
  error,
}: {
  mode: 'login' | 'create' | 'confirm'
  nickname: string
  onConfirm: (pin: string) => Promise<void>
  onBack: () => void
  error: string
}) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const title =
    mode === 'login'
      ? `${nickname}님, PIN 입력`
      : mode === 'create'
        ? 'PIN 설정 (4자리 숫자)'
        : 'PIN 확인 (다시 입력)'

  const handleConfirm = async () => {
    if (pin.length !== 4) return
    setLoading(true)
    await onConfirm(pin)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2
        className="text-xl font-black tracking-widest text-center"
        style={{ color: 'rgba(0,180,255,0.9)' }}
      >
        {title}
      </h2>

      {/* 신규 PIN 설정 시 가이드라인 (create, confirm 공통) */}
      {(mode === 'create' || mode === 'confirm') && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'rgba(255,180,0,0.10)',
            border: '1px solid rgba(255,180,0,0.4)',
            color: 'rgba(255,210,80,0.95)',
          }}
        >
          {mode === 'create'
            ? '⚠️ 이 PIN은 다음 로그인 시 필요합니다. 꼭 기억해 두세요!'
            : '⚠️ PIN을 다시 한번 입력하세요. 잊어버리면 재설정이 불가합니다.'}
        </div>
      )}

      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder="● ● ● ●"
        className="input input-bordered w-full text-center tracking-widest text-2xl"
        value={pin}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(digits)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleConfirm()
        }}
        autoFocus
      />

      {error && <p className="text-error text-sm text-center">{error}</p>}

      <div className="flex flex-col gap-2">
        <SoundButton
          className="btn btn-primary w-full"
          onClick={handleConfirm}
          disabled={pin.length !== 4 || loading}
        >
          {loading ? <span className="loading loading-spinner loading-sm" /> : '확인'}
        </SoundButton>
        <SoundButton
          className="btn btn-sm w-full"
          style={{
            background: 'rgba(60,80,120,0.45)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
          onClick={onBack}
          disabled={loading}
        >
          ← BACK
        </SoundButton>
      </div>
    </div>
  )
}
