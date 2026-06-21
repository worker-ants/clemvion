# Plan 정합성 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/3-ai)
**Target**: `spec/4-nodes/3-ai` (0-common.md, 1-ai-agent.md 분석 범위)

---

## 발견사항

### 1. **[WARNING]** `ai-agent-tool-connection-rewrite.md` — 미해결 결정과 target 정합 확인 필요

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 (`toolNodeIds`/`toolOverrides` 필드 제거 상태 박스), §4 Tool Area 연동 섹션, §6.1 step 3.a (dispatcher 분류 5단계: `cond_* → kb_* → mcp_* → render_* → tool_*`)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정" — 5가지 결정 항목 모두 `TBD` (도구 등록 모델, 시그니처 위치, 실행 컨텍스트, 결과 라우팅, ND-AG-21 유지 여부) 및 "사용자와의 대화로만 진행" 상태
- **상세**: target spec 이 `tool_*` 일반 도구를 "재작성 예정(비활성)" 으로 박스 처리하고 있는 것 자체는 plan 과 정합한다. target spec `§6.1 step 3.a` 의 classifier 분류 표는 현재 dispatcher 동작을 정확히 반영한다고 볼 수 있으나, plan 은 "도구 이름 규칙 결정 후 §6.1 step 3a 의 dispatcher 분류 순서 표 갱신 필요" 를 명시하고 있다. 구현 착수 시점에서 plan 상 미확정 결정 5건 중 어느 것도 target spec 이 일방적으로 확정 기술하고 있지는 않다 — `tool_*` 섹션은 명시적 비활성 박스로 처리돼 있어 직접 충돌은 없다.
- **평가**: 충돌이 아닌 선행 gap. 구현 착수 전 이 plan 이 가리키는 미해결 결정 5건이 여전히 TBD 임을 인식해야 한다. 본 착수 작업이 tool_* 재설계를 포함하지 않는다면 무해.
- **제안**: 착수 범위에 `tool_*` 재설계가 포함되지 않으면 INFO 수준으로 강등 가능. 포함될 경우 plan §1 결정 기록부를 먼저 채워야 함.

---

### 2. **[INFO]** `ai-context-memory-followup-v2.md` — 잔여 백로그 항목과 target spec 미연결

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta.memory` 열거, `spec/4-nodes/3-ai/0-common.md` §10 `memoryStrategy` 표
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` 잔여 미완료 항목:
  - `§7.1 meta.memory` 열거에 `compactedMessages?` + `node-output Principle 2` 에 `meta.memory` 등재 (impl-done W-1, 미완료)
  - `§6.2 d.5` 본문에 auto-memory multi-turn 실행 경로 부연 (SPEC-DRIFT I-2, 미완료)
  - `meta.memory.compactedMessages` 를 `_product-overview` ND-AG-30 열거에 등재 (naming I-7, 미완료)
  - `_resumeState.lastExtractionTurnSeq` → `memoryState` sub-namespace (I12, 미완료)
- **상세**: target spec `1-ai-agent.md §7.1` 의 `meta.memory` 열거는 현재 `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }` 를 포함하고 있어 `compactedMessages?` 가 이미 spec 에 기재된 것으로 보인다. plan 의 W-1 ("열거에 compactedMessages? 추가") 은 target spec 에 이미 반영된 것으로 추정된다. 단 `node-output Principle 2` 에 `meta.memory` 등재 여부 및 I-2/I-7/I12 는 다른 spec 파일들에 걸쳐 있어 target 범위 외부의 잔여 사항이다.
- **평가**: target spec(`spec/4-nodes/3-ai`) 내 직접 충돌 없음. plan 잔여 항목이 target 외부 파일(`node-output.md`, `_product-overview.md`)에 있으며 착수 전 추적 메모 수준.
- **제안**: 구현 착수 시 해당 잔여 항목을 이번 구현 diff 에서 동시에 해소하거나, plan 에 "spec/4-nodes/3-ai 내에서는 해소됨" 메모 추가 권장.

---

### 3. **[INFO]** `exec-park-durable-resume.md` — PR-B2b 진행 중이며 spec 일부가 "진행 중" 표기

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 `_resumeCheckpoint` 생명주기 비교표, §7.5 rehydration 관련 서술, §6.2 multi-turn 루프 재개 경로 서술
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` — PR-B2b (중첩 call-stack D6 + full B3, `claude/exec-park-b2b-04a2f8` branch) 진행 중. `ParkReleaseSignal` / `driveCallStackResume` / `resume_call_stack` 영속이 구현 중.
- **상세**: target spec `1-ai-agent.md` 의 `_resumeCheckpoint` / `_resumeState` 생명주기 서술(§7.4 비교표, Principle 4.2/4.2.1 참조)은 현행 spec 상태를 반영한다. exec-park plan 의 D6/PR-B2b 는 아직 착수 중이지만, 해당 plan 이 변경할 구현 경로(중첩 sub-workflow durable park)는 target `spec/4-nodes/3-ai` 의 AI 노드 출력 규약보다는 `spec/5-system/4-execution-engine.md` 에 주로 반영된다. AI 노드 spec 에 대한 직접 영향은 `§7.5 RESUME_INCOMPATIBLE_STATE` 케이스 서술 정도로 제한적이며, 해당 서술은 이미 target 에 올바르게 기재되어 있다.
- **평가**: 선행 plan(exec-park) 이 미완이지만 target `spec/4-nodes/3-ai` 에 대한 직접적 불일치 없음. AI 노드 spec 은 엔진 구현 세부 경로보다 계약(출력 구조/포트/상태 전이)을 기술하므로 PR-B2b 의 엔진 내부 개조가 target spec 을 무효화하지 않는다.
- **제안**: 추적 메모 수준. PR-B2b 완료 후 `1-ai-agent.md §12.x Rationale` 또는 `exec-park` spec 참조 표현 갱신 여부만 확인하면 충분.

---

### 4. **[INFO]** `agent-memory-model-select.md` — SUPERSEDED 상태, 후속 plan(`agent-memory-model-config`) 은 complete

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 (`summaryModelConfigId`, `extractionModelConfigId`, `embeddingModelConfigId` 필드, "Model select" 타입 기재)
- **관련 plan**: `plan/in-progress/agent-memory-model-select.md` — `SUPERSEDED (2026-06-20)` 표기. 후속 plan `plan/complete/agent-memory-model-config.md` 가 대체 완료.
- **상세**: target spec `1-ai-agent.md §1` 이 `summaryModelConfigId` / `extractionModelConfigId` / `embeddingModelConfigId` 를 `ModelConfig select` 타입으로 기재하는 것은 `agent-memory-model-config.md` (complete) 의 새 설계를 반영한 것으로 target 이 올바르다. `agent-memory-model-select.md` 자체는 SUPERSEDED 이력 보존용으로만 남아 있으며 in-progress 상태이지만 사실상 종료됨.
- **평가**: 기술적 충돌 없음. 다만 SUPERSEDED plan 이 여전히 `plan/in-progress/` 에 있는 것은 plan 라이프사이클 정책에 따라 `complete/` 로 이동해야 할 후보.
- **제안**: `agent-memory-model-select.md` 를 `plan/complete/` 로 이동 검토 (plan-lifecycle.md 정책 적용). 착수 작업 자체를 차단하지는 않음.

---

## 요약

`spec/4-nodes/3-ai` 영역의 구현 착수 전 plan 정합성 관점에서 **CRITICAL 급 충돌은 없다**. 가장 주목해야 할 사항은 `ai-agent-tool-connection-rewrite.md` 의 미해결 결정 5건(TBD)인데, target spec 이 tool_* 영역을 "비활성/재작성 예정" 박스로 명확히 분리하고 있으므로 이번 착수 범위가 그 재설계를 포함하지 않는 한 실질적 충돌을 일으키지 않는다. `ai-context-memory-followup-v2.md` 의 잔여 항목 중 target 내 해소 여부는 대부분 spec 내 이미 반영된 것으로 보이며, `exec-park-durable-resume.md` PR-B2b 진행 중 상태도 target AI 노드 계약 스펙에 직접 간섭하지 않는다. `agent-memory-model-select.md` 는 SUPERSEDED 이므로 사실상 무영향. 전체적으로 착수 차단 요소 없이 안전하게 진행 가능하다.

## 위험도

LOW

---

STATUS: OK
