### 발견사항

---

**[MEDIUM] Promise.all에 동시성 상한선 없음**
- 위치: `ai-agent.handler.ts` — `executeSingleTurn` ~line 566, `processMultiTurnMessageInner` ~line 954
- 상세: `Promise.all(providerToRun.map(...))` 는 배치 내 모든 KB tool call을 제한 없이 동시 실행한다. `maxToolCalls=50`이고 LLM이 한 응답에 10개 이상의 `tool_use`를 emit할 경우, 동시에 10개의 임베딩 API 호출(rate-limit 위험)과 10개의 pgvector 쿼리(DB 커넥션 풀 소진 위험)가 발생한다. 현실적 워크로드(2–5개)에서는 문제없지만, 이 핸들러는 `maxToolCalls`를 외부 config으로 받으므로 상한 보장이 없다.
- 제안: `p-limit`(이미 `jest-e2e.json`의 `transformIgnorePatterns`에 등장) 또는 `Promise.all`을 청크 단위로 분할하는 소형 헬퍼로 동시성을 제한. 즉각적 위험은 낮지만 스케일업 시 회귀 벡터가 된다.

---

**[LOW] KbToolProvider.execute 내 KB 메타 이중 조회**
- 위치: `kb-tool-provider.ts` — `execute()` 내 `this.knowledgeBaseService.findById(kbId, ...)`, `buildTools()` 내 `Promise.allSettled(kbIds.map(...))`
- 상세: `buildTools` 단계에서 모든 KB 메타를 `Promise.allSettled`로 일괄 조회한 다음, 각 tool call의 `execute()` 시점에 KB 이름을 얻기 위해 동일 `kbId`로 `findById`를 재호출한다. 이전에는 serial 실행이라 순차적 재조회였지만, 이번 변경으로 `Promise.all` 병렬화되어 배치 내 N개가 동시에 동일 중복 쿼리를 발행한다. 총 DB 호출 횟수는 동일하지만 순간 peak 커넥션 사용이 증가한다.
- 제안: `buildTools`에서 조회한 메타를 `Map<kbId, KbMeta>`로 캐싱하여 `execute()` 호출 컨텍스트에 전달하거나, `execute()`의 `kbName` 조회를 `try/catch` 블록 밖에서 실패 허용 형태로 유지하되 `buildTools` 결과를 provider 인스턴스에 단기 캐싱한다.

---

**[LOW] 테스트에 실제 타이머(real timers) 사용**
- 위치: `ai-agent.handler.spec.ts` — `'executes provider tool calls within a turn concurrently'` (~line 422), `'runs provider tools in parallel on multi-turn resume too'` (~line 2173)
- 상세: `await new Promise<void>((resolve) => setTimeout(resolve, 30))`을 mock 구현에 사용한다. `jest.useFakeTimers()` 없이 실제 타이머를 소비하므로 각 테스트가 최소 30ms wall-clock을 소모한다(2개 병렬 호출 기준 30ms, 3개 기준도 동일). CI에서 이 패턴이 누적되면 스위트 전체 실행 시간이 늘어난다.
- 제안: `jest.useFakeTimers()` + `jest.runAllTimersAsync()`를 사용해 가상 시간으로 교체. `maxInFlight` 측정 로직은 그대로 동작하면서 wall-clock 소비가 제거된다.

---

**[INFO] 동일 배열 대상 이중 slice 연산**
- 위치: `ai-agent.handler.ts` — `providerToRun = ...slice(0, providerBudget)`, `providerTruncated = ...slice(providerBudget)` (single-turn 및 multi-turn 각 1회씩)
- 상세: 동일 배열에 대해 slice를 두 번 호출한다. N이 `maxToolCalls` 이하(보통 10 이하)로 작아 실질 비용은 무시 가능하지만, 단일 반복으로 합산 가능한 패턴이다.
- 제안: 현 코드의 가독성이 더 좋으므로 변경 불필요. INFO 수준으로 기록.

---

**[INFO] RagAccumulatorGroup.pushSources 이중 순회**
- 위치: `ai-agent.handler.ts` — `RagAccumulatorGroup.pushSources`
- 상세: `node` accumulator와 `turn` accumulator 각각의 `seenChunkIds` Set이 독립적이므로, 동일 `items` 배열을 두 번 순회한다. 두 Set의 상태가 다를 수 있어(node는 멀티턴 누적, turn은 단일턴) 이중 순회는 의미상 정확하다. 실용적 비용은 무시 가능.
- 제안: 현행 유지.

---

### 요약

이번 변경의 핵심인 `Promise.all` 병렬화는 명확한 latency 개선이다. serial O(N·t) → parallel O(t) 전환은 agentic RAG의 실질적 병목을 정확히 겨냥한다. 다만 동시성 상한선이 없어 `maxToolCalls`를 크게 설정하거나 LLM이 한 응답에 많은 `tool_use`를 emit할 경우 임베딩 API rate-limit과 DB 커넥션 풀 압박이 동시에 발생할 수 있다. 현재 기본값(maxToolCalls=10) 기준으로는 실질 위험이 낮다. KB 메타 이중 조회 문제는 병렬화 전에도 존재했으나 병렬 실행으로 peak 부하 패턴이 변경되었으므로 중기적으로 캐싱 검토가 권장된다. 나머지 발견사항은 코드 정확성에 영향 없는 미세 개선 수준이다.

### 위험도

**LOW**