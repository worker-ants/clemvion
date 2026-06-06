# 신규 식별자 충돌 검토 결과

대상: `spec/5-system/17-agent-memory.md`

---

## 발견사항

### 발견사항 없음 — 충돌 없음

분석 대상 식별자 범주별 결과:

**1. 요구사항 ID (AGM-01 ~ AGM-13)**

- target 이 도입하는 AGM-01~AGM-13 은 `/spec/5-system/_product-overview.md` 의 테이블과 완전히 일치한다. 양측이 동일 내용을 같은 번호로 기술하고 있어 중복 정의(동일 의미)이며 충돌 아님.
- 다른 요구사항 접두사(NAV-AM-\*, ND-AG-\*, SYS-\* 등)와 AGM-\* 이 겹치는 사례 없음.
- AGM-08~AGM-13 의 번호는 plan 파일(`ai-context-memory-followup-v2.md`, `agent-memory-admin-ui.md`) 에서도 동일 의미로 사용 중 — 의미 불일치 없음.

**2. 엔티티/타입명 (`agent_memory`, `AgentMemory`, `AgentMemoryService`)**

- 테이블명 `agent_memory` 는 `spec/1-data-model.md §2.23`, migration `V073__agent_memory.sql`, `codebase/backend/src/modules/agent-memory/` 모두에서 일관되게 같은 의미로 사용. 충돌 없음.
- `AgentMemoryService` 는 `spec/4-nodes/3-ai/3-information-extractor.md` 가 동일 서비스를 참조 — 의미 일치.
- 상수 `AGENT_MEMORY_MAX_PER_SCOPE`(=1000), `MEMORY_DEDUP_SIMILARITY`(=0.85) 는 `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` 구현과 정확히 대응. 충돌 없음.

**3. API endpoint (`GET /agent-memories/scopes`, `GET /agent-memories`, `DELETE /agent-memories/:id`, `DELETE /agent-memories?scopeKey=`)**

- 4개 endpoint 는 `spec/2-navigation/16-agent-memory.md` 와 `spec/5-system/_product-overview.md` (AGM-12/13) 에서 동일 경로·메서드로 참조. 다른 spec 영역에 같은 경로를 다른 의미로 정의한 사례 없음. 충돌 없음.

**4. 이벤트/메시지명**

- target 은 webhook·SSE·queue 이벤트 이름을 신규로 부여하지 않는다. BullMQ 큐 토폴로지는 구현 재량으로 열어두고 있어 새 큐 이름을 spec 에 확정하지 않음. 충돌 대상 없음.

**5. 환경변수·설정 키**

- target 이 직접 정의하는 ENV var/config key 없음 (`memoryTtlDays`, `memoryTopK`, `memoryThreshold`, `memoryKey`, `embeddingModel`, `extractionModel` 은 노드 config 필드이며, `spec/4-nodes/3-ai/1-ai-agent.md §1` 및 `spec/4-nodes/3-ai/3-information-extractor.md §2` 와 완전히 동일 명칭·의미로 정렬). 충돌 없음.

**6. 파일 경로 (`spec/5-system/17-agent-memory.md`)**

- 파일은 이미 존재하는 파일이며(target 이 신규 도입이 아닌 기존 파일 검토), `spec/5-system/` 내 다른 파일과 숫자 prefix 중복 없음. `15-chat-channel.md`, `16-system-status-api.md`, `17-agent-memory.md` 순서 연속. 충돌 없음.

**7. spec frontmatter id**

- `id: agent-memory` 는 `spec/5-system/17-agent-memory.md` 에만 존재. `spec/2-navigation/16-agent-memory.md` 는 `id: nav-agent-memory` 로 구분. 충돌 없음.

---

## 요약

`spec/5-system/17-agent-memory.md` 가 도입하는 모든 식별자(요구사항 ID AGM-01~AGM-13, 테이블명·상수·서비스명, API 경로, 노드 config 필드명, 파일 경로)는 기존 코퍼스(spec/, plan/, codebase/)와 동일 의미로 일관되게 정렬되어 있다. 다른 의미로 이미 선점된 식별자와의 충돌은 발견되지 않았다.

---

## 위험도

NONE
