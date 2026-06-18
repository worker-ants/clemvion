## 발견사항

### [WARNING] `applyRetryLastTurn` 이중 귀속 — RetryTurnService 이전 + 엔진 잔류 delegator 동시 표기
- target 신규 식별자: `applyRetryLastTurn` (메서드명)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/5-system/4-execution-engine.md` L1463 (`RetryTurnService` 소속 열거) 및 L1464 (`엔진 잔류: …외부 진입점 retryLastTurn·applyRetryLastTurn thin delegator`)
- 상세: target 의 §1.3/§7.5 메서드 포인터 갱신 항목은 `applyRetryLastTurn` 을 `RetryTurnService` 로 이전하되 "엔진 thin delegator 잔류" 예외를 괄호 안에 명시한다. 현재 spec(이미 synced) 도 동일하게 두 군데 — L1463 의 `RetryTurnService` 열거와 L1464 의 `엔진 잔류` 절 — 에 `applyRetryLastTurn` 이 등장한다. 이는 충돌이 아니라 의도된 이중 역할(실체는 `RetryTurnService` 이동 + thin delegator 엔진 잔류)을 설명하는 것이나, 하나의 메서드 이름이 두 귀속 위치로 표기되어 독자 혼란 가능성이 있다.
- 제안: 이미 spec 에 반영된 현행 표기는 정확하다(실체와 일치). 다만 L1463 의 `RetryTurnService` 열거에서 `applyRetryLastTurn` 을 괄호 부연으로 "실제 구현 진입점은 RetryTurnService, 엔진 forwarding delegator 잔류" 구분을 명시하면 독자 혼동을 줄일 수 있다. target 이 계획한 갱신 후에도 spec L1463·L1464 의 이중 표기는 그대로 유지되므로, 갱신 시 한 줄 주석으로 "엔진 delegator = thin wrapper, 실체 = RetryTurnService" 를 인라인 분리하는 것을 권장한다.

---

### [INFO] 이미 synced 된 식별자들 — target 이 "신규 도입"으로 기술하나 spec 에 선반영된 항목
- target 신규 식별자: `NodeBootstrapService`, `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`, `EngineDriver`, `ENGINE_DRIVER`, `WORKFLOW_EXECUTOR`
- 기존 사용처: 모두 `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/5-system/4-execution-engine.md` L193·L1460–L1467, `spec/4-nodes/3-ai/1-ai-agent.md` L1099, `spec/conventions/interaction-type-registry.md` frontmatter·L45–L47, `spec/conventions/node-output.md` L194·L259, `spec/4-nodes/6-presentation/0-common.md` L426, `spec/data-flow/3-execution.md` L172, `spec/data-flow/15-external-interaction.md` L112 에 이미 기록됨
- 상세: target 이 "신규 반영할 내용"으로 열거한 항목 전체가 현재 spec 에 이미 존재한다. 이는 의미 충돌이 아니라 plan 이 spec 보다 늦게 작성된 결과로, 실질 충돌은 없다. 단 target 의 `§4-nodes/3-ai/1-ai-agent.md frontmatter code: 에 ai-turn-orchestrator.service.ts 추가` 항목은 이미 `1-ai-agent.md` L12 에 등록되어 있어 중복 추가 시 lint 걸릴 수 있음.
- 제안: target 반영 실행 전에 각 파일의 현재 상태를 확인하고 이미 존재하는 항목은 건너뛴다. `1-ai-agent.md` frontmatter `code:` 는 `ai-turn-orchestrator.service.ts` 가 이미 있으므로 이중 추가하지 않는다.

---

### [INFO] `classifyLlmError` vs `extractAiTurnErrorPayload` — 공개/비공개 메서드 표기 일관성
- target 신규 식별자: `AiTurnOrchestrator.extractAiTurnErrorPayload` (공개 진입점), `classifyLlmError` (내부 구현)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/3-ai/1-ai-agent.md` L1099 — 이미 `AiTurnOrchestrator.classifyLlmError(공개 진입점 extractAiTurnErrorPayload, ai-turn-orchestrator.service.ts — C-1 분할로 엔진에서 이동)` 로 정확히 기재됨
- 상세: target 이 계획한 §10 포인터 갱신과 spec 현행 표기가 동일하다. 충돌 없음.
- 제안: 반영 불요 (이미 완료).

---

## 요약

target(`plan/in-progress/spec-update-engine-split.md`)이 도입하는 신규 식별자(`NodeBootstrapService`, `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`, `EngineDriver`/`ENGINE_DRIVER`, `WORKFLOW_EXECUTOR`) 전체가 이미 해당 spec 파일에 선반영된 상태다. 다른 의미로 사용 중인 기존 식별자와의 충돌은 없다. 유일한 주의 사항은 `applyRetryLastTurn` 이 `RetryTurnService` 이전 목록과 엔진 잔류 delegator 목록 두 곳에 동시 등장하는 의도적 이중 표기로, 충돌이 아니라 역할 분리 설명이나 독자 혼동 가능성이 있다는 점이다. `1-ai-agent.md` frontmatter `code:` 에 `ai-turn-orchestrator.service.ts` 를 중복 추가하는 것만 실행 시 주의가 필요하다.

## 위험도

LOW
