import type { ButtonHTMLAttributes } from 'react'

export function SilentButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} />
}
