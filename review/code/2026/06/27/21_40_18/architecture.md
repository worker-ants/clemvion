# Architecture Review

## 발견사항

### 발견사항 1
- **[WARNING]** `AgentMemoryService` SRP 위반 — 런타임·admin·SQL 빌더 단일 서비스 혼재 지속
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (전체)
  - 상세: 이번 변경(I5)으로 `buildCosineMatch` private 빌더가 추가되어 서비스 내 SQL 빌딩 책임이 더 구체화됐다. 런타임 recall/save + admin 조회/삭제 + SQL fragment 빌딩이 단일 클래스에 공존하는 SRP 위반 상태가 계속된다. `buildCosineMatch`가 private이라 외부 노출은 없으나 클래스 크기는 계속 증가 추세다. 기존 plan 백로그(`AgentMemoryAdminService` 분리, Batch 3 예정)에 명시된 사항이며 이번 PR 범위 밖이다.
  - 제안: `AgentMemoryAdminService` 분리를 Batch 3에서 진행 시 SQL 빌더(`buildCosineMatch`)를 별도 `AgentMemoryQueryBuilder` 또는 inline으로 서비스에 귀속시킬지 설계 방향을 사전 결정할 것을 권장한다.

### 발견사항 2
- **[INFO]** `updateSummaryState` 도입으로 `ConversationThreadService` 단일 writer 강화 — 긍정적 캡슐화
  - 위치: `/codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts`
  - 상세: 이전에 `AiMemoryManager`가 `as MutableConversationThread` 직접 캐스트로 thread 필드를 mutate하던 패턴이 서비스 경유로 대체됐다(I-7). 레이어 경계(`nodes` 레이어가 `modules` 레이어 서비스를 경유)가 올바르게 유지된다. SRP·캡슐화 모두 개선.
  - 제안: `updateSummaryState` 시그니처 `{ runningSummary?: string; summarizedUpToSeq?: number }`의 두 필드가 모두 optional이지만 JSDoc과 테스트에서 "항상 함께 제공" 계약이 명시됐다. 타입 수준 강제를 원한다면 두 필드를 required(`string | undefined`, `number | undefined`)로 변경하는 방법도 있으나, 현재 테스트 커버리지(빈 객체 클리어 케이스 포함)와 JSDoc으로 계약이 충분히 보호된다.

### 발견사항 3
- **[INFO]** `buildCosineMatch` 파라미터 순서 계약 — 타입 시스템 외부에 존재하는 암묵적 인터페이스
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `buildCosineMatch` 반환 타입
  - 상세: `buildCosineMatch`가 반환하는 `whereClause`/`scoreExpr`는 호출부가 `[vector, workspaceId, scopeKey, threshold]` 순서로 바인딩 배열을 전달해야 한다는 암묵적 계약을 포함한다. 이 계약은 JSDoc과 테스트(I5 파라미터 순서 어설션)로 보강됐으나 TypeScript 타입 시스템으로는 강제되지 않는다. private 메서드라 현재 호출부 2곳(recall, findSimilarFact) 모두 올바른 순서를 사용한다. 추상화 관점에서 SQL fragment와 파라미터 순서 계약이 분리된 채 반환되는 구조가 향후 호출부 추가 시 취약점이 될 수 있다.
  - 제안: 설계 강화 옵션 — `buildCosineMatch`가 파라미터 값 자체를 받아 `{ sql: string; params: unknown[] }` 쌍을 반환하는 형태로 전환하면 계약을 타입 내부로 흡수할 수 있다. 현재 규모(호출부 2곳, private)에서는 현행 구조 + 테스트로 충분히 안전하나, 향후 호출부 추가 시 이 방향을 고려할 것.

### 발견사항 4
- **[INFO]** `readExtractionWatermark` 공유 유틸리티 — 적절한 모듈 경계 및 단일화
  - 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`
  - 상세: `ai_agent`(ai-turn-executor)와 `information_extractor` 양쪽에서 watermark 읽기 우선순위 규칙(신 namespace 우선 + 구 평면 키 폴백)을 동일하게 적용하기 위해 `nodes/ai/shared` 레이어에 단일화됐다. 두 핸들러 모두 이 함수를 import하므로 정책 분산이 제거된다. 모듈 배치(공유 레이어)와 책임(watermark 계약 단일 진실)이 적절하다. 하위호환 폴백(in-flight 파킹 실행 보호)이 아키텍처적으로 명시적으로 설계됐다.
  - 제안: 없음. 현재 배치와 설계 모두 적절하다.

### 발견사항 5
- **[INFO]** `memoryState` sub-namespace — 확장성 있는 resume state 스키마 설계
  - 위치: `ai-turn-executor.ts`, `information-extractor.handler.ts`, `MultiTurnState` 타입 정의
  - 상세: 평면 최상위 키(`lastExtractionTurnSeq`)를 `memoryState` 네임스페이스로 그룹화함으로써 향후 메모리 관련 상태 필드(예: recall 결과 캐시, 요약 상태 마커 등) 추가 시 최상위 resume state를 오염시키지 않는 확장성을 확보했다(I12). `ai-turn-executor`의 spread 병합(`{ ...existingMemoryState, lastExtractionTurnSeq }`)이 타 키 보존까지 고려된 점, `InformationExtractorHandler`의 `MultiTurnState` 타입도 `memoryState?: { lastExtractionTurnSeq?: number }`로 갱신된 점이 일관성을 보장한다.
  - 제안: 두 핸들러의 `memoryState` 타입이 각자 정의(`ai-turn-executor`는 runtime spread 시 `Record<string, unknown>`, `InformationExtractorHandler`는 `MultiTurnState` 인라인 타입)로 중복된다. 향후 `memoryState` 키가 추가될 경우 두 곳을 동시에 변경해야 한다. 공유 `MemoryState` 인터페이스를 `nodes/ai/shared`에 정의하면 단일 진실이 된다. 현재 규모(키 1개)에서는 필수는 아니나 네임스페이스 확장 시 고려할 것.

### 발견사항 6
- **[INFO]** `AiMemoryManager` 단일 thread 읽기 최적화 — 레이어 내 올바른 리팩터
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`
  - 상세: 요약용 `getThreadExcludingNode` + 압축 경계 계산용 `getThread` 이중 호출이 `getThread` 1회 + in-memory `filter`로 단일화됐다(W-8). I/O-backed thread 전환 대비 N+1 위험 제거이며, `getThreadExcludingNode`가 `getThread().turns.filter(nodeId)`와 동치이므로 정확성도 동일하다. 레이어 내부 최적화로 인터페이스 변경 없이 성능 특성을 개선했다.
  - 제안: `fullThread`가 undefined일 때 `fullTurns`가 빈 배열(`[]`)로 폴백하는 변경이 구 코드의 `turns`(filtered, 빈 배열) 폴백과 결과는 동일하나 경로가 다르다. 주석에 이미 명시되어 있어 충분하다.

### 발견사항 7
- **[INFO]** `saveMemories` 옵션 객체 전환 — OCP 관점의 긍정적 API 설계
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts`
  - 상세: 포지셔널 5파라미터 → 옵션 객체 전환(I3)으로 향후 선택적 파라미터 추가 시 기존 호출부 변경이 불필요해졌다(OCP). `ttlDays` 같은 선택적 파라미터의 의미가 호출부에서 명시적으로 표현된다. 호출부 14곳(서비스·프로세서·테스트)이 일관되게 갱신됐으며 TypeScript 컴파일이 누락 호출부를 감지하도록 설계됐다. 순환 의존성 없음.
  - 제안: 없음. 변경 방향과 범위 모두 적절하다.

---

## 요약

이번 변경(Batch 2 + Resolution 적용)은 `agent-memory` 모듈과 AI 노드 메모리 레이어에 누적된 4가지 아키텍처 부채(I3·I5·I-7·I12)를 체계적으로 해소한다. `ConversationThreadService` 단일 writer 강화(I-7)로 레이어 캡슐화 경계가 강화됐고, `saveMemories` 옵션 객체화(I3)로 API OCP 수준이 개선됐으며, `buildCosineMatch`(I5)와 `readExtractionWatermark`(I12) 두 공유 빌더가 SQL 중복과 watermark 계약 분산을 각각 해결했다. `memoryState` sub-namespace 설계는 향후 resume state 확장에 대한 명시적 확장점이다. 하위호환 폴백 설계가 배포 중 in-flight 실행까지 고려된 점이 견고하다. 잔존 아키텍처 부채는 `AgentMemoryService` SRP 미분리 1건뿐으로 기존 plan 백로그이며 이번 PR 범위 밖이다. 순환 의존성 유입 없음, 레이어 방향(nodes → modules → data) 유지 확인.

## 위험도

LOW

STATUS: SUCCESS
