import { useState } from 'react'

interface NicknameModalProps {
  onConfirm: (nickname: string) => void
  onClose: () => void
}

export function NicknameModal({ onConfirm, onClose }: NicknameModalProps) {
  const [value, setValue] = useState('')

  const handleConfirm = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box flex flex-col gap-4">
        <h3 className="font-bold text-lg">닉네임</h3>
        <input
          type="text"
          placeholder="닉네임을 입력하세요"
          className="input input-bordered w-full"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="modal-action">
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!value.trim()}
          >
            확인
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
