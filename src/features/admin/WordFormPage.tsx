import { useState } from 'react'
import type { Word, KeyMappingItem } from '../../types/admin'
import { createWord, updateWord } from '../../services/adminApi'
import { buildWordPrompt } from '../../constants/wordPrompt'

interface Props {
  word?: Word
  onDone: () => void
  onCancel: () => void
}

interface WordPayload {
  word: string
  difficulty_level: number
  bpm: number
  input_length: number
  valid_syllables: string[]
  invalid_syllables: string[]
  input_syllables: string[]
  key_mapping: KeyMappingItem[]
  fixed_stage: number | null
}

export function WordFormPage({ word, onDone, onCancel }: Props) {
  const initialJson = word
    ? JSON.stringify(
        {
          word: word.word,
          difficulty_level: word.difficulty_level,
          bpm: word.bpm,
          input_length: word.input_length,
          valid_syllables: word.valid_syllables,
          invalid_syllables: word.invalid_syllables,
          input_syllables: word.input_syllables,
          key_mapping: word.key_mapping,
          fixed_stage: word.fixed_stage,
        },
        null,
        2,
      )
    : ''

  const [json, setJson] = useState(initialJson)
  const [parsed, setParsed] = useState<WordPayload | null>(word ? JSON.parse(initialJson) : null)
  const [parseError, setParseError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // AI 프롬프트 모달 상태
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptWord, setPromptWord] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildWordPrompt(promptWord))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard 권한 거부 등 — 사용자가 직접 드래그 복사할 수 있게 무시
      setCopied(false)
    }
  }

  const handleJsonChange = (text: string) => {
    setJson(text)
    setSubmitError('')
    if (!text.trim()) {
      setParsed(null)
      setParseError('')
      return
    }
    try {
      const obj = JSON.parse(text) as WordPayload
      setParsed(obj)
      setParseError('')
    } catch (e) {
      setParseError(`JSON 파싱 실패: ${e}`)
      setParsed(null)
    }
  }

  const handleSubmit = async () => {
    if (!parsed) return
    setSubmitError('')
    setSubmitting(true)
    try {
      if (word) await updateWord(word.id, parsed)
      else await createWord(parsed)
      onDone()
    } catch (e) {
      setSubmitError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-bold">{word ? `단어 수정: ${word.word}` : '신규 단어 등록'}</h2>
        <button className="btn btn-ghost ml-auto" onClick={onCancel}>
          ← 목록으로
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="label flex items-center">
            <span className="label-text">JSON 붙여넣기</span>
            <button
              type="button"
              className="btn btn-sm btn-outline ml-auto"
              onClick={() => {
                setPromptOpen(true)
                setCopied(false)
              }}
            >
              🤖 AI 프롬프트
            </button>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-96 font-mono text-xs"
            value={json}
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder='{"word":"커피","difficulty_level":1,"bpm":92,...}'
          />
          {parseError && <p className="text-error text-sm">{parseError}</p>}
        </div>
        <div>
          <label className="label">
            <span className="label-text">미리보기</span>
          </label>
          {parsed ? (
            <div className="card bg-base-100 p-4 text-sm space-y-1 shadow">
              <div>
                <b>단어:</b> {parsed.word}
              </div>
              <div>
                <b>난이도:</b> {parsed.difficulty_level}
              </div>
              <div>
                <b>BPM:</b> {parsed.bpm}
              </div>
              <div>
                <b>입력 길이:</b> {parsed.input_length}
              </div>
              <div>
                <b>고정 stage:</b> {parsed.fixed_stage ?? '없음'}
              </div>
              <div>
                <b>유효 음절:</b> {parsed.valid_syllables.join(', ')}
              </div>
              <div>
                <b>무효 음절:</b> {parsed.invalid_syllables.join(', ')}
              </div>
              <div>
                <b>키 매핑:</b>
              </div>
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th>키</th>
                    <th>음절</th>
                    <th>유효</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.key_mapping.map((km, i) => (
                    <tr key={i}>
                      <td>{km.key.toUpperCase()}</td>
                      <td>{km.syllable}</td>
                      <td>{km.type === 'valid' ? '✓' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-base-content/50 text-sm">JSON 입력 후 미리보기가 표시됩니다.</p>
          )}
        </div>
      </div>
      {submitError && <div className="alert alert-error mt-4">{submitError}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onCancel}>
          취소
        </button>
        <button className="btn btn-primary" disabled={!parsed || submitting} onClick={handleSubmit}>
          {submitting ? '...' : word ? '수정 저장' : '등록'}
        </button>
      </div>

      {/* AI 프롬프트 모달 — 단어를 입력하면 프롬프트 끝에 끼워 넣어 복사 */}
      {promptOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <div className="flex items-center mb-3">
              <h3 className="font-bold text-lg">🤖 AI 단어 JSON 생성 프롬프트</h3>
              <button
                className="btn btn-sm btn-circle btn-ghost ml-auto"
                onClick={() => setPromptOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-base-content/70 mb-3">
              아래 프롬프트를 복사해 AI(ChatGPT/Claude 등)에게 주면 단어 JSON을 만들어줍니다. 만들
              단어를 입력하면 프롬프트에 자동으로 반영됩니다.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder="만들 단어 입력 (예: 사과)"
                value={promptWord}
                onChange={(e) => setPromptWord(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleCopyPrompt}>
                {copied ? '✓ 복사됨!' : '📋 프롬프트 복사'}
              </button>
            </div>
            <textarea
              className="textarea textarea-bordered w-full h-80 font-mono text-xs"
              readOnly
              value={buildWordPrompt(promptWord)}
            />
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setPromptOpen(false)}>
                닫기
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setPromptOpen(false)} />
        </div>
      )}
    </div>
  )
}
