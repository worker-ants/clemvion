## 발견사항

### [INFO] 타이머 기반 병렬성 검증의 잠재적 취약성
- **위치**: `spec.ts:411` — `executes provider tool calls within a turn concurrently`, `spec.ts:2173` — multi-turn 대응 테스트
- **상세**: `inFlight` 카운터 + `setTimeout(30ms)` 방식은 Node.js 이벤트 루프가 두 타이머를 실제로 인터리빙해야 성립한다. Jest가 `jest.useFakeTimers()`를 쓰지 않으므로 실제 OS 타이머를 사용한다. CI 머신이 극단적으로 부하 상태라면 `maxInFlight`가 1로 관측되는 간헐적 플레이크 가능성이 존재한다.
- **제안**: `jest.useFakeTimers()` + `jest.runAllTimersAsync()` 조합으로 결정적 검증으로 전환하거나, 혹은 `setTimeout` 대신 `setImmediate` 기반 microtask로 교체해 이벤트 루프 인터리빙을 보장한다. 30ms는 실제로 거의 항상 동작하므로 현재 위험도는 낮으나 기록해 둘 가치가 있다.

---

### [WARNING] multi-turn 경로에 batch truncate 테스트 없음
- **위치**: `handler.ts:954–994` — `processMultiTurnMessageInner` 내 truncate 로직
- **상세**: `truncates within-batch` 테스트는 `handler.execute()`(single-turn)만 커버한다. multi-turn 경로의 `providerBudget` / `providerTruncated` 코드(diff +954 구간)는 동일한 로직이지만 독립된 회귀 가드가 없다. 두 경로가 동시에 수정될 때 한쪽이 깨져도 테스트가 잡지 못한다.
- **제안**: `runs provider tools in parallel on multi-turn resume too` 테스트에 `maxToolCalls: 2`·3개 tool_use 시나리오를 추가하거나, 별도 `truncates batch on multi-turn resume` 테스트를 작성한다.

---

### [WARNING] 실패한 tool call의 ragDiagnostics 누적 검증 누락
- **위치**: `spec.ts` — `isolates partial failures` 테스트
- **상세**: `KbToolProvider.execute()` 는 검색 실패 시 `ragDiagnosticsDelta: { kbId, query, resultCount: 0 }` 를 함께 반환하며, 핸들러는 이를 `ragGroup.pushDiagnostic()`으로 누적한다. 그러나 해당 테스트는 실패한 호출의 `ragDiagnostics.queriesUsed` 또는 `attempted` 누적 여부를 검증하지 않는다. 향후 실패 경로에서 diagnostic 누적을 제거해도 테스트가 통과한다.
- **제안**: 테스트 끝에 `meta.ragDiagnostics.queriesUsed`에 `'ok'`와 `'fail'` 양쪽 쿼리가 포함되는지 혹은 `resultCount === 0` (fail의 0 + ok의 1 = 1) 인지 assert 추가.

---

### [WARNING] `meta.toolCalls` 미검증 테스트가 다수 존재
- **위치**: `dedupes ragSources` 테스트, `isolates partial failures` 테스트
- **상세**: 두 테스트 모두 두 개의 provider tool이 실행되므로 `meta.toolCalls === 2` 를 기대할 수 있다. 이를 검증하지 않아 `toolCallCount++` 루프가 잘못 수정돼도 통과한다. 반면 `truncates within-batch` 테스트는 `meta.toolCalls`를 검증해 대비가 된다.
- **제안**: 두 테스트에 `expect(meta.toolCalls).toBe(2)` assert 추가.

---

### [INFO] private method 타입 캐스팅 접근의 취약성
- **위치**: `spec.ts:2240`
- **상세**: `processMultiTurnMessage`를 `handler as unknown as { processMultiTurnMessage: ... }` 방식으로 호출한다. 메서드 rename 시 TypeScript 컴파일 에러 없이 런타임 `undefined is not a function`으로만 발견된다.
- **제안**: `processMultiTurnMessage`를 `@internal` 주석과 함께 `public`으로 유지하거나, 테스트에서 `(handler as any).processMultiTurnMessage` 대신 노출된 public entry point를 통해 검증하는 구조를 고려한다. 현재 접근은 관용적이므로 INFO 수준.

---

### [INFO] e2e skip 재활성화 추적 메커니즘 부재
- **위치**: `app.e2e-spec.ts:8` — `describe.skip`
- **상세**: 인프라 준비 전까지 스킵한다는 이유가 주석으로 명시되어 있으나, 이 조건이 충족됐을 때 자동으로 감지할 장치가 없다. `describe.skip`은 CI 결과에서 "0 tests" 로 보이거나 아예 표시되지 않아 장기 방치될 위험이 있다.
- **제안**: 이슈 트래커에 "e2e re-enable" 항목을 연결하거나, `jest.config.json`의 `testPathIgnorePatterns`로 명시적으로 제외하고 `TODO(#이슈번호)` 주석을 남겨 추적 가능하게 한다.

---

### [INFO] multi-turn dedup (턴 간) 테스트 없음
- **위치**: `RagAccumulator.fromState()` — `handler.ts`
- **상세**: `dedupes ragSources` 테스트는 동일 turn 내 병렬 호출의 chunkId 중복을 검증한다. 그러나 `RagAccumulator.fromState()`를 통한 **이전 turn에서 이미 수집된 chunkId의 중복 제거** 경로는 테스트되지 않는다. multi-turn 대화에서 같은 chunk가 여러 턴에 걸쳐 반환될 때 `ragSources`가 중복 삽입되는지 검증하는 테스트가 필요하다.
- **제안**: multi-turn resume 테스트에서 `resumeState.ragSources`에 이미 `chunkId: 'c-1'`을 포함시키고, 새 turn에서 동일 chunkId가 반환돼도 `meta.ragSources`에 1건만 남는지 assert 추가.

---

## 요약

핵심 신규 기능(Promise.all 병렬 실행·batch truncate·chunkId dedup·부분 실패 격리)에 대한 단위 테스트가 명확한 의도와 구조로 추가되었으며, single-turn 경로를 기준으로 충분히 커버된다. 주요 갭은 **multi-turn 경로의 batch truncate 테스트 누락**으로, 두 경로의 동일 로직이 독립적으로 변경될 때 회귀를 잡지 못할 위험이 있다. 그 외 `meta.toolCalls` 미검증·실패 경로의 ragDiagnostics 누적 미검증 등 assert 보완이 필요한 부분이 있으나 전체적인 테스트 설계는 견고하다.

## 위험도

**LOW–MEDIUM** — 핵심 경로는 커버되나 multi-turn truncation 누락이 중간 위험 요소.