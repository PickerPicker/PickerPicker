import { useCallback, useEffect, useRef, useState } from 'react'

const STAGE_BGM: Record<number, string> = {
  1: '/audio/bgm_stage1.mp3',
  2: '/audio/bgm_stage2.mp3',
  3: '/audio/bgm_stage3.mp3',
  4: '/audio/bgm_stage4.mp3',
  5: '/audio/bgm_stage5.mp3',
}

const getDifficultyLevel = (stageIndex: number) => Math.floor(stageIndex / 3) + 1

const loadNum = (key: string, fallback: number) => {
  const v = localStorage.getItem(key)
  return v !== null ? Number(v) : fallback
}

export function useAudio() {
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const currentBgmSrc = useRef<string>('')

  const [bgmVolume, setBgmVolume] = useState(() => loadNum('audio_bgm_vol', 60))  // 0~100
  const [sfxOn, setSfxOn] = useState(() => localStorage.getItem('audio_sfx') !== 'off')

  const bgmVolumeRef = useRef(bgmVolume)
  const sfxOnRef = useRef(sfxOn)
  useEffect(() => { bgmVolumeRef.current = bgmVolume }, [bgmVolume])
  useEffect(() => { sfxOnRef.current = sfxOn }, [sfxOn])

  const stopBgm = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.src = ''
      bgmRef.current = null
      currentBgmSrc.current = ''
    }
  }, [])

  const playBgm = useCallback((src: string, loop = true) => {
    if (bgmVolumeRef.current === 0) return
    if (currentBgmSrc.current === src) return
    if (bgmRef.current) {
      bgmRef.current.pause()
      bgmRef.current.src = ''
    }
    const audio = new Audio(src)
    audio.loop = loop
    audio.volume = bgmVolumeRef.current / 100
    audio.play().catch(() => {})
    bgmRef.current = audio
    currentBgmSrc.current = src
  }, [])

  const playSfx = useCallback((src: string) => {
    if (!sfxOnRef.current) return
    const audio = new Audio(src)
    audio.volume = 0.8
    audio.play().catch(() => {})
  }, [])

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
    return () => { bgmRef.current?.pause() }
  }, [])

  return {
    bgmVolume,
    sfxOn,
    setBgmVol,
    toggleSfx,
    playStartBgm: () => playBgm('/audio/bgm_start.mp3'),
    playGameBgm: (stageIndex: number) => {
      const level = getDifficultyLevel(stageIndex)
      playBgm(STAGE_BGM[level] ?? STAGE_BGM[5])
    },
    playClearSfx: () => { stopBgm(); playSfx('/audio/sfx_clear.mp3') },
    playGameOverSfx: () => { stopBgm(); playSfx('/audio/sfx_gameover.mp3') },
    playHitSfx: () => playSfx('/audio/sfx_note_hit.mp3'),
    playMissSfx: () => playSfx('/audio/sfx_note_miss.mp3'),
    playButtonSfx: () => playSfx('/audio/sfx_button.mp3'),
    stopBgm,
  }
}
