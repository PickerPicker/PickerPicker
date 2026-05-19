import { useEffect, useState } from 'react'
import { getHallOfFame, updateMotto, type HallOfFameEntry } from '../services/playerService'
import { getStoredToken, getStoredTokenNickname } from '../services/authService'
import { SoundButton } from './common/SoundButton'

interface HallOfFameTabProps {
  nickname: string
}

export function HallOfFameTab({ nickname }: HallOfFameTabProps) {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [mottoInput, setMottoInput] = useState('')
  const [editingMotto, setEditingMotto] = useState(false)
  const [mottoMsg, setMottoMsg] = useState('')

  useEffect(() => {
    getHallOfFame().then(data => {
      setEntries(data)
      setLoading(false)
    })
  }, [])

  const champion = entries.find(e => e.ended_at === null) ?? null
  const history = entries.filter(e => e.ended_at !== null)

  const canEditMotto =
    !!getStoredToken() &&
    getStoredTokenNickname() === nickname &&
    entries.some(e => e.nickname === nickname)

  const handleMottoSubmit = async () => {
    if (!mottoInput.trim()) return
    const ok = await updateMotto(mottoInput.trim())
    if (ok) {
      setMottoMsg('한마디가 등록되었습니다!')
      setEditingMotto(false)
      const fresh = await getHallOfFame()
      setEntries(fresh)
    } else {
      setMottoMsg('등록 실패. 1위 경험자만 한마디를 남길 수 있습니다.')
    }
    setTimeout(() => setMottoMsg(''), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!champion) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p style={{ color: '#6b7280', fontSize: 14 }}>아직 챔피언이 없습니다</p>
      </div>
    )
  }

  return (
    <div
      className="w-full max-w-2xl rounded-xl flex flex-col flex-1 min-h-0 overflow-y-auto"
      style={{ background: 'rgba(0, 0, 20, 0.72)', backdropFilter: 'blur(2px)', padding: '24px 20px' }}
    >
      {/* 챔피언 레이블 */}
      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          letterSpacing: 4,
          color: '#fbbf24',
          textShadow: '0 0 10px #f59e0b',
          marginBottom: 16,
        }}
      >
        👑 CURRENT CHAMPION
      </div>

      {/* 픽셀아트 동상 */}
      <PixelStatue />

      {/* 닉네임 */}
      <div
        style={{
          textAlign: 'center',
          fontSize: 26,
          fontWeight: 900,
          color: '#e879f9',
          textShadow: '0 0 16px #a21caf, 0 2px 4px #000',
          letterSpacing: 3,
          marginBottom: 6,
        }}
      >
        {champion.nickname}
      </div>

      {/* 재위 기간 */}
      <div
        style={{
          textAlign: 'center',
          fontSize: 14,
          color: '#fbbf24',
          textShadow: '0 0 8px #f59e0b',
          letterSpacing: 2,
          marginBottom: 16,
        }}
      >
        👑 {champion.days === 0 ? '오늘 달성!' : `1위 달성 후 ${champion.days}일째`}
      </div>

      {/* 스탯 뱃지 */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <StatBadge gold label="점수" value={champion.score.toLocaleString()} />
        <StatBadge label="재위" value={champion.days === 0 ? '오늘' : `${champion.days}일`} />
      </div>

      {/* 한마디 */}
      <div
        style={{
          width: '100%',
          background: 'rgba(168,85,247,0.08)',
          border: '1px solid rgba(168,85,247,0.25)',
          borderLeft: '3px solid #e879f9',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 8,
          fontSize: 14,
          color: '#f0abfc',
          fontStyle: 'italic',
          textAlign: 'center',
          letterSpacing: 1,
        }}
      >
        {champion.motto ? `" ${champion.motto} "` : '—'}
      </div>

      {/* 한마디 수정 버튼 */}
      {canEditMotto && !editingMotto && (
        <SoundButton
          onClick={() => {
            setEditingMotto(true)
            setMottoInput(champion.motto ?? '')
          }}
          style={{
            alignSelf: 'center',
            marginBottom: 12,
            padding: '4px 16px',
            fontSize: 12,
            background: 'rgba(168,85,247,0.2)',
            border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: 20,
            color: '#c084fc',
            cursor: 'pointer',
          }}
        >
          한마디 수정
        </SoundButton>
      )}

      {editingMotto && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input
            type="text"
            maxLength={100}
            value={mottoInput}
            onChange={e => setMottoInput(e.target.value)}
            placeholder="한마디를 입력하세요 (100자 이내)"
            style={{
              flex: 1,
              background: 'rgba(0,0,20,0.5)',
              border: '1px solid rgba(168,85,247,0.4)',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#e2e8f0',
              fontSize: 13,
            }}
          />
          <SoundButton
            onClick={handleMottoSubmit}
            style={{
              padding: '6px 14px',
              background: 'rgba(168,85,247,0.3)',
              border: '1px solid rgba(168,85,247,0.5)',
              borderRadius: 8,
              color: '#e879f9',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            등록
          </SoundButton>
          <SoundButton
            onClick={() => setEditingMotto(false)}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: 8,
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            취소
          </SoundButton>
        </div>
      )}

      {mottoMsg && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#a78bfa', marginBottom: 8 }}>
          {mottoMsg}
        </p>
      )}

      {/* 구분선 */}
      <div
        style={{
          width: '100%',
          height: 1,
          background:
            'linear-gradient(to right, transparent, rgba(168,85,247,0.4), transparent)',
          margin: '8px 0 16px',
        }}
      />

      {/* 역대 목록 */}
      <div
        style={{
          fontSize: 10,
          letterSpacing: 4,
          color: '#6b7280',
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        HALL OF FAME RECORD
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(168,85,247,0.1)',
              borderRadius: 8,
              fontSize: 13,
              color: '#9ca3af',
            }}
          >
            {/* 날짜 · 닉네임 · 한마디 · 점수 · 재위일 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#9ca3af', fontSize: 11, flexShrink: 0, minWidth: 52, whiteSpace: 'nowrap' }}>
                {new Date(e.ended_at!).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
              </span>
              <span style={{ color: '#f1f5f9', fontWeight: 600, flexShrink: 0 }}>{e.nickname}</span>
              {e.motto
                ? <span style={{ color: '#e879f9', fontSize: 11, fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>"{e.motto}"</span>
                : <span style={{ flex: 1 }} />
              }
              <span style={{ color: '#fbbf24', fontSize: 12, flexShrink: 0 }}>{e.score.toLocaleString()}</span>
              <span style={{ color: '#a78bfa', fontSize: 12, flexShrink: 0, marginLeft: 12, fontWeight: 600 }}>{e.days}일 재위</span>
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <p style={{ textAlign: 'center', color: '#4b5563', fontSize: 12 }}>
            역대 기록이 없습니다
          </p>
        )}
      </div>
    </div>
  )
}

function StatBadge({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div
      style={{
        background: gold ? 'rgba(251,191,36,0.08)' : 'rgba(168,85,247,0.15)',
        border: `1px solid ${gold ? 'rgba(251,191,36,0.4)' : 'rgba(168,85,247,0.35)'}`,
        borderRadius: 20,
        padding: '4px 14px',
        fontSize: 12,
        color: gold ? '#fde68a' : '#c084fc',
        letterSpacing: 1,
      }}
    >
      {label}{' '}
      <span style={{ color: gold ? '#fbbf24' : '#e879f9', fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}

// ─── 픽셀아트 동상 ──────────────────────────────────────────────
const PIXEL_COLORS: Record<string, string> = {
  c0: 'transparent',
  c1: '#fbbf24',
  c2: '#f59e0b',
  c3: '#fde68a',
  c4: '#f3c4a0',
  c5: '#d97706',
  c6: '#1e1b4b',
  c7: '#e879f9',
  c8: '#7c3aed',
  c9: '#a855f7',
  ca: '#c084fc',
  cb: '#6d28d9',
  cc: '#db2777',
  cd: '#9d174d',
  ce: '#4c1d95',
  cf: '#3b0764',
  cg: '#5b21b6',
}

const STATUE_ROWS: string[][] = [
  ['c0', 'c1', 'c0', 'c0', 'c3', 'c0', 'c0', 'c0', 'c1', 'c0', 'c0'],
  ['c0', 'c1', 'c0', 'c2', 'c3', 'c2', 'c0', 'c0', 'c1', 'c0', 'c0'],
  ['c0', 'c1', 'c2', 'c3', 'c1', 'c3', 'c2', 'c1', 'c2', 'c1', 'c0'],
  ['c0', 'c2', 'c1', 'c1', 'c2', 'c1', 'c1', 'c2', 'c1', 'c2', 'c0'],
  ['c0', 'c0', 'c4', 'c4', 'c4', 'c4', 'c4', 'c4', 'c4', 'c0', 'c0'],
  ['c0', 'c4', 'c4', 'c4', 'c4', 'c4', 'c4', 'c4', 'c4', 'c4', 'c0'],
  ['c0', 'c4', 'c4', 'c7', 'c6', 'c4', 'c6', 'c7', 'c4', 'c4', 'c0'],
  ['c0', 'c4', 'c4', 'c4', 'c5', 'c4', 'c5', 'c4', 'c4', 'c4', 'c0'],
  ['c0', 'c4', 'c4', 'c5', 'c4', 'c5', 'c4', 'c5', 'c4', 'c4', 'c0'],
  ['c0', 'c0', 'c0', 'c4', 'c4', 'c4', 'c4', 'c4', 'c0', 'c0', 'c0'],
  ['cc', 'cc', 'c9', 'ca', 'c9', 'ca', 'c9', 'ca', 'c9', 'cc', 'cc'],
  ['cd', 'cc', 'c8', 'c9', 'ca', 'c1', 'ca', 'c9', 'c8', 'cc', 'cd'],
  ['cd', 'cc', 'cb', 'c8', 'c9', 'c9', 'c9', 'c8', 'cb', 'cc', 'cd'],
  ['cd', 'c8', 'c9', 'cb', 'c9', 'c9', 'c9', 'cb', 'c9', 'c8', 'cd'],
  ['c0', 'cd', 'c8', 'c9', 'c8', 'c9', 'c8', 'c9', 'c8', 'cd', 'c0'],
  ['c0', 'c0', 'cb', 'c8', 'c0', 'c0', 'c0', 'c8', 'cb', 'c0', 'c0'],
  ['c0', 'c0', 'cb', 'c8', 'c0', 'c0', 'c0', 'c8', 'cb', 'c0', 'c0'],
  ['ce', 'ce', 'cg', 'cg', 'cg', 'cg', 'cg', 'cg', 'cg', 'ce', 'ce'],
  ['cf', 'ce', 'cg', 'ce', 'ce', 'cg', 'ce', 'ce', 'cg', 'ce', 'cf'],
  ['cf', 'cf', 'cf', 'cf', 'cf', 'cf', 'cf', 'cf', 'cf', 'cf', 'cf'],
]

type SparkleConfig =
  | { top: number; left: number; color: string; delay: number }
  | { top: number; right: number; color: string; delay: number }

const SPARKLES: SparkleConfig[] = [
  { top: 10, left: -12, color: '#fbbf24', delay: 0 },
  { top: 30, right: -10, color: '#fbbf24', delay: 0.4 },
  { top: -4, left: 40, color: '#e879f9', delay: 0.8 },
  { top: 50, left: -18, color: '#c084fc', delay: 1.2 },
  { top: 20, right: -16, color: '#fde68a', delay: 1.6 },
]

function PixelStatue() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 16,
        position: 'relative',
      }}
    >
      {SPARKLES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 4,
            height: 4,
            background: s.color,
            borderRadius: '50%',
            top: s.top,
            ...('left' in s ? { left: s.left } : { right: s.right }),
            animation: `pp-sparkle 2s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(11, 10px)',
          gridTemplateRows: 'repeat(20, 10px)',
          filter: 'drop-shadow(0 0 12px #a21caf) drop-shadow(0 0 24px #7c3aed)',
          animation: 'pp-float 3s ease-in-out infinite',
        }}
      >
        {STATUE_ROWS.flat().map((key, i) => (
          <div key={i} style={{ width: 10, height: 10, background: PIXEL_COLORS[key] }} />
        ))}
      </div>

      <style>{`
        @keyframes pp-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pp-sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
