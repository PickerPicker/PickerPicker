import React, { useEffect, useRef, useState, useCallback } from 'react'
import { getRanking, type RankingEntry } from '../services/playerService'
import rankingBg from '../assets/ranking-bg.png'
import { SoundButton } from './common/SoundButton'
import { HallOfFameTab } from './HallOfFameTab'
import { PublicStatsModal } from './PublicStatsModal'

type RankingTab = 'ranking' | 'hall'

const PAGE_SIZE = 20

interface RankingScreenProps {
  nickname: string
  onBack: () => void
}

export function RankingScreen({ nickname, onBack }: RankingScreenProps) {
  const [activeTab, setActiveTab] = useState<RankingTab>('ranking')
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showSticky, setShowSticky] = useState(false)
  const [myEntry, setMyEntry] = useState<RankingEntry | null>(null)
  // 랭킹 행 클릭 시 공개 통계 모달에 띄울 닉네임
  const [selectedNickname, setSelectedNickname] = useState<string | null>(null)

  const offsetRef = useRef(0)
  const myRowRef = useRef<HTMLTableRowElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const myRowObserverRef = useRef<IntersectionObserver | null>(null)

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const data = await getRanking(PAGE_SIZE, offsetRef.current)
    if (data.length < PAGE_SIZE) setHasMore(false)
    if (data.length > 0) {
      setRanking(prev => {
        const next = [...prev, ...data]
        // 내 항목 찾기
        if (nickname) {
          const found = next.find(e => e.nickname === nickname)
          if (found) setMyEntry(found)
        }
        return next
      })
      offsetRef.current += data.length
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }, [loadingMore, hasMore, nickname])

  // 초기 로드
  useEffect(() => {
    getRanking(PAGE_SIZE, 0).then(data => {
      setRanking(data)
      offsetRef.current = data.length
      if (data.length < PAGE_SIZE) setHasMore(false)
      if (nickname) {
        const found = data.find(e => e.nickname === nickname)
        if (found) setMyEntry(found)
      }
      setLoading(false)
    })
  }, [nickname])

  // 무한스크롤 sentinel observer
  useEffect(() => {
    if (loading) return
    observerRef.current?.disconnect()
    if (!sentinelRef.current || !hasMore) return

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore()
      },
      { threshold: 0.1 }
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [loading, hasMore, loadMore])

  // 내 행 IntersectionObserver — sticky 표시 제어
  useEffect(() => {
    if (!nickname || !myRowRef.current) return
    myRowObserverRef.current?.disconnect()

    myRowObserverRef.current = new IntersectionObserver(
      entries => {
        // 내 행이 뷰포트에 있으면 sticky 숨김
        setShowSticky(!entries[0].isIntersecting)
      },
      { threshold: 0.1 }
    )
    myRowObserverRef.current.observe(myRowRef.current)
    return () => myRowObserverRef.current?.disconnect()
  }, [nickname, myEntry])

  // 내 항목이 아직 로드 안 됐을 때 → sticky 표시 (로그인 상태)
  useEffect(() => {
    if (!nickname) return
    if (!myEntry) setShowSticky(true)
  }, [nickname, myEntry])

  const rankBadgeStyle = (rank: number): React.CSSProperties => {
    if (rank === 1) return { color: '#fbbf24', fontWeight: 'bold' }
    if (rank === 2) return { color: '#94a3b8', fontWeight: 'bold' }
    if (rank === 3) return { color: '#cd7c3f', fontWeight: 'bold' }
    return { color: '#6b7280' }
  }

  const isMyRow = (entry: RankingEntry) => nickname && entry.nickname === nickname

  return (
    <div
      className="flex flex-col items-center h-screen gap-6 p-8"
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
        <h1
          className="text-3xl font-black tracking-widest mx-auto pr-16"
          style={{ color: '#e879f9', textShadow: '0 0 16px #a21caf, 0 2px 4px #000' }}
        >
          {activeTab === 'ranking' ? 'RANKING' : '명예의 전당'}
        </h1>
      </div>

      {/* 탭 */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {(['ranking', 'hall'] as const).map(tab => (
          <SoundButton
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 28px',
              fontSize: 13,
              fontWeight: 'bold',
              letterSpacing: 2,
              cursor: 'pointer',
              border: 'none',
              color: activeTab === tab ? '#e879f9' : '#9ca3af',
              background: activeTab === tab ? 'rgba(168,85,247,0.25)' : 'rgba(0,0,20,0.6)',
              textShadow: activeTab === tab ? '0 0 10px #a21caf' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {tab === 'ranking' ? 'RANKING' : 'HALL OF FAME'}
          </SoundButton>
        ))}
      </div>

      {/* 본문 */}
      {activeTab === 'hall' ? (
        <HallOfFameTab nickname={nickname} />
      ) : loading ? (
        <div className="flex items-center justify-center flex-1">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-base-content/40 text-sm">아직 랭킹 데이터가 없습니다</p>
        </div>
      ) : (
        <div
          className="w-full max-w-2xl rounded-xl flex flex-col flex-1 min-h-0"
          style={{ background: 'rgba(0, 0, 20, 0.72)', backdropFilter: 'blur(2px)' }}
        >
          {/* 스크롤 테이블 영역 */}
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
            <table className="table w-full" style={{ '--tw-bg-opacity': '0' } as React.CSSProperties}>
              <thead>
                <tr style={{ color: '#c084fc', background: 'rgba(0,0,20,0.9)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ background: 'transparent' }}>순위</th>
                  <th style={{ background: 'transparent' }}>닉네임</th>
                  <th style={{ background: 'transparent' }}>점수</th>
                  <th style={{ background: 'transparent' }}>스테이지</th>
                  <th style={{ background: 'transparent' }}>콤보</th>
                  <th style={{ background: 'transparent' }}>플레이</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((entry) => {
                  const mine = isMyRow(entry)
                  return (
                    <tr
                      key={entry.rank}
                      ref={mine ? myRowRef : undefined}
                      onClick={() => setSelectedNickname(entry.nickname)}
                      style={{
                        background: mine ? 'rgba(168,85,247,0.18)' : 'transparent',
                        borderColor: mine ? 'rgba(168,85,247,0.4)' : 'rgba(192, 132, 252, 0.15)',
                        borderLeft: mine ? '3px solid #e879f9' : undefined,
                        color: mine ? '#f0abfc' : '#e2e8f0',
                        fontWeight: mine ? 600 : undefined,
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ background: 'transparent', ...rankBadgeStyle(entry.rank) }}>
                        {mine && '★ '}{entry.rank}위
                      </td>
                      <td style={{ background: 'transparent', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.nickname}</td>
                      <td style={{ background: 'transparent' }}>{entry.best_score.toLocaleString()}</td>
                      <td style={{ background: 'transparent' }}>STAGE {entry.best_stage}</td>
                      <td style={{ background: 'transparent' }}>{entry.best_combo}콤보</td>
                      <td style={{ background: 'transparent' }}>{entry.play_count}회</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* 무한스크롤 sentinel */}
            <div ref={sentinelRef} style={{ height: 1 }} />

            {loadingMore && (
              <div className="flex justify-center py-3">
                <span className="loading loading-spinner loading-sm text-primary" />
              </div>
            )}

            {!hasMore && ranking.length > 0 && (
              <p className="text-center py-3 text-xs" style={{ color: '#4b5563' }}>
                — 전체 {ranking.length}명 —
              </p>
            )}
          </div>

          {/* sticky 내 행 — 내 행이 뷰포트 밖일 때만 표시 */}
          {nickname && myEntry && showSticky && (
            <div style={{ borderTop: '2px solid rgba(168,85,247,0.5)' }}>
              <table className="table w-full" style={{ '--tw-bg-opacity': '0' } as React.CSSProperties}>
                <tbody>
                  <tr
                    onClick={() => setSelectedNickname(myEntry.nickname)}
                    style={{ background: 'rgba(168,85,247,0.15)', color: '#f0abfc', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <td style={{ background: 'transparent', color: '#e879f9', fontWeight: 'bold' }}>
                      ★ {myEntry.rank}위
                    </td>
                    <td style={{ background: 'transparent', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myEntry.nickname}</td>
                    <td style={{ background: 'transparent' }}>{myEntry.best_score.toLocaleString()}</td>
                    <td style={{ background: 'transparent' }}>STAGE {myEntry.best_stage}</td>
                    <td style={{ background: 'transparent' }}>{myEntry.best_combo}콤보</td>
                    <td style={{ background: 'transparent' }}>{myEntry.play_count}회</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 로그인 상태인데 아직 랭킹에 없는 경우 */}
          {nickname && !myEntry && !hasMore && (
            <div
              style={{
                borderTop: '2px solid rgba(168,85,247,0.3)',
                padding: '10px 16px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '12px',
              }}
            >
              ★ {nickname} — 아직 랭킹에 없습니다
            </div>
          )}
        </div>
      )}

      {/* 랭킹 행 클릭 → 공개 통계 모달 */}
      {selectedNickname && (
        <PublicStatsModal
          nickname={selectedNickname}
          myNickname={nickname || undefined}
          onClose={() => setSelectedNickname(null)}
        />
      )}
    </div>
  )
}
