import type { KeyMapping } from '../../types'

export interface TutorialStep {
  id: 1 | 2 | 3 | 4 | 5
  label: string
  message: string
  hintKeys: string[]
  word: string
  validSyllables: string[]
  noteLoop: string[]
  keyMapping: KeyMapping[]
  target: number
  gaugeLoss: boolean
  missMode: boolean
  warnInvalidNotes?: boolean
  isReady?: boolean
  countdownSec?: number
}

const PAD_INVALID: KeyMapping[] = [
  { key: 's', syllable: '-', type: 'invalid' },
  { key: 'd', syllable: '-', type: 'invalid' },
  { key: 'f', syllable: '-', type: 'invalid' },
  { key: 'j', syllable: '-', type: 'invalid' },
  { key: 'k', syllable: '-', type: 'invalid' },
  { key: 'l', syllable: '-', type: 'invalid' },
  { key: ';', syllable: '-', type: 'invalid' },
]

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    label: 'STEP 1 / 5',
    message: 'A 키 = "피" 입니다. "피" 노트가 오면 A를 누르세요',
    hintKeys: ['a'],
    word: '피커',
    validSyllables: ['피'],
    noteLoop: ['피'],
    keyMapping: [{ key: 'a', syllable: '피', type: 'valid' }, ...PAD_INVALID],
    target: 4,
    gaugeLoss: false,
    missMode: false,
  },
  {
    id: 2,
    label: 'STEP 2 / 5',
    message: 'A = "피", S = "커". 교대로 누르세요',
    hintKeys: ['a', 's'],
    word: '피커',
    validSyllables: ['피', '커'],
    noteLoop: ['피', '커'],
    keyMapping: [
      { key: 'a', syllable: '피', type: 'valid' },
      { key: 's', syllable: '커', type: 'valid' },
      { key: 'd', syllable: '-', type: 'invalid' },
      { key: 'f', syllable: '-', type: 'invalid' },
      { key: 'j', syllable: '-', type: 'invalid' },
      { key: 'k', syllable: '-', type: 'invalid' },
      { key: 'l', syllable: '-', type: 'invalid' },
      { key: ';', syllable: '-', type: 'invalid' },
    ],
    target: 4,
    gaugeLoss: false,
    missMode: false,
  },
  {
    id: 3,
    label: 'STEP 3 / 5',
    message: '"비", "코" 같은 노트는 내 꺼가 아닙니다. 누르지 말고 흘려보내세요',
    hintKeys: ['a', 's'],
    word: '피커',
    validSyllables: ['피', '커'],
    noteLoop: ['피', '커', '비', '피', '커', '코'],
    keyMapping: [
      { key: 'a', syllable: '피', type: 'valid' },
      { key: 's', syllable: '커', type: 'valid' },
      { key: 'd', syllable: '비', type: 'invalid' },
      { key: 'f', syllable: '코', type: 'invalid' },
      { key: 'j', syllable: '-', type: 'invalid' },
      { key: 'k', syllable: '-', type: 'invalid' },
      { key: 'l', syllable: '-', type: 'invalid' },
      { key: ';', syllable: '-', type: 'invalid' },
    ],
    target: 4,
    gaugeLoss: false,
    missMode: false,
    warnInvalidNotes: true,
  },
  {
    id: 4,
    label: 'STEP 4 / 5',
    message: '실전! "비", "코", "퍼" 노트를 누르면 MISS. 침착하게 흘려보내세요',
    hintKeys: ['a', 's'],
    word: '피커',
    validSyllables: ['피', '커'],
    noteLoop: ['피', '커', '비', '피', '커', '코', '피', '퍼'],
    keyMapping: [
      { key: 'a', syllable: '피', type: 'valid' },
      { key: 's', syllable: '커', type: 'valid' },
      { key: 'd', syllable: '비', type: 'invalid' },
      { key: 'f', syllable: '코', type: 'invalid' },
      { key: 'j', syllable: '-', type: 'invalid' },
      { key: 'k', syllable: '퍼', type: 'invalid' },
      { key: 'l', syllable: '-', type: 'invalid' },
      { key: ';', syllable: '-', type: 'invalid' },
    ],
    target: 6,
    gaugeLoss: true,
    missMode: false,
    warnInvalidNotes: true,
  },
  {
    id: 5,
    label: 'STEP 5 / 5',
    message: 'READY!',
    hintKeys: [],
    word: '',
    validSyllables: [],
    noteLoop: [],
    keyMapping: [],
    target: 0,
    gaugeLoss: false,
    missMode: false,
    isReady: true,
    countdownSec: 3,
  },
]

export const TUTORIAL_BPM = 90
