# Testing Review — O(n) incremental token recompute (B3)

Diff range: `57d366b6..HEAD -- codebase/`
Target file: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts`

---

## 발견사항

### INFO: Oracle이 `MIN_RECENT_RAW_TURNS` 를 리터럴 `2` 로 하드코딩

- **위치**: `agent-memory-injection.spec.ts:607` — `referenceCut(turns, currentTokens, budget, 2)`
- **상세**: `MIN_RECENT_RAW_TURNS` 상수는 `agent-memory-injection.ts` 에서 export 되지 않으므로
  테스트가 직접 임포트할 수 없다. 그 결과 oracle 의 `minRecentRaw` 인수가 구현 상수(현재 2)와
  동기화되지 않은 채로 유지된다. 상수가 3으로 변경되면 oracle 은 여전히 2를 사용해 cut 경계가
  달라지고, 테스트는 `summarizedUpToSeq` 불일치로 실패하지만 오류 메시지가 상수 변경이 아닌
  "bit mismatch"로 표시된다 — 진단이 혼란스럽다.
- **제안**: `MIN_RECENT_RAW_TURNS` 를 모듈에서 export 하거나, oracle 주석에
  `/* must match MIN_RECENT_RAW_TURNS */` 를 달아 수동 동기화 의무를 명시한다.
  export 를 추가하는 1-line 변경이 가장 안전하다.

---

### INFO: bit-identical sweep이 `runningSummary != undefined` 경로를 커버하지 않음

- **위치**: `agent-memory-injection.spec.ts:586-648` (sweep it), `:612` `runningSummary: undefined`
- **상세**: 3개 B3 테스트 전부 `runningSummary: undefined` 를 사용한다.
  `runningSummary` 가 비어 있으면 `summaryBlockText = ''` 이므로 oracle 의 `fixedOverhead` 가
  `estimateTextTokens(systemPromptText)` 만으로 구성된다. 실제 운용에서 요약 블록이 존재하면
  `fixedOverhead` 에 해당 토큰이 추가되고, O(n) 구현은 `currentTokens` 초기값을 통해
  이를 올바르게 반영한다. 기존 suite 의 "accumulates onto prior summary" 케이스(라인 513)가
  의미적으로 이 경로를 검증하지만, bit-identical cut 비교는 수행하지 않는다.
  실질 위험은 낮다(공식 동치성은 수학적으로 `runningSummary` 값에 무관하게 성립).
- **제안**: 회귀 핀 강화 차원에서 `runningSummary: 'prior-summary'` 조건으로 sweep 케이스를
  1개 추가하거나, 기존 "accumulates" 테스트에 `summarizedUpToSeq` 정확값 단언을 추가한다.

---

### INFO: 예산 스윕이 `budget === currentTokens` 정확 경계를 확률적으로만 커버

- **위치**: `agent-memory-injection.spec.ts:606` — `for (let budget = 50; budget <= currentTokens + 50; budget += 37)`
- **상세**: step=37 이므로 `budget === currentTokens` 가 정확히 루프에 포함될 보장이 없다.
  이 경계는 `currentTokens <= tokenBudget` 조건의 마지막 no-compression 케이스이므로,
  정확 경계에서 `summarized: false` 가 반환되는지 명시 단언이 없다.
  현재 sweep 범위(`50 ~ currentTokens+50`)가 `> currentTokens` 케이스를 커버하기 때문에
  실질적 회귀 위험은 없다.
- **제안**: `budget === currentTokens` 케이스를 별도 단언으로 추가한다.
  (`expect(update.summarized).toBe(false)` with `tokenBudget: currentTokens`)

---

## 리뷰 통과 확인 항목 (문제 없음)

**오라클 동치성**: oracle 의 `fixedOverhead` 계산법
(`currentTokens - Σ estimateTurnTokens`) 은 구현의
`remainingTokens = currentTokens; remainingTokens -= estimateTurnTokens(oldest)` 와
대수적으로 동일하다. `summaryBlockText=''` 가정 하에 bit-identical 이 성립하며,
24턴 × 다중 budget sweep 에서 이를 검증한다.

**개수 정확성**: 정밀 케이스는 `perTurn`, `sysTokens` 로부터 budget 을 역산해
정확히 6회 압축을 유도하며 `summarizedUpToSeq === 5` 로 pin 한다.
over-compression 도 간접적으로 탐지된다 (`seq > 5` 이면 단언 실패).

**O(n) 입증**: getter 계측 방식은 CommonJS 하에서 jest.spyOn 이 intra-module 직접 호출을
인터셉트하지 못하는 한계를 정확히 짚고 데이터 레이어 계측으로 우회한다. N=30,
총 읽기 ≈ 86 ≤ 4N=120, 이차 floor N(N+1)/2=465 와의 격차가 5배 이상으로
bound 의 신뢰도가 높다. `reads.every(r => r >= 1)` sanity guard 도 적절하다.

**Mock 적절성**: `makeLlmServiceMock` 은 sweep 루프 내에서 매 iteration 신규 생성되므로
`mock.calls[0]` 가 항상 해당 iteration 의 호출을 가리킨다. 격리 완전.

**기존 테스트 회귀**: 전체 31개 테스트 통과 (28 pre-existing + 3 B3 신규).

**MIN_RECENT boundary 직접 커버**: B3 스위트가 `uncompressed.length <= 2` 케이스를 명시적으로
테스트하지 않지만, 기존 suite 의 "does NOT call LLM when under budget" 케이스가
부분적으로 커버하며, 이 경계는 구현이 단순 `while` 조건(`remainingCount > 2`)으로
처리하므로 별도 단언이 없어도 논리적 신뢰도는 높다.

---

## 요약

신규 B3 테스트 스위트는 세 축(bit-identical 오라클 비교, 개수 정밀 단언, getter 계측 O(n) 증명) 모두
기술적으로 타당하게 설계되어 있으며, 오라클의 대수적 동치성·mock 격리·bound 마진이 충분해
회귀 핀으로서의 신뢰도가 높다. 발견된 세 가지 항목은 모두 `MIN_RECENT_RAW_TURNS` 하드코딩에
따른 유지보수 취약성과 `runningSummary != undefined` 경로의 bit-identical 미검증으로,
현재 구현 정확성을 위협하는 수준은 아니다. 기존 28개 테스트 전원 통과.

---

## 위험도

**LOW**

---

BLOCK: NO
