# 신규 식별자 충돌 검토 — ai-context-memory-auto

**검토 대상**: `plan/in-progress/ai-context-memory-auto.md`
**검토일**: 2026-06-03

---

## 발견사항

### [INFO] `memoryTopK` / `memoryThreshold` — `ragTopK` / `ragThreshold` 와 이름 유사, 의미 다름
- **target 신규 식별자**: `memoryTopK` (기본 `5`), `memoryThreshold` (기본 `0.7`)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표 — `ragTopK: 5`, `ragThreshold: 0.7`
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/0-common.md` §2
  - `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §2.1 — KB tool 인자 default 로 참조
- **상세**: 이름이 서로 다른 prefix (`rag*` vs `memory*`) 로 분리되어 있어 직접 충돌은 없다. 기본값이 동일(`5` / `0.7`)하고 RAG 검색과 persistent 메모리 회수 모두 pgvector 유사도 검색을 사용하므로, spec 독자가 두 파라미터 쌍의 역할 차이를 혼동할 수 있다. target plan §1.7 이 의도적 정합성을 명시적으로 기술하고 있어 기각할 수준은 아님. Phase A spec 개정 시 두 쌍에 용도 구분 코멘트를 달아 혼선을 방지하는 것을 권장한다.
- **제안**: 충돌 없음. Phase A spec 갱신 시 `1-ai-agent.md §1` 표에 "RAG(Knowledge Base) 검색용" / "persistent 메모리 회수용" 구분 코멘트 추가.

---

### [INFO] `memoryStrategy: 'manual'` — Trigger.type 의 `manual` 과 동일 단어
- **target 신규 식별자**: `memoryStrategy: 'manual' | 'summary_buffer' | 'persistent'`
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.8 Trigger.type enum — `webhook / schedule / manual`
  - `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/1-manual-trigger.md` §1 — `meta.source: "manual"`
- **상세**: `memoryStrategy.manual` 과 Trigger.type.`manual` 은 namespace 가 다르므로(노드 config 필드 vs 트리거 유형) 직접 충돌은 없다. 그러나 같은 프로젝트 내에서 `manual` 단어가 두 다른 의미로 사용된다. `memoryStrategy: 'manual'` 의 의미는 "자동 전략 없음 / 기존 동작 유지"이며, `off` 또는 `default` 로 명명하면 트리거 유형 `manual` 과의 이름 오인을 방지할 수 있다.
- **제안**: 충돌 없음. 단, `manual` 대신 `off` 또는 `default` 채택을 검토하여 Trigger.type `manual` 과의 이름 혼동을 줄이는 것을 권장.

---

### [INFO] `ND-AG-*` 신규 ID — 기존 ND-AG-01 ~ ND-AG-26 사용 중, 채번 규칙 확인 필요
- **target 신규 식별자**: plan §3 "요구사항 ID: `ND-AG-*` 신규(설정/실행)" — 구체 번호 미확정
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/_product-overview.md` — `ND-AG-01` ~ `ND-AG-26` 등재
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/_product-overview.md` — 동일 범위
- **상세**: 현 시점 충돌은 없으나(구체 번호 미확정), Phase A 채번 시 기존 최대값 `ND-AG-26` 초과 번호부터 시작해야 한다. 두 `_product-overview.md` 파일 모두 갱신이 필요하다.
- **제안**: `ND-AG-27` 부터 순차 채번. `spec/4-nodes/_product-overview.md` 와 `spec/4-nodes/3-ai/_product-overview.md` 양쪽 동시 갱신.

---

### [INFO] `SYS-MEM-*` 신규 ID 네임스페이스 — 기존 미사용이지만 기존 패턴과 상이
- **target 신규 식별자**: plan §3 "메모리 저장소는 `SYS-MEM-*` 신설 검토"
- **기존 사용처**: spec 전체에서 `SYS-*` prefix 를 쓰는 요구사항 ID 가 없음 (검색 결과 0건)
- **상세**: 이름 충돌은 없다. 단, 기존 요구사항 ID 는 `KB-GR-*`, `KB-AG-*`, `EIA-NX-*`, `WH-SC-*`, `CCH-SE-*` 등 도메인 약어 기반 패턴을 따른다. `SYS-MEM-*` 는 이 패턴과 달리 상위 범주(`SYS`) + 도메인(`MEM`) 의 2단계 prefix 구조라 일관성이 낮다.
- **제안**: 충돌 없음. 기존 패턴에 맞춰 `AGM-*` (Agent Memory) 또는 `AM-*` 단층 도메인 약어 패턴으로 변경하는 것을 권장.

---

### [INFO] `spec/5-system/<N>-agent-memory.md` 파일 번호 — 17 이 다음 가용 번호
- **target 신규 식별자**: `spec/5-system/<N>-agent-memory.md` (`<N>` 미확정)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/` — 현재 `1` ~ `16` (최대 `16-system-status-api.md`) 이 사용 중
- **상세**: `<N>` 을 17 로 채번하면 기존 파일과 충돌 없음. plan §5 에서 Phase A 에서 채번한다고 명시되어 있어 현재는 충돌 없음.
- **제안**: `spec/5-system/17-agent-memory.md` 로 채번.

---

### [INFO] `runningSummary` / `summarizedUpToSeq` — ConversationThread 신규 optional 필드
- **target 신규 식별자**: `ConversationThread.runningSummary?`, `ConversationThread.summarizedUpToSeq?`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/conventions/conversation-thread.md` §1.3 — 현재 `ConversationThread` 필드: `id`, `nextSeq`, `turns`, `totalChars`
- **상세**: 두 필드 이름이 기존 구조체에 없으므로 직접 충돌 없음. `summarizedUpToSeq` 는 기존 `nextSeq` 의 naming 패턴과 약간 다른 동사형 구조이나 허용 범위 내.
- **제안**: 충돌 없음. Phase A 에서 `conversation-thread.md §1.3` 에 optional 필드로 추가하고, `summary_buffer` / `persistent` 전략에서만 set 됨을 명시.

---

### [INFO] `agent_memory` 테이블 / `AgentMemoryService` — 기존 엔티티/서비스와 충돌 없음
- **target 신규 식별자**: DB 테이블 `agent_memory`, 서비스 클래스 `AgentMemoryService`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/1-data-model.md` — 31개 기존 엔티티 목록에 `agent_memory` 없음; codebase 내 동일 이름 발견 없음
- **상세**: 충돌 없음. `scope_key` 컬럼명도 기존 엔티티에서 사용된 `*_key` 패턴이 없으므로 신규 도입이며 충돌 없음.
- **제안**: 충돌 없음. Phase B 마이그레이션 파일 번호(`V0XX`)는 Phase A 완료 시점의 최신 마이그레이션 번호 + 1 로 결정.

---

## 요약

target 이 도입하는 신규 식별자(`memoryStrategy`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTokenBudget`, `agent_memory`, `AgentMemoryService`, `runningSummary`, `summarizedUpToSeq`, `ND-AG-*` 신규 ID, `SYS-MEM-*`)는 기존 spec 의 다른 식별자와 의미 충돌이 없다. `memoryTopK`/`memoryThreshold` 가 `ragTopK`/`ragThreshold` 와 기본값을 공유하지만 prefix 로 이미 분리된 의도적 정합이며, `memoryStrategy: 'manual'` 은 Trigger.type `manual` 과 동일 단어를 다른 namespace 에서 사용하는 경우로 직접 충돌은 아니다. Phase A spec 작업 시 주의할 실행 체크포인트: (1) `ND-AG-*` 채번은 기존 최대값 `ND-AG-26` 이후부터, (2) 신규 시스템 spec 파일은 `17-agent-memory.md`, (3) `SYS-MEM-*` 보다 기존 패턴에 맞는 도메인 약어(예: `AGM-*`) 사용 권장.

## 위험도

LOW
