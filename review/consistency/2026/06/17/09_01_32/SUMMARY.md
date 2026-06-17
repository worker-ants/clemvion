# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**MEDIUM** — Critical 1건(RehydrationError 이중 정의 구조적 취약성), Warning 5건(spec 포인터 구식화 2건, 테스트 이름 오용 1건, 타입 중복 1건, 테스트 블록 중복 1건)

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `RehydrationError` 이중 정의 구조적 취약성 — worktree 에서 원본 class 선언은 제거됐으나, `execution-engine.service.spec.ts` 와 `ai-turn-orchestrator.service.spec.ts` 가 각각 다른 경로(re-export vs 직접 import)로 같은 이름 클래스를 참조하여 re-export 체인이 끊길 경우 `instanceof` 충돌 재발 | `ai-conversation-helpers.ts` (export) vs `execution-engine.service.ts:348` (기존 non-export, 제거 여부 CI 미검증) | `execution-engine.service.spec.ts` · `ai-turn-orchestrator.service.spec.ts` 양쪽의 RehydrationError import 경로 불일치 | CI 빌드로 `execution-engine.service.ts` 의 원본 `class RehydrationError` 선언 제거 완료를 검증; 모든 소비자가 `ai-conversation-helpers` 에서 직접 import 하도록 단일화; `execution-engine.service.ts` 의 re-export 역할을 명시적으로 주석 문서화 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Convention Compliance | `classifyLlmError` 구현 포인터 구식화 — `ExecutionEngineService.classifyLlmError` 에서 `AiTurnOrchestrator` private static 으로 이동했으나 spec 주석 미갱신 | `spec/4-nodes/3-ai/1-ai-agent.md §10` 에러 코드 표 하단 주석 | 실제 구현 `AiTurnOrchestrator.extractAiTurnErrorPayload` | `spec/4-nodes/3-ai/1-ai-agent.md §10` 주석을 `구현: AiTurnOrchestrator.extractAiTurnErrorPayload (ai-turn-orchestrator.service.ts)` 로 갱신 |
| 2 | Cross-Spec | `interaction-type-registry.md §1.1` 에 새 소비자(`AiTurnOrchestrator`) 미등재 — 정의 위치 변경은 없으나 type-import 소비자 추가가 frontmatter `code:` 에 반영되지 않아 향후 enum 추가 시 동기화 누락 위험 | `spec/conventions/interaction-type-registry.md §1.1` frontmatter `code:` | `ai-turn-orchestrator.service.ts` (`WaitingInteractionType` type-import 소비) | `interaction-type-registry.md` frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 추가; §1.1 표에 AiTurnOrchestrator 소비 비고 추가 |
| 3 | Convention Compliance | `LLM_CONNECTION_ERROR` 테스트 이름이 spec error-codes.md 의미 기반 명명 원칙과 어긋남 — "client-layer 누출 코드" 표현이 Planned 미구현 public 코드인 것처럼 오해 유발 | `ai-turn-orchestrator.service.spec.ts:834~842` 테스트 이름 | `spec/4-nodes/3-ai/1-ai-agent.md §10` 에러 코드 표 + `spec/conventions/error-codes.md §1` | 테스트 이름을 `'레거시/미분류 명시 코드(LLM_CONNECTION_ERROR)가 들어왔을 때 LLM_CALL_FAILED 로 정규화 + retryable=true'` 로 수정; 또는 spec §10 에 정규화 규칙 명문화 |
| 4 | Naming Collision | `TurnDebugEntry` 인터페이스 동일 이름·다른 shape 이중 정의 — optional vs required 필드 차이, 향후 schema drift 위험 | `ai-conversation-helpers.ts:137-154` (`LlmCallRecord`, `TurnDebugEntry`) | `information-extractor.handler.ts:74-84` (`LlmCallTrace`, `TurnDebugEntry`) | 공유 타입 파일(`shared/llm-debug-types.ts`)로 추출하거나, 의도적 분리임을 주석에 명기; 중기적으로 두 정의 통합 권고 |
| 5 | Naming Collision | helper 함수 describe 블록 중복 — 함수 이관 후 구 spec 파일의 테스트 블록이 미제거되어 false green / silent regression 위험 | `ai-turn-orchestrator.service.spec.ts:925,999,1132` (`buildConversationMetaFromResumeState` 외 2건) | `execution-engine.service.spec.ts:14562,14636,14769` (동일 함수 대상 기존 describe 블록 잔류) | `execution-engine.service.spec.ts` 의 세 describe 블록 제거; canonical 테스트를 `ai-turn-orchestrator.service.spec.ts` 에 단일화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | WARN #6 주석이 폐기된 결정을 현재 시제로 기술 ("저장하지 않는다", "Phase 2 에서 해결 예정") — 코드 동작은 올바르나 독자 혼동 가능 | `ai-turn-orchestrator.service.ts` `emitAiWaitingForInput` persistedOutput 블록 주석 | WARN #6 주석을 번복 사실 반영으로 교체; "Phase 2 예정" 문장 제거 |
| 2 | Rationale Continuity | MAX_UNKNOWN_SKIPS 폐기 근거가 코드 주석에만 존재하고 spec Rationale 미기록 | `ai-turn-orchestrator.service.ts` processAiResumeTurn unknown action.type 처리 | spec Rationale "park 즉시 해제" 항에 "BullMQ attempts 로 대체됨" 추가 (선택) |
| 3 | Rationale Continuity | EngineDriver seam + forwardRef DI 순환 import 해소 전략이 spec Rationale 에 미기록 | `ai-conversation-helpers.ts` JSDoc + `ai-turn-orchestrator.service.ts` imports | spec Rationale 에 단항 추가 권장 (선택) |
| 4 | Rationale Continuity | D6 결정(`output.result.*` 단일 경로) 참조가 코드 주석에만 존재 | `ai-conversation-helpers.ts` `buildConversationConfigFromOutput` JSDoc | `spec/4-nodes/3-ai/1-ai-agent.md §7.4/§7.5` Rationale 에 D6 추가 권장 (선택) |
| 5 | Cross-Spec | `spec/4-nodes/6-presentation/0-common.md` L426 구현 포인터가 orchestrator 이동을 미반영 | `spec/4-nodes/6-presentation/0-common.md L426` | 포인터를 `ExecutionEngineService.continueAiConversation → AiTurnOrchestrator.processAiResumeTurn` 으로 정정 |
| 6 | Cross-Spec / Convention Compliance | `spec/5-system/4-execution-engine.md` frontmatter `code:` 및 §7.5 구현 포인터가 orchestrator 분리 미반영 | `spec/5-system/4-execution-engine.md` frontmatter + §7.5 | frontmatter `code:` 에 `ai-turn-orchestrator.service.ts`, `ai-conversation-helpers.ts` 추가; §7.5 참조 갱신 |
| 7 | Convention Compliance | `buildConversationMetaFromResumeState` JSDoc 이 WS 이벤트 페이로드 용도임을 미명시 | `ai-conversation-helpers.ts` (buildConversationMetaFromResumeState JSDoc) | JSDoc 에 `@returns WS waiting_for_input 이벤트의 nodeOutput.meta 블록 (spec/5-system/6-websocket-protocol.md §4.4)` 추가 |
| 8 | Convention Compliance | `withInteractionMeta` 가시성 승격(non-export → export)으로 외부 import 시 순환 의존 위험 잠재 | `ai-conversation-helpers.ts:91` | 직접 import 경로 명확화; `execution-engine.service.ts` re-export 의 하위 호환 목적 주석 표시 |
| 9 | Plan Coherence | spec §Rationale enrichment 체인이 PR4 DoD 에 예고됨 — 현재 단계 누락 아님 | `plan/in-progress/c1-engine-split.md §spec 갱신` | PR4 완료 시 enrichment + /consistency-check --spec BLOCK:NO 수행 (추적 메모) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 기능 계약 모순 없음; 구현 파일 포인터 2건(classifyLlmError, interaction-type-registry) WARNING 수준 구식화 |
| Rationale Continuity | LOW | WARN #6 주석 폐기 결정 현재 시제 오기술 WARNING; 나머지 3건 INFO |
| Convention Compliance | LOW | spec 포인터 구식화 WARNING, 테스트 이름 오용 WARNING; 기능 계약 자체 위반 없음 |
| Plan Coherence | NONE | 모든 설계 결정 준수; spec enrichment 는 PR4 예정으로 현 단계 누락 아님 |
| Naming Collision | MEDIUM | RehydrationError 구조적 취약성 CRITICAL; TurnDebugEntry 이중 정의 + 테스트 블록 중복 WARNING |

## 권장 조치사항

1. **[BLOCK 해소 — 즉시]** `execution-engine.service.ts` 에서 기존 `class RehydrationError` 선언이 제거되고 `ai-conversation-helpers` import 로 완전히 대체됐는지 CI 빌드 결과로 검증. 미제거 시 해당 선언 삭제. 이후 `RehydrationError` 의 단일 import 경로(`ai-conversation-helpers.ts` 직접)를 코드 주석으로 명문화.
2. **[WARNING 해소 — 이번 PR 권장]** `execution-engine.service.spec.ts` 의 `buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`, `buildConversationConfigFromOutput` describe 블록 3건 제거 (canonical 테스트 중복 제거).
3. **[WARNING 해소 — 이번 PR 권장]** `ai-turn-orchestrator.service.spec.ts:834` 테스트 이름을 spec error-codes.md 용어에 맞게 수정.
4. **[WARNING 해소 — spec 갱신]** `spec/4-nodes/3-ai/1-ai-agent.md §10` 의 `classifyLlmError` 구현 포인터를 `AiTurnOrchestrator.extractAiTurnErrorPayload` 로 갱신.
5. **[WARNING 해소 — spec 갱신]** `spec/conventions/interaction-type-registry.md` frontmatter `code:` 에 `ai-turn-orchestrator.service.ts` 추가; §1.1 표에 소비자 비고 추가.
6. **[INFO — 선택]** `TurnDebugEntry` 중복 정의를 공유 타입으로 통합하거나 의도적 분리임을 주석 명기.
7. **[INFO — PR4 예정]** spec Rationale enrichment 체인(`spec/5-system/4-execution-engine.md` 포인터 갱신 포함) 은 `c1-engine-split.md` PR4 DoD 에 따라 일괄 처리.