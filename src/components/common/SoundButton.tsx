import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { useAudioContext } from '../../contexts/AudioContext'

export type SfxKind = 'button'

interface SoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  sfx?: SfxKind
}

export function SoundButton({ sfx = 'button', onClick, ...rest }: SoundButtonProps) {
  const audio = useAudioContext()

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (sfx === 'button') audio.playButtonSfx()
    onClick?.(e)
  }

  return <button {...rest} onClick={handleClick} />
}
