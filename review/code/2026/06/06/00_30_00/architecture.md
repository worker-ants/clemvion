# Architecture Review — #484 agent-memory shared 유틸 추출

리뷰 기준: `git diff 2b793ffa..HEAD -- codebase/`

---

## 발견사항

### WARNING — IE handler 의 ai-agent.schema 잔류 의존 (모듈 경계 미완)

- **위치**: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` L33-35
- **상세**: `DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` 를 여전히 `../ai-agent/ai-agent.schema` 에서 import 한다. 이 두 상수는 이미 `shared/agent-memory-schema.ts` 에 SoT 정의가 이전됐고, `ai-agent.schema` 는 re-export 래퍼로만 남아 있다. `information-extractor.schema.ts` 는 해당 import 를 제거해 `shared/agent-memory-schema.ts` 로 직접 향했는데, handler 는 해당 정리가 누락됐다. IE → ai-agent 내부 의존 해소가 PR 목표였으나 handler 경로가 반쪽 상태로 잔류한다.
- **제안**: `information-extractor.handler.ts` 의 해당 import 블록을 `../shared/agent-memory-schema.js` 로 교체. re-export 인다이렉션이 사라지므로 ai-agent.schema 완전 탈의존 달성.

---

### INFO — `buildAgentMemorySchemaFields` 반환 타입 희석 (`Record<string, z.ZodTypeAny>`)

- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts` L86, L246
- **상세**: 함수 내부에서 `const fields: Record<string, z.ZodTypeAny> = {}` 로 선언하고 키를 조건부로 추가해 반환한다. TypeScript 추론 반환 타입이 `Record<string, ZodTypeAny>` 로 완전히 희석된다. `buildConversationContextSchemaFields` 는 `return { contextScope: ..., ... }` 객체 리터럴을 직접 반환해 각 키에 정확한 Zod 타입이 추론된다. 조건부 필드(`memoryTokenBudget`, `summaryModel`) 존재 때문에 단순 리터럴 반환이 어렵지만, 희석된 타입은 spread 후 schema 전체의 키 타입 정확도를 낮춘다. 현재 `z.object().passthrough()` 패턴에서는 런타임 영향은 없으나 타입-안전 접근 경로가 닫힌다.
- **제안**: 조건부 필드를 optional 로 처리한 discriminated return type 또는 overload 패턴으로 타입 복원을 검토. 단, 현재 사용처(schema spread)가 `passthrough()` 기반이므로 즉각적인 버그 위험은 없어 낮은 우선순위.

---

### INFO — `scheduleMemoryExtraction` 의 `args.config: Record<string, unknown>` 다중 as-cast

- **위치**: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` L612-654
- **상세**: `config` 파라미터가 `Record<string, unknown>` 으로 받아 내부에서 `as string | undefined` 로 6회 캐스팅된다. 이 패턴은 공유 헬퍼가 노드별 config 타입을 알지 못하므로 발생한 trade-off 이며, 의존성 역전(narrow interface)을 채택한 의도적 설계다. 그러나 캐스팅 실패 시 런타임에서만 포착된다. 양쪽 핸들러가 공통 config interface 를 공유한다면(`AgentMemoryConfig`) narrow typed 파라미터로 교체 가능하다.
- **제안**: `ScheduleMemoryExtractionArgs.config` 에 공통 config 키를 명시한 최소 interface(`AgentMemoryConfig: { memoryKey?: string; llmConfigId?: string; model?: string; extractionModel?: string; embeddingModel?: string; memoryTtlDays?: unknown }`)를 정의해 as-cast 을 제거하는 방향 검토. 런타임 위험은 낮고 양쪽 핸들러가 동일 필드를 쓰므로 interface 도출 가능.

---

### INFO — `ai-agent.schema.ts` DEFAULT 상수 re-export 주석 위치

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` L51-59
- **상세**: 3개 상수(`DEFAULT_MEMORY_TOKEN_BUDGET`, `DEFAULT_MEMORY_TOP_K`, `DEFAULT_MEMORY_THRESHOLD`)의 하위호환 re-export 위에 단일 블록 주석이 있으나 `DEFAULT_MEMORY_TOKEN_BUDGET` 바로 위에 분리된 라인 주석이 중복으로 달려 있다(`/** 메모리 필드 기본값 ... */` + `/** memoryTokenBudget ...*/`). 이중 주석이 re-export 의도를 흐린다.
- **제안**: 블록 주석 하나로 통합 또는 개별 JSDoc 만 유지.

---

## 요약

이번 리팩토링은 IE → ai-agent 내부 의존이라는 모듈 경계 위반을 해소하고, `resolveMemoryTtlDays` / `scheduleMemoryExtraction` 중복 로직을 단일 진실(`shared/`) 로 추출하는 목표를 대부분 달성했다. `shared/agent-memory-injection.ts` 의 narrow interface(`AgentMemoryScheduler`, `ConversationThreadReader`) 패턴은 의존성 역전 원칙에 부합하고, `buildAgentMemorySchemaFields` 는 `buildConversationContextSchemaFields` 와 일관된 fragment 패턴을 따른다. 단, `information-extractor.handler.ts` 에 `DEFAULT_MEMORY_TOP_K`/`DEFAULT_MEMORY_THRESHOLD` 를 여전히 `ai-agent.schema` 에서 import 하는 경로가 잔류해 경계 해소가 미완이며, `buildAgentMemorySchemaFields` 의 `Record<string, ZodTypeAny>` 반환 타입 희석은 기존 패턴(`buildConversationContextSchemaFields`) 과 비대칭으로 남는다. 순환 의존성·레이어 위반은 없다.

## 위험도

LOW

BLOCK: NO
