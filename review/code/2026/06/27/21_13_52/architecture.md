# Architecture Review

## 발견사항

### 발견사항 1
- **[INFO]** `ConversationThreadService.updateSummaryState()` 신설로 단일 writer 캡슐화 달성
  - 위치: `/codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts` +L1427–1441
  - 상세: 기존 `AiMemoryManager`는 `as MutableConversationThread` 직접 캐스트로 `runningSummary`/`summarizedUpToSeq`를 mutate했다. 이번 변경으로 해당 mutate가 서비스 경유로 대체됐다(I-7). `ConversationThreadService`가 thread의 유일한 writer라는 불변식이 이제 코드 수준에서 강제된다 — SRP·캡슐화 모두 개선.
  - 제안: `updateSummaryState`의 두 파라미터가 모두 optional(`runningSummary?: string; summarizedUpToSeq?: number`)이므로 `updateSummaryState(target, {})` 호출 시 기존 요약 상태가 `undefined`로 초기화될 수 있다. 현재 유일 호출부는 `summarized=true` 가드 안에서만 호출되므로 실질 위험은 없지만, 타입 시그니처 수준에서 의도를 강화하려면 `{ runningSummary: string | undefined; summarizedUpToSeq: number | undefined }` (required fields)로 변경하는 것이 더 명확하다.

### 발견사항 2
- **[INFO]** `readExtractionWatermark` 공유 순수 함수로 두 핸들러의 watermark 읽기 계약 단일화
  - 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` +L2956–2968
  - 상세: `ai_agent`(ai-turn-executor)와 `information_extractor` 양쪽에서 watermark 위치(`memoryState.lastExtractionTurnSeq` 우선 + 구 평면 키 폴백)를 동일하게 적용해야 하는 계약을 한 함수로 단일화했다. 배포 중 in-flight 파킹 실행에 대한 하위호환도 명시적으로 처리된다. 모듈 경계(nodes/ai/shared) 적절.
  - 제안: 파라미터 타입이 `Record<string, unknown> | undefined`로 매우 넓다. 두 핸들러의 resume state 타입이 다르기 때문에 현실적 제약이 있으나, 최소한 JSDoc에 "호출부는 핸들러 resume state root 를 그대로 전달해야 한다" 계약을 현행 수준 이상으로 명시하거나, 별도 `ResumeStateWithMemory` narrow 타입을 정의해두면 향후 리팩터링 시 오용을 방지할 수 있다.

### 발견사항 3
- **[INFO]** `buildCosineMatch` private 빌더로 cosine WHERE/score 식 중복 제거
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` +L2400–2426 (diff 기준 +735–768)
  - 상세: `recall`과 `findSimilarFact`가 동일한 SQL WHERE 절과 score 식을 각자 hardcode하던 것을 private 빌더로 추출했다. HNSW partial index 조건·파라미터 순서 계약·만료 row 제외 등 보안/정확성 critical 조건이 한 곳에서 관리된다(I5). DRY + 응집도 개선.
  - 제안: `buildCosineMatch`가 반환하는 `whereClause`는 `$1~$4` 파라미터 순서에 암묵적으로 의존한다. 현재 JSDoc에 계약이 명시돼 있으나, 미래 호출부 추가 시 오용 가능성이 있다. 파라미터 순서를 타입으로 강제할 방법은 없으므로 메서드 이름에 `WithParams`를 붙이거나, 반환 타입에 `paramOrder: readonly ['vector', 'workspaceId', 'scopeKey', 'threshold']` 같은 리터럴을 동반 반환하는 방식도 고려할 수 있다(현재 수준도 충분함).

### 발견사항 4
- **[INFO]** `AiMemoryManager.injectMemoryContext` 이중 thread 읽기 → 단일 읽기로 최적화
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` diff +L1806–1823
  - 상세: 이전에는 요약용으로 `getThreadExcludingNode`, 물리 압축 경계 계산용으로 `getThread`를 별도 호출했다. 이번 변경으로 `getThread` 한 번으로 전체 turns를 읽고, self 제외 turns를 in-memory `filter`로 파생한다. I/O-backed thread 전환 시 N+1 위험 제거(W-8). 레이어 경계 내에서 올바른 최적화.
  - 제안: `fullTurns`의 undefined 폴백이 구 코드의 `turns`(filtered)에서 신 코드의 `[]`로 변경됐다. 이는 service/target 부재 시 `keepUserExchanges=0`이 되어 messages 압축 경계가 항상 0이 된다. service 없는 경로에서는 이미 `turns=[]`이므로 `selectVolatileTail([], ...)` 역시 `[]`를 반환해 결과가 동일하지만, 의도적 변경임을 주석에 명시하면 향후 리뷰어가 오해하지 않는다.

### 발견사항 5
- **[INFO]** `saveMemories` 포지셔널 5파라미터 → 옵션 객체 리팩터 (I3)
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` diff +L353–368
  - 상세: 포지셔널 파라미터는 새 선택적 파라미터 추가 시 호출부 전체 변경 강제(OCP 위반 위험), 순서 오용 오류 등의 문제를 가진다. 옵션 객체로의 전환은 이를 해소하고 `ttlDays` 같은 선택적 파라미터의 의미를 호출부에서 명시적으로 표현한다. 호출부 14곳(서비스·프로세서·테스트)이 일관되게 갱신됐다.
  - 제안: 없음. 변경 방향과 범위 모두 적절.

### 발견사항 6
- **[INFO]** `memoryState` sub-namespace 운반(I12) — 두 핸들러 대칭 적용 + 하위호환
  - 위치: `ai-turn-executor.ts` diff +L2848–2349, `information-extractor.handler.ts` diff +L1399–1423
  - 상세: resume state 최상위에 평면으로 있던 `lastExtractionTurnSeq`를 `memoryState` 네임스페이스로 그룹화해 향후 메모리 관련 상태 필드 확장에 대응한다. `ai-turn-executor`의 namespace 병합(`...existingMemoryState`)이 타 키 보존까지 고려했다. 두 핸들러 모두 `readExtractionWatermark`로 통일해 정책 분산을 막았다.
  - 제안: `information-extractor.handler.ts`의 `hydrateState` 내 IIFE 패턴이 약간 관용적이지 않다. 인라인 삼항으로 충분하거나(`const seq = readExtractionWatermark(raw); return { ..., memoryState: seq !== undefined ? { lastExtractionTurnSeq: seq } : undefined };`), 별도 1줄 helper로 분리하면 가독성이 개선된다. 기능적 문제는 없음.

### 발견사항 7
- **[WARNING]** `AgentMemoryService`의 admin 기능 SRP 미분리 — 계속 미완 상태
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (전체)
  - 상세: plan에 `AgentMemoryAdminService` 분리(SRP — admin read/delete를 런타임 메모리 서비스에서 분리)가 백로그로 명시돼 있다. 이번 변경이 서비스에 새로운 기능(`buildCosineMatch`)을 추가했으나 admin 분리는 진행되지 않았다. 현재 서비스가 런타임 recall/save + admin 조회/삭제 + SQL 빌더를 모두 담당해 SRP 위반 상태가 유지된다. 이번 PR 범위 밖이고 plan에 명시된 backlog이나, 서비스 크기가 지속 증가하는 추세임을 주의해야 한다.
  - 제안: `AgentMemoryAdminService` 분리를 다음 변경에서 우선 처리할 것을 권장한다. 현재는 WARNING 수준이며 기능 정확성에 영향이 없다.

---

## 요약

이번 변경(Batch 2)은 `agent-memory` 서비스 및 AI 노드 메모리 매니저에 누적된 4가지 아키텍처 부채(I-3, I-5, I-7, I12)를 체계적으로 해소한다. `ConversationThreadService`가 thread의 유일한 writer로 강화되면서 레이어 책임 경계가 명확해졌고, `saveMemories` 옵션 객체화로 OCP 수준의 확장성이 개선됐으며, `buildCosineMatch`와 `readExtractionWatermark` 두 공유 빌더가 SQL 중복과 watermark 계약 분산을 각각 해결했다. 하위호환 폴백 설계(in-flight 파킹 실행 보호)가 모든 migration 경로에 일관되게 적용된 점도 긍정적이다. `AgentMemoryAdminService` SRP 미분리가 유일한 잔존 아키텍처 부채이나 이는 기존 backlog이며 이번 변경의 범위 밖이다. 순환 의존성 유입 없음, 레이어 방향 유지 확인.

## 위험도

LOW
