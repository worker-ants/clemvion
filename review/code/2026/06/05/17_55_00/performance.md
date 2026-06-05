# 성능 리뷰 — memory-tokenizer-exact (agent-memory-injection.ts)

대상 diff: `cbfbfbb9..HEAD -- codebase/`

---

## 발견사항

### INFO: `for...of` + `codePointAt(0)` per-char — 엔진 최적화 가능 범위 내
- 위치: `estimateTokensLanguageAware` (lines 73–89)
- 상세: `for...of` 이터레이터는 서로게이트 페어를 코드포인트 단위로 처리하기 위해 JS 엔진이 내부적으로 `@@iterator` 를 거친다. V8 기준으로는 JIT 이 `for...of` on string 을 특수화해 박싱 없이 처리하므로 실질 per-char 할당은 없다. 단, 각 루프에서 1-char 임시 `ch` 문자열을 생성 후 `.codePointAt(0)` 을 호출하는 패턴은 charCode 직접 접근(`str.charCodeAt(i)`)보다 약 1~2배 느리다는 벤치마크가 존재한다. 이 경로가 매 turn 1회, 수백~수천 char 규모라면 실측 허용 범위 내이나, 매우 긴 systemPrompt/요약이 반복 입력될 경우 누적 비용이 있다.
- 제안: 성능 크리티컬 이슈는 아니나, 추후 프로파일링 결과에 따라 `charCodeAt` + 서로게이트 페어 수동 처리 방식으로 교체할 수 있다. 현재 규모에서는 불필요.

### INFO: 나눗셈 누적 방식 — float 정밀도 누적 오차 미미, 허용 범위
- 위치: `estimateTokensLanguageAware` (lines 81–86)
- 상세: 코드포인트마다 `1/1.7`, `1/4`, `1/3` float 를 더하는 방식은 64-bit IEEE 754 에서 per-addition 오차(~1e-16) 가 수천 iter 누적될 수 있다. `Math.ceil` 로 반올림하므로 결과 정수 자체는 안정적이다 — 경계값에서 ±1 토큰 오차가 발생할 수 있으나 이는 근사 추정의 허용 오차 이내. 실질 성능 문제 없음.
- 제안: 허용 범위. 만약 정수 카운터 방식으로 바꾸려면 latinCount/cjkCount/otherCount 3개 누산 후 마지막에 일괄 나눗셈하면 오차 최소화 + 분기 비용 구조 동일.

### INFO: `estimateWorkingMemoryTokens` 예산 루프 — turn 당 1회 호출 구조 확인 (B3 O(n) 보존)
- 위치: `buildSummaryBufferUpdate` lines 301–305 (예산 체크), lines 327–336 (압축 루프)
- 상세: 예산 체크(`currentTokens` 계산)는 `estimateWorkingMemoryTokens`를 루프 진입 **전** 1회 호출한다. 압축 루프 내부(`while` lines 327–336)에서는 `estimateTurnTokens(oldest)` 를 매 iter 1회씩만 호출해 이전 `remainingTokens` 에서 **차감**하는 O(n) 증분 방식이다 — `estimateWorkingMemoryTokens` 전체를 매 iter 재계산하는 O(n²) 패턴이 아님. B3 O(n) 불변식 유지 확인.

### INFO: `estimateTokensLanguageAware` 결과 캐싱 없음 — 동일 텍스트 중복 호출 가능성
- 위치: `buildSummaryBufferUpdate` lines 300–305
- 상세: `buildSummaryBlock(runningSummary)` 로 생성된 `summaryBlockText` 에 대해 `estimateWorkingMemoryTokens` 가 `estimateTextTokens(summaryBlockText)` 를 호출한다. `summaryBlockText` 는 `buildSummaryBlock` 내부에서 문자열 join 으로 생성된 새 문자열이므로 캐시 key 로 쓰기 어렵다. 단, 이 호출은 turn 당 최대 1회(예산 체크)이고 요약 블록은 통상 수백~수천 char 규모라 문제없음. 만약 `runningSummary` 가 수십 KB 로 성장한다면 주의 필요.
- 제안: `runningSummary` 의 토큰 수를 별도로 메모이제이션(예: `ConversationThread` 에 `runningSummaryTokens` 필드)하면 매 turn O(1) 으로 줄일 수 있다. 현재 규모에서는 선제적 최적화 불필요.

### INFO: `isLatinCodePoint` 범위 — U+0000 포함으로 공백·제어문자가 Latin 분류
- 위치: `isLatinCodePoint` lines 58–63
- 상세: `cp >= 0x0000` 조건이 공백(U+0020), 탭, 제어문자(U+0000~U+001F)를 Latin `÷4` 로 분류한다. 공백은 실제 BPE 에서 단어 경계 역할을 하므로 토큰 수에 영향이 작지만, 엄밀히는 Latin 문자가 아니다. 추정 정확도에 미미한 영향이며 성능 문제는 아니다.
- 제안: 허용 범위. 정밀도 개선 시 `cp >= 0x0020` 또는 공백/제어문자를 OTHER 로 분류할 수 있다.

---

## 요약

`estimateTokensLanguageAware` 는 코드포인트 순회 O(text length) 함수이나, `buildSummaryBufferUpdate` 내 예산 체크는 루프 진입 전 1회, 압축 루프 내부는 `estimateTurnTokens` 단일 turn 차감으로 처리하므로 O(n) 증분 구조(B3 불변식)가 정확히 보존된다. O(n²) 회귀 없음. `for...of` + `codePointAt` 패턴은 V8 JIT 최적화 대상이며 실측 허용 범위 내이고, 정규식·추가 할당·블록 판정 외부 호출은 없다. 요약 블록 토큰 추정의 반복 계산은 현재 규모에서 문제없으나, `runningSummary` 가 수십 KB 이상으로 장기 성장할 경우 메모이제이션 고려 여지가 있다. 전체적으로 이번 변경의 성능 리스크는 낮다.

## 위험도

LOW

---

BLOCK: NO
