import { useEffect, useState } from 'react'
import type { WordGlobalStat, AdminOverview } from '../../types/admin'
import { globalWordStats, adminOverview } from '../../services/adminApi'

export function WordStatsPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [stats, setStats] = useState<WordGlobalStat[]>([])
  const [sort, setSort] = useState<'exposure_desc' | 'accuracy_asc' | 'accuracy_desc'>('exposure_desc')
  const [error, setError] = useState('')

  useEffect(() => {
    adminOverview().then(setOverview).catch(e => setError(String(e)))
  }, [])

  useEffect(() => {
    globalWordStats(sort).then(setStats).catch(e => setError(String(e)))
  }, [sort])

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">글로벌 통계</h2>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {overview && (
        <div className="stats shadow mb-4 w-full">
          <div className="stat"><div className="stat-title">총 플레이어</div><div className="stat-value">{overview.total_players}</div></div>
          <div className="stat"><div className="stat-title">총 게임 세션</div><div className="stat-value">{overview.total_sessions}</div></div>
          <div className="stat"><div className="stat-title">활성 단어</div><div className="stat-value">{overview.active_word_count}</div></div>
          <div className="stat"><div className="stat-title">평균 점수</div><div className="stat-value">{overview.avg_score.toFixed(0)}</div></div>
        </div>
      )}
      <div className="flex gap-2 mb-2">
        <select className="select select-bordered select-sm" value={sort} onChange={e => setSort(e.target.value as 'exposure_desc' | 'accuracy_asc' | 'accuracy_desc')}>
          <option value="exposure_desc">노출 많은 순</option>
          <option value="accuracy_asc">정확도 낮은 순 (어려움)</option>
          <option value="accuracy_desc">정확도 높은 순 (쉬움)</option>
        </select>
      </div>
      <table className="table table-zebra w-full">
        <thead><tr><th>단어</th><th>난이도</th><th>노출</th><th>정확도</th><th>상태</th></tr></thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.word_id}>
              <td className="font-bold">{s.word}</td>
              <td>{s.difficulty_level}</td>
              <td>{s.total_exposure}</td>
              <td>{(s.accuracy * 100).toFixed(1)}%</td>
              <td>{s.is_active ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
