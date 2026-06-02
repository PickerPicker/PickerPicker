import { useState } from 'react'
import { adminLogin } from '../../services/adminApi'

interface Props {
  onLoginSuccess: () => void
  onCancel: () => void
}

export function AdminLoginScreen({ onLoginSuccess, onCancel }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const ok = await adminLogin(username, password)
      if (ok) onLoginSuccess()
      else setError('아이디 또는 비밀번호가 잘못되었습니다.')
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-96 bg-base-100 shadow-xl">
        <form onSubmit={handleSubmit} className="card-body">
          <h2 className="card-title">Admin 로그인</h2>
          <input
            type="text"
            placeholder="username"
            className="input input-bordered"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="password"
            className="input input-bordered"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-error text-sm">{error}</p>}
          <div className="card-actions justify-end mt-4">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !username || !password}>
              {loading ? '...' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
