# 부작용(Side Effect) 리뷰 — M-7 채널 authorizer 도메인 역전

## 발견사항

### 1. [INFO] `subscriptions` Map — 인스턴스 상태, 의도된 공유 상태
- 위치: `/codebase/backend/src/modules/websocket/websocket.gateway.ts` L62 (`private subscriptions = new Map<string, Set<string>>()`)
- 상세: `WebsocketGateway` 가 싱글톤으로 생성되므로 `subscriptions` Map 은 모든 클라이언트 연결에서 공유된다. M-7 변경 전후로 이 필드는 변경되지 않았으며, `handleConnection`/`handleDisconnect`/`handleSubscribe` 가 의도적으로 이 상태를 읽고 쓴다. 변경에 의해 새로 도입된 상태 변경은 없다.
- 제안: 해당 없음.

### 2. [INFO] `UUID_PATTERN` — 모듈 수준 상수, 부작용 없음
- 위치: `/codebase/backend/src/common/utils/uuid.ts` L3
- 상세: `UUID_PATTERN` 은 모듈 스코프 `const` 로 선언된 RegExp 리터럴이다. `RegExp` 객체 자체는 `lastIndex` 를 가질 수 있지만, `test()` 호출 시 `lastIndex` 를 변경하는 것은 `g`(global) 또는 `y`(sticky) 플래그를 가진 경우에 한한다. 이 패턴에는 두 플래그가 없어 `test()` 가 `lastIndex` 를 변경하지 않는다. 모듈 수준 단일 RegExp 객체를 여러 authorizer 가 공유해도 thread-safe 하다(Node.js 단일 스레드 + 플래그 없음).
- 제안: 해당 없음.

### 3. [INFO] DI 토큰 `CHANNEL_AUTHORIZER` — Symbol, 전역 레지스트리 외부 누출 없음
- 위치: `/codebase/backend/src/modules/websocket/channel-authorizer.ts` L28 (`export const CHANNEL_AUTHORIZER = Symbol('CHANNEL_AUTHORIZER')`)
- 상세: ES `Symbol` 은 전역 심볼 레지스트리(`Symbol.for`)를 사용하지 않으므로 다른 모듈에서 동일 심볼을 생성해도 충돌하지 않는다. 모듈 import 로만 참조 가능하다. 전역 상태 오염 없음.
- 제안: 해당 없음.

### 4. [WARNING] `BackgroundRunsService` export 유지 — 불필요 노출 지속
- 위치: `/codebase/backend/src/modules/executions/executions.module.ts` L44 (`exports: [ExecutionsService, BackgroundRunsService, ExecutionChannelAuthorizer, BackgroundRunChannelAuthorizer]`)
- 상세: M-7 이전 코드 주석은 "WebsocketGateway 가 채널 subscribe 가드(`verifyBackgroundRunOwnership`) 호출 때문에 export 한다"고 명시했다. M-7 이후 gateway 의 직접 의존이 제거됐음에도 `BackgroundRunsService` 가 계속 export 된다. 현재 다른 모듈이 `BackgroundRunsService` 를 소비하는지 미확인 상태에서 광범위하게 노출된다. 의도하지 않은 미래 소비자가 해당 서비스를 직접 주입받는 부작용이 생길 수 있는 구조다. 이는 M-7 이전부터 존재하던 이슈이나, M-7 이 해소 기회였음에도 유지됐다. RESOLUTION.md "BackgroundRunsService export — NOTED" 로 기록됨.
- 제안: `BackgroundRunsService` 를 외부에서 소비하는 다른 모듈이 없다면 follow-up PR 에서 exports 에서 제거해 불필요한 API 노출을 줄인다.

### 5. [INFO] `useFactory` — 새 공유 배열 객체 생성, 부작용 없음
- 위치: `/codebase/backend/src/modules/websocket/websocket.module.ts` L52 (`useFactory: (...authorizers: ChannelAuthorizer[]): ChannelAuthorizer[] => authorizers`)
- 상세: `useFactory` 는 DI 컨테이너가 처음 토큰을 resolve 할 때 한 번 호출되어 authorizer 배열을 생성한다. 이후 동일 배열 참조가 `WebsocketGateway` 에 주입된다. factory 가 외부 상태를 변경하거나 side effect 를 일으키지 않는다. `authorizers` 는 스프레드 없이 rest parameter 로 받은 배열 자체를 반환한다 — 새 배열 생성 여부는 JavaScript 엔진에 따라 다를 수 있으나 어느 쪽이든 부작용 없다.
- 제안: 해당 없음.

### 6. [INFO] `authorize()` 내 `.catch(() => false)` — 예외 억압, 의도된 동작
- 위치: `/codebase/backend/src/modules/executions/background-runs/background-run-channel-authorizer.ts` L30, `/codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` L32
- 상세: DB 조회 중 발생한 오류를 `false` 로 평탄화해 인가 거부로 처리한다. 오류 로깅이 없어 DB 오류가 조용히 무시된다. 보안 관점에서 fail-closed 는 올바른 동작이나, 운영 관점에서 DB 오류를 `authorization denied` 로 위장해 디버깅을 어렵게 만든다. 이는 M-7 이전 인라인 authorizer 에도 동일하게 존재하던 패턴이며 이번 변경에서 새로 도입된 것이 아니다.
- 제안: 필요하다면 catch 블록에 `this.logger.warn(...)` 을 추가해 DB 오류와 인가 거부를 구분 가능하게 할 수 있으나, M-7 범위 외 개선이다.

### 7. [INFO] `KbChannelAuthorizer` 의 `isValidUuid` 추가 — 기존 동작 보존 확인
- 위치: `/codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` L15-L17
- 상세: 이전에는 비-UUID documentId 가 `verifyDocumentOwnership` → Postgres uuid 캐스팅 오류 → `.catch(() => false)` 경로로 거부됐다. 이제 `isValidUuid` 선차단으로 동일 거부가 DB 조회 전에 발생한다. 외부 관찰 가능한 동작(인가 거부)은 동일하게 유지되고 불필요한 DB 조회를 제거한다. 부작용 없음.
- 제안: 해당 없음.

### 8. [INFO] `NotificationsChannelAuthorizer.authorize()` — 동기 함수를 `Promise.resolve()` 래핑
- 위치: `/codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` L15-L20
- 상세: 인터페이스 계약(`Promise<...>` 반환)을 지키기 위해 동기 비교 결과를 `Promise.resolve()` 로 래핑한다. `async` 없이 `Promise.resolve()` 를 반환하면 `@typescript-eslint/require-await` lint 규칙 위반 없이 인터페이스를 구현할 수 있다. 이는 의도된 패턴이며 RESOLUTION.md W-7 에 설명됨. 예상치 못한 부작용 없음.
- 제안: 해당 없음.

### 9. [INFO] 모듈 export 목록 확장 — 공개 API 변경
- 위치: `executions.module.ts`, `knowledge-base.module.ts`, `workflows.module.ts`
- 상세: 각 도메인 모듈이 `ExecutionChannelAuthorizer`, `BackgroundRunChannelAuthorizer`, `KbChannelAuthorizer`, `WorkflowChannelAuthorizer` 를 exports 에 추가했다. 이 클래스들은 NestJS DI 스코프에서만 의미가 있으며, 다른 모듈이 `@Inject()` 로 이 authorizer 클래스를 직접 주입받는 예상치 못한 소비가 가능해진다. 현재 의도된 소비자는 WS 모듈 `useFactory` 뿐이다. `CHANNEL_AUTHORIZER` 토큰이 아닌 클래스 토큰으로 직접 주입받는 미래 소비자는 의존성 역전 설계를 우회할 수 있다.
- 제안: authorizer 클래스 직접 주입의 의도하지 않은 사용을 방지하려면, 향후 `CHANNEL_AUTHORIZER` 토큰을 통해서만 authorizer 를 소비하도록 팀 내 규약을 문서화한다. 구조적 강제는 어렵지만 코드 리뷰 가이드라인으로 보완 가능하다.

### 10. [INFO] `handleSubscribe` — 추가된 `!workspaceId` 가드
- 위치: `/codebase/backend/src/modules/websocket/websocket.gateway.ts` L190-L195
- 상세: `workspaceId` 가 비어있을 때 `Not authenticated` 로 거부하는 가드가 추가됐다. 코드 주석에 "handleConnection 이 인증 실패 시 disconnect 하므로 정상 경로에서 도달 불가"라고 명시돼 있다. 이 가드는 `notifications:` 채널(userId 기반)에도 적용된다. `notifications:` 채널의 JWT 에 `workspaceId` 가 항상 포함되는지 여부가 런타임에만 검증되는 암묵적 가정이다. `handleConnection` 의 JWT payload 타입이 `{ sub: string; workspaceId?: string }` — optional — 이므로 이론적으로 `workspaceId` 가 없는 valid JWT 가 이 가드를 트리거할 수 있다.
- 제안: 이 가드는 RESOLUTION.md W-2 DEFER 에 기록된 "workspaceId non-optional 강화" 과제와 연관된다. 현재는 방어적 가드로 적절하다.

---

## 요약

M-7 변경은 `WebsocketGateway` 의 서비스-레벨 forwardRef 3개를 제거하고 채널 인가 책임을 각 도메인 모듈의 authorizer 클래스로 이전하는 구조적 리팩터링이다. 부작용 관점에서 새로 도입된 전역 변수나 공유 상태 변경은 없다. 새로 생성된 파일(authorizer 5종, channel-authorizer.ts, uuid.ts)은 모두 순수 함수 또는 NestJS DI 범위 내 상태를 다루며 예상치 못한 파일시스템 접근·네트워크 호출·환경 변수 조작이 없다. 주목할 부작용으로는, `BackgroundRunsService` export 유지로 인해 불필요한 서비스 노출이 지속되는 점(기존 이슈, M-7 해소 미완)과, 도메인 모듈이 authorizer 클래스를 직접 export 함으로써 클래스 토큰 직접 주입이 가능해진 점이 있으나 둘 다 의도된 설계 결정이거나 경미한 캡슐화 이슈다. `UUID_PATTERN` 모듈 공유는 non-global RegExp 플래그 확인으로 thread-safe, fail-closed `.catch(() => false)` 패턴은 기존 동작 보존이며 운영 로깅 미흡은 범위 외 개선 사항이다.

## 위험도

LOW
