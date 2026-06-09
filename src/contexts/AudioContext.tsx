import { createContext, useContext, type ReactNode } from 'react'
import { useAudio } from '../hooks/useAudio'

type AudioApi = ReturnType<typeof useAudio>

const AudioCtx = createContext<AudioApi | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const audio = useAudio()
  return <AudioCtx.Provider value={audio}>{children}</AudioCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- Provider와 같은 파일에 두는 일반적 패턴; Fast Refresh 편의 경고일 뿐 런타임 무관
export function useAudioContext(): AudioApi {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudioContext must be used within <AudioProvider>')
  return ctx
}
