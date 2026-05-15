import { useEffect, useState } from 'react'
import { getRanking, type RankingEntry } from '../services/playerService'

interface RankingScreenProps {
  onBack: () => void
}

export function RankingScreen({ onBack }: RankingScreenProps) {
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRanking(20).then((data) => {
      setRanking(data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex flex-col items-center min-h-screen gap-6 p-8">
      {/* 헤더 */}
      <div className="flex items-center w-full max-w-2xl">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← 돌아가기
        </button>
        <h1 className="text-3xl font-black text-primary tracking-widest mx-auto pr-16">
          RANKING
        </h1>
      </div>

      {/* 본문 */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-base-content/40 text-sm">아직 랭킹 데이터가 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto w-full max-w-2xl">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>순위</th>
                <th>닉네임</th>
                <th>점수</th>
                <th>스테이지</th>
                <th>콤보</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry) => (
                <tr key={entry.rank}>
                  <td className="font-bold">{entry.rank}위</td>
                  <td>{entry.nickname}</td>
                  {/* 점수 콤마 포맷 */}
                  <td>{entry.best_score.toLocaleString()}</td>
                  <td>STAGE {entry.best_stage}</td>
                  <td>{entry.best_combo}콤보</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
