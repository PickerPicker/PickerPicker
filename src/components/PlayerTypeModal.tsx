import { SoundButton } from './common/SoundButton'

interface PlayerTypeModalProps {
  nickname: string
  onExisting: () => void
  onNew: () => void
  onClose: () => void
}

export function PlayerTypeModal({ nickname, onExisting, onNew, onClose }: PlayerTypeModalProps) {
  return (
    <dialog className="modal modal-open">
      <div className="modal-box flex flex-col gap-6">
        <p className="text-base-content leading-relaxed">
          이미 존재하는 닉네임입니다.<br />
          <span className="text-primary font-bold">{nickname}</span>으로 계속 플레이하시겠습니까?
        </p>
        <div className="flex gap-3 justify-end">
          <SoundButton className="btn btn-secondary" onClick={onExisting}>
            기존 플레이어로 플레이
          </SoundButton>
          <SoundButton className="btn btn-primary" onClick={onNew}>
            신규 플레이어로 플레이
          </SoundButton>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
