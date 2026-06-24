# 동시성(Concurrency) 리뷰 결과

## 발견사항

변경 코드는 아래 두 가지 수정을 포함한다.

1. `recordMultiTurnNonProviderToolResults` 에서 condition deferral 에 대한 `toolCallCount++` 제거 (SPEC-DRIFT 해소)
2. condition-route 의 `Date.now()` 이중 호출 → 단일 캡처 (`condRouteDurationMs`)
3. `'tool_call_budget_exceeded'` 인라인 문자열 → `TOOL_BUDGET_EXCEEDED_ERROR` 상수 추출
4. JSDoc 경로 보완

### 경쟁 조건·스레드 안전성·동기화

해당 없음. 이 파일의 `AiTurnExecutor` 는 클래스 자체가 **무상태(stateless) collaborator** 로 설계되어 있고(JSDoc에 명시), 실행별 가변 상태를 인스턴스 필드에 보유하지 않는다. 모든 가변 상태(`toolCallCount`, `messages`, `ragAcc` 등)는 **호출 스택 로컬 변수**로만 존재하므로 다중 동시 실행 간 공유 자원 충돌이 구조적으로 발생하지 않는다.

### async/await

- `executeProviderToolBatch` 의 `Promise.all` 병렬 실행이 이미 존재하며 이번 변경이 그 경로를 건드리지 않는다. await 누락 없음.
- `handleSingleTurnConditionRoute` (single) 및 multi-turn condition 경로 모두 `await` 가 올바르게 사용되어 있다.

### Date.now() 단일 캡처 (INFO)

- **[INFO]** `condRouteDurationMs = Date.now() - singleTurnStartedAt` 단일 캡처 후 두 곳(trace `totalDurationMs`, `turnDebug[]` `totalDurationMs`)에서 동일 값을 재사용하도록 변경.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (single-turn: 약 L1300, multi-turn: 약 L2138)
  - 상세: 이전 코드에서 `Date.now() - singleTurnStartedAt` / `Date.now() - turnStartedAt` 를 두 번 호출해 두 필드 간 미세한 시각 차이가 발생할 수 있었다. 이번 캡처 통일로 trace 와 turnDebug 가 항상 동일 `durationMs` 를 참조하게 됐다. 동시성 버그는 아니나 타임스탬프 일관성 개선.
  - 제안: 현행 수정이 올바른 방향이며 추가 조치 불필요.

### 원자성

- `toolCallCount` 카운터는 단순 지역 변수(`let toolCallCount = args.toolCallCount`)로 관리되며, 해당 메서드 내에서 순차 for 루프로만 증가한다. 병렬 접근 없음. 원자성 이슈 없음.

### 이벤트 루프 블로킹

- 변경 범위 내에 동기 블로킹 연산 없음. `Promise.all` 병렬 도구 실행은 기존 구조 유지.

### 리소스 풀링

해당 없음.

---

## 요약

이번 변경은 multi-turn condition deferral 의 `toolCallCount++` 제거(SPEC-DRIFT 해소)와 `Date.now()` 이중 호출 → 단일 캡처, 인라인 문자열 → 상수 추출이 전부다. `AiTurnExecutor` 가 무상태 collaborator 구조를 유지하고 있어 경쟁 조건·데드락·스레드 안전성·원자성 문제가 발생할 여지가 구조적으로 없다. `Date.now()` 단일 캡처는 동시성 버그 수정이라기보다 trace 일관성 보완이며, 방향은 올바르다. 동시성 관점 위험 요소 없음.

## 위험도

NONE
