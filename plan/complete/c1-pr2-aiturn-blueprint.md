---
parent: plan/complete/c1-engine-split.md (PR2)
branch: claude/engine-split-s2-aiturn (base = PR1 claude/engine-split-s1-nodebootstrap)
status: complete (PR #625 머지)
created: 2026-06-17
spec_impact: none
---

# PR2 청사진 — AiTurnOrchestrator + EngineDriver (C-1 step2)

> AI 멀티턴 생명주기 ~900줄을 `ExecutionEngineService` 에서 신규 `AiTurnOrchestrator` 로 추출.
> 엔진 내부 통신은 신규 `EngineDriver`(token `ENGINE_DRIVER`, `useExisting: ExecutionEngineService`)
> 경유 — `WorkflowExecutor` 재사용 금지(과적), 이벤트 발행은 `ExecutionEventEmitter` 직접 주입 유지(§4.4).
> **최고 회귀 민감 구간** — 단계적 추출 + 추출 전 테스트 캡처 필수.

## 추출 대상 메서드 (현재 라인, PR1 적용 후 worktree 기준)

| 메서드 | 라인 | 분류 |
| --- | --- | --- |
| `continueAiConversation` | 4451–4470 | **PUBLIC** (websocket.gateway.ts:620) → 엔진 잔류, orchestrator 위임 |
| `endAiConversation` | 4475–4486 | **PUBLIC** (websocket.gateway.ts:691) → 엔진 잔류, 위임 |
| `waitForAiConversation` | 5483–5531 | 이동 (first-turn 진입, PARK_RELEASED 반환 — executeNode 호출) |
| `handleAiResumeTurn` | 1989–2028 | 이동 (registry 위임 진입점) |
| `processAiResumeTurn` | 5554–5665 | 이동 (코어 dispatcher) |
| `handleAiMessageTurn` | 5870–6215 | 이동 (가장 무거움 — handler.processMultiTurnMessage) |
| `emitAiWaitingForInput` | 5698–5840 | 이동 |
| `emitUserMessageLiveSignal` | 5841–5857 | 이동 (trivial) |
| `reparkAiResumeTurn` | 5679–5690 | 이동 |
| `handleAiEndConversation` | 6217–6251 | 이동 |
| `handleAiTurnError` | 6276–6344 | 이동 |
| `finalizeAiNode` | 6537–6760 | 이동 (updateExecutionStatus 경유) |
| `extractAiTurnErrorPayload` | 6445–6524 | static — 이동 또는 shared util |
| `resolveHasDefaultLlmConfigCached` | 7673–7686 | **엔진 잔류**(llmDefaultConfigCache single-flight) → driver 노출 |
| `clearLlmDefaultConfigCache` | 7692–7699 | **엔진 잔류**(runExecution finally 호출) → driver 노출 |

`WaitingInteractionType` (line 166–172): **이동 안 함** (interaction-type-registry.md §1.1 고정).

## orchestrator 직접 주입 (DI) 서비스
`NodeHandlerRegistry`·`ExecutionContextService`·`ExpressionResolverService`·`ExecutionEventEmitter`·
`Repository<NodeExecution>`·`Repository<Node>`·`LlmService`(또는 driver 경유)·`ConversationThreadService`·`Logger`.

## EngineDriver 인터페이스 (엔진 잔류 메서드 + mutable state seam)
`ENGINE_DRIVER` 토큰, `useExisting: ExecutionEngineService`. 최소 표면:
- `updateExecutionStatus(execution, newStatus, linkedNodeExec?, opts?: {allowRetryReentry?}): Promise<boolean>` — guarded 전이 + segmentStartMs active-time 추적
- `stageDurableResumeSnapshot(execution, context): void` — §7.5 durable snapshot(V087)
- `buildRetryReentryState(execution, node, context, retryState, opts?: {resumeMode?}): {resumeState, initialAction?}` — AI resume ↔ retry 공유
- `buildResumeCheckpoint(output): Record|undefined` — §1.3 allow-list 서브셋 (credential-free)
- `isCheckpointEligibleNodeType(nodeType): boolean`
- `contextKeyOf(context): string`
- `applyPortSelection(output): unknown`
- `resolveHasDefaultLlmConfigCached(workspaceId, context): Promise<boolean>` — single-flight cache
- `clearLlmDefaultConfigCache(executionId): void`

(pure helper[contextKeyOf·applyPortSelection·isCheckpointEligibleNodeType]는 shared util 대안 가능하나
실행 의미 결합이 커 driver 유지 권장. 나머지는 인스턴스 state 필요 → driver 필수.)

## registry 위임 (resume-turn-dispatch)
`resumeTurnRegistry` getter 의 ai_conversation 엔트리 (line 1930–1941) — registry 는 엔진 잔류,
`handle: (ctx) => this.aiTurnOrchestrator.handleAiResumeTurn(ctx)` 로 위임. `selects` 의
`isCheckpointEligibleNodeType` 도 그대로 엔진 잔류.

## 테스트 영향 (execution-engine.service.spec.ts)
이동 → `ai-turn-orchestrator.spec.ts` (mock EngineDriver): describe @4481(ai_message emit), @5416/@5764
(processAiResumeTurn 방어 W11/W12/W5), @14561/@14635/@14768(conversation meta/debug/config builders).
엔진 잔류: @1069/@1091(continue/endAiConversation 위임 계약), @13131(applyRetryLastTurn — retry 는 PR4),
@10160(rehydrateContext), @15688(driveCallStackResume nested), extractAiTurnErrorPayload@6142(static, 택일).

## 추출 순서 (저위험→고위험)
1. **Phase1(LOW)**: EngineDriver 인터페이스 + ENGINE_DRIVER 토큰 + provider. 동작 무변.
2. **Phase2(LOW)**: AiTurnOrchestrator 골격 + DI. static/trivial 이동(extractAiTurnErrorPayload·emitUserMessageLiveSignal·builders).
3. **Phase3(MED)**: leaf 이동(reparkAiResumeTurn·handleAiEndConversation·handleAiTurnError·finalizeAiNode) — mock driver 테스트.
4. **Phase4(HIGH)**: handleAiMessageTurn → processAiResumeTurn → handleAiResumeTurn. 분기 로직 정확 보존. registry 위임 갱신.
5. **Phase5(HIGHEST)**: waitForAiConversation 이동 — PARK_RELEASED 타이밍이 graph 순회 제어. full park→resume→complete 통합 테스트.
6. **Phase6(CRIT)**: continue/endAiConversation 위임화(엔진 잔류).

## 최고 회귀 위험
1. `_resumeCheckpoint` allow-list(§1.3) — checkpoint round-trip 동등성 테스트. buildResumeCheckpoint 엔진 단일 소스 유지.
2. `segmentStartMs` lifecycle — orchestrator 는 execution.status 직접 변경 금지, driver.updateExecutionStatus 만.
3. `llmDefaultConfigCache` single-flight — driver 경유, 병렬 브랜치 캐시 적중 테스트.
4. context-absence race (handleAiMessageTurn @5957–5964) — getContext undefined graceful no-op 보존.
5. ResumableNodeHandler 타입 가드 — 비-resumable 노드 throw 보존.

## 게이트 (PR1 과 동일)
TEST(lint·unit·build·e2e execution-park-resume) → /ai-review → /consistency-check --impl-done.
spec 무변 예상(추출 서비스 execution-engine/** 글로브 내). 단 spec §Rationale enrichment 는 체인 종료 시 일괄.
