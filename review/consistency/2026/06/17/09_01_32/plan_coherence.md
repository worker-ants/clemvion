# Plan 정합성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (구현 완료 후, diff-base=`claude/engine-split-s1-nodebootstrap`)
검토 범위: PR2 AiTurnOrchestrator 추출 구현 변경

---

## 발견사항

### 1. 정합 확인 — 미해결 결정 우회 없음

`c1-engine-split.md` PR2 설계 및 `c1-pr2-aiturn-blueprint.md` 에 명시된 핵심 결정들이 구현에서 준수됐는지 확인:

- **`WaitingInteractionType` 이동 금지**: 구현의 `ai-turn-orchestrator.service.ts` 는 `WaitingInteractionType` 을 `execution-engine.service` 에서 **타입 전용 import** 로만 참조하고 이동하지 않았다 (`interaction-type-registry.md §1.1` 핀 준수). `ai-conversation-helpers.ts` 도 `WaitingInteractionType` 을 `type` import 로만 사용.
- **`EngineDriver` 신설 및 `WorkflowExecutor` 재사용 금지**: 구현이 `ENGINE_DRIVER` 토큰 + `EngineDriver` 인터페이스 경유로 driver 호출하고 있으며, `WorkflowExecutor` 재사용 흔적 없음.
- **이벤트 발행은 `ExecutionEventEmitter` 직접 주입**: `AiTurnOrchestrator` 가 `ExecutionEventEmitter` 를 직접 주입받아 사용 — spec §4.4 준수.

### 2. 정합 확인 — 선행 plan(exec-park-durable-resume) 전제 준수

`exec-park-durable-resume.md` 의 핵심 결정 D4(turn-단위 park)·B3(full B3 제거 완료)·`reparkAiResumeTurn`·`processAiResumeTurn` 행동 계약이 구현에 그대로 이식됐다. `ai-turn-orchestrator.service.ts` 의 `waitForAiConversation` 이 `PARK_RELEASED` 즉시 반환, `processAiResumeTurn` 이 re-park 또는 `void` 반환 — exec-park 설계 계약 보존.

### 3. 정합 확인 — 추출 서비스 글로브 위치

신규 파일 전체가 `codebase/backend/src/modules/execution-engine/` 하위에 위치 — `spec/5-system/4-execution-engine.md` frontmatter `code:` 의 `codebase/backend/src/modules/execution-engine/**` 글로브 자동 커버. `c1-engine-split.md §PR2–4` 의 "spec 무변 예상" 조건 충족.

### 4. [INFO] `exec-park-durable-resume.md` 잔여 미완 항목과의 관계 메모

`exec-park-durable-resume.md` 의 미완 항목 (`umbrella 잔여: PR3 rehydration 일반화, node-cancellation §2, W4 cross-worktree rebase`) 이 본 PR2 추출 변경과 **간섭하지 않음** — 재확인. 단, PR2 이후 PR3(Form/Button InteractionService) 착수 시 `exec-park-durable-resume.md` 의 `processFormResumeTurn`/`processButtonResumeTurn` 경계도 동일 EngineDriver 패턴으로 이관됨을 plan 에서 이미 예고 (`c1-engine-split.md §PR3`). 추가 plan 갱신 불요.

### 5. [INFO] spec §Rationale enrichment 체인 종료 시 일괄 처리 추적

`c1-engine-split.md §spec 갱신` 에 "PR4 DoD 에 spec Rationale/§1.0 enrichment planner 반영 + /consistency-check --spec BLOCK:NO 포함" 으로 명기돼 있다. 현재 PR2 단계에서는 spec 무변 예상이 유지되므로 별도 조치 불요. PR4 완료 시 이 체인이 실행돼야 함을 추적 메모로 남긴다.

### 6. [INFO] `execution-engine-residual-gaps.md` G1/G2 연관성

`execution-engine-residual-gaps.md` 의 BLOCKED 항목(G1 WS `execution.start` gate, G2 errorPolicy `continue` 분기)은 본 PR2 추출 범위와 **무관** — 엔진 모듈 내 글로브 커버 범위는 동일하나 G1/G2 는 `websocket.gateway.ts` / `shutdown-state.service.ts` 표면이라 AI 멀티턴 추출과 간섭 없음.

---

## 요약

Plan 정합성 관점에서 PR2 AiTurnOrchestrator 구현은 `c1-engine-split.md`·`c1-pr2-aiturn-blueprint.md` 에 명시된 설계 결정을 충실히 따랐다. `WaitingInteractionType` 이동 금지(interaction-type-registry.md §1.1 핀), `EngineDriver` 신설·`WorkflowExecutor` 재사용 금지, 이벤트 발행 `ExecutionEventEmitter` 직접 주입(spec §4.4), turn-park/PARK_RELEASED 계약(exec-park D4/B3) 등 미해결 결정 우회 없음. 미해결 plan 항목(`execution-engine-residual-gaps.md` G1/G2, `exec-park-durable-resume.md` 잔여 umbrella)과 표면이 겹치지 않아 후속 항목 무효화도 없다. spec §Rationale enrichment 는 계획대로 PR4 체인 종료 시 일괄 처리 예정으로 현 단계에서 누락이 아니다.

---

## 위험도

NONE

---

STATUS: OK
