import { useState } from 'react'
import { SoundButton } from '../../components/common/SoundButton'

export function NicknameView({
  onConfirm,
  onBack,
}: {
  onConfirm: (name: string) => Promise<void>
  onBack: () => void
}) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setLoading(true)
    await onConfirm(trimmed)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2
        className="text-xl font-black tracking-widest text-center"
        style={{ color: 'rgba(0,180,255,0.9)' }}
      >
        닉네임 입력
      </h2>
      <input
        type="text"
        placeholder="닉네임을 입력하세요"
        className="input input-bordered w-full"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleConfirm()
        }}
        autoFocus
        maxLength={20}
      />
      <div className="flex flex-col gap-2">
        <SoundButton
          className="btn btn-primary w-full"
          onClick={handleConfirm}
          disabled={!value.trim() || loading}
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
