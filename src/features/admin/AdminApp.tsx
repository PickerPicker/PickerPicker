import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLoginScreen } from './AdminLoginScreen'
import { AdminDashboard } from './AdminDashboard'

const ADMIN_TOKEN_KEY = 'pickerpicker_admin_token'

/**
 * 어드민 앱 (`/admin`, `/admin/login`).
 *
 * 기존 App.tsx의 isAdminRoute/adminAuthed 분기 로직을 이사했다.
 * 세션 토큰이 있으면 대시보드를, 없으면 로그인 화면을 보여준다.
 */
export function AdminApp() {
  const navigate = useNavigate()

  const [adminAuthed, setAdminAuthed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY))
  })

  if (adminAuthed) {
    return (
      <AdminDashboard
        onLogout={() => {
          setAdminAuthed(false)
          navigate('/admin', { replace: true })
        }}
      />
    )
  }

  return (
    <AdminLoginScreen onLoginSuccess={() => setAdminAuthed(true)} onCancel={() => navigate('/')} />
  )
}
