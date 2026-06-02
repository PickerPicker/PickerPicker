import { useEffect, useState } from 'react'
import type { AdminUser } from '../../types/admin'
import { listAdmins, createAdmin } from '../../services/adminApi'

export function AdminListPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const data = await listAdmins()
      setAdmins(data)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => { refresh() }, [])

  const handleCreate = async () => {
    setError('')
    if (newPassword.length < 8) {
      setError('비밀번호 8자 이상')
      return
    }
    setCreating(true)
    try {
      await createAdmin(newUsername, newPassword)
      setNewUsername('')
      setNewPassword('')
      await refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">관리자 목록</h2>
      <table className="table table-zebra w-full mb-4">
        <thead><tr><th>ID</th><th>username</th><th>생성일</th><th>등록자</th></tr></thead>
        <tbody>
          {admins.map(a => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.username}</td>
              <td>{new Date(a.created_at).toLocaleString()}</td>
              <td>{a.created_by ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="card bg-base-100 shadow p-4">
        <h3 className="font-bold mb-2">신규 관리자 등록</h3>
        <div className="flex gap-2 flex-wrap">
          <input className="input input-bordered input-sm" placeholder="username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
          <input type="password" className="input input-bordered input-sm" placeholder="password (8자+)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={!newUsername || !newPassword || creating} onClick={handleCreate}>등록</button>
        </div>
        {error && <p className="text-error text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
