# PickerPicker 단어 JSON 생성 프롬프트

> 규칙 출처: `docs/design/06_스테이지_데이터셋.md`의 "추가 스테이지 생성 프롬프트"(검증된 11개 규칙)를
> admin 단일 단어 등록 형식(snake_case 단일 객체)으로 변환한 것이다.
>
> 사용법: 아래 코드블록 안 프롬프트 전체를 복사해 AI(ChatGPT/Claude 등)에게 주고, 맨 끝 `"○○"` 자리에 만들 단어를 넣는다.
> AI가 출력한 JSON을 Admin 화면(`/admin` → 단어 관리 → 신규 단어 등록 → JSON 붙여넣기)에 붙여넣는다.
> (Admin 화면의 "🤖 AI 프롬프트" 버튼을 누르면 단어를 입력해 바로 복사할 수도 있다.)

---

```
너는 리듬 타이핑 게임 "PickerPicker"의 단어 데이터 생성기야.
내가 한국어 단어를 주면, 아래 규칙에 맞춰 단어 1개의 JSON 데이터를 생성해줘.
반드시 유효한 JSON 객체 하나만 출력하고, 설명·주석·마크다운·코드블록 표시는 절대 출력하지 마.

## 출력 JSON 구조 (단어 1개 = 객체 1개)
{
  "word": "커피",
  "difficulty_level": 1,
  "bpm": 90,
  "input_length": 16,
  "valid_syllables": ["커", "피"],
  "invalid_syllables": ["코", "포", "키", "퍼", "카", "파"],
  "input_syllables": ["커", "피", "커", "코", "피", "커", "피", "포", "커", "피", "커", "키", "피", "커", "피", "퍼"],
  "key_mapping": [
    {"key": "a", "syllable": "커", "type": "valid"},
    {"key": "s", "syllable": "피", "type": "valid"},
    {"key": "d", "syllable": "코", "type": "invalid"},
    {"key": "f", "syllable": "포", "type": "invalid"},
    {"key": "j", "syllable": "키", "type": "invalid"},
    {"key": "k", "syllable": "퍼", "type": "invalid"},
    {"key": "l", "syllable": "카", "type": "invalid"},
    {"key": ";", "syllable": "파", "type": "invalid"}
  ],
  "fixed_stage": null
}

## 규칙 (하나라도 어기면 등록 실패)
1. difficulty_level(난이도)은 1~5 정수.
2. bpm = 90 + (difficulty_level - 1) * 15
   → 난이도 1=90, 2=105, 3=120, 4=135, 5=150
3. input_length = 16 + (difficulty_level - 1) * 8
   → 난이도 1=16, 2=24, 3=32, 4=40, 5=48
4. key_mapping은 정확히 8개. key는 ["a","s","d","f","j","k","l",";"] 고정, 각각 1번씩.
5. valid_syllables 개수는 난이도에 따라 결정 — 난이도 1~2=2개, 3~4=3개, 5=4개.
   valid_syllables는 단어를 이루는 글자다. (단어 글자 수 = valid 개수)
   → 즉 2글자 단어=난이도 1~2, 3글자=난이도 3~4, 4글자=난이도 5.
6. invalid_syllables 개수 = 8 - valid_syllables 개수.
7. invalid_syllables는 valid_syllables와 "초성(첫 자음)을 공유하되 글자는 다른" 음절로 채운다. valid와 동일한 글자 금지.
   (예: valid가 커(ㅋ)·피(ㅍ)이면 invalid는 코·카·키(ㅋ 공유), 퍼·포·파(ㅍ 공유))
8. valid_syllables + invalid_syllables 음절 집합 = key_mapping 8개 syllable 집합과 완전히 일치.
   key_mapping은 valid 음절을 앞(a부터), invalid 음절을 뒤에 배치. type은 valid/invalid 맞게.
9. input_syllables.length === input_length (정확히 일치).
10. input_syllables 안의 음절은 valid/invalid 8개 중 하나만 사용.
11. input_syllables 중 valid 음절 비율이 70% 이상 (정답 음절이 대부분, invalid는 가끔 섞임).

## 난이도 요약표
| 난이도 | 단어 글자수(valid) | invalid | bpm | input_length |
| --- | --- | --- | --- | --- |
| 1 | 2 | 6 | 90  | 16 |
| 2 | 2 | 6 | 105 | 24 |
| 3 | 3 | 5 | 120 | 32 |
| 4 | 3 | 5 | 135 | 40 |
| 5 | 4 | 4 | 150 | 48 |

내가 준 단어의 글자 수에 맞는 난이도를 골라서 위 표대로 모든 값을 채워.
단어가 표의 글자 수와 안 맞으면(예: 5글자), 가장 가까운 난이도로 맞추고 valid는 단어 전체 글자로 해.

이제 단어를 줄게: "○○"
```
