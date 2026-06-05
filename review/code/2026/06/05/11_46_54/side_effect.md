# Side Effect Review — B3: O(n²) → O(n) incremental token recompute

**Diff**: `git diff 57d366b6..HEAD -- codebase/`
**Target**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts`
**Date**: 2026-06-05

---

## 발견사항

### INFO: `fixedOverhead` / `remaining` 변수 완전 제거 확인

- 위치: `buildSummaryBufferUpdate` 함수 내부 (Lines 241–265)
- 상세: 제거된 `fixedOverhead` 변수(두 줄)와 `remaining = [...uncompressed]` 배열은 루프 이후 어디서도 참조되지 않았음. `grep` 결과 신규 코드 전체에서 해당 식별자 미발견(주석 제외). 제거 안전.
- 제안: 없음.

### INFO: `remainingCount` vs `remaining.length` — 조건 동일성

- 위치: while 조건 `remainingCount > MIN_RECENT_RAW_TURNS`
- 상세: 구 코드는 `remaining` 배열에서 `shift()`로 요소를 제거하며 `remaining.length`를 감소시켰고, 신 코드는 `remainingCount -= 1`로 대응한다. 두 값은 매 iteration 동일하게 감소하므로 루프 종료 조건이 bit-identical.
- 제안: 없음.

### INFO: `remainingTokens` 감산 동일성

- 위치: `remainingTokens -= estimateTurnTokens(oldest)` (Line 262)
- 상세: 구 코드는 매 iteration 마다 `fixedOverhead + estimateWorkingMemoryTokens(remaining)` 으로 전체 합산을 재계산했다 (O(n) per iteration). 신 코드는 `currentTokens = fixedOverhead + Σ estimateTurnTokens(uncompressed)` 불변식 하에 oldest 의 토큰만 차감한다. `estimateWorkingMemoryTokens`가 단순 Σ 합산이므로 수학적으로 동일.
- `estimateTurnTokens`가 순수 함수(turn.text만 읽음, 부작용 없음)이고 루프 내에서 동일 turn 에 두 번 호출(push 후 차감)하지만 결과는 고정값이므로 문제 없음.
- 제안: 없음.

### INFO: off-by-one / 예산 경계 조건 (`>` vs `>=`)

- 위치: while 조건 `remainingTokens > tokenBudget`
- 상세: 구·신 모두 `>` 사용. `remainingTokens == tokenBudget` 이면 루프를 탈출(압축 안 함). 경계값에서 동일 동작. 진입 조건(line 234: `currentTokens <= tokenBudget`)도 변경 없음. off-by-one 없음.
- 제안: 없음.

### INFO: 마지막 turn 처리

- 위치: `uncompressed[cut]` + `if (!oldest) break;`
- 상세: `remainingCount > MIN_RECENT_RAW_TURNS` 조건에 의해 `cut` 인덱스는 최대 `uncompressed.length - MIN_RECENT_RAW_TURNS - 1`까지만 도달한다. 즉 `uncompressed[cut]`이 `undefined`가 되는 경우는 이론상 발생하지 않지만, 방어 `if (!oldest) break;`는 구 코드와 동일하게 유지되어 있어 안전.
- 제안: 없음.

### INFO: `estimateTurnTokens` 내보내기 추가

- 위치: `agent-memory-injection.spec.ts` 내 `referenceCut` 오라클 + import
- 상세: `estimateTurnTokens`이 기존 export 였는지 확인. 신규 테스트에서 import하여 사용하므로 export가 필요하다. `agent-memory-injection.ts` 36행을 확인하면 `export function estimateTurnTokens`로 이미 export 되어 있으나, 해당 심볼이 스펙 파일에 import 추가(`+  estimateTurnTokens,`)된 것만 확인됨. 테스트 전용 노출이고 기존 public API surface에 변화 없음.
- 제안: 없음.

---

## 요약

`buildSummaryBufferUpdate` 내 압축 루프 리팩토링은 `fixedOverhead + estimateWorkingMemoryTokens(remaining)` 전체 재합산을 `remainingTokens -= estimateTurnTokens(oldest)` 증분 차감으로 대체한다. `estimateWorkingMemoryTokens`가 단순 덧셈이고 `estimateTurnTokens`가 순수 함수이므로 두 표현은 수학적으로 동일하다. 루프 종료 조건(`remainingCount`), 예산 경계(`>`), 마지막 turn 방어 코드 모두 원본과 bit-identical이다. 제거된 `remaining` 배열 및 `fixedOverhead` 변수는 루프 이후 어디서도 사용되지 않았음이 grep으로 확인된다. 의도치 않은 상태 변경·전역 변수·네트워크 호출·파일시스템 부작용은 발견되지 않는다.

---

## 위험도

NONE

---

BLOCK: NO
