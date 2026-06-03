# 신규 식별자 충돌 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (구현 착수 전 --impl-prep 모드)
검토 일시: 2026-06-03

---

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** ND-AG-27 / ND-AG-28 / ND-AG-29 / ND-AG-30 신규 부여
  - target 신규 식별자: `ND-AG-27`(Conversation Context §10 memoryStrategy 통합), `ND-AG-28`(`summary_buffer`), `ND-AG-29`(`persistent`), `ND-AG-30`(memory meta echo)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/4-nodes/_product-overview.md` / `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/_product-overview.md` 기준 최고 ID = ND-AG-26
  - 상세: ND-AG-27~30 은 main 브랜치 spec 어디에도 존재하지 않으며, worktree 내 두 파일에서 일관되게 신규 부여됨. 중복 없음.
  - 제안: 이상 없음.

---

### 2. 엔티티/타입명 충돌

- **[INFO]** `AgentMemory` 엔티티 신규 도입
  - target 신규 식별자: `AgentMemory` (DB 엔티티, 테이블 `agent_memory`)
  - 기존 사용처: main spec `/Volumes/project/private/clemvion/spec/1-data-model.md` 에 `AgentMemory` 미존재. `/Volumes/project/private/clemvion/codebase/backend/src/` 전체에서 `AgentMemory` 클래스·인터페이스 없음. 코드베이스에서 `agent_memory` 테이블 참조도 없음.
  - 상세: 완전히 새로운 엔티티. 충돌 없음.
  - 제안: 이상 없음.

- **[INFO]** `memoryStrategy` 필드명 신규 도입
  - target 신규 식별자: `memoryStrategy: 'manual' | 'summary_buffer' | 'persistent'` (AI Agent config 필드)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` 에 해당 필드 없음. main spec `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` 에도 없음.
  - 상세: 코드와 spec 모두 미존재. 충돌 없음.
  - 제안: 이상 없음.

- **[WARNING]** `memoryStrategy` 값 `'manual'` 과 기존 `Trigger.type: 'manual'` 표면 충돌
  - target 신규 식별자: `memoryStrategy: 'manual'` (enum 값)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/1-data-model.md §2.8 Trigger.type` 에 `manual` enum 값 존재 (`trigger.type = 'manual'`). 또한 `Node.type = 'manual_trigger'` 도 존재.
  - 상세: namespace 가 완전히 다르다 (`memoryStrategy` 필드 내 값 vs `Trigger.type` 필드 내 값). 동일 타입/enum 이 아니며 실제 코드에서 혼동될 수 없다. spec 의 `1-ai-agent.md §12.9 Rationale` 에서 이 점을 명시적으로 인식하고 "namespace 가 달라 의미 명료성을 우선해 그대로 둔다"고 결정이 기록되어 있다.
  - 제안: 현재 설계 결정은 문서화됨. 추가 조치 불필요. 다만 코드 구현 시 `MemoryStrategy` TypeScript 타입과 `TriggerType` 타입은 별개 union 으로 선언해 혼용 오염을 방지해야 한다 (`AuthConfig.type` vs `Integration.auth_type` 의 `AuthConfigType`/`IntegrationAuthType` 분리 패턴과 동일).

- **[INFO]** `summary_buffer` / `persistent` enum 값 신규 도입
  - target 신규 식별자: `'summary_buffer'`, `'persistent'` (memoryStrategy enum 값)
  - 기존 사용처: `'summary_buffer'` 는 기존 spec·코드 어디에도 없음. `'persistent'` 는 `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 에서 "persistent identifier" (install_token 설명), "persistent 식별자" 등 형용사·수식어로만 사용됨 — enum 값으로 등장하지 않는다.
  - 상세: 충돌 없음.
  - 제안: 이상 없음.

- **[INFO]** `runningSummary` / `summarizedUpToSeq` 필드 신규 도입 (`ConversationThread` 구조 확장)
  - target 신규 식별자: `ConversationThread.runningSummary?: string`, `ConversationThread.summarizedUpToSeq?: number`
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/conventions/conversation-thread.md` (main 브랜치) 에 두 필드 없음. 코드베이스 전체에서 미존재.
  - 상세: 완전히 신규 필드. 충돌 없음.
  - 제안: 이상 없음.

- **[INFO]** `meta.memory` 출력 필드 신규 도입
  - target 신규 식별자: `meta.memory.{ strategy, summarized, recalledCount, tokenBudgetUsed }` (AI Agent 출력 meta)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 에서 `meta` 객체에 `memory` 서브키 없음. main spec 에도 없음.
  - 상세: 충돌 없음.
  - 제안: 이상 없음.

- **[INFO]** `memoryKey` / `memoryTopK` / `memoryThreshold` / `memoryTokenBudget` 필드 신규 도입
  - target 신규 식별자: 4개 config 필드
  - 기존 사용처: 코드베이스 전체에서 미존재. `ragTopK` / `ragThreshold` 와 이름 패턴이 유사하나 prefix 가 달라 (`memory*` vs `rag*`) 구별 명확.
  - 상세: 충돌 없음. spec 의 `1-ai-agent.md §1` 에서 `memoryTopK`/`memoryThreshold` 가 `ragTopK`/`ragThreshold` 와 독립 필드임을 명시적으로 강조함.
  - 제안: 이상 없음.

- **[WARNING]** `scope_key` DB 컬럼명과 기존 코드베이스 패턴 점검
  - target 신규 식별자: `AgentMemory.scope_key` (DB 컬럼)
  - 기존 사용처: 코드베이스에서 `scope_key` 컬럼을 가진 엔티티 없음. `scope` 라는 컬럼은 `Integration.scope` (`personal`/`organization` enum) 에 존재.
  - 상세: 의미가 다르고 테이블도 다르다. 충돌 없음. 다만 `Integration.scope` 와 표면 단어 유사성이 있어 코드 내에서 `AgentMemoryEntity.scopeKey` 등 명확한 타입으로 구분 권장.
  - 제안: 이상 없음 (명명 자체는 적절).

---

### 3. API endpoint 충돌

target 문서(`spec/4-nodes/3-ai/`) 는 신규 REST API endpoint 를 명시적으로 추가하지 않는다. `spec/5-system/17-agent-memory.md` 가 신규 파일이나, 검토 범위 내 API 경로 추가는 관찰되지 않음. `AgentMemory` 는 백엔드 내부 서비스로만 동작하며 외부 공개 endpoint 가 없다.

- **[INFO]** 신규 API endpoint 없음 — 충돌 해당 없음.

---

### 4. 이벤트/메시지명 충돌

target 문서는 신규 WebSocket 이벤트·queue 이름·SSE 이벤트를 도입하지 않는다.

- **[INFO]** 신규 이벤트/메시지명 없음 — 충돌 해당 없음.

---

### 5. 환경변수·설정키 충돌

target 문서에서 명시적으로 신규 ENV var 나 config key 는 도입하지 않는다. 상수 `AGENT_MEMORY_MAX_PER_SCOPE = 1000` 은 코드 내부 상수이며 외부 환경변수가 아니다.

- **[INFO]** 신규 ENV var 없음 — 충돌 해당 없음.

---

### 6. 파일 경로 충돌

- **[INFO]** `spec/5-system/17-agent-memory.md` 신규 파일
  - target 신규 식별자: 파일 경로 `spec/5-system/17-agent-memory.md`
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/` 에는 `16-system-status-api.md` 까지 존재. `17-agent-memory.md` 없음.
  - 상세: 숫자 prefix 순서 17 이 16 다음으로 자연스럽게 이어짐. 컨벤션 위반 없음.
  - 제안: 이상 없음.

---

## 요약

target 문서(`spec/4-nodes/3-ai/` + `spec/5-system/17-agent-memory.md` 신규 추가)가 도입하는 주요 식별자들 — `memoryStrategy`/`memoryKey`/`memoryTopK`/`memoryThreshold`/`memoryTokenBudget` (AI Agent config 필드), `AgentMemory` 엔티티 및 `agent_memory` 테이블, `runningSummary`/`summarizedUpToSeq` (ConversationThread 확장), `meta.memory.*` 출력 필드, 요구사항 ID `ND-AG-27~30`, 파일 `17-agent-memory.md` — 모두 기존 spec·코드베이스에 존재하지 않아 실질적인 충돌이 없다. 한 가지 주목할 점은 `memoryStrategy` 값 `'manual'` 이 `Trigger.type: 'manual'` 과 단어가 겹치나, 이는 서로 다른 namespace 의 enum 값으로 spec 의 Rationale 에 인식·결정이 명시되어 있어 설계 단계 위험 수준이다. 구현 시 TypeScript 타입을 `MemoryStrategy` 와 `TriggerType` 으로 분리 선언해 혼용 오염을 방지하면 충분하다.

## 위험도

LOW
