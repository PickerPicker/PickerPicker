import { useEffect, useRef, useState } from 'react'

// 콤보 5부터 점수 2배(PlayStage 로직)와 동일 기준으로 FEVER 발동
export const FEVER_THRESHOLD = 5
// 콤보 강조 펄스를 주는 마일스톤
const COMBO_MILESTONES = [10, 25, 50, 75, 100, 150, 200]

/**
 * 점수/콤보 변화에 따른 시각 효과 상태를 계산한다.
 * - scoreKey: 점수가 오를 때마다 증가 → score-bump 애니메이션 재생용 key
 * - comboKey: 콤보 마일스톤 돌파 시 증가 → combo-pop 애니메이션 재생용 key
 * - feverEnterKey: FEVER 진입 순간 증가 → fever-flash 재생용 key
 * - isFever: 현재 FEVER 상태 여부
 * - comboScale: 콤보 크기에 비례한 스케일(1.0~1.25)
 */
export function useScoreEffects(score: number, combo: number) {
  const isFever = combo >= FEVER_THRESHOLD

  const [scoreKey, setScoreKey] = useState(0)
  const prevScoreRef = useRef(score)
  useEffect(() => {
    if (score !== prevScoreRef.current) {
      prevScoreRef.current = score
      setScoreKey((k) => k + 1)
    }
  }, [score])

  const [comboKey, setComboKey] = useState(0)
  const prevComboRef = useRef(combo)
  useEffect(() => {
    const prev = prevComboRef.current
    prevComboRef.current = combo
    if (combo > prev && COMBO_MILESTONES.includes(combo)) {
      setComboKey((k) => k + 1)
    }
  }, [combo])

  const [feverEnterKey, setFeverEnterKey] = useState(0)
  const wasFeverRef = useRef(false)
  useEffect(() => {
    if (isFever && !wasFeverRef.current) {
      setFeverEnterKey((k) => k + 1)
    }
    wasFeverRef.current = isFever
  }, [isFever])

  const comboScale = Math.min(1.25, 1 + combo * 0.01)

  return { scoreKey, comboKey, feverEnterKey, isFever, comboScale }
}
