import type { BestRecord, GameStat } from '../../types'
import type { StageResultItem } from '../../services/playerService'
import { SoundButton } from '../../components/common/SoundButton'
import { GameOverWordCards } from './GameOverWordCards'
import gameoverBg from '../../assets/gameover-bg.png'

/** 랭킹 1위 요약 — 결과 화면 비교용 */
interface GlobalTop {
  nickname: string
  best_score: number
  best_stage: number
  best_combo: number
}

interface GameOverScreenProps {
  /** 이번 판 최종 스탯 */
  stat: GameStat
  /** 정확도 (%) — PERFECT+GOOD 기준 */
  accuracy: number
  /** 전 스테이지 클리어 여부 */
  isClear: boolean
  /** 도달 스테이지 번호 */
  reachedStage: number
  /** 역대 최고 기록 (로컬) */
  best: BestRecord
  /** 이번 판에서 새로 경신한 항목 */
  newRecords: { score: boolean; stage: boolean; combo: boolean }
  /** 서버 기준 누적 플레이 횟수 */
  serverPlayCount: number | null
  /** 전체 1위 기록 */
  globalTop: GlobalTop | null
  /** 단어 카드용 조회 테이블 (word_id → 단어 정보) */
  wordsLookup: Record<number, { word: string; difficulty_level: number }>
  /** 이번 판 단어별 결과 */
  stageResults: StageResultItem[]

  /** 신규 챔피언 등극 여부 */
  isNewChampion: boolean
  championMotto: string
  championModalClosed: boolean
  onChampionMottoChange: (motto: string) => void
  onChampionModalClose: (closed: boolean) => void
  onSubmitMotto: (motto: string) => Promise<boolean>

  onRestart: () => void
  onHome: () => void
  onRanking: () => void
  onStats?: () => void
}

/**
 * 게임오버 / 올클리어 결과 화면.
 *
 * GameScreen에서 분리한 순수 프레젠테이션 컴포넌트다.
 * 게임 루프·판정 로직은 포함하지 않으며, 계산이 끝난 결과만 표시한다.
 */
export function GameOverScreen({
  stat,
  accuracy,
  isClear,
  reachedStage,
  best,
  newRecords,
  serverPlayCount,
  globalTop,
  wordsLookup,
  stageResults,
  isNewChampion,
  championMotto,
  championModalClosed,
  onChampionMottoChange,
  onChampionModalClose,
  onSubmitMotto,
  onRestart,
  onHome,
  onRanking,
  onStats,
}: GameOverScreenProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4 py-6 overflow-auto"
      style={{
        backgroundImage: `url(${gameoverBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 중앙 단일 컬럼 — 화면 폭에 관계없이 항상 동일한 세로 흐름. my-auto로 세로 중앙 정렬하되 콘텐츠가 길면 자연스럽게 스크롤 */}
      <div className="flex flex-col items-stretch gap-4 w-full max-w-2xl my-auto">
        {/* 타이틀 — 네온 글로우. 와이드에서 더 크게, 아래 여백 확보 */}
        <h2
          className={`text-center text-6xl sm:text-7xl font-black tracking-widest shrink-0 mb-2 ${isClear ? 'text-success' : 'text-error'}`}
          style={{
            textShadow: isClear
              ? '0 0 18px rgba(74,222,128,0.7), 0 0 40px rgba(74,222,128,0.4)'
              : '0 0 18px rgba(248,113,113,0.7), 0 0 40px rgba(248,113,113,0.4)',
          }}
        >
          {isClear ? 'ALL CLEAR' : 'GAME OVER'}
        </h2>

        {/* 하이라이트 3카드 — 최종 점수 / 도달 스테이지 / 최대 콤보 */}
        <div className="grid grid-cols-3 gap-3 shrink-0">
          {/* 최종 점수 (시안) */}
          <div
            className="rounded-xl py-5 px-3 text-center backdrop-blur"
            style={{
              background: 'rgba(8,12,28,0.55)',
              border: '1px solid rgba(56,189,248,0.55)',
              boxShadow: '0 0 16px rgba(56,189,248,0.18)',
            }}
          >
            <div className="text-xs uppercase tracking-widest text-sky-300/80 mb-1">점수</div>
            <div
              className="font-mono font-black text-3xl text-sky-300 leading-tight"
              style={{ textShadow: '0 0 12px rgba(56,189,248,0.6)' }}
            >
              {stat.score.toLocaleString()}
            </div>
          </div>
          {/* 도달 스테이지 (핑크) */}
          <div
            className="rounded-xl py-5 px-3 text-center backdrop-blur"
            style={{
              background: 'rgba(8,12,28,0.55)',
              border: '1px solid rgba(244,114,182,0.55)',
              boxShadow: '0 0 16px rgba(244,114,182,0.18)',
            }}
          >
            <div className="text-xs uppercase tracking-widest text-pink-300/80 mb-1">
              {isClear ? '클리어' : '스테이지'}
            </div>
            <div
              className="font-black text-2xl sm:text-3xl text-pink-300 leading-tight whitespace-nowrap"
              style={{ textShadow: '0 0 12px rgba(244,114,182,0.6)' }}
            >
              {isClear ? 'ALL' : `STAGE ${reachedStage}`}
            </div>
          </div>
          {/* 최대 콤보 (옐로) */}
          <div
            className="rounded-xl py-5 px-3 text-center backdrop-blur"
            style={{
              background: 'rgba(8,12,28,0.55)',
              border: '1px solid rgba(250,204,21,0.55)',
              boxShadow: '0 0 16px rgba(250,204,21,0.18)',
            }}
          >
            <div className="text-xs uppercase tracking-widest text-yellow-300/80 mb-1">콤보</div>
            <div
              className="font-black text-3xl text-yellow-300 leading-tight"
              style={{ textShadow: '0 0 12px rgba(250,204,21,0.6)' }}
            >
              {stat.maxCombo}
            </div>
          </div>
        </div>

        {/* 판정 상세 — 정확도 강조 + PERFECT/GOOD/MISS */}
        <div
          className="rounded-xl px-5 py-4 shrink-0 backdrop-blur"
          style={{ background: 'rgba(8,12,28,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          {/* 정확도 — 라벨 바로 옆에 큰 숫자로 묶어 가운데 배치 */}
          <div className="flex items-baseline justify-center gap-2 mb-3">
            <span className="text-sm uppercase tracking-widest text-white/50">정확도</span>
            <span
              className="font-mono font-black text-3xl text-white"
              style={{ textShadow: '0 0 12px rgba(255,255,255,0.3)' }}
            >
              {accuracy}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center border-t border-white/10 pt-3">
            <div>
              <div className="text-xs font-bold text-success uppercase tracking-wide">Perfect</div>
              <div className="font-black text-xl text-white">{stat.perfectCount}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-warning uppercase tracking-wide">Good</div>
              <div className="font-black text-xl text-white">{stat.goodCount}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-error uppercase tracking-wide">Miss</div>
              <div className="font-black text-xl text-white">{stat.missCount}</div>
            </div>
          </div>
        </div>

        {/* 내 최고 기록 + 글로벌 1위 — 가로 2분할 (좁으면 자동 세로) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          {/* 내 최고 기록 */}
          <div
            className="rounded-xl px-4 py-4 backdrop-blur"
            style={{ background: 'rgba(8,12,28,0.5)', border: '1px solid rgba(99,102,241,0.5)' }}
          >
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-2">
              내 최고 기록
            </h3>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="flex items-center gap-1 text-white/60">
                점수
                {newRecords.score && (
                  <span className="badge badge-xs bg-primary text-white border-0 animate-pulse">
                    NEW
                  </span>
                )}
              </span>
              <span className="font-mono font-bold text-white">
                {best.bestScore.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="flex items-center gap-1 text-white/60">
                스테이지
                {newRecords.stage && (
                  <span className="badge badge-xs bg-primary text-white border-0 animate-pulse">
                    NEW
                  </span>
                )}
              </span>
              <span className="font-bold text-white">STAGE {best.bestStage}</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="flex items-center gap-1 text-white/60">
                콤보
                {newRecords.combo && (
                  <span className="badge badge-xs bg-primary text-white border-0 animate-pulse">
                    NEW
                  </span>
                )}
              </span>
              <span className="font-bold text-white">{best.bestCombo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">플레이 횟수</span>
              <span className="font-bold text-white">
                {serverPlayCount === null ? '...' : `${serverPlayCount}회`}
              </span>
            </div>
          </div>

          {/* 글로벌 1위 */}
          {globalTop ? (
            <div
              className="rounded-xl px-4 py-4 backdrop-blur"
              style={{
                background: 'rgba(8,12,28,0.5)',
                border: '1px solid rgba(250,204,21,0.45)',
              }}
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-2">
                🏆 글로벌 1위
              </h3>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/60">닉네임</span>
                <span className="font-bold text-yellow-300 truncate ml-2">
                  {globalTop.nickname}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/60">점수</span>
                <span className="font-mono font-bold text-white">
                  {globalTop.best_score.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/60">스테이지</span>
                <span className="font-bold text-white">STAGE {globalTop.best_stage}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">콤보</span>
                <span className="font-bold text-white">{globalTop.best_combo}</span>
              </div>
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        {/* 이번 판 단어 — 본문 흐름에 합류, 폭 적응 그리드 */}
        <div className="shrink-0">
          <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest mb-2">
            이번 판 단어
          </h3>
          <GameOverWordCards results={stageResults} wordsLookup={wordsLookup} />
        </div>

        {/* 하단 버튼 — 다시하기 강조 + 보조 3버튼 가로 분할 */}
        <div className="flex flex-col gap-2 shrink-0 pt-1">
          <SoundButton className="btn btn-primary btn-lg w-full text-lg" onClick={onRestart}>
            다시 하기
          </SoundButton>
          <div className="grid grid-cols-3 gap-2">
            {onStats && (
              <SoundButton
                className="btn btn-md sm:btn-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60"
                onClick={onStats}
              >
                내 통계 보기
              </SoundButton>
            )}
            <SoundButton
              className="btn btn-md sm:btn-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60"
              onClick={onRanking}
            >
              랭킹 보기
            </SoundButton>
            <SoundButton
              className="btn btn-md sm:btn-lg bg-black/50 border border-white/20 text-white/90 hover:bg-black/60"
              onClick={onHome}
            >
              홈으로 가기
            </SoundButton>
          </div>
        </div>
      </div>

      {/* 1위 달성 모달 — 명예의 전당 등록 */}
      {isNewChampion && !championModalClosed && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,20,0.95)',
              border: '1px solid rgba(168,85,247,0.5)',
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 0 40px rgba(168,85,247,0.4)',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: '#e879f9',
                textShadow: '0 0 12px #a21caf',
                marginBottom: 8,
                letterSpacing: 2,
              }}
            >
              명예의 전당 등록!
            </div>
            <div style={{ fontSize: 13, color: '#c084fc', marginBottom: 20 }}>
              전체 1위를 달성했습니다.
              <br />
              한마디를 남겨보세요.
            </div>
            <textarea
              maxLength={100}
              value={championMotto}
              onChange={(e) => onChampionMottoChange(e.target.value)}
              placeholder="한마디 (선택사항, 100자 이내)"
              rows={2}
              style={{
                width: '100%',
                background: 'rgba(0,0,20,0.5)',
                border: '1px solid rgba(168,85,247,0.4)',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: 13,
                resize: 'none',
                marginBottom: 16,
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <SoundButton
                onClick={async () => {
                  if (championMotto.trim()) await onSubmitMotto(championMotto.trim())
                  onChampionModalClose(true)
                }}
                style={{
                  padding: '8px 24px',
                  background: 'rgba(168,85,247,0.3)',
                  border: '1px solid rgba(168,85,247,0.5)',
                  borderRadius: 8,
                  color: '#e879f9',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {championMotto.trim() ? '등록하기' : '확인'}
              </SoundButton>
              <SoundButton
                onClick={() => onChampionModalClose(true)}
                style={{
                  padding: '8px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(168,85,247,0.2)',
                  borderRadius: 8,
                  color: '#9ca3af',
                  cursor: 'pointer',
                }}
              >
                나중에
              </SoundButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
