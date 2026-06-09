import { useToastStore, type ToastType } from '../../store/toastStore'

const TYPE_CLASS: Record<ToastType, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
}

/**
 * 전역 토스트 컨테이너 — 앱 최상단에 한 번만 마운트한다.
 * daisyUI `toast` + `alert`. 표시는 useToastStore.show() / showToast()로 트리거.
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)

  if (toasts.length === 0) return null

  return (
    <div className="toast toast-top toast-center z-[100]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`alert ${TYPE_CLASS[t.type]} cursor-pointer shadow-lg`}
          onClick={() => remove(t.id)}
        >
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
