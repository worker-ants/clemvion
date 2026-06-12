# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] CCH-CV-03 status 확인 → 분기 처리 사이의 TOCTOU 경쟁 조건
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` — `handleChatChannelWebhook` 메서드, 라인 828-1051 구간
- **상세**: `getActiveExecutionStatus(state.executionId)` 로 DB 에서 execution 상태를 읽은 뒤, 그 값을 기반으로 `sendExecutionStillRunningNotice` 발송 또는 `interactionService.interact` 호출을 결정하는 분기가 존재한다. 두 작업 사이에 execution 상태가 변경될 수 있다(예: `running` → `waiting_for_input` 전이, 또는 `waiting_for_input` → `completed` 전이). 이는 TOCTOU(Time-Of-Check-Time-Of-Use) 패턴이다. 구체적인 시나리오:
  - 상태를 `running`으로 읽음 → `sendExecutionStillRunningNotice` 발송 결정 → 실제 interact 호출 전에 execution이 `waiting_for_input`으로 전이 → 사용자 입력이 전달되지 않아 대화 흐름 단절.
  - 반대로 `waiting_for_input`으로 읽음 → `forwardToInteractionService` 호출 결정 → 실제 호출 시점에 execution이 이미 `completed` → EIA가 에러 반환.
- **제안**: 이 경쟁 조건은 Node.js 단일 이벤트 루프 특성 및 분산 시스템 한계상 완전 제거가 어렵다. 현재 `interactionService.interact` 가 에러를 throw 하면 상위에서 로그 후 무시하는 구조이므로 실제 장애 파급은 제한적이다. 추가적인 방어를 원한다면 `forwardToInteractionService` 내부에서 interact 실패 시 `executionStillRunning` 안내를 fallback으로 발송하는 로직을 추가하거나, execution 상태 변경 이벤트를 pub/sub으로 처리하는 방향을 검토할 수 있다. 현재 설계(R9 결정)의 의도적 trade-off 범위 내이므로 즉각적인 코드 수정 강제는 낮지만, 해당 race window를 spec/주석에 명시하는 것을 권장한다.

### [INFO] `form_submission` 의 분산 락 — `acquireLock` 실패(Redis 미가용) 시 fail-open 정책
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` — 라인 924-935 (`form_submission` 락 획득 블록)
- **상세**: 주석에 `fail-open when redis unavailable (acquireLock returns true)` 라고 명시되어 있다. Redis 미가용 시 락 없이 진행하는 정책은 중복 form_submission 요청이 동시에 처리될 수 있는 경쟁 조건을 허용한다. 단, 이는 의도적 설계 결정이며 EIA의 서버측 멱등성 보장이 두 번째 방어선 역할을 하는 것으로 보인다.
- **제안**: fail-open 정책의 리스크(중복 submit_form 발생 가능성)를 spec 또는 주석에 명확히 문서화하고, EIA `submit_form` 의 멱등성 보장 여부를 확인하여 실제 중복 제출 시 UX 영향을 평가할 것을 권장한다.

### [INFO] `getActiveExecutionStatus` — private 필드 브래킷 접근(`executionsService['executionRepository']`)의 동시성 위험 아님, 설계 우려
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` — 라인 1340-1345
- **상세**: `this.executionsService['executionRepository']` 로 private 레포지터리에 직접 접근하는 패턴은 동시성 문제는 아니나, TypeORM Repository 자체가 thread-safe(커넥션 풀 기반)하므로 동시성 관점에서 별도 위험은 없다. 다만 `?.findOne?.` 옵셔널 체이닝을 두 단계로 쓰는 것은 executionRepository 가 undefined 일 때 null을 조용히 반환하여 `getActiveExecutionStatus` 가 null을 반환하고, 상위에서 비활성으로 처리하여 새 execution이 시작되는 경로로 이어진다. 이 동작은 의도적이며(`catch(() => null)` 패턴) 동시성 관점 위험은 없다.
- **제안**: 해당 없음 (동시성 관점).

### [INFO] `sendExecutionStillRunningNotice` — try/catch로 에러 swallow, 이벤트 루프 영향 없음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` — 라인 1360-1381
- **상세**: `await adapter.sendMessage(...)` 를 try/catch로 감싸 실패 시 warn 로그만 남기고 계속 진행한다. 이는 async/await 사용이 올바르며, 이벤트 루프 블로킹도 없다. 발신 실패가 전체 흐름을 방해하지 않는 올바른 best-effort 패턴이다.
- **제안**: 적절한 구현. 별도 조치 불필요.

## 요약

변경된 코드의 핵심 동시성 관련 사항은 두 가지다. 첫째, `getActiveExecutionStatus` 호출 이후 분기 처리까지의 TOCTOU 경쟁 조건이 존재하나, Node.js 단일 스레드 이벤트 루프 및 EIA 에러 처리 구조 덕분에 실제 장애 파급 범위는 제한적이며, R9 설계 결정에서 의도적으로 수용된 trade-off로 판단된다. 둘째, `form_submission` 중복 방지를 위한 분산 락의 fail-open 정책은 Redis 미가용 시 중복 제출 가능성을 허용하나, 이 또한 코드 주석에 명시된 의도적 결정이다. async/await 누락이나 Promise 미처리, 이벤트 루프 블로킹 등의 문제는 발견되지 않았으며, `sendExecutionStillRunningNotice` 의 에러 swallow 패턴도 best-effort 발송에 적합하게 구현되어 있다.

## 위험도

LOW
