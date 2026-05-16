import type { KeyMapping } from '../../types'

export interface TutorialStep {
  id: 1 | 2 | 3 | 4
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
    label: 'STEP 1 / 4',
    message: 'A 키로 "커" 노트가 판정선에 닿을 때 누르세요',
    hintKeys: ['a'],
    word: '커',
    validSyllables: ['커'],
    noteLoop: ['커'],
    keyMapping: [
      { key: 'a', syllable: '커', type: 'valid' },
      ...PAD_INVALID,
    ],
    target: 4,
    gaugeLoss: false,
    missMode: false,
  },
  {
    id: 2,
    label: 'STEP 2 / 4',
    message: 'A / S 키로 "커" "피" 교대로 누르세요',
    hintKeys: ['a', 's'],
    word: '커피',
    validSyllables: ['커', '피'],
    noteLoop: ['커', '피'],
    keyMapping: [
      { key: 'a', syllable: '커', type: 'valid' },
      { key: 's', syllable: '피', type: 'valid' },
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
    label: 'STEP 3 / 4',
    message: '틀린 키 = MISS! 게이지가 줄어듭니다. 일부러 D 키를 3번 눌러보세요',
    hintKeys: ['d'],
    word: '커',
    validSyllables: ['커'],
    noteLoop: [],
    keyMapping: [
      { key: 'a', syllable: '커', type: 'valid' },
      { key: 's', syllable: '-', type: 'invalid' },
      { key: 'd', syllable: '코', type: 'invalid' },
      { key: 'f', syllable: '-', type: 'invalid' },
      { key: 'j', syllable: '-', type: 'invalid' },
      { key: 'k', syllable: '-', type: 'invalid' },
      { key: 'l', syllable: '-', type: 'invalid' },
      { key: ';', syllable: '-', type: 'invalid' },
    ],
    target: 3,
    gaugeLoss: true,
    missMode: true,
  },
  {
    id: 4,
    label: 'STEP 4 / 4',
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
