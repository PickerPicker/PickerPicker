import { useState } from 'react'
import { adminLogout, getAdminUsername } from '../../services/adminApi'
import { WordListPage } from './WordListPage'
import { WordStatsPage } from './WordStatsPage'
import { AdminListPage } from './AdminListPage'

type Page = 'words' | 'stats' | 'admins'

interface Props {
  onLogout: () => void
}

export function AdminDashboard({ onLogout }: Props) {
  const [page, setPage] = useState<Page>('words')
  const username = getAdminUsername()

  const handleLogout = async () => {
    await adminLogout()
    onLogout()
  }

  return (
    <div className="min-h-screen bg-base-200">
      <nav className="navbar bg-base-100 shadow">
        <div className="flex-1 px-4 font-bold text-lg">PickerPicker Admin</div>
        <div className="flex-none gap-2 px-4">
          <button className={`btn btn-sm ${page === 'words' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('words')}>단어 관리</button>
          <button className={`btn btn-sm ${page === 'stats' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('stats')}>통계</button>
          <button className={`btn btn-sm ${page === 'admins' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('admins')}>관리자</button>
          <span className="text-sm text-base-content/70 mx-2">{username}</span>
          <button className="btn btn-sm btn-outline" onClick={handleLogout}>로그아웃</button>
        </div>
      </nav>
      <main className="container mx-auto p-4">
        {page === 'words' && <WordListPage />}
        {page === 'stats' && <WordStatsPage />}
        {page === 'admins' && <AdminListPage />}
      </main>
    </div>
  )
}
