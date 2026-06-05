# Testing Review — memory-backlog-a2-fe9c8f (7afa9ae0..HEAD)

대상 변경: `perf(agent-memory): listScopes 단일쿼리 COUNT(*) OVER`, `test(ai-agent): summary_buffer 경계 케이스 보강`, `refactor(ai-agent): embeddingModel widget expression 통일`

---

## WARNING: listScopes `q` 필터 테스트 — result.total·items 검증 없음

**위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts:818-829`

**상세**: "q 가 있으면 scope_key ILIKE …" 테스트는 SQL/파라미터 구조만 검증하고 `result.total`과 `result.items` 반환 값을 전혀 단언하지 않는다. q 필터와 단일쿼리 통합 이후 total 파생 로직이 올바른지(q 있을 때도 `rows[0]?.total ?? 0`가 정상 동작하는지) 검증되지 않는다.

**제안**: mock 응답에 `total` 필드 포함 행을 리턴하도록 수정하고, `result.total`·`result.items` 반환 값을 단언할 것.

```typescript
mockDataSource.query.mockResolvedValueOnce([
  { scope_key: 'cust-11', count: '2', latest_updated_at: new Date('2026-06-01T00:00:00Z'), total: '1' },
]);
const result = await service.listScopes('ws-9', { limit: 10, offset: 5, q: 'cust' });
expect(result.total).toBe(1);
expect(result.items[0].scopeKey).toBe('cust-11');
```

---

## WARNING: offset-초과 시 total=0 동작 — 의미론적 회귀 가드 부재

**위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts:831-840`

**상세**: 기존 2-query 방식에서는 offset 이 전체 그룹 수를 초과해도 COUNT 서브쿼리가 실제 total 을 반환했다(예: total=5, items=[]). 단일쿼리 CTE + `COUNT(*) OVER()` 방식에서는 OFFSET 이 CTE 결과를 전부 스킵하면 행이 없어 `rows[0]` 이 `undefined` → `total: 0`으로 변환된다. 이는 동작 변경(의도적으로 코드 주석에 명시됨)이지만, 호출부(controller: `offset=60, limit=30 → page 3` 테스트)에서 `total: 100`을 mock 으로 직접 주입하므로 실제 서비스 레이어의 이 회귀는 controller 테스트로는 검출되지 않는다.

현재 테스트(`빈 결과(또는 offset 초과)면 total 0`)는 **새 동작을 명시적으로 단언**하고 있어 회귀 가드로서는 올바르나, 이 동작 변경이 UI 페이지네이션(totalPages 계산)에 미치는 영향에 대한 커버리지는 없다.

**제안**: spec 또는 controller 레이어에서 "offset 초과 시 total=0 가 pagination UI에 미치는 영향"을 명시적으로 단언하는 통합 케이스 추가를 검토할 것. 단, 서비스 단 테스트로서 현 단언은 충분하다 — controller spec에 offset-초과 경로를 추가하는 것이 바람직.

---

## INFO: B3-a 오라클(referenceCut) 신뢰성 — runningSummary≠undefined 경로

**위치**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts:657-734`

**상세**: B3-a 테스트의 오라클 `referenceCut`은 `currentTokens`를 외부에서 주입받아 `fixedOverhead = currentTokens - Σ estimateTurnTokens(uncompressed)` 로 계산한다. B3-a 에서 `currentTokens` 는 `estimateWorkingMemoryTokens(turns, systemPromptText, summaryBlockText)` 로 직접 계산해 전달하므로, 오라클 fixedOverhead = `estimateTextTokens(systemPromptText) + estimateTextTokens(summaryBlockText)` 가 된다. 구현의 `buildSummaryBufferUpdate` 도 동일한 `estimateWorkingMemoryTokens(uncompressed, systemPromptText, summaryBlockText)` 를 사용하므로 오라클과 동일한 고정 오버헤드를 가정한다 — bit-identical 보장은 수학적으로 타당하다.

`summarizedUpToSeq=undefined` 조건 하에 `uncompressed === turns` (전체) 임을 B3-a 주석에서도 확인. 오라클 신뢰도 양호.

---

## INFO: B3-b 경계 테스트 — `currentTokens-1` 대조 검증

**위치**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts:736-781`

**상세**: 경계 no-op 테스트(`tokenBudget === currentTokens`)는 `llm.chat` 미호출을 단언하고, 한 토큰 줄인 `currentTokens-1` 에서 압축이 트리거됨을 대조로 확인한다. 구현의 `if (currentTokens <= tokenBudget)` 조건(inclusive)을 정확히 핀한다. 오라클 없이 화이트박스로 조건 경계를 테스트하는 방식이 명확하다.

단, `update2.summarizedUpToSeq` 값(어떤 seq 까지 압축됐는지)은 단언하지 않는다 — 기존 다른 테스트에서 커버되므로 이 케이스에서는 생략이 합리적이다.

---

## INFO: B3-a — 압축 no-op 경로에서 runningSummary 보존 단언 추가됨

**위치**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts:706-710`

**상세**: 기존 B3 오라클 테스트(runningSummary=undefined 경로)에는 없던 `expect(update.runningSummary).toBe(priorSummary)` 단언이 B3-a 에서 추가됐다. `noChange` 반환 시 기존 요약이 유실되지 않음을 명시 검증한다 — 실제 구현 `noChange = { runningSummary, summarizedUpToSeq, summarized: false }` 와 정합하며, 이 불변식을 처음 핀한 케이스로 유의미하다.

---

## INFO: listScopes 단일쿼리 — SQL 구조 검증 충분성

**위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts:787-797`

**상세**: `COUNT(*) OVER()`, `GROUP BY am.scope_key`, `MAX(am.updated_at)`, `FROM agent_memory`, `am.workspace_id = $1` 를 모두 개별 `toContain` 으로 단언한다. CTE 형태인지(`WITH grouped AS`)는 검증하지 않지만, 기능 보장(단일쿼리, 윈도우 total)을 위한 필수 요소는 커버된다. SQL 구조 검증 수준 적절.

---

## INFO: embedding 미선택 테스트 — 단일쿼리 후 mock 갱신 완료

**위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts:857-861`

**상세**: 기존 2-call mock(`.mockResolvedValueOnce([]).mockResolvedValueOnce(...)`)에서 단일 `mockResolvedValueOnce([])` 로 정상 갱신됐다. `listSql` 에 `embedding` 미포함 단언 유효.

---

## INFO: ai-agent.schema.ts 변경 — 테스트 불필요

**위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:596`

**상세**: `widget: 'text'` → `widget: 'expression'` 변경은 UI 메타데이터 필드 변경으로, 런타임 로직에 영향 없다. 이 변경에 대한 별도 테스트는 불필요.

---

## 요약

**listScopes 단일쿼리 리팩터링**: mock 이 단일쿼리 형태로 올바르게 갱신됐으며, `toHaveBeenCalledTimes(1)` 단언이 추가돼 2-쿼리 경로로의 회귀가 즉시 탐지된다. `total` 파생(윈도우 함수), `페이지 < 전체`, `offset 초과 시 total=0` 등 핵심 케이스가 신규 추가됐다. 단, `q` 필터 테스트에서 `result.total`·`result.items` 반환 값 검증이 빠져 있어 q 경로의 total 파생 정확성이 완전히 검증되지 않는다.

**B3 summary_buffer 테스트**: `runningSummary≠undefined` 경로(B3-a)의 오라클 정합성은 수학적으로 타당하며, `budget==currentTokens` 경계(B3-b)의 inclusive no-op 조건 핀도 정확하다. 새로 추가된 두 케이스 모두 의도를 명확히 표현하고 오라클 신뢰도가 높다. 회귀 0 — 기존 케이스 모두 mock 갱신이 올바르게 이루어졌다.

---

BLOCK: NO
