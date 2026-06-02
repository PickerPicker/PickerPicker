export interface KeyMappingItem {
  key: 'a' | 's' | 'd' | 'f' | 'j' | 'k' | 'l' | ';'
  syllable: string
  type: 'valid' | 'invalid'
}

export interface Word {
  id: number
  word: string
  difficulty_level: number
  bpm: number
  input_length: number
  valid_syllables: string[]
  invalid_syllables: string[]
  input_syllables: string[]
  key_mapping: KeyMappingItem[]
  fixed_stage: number | null
  is_active: boolean
}

export interface AdminUser {
  id: number
  username: string
  created_at: string
  created_by: number | null
}

export interface WordGlobalStat {
  word_id: number
  word: string
  difficulty_level: number
  total_exposure: number
  accuracy: number
  is_active: boolean
}

export interface AdminOverview {
  total_players: number
  total_sessions: number
  active_word_count: number
  avg_score: number
}
