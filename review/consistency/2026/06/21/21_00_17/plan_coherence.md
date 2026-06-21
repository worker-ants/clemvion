# Plan 정합성 검토 결과

검토 모드: `--impl-prep`  
Target: `spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md 확인, 2-text-classifier·3-information-extractor 는 프롬프트 payload 내 동일 영역 포함)

---

## 발견사항

### 1. [INFO] `ai-agent-tool-connection-rewrite.md` — 미결정 5항목이 그대로인 "재작성 예정" 박스와 정합

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 (config 표 상단 ⚠ 박스), §4 Tool Area 절 전체
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정 (사용자 합의 필요)" — 도구 등록 모델·시그니처 위치·실행 컨텍스트·결과 라우팅·ND-AG-21 우선순위 등 5개 항목 전부 TBD
- **상세**: spec 에 이미 "재작성 예정 (현재 제거됨)" 박스가 명시되어 있고, plan 도 "미결정" 상태를 선언하고 있다. target 구현 착수(impl-prep) 범위에서 `toolNodeIds`/`toolOverrides`/Tool Area 를 건드리지 않는 한 충돌은 없다. 단, impl-prep 대상 구현이 §6.1 step 3a dispatcher 분류 순서(현재 `cond_* → kb_* → mcp_* → render_* → tool_*` 5단계)를 변경하거나 일반 도구 경로를 활성화하면, tool-connection-rewrite plan 의 미결정 결정을 일방적으로 내리는 것이 된다.
- **제안**: 구현이 `tool_*` 경로·Tool Area·`toolNodeIds`/`toolOverrides` 영역에 접촉하지 않도록 impl-prep 범위를 명시적으로 제한한다. 접촉한다면 `ai-agent-tool-connection-rewrite.md` 의 결정을 먼저 사용자에게 합의받아야 한다. 현재 범위(M-1 리팩터)가 해당 영역에 닿지 않는다면 INFO 수준으로 충분하다.

---

### 2. [INFO] `ai-context-memory-followup-v2.md` — 미완료 백로그가 impl-prep 범위와 겹칠 수 있음

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10` (Conversation Context), `spec/4-nodes/3-ai/1-ai-agent.md §6.1/§6.2` (memoryStrategy 실행 경로)
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` — 아직 미체크 백로그:
  - `injectMemoryContext` 의 `getThread`/`getThreadExcludingNode` 이중 쿼리 단일화 (W-8)
  - `ConversationThreadService.updateSummaryState()` 신설 (I-7)
  - `meta.memory.compactedMessages` 를 `_product-overview` ND-AG-30 에 등재 (naming I-7)
  - V080 `expires_at` 인덱스 `CREATE INDEX CONCURRENTLY` 분리 (I9)
  - `saveMemories` 포지셔널 5파라미터 → 옵션 객체 (I3)
  - `_resumeState.lastExtractionTurnSeq` → `memoryState` sub-namespace (I12)
  - A1 가시화 UI 백로그 다수 (AgentMemoryAdminService 분리, pagination 등)
- **상세**: 위 항목들은 모두 "코드 리뷰 도출 backlog" 성격(파괴적 계약 변경 없음)이며, 구현 착수 전 결정이 필요한 "미해결 결정"은 아니다. 단, impl-prep 대상 구현이 `agent-memory-injection.ts`, `ai-agent.handler.ts` 의 memory 경로, `ConversationThreadService`, `AgentMemoryService.saveMemories` 시그니처에 동시 접촉하면 백로그 항목(I3·I7·I12·W-8)과 코드 충돌이 발생할 수 있다.
- **제안**: impl-prep 대상 코드가 위 백로그 파일들과 겹치는지 확인한다. 겹치면 해당 백로그 항목을 본 구현 범위에 편입하거나, 계획적으로 후속 PR 분리를 명시한다. 현재 impl-prep 범위가 명확히 분리되어 있다면 INFO 수준으로 추적만 하면 된다.

---

### 3. [INFO] `exec-park-durable-resume.md` — PR-B2a 가 AI Agent spec(§6.2) 에 연결되어 있으며 미완료

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §6.2` (Multi Turn 모드, `_resumeState`·`_resumeCheckpoint` 생명주기 비교표 §7.4 비고)
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` — Phase B 의 PR-B2a (멀티턴 AI turn-park 전환) 가 "구현 완료 + nest build 통과, 남음: 실패 20 테스트 turn-park 모델 재작성 → dockerized e2e → /ai-review + --impl-done → 머지" 상태로 미완료. PR-B2b (중첩 call-stack D6 + full B3) 는 미착수.
- **상세**: `1-ai-agent.md §7.4` 의 `_resumeState`/`_resumeCheckpoint`/`_retryState` 생명주기 비교표는 PR-B2a 완료 후 spec 갱신(§4.x banner 완료형 flip)이 예정되어 있다. target spec 은 이미 최종 설계를 반영한 상태이므로 impl-prep 자체의 목적과 충돌은 없다. 단, 구현이 `runAiConversationLoop`·`pendingContinuations`·`firstSegmentBarriers` 등 Phase B 대상 코드에 접촉하면 PR-B2a 와 코드 충돌 위험이 있다.
- **제안**: impl-prep 대상 구현(M-1 리팩터)이 `execution-engine.service.ts` 의 AI 멀티턴 재개 경로에 닿는지 확인한다. 닿지 않는다면 이 항목은 추적 메모 수준으로 충분하다.

---

### 4. [INFO] `agent-memory-model-select.md` — SUPERSEDED 표기 in-progress plan, 대체 plan 은 complete

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §1` (embeddingModelConfigId / summaryModelConfigId / extractionModelConfigId 필드, 타입 "ModelConfig select")
- **관련 plan**: `plan/in-progress/agent-memory-model-select.md` — plan 자체에 "SUPERSEDED (2026-06-20)" 표기 존재. 대체 plan `agent-memory-model-config` 는 `plan/complete/` 에 이관됨.
- **상세**: target spec 은 대체 plan(`agent-memory-model-config`) 의 "등록 ModelConfig 선택(`config.id`)" 설계를 이미 반영하고 있다. SUPERSEDED plan 이 아직 `plan/in-progress/` 에 남아 있어 혼동 가능성이 있으나, 해당 plan 의 미완료 체크박스가 대체 plan 에서 완료되었다고 명시되어 있어 실질적 충돌은 없다.
- **제안**: `agent-memory-model-select.md` 를 `plan/complete/archive/` 또는 `plan/complete/` 로 이관해 SUPERSEDED 상태를 명확히 하면 좋다. 현재로서는 INFO 수준.

---

## 요약

`spec/4-nodes/3-ai` 는 세 개의 진행 중 plan(`ai-agent-tool-connection-rewrite`, `ai-context-memory-followup-v2`, `exec-park-durable-resume`)을 `pending_plans:` 에 정직하게 등록하고 있으며, 각 plan 의 미해결 결정과 목표적으로 충돌하는 선언은 발견되지 않았다. 미결정 항목(tool-connection 5개 TBD, exec-park PR-B2a 미완료)은 spec 내 "재작성 예정" 박스와 `_resumeState` 생명주기 주석으로 이미 가시화되어 있다. 선행 조건 미해소(`agent-memory-model-select` SUPERSEDED 미정리)는 실질 충돌이 없는 문서 위생 문제다. 주의할 점은 impl-prep 대상 구현이 tool-connection 재작성 영역이나 exec-park PR-B2a 대상 코드에 접촉하지 않는 범위 내에서만 충돌이 없다는 것이다 — 범위 이탈 시 CRITICAL/WARNING 으로 격상될 수 있다.

---

## 위험도

LOW

---

STATUS: OK
