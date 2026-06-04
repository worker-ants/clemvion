# API 계약(API Contract) 리뷰

## 발견사항

이 변경은 다음 레이어에서 이루어진다.

- DB 마이그레이션 (`V079__agent_memory_expires_at.sql`)
- 내부 서비스 메서드 (`AgentMemoryService.saveMemories`, `findSimilarFact`, `evictExpiredAndOldest`)
- BullMQ 큐 payload 타입 (`AgentMemoryExtractionJob.ttlDays`)
- 노드 config 스키마 (`aiAgentNodeConfigSchema.memoryTtlDays`)
- 문서 (frontend docs mdx)

HTTP API 엔드포인트, REST 경로, 외부 공개 컨트롤러는 포함되지 않는다. `AgentMemoryService`에 대한 별도의 HTTP 컨트롤러는 확인되지 않았다.

API 계약 관련 항목은 **노드 config 스키마** (`aiAgentNodeConfigSchema`) 변경에만 해당한다. 이 스키마는 워크플로우 API 에서 AI Agent 노드의 config 바디 유효성 검증에 사용된다.

---

- **[INFO]** `memoryTtlDays` 신규 선택 필드 추가 — 하위 호환 유지
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`, `aiAgentNodeConfigSchema`
  - 상세: `z.number().int().positive().optional()`으로 정의되어 기존 클라이언트가 이 필드를 보내지 않아도 무방하다. 기존 config 페이로드를 전송하는 모든 클라이언트에 breaking change 없음. `visibleWhen: { field: 'memoryStrategy', equals: 'persistent' }` 로 표시 조건도 명확하다.
  - 제안: 특이사항 없음.

- **[INFO]** `saveMemories` 메서드 시그니처 변경 — 5번째 인자 `ttlDays?: number | null` 추가
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`, line 341
  - 상세: 이 메서드는 내부 서비스 간 호출이며 외부 HTTP API로 직접 노출되지 않는다. 선택적 인자 추가이므로 기존 호출부(processor)가 인자를 생략해도 동작한다. 다만 processor에서는 명시적으로 `ttlDays`를 5번째 인자로 전달하도록 이미 수정되어 일관성이 유지된다.
  - 제안: 특이사항 없음.

- **[INFO]** `AgentMemoryExtractionJob` 큐 페이로드에 `ttlDays` 신규 선택 필드 추가
  - 위치: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts`
  - 상세: BullMQ 큐 페이로드 타입 변경. `ttlDays?: number | null`로 선택 필드이므로 기존 enqueue 코드에 영향이 없다. 단, 큐에 이미 적재되어 있는 기존 job(배포 롤링 구간)은 `ttlDays` 필드가 없어도 processor에서 `undefined`로 처리되어 무만료(NULL)로 동작하므로 안전하다.
  - 제안: 특이사항 없음.

- **[INFO]** `scheduleMemoryExtraction` 반환 타입 변경 (`void` → `Promise<number | undefined>`)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`, line 1456
  - 상세: 내부 private-equivalent 메서드의 반환 타입 변경. 호출부(`processMultiTurnMessage` 내)도 동일 파일에서 수정되어 있어 일관성 유지. 외부 API 계약에 영향 없음.
  - 제안: 특이사항 없음.

---

## 요약

이 변경의 모든 파일은 내부 서비스 레이어(AgentMemoryService, BullMQ processor), DB 마이그레이션, 노드 config 스키마에 국한된다. 외부 HTTP API 엔드포인트, REST 경로, 응답 스키마, 에러 응답 형식, 인증/인가 설정에 대한 변경은 없다. 노드 config 스키마에 추가된 `memoryTtlDays`는 선택 필드(optional)로서 기존 클라이언트에 breaking change를 유발하지 않는다. 모든 내부 인터페이스 변경도 선택적 인자 추가 또는 internal 리팩터링 수준이므로 API 계약 관점에서 위험 요소는 없다.

## 위험도

NONE
