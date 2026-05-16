export type Screen = 'start' | 'game' | 'ranking' | 'practice' | 'tutorial'

export type GamePhase = 'preview' | 'playing' | 'result'

export interface KeyMapping {
  key: string
  syllable: string
  type: 'valid' | 'invalid'
}

export interface StageData {
  stage: number
  difficultyLevel: number
  bpm: number
  word: string
  validSyllables: string[]
  invalidSyllables: string[]
  inputLength: number
  inputSyllables: string[]
  keyMapping: KeyMapping[]
}

export interface GameData {
  gameTitle: string
  version: string
  keyLayout: string[]
  rules: {
    totalStages: number
    difficultyGroupSize: number
    baseBpm: number
    bpmIncreasePerDifficulty: number
    baseInputLength: number
    inputLengthIncreasePerDifficulty: number
    validSyllableRatioMin: number
  }
  stages: StageData[]
}

export interface GameStat {
  score: number
  gauge: number
  perfectCombo: number
  maxCombo: number        // 게임 중 달성한 최대 PERFECT 콤보
  perfectCount: number
  goodCount: number
  missCount: number
}

/** localStorage 저장 구조 */
export interface BestRecord {
  bestScore: number
  bestStage: number
  bestCombo: number
  bestPerfectCount: number
}

export type JudgmentType = 'PERFECT' | 'GOOD' | 'MISS'
