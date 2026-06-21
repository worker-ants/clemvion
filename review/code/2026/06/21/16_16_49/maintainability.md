# 유지보수성(Maintainability) 리뷰

## 발견사항

### 채널 prefix 리터럴 이중 관리 — `VALID_CHANNEL_PREFIXES` vs authorizer `matches`/`slice` (WARNING)
- **[WARNING]** 채널 prefix 문자열(`'background:run:'`, `'execution:'`, `'kb:'`, `'workflow:'`, `'notifications:'`)이 각 authorizer 의 `matches`/`slice` 인라인과 gateway 의 `VALID_CHANNEL_PREFIXES` 배열에 이중으로 하드코딩되어 있다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (VALID_CHANNEL_PREFIXES), 각 `*-channel-authorizer.ts` 파일 `matches`/`slice` 호출부
  - 상세: 신규 채널을 추가하거나 기존 prefix 를 변경할 때 authorizer 파일과 `VALID_CHANNEL_PREFIXES` 두 곳을 동시에 수정해야 한다. 한 쪽을 누락하면 `isValidChannel` 통과 채널이 매칭 authorizer 를 못 찾아 fail-closed 거부(W-5)로 빠지는 silent regression 이 발생할 수 있다. 직전 리뷰(15_56_59)에서 이미 같은 WARNING 이 제기됐고 DEFER 처리됐으나, 이번 fresh 리뷰 대상 코드에도 동일하게 잔존한다.
  - 제안: 각 authorizer 클래스에 `static readonly PREFIX = 'background:run:'` 상수를 두고 `matches`/`slice` 양쪽에서 참조한다. `VALID_CHANNEL_PREFIXES` 는 주입된 authorizer 배열로부터 `.map(a => a.constructor['PREFIX'])` 혹은 authorizer 클래스 PREFIX 정적 필드를 직접 참조하도록 전환하면 단일 출처로 수렴된다. DEFER 를 유지하려면 기존 RESOLUTION 근거(W-5+W-6 봉인)를 이번 리뷰 문서에도 명시적으로 계승한다.

### `useFactory` inject 목록 — 모듈과 spec 이중 관리 (WARNING)
- **[WARNING]** `websocket.module.ts` 의 `useFactory` `inject` 배열(`[ExecutionChannelAuthorizer, BackgroundRunChannelAuthorizer, WorkflowChannelAuthorizer, KbChannelAuthorizer, NotificationsChannelAuthorizer]`)과 `websocket.gateway.spec.ts` 의 동일 구조가 두 파일에 거의 동일하게 중복된다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` (providers 블록 useFactory), `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (테스트 내 wiring 블록)
  - 상세: 직전 리뷰에서도 동일 WARNING 이 제기됐고 DEFER 됐다(이유: gateway spec 이 prod wiring 을 의도적으로 미러링하는 integration 가치, authorizer 개수 assertion 으로 drift 봉인). 이번 fresh 리뷰 대상 코드에도 동일하게 잔존한다. 개수 assertion 이 추가됐으므로 silent drift 위험은 낮아졌으나, 신규 채널 추가 시 3곳(도메인 모듈 + websocket.module + gateway.spec) 편집이 여전히 필요하다.
  - 제안: DEFER 유지 시 이번 리뷰에서도 "개수 assertion 봉인 확인" 을 명시한다. 해소하려면 `buildChannelAuthorizerFactory(injected: ChannelAuthorizer[]): ChannelAuthorizer[]` helper 를 모듈 파일에서 export 하고 spec 이 동일 함수를 import 해 단일 출처로 수렴한다.

### `NotificationsChannelAuthorizer.authorize` 비동기 패턴 불일치 (INFO)
- **[INFO]** `NotificationsChannelAuthorizer.authorize` 는 `Promise.resolve(...)` 래퍼를 사용하는 반면, 나머지 4개 authorizer 는 `async/await` 패턴을 쓴다. 인터페이스 반환 타입은 동일하나 구현 스타일이 달라 첫 독자가 혼란스럽다.
  - 위치: `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` L17-L25
  - 상세: 직전 리뷰 W-7 에서 `Promise.resolve` 래퍼 이유(`async` 무-await 전환 시 `@typescript-eslint/require-await` 위반)가 해명됐다. 이번 fresh 리뷰 대상 코드에도 동일 패턴이 잔존한다. 기존 코드베이스 패턴 기준으로는 `async` 사용이 일반적이나 ESLint 제약으로 인한 불가피한 선택이다.
  - 제안: 코드 내 주석에 `// async 무-await ESLint 위반 방지용 Promise.resolve 래퍼` 한 줄을 추가해 의도를 명시한다. 코드 변경은 필요 없다.

### 각 authorizer 내 prefix 상수 부재로 `matches`/`slice` 이중 리터럴 (INFO)
- **[INFO]** 동일 prefix 문자열이 `matches` 의 `startsWith('background:run:')` 와 `slice('background:run:'.length)` 두 곳에 각각 리터럴로 등장한다. 오탈자로 불일치가 생기면 `matches` 통과 후 `slice` 가 잘못된 길이를 잘라내는 버그가 생긴다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-run-channel-authorizer.ts` L14/L23, `codebase/backend/src/modules/executions/execution-channel-authorizer.ts` L22/L30, `codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` L14/L20, `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` L13/L21, `codebase/backend/src/modules/workflows/workflow-channel-authorizer.ts` L13/L20
  - 상세: `private static readonly PREFIX = 'background:run:'` 상수를 두면 `matches`/`slice` 양쪽을 같은 상수에서 파생시켜 오탈자 방어가 된다. 이는 위 WARNING(채널 prefix 이중 관리)과 동일 해소책으로 수렴된다.
  - 제안: WARNING 항목의 `static readonly PREFIX` 상수화 제안과 동일하게 처리한다.

### `WorkflowChannelAuthorizer.authorize` — `verifyOwnership` 대신 `findById` 패턴 (INFO)
- **[INFO]** `ExecutionChannelAuthorizer` 와 `BackgroundRunChannelAuthorizer` 는 `verifyOwnership`/`verifyBackgroundRunOwnership` 처럼 명시적 "검증" 메서드를 호출하는 반면, `WorkflowChannelAuthorizer` 는 `findById(workflowId, workspaceId).then(() => true).catch(() => false)` 로 존재 여부를 인가 판정에 사용한다.
  - 위치: `codebase/backend/src/modules/workflows/workflow-channel-authorizer.ts` L24-L27
  - 상세: `findById` 의 throw/resolve 시맨틱이 "소유 검증" 과 동치임이 인라인 주석(NotFound throw = ID enumeration 차단)으로 설명돼 있어 현재 가독성은 수용 가능하다. 다만 `WorkflowsService` 에 전용 `verifyWorkflowOwnership(id, workspaceId)` 메서드가 없어 인터페이스 일관성이 약간 떨어진다.
  - 제안: 현 상태 수용. 장기적으로 `WorkflowsService` 에 `verifyOwnership` 메서드를 추가하거나, `findById` 가 소유 검증을 겸함을 서비스 JSDoc 에 명시하면 authorizer 독자가 의도를 빠르게 파악한다.

### `kb-channel-authorizer.ts` 주석 — UUID 가드 추가 근거 충분 (INFO)
- **[INFO]** `KbChannelAuthorizer` 에 이번 resolution(W-1 FIXED)으로 `isValidUuid` 가드가 추가됐고, 클래스 JSDoc 에 그 이유(W-6 정책 일관화, 동작 보존 근거)가 상세히 기술됐다. 가독성 면에서 양호하다.
  - 위치: `codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` L10-L17
  - 상세: 직전 리뷰의 INFO(KbChannelAuthorizer UUID 검증 누락)가 이번에 해소됐다.
  - 제안: 현 수준 유지.

---

## 요약

이번 fresh 리뷰 대상 코드는 직전 리뷰(15_56_59) resolution 으로 KbChannelAuthorizer UUID 가드(W-1), fail-closed 분기(W-5), authorizer 개수 assertion(W-6)이 보강된 상태다. 구조적으로 각 authorizer 클래스가 단일 책임·단일 함수 길이를 잘 지키고 있으며 인터페이스 정의와 JSDoc 주석도 충분하다. 잔존하는 유지보수 위험은 두 가지다: (1) 채널 prefix 리터럴이 `VALID_CHANNEL_PREFIXES` 와 각 authorizer 의 `matches`/`slice` 에 이중으로 하드코딩된 점, (2) `websocket.module.ts` 의 `useFactory` inject 목록이 `gateway.spec.ts` 에 중복된 점. 두 항목 모두 직전 리뷰에서 DEFER 처리된 pre-existing 패턴이고, authorizer 개수 assertion 으로 silent drift 위험이 봉인된 상태이므로 이번 리뷰 기준으로 DEFER 를 계승한다. 기타 INFO 항목들(Promise.resolve 패턴, slice 이중 리터럴, findById 패턴)은 동작에 영향 없는 가독성 nit 수준이다.

## 위험도

LOW

STATUS: SUCCESS
