# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전)
**대상 영역**: `spec/5-system/`
**검토 일시**: 2026-06-05

---

## 발견사항

### 1. **[WARNING]** `spec/data-flow/3-execution.md` 시퀀스 다이어그램에 삭제 예정 fast-path 분기 잔존

- **target 위치**: `spec/5-system/4-execution-engine.md` §7.4 Worker 동작 항목 — "park 시 코루틴을 즉시 해제하므로(§4.x — Phase B) in-process resolver(`pendingContinuations`)가 존재하지 않는다 — worker-side fast-path 는 제거됐고 재개 경로는 slow-path 로 일원화된다."
- **충돌 대상**: `spec/data-flow/3-execution.md` L111 — `alt 로컬 pendingContinuations hit (fast path)` / `Eng->>Eng: resolver 호출 → waitForX await 풀림` 분기가 현행 코드 경로처럼 시퀀스 다이어그램에 살아있음.
- **상세**: `4-execution-engine.md §7.4` 는 Phase B 완료 후 모델로 "fast-path 제거, slow-path 일원화"를 spec 에 선행 갱신(Phase B 착수 전 spec 모델 개정 완료 — plan 메모 참조)했다. 그러나 `data-flow/3-execution.md` 의 시퀀스 다이어그램은 이 변경을 반영하지 않아 두 문서 간 continuation 재개 흐름이 모순된다. 다이어그램이 Phase B 이전 상태(fast-path 존재)를 사실로 묘사하고 있어, 개발자가 `data-flow/3-execution.md` 를 참조하면 잘못된 구현 모델을 따를 수 있다.
- **제안**: Phase B 구현 착수 전(`pendingContinuations` Map 제거·`waitForX await` 제거 전) 또는 착수 시점에 `spec/data-flow/3-execution.md` 시퀀스 다이어그램을 `4-execution-engine.md §7.4` 의 slow-path 일원화 모델로 동기 갱신. `alt 로컬 pendingContinuations hit` 분기 제거 — 단일 `Eng->>PG: ExecutionContext 재구성 (rehydration)` 경로로 단순화. `data-flow/3-execution.md` 의 `pending_plans` 에 `exec-park-durable-resume.md` 등록 권장.

---

### 2. **[WARNING]** `spec/4-nodes/6-presentation/0-common.md` 의 `pendingContinuations` 기반 invariant 서술이 Phase B 모델과 충돌

- **target 위치**: `spec/5-system/4-execution-engine.md` §7.4 / §Rationale "park 즉시 해제 + slow-path 일원화" — Phase B 에서 `pendingContinuations` Map 이 제거된다.
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` L413 — "`waitForAiConversation` 이 실행 중인 경우에도 `pendingContinuations` 에 이미 등록된 resolve 가 `button_click` payload 로 호출될 수 있으나 — 현재 UI 는 … 본 경로로 `'button_click'` action 이 도달하지 않는 자연 invariant 가 성립한다."
- **상세**: 이 문장은 `pendingContinuations` resolve 가 존재하는 것을 전제로 "도달하지 않는 자연 invariant" 를 기술한다. Phase B 가 `pendingContinuations` 를 제거하면 이 invariant 서술의 전제 자체가 사라진다. Phase B 이후에는 `button_click` 이 오더라도 rehydration 경로에서 처리되므로 `waitForAiConversation` 에 직접 resolve 가 "이미 등록" 되어있는 상황이 존재하지 않는다. 이 문서는 Phase B 변경 후 잘못된 구현 메커니즘을 참조하는 오래된 노트가 된다.
- **제안**: Phase B 구현 시 해당 invariant 서술을 rehydration 모델 기준으로 재작성. `pendingContinuations` 전제를 제거하고 "rehydration 경로에서 `button_click` type 에 대한 dispatch 는 `waitForAiConversation` 의 케이스 분기에 해당하지 않으므로 `else` 분기(warn + loop 재진입)로 graceful degradation" 으로 정정.

---

### 3. **[INFO]** `spec/data-flow/3-execution.md` 에 `exec-park-durable-resume` plan 미등록

- **target 위치**: `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/conventions/conversation-thread.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md` — 모두 `pending_plans: - plan/in-progress/exec-park-durable-resume.md` 등록 완료.
- **충돌 대상**: `spec/data-flow/3-execution.md` — frontmatter 에 `pending_plans` 자체가 없음 (no YAML frontmatter).
- **상세**: Phase B 는 `data-flow/3-execution.md` 의 시퀀스 다이어그램을 수정해야 하므로 해당 파일도 이 plan 의 영향 범위다. frontmatter 미등록은 워크플로 추적상 누락.
- **제안**: `spec/data-flow/3-execution.md` 파일 상단에 YAML frontmatter 추가 또는 기존 `pending_plans` 블록에 `exec-park-durable-resume.md` 등록. Phase B 착수 시 project-planner 가 동기 갱신.

---

### 4. **[INFO]** 나머지 `spec/5-system/` 영역 (auth, graph-rag, mcp-client 등) — 충돌 없음

- `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md` 및 그 관련 데이터 모델(`spec/1-data-model.md`) 정의들은 `exec-park-durable-resume` plan 의 변경 범위(Execution 모델, execution engine 재개 경로, AI 노드 checkpoint) 와 교차하지 않는다. 데이터 모델 엔티티(`Execution.conversation_thread`, `Execution.user_variables` — V084/V085)는 `spec/1-data-model.md §2.13` 에 정합하게 정의되어 있으며, 세 spec 모두(`4-execution-engine.md`, `conversation-thread.md`, `1-data-model.md`) 가 동일 컬럼·정책을 일관되게 기술한다. RBAC / auth / graph-rag / mcp 영역과 충돌 없음.

---

## 요약

`spec/5-system/` 대상 영역은 Phase A(A1/A2a/A2b/A3) spec 갱신이 이미 완료되어 `4-execution-engine.md`, `1-data-model.md`, `conventions/conversation-thread.md`, `4-nodes/3-ai/1-ai-agent.md`, `4-nodes/3-ai/3-information-extractor.md` 간 내부 일관성은 확보된 상태다. 핵심 충돌은 Phase B spec 모델 선행 갱신(`4-execution-engine.md §7.4` 의 slow-path 일원화·fast-path 제거 선언)이 `spec/data-flow/3-execution.md` 시퀀스 다이어그램 및 `spec/4-nodes/6-presentation/0-common.md` 의 `pendingContinuations` 기반 서술에 전파되지 않아 발생하는 문서 간 분기다. 이 두 문서는 Phase B 실제 구현 착수 또는 완료 시점에 반드시 동기 갱신이 필요하며, 구현 착수 전 현시점에서는 Phase B 코드 작업의 spec 갱신 체크리스트로 관리하면 충분하다. CRITICAL 수준 모순(구현 불가 유발)은 발견되지 않았다.

---

## 위험도

**LOW**

(Phase B 구현 착수 전에는 WARNING 두 건 모두 "선행 spec 갱신이 다른 문서에 미전파"된 정도이며, 현행 코드에서 fast-path 가 아직 동작 중이므로 실제 구현 불일치는 아님. Phase B 착수 시 위험도가 상승하므로 그 시점에 두 문서 동기 갱신 의무화.)
