# Performance Review

**대상**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts`
**diff base**: `57d366b6..HEAD`
**날짜**: 2026-06-05

---

## STATUS: OK

---

## 발견사항

### INFO — O(n²)→O(n) 전환 달성 확인

- **위치**: `buildSummaryBufferUpdate` while 루프 (L255–265)
- **상세**: 루프 내에서 `estimateWorkingMemoryTokens(remaining)` 전체 재합산(O(n)) 및 `remaining.shift()`(O(n) 배열 앞 요소 제거) 두 가지 원인이 모두 제거됐다. 대신 `uncompressed[cut]` 인덱스 접근(O(1)) + `remainingTokens -= estimateTurnTokens(oldest)` 단일 항 차감(O(1))으로 교체돼 루프 전체가 O(n)이 됐다. `cut`/`remainingCount` 두 개의 int 외 추가 메모리 할당 없음.

### INFO — 수학적 동치 검증

- **위치**: 동일 루프
- **상세**: `estimateTokens`는 `Math.ceil(text.length / 3)` — 정수 반환, 부동소수점 없음. 따라서 합산 순서에 의한 누적 오차 가능성이 없다. 증분식 `remainingTokens -= estimateTurnTokens(oldest)` 는 초기값 `currentTokens = fixedOverhead + Σ estimateTurnTokens(uncompressed)` 에서 oldest 항 하나를 뺄 때마다 `fixedOverhead + Σ estimateTurnTokens(remaining)` 와 수학적으로 동일하다. 루프 조건(`remainingTokens > tokenBudget`, `remainingCount > MIN_RECENT_RAW_TURNS`)도 기존과 동일하게 유지된다.

### INFO — 경계조건 검토

- **위치**: L250–265
- **상세**: 세 가지 경계를 검토했다.
  1. **빈 `uncompressed`**: `remainingCount = 0` → `0 > MIN_RECENT_RAW_TURNS(=2)` 불성립, 루프 미진입. `toCompress.length === 0` → `noChange` 반환. 기존과 동일.
  2. **`MIN_RECENT_RAW_TURNS` 경계**: `remainingCount > 2` 조건이 기존 `remaining.length > MIN_RECENT_RAW_TURNS` 와 등가. `remainingCount -= 1` 이 매 iteration 에서 `cut += 1` 과 쌍으로 실행되므로 편차 없음.
  3. **예산 경계 정확히 일치 시**: `remainingTokens == tokenBudget` 이면 `> tokenBudget` 불성립, 루프 종료. 기존과 동일.
  
  한 가지 주의점: `if (!oldest) break` 가드(L260)는 `cut >= uncompressed.length` 일 때만 발동하는데, 이 조건은 `remainingCount > MIN_RECENT_RAW_TURNS` 에 의해 이론상 먼저 차단된다(`cut`이 `uncompressed.length - MIN_RECENT_RAW_TURNS` 에 도달하면 루프 조건 이탈). 즉 guard 는 실제로 도달 불가(dead guard)이지만, 존재해도 무해하므로 결함 아님.

### INFO — 잔존 O(n) 선형 비용 (숨은 O(n²) 없음)

- **위치**: L222, L228, L274, L298
- **상세**: 루프 외부에 O(n) 패스가 네 개 존재한다: `turns.filter(...)` (L222), `estimateWorkingMemoryTokens(uncompressed, ...)` (L228), `renderThreadAsSystemText(toCompress)` (L274), `toCompress.reduce(...)` (L298). 이들은 루프와 직렬이고 루프 내부에 없으므로 O(n) 상수 배수이지 O(n²)가 아니다. `toCompress.push(oldest)` 는 분할 상환 O(1). 다른 숨은 O(n²) 경로 없음.

---

## 요약

`buildSummaryBufferUpdate` 의 압축 선별 while 루프가 O(n²)(매 반복 전체 재합산 + 배열 shift) 에서 진짜 O(n)(단일 항 차감 + 인덱스 접근)으로 전환됐다. `estimateTokens` 가 순수 정수 연산(`Math.ceil`)이므로 부동소수점 누적 오차가 없고 증분식이 전체 합산과 수학적으로 동치다. 경계조건(빈 배열, `MIN_RECENT_RAW_TURNS`, 예산 정확 일치) 모두 기존과 동일하게 작동한다. 루프 외부의 선형 패스 네 개는 정상이며 중복/숨은 O(n²) 없음. 성능 관점에서 회귀 없이 목표 달성.

---

## 위험도

NONE

---

BLOCK: NO
