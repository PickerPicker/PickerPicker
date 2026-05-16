import { createContext, useContext, type ReactNode } from 'react'
import { useAudio } from '../hooks/useAudio'

type AudioApi = ReturnType<typeof useAudio>

const AudioCtx = createContext<AudioApi | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const audio = useAudio()
  return <AudioCtx.Provider value={audio}>{children}</AudioCtx.Provider>
}

export function useAudioContext(): AudioApi {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudioContext must be used within <AudioProvider>')
  return ctx
}
