# 성능(Performance) 리뷰

## 발견사항

### [WARNING] getActiveExecutionStatus — 모든 webhook 요청에 추가 DB 쿼리 발생
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `handleChatChannelWebhook` 내 `activeStatus` 계산 블록 (라인 825~832)
- **상세**: 기존 `isActiveExecution`(boolean 반환)은 `state?.executionId` 가 있을 때만 DB를 조회했다. 변경 후 `getActiveExecutionStatus`도 동일한 조건(`state?.executionId`)으로 보호되어 있지만, 이제 반환값이 `ExecutionStatus | null`로 확장되어 downstream 분기(`activeStatus !== ExecutionStatus.WAITING_FOR_INPUT`)에서 status 비교가 추가된다. 문제는 `select: ['id', 'status']`만 필요함에도 Repository의 `findOne`이 엔티티의 전체 컬럼 메타데이터를 불러올 가능성이 있고, 내부 private 필드 접근(`this.executionsService['executionRepository']`)을 통해 호출되기 때문에 TypeORM의 lazy loading이나 subscriber hook이 의도치 않게 추가 쿼리를 발생시킬 수 있다. 실제 select 범위(`['id', 'status']`)는 올바르지만, 우회 접근 패턴이 최적화 계층을 무효화할 위험이 있다.
- **제안**: `ExecutionsService`에 `getExecutionStatus(id: string): Promise<ExecutionStatus | null>` 공개 메서드를 추가해 private 필드 우회를 제거하고, TypeORM의 `select` + `loadEagerRelations: false` 옵션을 명시적으로 지정해 쿼리 범위를 확정한다.

### [INFO] sendExecutionStillRunningNotice — 동기적 외부 API 호출이 200ms 응답 SLA에 영향
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `sendExecutionStillRunningNotice` 메서드 (라인 1357~1378) 및 호출 지점 (라인 1046)
- **상세**: `handleChatChannelWebhook` 코멘트에 "200ms 안에 202 Accepted 응답해야 함 (WH-NF-01)"이 명시되어 있다. 그러나 `sendExecutionStillRunningNotice`는 `await`로 대기하므로, Telegram/Slack API 왕복 시간(일반적으로 100~500ms)이 그대로 응답 지연으로 이어진다. running/pending 케이스에서 메시지를 발송하는 것은 R9 정책에 의해 맞지만, 이 발송이 webhook 응답 경로를 블로킹한다.
- **제안**: `maybeNotifyIgnored`와 마찬가지로 `sendExecutionStillRunningNotice`를 fire-and-forget 패턴(`void adapter.sendMessage(...).catch(...)`)으로 처리하거나, 응답 먼저 반환 후 후속 알림을 발송하는 구조로 분리한다. 현재 `catch`가 내부에 있어 에러는 안전하게 처리되므로 비동기 분리가 용이하다.

### [INFO] 테스트 코드 — execRepo 타입 캐스팅 반복 4회 (DRY 위반 + 무의미한 객체 생성)
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts` — CCH-CV-03 관련 4개 테스트케이스 (라인 277~394 근방)
- **상세**: 4개의 테스트 각각에서 동일한 `moduleRef.get(ExecutionsService)` 타입 캐스팅 + `execRepo` 추출 패턴이 중복된다. 테스트 코드이므로 런타임 성능 영향은 없지만, 각 테스트 실행 시 불필요한 타입 캐스팅 객체가 매번 생성되며, `beforeEach`에서 공유 변수로 선언하면 반복 오버헤드를 없앨 수 있다.
- **제안**: 공통 `execRepo` 추출을 `beforeEach` 또는 describe 블록 상단의 `let execRepo`로 한 번만 수행한다. 단, 테스트 격리가 필요한 경우 `beforeEach`에서 초기화.

### [INFO] getActiveExecutionStatus — private 필드 체이닝의 null safety 비용
- **위치**: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `getActiveExecutionStatus` (라인 1334~1349)
- **상세**: `this.executionsService['executionRepository']?.findOne?.({...})` 패턴은 optional chaining을 두 단계 적용한다. `executionRepository`가 undefined인 경우 전체 표현식이 `undefined`를 반환하고 `.catch(() => null)` 체인이 연결되지 않아 `undefined`가 그대로 `execution` 변수에 할당된다. 이는 `if (!execution) return null` 분기로 안전하게 처리되지만, `undefined as ... | null | undefined` 타입 캐스팅이 런타임에서 불필요한 분기를 만들고 정적 분석을 복잡하게 한다. 성능 영향은 미미하지만 매 webhook 요청마다 이 메서드가 호출될 때 optional chaining 평가 비용이 누적된다.
- **제안**: `executionRepository`를 DI로 직접 주입받거나, 최소한 서비스 초기화 시 null 체크를 수행해 hot path에서의 optional chaining 제거.

### [INFO] rotateBotToken 반환 타입 — Awaited<ReturnType<...>> 타입 추론이 컴파일 시간에만 영향
- **위치**: `/codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` — 라인 169 (`Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>`)
- **상세**: `Awaited<ReturnType<...>>`는 TypeScript 컴파일 시 타입 추론 비용을 증가시키지만 런타임에는 영향 없다. 대규모 프로젝트에서 이런 재귀적 타입 추론이 누적되면 `tsc --watch` 응답성이 저하될 수 있다. 현재 변경 단일 건으로는 무시 가능한 수준이다.
- **제안**: 컴파일 성능이 이슈가 될 경우 반환 타입을 명시적 인터페이스로 분리 (`RotateBotTokenResponseDto`)하는 방안을 고려할 수 있다. 현재는 INFO 수준.

---

## 요약

이번 변경의 핵심 성능 관심사는 `handleChatChannelWebhook`의 hot path에 추가된 DB 쿼리(`getActiveExecutionStatus`)와 외부 API 동기 호출(`sendExecutionStillRunningNotice`)이다. DB 쿼리는 `select: ['id', 'status']`로 범위를 제한하고 있어 데이터 적재 자체는 최소화되었으나, private 필드 우회 접근 패턴이 TypeORM 최적화 계층을 무효화할 위험이 있어 공개 서비스 메서드로 추출하는 것이 권장된다. 더 시급한 문제는 `sendExecutionStillRunningNotice`가 `await`로 대기하여 WH-NF-01의 200ms SLA를 위협한다는 점으로, fire-and-forget 패턴으로 전환이 필요하다. `rotateBotToken` 응답 확장(`triggerId`/`chatChannelHealth`/`botIdentity` 추가)은 단순 값 추가로 성능 부담이 없다. 전반적으로 기능 정확성은 높고 성능 위험은 WARNING 1건·INFO 4건으로 중간 이하 수준이다.

---

## 위험도

LOW
