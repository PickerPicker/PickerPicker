import React, { useEffect, useState } from 'react'
import { getRanking, type RankingEntry } from '../services/playerService'
import rankingBg from '../assets/ranking-bg.png'
import { SoundButton } from './common/SoundButton'

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
    <div
      className="flex flex-col items-center min-h-screen gap-6 p-8"
      style={{
        backgroundImage: `url(${rankingBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center w-full max-w-2xl">
        <SoundButton className="btn btn-ghost btn-sm" style={{ color: '#c084fc' }} onClick={onBack}>
          ← 돌아가기
        </SoundButton>
        {/* 픽셀아트 배경 위 가독성용 텍스트 쉐도우 */}
        <h1
          className="text-3xl font-black tracking-widest mx-auto pr-16"
          style={{ color: '#e879f9', textShadow: '0 0 16px #a21caf, 0 2px 4px #000' }}
        >
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
        <div className="overflow-x-auto w-full max-w-2xl rounded-xl"
          style={{ background: 'rgba(0, 0, 20, 0.72)', backdropFilter: 'blur(2px)' }}
        >
          <table className="table w-full" style={{ '--tw-bg-opacity': '0' } as React.CSSProperties}>
            <thead>
              <tr style={{ color: '#c084fc', background: 'transparent' }}>
                <th style={{ background: 'transparent' }}>순위</th>
                <th style={{ background: 'transparent' }}>닉네임</th>
                <th style={{ background: 'transparent' }}>점수</th>
                <th style={{ background: 'transparent' }}>스테이지</th>
                <th style={{ background: 'transparent' }}>콤보</th>
                <th style={{ background: 'transparent' }}>플레이</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry) => (
                <tr key={entry.rank}
                  style={{
                    background: 'transparent',
                    borderColor: 'rgba(192, 132, 252, 0.15)',
                    color: '#e2e8f0',
                  }}
                >
                  <td style={{ background: 'transparent' }} className="font-bold">{entry.rank}위</td>
                  <td style={{ background: 'transparent' }}>{entry.nickname}</td>
                  {/* 점수 콤마 포맷 */}
                  <td style={{ background: 'transparent' }}>{entry.best_score.toLocaleString()}</td>
                  <td style={{ background: 'transparent' }}>STAGE {entry.best_stage}</td>
                  <td style={{ background: 'transparent' }}>{entry.best_combo}콤보</td>
                  <td style={{ background: 'transparent' }}>{entry.play_count}회</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
