import { useCallback, useEffect, useRef, useState } from 'react'

const STAGE_BGM: Record<number, string> = {
  1: '/audio/bgm_stage1.mp3',
  2: '/audio/bgm_stage2.mp3',
  3: '/audio/bgm_stage3.mp3',
  4: '/audio/bgm_stage4.mp3',
  5: '/audio/bgm_stage5.mp3',
}

// MP3 인코더가 항상 추가하는 프리갭 — AudioBufferSourceNode.start() offset으로 건너뜀
const MP3_PREGAP_SEC = 0.026

// 게임 중 즉각 재생이 필요한 SFX만 AudioContext로 프리로드
const SFX_PRELOAD_PATHS = [
  '/audio/sfx_note_hit.mp3',
  '/audio/sfx_note_miss.mp3',
  '/audio/sfx_button.mp3',
  '/audio/sfx_clear.mp3',
  '/audio/sfx_gameover.mp3',
]

const getDifficultyLevel = (stageIndex: number) => Math.floor(stageIndex / 3) + 1

const loadNum = (key: string, fallback: number) => {
  const v = localStorage.getItem(key)
  return v !== null ? Number(v) : fallback
}

export function useAudio() {
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const currentBgmSrc = useRef<string>('')

  const audioCtxRef = useRef<AudioContext | null>(null)
  const sfxBuffers = useRef<Map<string, AudioBuffer>>(new Map())

  const [bgmVolume, setBgmVolume] = useState(() => loadNum('audio_bgm_vol', 60))  // 0~100
  const [sfxOn, setSfxOn] = useState(() => localStorage.getItem('audio_sfx') !== 'off')

  const bgmVolumeRef = useRef(bgmVolume)
  const sfxOnRef = useRef(sfxOn)
  useEffect(() => { bgmVolumeRef.current = bgmVolume }, [bgmVolume])
  useEffect(() => { sfxOnRef.current = sfxOn }, [sfxOn])

  // 첫 사용자 인터랙션 후 AudioContext 초기화 + SFX 프리디코딩
  const ensureAudioCtx = useCallback(async () => {
    if (audioCtxRef.current) return audioCtxRef.current
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    await Promise.all(
      SFX_PRELOAD_PATHS.map(async (path) => {
        try {
          const res = await fetch(path)
          const arrayBuf = await res.arrayBuffer()
          const decoded = await ctx.decodeAudioData(arrayBuf)
          sfxBuffers.current.set(path, decoded)
        } catch {
          // 로드 실패 무시 — new Audio() fallback이 처리
        }
      })
    )
    return ctx
  }, [])

  const stopBgm = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.src = ''
      bgmRef.current = null
      currentBgmSrc.current = ''
    }
  }, [])

  // BGM 로드 후 실제 재생 시작 시점을 Promise로 반환 — 노트 타이머와 싱크 맞춤
  const playBgm = useCallback((src: string, loop = true): Promise<number> => {
    if (bgmVolumeRef.current === 0) return Promise.resolve(Date.now())
    if (currentBgmSrc.current === src) {
      return Promise.resolve(Date.now())
    }
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.src = ''
    }
    const audio = new Audio(src)
    audio.loop = loop
    audio.volume = bgmVolumeRef.current / 100
    bgmRef.current = audio
    currentBgmSrc.current = src

    return new Promise<number>((resolve) => {
      const onReady = () => {
        audio.removeEventListener('canplaythrough', onReady)
        audio.play().catch(() => {})
        resolve(Date.now())
      }
      // 이미 버퍼링 완료 상태면 즉시 resolve
      if (audio.readyState >= 3) {
        audio.play().catch(() => {})
        resolve(Date.now())
      } else {
        audio.addEventListener('canplaythrough', onReady, { once: true })
        // 최대 500ms 대기 후 타임아웃 — 네트워크 지연 상한
        setTimeout(() => {
          audio.removeEventListener('canplaythrough', onReady)
          audio.play().catch(() => {})
          resolve(Date.now())
        }, 500)
      }
    })
  }, [])

  // 디코딩된 AudioBuffer로 즉각 재생, 버퍼 미준비 시 new Audio() fallback
  const playSfx = useCallback(async (src: string) => {
    if (!sfxOnRef.current) return

    const ctx = await ensureAudioCtx()
    const buf = sfxBuffers.current.get(src)

    if (buf && ctx.state !== 'closed') {
      if (ctx.state === 'suspended') await ctx.resume()
      const source = ctx.createBufferSource()
      source.buffer = buf
      const gain = ctx.createGain()
      gain.gain.value = 0.8
      source.connect(gain)
      gain.connect(ctx.destination)
      // MP3 프리갭(~26ms) 오프셋으로 건너뛰어 즉각 재생
      source.start(0, MP3_PREGAP_SEC)
    } else {
      const audio = new Audio(src)
      audio.volume = 0.8
      audio.play().catch(() => {})
    }
  }, [ensureAudioCtx])

  // BGM 볼륨 변경 — 재생 중인 오디오에 즉시 반영
  const setBgmVol = useCallback((vol: number) => {
    bgmVolumeRef.current = vol
    setBgmVolume(vol)
    localStorage.setItem('audio_bgm_vol', String(vol))

    if (vol === 0) {
      // 볼륨 0 = 사실상 뮤트, BGM 정지
      bgmRef.current?.pause()
    } else if (bgmRef.current) {
      bgmRef.current.volume = vol / 100
      // 일시정지 상태였으면 재개
      if (bgmRef.current.paused && currentBgmSrc.current) {
        bgmRef.current.play().catch(() => {})
      }
    } else if (currentBgmSrc.current) {
      // BGM 인스턴스 없으면 재생
      const src = currentBgmSrc.current
      currentBgmSrc.current = ''
      playBgm(src)
    }
  }, [playBgm])

  const toggleSfx = useCallback(() => {
    setSfxOn(prev => {
      const next = !prev
      localStorage.setItem('audio_sfx', next ? 'on' : 'off')
      sfxOnRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    return () => {
      bgmRef.current?.pause()
      audioCtxRef.current?.close()
    }
  }, [])

  return {
    bgmVolume,
    sfxOn,
    setBgmVol,
    toggleSfx,
    ensureAudioCtx,
    playStartBgm: () => playBgm('/audio/bgm_start.mp3'),
    playGameBgm: (stageIndex: number): Promise<number> => {
      const level = getDifficultyLevel(stageIndex)
      return playBgm(STAGE_BGM[level] ?? STAGE_BGM[5])
    },
    playClearSfx: () => { stopBgm(); playSfx('/audio/sfx_clear.mp3') },
    playGameOverSfx: () => { stopBgm(); playSfx('/audio/sfx_gameover.mp3') },
    playHitSfx: () => playSfx('/audio/sfx_note_hit.mp3'),
    playMissSfx: () => playSfx('/audio/sfx_note_miss.mp3'),
    playButtonSfx: () => playSfx('/audio/sfx_button.mp3'),
    stopBgm,
  }
}
