# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 3건(에러 코드 passthrough, interaction-type-registry 미등재, 타입 중복 2건), Critical 없음. 행동 보존 리팩토링으로 spec 계약 전면 준수.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | `classifyLlmError` fallback 경로가 미등록 에러 코드(`LLM_API_ERROR`)를 `output.error.code` 로 그대로 emit 가능. 이를 검증하는 테스트 어서션 누락 | `ai-turn-orchestrator.service.ts` L1073–1074; `*.spec.ts` L408–421 | `spec/conventions/error-codes.md §1·§2` (의미 기반 명명·안정성) | (a) 테스트에 `expect(result.code).toBe('LLM_CALL_FAILED')` 어서션 추가, 또는 (b) "명시 code passthrough" 경로를 `error-codes.ts` 등록 코드 whitelist 로 제한 |
| W-2 | Plan Coherence | `ai-turn-orchestrator.service.ts` 가 `'ai_form_render'` / `'ai_conversation'` 리터럴을 직접 사용하는 분기를 포함하나, `interaction-type-registry.md §1.2` "Backend emit 위치" 열 갱신 및 frontmatter `code:` 등재가 현 plan DoD 에 명시되지 않음 | `ai-turn-orchestrator.service.ts` `emitAiWaitingForInput` L2012 분기 | `spec/conventions/interaction-type-registry.md §1.2` 매트릭스; `plan/in-progress/refactor/c1-engine-split.md` PR2 DoD | `c1-engine-split.md` PR2 DoD 에 "§1.2 매트릭스 emit 위치 열에 `ai-turn-orchestrator.service.ts` 추가" 항목 명기, 또는 PR4 일괄 반영 대상에 명시 기록 |
| W-3 | Naming Collision | `LlmCallRecord` / `AiTurnDebugEntry` (신규)와 기존 `LlmCallTrace` / `TurnDebugEntry` 가 동일 도메인(LLM 호출 기록·turn 디버그)을 이름 분기로 중복 정의. 동일 JSONB shape 의 타입 drift 위험 | `ai-conversation-helpers.ts` L102, L115 | `information-extractor.handler.ts` L74 (`LlmCallTrace`), L80 (`TurnDebugEntry`) | 공유 타입을 `shared/` 모듈로 승격 후 양쪽 import, 또는 이름 통일 (rename 마이그레이션 계획 수립) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/5-system/4-execution-engine.md §1.3` 영속 주체 서술이 "엔진" 단일 표현으로 남아 `AiTurnOrchestrator` 이관 사실 미반영 (기능 충돌 없음) | spec §1.3 L163–170 | spec §1.3 "엔진이…" → "실행 엔진(`AiTurnOrchestrator.emitAiWaitingForInput` / `handleAiMessageTurn`)이…" 로 갱신, 추후 spec-sync 패스 가능 |
| I-2 | Cross-Spec | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-turn-orchestrator.service.ts` 미추가 — AI 멀티턴 로직 일부가 해당 파일로 이관됐으나 포인터 미갱신 | `spec/4-nodes/3-ai/1-ai-agent.md` L7 | frontmatter 에 `ai-turn-orchestrator.service.ts` 추가, 추후 spec-sync 패스 가능 |
| I-3 | Cross-Spec | `spec/conventions/interaction-type-registry.md §1.2` "재개 turn 라우팅" 주석에서 `handleAiResumeTurn` 소속 파일 맥락이 달라졌으나 값·분기 의미는 정합 | spec/conventions/interaction-type-registry.md §1.2 L52 | 경로 묘사 시 `AiTurnOrchestrator` 서비스 이름 명시 추가, 추후 spec-sync 패스 가능 |
| I-4 | Cross-Spec | `spec/5-system/4-execution-engine.md §7.5` 및 §1.3 에서 `handleAiResumeTurn` / `processAiResumeTurn` 소속 클래스 미명시 — 오해 소지 | spec §1.3, §7.5 | 해당 메서드가 `AiTurnOrchestrator` 에 속함을 주석으로 추가, 추후 spec-sync 패스 가능 |
| I-5 | Rationale Continuity | `ENGINE_DRIVER` DI 토큰 `useExisting: ExecutionEngineService` 바인딩(in-process 전제의 핵심)이 spec Rationale 에 미명시 | `ai-turn-orchestrator.service.ts` DI 설정 | spec `§Rationale` 또는 §5 에 "EngineDriver 는 항상 useExisting — 분산 분리 아님" 을 짧게 기재 |
| I-6 | Plan Coherence | main 브랜치 `plan/in-progress/refactor/02-architecture.md` C-1 step1 체크박스가 `[ ]` stale 상태 (worktree 에서는 `[x]` + PR #622 완료) | `plan/in-progress/refactor/02-architecture.md` L21 | PR 병합 시 자동 해소, 또는 직접 `[x]` + PR #622 ref 로 갱신 |
| I-7 | Naming Collision | `RehydrationError` 정의가 `ai-conversation-helpers.ts` 에 위치하나 엔진 전반(`execution-engine.service.ts` 28회+)에서 사용 — 기존 `workflow-errors.ts` 집중 패턴과 불일치 | `ai-conversation-helpers.ts` L34 | `workflow-errors.ts` 로 이동하거나 `workflow-errors.ts` 에 re-export 추가 |
| I-8 | Naming Collision | `LlmCallRecord.startedAt/finishedAt` 필드가 `information-extractor.handler.ts:LlmCallTrace` 에는 없어 동일 JSONB 구조에 대한 타입 정의 불완전 | `ai-conversation-helpers.ts` L108–109; `information-extractor.handler.ts:LlmCallTrace` | 공통 타입 통합 시 `startedAt?/finishedAt?` 동기화, 또는 `LlmCallTrace` 에 optional 필드 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | INFO 5건 — 신규 서비스 이관에 따른 spec 주체 서술 불완전, 기능 충돌 없음 |
| Rationale Continuity | NONE | INFO 7건 전부 정합 확인 — D4/B3/보안 invariant 등 모든 핵심 결정 준수 |
| Convention Compliance | LOW | WARNING 1건 (`LLM_API_ERROR` passthrough 테스트 누락), INFO 7건 정합 |
| Plan Coherence | LOW | WARNING 1건 (§1.2 emit 위치 열 DoD 미명시), INFO 3건 |
| Naming Collision | LOW | WARNING 2건 (타입 중복: `LlmCallRecord`/`AiTurnDebugEntry`), INFO 2건 |

## 권장 조치사항

1. **(W-1 — 최우선)** `ai-turn-orchestrator.service.spec.ts` 의 `LLM_API_ERROR` 테스트 케이스에 `expect(result.code).toBe('LLM_CALL_FAILED')` 어서션 추가 — 단순 테스트 보강으로 이번 PR 안에서 처리 가능.
2. **(W-2)** `plan/in-progress/refactor/c1-engine-split.md` PR2 DoD 에 "`interaction-type-registry.md §1.2` `ai_conversation`·`ai_form_render` emit 위치 열에 `ai-turn-orchestrator.service.ts` 추가" 항목 명기 (플래너 위임 또는 PR4 일괄 반영 대상 기록).
3. **(W-3)** `LlmCallRecord` / `AiTurnDebugEntry` 를 공유 모듈로 승격하는 후속 리팩토링 계획 수립. 기존 `LlmCallTrace` / `TurnDebugEntry` 와 이름 통일 또는 `shared/` 단일 export 경로 마련. 현 PR 이후 별도 태스크 가능.
4. **(I-1~I-4)** `spec/5-system/4-execution-engine.md §1.3·§7.5`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/interaction-type-registry.md §1.2` 의 주체 서술 및 코드 포인터 갱신 — 추후 spec-sync 패스에서 일괄 처리.
5. **(I-5)** spec `§Rationale` 에 `EngineDriver` `useExisting` 바인딩(in-process 전제) 짧게 명시 — 추후 spec-sync 패스 가능.
6. **(I-6)** main 브랜치 `plan/in-progress/refactor/02-architecture.md` C-1 step1 항목 `[x]` + PR #622 갱신 — PR 병합 시 자동 해소 또는 즉시 갱신.
7. **(I-7~I-8)** `RehydrationError` 위치 정리 및 `LlmCallTrace` 필드 동기화 — W-3 공통 타입 통합 시 함께 처리.