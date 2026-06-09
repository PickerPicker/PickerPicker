import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastState {
  toasts: ToastItem[]
  show: (message: string, type?: ToastType) => void
  remove: (id: number) => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, type = 'info') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    // 3초 후 자동 제거
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** 컴포넌트 밖(가드 등)에서 직접 호출하기 위한 헬퍼. */
export function showToast(message: string, type: ToastType = 'info') {
  useToastStore.getState().show(message, type)
}
