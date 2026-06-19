## 발견사항

- **[INFO]** `shared/llm-tracing` 도메인 타입 spec 미반영
  - target 위치: 해당 없음 (신규 미반영 영역)
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §8`, `spec/4-nodes/3-ai/0-common.md §6`
  - 상세: PR #632 에서 `codebase/backend/src/shared/llm-tracing/` (`LlmCallRecord`, `TurnDebugEntry` canonical types) 이 신설됐으나, 관련 spec 파일(`1-ai-agent.md §8`, `0-common.md §6`)에 이 shared 타입이 SoT임이 반영되지 않았고 frontmatter `code:` 에도 `shared/llm-tracing` 경로가 미등록. `plan/in-progress/refactor/c1-engine-split.md` 에 "SPEC-DRIFT(planner)" 로 명시.
  - 제안: project-planner 가 `spec/4-nodes/3-ai/1-ai-agent.md §8`, `spec/4-nodes/3-ai/0-common.md §6` frontmatter 및 본문에 `shared/llm-tracing` 반영.

- **[INFO]** `ButtonClickPayload` / `resolveButtonInteraction` 순수함수 spec 미반영
  - target 위치: 해당 없음
  - 충돌 대상: `spec/5-system/4-execution-engine.md §1.3` (ButtonInteractionService 기술), `spec/conventions/node-output.md §4.5`
  - 상세: PR #631 에서 `ButtonClickPayload` discriminated union, `isButtonClickPayload` 타입가드, `resolveButtonInteraction` 순수함수가 `button-interaction.service.ts` 에 추출됐으나 spec 에 반영 없음. `plan/in-progress/refactor/c1-engine-split.md` 에 "후속 ⑤ 완료" 로 기록되나 spec-sync 항목 미처리.
  - 제안: project-planner 가 node-output.md §4.5 button payload 규격에 `ButtonClickPayload` discriminated union 반영.

- **[INFO]** EngineDriver ISP 분할(후속 ④) — 현행 spec 에 ISP 분할 미반영이나 deferred 이므로 충돌 아님
  - target 위치: `spec/5-system/4-execution-engine.md §Rationale "C-1 god-class strangler-fig 분할"`, EngineDriver 기술 부분
  - 충돌 대상: `plan/in-progress/refactor/c1-engine-split.md` L149
  - 상세: `c1-engine-split.md` L149 에서 EngineDriver ISP 부분인터페이스 분할이 "후속 ④(엔진 DI 재구조화)로 이연" 됨. 현행 spec 은 단일 EngineDriver 계약으로 기술 — 구현 착수 전이므로 spec 이 현행 코드 상태를 반영하는 선행 상태임. ISP 분할 구현 완료 후 spec 갱신 필요.
  - 제안: ISP 분할 구현 완료 후 `spec/5-system/4-execution-engine.md §Rationale` 및 EngineDriver 계약 기술 갱신.

**일치 확인 항목 (충돌 없음):**
- `Execution.status` enum (`pending / running / completed / failed / cancelled / waiting_for_input`): `spec/1-data-model.md` ↔ `spec/5-system/4-execution-engine.md §1.1` 일치
- `NodeExecution.status` enum (+ `skipped`): `spec/1-data-model.md` ↔ `spec/5-system/4-execution-engine.md §1.2` 일치
- `active_running_ms` 컬럼 및 `EXECUTION_TIME_LIMIT_EXCEEDED` 조건: 데이터 모델 ↔ §8 일치
- `WORKER_HEARTBEAT_TIMEOUT` 의미 ("stalled 재배달 소진 terminal failure"): `spec/1-data-model.md §2.13` ↔ §7.1 동기화됨
- BullMQ 큐 3개 (`execution-run`, `execution-continuation`, `background-execution`): `spec/0-overview.md §2.4` ↔ §9.3 일치
- `NodeBootstrapService.onModuleInit` bootstrap 주어: `spec/4-nodes/0-overview.md §1.0` ↔ §Rationale C-1 일치
- `resume_call_stack` (V087), `conversation_thread` (V084), `user_variables` (V085): 데이터 모델 ↔ §6.2/§7.5 일치
- `_resumeCheckpoint` / `_retryState` in `NodeExecution.outputData`: §7.5 rehydration 경로 ↔ §Rationale "park 즉시 해제" 일치

## 요약

`spec/5-system/4-execution-engine.md` 는 `spec/1-data-model.md`, `spec/0-overview.md`, `spec/4-nodes/0-overview.md` 와 주요 엔티티(Execution/NodeExecution 상태 머신, 에러 코드, BullMQ 큐, active_running_ms, resume_call_stack)에서 직접 모순 없이 일관된다. EngineDriver ISP 분할(후속 ④)은 이번 구현의 대상이므로 spec 미반영은 정상 선행 상태이며 충돌이 아니다. 나머지 두 INFO 항목(shared/llm-tracing, ButtonClickPayload)은 C-1 follow-up PR(#631, #632)의 spec-sync 미처리로, 구현 착수를 차단할 CRITICAL/WARNING 급 충돌은 없다. 구현 전에 project-planner 가 두 INFO 항목을 spec 에 반영하면 이상적이나, engine-di-isp 구현 자체와 직접 의존 관계는 없다.

## 위험도

LOW
