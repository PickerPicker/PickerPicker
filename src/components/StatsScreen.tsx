import { useEffect, useState } from 'react'
import { CloseButton } from './common/CloseButton'
import { SoundButton } from './common/SoundButton'
import {
  getMyStats,
  getGlobalStats,
  getMySessions,
  type MyStatsResponse,
  type GlobalStatsResponse,
  type DailyEntry,
} from '../services/statsService'
import { login, getStoredToken, getStoredTokenNickname } from '../services/authService'
import { verifyPin } from '../services/playerService'

interface StatsScreenProps {
  nickname: string
  onBack: () => void
}

type Status = 'init' | 'need-login' | 'loading' | 'ready' | 'error'

export function StatsScreen({ nickname, onBack }: StatsScreenProps) {
  const [status, setStatus] = useState<Status>('init')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [my, setMy] = useState<MyStatsResponse | null>(null)
  const [global, setGlobal] = useState<GlobalStatsResponse | null>(null)
  const [daily, setDaily] = useState<DailyEntry[]>([])

  useEffect(() => {
    const token = getStoredToken()
    const tokenNick = getStoredTokenNickname()
    if (token && tokenNick === nickname) {
      void loadAll()
    } else {
      setStatus('need-login')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nickname])

  async function loadAll() {
    setStatus('loading')
    try {
      const [myRes, globalRes, dailyRes] = await Promise.all([
        getMyStats(nickname),
        getGlobalStats(),
        getMySessions(nickname, 30),
      ])
      if (!myRes) {
        setStatus('need-login')
        return
      }
      setMy(myRes)
      setGlobal(globalRes)
      setDaily(dailyRes ?? [])
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  async function handleLogin() {
    setPinError(null)
    if (!/^\d{4}$/.test(pin)) {
      setPinError('4자리 숫자를 입력하세요')
      return
    }
    const ok = await verifyPin(nickname, pin)
    if (!ok) {
      setPinError('PIN이 올바르지 않습니다')
      return
    }
    const loginRes = await login(nickname, pin)
    if (!loginRes) {
      setPinError('로그인에 실패했습니다')
      return
    }
    setPin('')
    await loadAll()
  }

  if (status === 'need-login') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 bg-base-100">
        <CloseButton onClick={onBack} />
        <h2 className="text-2xl font-bold">내 통계 보기</h2>
        <p className="text-sm text-base-content/60">PIN을 입력해 본인 인증을 진행하세요.</p>
        <input
          type="password"
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="input input-bordered w-40 text-center text-2xl tracking-widest"
          autoFocus
        />
        {pinError && <span className="text-error text-sm">{pinError}</span>}
        <SoundButton className="btn btn-primary w-40" onClick={handleLogin}>
          확인
        </SoundButton>
      </div>
    )
  }

  if (status === 'loading' || status === 'init') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (status === 'error' || !my) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-base-100">
        <CloseButton onClick={onBack} />
        <p className="text-error">통계를 불러올 수 없습니다.</p>
        <SoundButton className="btn btn-outline" onClick={onBack}>돌아가기</SoundButton>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-100 px-4 py-6">
      <CloseButton onClick={onBack} />
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-center">📊 {my.nickname} 님 통계</h2>

        {/* 기본 집계 */}
        <section className="card bg-base-200">
          <div className="card-body py-4 px-4 gap-2">
            <h3 className="card-title text-base">기본 집계</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <Stat label="총 플레이" value={`${my.totals.play_count}회`} />
              <Stat label="최고 점수" value={my.totals.best_score.toLocaleString()} />
              <Stat label="최고 스테이지" value={`STAGE ${my.totals.best_stage}`} />
              <Stat label="최고 콤보" value={String(my.totals.best_combo)} />
              <Stat label="평균 점수" value={my.averages.avg_score.toLocaleString()} />
              <Stat label="중앙값 점수" value={my.averages.median_score.toLocaleString()} />
              <Stat label="최저 점수" value={my.averages.min_score.toLocaleString()} />
              <Stat label="평균 스테이지" value={String(my.averages.avg_stage)} />
              <Stat label="평균 콤보" value={String(my.averages.avg_combo)} />
            </div>
          </div>
        </section>

        {/* 시계열 */}
        <section className="card bg-base-200">
          <div className="card-body py-4 px-4 gap-2">
            <h3 className="card-title text-base">최근 추세</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Stat label="7일 평균 점수" value={my.trend.last_7_days_avg_score.toLocaleString()} />
              <Stat label="30일 평균 점수" value={my.trend.last_30_days_avg_score.toLocaleString()} />
              <Stat label="7일 플레이" value={`${my.trend.last_7_days_play_count}회`} />
              <Stat label="30일 플레이" value={`${my.trend.last_30_days_play_count}회`} />
            </div>
            <div className="mt-2">
              <DailyChart days={daily} />
            </div>
          </div>
        </section>

        {/* 전체 대비 */}
        <section className="card bg-base-200">
          <div className="card-body py-4 px-4 gap-2">
            <h3 className="card-title text-base">전체 대비 순위</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="백분위" value={`${(my.percentile.score * 100).toFixed(1)}%`} />
              <Stat label="상위" value={`${my.percentile.rank_top_pct}%`} />
              {global && (
                <>
                  <Stat label="전체 플레이어" value={`${global.total_players}명`} />
                  <Stat label="전체 세션" value={`${global.total_sessions}회`} />
                  <Stat label="전체 평균 점수" value={global.avg_score.toLocaleString()} />
                  <Stat label="전체 중앙값 점수" value={global.median_score.toLocaleString()} />
                </>
              )}
            </div>
          </div>
        </section>

        {/* 스테이지별 */}
        <section className="card bg-base-200">
          <div className="card-body py-4 px-4 gap-2">
            <h3 className="card-title text-base">스테이지별 성과</h3>
            {my.stage_best.length === 0 ? (
              <p className="text-sm text-base-content/50">아직 스테이지 데이터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>스테이지</th>
                      <th>최고점</th>
                      <th>도달 횟수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {my.stage_best.map((s) => (
                      <tr key={s.stage}>
                        <td>STAGE {s.stage}</td>
                        <td className="font-mono">{s.best_score.toLocaleString()}</td>
                        <td>{s.reach_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* 습관 / 분포 */}
        <section className="card bg-base-200">
          <div className="card-body py-4 px-4 gap-2">
            <h3 className="card-title text-base">습관 / 분포 (최근 30일)</h3>
            <div className="text-sm">
              <div className="mb-2 grid grid-cols-2 gap-2">
                <Stat
                  label="세션 평균 간격"
                  value={`${my.habit.session_gap_minutes.avg}분`}
                />
                <Stat
                  label="세션 중앙값 간격"
                  value={`${my.habit.session_gap_minutes.median}분`}
                />
              </div>
              <HourHeatmap data={my.habit.by_hour} />
            </div>
          </div>
        </section>

        <SoundButton className="btn btn-outline w-full mt-2" onClick={onBack}>
          돌아가기
        </SoundButton>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col bg-base-100 rounded p-2">
      <span className="text-xs text-base-content/50">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}

function DailyChart({ days }: { days: DailyEntry[] }) {
  if (days.length === 0) {
    return <p className="text-xs text-base-content/50">최근 30일 플레이 데이터 없음</p>
  }
  const maxCount = Math.max(...days.map((d) => d.play_count), 1)
  return (
    <div>
      <div className="text-xs text-base-content/60 mb-1">일별 플레이 횟수 (최근 30일)</div>
      <div className="flex items-end gap-[2px] h-20">
        {days.map((d) => {
          const h = (d.play_count / maxCount) * 100
          return (
            <div
              key={d.date}
              className="flex-1 bg-primary/70 hover:bg-primary"
              style={{ height: `${h}%` }}
              title={`${d.date}: ${d.play_count}회, avg ${d.avg_score}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-base-content/40 mt-1">
        <span>{days[0]?.date}</span>
        <span>{days[days.length - 1]?.date}</span>
      </div>
    </div>
  )
}

function HourHeatmap({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div>
      <div className="text-xs text-base-content/60 mb-1">시간대별 플레이 횟수 (UTC)</div>
      <div className="grid grid-cols-12 gap-[2px]">
        {data.map((d) => {
          const intensity = d.count / max
          return (
            <div
              key={d.hour}
              className="aspect-square flex items-center justify-center text-[10px] rounded"
              style={{
                background: `rgba(99, 102, 241, ${0.15 + intensity * 0.85})`,
              }}
              title={`${d.hour}시: ${d.count}회`}
            >
              {d.hour}
            </div>
          )
        })}
      </div>
    </div>
  )
}
