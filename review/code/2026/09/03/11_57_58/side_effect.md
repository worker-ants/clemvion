# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `setTimeout(...).unref()` 도입 — 프로세스 이벤트 루프 keep-alive 의미 변경
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:238`(`notice.unref()`), `:239`(`cutoff.unref()`) — 메서드 `armExpiryTimers`
  - 상세: 종전에는 만료 타이머(`notice`/`cutoff`)가 ref 상태라 이 타이머가 살아있는 동안 Node 프로세스가 종료되지 않았다(최악의 경우 최대 토큰 수명, 900초). 이번 변경은 두 타이머 모두 `.unref()` 하여 "이 타이머만 남아 있어도 프로세스가 종료될 수 있다" 는 런타임 전역(이벤트 루프) 동작을 바꾼다. 코드 주석·plan(`plan/in-progress/ws-token-expired-socket-lifetime-impl.md:105-106`)에 의도가 명시돼 있고 전용 테스트(`websocket.gateway.spec.ts:832-843`, `hasRef()===false` 단언)로 뮤테이션 검증까지 됐다. 실질적으로는 셧다운 행 위험을 줄이는 **개선**이며, 저장소 내 `execution-run-dlq-monitor.service.ts`/`continuation-dlq-monitor.service.ts` 도 이미 같은 `unref` 패턴을 쓰고 있어 컨벤션과도 일치한다.
  - 제안: 별도 조치 불필요. 다만 "이 WS 타이머가 살아있는 동안 프로세스가 안 죽는다" 는 가정에 기대는 다른 코드(있다면 그레이스풀 셧다운 관련 통합/E2E)가 있는지 한 번은 확인해 둘 것 — grep 결과로는 그런 의존처가 보이지 않는다.

- **[INFO]** `armExpiryTimers` 진입부에 선제 `clearExpiryTimers(client.id)` 추가 — 동일 키 재무장 시 제어 흐름 변경
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:215`
  - 상세: 같은 `client.id` 로 두 번째로 `handleConnection`(→`armExpiryTimers`)이 호출되면, 이제는 옛 타이머 쌍을 먼저 지우고 새로 무장한다. 현재 프로덕션 경로에서는 Socket.IO 가 연결마다 새 `id` 를 발급하므로 도달 불가라고 주석·plan 에 명시돼 있으나(`:212-214`), `connectionStateRecovery` 옵션이 켜지는 순간 이 분기가 실제로 발동하는 **load-bearing** 코드가 된다. 새 단언(`websocket.gateway.spec.ts:809-830`, 재무장 시 emit·disconnect 합계 1회)으로 뮤테이션 RED 확인까지 됐다는 근거가 plan 에 남아 있다. 의도된 변경이고 부작용이라기보다 방어적 하드닝이지만, `expiryTimers` 라는 공유 Map 을 건드리는 지점이 하나 더 늘었다는 점은 side-effect 표면으로 기록해 둔다.
  - 제안: 조치 불필요. `expiryTimers` 를 건드리는 지점이 `armExpiryTimers`(무장+선제 해제)·`handleDisconnect`(해제) 두 곳으로 유지되고 둘 다 `clearExpiryTimers` 단일 경로를 쓰므로 drift 위험은 낮다.

- **[INFO]** 새 공개 상수 `MSG_AUTH_TOKEN_EXPIRING` export — 인터페이스 변경이지만 순수 additive
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:309-310`
  - 상세: 모듈에 새 `export const` 가 추가됐다. `websocket.service.ts` 가 이 모듈의 일부 심볼을 curated 하게 re-export 하는 구조(`export { ExecutionEventType, NodeEventType, BackgroundRunEventType, InAppNotificationEventType };`, `websocket.service.ts:38-43`)인데, `MSG_AUTH_TOKEN_EXPIRING` 은 그 목록에 없다. 실제 소비처(`websocket.gateway.ts`, `websocket.gateway.spec.ts`)는 `./websocket-events.types` 를 직접 import 하므로 문제없이 동작한다 — 기존 import 경로·기존 소비자 모두 영향 없음(순수 추가).
  - 제안: 없음. 향후 이 상수를 `websocket.service.ts` 경유로도 쓰고 싶어지면 그 curated export 목록에 추가해야 한다는 점만 인지해 둘 것.

- **[INFO]** `expiryTimers` Map 값 타입을 optional → non-optional 로 변경 — private 필드라 외부 영향 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:157-160`
  - 상세: `{ notice?: NodeJS.Timeout; cutoff?: NodeJS.Timeout }` → `{ notice: NodeJS.Timeout; cutoff: NodeJS.Timeout }`. `private readonly` 필드이고 grep 결과 이 파일 밖에서 참조하는 코드가 없어(호출자 영향 없음), "시그니처 변경의 호출자 영향" 관점에서 안전하다. `handleDisconnect` 의 옛 `if (timers.notice) / if (timers.cutoff)` 방어 분기가 `clearExpiryTimers` 단일 헬퍼로 대체되며 죽은 코드가 제거됐다.
  - 제안: 없음.

- **[INFO]** JSDoc 블록이 `MSG_AUTH_TOKEN_EXPIRING` 삽입 위치 때문에 원래 대상에서 분리됨 — 런타임 영향 없음, 문서 도구 부작용만
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-312`
  - 상세: `AuthTokenExpiredPayload` 를 설명하던 기존 JSDoc(`:287-301`, "Wire payload for {@link AuthEventType.AUTH_TOKEN_EXPIRED} …")과 `export interface AuthTokenExpiredPayload`(`:312`) 사이에 새 `MSG_AUTH_TOKEN_EXPIRING` 상수 + 그 전용 JSDoc(`:302-308`)이 끼어들었다. TS 언어 서버/hover 는 선언 바로 위 JSDoc 블록만 그 선언에 연결하므로, 이제 `AuthTokenExpiredPayload` 인터페이스 바로 위엔 주석이 없고(바로 위는 `export const MSG_AUTH_TOKEN_EXPIRING = '...';` 코드 줄), 원래 그 인터페이스를 설명하던 JSDoc은 사실상 고아가 됐다(hover 시 노출되지 않을 가능성). 저장소에 compodoc/typedoc 등 정적 문서 생성 도구는 없어(package.json 확인) 빌드 산출물에는 영향 없다 — IDE 개발 경험에만 영향.
  - 제안: `MSG_AUTH_TOKEN_EXPIRING` + 그 JSDoc 을 `AuthTokenExpiredPayload` 인터페이스 **뒤**로 옮기거나, 기존 `AuthTokenExpiredPayload` JSDoc 을 인터페이스 바로 위로 재배치해 두 선언이 각자의 주석과 인접하도록 정리하면 좋다(선택적, 런타임 비영향이라 차단 사유는 아님).

- **[INFO]** 신규 테스트의 `jest.spyOn(global, 'setTimeout')` 이 `try/finally` 없이 `mockRestore()` 에 의존
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:833-843` (`'만료 타이머는 unref 된다 — 셧다운을 붙잡지 않는다'`)
  - 상세: `spy.mockRestore()` 가 `it` 블록 마지막 줄에만 있어, 중간의 `expect(created.length).toBeGreaterThanOrEqual(2)` 나 `expect(t.hasRef()).toBe(false)` 단언이 실패하면 그 지점에서 throw 되어 `mockRestore()` 가 실행되지 않는다. jest 설정(`jest.config.ts`)에 `restoreMocks`/`resetMocks` 옵션이 없어 자동 복구도 없다. 다만 이 테스트는 같은 `describe` 블록의 `afterEach(() => jest.useRealTimers())` 안에 있어, 그 호출이 `global.setTimeout` 참조 자체를 실타이머 구현으로 재대입하므로 스파이가 사실상 대체되며 다음 테스트로 새는 영향은 실질적으로 낮다.
  - 제안: 방어적으로 `try { ... } finally { spy.mockRestore(); }` 로 감싸면 확실해진다(현재도 낮은 위험이라 필수는 아님).

## 요약

핵심 변경(`websocket.gateway.ts`)은 §1.2 소켓-수명-토큰-종속 기능의 이월 INFO 5건을 정리한 순수 하드닝·리팩터다. 모두 `private` 필드·헬퍼(`clearExpiryTimers`, `expiryTimers` 타입 강화)에 갇혀 있어 외부 호출자·공개 시그니처에 영향이 없고, 새 export(`MSG_AUTH_TOKEN_EXPIRING`)는 순수 additive 라 기존 소비자를 깨지 않는다. 가장 눈에 띄는 실제 "부작용"은 `.unref()` 도입으로 인한 이벤트 루프 keep-alive 의미 변경인데, 이는 의도적으로 문서화·테스트됐고 오히려 잠재적 셧다운 행(hang) 위험을 줄이는 방향이다. `armExpiryTimers` 진입부의 선제 `clearExpiryTimers` 호출도 현재는 도달 불가하지만 향후 `connectionStateRecovery` 활성화 시 load-bearing 해지는 방어적 변경으로, 의도된 상태 변경이다. 그 외에는 JSDoc 배치로 인한 문서 도구상의 경미한 부작용과 테스트의 spy 정리 방식(낮은 위험) 정도만 관측됐다 — 차단할 만한 CRITICAL/WARNING 급 부작용은 없다.

## 위험도

LOW
