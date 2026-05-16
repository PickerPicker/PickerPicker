import { useState } from 'react'
import { SoundButton } from './common/SoundButton'
import { checkNickname, createPlayer, verifyPin } from '../services/playerService'

type Screen = 'home' | 'settings' | 'credits' | 'nickname' | 'pin-login' | 'pin-create' | 'pin-confirm'

interface StartScreenProps {
  onRanking: () => void
  onStart: () => void
  onPractice: () => void
  onTutorial: () => void
  hasPlayedBefore: boolean
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
  nickname: string
  onLogout: () => void
  onLoginComplete: (nickname: string) => void
}

const CREDITS = [
  { role: 'PM',      name: '이하경' },
  { role: 'DESIGN',  name: '배나현' },
  { role: 'BACKEND', name: '황시선' },
  { role: 'FRONT',   name: '이건희' },
  { role: 'LEAD',    name: '서새찬' },
]

function CreditsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex flex-col items-center gap-1">
        <h2
          className="text-2xl font-black tracking-widest text-primary"
          style={{ textShadow: '0 0 12px rgba(0,180,255,0.7)' }}
        >
          ─ CREDITS ─
        </h2>
        <p className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
          2026 INTERCON
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        {CREDITS.map(({ role, name }) => (
          <div
            key={role}
            className="flex items-center justify-between px-4 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span
              className="text-xs font-black tracking-widest"
              style={{ color: 'rgba(0,180,255,0.7)', minWidth: '80px' }}
            >
              [{role}]
            </span>
            <span
              className="text-base font-bold tracking-wider"
              style={{ color: '#e2e8f0' }}
            >
              {name}
            </span>
          </div>
        ))}
      </div>

      <p
        className="text-xs tracking-widest text-center"
        style={{ color: 'rgba(255,255,255,0.3)' }}
      >
        © 2026 PickerPicker Team
      </p>

      <SoundButton
        className="btn btn-sm w-full"
        style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
        onClick={onBack}
      >
        ← BACK
      </SoundButton>
    </div>
  )
}

function NicknameView({
  onConfirm,
  onBack,
}: {
  onConfirm: (name: string) => Promise<void>
  onBack: () => void
}) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setLoading(true)
    await onConfirm(trimmed)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2
        className="text-xl font-black tracking-widest text-center"
        style={{ color: 'rgba(0,180,255,0.9)' }}
      >
        닉네임 입력
      </h2>
      <input
        type="text"
        placeholder="닉네임을 입력하세요"
        className="input input-bordered w-full"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
        autoFocus
        maxLength={20}
      />
      <div className="flex flex-col gap-2">
        <SoundButton
          className="btn btn-primary w-full"
          onClick={handleConfirm}
          disabled={!value.trim() || loading}
        >
          {loading ? <span className="loading loading-spinner loading-sm" /> : '확인'}
        </SoundButton>
        <SoundButton
          className="btn btn-sm w-full"
          style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          onClick={onBack}
          disabled={loading}
        >
          ← BACK
        </SoundButton>
      </div>
    </div>
  )
}

function PinView({
  mode,
  nickname,
  onConfirm,
  onBack,
  error,
}: {
  mode: 'login' | 'create' | 'confirm'
  nickname: string
  onConfirm: (pin: string) => Promise<void>
  onBack: () => void
  error: string
}) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const title =
    mode === 'login'
      ? `${nickname}님, PIN 입력`
      : mode === 'create'
      ? 'PIN 설정 (4자리 숫자)'
      : 'PIN 확인 (다시 입력)'

  const handleConfirm = async () => {
    if (pin.length !== 4) return
    setLoading(true)
    await onConfirm(pin)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2
        className="text-xl font-black tracking-widest text-center"
        style={{ color: 'rgba(0,180,255,0.9)' }}
      >
        {title}
      </h2>

      {/* 신규 PIN 설정 시 가이드라인 (create, confirm 공통) */}
      {(mode === 'create' || mode === 'confirm') && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'rgba(255,180,0,0.10)',
            border: '1px solid rgba(255,180,0,0.4)',
            color: 'rgba(255,210,80,0.95)',
          }}
        >
          {mode === 'create'
            ? '⚠️ 이 PIN은 다음 로그인 시 필요합니다. 꼭 기억해 두세요!'
            : '⚠️ PIN을 다시 한번 입력하세요. 잊어버리면 재설정이 불가합니다.'}
        </div>
      )}

      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder="● ● ● ●"
        className="input input-bordered w-full text-center tracking-widest text-2xl"
        value={pin}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(digits)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
        autoFocus
      />

      {error && <p className="text-error text-sm text-center">{error}</p>}

      <div className="flex flex-col gap-2">
        <SoundButton
          className="btn btn-primary w-full"
          onClick={handleConfirm}
          disabled={pin.length !== 4 || loading}
        >
          {loading ? <span className="loading loading-spinner loading-sm" /> : '확인'}
        </SoundButton>
        <SoundButton
          className="btn btn-sm w-full"
          style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          onClick={onBack}
          disabled={loading}
        >
          ← BACK
        </SoundButton>
      </div>
    </div>
  )
}

function SettingsView({
  bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset, onBack,
}: {
  bgmVolume: number
  sfxOn: boolean
  offset: number
  onBgmVolume: (v: number) => void
  onToggleSfx: () => void
  onOffset: (v: number) => void
  onBack: () => void
}) {
  const offsetLabel = offset === 0 ? '0ms' : offset > 0 ? `+${offset}ms` : `${offset}ms`

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2
        className="text-2xl font-black tracking-widest text-primary text-center"
        style={{ textShadow: '0 0 12px rgba(0,180,255,0.7)' }}
      >
        ─ SETTINGS ─
      </h2>

      {/* BGM 볼륨 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold tracking-widest" style={{ color: 'rgba(0,180,255,0.8)' }}>[BGM]</span>
          <span className="font-mono text-primary">{bgmVolume}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={bgmVolume}
          className="range range-primary range-sm"
          onChange={e => onBgmVolume(Number(e.target.value))}
        />
        <div className="flex justify-between text-xs px-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span>0</span><span>50</span><span>100</span>
        </div>
      </div>

      {/* 효과음 */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="font-bold tracking-widest text-sm" style={{ color: 'rgba(0,180,255,0.8)' }}>[SFX]</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={sfxOn}
          onChange={onToggleSfx}
        />
      </div>

      {/* 판정 오프셋 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold tracking-widest" style={{ color: 'rgba(0,180,255,0.8)' }}>[OFFSET]</span>
          <span className="font-mono text-primary">{offsetLabel}</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <SoundButton
            className="btn btn-sm btn-outline w-10"
            onClick={() => onOffset(offset - 1)}
            disabled={offset <= -100}
          >
            −
          </SoundButton>
          <div className="flex flex-col items-center gap-0.5">
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={offset}
              className="range range-primary range-xs w-32"
              onChange={e => onOffset(Number(e.target.value))}
            />
            <div className="flex justify-between text-xs w-32 px-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span>-100</span><span>0</span><span>+100</span>
            </div>
          </div>
          <SoundButton
            className="btn btn-sm btn-outline w-10"
            onClick={() => onOffset(offset + 1)}
            disabled={offset >= 100}
          >
            +
          </SoundButton>
        </div>
        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
          음수: 판정 앞당김 · 양수: 판정 늦춤
        </p>
      </div>

      <SoundButton
        className="btn btn-sm w-full mt-2"
        style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
        onClick={onBack}
      >
        ← BACK
      </SoundButton>
    </div>
  )
}

export function StartScreen({ onRanking, onStart, onPractice, onTutorial, hasPlayedBefore, bgmVolume, sfxOn, offset, onBgmVolume, onToggleSfx, onOffset, nickname, onLogout, onLoginComplete }: StartScreenProps) {
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
      const ok = await verifyPin(loginNickname, pin)
      if (!ok) {
        setPinError('PIN이 틀렸습니다')
        return
      }
      resetLogin()
      setScreen('home')
      onLoginComplete(loginNickname)
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
      await createPlayer(loginNickname, pin)
      resetLogin()
      setScreen('home')
      onLoginComplete(loginNickname)
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
        style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {screen === 'home' && (
          <>
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-3xl sm:text-5xl font-black text-primary tracking-widest text-center" style={{ textShadow: '0 2px 24px rgba(0,180,255,0.5)' }}>
                PickerPicker
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  2026 InCerthon
                </p>
                <span className="text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  v{__APP_VERSION__}
                </span>
              </div>
              {/* 로그인 상태일 때 닉네임 표시 */}
              {nickname && (
                <p className="text-sm font-bold tracking-wider" style={{ color: 'rgba(0,180,255,0.9)', marginTop: '2px' }}>
                  안녕하세요, {nickname}님!
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 w-full">
              <SoundButton className="btn btn-primary btn-lg w-full text-lg" onClick={handleStartClick}>
                {nickname ? '플레이하기' : '시작'}
              </SoundButton>
              <SoundButton
                className="btn btn-lg w-full text-lg"
                style={{ background: 'rgba(0,180,255,0.18)', color: '#fff', border: '1px solid rgba(0,180,255,0.45)' }}
                onClick={onTutorial}
              >
                게임 방법
              </SoundButton>
              {hasPlayedBefore && (
                <SoundButton
                  className="btn btn-lg w-full text-lg"
                  style={{ background: 'rgba(80,140,200,0.35)', color: '#fff', border: '1px solid rgba(0,180,255,0.4)' }}
                  onClick={onPractice}
                >
                  연습모드
                </SoundButton>
              )}
              <SoundButton
                className="btn btn-lg w-full text-lg"
                style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={onRanking}
              >
                랭킹
              </SoundButton>
              <SoundButton
                className="btn btn-lg w-full text-lg"
                style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={() => setScreen('settings')}
              >
                설정
              </SoundButton>
              <SoundButton
                className="btn btn-lg w-full text-lg"
                style={{ background: 'rgba(60,80,120,0.45)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={() => setScreen('credits')}
              >
                크레딧
              </SoundButton>
              {/* 로그인 상태일 때만 로그아웃 버튼 표시 */}
              {nickname && (
                <SoundButton
                  className="btn btn-lg w-full text-lg"
                  style={{ background: 'rgba(180,40,40,0.25)', color: 'rgba(255,100,100,0.85)', border: '1px solid rgba(255,80,80,0.25)' }}
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
            onBack={() => { resetLogin(); setScreen('home') }}
          />
        )}

        {(screen === 'pin-login' || screen === 'pin-create' || screen === 'pin-confirm') && (
          <PinView
            key={screen}
            mode={
              screen === 'pin-login' ? 'login'
              : screen === 'pin-create' ? 'create'
              : 'confirm'
            }
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

        {screen === 'settings' && (
          <SettingsView
            bgmVolume={bgmVolume}
            sfxOn={sfxOn}
            offset={offset}
            onBgmVolume={onBgmVolume}
            onToggleSfx={onToggleSfx}
            onOffset={onOffset}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'credits' && (
          <CreditsView onBack={() => setScreen('home')} />
        )}
      </div>
    </div>
  )
}
