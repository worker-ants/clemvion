---
worktree: ai-agent-multiturn-persist-8bddbf
started: 2026-05-17
owner: developer
---

# AI Agent Multi-Turn 후속 turn 의 NodeExecution.outputData DB 영속 보강

## 배경 / 증상

워크플로 실행 중인 AI Agent (multi-turn) 와 한 탭에서 대화 중인 사용자가 같은 실행을 **다른 탭의 실행 상세 페이지** 에서 열면, 첫 user 메시지 외에 후속 user/assistant/tool 메시지가 표시되지 않는다.

- Tab 1 (워크플로 편집기 실행 패널): WebSocket `execution.ai_message` live 스트림으로 모든 turn 가시.
- Tab 2 (실행 상세, REST `/executions/:id`): DB 의 `NodeExecution.outputData` 만 읽음 → 빈 화면.

## 근본 원인

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2113-2211` — `handleAiMessageTurn` 의 `status === 'waiting_for_input'` 분기에서:

1. `contextService.setStructuredOutput()` / `setNodeOutput()` — in-memory cache 만 갱신
2. `eventEmitter.emitExecution(AI_MESSAGE)` + `emitExecution(EXECUTION_WAITING_FOR_INPUT)` — WS 만 emit
3. **`nodeExec.outputData` 갱신 + `nodeExecutionRepository.save()` 누락**

비교:
- 첫 turn waiting 진입 (`emitAiWaitingForInput`, `execution-engine.service.ts:1989-2079`): `nodeExec.outputData = withInteractionMeta(...)` + `updateExecutionStatus(savedExecution, WAITING_FOR_INPUT, nodeExec)` → DB save ✓
- Button 대기 (`waitForButtonInteraction`, `:2378-2461`): 같은 패턴으로 DB save ✓
- multi-turn **후속** turn (`handleAiMessageTurn`): in-memory only ✗ ← BUG

## Spec 충돌·정합성

- `spec/5-system/4-execution-engine.md:43` — "원자성 보장: running ↔ waiting_for_input 전이는 짝이 되는 NodeExecution 상태 변경과 **단일 DB 트랜잭션**". 후속 turn 도 결과적으로 같은 상태에 머무는 self-transition 이며, outputData 의 변경 사항은 SoT 영속이 필요하다.
- `spec/5-system/4-execution-engine.md:646` — "`NodeExecution.outputData` 가 영구 SoT".
- `spec/4-nodes/3-ai/1-ai-agent.md:290` — "종료 조건 미충족 시 다시 `waiting_for_input` 상태로 전환 (§7.4 — `output.result.messages` 가 누적 상태로 갱신)". 갱신 결과는 SoT 인 outputData 에 반영되어야 한다는 의도가 spec 본문에 명시.
- `spec/5-system/6-websocket-protocol.md:721` — `source` 마커의 영속 정책은 미정이지만, 본 fix 는 `source` 컬럼 신설이 아닌 기존 wire 페이로드(`source` 누락 시 'live' 폴백) 영속이므로 본 spec 결정에 영향을 주지 않는다.

→ Spec 변경 불요. backend 단일 파일 수정으로 해결 가능.

## 작업

- [x] 스펙 분석 (`spec/4-nodes/3-ai/1-ai-agent.md` §7.4, `spec/5-system/4-execution-engine.md` §원자성, `spec/5-system/6-websocket-protocol.md` §4.4)
- [x] consistency-check --impl-prep (관련 spec 영역) — `review/consistency/2026/05/17/21_25_34/`
- [x] 테스트 선작성 — `execution-engine.service.spec.ts` 의 `handleAiMessageTurn` 분기에 다음 케이스 추가:
  - 케이스 A: multi-turn 후속 turn 의 `waiting_for_input` 처리 후 `nodeExecutionRepository.save` 가 호출되고 outputData 의 `messages` 가 누적치를 반영한다
  - 케이스 B: `_resumeState` 가 DB 영속 outputData 에 포함되지 않는다 (WARN #6 — 기존 정책 회귀 방지)
  - 케이스 C: outputData 의 meta.interactionType 이 `'ai_conversation'` 으로 마킹된다 (snapshot reconcile 일관성)
- [x] 구현 — `handleAiMessageTurn` 의 waiting 분기에 `nodeExec.outputData = withInteractionMeta(safe, 'ai_conversation')` + `nodeExecutionRepository.save(nodeExec)` 추가. `_resumeState` allowlist destructure strip 및 nodeExec null warn 로그 적용.
- [x] API 문서 / 사용자 매뉴얼 영향 여부 확인 — REST `/executions/:id` 응답은 기존 `NodeExecution.outputData` 그대로 통과시키는 구조 (PROJECT.md "변경 유형 → 갱신 위치 매핑" 의 "백엔드 API 추가·변경" 미해당), 사용자 매뉴얼에 외부 노출 컨트랙트 신규 항목 없음 → 갱신 불요.
- [x] TEST WORKFLOW — lint·unit·build·e2e
- [x] REVIEW WORKFLOW — /ai-review, RESOLUTION.md — `review/code/2026/05/17/21_47_58/`
- [ ] plan complete 이동 (마지막 PR 안에서)

## Consistency-Check 결과 (review/consistency/2026/05/17/21_25_34/)

- **BLOCK: YES** 이지만 Critical 1건은 본 작업과 무관한 `spec/conventions/cafe24-api-catalog/_overview.md` 파일명 규약 위반 — project-planner 위임 사안이며 본 PR scope 밖. 본 작업 차단 사유 아님.
- 직접 관련 WARNING (plan_coherence #14): `plan/in-progress/ai-thread-source-mark.md` Phase 2 가 같은 `handleAiMessageTurn` 메서드의 `ai_message` emit 분기를 손댈 예정. 본 PR 은 같은 함수의 **다른 라인(NodeExecution.outputData persist 누락 보강)** 을 만지므로 직접 충돌 없음. Phase 2 가 아직 미시작 상태라 본 PR 이 먼저 머지되어도 안전. 머지 후 ai-thread-source-mark 가 rebase 할 때 함께 손볼 함수만 인지하면 됨.
- 그 외 WARNING (meta.interactionType 위치 등) 은 기존 spec/구현이 이미 채택한 패턴이며 본 PR 이 새 위반을 도입하지 않음 — 기존 `emitAiWaitingForInput` 와 동일한 `withInteractionMeta(..., 'ai_conversation')` 패턴 그대로 따라간다.

## Side Effect 점검

- 영향 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (단일 메서드)
- 의존성: `withInteractionMeta` 헬퍼는 같은 파일/모듈에 이미 존재 (button/form/첫 turn waiting 에서 사용 중)
- WS 페이로드 변경 없음 → frontend 변경 불요
- REST snapshot 페이로드는 의도된 보강 (더 많은 turn 이 outputData 에 반영) → `apply-execution-snapshot.ts` 의 기존 hydration 분기가 그대로 호출되어 자동 복원
- 트랜잭션 격리: `emitAiWaitingForInput` 가 사용한 `updateExecutionStatus` 와 동일 트랜잭션 패턴을 적용 — `Execution` 상태는 이미 WAITING_FOR_INPUT 이므로 self-transition 으로 처리 (또는 단순 `nodeExecutionRepository.save` 만 호출하고 `Execution` 은 건드리지 않음 — 결정은 구현 단계에서 기존 패턴과 정합성 우선)
- `recoverStuckExecutions` 와의 상호작용: 기존 `_resumeState` strip 정책 유지 (WARN #6)

## Follow-up

- [ ] (옵션) spec/5-system/6-websocket-protocol.md §4.4.6 의 `source` 마커 영속 정책 결정과 함께, multi-turn 후속 turn 의 outputData 갱신 시점을 §4.4 또는 conversation-thread 컨벤션에 명시 — project-planner 위임 후보. 본 PR 의 scope 밖.
- [ ] (ai-review W2) `nodeExec.outputData = …` 후 `save()` 패턴을 TypeORM `update(id, { outputData })` 단일 쿼리로 전환 — button/form/AI 첫 turn 모두 동일 패턴이라 cross-cutting refactor. 별 plan 으로 분리.
- [ ] (ai-review W8) `codebase/frontend/src/lib/docs/__tests__/registry.test.ts` 의 `it.runIf(hasRealDocs)` 조건부 실행 — CI step 에서 `content/docs` 존재 확인 또는 skip 시 warn 로그. 별 plan.
- [ ] (ai-review INFO 5) `catalog-sync.spec.ts` 와 `registry.test.ts` 의 `__dirname` `..` 반복 패턴을 공유 `repoRoot()` 헬퍼로 중앙화 — monorepo housekeeping.
- [ ] (consistency WARN 1, 2, 5) Information Extractor multi-turn 의 WebSocket 커맨드 · 엔진 continuation bus 경로 spec 보강 + AI Agent §5 예약 포트 `completed` 추가 — project-planner 위임.
- [ ] (consistency Critical) `spec/conventions/cafe24-api-catalog/_overview.md` 파일명 규약 위반 (언더스코어 prefix) — project-planner 위임. 본 PR scope 밖.
