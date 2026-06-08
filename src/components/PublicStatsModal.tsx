import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { SoundButton } from './common/SoundButton'
import { getPublicStats, type PublicStatsResponse } from '../services/statsService'

interface PublicStatsModalProps {
  nickname: string
  /** 현재 로그인한 본인 닉네임 — 본인은 비공개여도 요약을 볼 수 있다 */
  myNickname?: string
  onClose: () => void
}

type Status = 'loading' | 'public' | 'private' | 'error'

export function PublicStatsModal({ nickname, myNickname, onClose }: PublicStatsModalProps) {
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<PublicStatsResponse | null>(null)

  const isMe = !!myNickname && myNickname === nickname

  useEffect(() => {
    let alive = true
    getPublicStats(nickname).then(res => {
      if (!alive) return
      if (!res) {
        setStatus('error')
        return
      }
      setData(res)
      // 본인이면 비공개여도 요약 표시. 단 public-stats는 비공개 시 요약을 안 주므로
      // 본인 비공개일 때는 'public' 레이아웃에 안내 문구만 덧붙인다.
      setStatus(res.is_public || isMe ? 'public' : 'private')
    })
    return () => {
      alive = false
    }
  }, [nickname, isMe])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl w-80 max-w-[90vw]"
        style={{ background: 'rgba(0, 0, 20, 0.92)', border: '1px solid rgba(168,85,247,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 flex flex-col gap-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h2
              className="font-black tracking-wide text-lg"
              style={{ color: '#e879f9', textShadow: '0 0 12px #a21caf' }}
            >
              {nickname}
            </h2>
            <SoundButton
              className="btn btn-ghost btn-sm btn-circle"
              style={{ color: '#c084fc' }}
              onClick={onClose}
            >
              ✕
            </SoundButton>
          </div>

          {status === 'loading' && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg" style={{ color: '#e879f9' }} />
            </div>
          )}

          {status === 'error' && (
            <p className="text-center text-sm py-6" style={{ color: '#9ca3af' }}>
              통계를 불러올 수 없습니다.
            </p>
          )}

          {status === 'private' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Lock size={32} style={{ color: '#6b7280' }} />
              <p className="text-center text-sm" style={{ color: '#9ca3af' }}>
                이 사용자는 통계를 비공개했습니다
              </p>
            </div>
          )}

          {status === 'public' && data && (
            <>
              {/* 본인 비공개 안내 */}
              {isMe && !data.is_public && (
                <p
                  className="text-xs text-center rounded py-1"
                  style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}
                >
                  내 통계 (비공개 중 — 나만 볼 수 있어요)
                </p>
              )}

              {/* motto */}
              {data.motto && (
                <p
                  className="text-sm italic text-center px-2"
                  style={{ color: '#f0abfc' }}
                >
                  &ldquo;{data.motto}&rdquo;
                </p>
              )}

              {/* 요약 그리드 */}
              <div className="grid grid-cols-2 gap-2">
                <StatCell label="최고 점수" value={(data.totals?.best_score ?? 0).toLocaleString()} />
                <StatCell label="최고 스테이지" value={`STAGE ${data.totals?.best_stage ?? 0}`} />
                <StatCell label="최고 콤보" value={`${data.totals?.best_combo ?? 0}콤보`} />
                <StatCell label="플레이 횟수" value={`${data.totals?.play_count ?? 0}회`} />
                <StatCell label="평균 점수" value={(data.averages?.avg_score ?? 0).toLocaleString()} />
                <StatCell label="상위" value={`${data.percentile?.rank_top_pct ?? 0}%`} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col rounded p-2"
      style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
    >
      <span className="text-xs" style={{ color: '#9ca3af' }}>{label}</span>
      <span className="font-bold" style={{ color: '#f0abfc' }}>{value}</span>
    </div>
  )
}
