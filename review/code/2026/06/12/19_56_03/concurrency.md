# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] getActiveExecutionStatus + hasActiveExecution 사이 TOCTOU 경쟁 조건
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `handleChatChannelWebhook` 내 `activeStatus` 조회 후 `hasActiveExecution` 분기 전체
- **상세**: `getActiveExecutionStatus(state.executionId)` 로 DB 스냅샷을 읽은 시점과, 이후 `forwardToInteractionService` / `sendExecutionStillRunningNotice` 를 실제로 호출하는 시점 사이에 execution 상태가 변경될 수 있다. 예를 들어 조회 시 `running` 이었던 execution 이 분기 판단 후 `waiting_for_input` 으로 전이하면 사용자는 "처리 중" 안내를 받지만 실제로는 인터랙션 forwarding이 가능한 상태가 된다. 반대로 `waiting_for_input` 이었다가 `completed` 로 전이할 경우 `forwardToInteractionService` 가 이미 종료된 execution 에 interact 시도를 한다. 이는 Node.js 단일 스레드 내부 로직 문제가 아니라 외부 DB 상태와의 비원자적 read-then-act 패턴이다.
- **제안**: (1) 이 패턴의 위험은 사용 사례(chat webhook 의 best-effort 처리) 특성상 실용적으로 수용 가능하나, `interactionService.interact` 호출 시 이미 종료된 execution 이라면 EIA 가 적절한 오류를 던져야 하고 해당 오류는 이미 swallow 없이 전파됨 — 따라서 최악의 경우는 사용자가 "처리 중" 안내를 받는 UX 불일치이며 데이터 손상 위험은 낮음. 명시적으로 이 trade-off 를 코드 주석으로 문서화하는 것을 권장.

### [INFO] form_submission 락 보호 범위가 text_message/button_callback 경로에는 없음
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `form_submission` 블록(락 존재) vs. `text_message`/`button_callback` 분기(락 없음)
- **상세**: `form_submission` 에는 `acquireLock` / `releaseLock` 패턴이 있지만, 동일한 conversation 에서 두 개의 `text_message` 가 짧은 시간 내 도착하면 두 건 모두 `forwardToInteractionService` 를 호출한다. `interactionService.interact` 가 멱등하거나 시퀀스를 직렬화한다면 문제 없지만, 그렇지 않으면 경쟁 조건이 발생한다. 현재 코드 변경 범위 내에서는 신규 경로(CCH-CV-03 (b))가 이 경우 `sendExecutionStillRunningNotice` 로 조기 반환하므로 `waiting_for_input` 상태에서만 forwarding 이 수행된다 — 이 좁은 윈도우에서의 동시 요청 처리는 기존 아키텍처 결정이며 본 diff 가 새로 악화시키지는 않는다.
- **제안**: 기존 설계 사항으로 본 diff 범위에서는 변경 불필요. InteractionService 측에서 executionId 기준 직렬화가 보장되는지 확인 권장.

### [INFO] sendExecutionStillRunningNotice 내 await adapter.sendMessage — 이벤트 루프 블로킹 없음, 예외 swallow 적절
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `sendExecutionStillRunningNotice` 메서드 (신규 추가)
- **상세**: `try/catch` 로 감싸져 실패 시 `logger.warn` 후 정상 반환하는 구조다. 호출 측이 `await` 하므로 fire-and-forget 이 아니라 순서 보장이 된다. 단, sendMessage 가 느린 외부 provider API 를 호출하면 webhook 응답 지연이 발생할 수 있다. `handleChatChannelWebhook` 주석에 "200ms 안에 202 Accepted 응답해야 함 (WH-NF-01)" 이 있는데, 이 신규 경로도 동일 제약을 받는다.
- **제안**: 긴급하지 않으나 WH-NF-01 SLA 관점에서 `sendExecutionStillRunningNotice` 를 fire-and-forget(`.catch(warn)` 패턴)으로 변경하거나, 혹은 현재처럼 await 하되 provider timeout 을 충분히 짧게 설정하는 것을 검토.

### [INFO] getActiveExecutionStatus — private field bracket-access `executionRepository`
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `getActiveExecutionStatus` (기존 패턴 유지)
- **상세**: `this.executionsService['executionRepository']?.findOne?.(...)` 의 옵셔널 체이닝이 비동기 오류를 `.catch(() => null)` 로 감싸고 있어 DB 일시 장애 시 null 반환 → `hasActiveExecution = false` → 새 execution 시작으로 이어질 수 있다. 이는 동시성 문제가 아니라 fail-open 정책이며 기존 코드에서 이미 존재했다.
- **제안**: 기존 설계 유지. 본 diff 에서 새로 도입한 문제가 아님.

## 요약

본 변경(CCH-CV-03 (b) 경로 추가 — `getActiveExecutionStatus` 로 `isActiveExecution` 대체, `sendExecutionStillRunningNotice` 신규 추가)은 동시성 측면에서 의미 있는 신규 위험을 도입하지 않는다. 기존에 `form_submission` 에 존재하는 `acquireLock` 패턴이 신규 경로(`text_message` → 안내 + 무시)에는 적용되지 않는 비대칭이 있지만, 이는 본 diff 이전부터 존재하던 설계 결정이며 새 경로는 forwarding 을 수행하지 않으므로 위험도가 낮다. 가장 주목할 점은 `getActiveExecutionStatus` 스냅샷과 실제 분기 실행 사이의 TOCTOU 패턴이나, 이는 Node.js 기반 chat webhook 의 best-effort 특성 및 EIA 의 자체 오류 전파로 실용적으로 수용 가능하다. `sendExecutionStillRunningNotice` 의 `await` 는 WH-NF-01 (200ms 응답) 제약과 긴장 관계에 있어 검토를 권장한다.

## 위험도

LOW

---
STATUS=success ISSUES=4 PATH=/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/review/code/2026/06/12/19_56_03/concurrency.md RESET_HINT=
