# 신규 식별자 충돌 검토 결과

검토 범위: `spec/4-nodes/3-ai/` (0-common.md · 1-ai-agent.md · 2-text-classifier.md · 3-information-extractor.md)
검토 모드: 구현 완료 후 검토 (--impl-done, diff-base=origin/main)

---

## 발견사항

### 요구사항 ID 충돌

발견 없음. target 이 신설하는 ND-AG-27 ~ ND-AG-30 은 main branch 최대값 ND-AG-26 의 연번이며, 기존 ND-AG-27 ~ ND-AG-30 은 main 에 없음을 확인.

### 엔티티/타입명 충돌

- **[INFO]** `AgentMemory` 엔티티 신설 — 충돌 없음, 명명 일관성 확인
  - target 신규 식별자: `AgentMemory` (§2.23, `agent_memory` 테이블)
  - 기존 사용처: `spec/1-data-model.md` main branch 는 §2.22 `AssistantMessage` 까지만 정의. `AgentMemory` 는 존재하지 않음
  - 상세: 완전 신규 엔티티. `DocumentChunk` / `KnowledgeBase` 등 기존 pgvector 인프라와 레벨이 분리되므로 의미 충돌 없음. 데이터 모델 ER 다이어그램에 `Workspace ──── AgentMemory (1:N)` 행이 정확히 삽입됨
  - 제안: 없음 (신규 엔티티, 충돌 없음)

- **[INFO]** `memoryStrategy` / `summary_buffer` / `persistent` 값 — 충돌 없음
  - target 신규 식별자: config 필드 `memoryStrategy`, enum 값 `manual` / `summary_buffer` / `persistent`
  - 기존 사용처: main spec 어디에도 `memoryStrategy` 가 정의되지 않음. `manual` / `summary_buffer` / `persistent` 값 역시 신규
  - 상세: main branch 의 `contextScope` 필드 enum (`none` / `thread` / `lastN`) 과 의미·레벨이 완전히 분리됨. target spec 이 두 축을 명시적으로 분리(`memoryStrategy` = 관리 전략 축, `contextScope` 계열 = 범위 축)하여 혼동 위험을 문서화함
  - 제안: 없음

- **[WARNING]** `memoryTopK` vs `ragTopK` — 유사 이름, 의미 분리 명시 여부 확인
  - target 신규 식별자: `memoryTopK`, `memoryThreshold` (persistent 메모리 회수 전용)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` main branch 에 `ragTopK` / `ragThreshold` (KB 검색 전용)가 이미 정의됨
  - 상세: 두 쌍의 필드는 **검색 대상이 다름** (`agent_memory` vs `KnowledgeBase`). target 의 §1 설정 표에 "KB 검색용 `ragTopK` 와 독립 (서로 다른 검색 대상: agent_memory vs KnowledgeBase)" 주석이 명시되어 있어 의미 분리가 문서화됨. 이름 패턴은 `{prefix}TopK` / `{prefix}Threshold` 로 일관됨
  - 제안: 현재 설명이 충분하나, config 설명 표에서 `ragTopK` 와 `memoryTopK` 가 같은 테이블 안에 나란히 존재하므로 UI 레이블에서도 명확한 섹션 분리("Knowledge Base 검색" vs "Persistent Memory 회수") 권장 (이미 §2 설정 UI 에서 분리 섹션으로 정의됨 — 현행 유지)

### API Endpoint 충돌

target 문서는 새 API endpoint 를 직접 정의하지 않음. AI 노드 config 필드 및 내부 메커니즘만 변경. 충돌 없음.

### 이벤트/메시지명 충돌

- **[INFO]** `meta.interactionType: 'ai_form_render'` — 기존 등록값, 충돌 없음
  - 해당 값은 `spec/conventions/interaction-type-registry.md` §1 에 이미 등록되어 있으며 target 이 새로 도입하는 것이 아님. target 이 기존 정의를 참조만 함

- **[INFO]** `meta.memory` 신규 서브오브젝트 — 기존 `meta.*` 필드와 충돌 없음
  - target 신규 식별자: `meta.memory.{strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages}`
  - 기존 사용처: `spec/conventions/node-output.md` 및 main branch `spec/4-nodes/3-ai/1-ai-agent.md` 의 `meta.*` 필드 목록에 `memory` 키는 없음 (`meta.durationMs` / `meta.model` / `meta.inputTokens` 등 기존 필드와 이름 비충돌)
  - 상세: 완전 신규 서브오브젝트. `meta.ragSources` / `meta.ragDiagnostics` / `meta.mcpDiagnostics` 와 같은 레벨·패턴으로 일관됨
  - 제안: 없음

### 환경변수·설정키 충돌

target 이 신설하는 환경변수 없음. `Workspace.settings.timezone` 참조는 기존 키 재사용이므로 충돌 없음.

### 파일 경로 충돌

- **[INFO]** `spec/5-system/17-agent-memory.md` 신설
  - target 신규 식별자: `spec/5-system/17-agent-memory.md`
  - 기존 사용처: main branch `spec/5-system/` 디렉터리는 `16-system-status-api.md` 까지만 존재. `17-` 번호는 미사용
  - 상세: 기존 넘버링 패턴(`NN-name.md`) 을 따르며, 연번 17 은 빈 번호. 파일 경로 충돌 없음
  - 제안: 없음

- **[INFO]** `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts` — 이미 `spec/4-nodes/0-overview.md §3.8` 에 경로 예시로 언급되어 있음
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/4-nodes/0-overview.md:38` 에 `ai/shared/system-context-prefix.ts` 경로가 카테고리 공유 유틸 예시로 언급됨 (spec 정의가 아닌 참고 예시)
  - 상세: 충돌이 아니라 spec 에 이미 인식된 파일 경로임. 충돌 없음

---

## 요약

target (`spec/4-nodes/3-ai/`) 이 도입하는 신규 식별자 — `memoryStrategy` / `memoryTokenBudget` / `memoryKey` / `memoryTopK` / `memoryThreshold` / `AgentMemory` 엔티티 / `meta.memory` 서브오브젝트 / `ND-AG-27~30` 요구사항 ID / `spec/5-system/17-agent-memory.md` 파일 — 모두 main branch 기존 정의와 충돌하지 않는다. 유일하게 주의할 사항은 `memoryTopK` / `memoryThreshold` 가 기존 `ragTopK` / `ragThreshold` 와 유사한 이름이나, target spec 이 두 쌍의 독립성을 명시적으로 설명하고 있어 혼동 위험이 낮다. 나머지 식별자 (contextScope 계열, includeSystemContext, interactionType 값 등) 는 main branch 에 이미 정의되어 있으므로 target 은 기존 정의를 참조·확장하는 것이며 신규 충돌이 없다.

---

## 위험도

LOW
