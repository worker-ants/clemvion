# 성능(Performance) 리뷰 결과

## 발견사항

### [WARNING] `getActiveExecutionStatus` — 매 인바운드 메시지마다 추가 DB 쿼리 발생
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 746-754, 1647-1662 (`getActiveExecutionStatus`)
- 상세: 기존 `isActiveExecution` 이 boolean 을 반환했던 것과 달리, 신규 `getActiveExecutionStatus` 는 동일하게 DB를 1회 hit 한다. 그러나 이 변경의 맥락에서 주목해야 할 점은 `state?.executionId` 가 non-null 일 때마다 해당 쿼리가 항상 실행된다는 것이다. 즉, 활성 대화가 있는 모든 인바운드 webhook 요청은 다음 두 개의 직렬 비동기 I/O 를 수행하게 된다:
  1. `channelConversationService.lookup(...)` — 대화 상태 조회
  2. `getActiveExecutionStatus(state.executionId)` — execution 상태 추가 조회

  이 두 I/O 가 sequential 하게 실행되어 latency 가 누적된다. spec 의 200ms 응답 요구(WH-NF-01)를 고려하면 이 직렬 의존 구조는 주의가 필요하다. 또한 짧은 시간 내에 동일 사용자가 연속 메시지를 보낼 경우 매 메시지마다 동일한 execution row 를 반복 조회한다.
- 제안: `channelConversationService.lookup` 응답에 execution status 를 함께 포함시키거나(캐시 레이어 확장), `state` 에 `executionStatus` 필드를 두어 마지막으로 알려진 상태를 저장하고 status DB 조회를 short-circuit 하는 방안을 검토한다. 또는 두 I/O 를 병렬화할 수 없는지 검토한다(현재는 `lookup` 결과의 `executionId` 가 있어야 두 번째 쿼리를 할 수 있으므로 구조적으로 순차 의존). 최소한 `select: ['id', 'status']` 는 이미 적용되어 있어 row 전체 fetch 는 피하고 있음.

### [INFO] `getActiveExecutionStatus` 내 `executionsService['executionRepository']` private 필드 접근 — 브래킷 접근 패턴의 런타임 비용
- 위치: `hooks.service.ts` 라인 1650-1655
- 상세: `this.executionsService['executionRepository']?.findOne?.(...)` 형태는 private 저장소에 bracket notation 으로 접근한다. 이 패턴 자체의 런타임 비용은 무시할 수 있으나, optional chaining `?.findOne?.()` 이 중첩되어 repository 가 없을 경우 silent undefined 반환 후 `null` 로 처리된다. 이로 인해 repository 가 DI로 주입되지 않은 상황에서 쿼리 실패 없이 `null` 을 반환하여 `hasActiveExecution = false` 로 평가되는 성능/정확성 혼재 문제가 있다. 성능 관점에서는 오류 경로 무음 처리가 모니터링을 어렵게 만들어 성능 이슈 진단을 지연시킬 수 있다.
- 제안: `ExecutionsService` 에 `getExecutionStatus(id: string): Promise<ExecutionStatus | null>` 과 같은 public 메서드를 추가하여 내부 repository 접근을 캡슐화하고, `.catch(() => null)` 에러 swallow 는 `logger.warn` 과 함께 사용하도록 개선.

### [INFO] `sendExecutionStillRunningNotice` — 인바운드 핸들링 critical path 내 네트워크 I/O 블로킹
- 위치: `hooks.service.ts` 라인 766-769, 1670-1691 (`sendExecutionStillRunningNotice`)
- 상세: `sendExecutionStillRunningNotice` 는 `await` 로 호출되어 adapter 의 `sendMessage` (외부 API 호출 — Telegram/Slack/Discord) 가 완료될 때까지 webhook 응답이 차단된다. 에러는 내부에서 catch 하여 `logger.warn` 으로 처리하지만, sendMessage 완료(또는 timeout) 까지 응답이 지연된다. WH-NF-01 의 200ms 요구사항 관점에서 외부 API 응답 시간이 가변적이어서 이 경로의 latency 가 불안정해질 수 있다. 기존 `maybeNotifyIgnored` 도 동일한 패턴임을 감안하면 기존 아키텍처 결정과 일관성은 있다.
- 제안: 이미 에러를 swallow 하고 있으므로, fire-and-forget 전환(`void adapter.sendMessage(...)`)을 고려할 수 있다. 단, 이는 기존 `maybeNotifyIgnored` 와의 일관성 변경이 되므로 전체 정책 레벨에서 판단할 사항. 우선순위는 낮음.

### [INFO] `triggers.service.ts` `rotateBotToken` 반환 타입 확장 — 성능 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/triggers/triggers.service.ts` (diff 라인 858-880)
- 상세: 반환 객체에 `triggerId`, `chatChannelHealth`, `botIdentity` 3개 필드를 추가한 변경이다. 기존 로직 흐름에서 이미 계산된 값들(`trigger.id`, `'healthy'` 리터럴, `mergedChannel.botIdentity`)을 반환 객체에 포함시키는 것이므로 추가 I/O 나 계산 없이 O(1) 상수 비용이다. 성능 영향 없음.

### [INFO] `chat-channel.controller.ts` 반환 타입 `Awaited<ReturnType<...>>` — 타입 수준 변경, 런타임 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-gaps-e5e3e8/codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` (diff 라인 169)
- 상세: 컴파일 타임 타입 추론 변경이며 런타임 성능 영향 없음. TypeScript 는 `Awaited<ReturnType<...>>` 를 컴파일 시에만 평가.

## 요약

이번 변경의 성능 핵심 포인트는 `isActiveExecution` (boolean) → `getActiveExecutionStatus` (ExecutionStatus | null) 리팩토링이다. DB 쿼리 횟수는 동일하게 유지되나, 활성 대화가 있는 모든 webhook 요청에서 conversation lookup 이후 직렬로 execution status DB 쿼리가 추가 실행되는 구조가 된다. 이는 WH-NF-01 의 200ms 응답 요구 하에서 latency tail 을 늘릴 수 있는 WARNING 수준의 위험이다. `sendExecutionStillRunningNotice` 의 외부 API 호출이 critical path 에 동기로 포함된 점도 주의할 부분이나, 기존 `maybeNotifyIgnored` 와 동일한 패턴이어서 아키텍처 일관성은 있다. 나머지 변경(`rotateBotToken` 반환 타입 확장, controller 타입 동기화, 테스트 추가)은 성능에 영향이 없다. 전체적으로 새로운 심각한 성능 회귀는 없으나, 고트래픽 채널에서 직렬 DB 쿼리 누적 latency 를 모니터링할 것을 권고한다.

## 위험도

LOW
