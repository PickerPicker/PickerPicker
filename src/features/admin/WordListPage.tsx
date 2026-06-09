import { useEffect, useState } from 'react'
import type { Word } from '../../types/admin'
import { listWords, deleteWord } from '../../services/adminApi'
import { WordFormPage } from './WordFormPage'

export function WordListPage() {
  const [words, setWords] = useState<Word[]>([])
  const [diff, setDiff] = useState<number | undefined>()
  const [showActive, setShowActive] = useState<boolean | undefined>(true)
  const [editing, setEditing] = useState<Word | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    setError('')
    try {
      const data = await listWords({ difficulty: diff, is_active: showActive })
      setWords(data)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 필터(난이도/활성여부) 변경 시 단어 목록을 비동기 재조회 후 setState하는 정당한 데이터 패칭 패턴
    refresh()
  }, [diff, showActive])

  const handleDelete = async (w: Word) => {
    if (!confirm(`"${w.word}" 비활성화? (소프트 삭제)`)) return
    await deleteWord(w.id)
    await refresh()
  }

  if (creating) {
    return (
      <WordFormPage
        onDone={() => {
          setCreating(false)
          refresh()
        }}
        onCancel={() => setCreating(false)}
      />
    )
  }
  if (editing) {
    return (
      <WordFormPage
        word={editing}
        onDone={() => {
          setEditing(null)
          refresh()
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center">
        <select
          className="select select-bordered select-sm"
          value={diff ?? ''}
          onChange={(e) => setDiff(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">전체 난이도</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>
              난이도 {d}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm"
          value={showActive === undefined ? '' : String(showActive)}
          onChange={(e) => {
            const v = e.target.value
            setShowActive(v === 'true' ? true : v === 'false' ? false : undefined)
          }}
        >
          <option value="true">활성</option>
          <option value="false">비활성</option>
          <option value="">전체</option>
        </select>
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => setCreating(true)}>
          + 신규 등록
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>ID</th>
            <th>단어</th>
            <th>난이도</th>
            <th>BPM</th>
            <th>입력 길이</th>
            <th>고정 stage</th>
            <th>상태</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {words.map((w) => (
            <tr key={w.id}>
              <td>{w.id}</td>
              <td className="font-bold">{w.word}</td>
              <td>{w.difficulty_level}</td>
              <td>{w.bpm}</td>
              <td>{w.input_length}</td>
              <td>{w.fixed_stage ?? '-'}</td>
              <td>{w.is_active ? '✅' : '❌'}</td>
              <td>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditing(w)}>
                  수정
                </button>
                {w.is_active && (
                  <button
                    className="btn btn-sm btn-error btn-ghost"
                    onClick={() => handleDelete(w)}
                  >
                    삭제
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
