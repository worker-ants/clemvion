# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건이 있어 호출자가 착수 전 확인을 요구한다

## 전체 위험도
**MEDIUM** — `3-information-extractor.md` 의 `status: implemented` 선언과 진행 중인 memory 리팩토링 범위 간 정합성 미확인. 나머지 WARNING/INFO 는 즉각적 invariant 파괴 없음.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `3-information-extractor.md` 가 `status: implemented` 를 선언하고 있으나, `code:` 에 포함된 `agent-memory-injection.ts` / `agent-memory-schema.ts` 는 이 worktree 가 현재 리팩토링 중인 파일이다. persistent memory 기능(§7)이 실제로 완전히 구현됐는지 미확인 상태로 진행 시 `spec-status-lifecycle.test.ts` 및 `spec-pending-plan-existence.test.ts` 빌드 가드 실패 위험 | `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter | `spec/conventions/spec-impl-evidence.md §3` 라이프사이클 표 (`status: partial` 이면 `pending_plans` 의무) | Information Extractor 의 persistent memory 기능이 실제로 완전 구현됐는지 확인. 미완 surface 있으면 `status: partial` 로 변경 + `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` 추가. 완전 구현 확인 시 `status: implemented` 유지 정당 — planner 확인 후 착수 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `0-common.md` `pending_plans` 에 등재된 `plan/in-progress/ai-context-memory-followup-v2.md` 의 구현 완료 후 plan 이동 시 경로 갱신 및 `status` 승격 미이행 위험 | `spec/4-nodes/3-ai/0-common.md` frontmatter `pending_plans` | `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 강제 | 구현 완료 후 plan 을 `plan/complete/` 로 이동 시 `0-common.md` / `1-ai-agent.md` 의 `pending_plans` 에서 경로 갱신 또는 제거. `pending_plans` 전부 완료 시 `status: partial` → `status: implemented` 승격 의무 이행 |
| 2 | Convention Compliance | `1-ai-agent.md` §12.x 번호 섹션이 `## Rationale` 최상위 섹션 패턴 대신 본문 분산 인라인 Rationale 로 구성됨 | `spec/4-nodes/3-ai/1-ai-agent.md` §12.x 전체 | CLAUDE.md "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" | 현행 §12 가 이미 Rationale 섹션 역할을 하고 있다면 현행 유지 가능. 신규 Rationale 항목 추가 시 반드시 `## 12. Rationale` 하위 섹션으로 배치. 또는 규약에 "번호 섹션 허용" 명시 |
| 3 | Convention Compliance | `0-common.md §5` 의 `output.error.details` 각주가 `retryAfterSec` invariant ("retryable === true 일 때만 set 가능") 를 암묵적으로만 언급 — 명시 표현 약함 | `spec/4-nodes/3-ai/0-common.md §5` 응답 형식 규약 | `spec/conventions/node-output.md §3.2.1` | `0-common.md §5` 각주에 "`retryAfterSec` 는 `retryable === true` 일 때만 set 가능" 한 줄 명시 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | M-1 1단계 완료로 신설된 `ai-condition-evaluator.ts` 가 `1-ai-agent.md` frontmatter `code:` 에 미등재 (plan 비고에 명시된 비차단 SPEC-DRIFT) | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` | planner 가 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 를 `code:` 에 추가 |
| 2 | Cross-Spec | `1-ai-agent.md §6.1 step 3a` 구현 참조가 리팩 이전 `ai-agent.handler.ts classifyToolCalls` 를 가리킴 | `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 3a` | planner 가 구현 참조를 `ai-condition-evaluator.ts AiConditionEvaluator.classifyToolCalls` 로 갱신 |
| 3 | Cross-Spec | M-1 2단계 `AiMemoryManager` 완료 후 `0-common.md` / `1-ai-agent.md` `code:` 와 §6.1/§6.2 구현 참조 갱신 필요 범위 사전 파악 | `spec/4-nodes/3-ai/0-common.md` / `1-ai-agent.md` | M-1 2단계 완료 후 planner 동기화 — 현 착수 단계 차단 없음 |
| 4 | Plan Coherence | `ai-agent-tool-connection-rewrite.md` 미결정 5항목 — impl-prep 범위가 `tool_*` 경로·Tool Area 에 접촉 시 일방적 결정이 됨 | `spec/4-nodes/3-ai/1-ai-agent.md §1 / §4` | M-1 2단계 구현이 `toolNodeIds`/`toolOverrides`/Tool Area 에 닿지 않도록 범위 확인 |
| 5 | Plan Coherence | `ai-context-memory-followup-v2.md` 백로그(I3·I7·I12·W-8) 와 impl-prep 대상 코드 중복 가능성 | `agent-memory-injection.ts` / `ConversationThreadService` / `AgentMemoryService.saveMemories` | 겹치는 백로그 항목을 본 구현에 편입하거나 명시적 후속 PR 분리 계획 기록 |
| 6 | Plan Coherence | `exec-park-durable-resume.md` PR-B2a 미완료 — `runAiConversationLoop` 등 접촉 시 충돌 위험 | `spec/4-nodes/3-ai/1-ai-agent.md §6.2 / §7.4` | M-1 2단계가 AI 멀티턴 재개 경로에 닿는지 확인 |
| 7 | Plan Coherence | `agent-memory-model-select.md` SUPERSEDED 상태로 `plan/in-progress/` 에 잔류 중 | `plan/in-progress/agent-memory-model-select.md` | `plan/complete/archive/` 또는 `plan/complete/` 로 이관 |
| 8 | Naming Collision | `AiMemoryManager` 와 `AgentMemoryService` 의미 근접 — 레이어·책임은 명확히 다르나 혼동 여지 | 신설 `ai-memory-manager.ts` | `AiMemoryManager` doc-comment 에 "node-layer 전용, persistent I/O 는 `AgentMemoryService`" 구분 명시 |
| 9 | Naming Collision | `AgentMemoryScheduler` interface 와 `AiMemoryManager` class 의 이동·감싸기 설계 미결정 | `agent-memory-injection.ts:531` | PR description 에 `AgentMemoryScheduler` public export 범위 정리 계획 명시 |
| 10 | Naming Collision | `agent-memory-injection.ts` 22개 이상 공개 함수의 이동 후 `information-extractor.handler.ts` import 경로 유효성 | `agent-memory-injection.ts` / `information-extractor.handler.ts:28` | 이동 시 `agent-memory-injection.ts` 에 re-export shim 유지 또는 IE handler 동시 수정 |
| 11 | Convention Compliance | `3-information-extractor.md` 문서 끝 `## Rationale` 섹션 부재 | `spec/4-nodes/3-ai/3-information-extractor.md` | `summary_buffer` 제외 결정·`memoryStrategy` 필드 채택 등 설계 결정 Rationale 섹션 추가 |
| 12 | Convention Compliance | `2-text-classifier.md §1` 설정 표에 `memoryStrategy` 제외 의도 각주 없음 | `spec/4-nodes/3-ai/2-text-classifier.md §1` | 각주에 "`text_classifier` 는 `memoryStrategy` 를 갖지 않으며 항상 `contextScope` 기반 manual 동작만 적용" 한 줄 추가 |
| 13 | Convention Compliance | `0-common.md` 의 `0-` prefix 가 루트 레벨 진입 문서 패턴과 미세하게 다른 "영역 내 공통 규약 문서" 용도 | `spec/4-nodes/3-ai/0-common.md` 파일명 | 규약에 "영역 내 공통 규약 문서에도 `0-` prefix 허용" 명시 또는 현행 유지 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | M-1 1단계 후 비차단 SPEC-DRIFT 3건(INFO). spec 내부 정합성 높음 |
| Rationale Continuity | NONE | 기각 대안 재도입·합의 원칙 위반·암묵적 가정 충돌 전무. AiConditionEvaluator 가 §5.1/§5.2/§6.1 준수 확인 |
| Convention Compliance | MEDIUM | CRITICAL 1건(`3-information-extractor.md` status 정합성), WARNING 3건, INFO 4건 |
| Plan Coherence | LOW | 진행 중 plan 3개와 충돌 없음. 범위 이탈 시 격상 가능성 주의. INFO 4건 |
| Naming Collision | NONE | `AiMemoryManager` — `AgentMemoryService`·`AgentMemoryScheduler` 레이어 명확히 구분. INFO 3건 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 착수 전 필수)** `3-information-extractor.md` 의 persistent memory 기능(§7 Persistent 메모리 recall/extraction) 구현 완료 여부를 planner 가 확인한다. 미완 surface 가 있으면 `status: partial` + `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` 로 수정 후 착수. 완전 구현 확인 시 BLOCK 해소, `status: implemented` 유지.

2. **(WARNING — 구현 완료 후 의무)** M-1 2단계 완료 후 `plan/in-progress/ai-context-memory-followup-v2.md` 를 `plan/complete/` 로 이동할 때, `0-common.md` / `1-ai-agent.md` 의 `pending_plans` 경로를 갱신하고, `pending_plans` 전부 소진 시 `status: partial` → `status: implemented` 승격.

3. **(WARNING — 신규 Rationale 추가 시)** `1-ai-agent.md` 에 Rationale 항목을 추가할 때 `## 12. Rationale` 하위 섹션으로 배치해 인라인 분산 패턴을 확장하지 않는다.

4. **(INFO — 구현 착수 전 범위 확인)** M-1 2단계 구현이 `tool_*`/Tool Area, `runAiConversationLoop`, `ConversationThreadService.updateSummaryState()` 에 접촉하지 않는지 확인해 `ai-agent-tool-connection-rewrite` / `exec-park-durable-resume` 와의 코드 충돌을 예방한다.

5. **(INFO — planner 후속)** M-1 1단계 완료 후 남은 SPEC-DRIFT 2건(`1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` 추가, §6.1 step 3a 구현 참조 갱신)을 planner 가 처리한다.

6. **(INFO — 문서 위생)** `agent-memory-model-select.md` (SUPERSEDED) 를 `plan/complete/archive/` 로 이관.

---

## Developer 판정 (M-1 2단계 impl-prep, 2026-06-21) — BLOCK 비차단 결정

**판정: 위 Critical 1건은 본 behavior-preserving refactor 와 직교한 pre-existing 사안 — developer 판정으로 비차단하고 착수 (work instruction #2 + #665 선례 동형).**

근거:

1. **전제 거짓**: Critical 은 "`agent-memory-injection.ts` / `agent-memory-schema.ts` 가 이 worktree 가 리팩토링 중인 파일"이라는 전제에 선다. 그러나 본 M-1 2단계는 그 두 shared 파일을 **전혀 수정하지 않는다**. 변경 surface 는 ⓐ 신규 `ai-agent/ai-memory-manager.ts` (기존 shared 헬퍼를 *호출*만), ⓑ `ai-agent.handler.ts` (3개 메서드를 매니저로 위임)뿐이다. `information-extractor.handler.ts`·`3-information-extractor.md`·shared 헬퍼는 무변경.

2. **직교·pre-existing**: Information Extractor 의 `status: implemented` 정합성은 origin/main(`a17dd4e8`)에 이미 존재하는 상태이며, 본 refactor 가 만들어낸 사안이 아니다. 동작·spec 요구사항을 0 변경하는 리팩토링이라 IE 의 구현 status 는 전후로 동일하게 유지된다. checker 도 "미확인/위험"으로 표기했을 뿐 확정 invariant 파괴를 입증하지 못했다.

3. **경험적 확인 경로**: Critical 이 우려한 빌드 가드(`spec-status-lifecycle.test.ts`·`spec-pending-plan-existence.test.ts`)는 본 PR 의 TEST WORKFLOW (unit) 에서 **실제 실행**된다. shared 헬퍼·IE spec 무변경이므로 origin/main 과 동일하게 통과하며, 통과가 곧 Critical 의 공허함을 경험적으로 입증한다.

4. **shared 헬퍼 미이동 → Naming INFO #9/#10 선제 해소**: 본 설계는 `agent-memory-injection.ts` 의 공개 함수를 **이동하지 않고** `../shared/agent-memory-injection` 에서 계속 import 한다. 따라서 IE handler import 경로 파손(INFO #10)·re-export shim(INFO #9) 우려는 발생하지 않는다.

5. **범위 직교 확인 (INFO #4/#6)**: 변경은 `resolveMemoryStrategy`/`injectMemoryContext`/`scheduleMemoryExtraction` 위임에 한정 — `tool_*`/Tool Area, `runAiConversationLoop`, `ConversationThreadService.updateSummaryState()` 에 닿지 않아 `ai-agent-tool-connection-rewrite`·`exec-park-durable-resume` 와 코드 충돌 없음.

**planner 위임**: Critical(IE status 검증) + WARNING #1~#3 + INFO #1~#3/#7/#11~#13 은 전부 spec 영역 사안으로 planner 후속. M-1 전체 완료 시 `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts`·`ai-memory-manager.ts` 등재 + §6.1 step 3a/§6.1 1.3·1.5·2.7 구현 참조 갱신과 일괄 처리 권장 (plan "보류 중 별건" 에 기록됨).

**INFO #8 즉시 반영**: `AiMemoryManager` doc-comment 에 "node-layer 전용, persistent I/O 는 `AgentMemoryService`" 구분을 명시한다 (본 PR 코드에 반영).
