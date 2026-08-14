import { useState } from 'react'
import { SoundButton } from '../../components/common/SoundButton'
import { checkNickname, createPlayer, getPlayer } from '../../services/playerService'
import { login, type LoginOutcome } from '../../services/authService'
import { NicknameView } from './NicknameView'
import { PinView } from './PinView'
import { SettingsView } from './SettingsView'

/** 로그인 실패 사유별 안내 문구 — 시도 과다를 'PIN 틀림'으로 오인시키지 않는다. */
function loginErrorMessage(outcome: Extract<LoginOutcome, { ok: false }>): string {
  if (outcome.reason === 'rate_limited') {
    const min = outcome.retryAfterSec ? Math.ceil(outcome.retryAfterSec / 60) : 5
    return `PIN 입력 시도가 너무 많습니다. ${min}분 후 다시 시도해주세요`
  }
  if (outcome.reason === 'network') return '서버에 연결할 수 없습니다'
  return 'PIN이 틀렸습니다'
}

// 크레딧 화면은 현재 진입 경로를 닫아둔 상태. CreditsView.tsx 는 복구용으로 남겨둔다.
type Screen =
  'home' | 'settings' | 'nickname' | 'pin-login' | 'pin-create' | 'pin-confirm' | 'offline'

interface StartScreenProps {
  onRanking: () => void
  onStart: () => void
  onPractice: () => void
  onTutorial: () => void
  onStats?: () => void
  hasPlayedBefore: boolean
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
  nickname: string
  onLogout: () => void
  onLoginComplete: (nickname: string, tutorialSeen: boolean) => void
  isOffline?: boolean
  isStatsPublic?: boolean
  onToggleStatsPublic?: () => void
}

export function StartScreen({
  onRanking,
  onStart,
  onPractice,
  onTutorial,
  onStats,
  hasPlayedBefore,
  bgmVolume,
  sfxOn,
  offset,
  onBgmVolume,
  onToggleSfx,
  onOffset,
  nickname,
  onLogout,
  onLoginComplete,
  isOffline,
  isStatsPublic,
  onToggleStatsPublic,
}: StartScreenProps) {
  const [screen, setScreen] = useState<Screen>('home')
  const [loginNickname, setLoginNickname] = useState('')
  const [pendingPin, setPendingPin] = useState('')
  const [pinError, setPinError] = useState('')

  const resetLogin = () => {
    setLoginNickname('')
    setPendingPin('')
    setPinError('')
  }

  const handleStartClick = () => {
    if (nickname) {
      onStart()
      return
    }
    if (isOffline) {
      setScreen('offline')
      return
    }
    resetLogin()
    setScreen('nickname')
  }

  const handleNicknameConfirm = async (name: string) => {
    const exists = await checkNickname(name)
    setLoginNickname(name)
    setScreen(exists ? 'pin-login' : 'pin-create')
  }

  const handlePinConfirm = async (pin: string) => {
    if (screen === 'pin-login') {
      // PIN 검증만 하고 끝내면 세션 토큰이 발급되지 않아 본인 전용 API(통계·결과 저장)가
      // 전부 401이 된다. 로그인 엔드포인트로 토큰까지 받아온다.
      const outcome = await login(loginNickname, pin)
      if (!outcome.ok) {
        setPinError(loginErrorMessage(outcome))
        return
      }
      // 기존 플레이어 — 서버에서 tutorial_seen 조회 (실패 시 false로 fallback)
      const player = await getPlayer(loginNickname).catch(() => null)
      const tutorialSeen = player?.tutorial_seen ?? false
      resetLogin()
      setScreen('home')
      onLoginComplete(loginNickname, tutorialSeen)
    } else if (screen === 'pin-create') {
      setPendingPin(pin)
      setPinError('')
      setScreen('pin-confirm')
    } else if (screen === 'pin-confirm') {
      if (pin !== pendingPin) {
        setPinError('PIN이 일치하지 않습니다')
        setPendingPin('')
        setScreen('pin-create')
        return
      }
      // 신규 플레이어 — createPlayer 응답에 tutorial_seen 포함 (항상 false)
      const player = await createPlayer(loginNickname, pin)
      if (!player) {
        setPinError('가입에 실패했습니다. 잠시 후 다시 시도해주세요')
        setPendingPin('')
        setScreen('pin-create')
        return
      }
      // 가입 직후에도 세션 토큰이 필요하다 (결과 저장·통계가 인증을 요구함)
      const outcome = await login(loginNickname, pin)
      if (!outcome.ok) {
        // 계정은 이미 생성됐으므로 pin-create로 되돌리면 닉네임 중복 오류에 갇힌다.
        // 로그인 화면으로 보내 방금 정한 PIN으로 다시 들어오게 한다.
        setPinError('가입은 완료됐습니다. 방금 설정한 PIN으로 로그인해주세요')
        setPendingPin('')
        setScreen('pin-login')
        return
      }
      const tutorialSeen = player.tutorial_seen ?? false
      resetLogin()
      setScreen('home')
      onLoginComplete(loginNickname, tutorialSeen)
    }
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen gap-8"
      style={{
        backgroundImage: 'url(/bg-home.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="flex flex-col items-center gap-6 px-10 py-8 rounded-3xl w-[480px] max-w-[90vw]"
        style={{
          background: 'rgba(0,0,0,0.52)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {screen === 'home' && (
          <>
            <div className="flex flex-col items-center gap-1">
              <h1
                className="text-3xl sm:text-5xl font-black text-primary tracking-widest text-center"
                style={{ textShadow: '0 2px 24px rgba(0,180,255,0.5)' }}
              >
                PickerPicker
              </h1>
              {/* 타이틀 부제목은 비활성화 — 버전만 표시한다 */}
              <div className="flex items-center gap-2">
                <span
                  className="text-xs tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  v{__APP_VERSION__}
                </span>
              </div>
              {/* 로그인 상태일 때 닉네임 표시 */}
              {nickname && (
                <p
                  className="text-sm font-bold tracking-wider"
                  style={{ color: 'rgba(0,180,255,0.9)', marginTop: '2px' }}
                >
                  안녕하세요, {nickname}님!
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 w-full">
              <SoundButton
                className="btn btn-primary btn-lg w-full text-lg"
                onClick={handleStartClick}
              >
                {nickname ? '플레이하기' : '시작'}
              </SoundButton>
              <SoundButton
                className="btn btn-lg w-full text-lg"
                style={{
                  background: 'rgba(0,180,255,0.18)',
                  color: '#fff',
                  border: '1px solid rgba(0,180,255,0.45)',
                }}
                onClick={onTutorial}
              >
                게임 방법
              </SoundButton>
              {hasPlayedBefore && (
                <SoundButton
                  className="btn btn-lg w-full text-lg"
                  style={{
                    background: 'rgba(80,140,200,0.35)',
                    color: '#fff',
                    border: '1px solid rgba(0,180,255,0.4)',
                  }}
                  onClick={onPractice}
                >
                  연습모드
                </SoundButton>
              )}
              <SoundButton
                className="btn btn-lg w-full text-lg"
                style={{
                  background: 'rgba(60,80,120,0.45)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
                onClick={onRanking}
              >
                랭킹
              </SoundButton>
              {nickname && onStats && (
                <SoundButton
                  className="btn btn-lg w-full text-lg"
                  style={{
                    background: 'rgba(60,80,120,0.45)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}
                  onClick={onStats}
                >
                  내 통계
                </SoundButton>
              )}
              <SoundButton
                className="btn btn-lg w-full text-lg"
                style={{
                  background: 'rgba(60,80,120,0.45)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
                onClick={() => setScreen('settings')}
              >
                설정
              </SoundButton>
              {/* 로그인 상태일 때만 로그아웃 버튼 표시 */}
              {nickname && (
                <SoundButton
                  className="btn btn-lg w-full text-lg"
                  style={{
                    background: 'rgba(180,40,40,0.25)',
                    color: 'rgba(255,100,100,0.85)',
                    border: '1px solid rgba(255,80,80,0.25)',
                  }}
                  onClick={onLogout}
                >
                  로그아웃
                </SoundButton>
              )}
            </div>
          </>
        )}

        {screen === 'nickname' && (
          <NicknameView
            onConfirm={handleNicknameConfirm}
            onBack={() => {
              resetLogin()
              setScreen('home')
            }}
          />
        )}

        {(screen === 'pin-login' || screen === 'pin-create' || screen === 'pin-confirm') && (
          <PinView
            key={screen}
            mode={screen === 'pin-login' ? 'login' : screen === 'pin-create' ? 'create' : 'confirm'}
            nickname={loginNickname}
            onConfirm={handlePinConfirm}
            onBack={() => {
              setPinError('')
              setPendingPin('')
              setScreen('nickname')
            }}
            error={pinError}
          />
        )}

        {screen === 'offline' && (
          <div className="flex flex-col items-center gap-6 w-full">
            <h2 className="text-xl font-black tracking-widest text-center text-error">
              서버에 연결할 수 없습니다
            </h2>
            <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
              인터넷 연결을 확인하고 다시 시도해 주세요.
            </p>
            <SoundButton
              className="btn btn-sm w-full"
              style={{
                background: 'rgba(60,80,120,0.45)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
              onClick={() => setScreen('home')}
            >
              ← BACK
            </SoundButton>
          </div>
        )}

        {screen === 'settings' && (
          <SettingsView
            bgmVolume={bgmVolume}
            sfxOn={sfxOn}
            offset={offset}
            onBgmVolume={onBgmVolume}
            onToggleSfx={onToggleSfx}
            onOffset={onOffset}
            onBack={() => setScreen('home')}
            statsToggle={
              nickname && onToggleStatsPublic
                ? { isPublic: isStatsPublic ?? true, onToggle: onToggleStatsPublic }
                : undefined
            }
          />
        )}
      </div>
    </div>
  )
}
