# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/ai-context-memory-auto.md`
**검토 모드**: spec draft (`--spec`)
**검토 일시**: 2026-06-03

---

## 발견사항

### [WARNING] `memoryStrategy` 필드와 `contextScope` 의 UI 표시 상호작용 규칙 불명확
- **target 위치**: §2 (`memoryStrategy` 필드 표 + visibleWhen 항목)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §1` 설정 표, `spec/4-nodes/3-ai/0-common.md §10` Conversation Context 표
- **상세**: target 은 "`manual` 일 때 `contextScope` 등 기존 필드 표시(현행 유지). strategy ≠ manual 이면 기존 contextScope 필드는 숨김" 이라고 명시한다. 그런데 `spec/4-nodes/3-ai/0-common.md §10` 의 Conversation Context 표에는 `contextScope`·`contextScopeN`·`contextInjectionMode`·`includeToolTurns`·`excludeFromConversationThread` 5개 필드가 "AI 카테고리 3 노드 공통 규약" 으로 정의되어 있고, `spec/4-nodes/3-ai/1-ai-agent.md §1` 은 이 필드들을 config 표에 기재한다. 두 spec 문서는 `memoryStrategy` 의 존재를 전혀 기술하지 않아, 신규 `memoryStrategy` 가 추가됐을 때 기존 Conversation Context 필드들이 어떻게 동작하는지 양 문서 간 불일치가 발생한다. 특히 `summary_buffer`/`persistent` 전략 하에서 `contextScope` 가 완전히 억제되는지, 아니면 `excludeFromConversationThread` 나 `includeToolTurns` 는 여전히 유효한지 정의되지 않았다.
- **제안**: Phase A 에서 `spec/4-nodes/3-ai/0-common.md §10` Conversation Context 표를 갱신해 `memoryStrategy` 도입 시 기존 5 필드의 유효/무효 조건을 명시. `spec/4-nodes/3-ai/1-ai-agent.md §1` 설정 표에 5개 신규 필드와 visibleWhen 규칙을 추가.

---

### [WARNING] `ConversationThread.runningSummary?` / `summarizedUpToSeq?` 추가가 기존 영속화 정책과 충돌 가능
- **target 위치**: §3 영향 문서 (conversation-thread.md §1.3 갱신 항목)
- **충돌 대상**: `spec/conventions/conversation-thread.md §4` 영속화 표 ("v1 은 신규 DB 컬럼 도입 없음")
- **상세**: target 은 `ConversationThread` 에 `runningSummary?` 와 `summarizedUpToSeq?` 필드를 추가할 것을 명시한다. 그런데 현행 `spec/conventions/conversation-thread.md §4` 는 "**v1 은 신규 DB 컬럼 도입 없음**" 이라고 명시하고 있으며 thread 영속화 정책은 `ExecutionContext` in-memory + NodeExecution 분산 저장으로 규정되어 있다. `runningSummary` 를 어디에 영속화하는지 — `ExecutionContext` 내부(Redis TTL 내 유지)? 신규 DB 컬럼? `agent_memory` 테이블? — 가 target 에 명확히 정의되지 않았고 기존 §4 영속화 정책과 잠재 충돌이 있다. summary_buffer 는 단일 실행(세션) 내 rolling 압축이므로 in-memory 충분할 수 있으나 restart/rehydration 시 복원 경로가 누락됐다.
- **제안**: Phase A 에서 `spec/conventions/conversation-thread.md §4` 영속화 단락을 갱신해 `runningSummary` 가 Redis `ExecutionContext` 직렬화에 포함되는지, 그리고 restart 후 rehydration 경로를 명시. "v1 신규 DB 컬럼 없음" 조항이 본 작업 이후에도 유지되는지 여부를 결정하여 명문화.

---

### [WARNING] `conversation-thread.md §7` "Token-aware cap" v2 로드맵 항목이 본 작업과 중복 및 의미 충돌
- **target 위치**: §1.1 (트리거 근거 — "기존 conversation-thread.md §7 v2 로드맵의 Token-aware cap 항목과 정합")
- **충돌 대상**: `spec/conventions/conversation-thread.md §7 v2 로드맵` ("Token-aware cap" 항목)
- **상세**: 기존 로드맵의 "Token-aware cap" 은 `§5.3` 의 **char-based cap(`MAX_INJECTED_CHARS = 200_000`) 을 provider tokenizer 기반으로 교체**하는 것이다. 반면 target 의 `summary_buffer` 는 **토큰 예산(`memoryTokenBudget`) 초과 시 오래된 turn 을 rolling 요약 압축**하는 기능으로, 기존 char-based cap drop(head slice) 과는 메커니즘이 다르다. 두 기능이 동시에 존재할 경우 어느 것이 먼저 적용되는지 정의되지 않았다. target 이 로드맵 항목을 "실현"한다고 기술하지만 실제로는 별개의 기능이다.
- **제안**: Phase A 에서 `spec/conventions/conversation-thread.md §7` 의 "Token-aware cap" 항목을 갱신해 — (a) 이 작업의 `summary_buffer` 가 해당 로드맵 항목을 실현하는 것인지, (b) char-based cap 과 token-budget rolling 요약이 어떻게 병존하는지(혹은 교체인지)를 명시.

---

### [WARNING] `agent_memory` 엔티티가 `spec/1-data-model.md` 엔티티 관계도에 부재
- **target 위치**: §1.5, §3 영향 문서 (`spec/1-data-model.md` 갱신 항목)
- **충돌 대상**: `spec/1-data-model.md §1` 엔티티 관계도, §3 인덱스 전략 표
- **상세**: target 은 `agent_memory` 엔티티를 신설하며 필드 목록(`id, workspace_id, scope_key, content, embedding vector, metadata jsonb, created_at, updated_at`)을 명시한다. 그러나 기존 `spec/1-data-model.md §1` 의 엔티티 관계도에는 `AgentMemory` 가 없어 공식 등재가 누락된 상태다. 또한 §3 인덱스 전략 표에도 `agent_memory` 관련 인덱스가 없다. Workspace 하위 엔티티 공통 패턴 (`workspace_id` FK + UNIQUE 부분 인덱스) 이 적용되는지, `(workspace_id, scope_key)` UNIQUE 인덱스가 있는지도 미정의다.
- **제안**: Phase A 에서 `spec/1-data-model.md §1` 엔티티 관계도에 `AgentMemory (1:N)` 을 `Workspace` 하위에 추가하고, §2 에 상세 필드 표, §3 에 `(workspace_id, scope_key)` 등 필요한 인덱스를 기술.

---

### [WARNING] 요구사항 ID `ND-AG-*` 신규 채번 시 기존 `ND-AG-01`~`ND-AG-26` 과의 번호 충돌 위험
- **target 위치**: §3 영향 문서 ("요구사항 ID: `ND-AG-*` 신규")
- **충돌 대상**: `spec/4-nodes/3-ai/_product-overview.md` (ND-AG-01 ~ ND-AG-26 정의), `spec/4-nodes/_product-overview.md` (동일 ID 중복 사용)
- **상세**: target 은 "`ND-AG-*` 신규(설정/실행)" 이라고만 명시하고 구체적 번호를 부여하지 않았다. 현행 spec 에서 `ND-AG-01` ~ `ND-AG-26` 을 이미 사용 중이므로 신규 번호 채번 시 중복 위험이 있다. 또한 두 파일(`spec/4-nodes/3-ai/_product-overview.md` 와 `spec/4-nodes/_product-overview.md`)이 동일 ID 집합을 각각 유지하고 있어 두 파일 모두 동기화가 필요하다. `SYS-MEM-*` 신설은 기존 ID 공간(`NF-*`/`KB-*`/`LLM-*`/`ND-*`) 과 중복되지 않으므로 충돌 없음.
- **제안**: Phase A spec 갱신 시 `ND-AG-27` 이후로 채번하고 두 `_product-overview.md` 를 동시 갱신.

---

### [INFO] `memoryTopK` / `memoryThreshold` 기본값이 KB `ragTopK` / `ragThreshold` 와 동일하나 별도 정의가 중복됨
- **target 위치**: §1.7 (회수 정책 디폴트), §2 필드 표
- **충돌 대상**: `spec/4-nodes/3-ai/0-common.md §2` (ragTopK 기본 5, ragThreshold 기본 0.7)
- **상세**: target 은 `memoryTopK` 기본 `5`, `memoryThreshold` 기본 `0.7` 을 "KB `ragTopK`/`ragThreshold` 와 동일" 이라고 명시한다. 기본값은 동일하나 `ragTopK`/`ragThreshold` 는 KB tool 호출 시 LLM 이 override 가능한 값이고, `memoryTopK`/`memoryThreshold` 는 persistent memory 회수 고정 기본값으로 의미 레이어가 다르다. 명명 유사성으로 인한 사용자 혼동 가능성이 있다.
- **제안**: Phase A 신규 spec 문서에서 두 필드 집합의 독립성(서로 override 에 영향 없음)을 명시하는 주석을 추가.

---

### [INFO] `persistent` 추출 비동기 경로가 `scheduleBackgroundBody` 계열 패턴 재사용을 언급하나 큐 분리 여부 미정의
- **target 위치**: §1.6 (추출 시점 — 비동기)
- **충돌 대상**: `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/4-execution-engine.md §3.3` (background-execution 큐)
- **상세**: target 은 추출(extraction) 이 "기존 `scheduleBackgroundBody` 계열 패턴" 으로 비동기 수행된다고 기술한다. 그런데 `scheduleBackgroundBody` 는 Background 노드 본문 실행용 `background-execution` BullMQ 큐를 의미하며, agent memory 추출이 같은 큐를 공유하면 Background 노드 실행과 우선순위 경합이 발생할 수 있다. 별도 큐(`agent-memory-extraction` 등)를 신설하는지 불명확하다.
- **제안**: `spec/5-system/<N>-agent-memory.md` 신규 문서에서 추출 파이프라인의 BullMQ 큐 이름과 `background-execution` 큐와의 분리 여부를 명시.

---

### [INFO] 신규 system spec 파일 번호(`spec/5-system/<N>`) 미확정 — 기존 최대 번호 16
- **target 위치**: §3 영향 문서 ("신규 `spec/5-system/<N>-agent-memory.md`"), §5 미해결
- **충돌 대상**: `spec/5-system/` 기존 파일 목록 (최대 번호: 16-system-status-api.md)
- **상세**: target 은 §5 미해결 항목에 "신규 system spec 문서 번호 — Phase A 에서 채번"으로 인지하고 있다. 기존 최대 번호가 16이므로 `17-agent-memory.md` 가 자연스럽다. `spec/0-overview.md §8` 문서 맵 표에도 추가 필요.
- **제안**: Phase A 에서 `spec/5-system/17-agent-memory.md` 로 채번하고 `spec/0-overview.md §8` 표에 등재.

---

## 요약

target 문서(`ai-context-memory-auto.md`)가 도입하는 5개 신규 config 필드, `agent_memory` 엔티티, 요구사항 ID 체계는 기존 spec 과 직접 모순을 일으키지는 않는다. 그러나 4개의 WARNING 이 Phase A 이전에 해소되어야 한다. 가장 중요한 두 가지는: (1) 새 `memoryStrategy` 필드가 기존 Conversation Context 5 필드(`contextScope` 등)의 동작·UI 표시에 미치는 영향이 `spec/4-nodes/3-ai/0-common.md §10` 및 `1-ai-agent.md §1` 에 아직 반영되지 않아 두 영역이 Phase A 이후 불일치 상태로 남을 수 있으며, (2) `ConversationThread.runningSummary` 의 영속화 경로가 기존 "v1 신규 DB 컬럼 없음" 조항(`conversation-thread.md §4`)과 잠재 충돌을 일으킨다. 이 두 WARNING 을 Phase A spec 갱신에서 명시적으로 해소하면 후속 구현 단계에서의 교차 영역 충돌을 방지할 수 있다.

---

## 위험도

MEDIUM
