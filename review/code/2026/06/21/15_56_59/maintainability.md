# 유지보수성(Maintainability) 리뷰

## 발견사항

### 채널 prefix 문자열 중복 (WARNING)
- **[WARNING]** 채널 prefix 리터럴(`'background:run:'`, `'execution:'`, `'kb:'`, `'workflow:'`, `'notifications:'`)이 각 authorizer 파일과 `websocket.gateway.ts`의 `VALID_CHANNEL_PREFIXES` 배열에 이중으로 존재한다.
  - 위치: `/codebase/backend/src/modules/websocket/websocket.gateway.ts` (VALID_CHANNEL_PREFIXES), `/codebase/backend/src/modules/executions/background-runs/background-run-channel-authorizer.ts` L16, `/codebase/backend/src/modules/executions/execution-channel-authorizer.ts` L22, 각 authorizer 내 `channel.slice(...)` 리터럴
  - 상세: `VALID_CHANNEL_PREFIXES` 배열과 각 authorizer의 `matches`/`slice` 에 같은 문자열이 반복된다. prefix 이름 변경 시 두 곳을 동시에 수정해야 하며, 한 쪽만 수정하면 `isValidChannel`과 `matches`의 불일치로 채널 검증 로직이 조용히 깨진다. 신규 채널 authorizer를 추가할 때 `VALID_CHANNEL_PREFIXES` 갱신을 잊기 쉬운 함정이다.
  - 제안: 각 authorizer 클래스에 `static readonly PREFIX = 'background:run:'` 상수를 선언하고, `VALID_CHANNEL_PREFIXES`를 `[BackgroundRunChannelAuthorizer.PREFIX, ...]` 형태로 authorizer에서 파생하거나, 아예 `VALID_CHANNEL_PREFIXES` 대신 주입된 `channelAuthorizers` 배열을 `isValidChannel`에서도 활용하도록 `handleSubscribe`를 단순화한다.

### useFactory inject 목록 중복 (WARNING)
- **[WARNING]** `websocket.module.ts`와 `websocket.gateway.spec.ts` 두 곳에서 동일한 `inject` 배열(`[ExecutionChannelAuthorizer, BackgroundRunChannelAuthorizer, WorkflowChannelAuthorizer, KbChannelAuthorizer, NotificationsChannelAuthorizer]`)과 `useFactory` 서명이 거의 그대로 복사되었다.
  - 위치: `/codebase/backend/src/modules/websocket/websocket.module.ts` L39-L45, `/codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L140-L150
  - 상세: 신규 authorizer를 추가할 때 두 파일을 동시에 수정해야 한다. spec 파일의 갱신을 빠뜨리면 production 연결과 다른 wiring으로 테스트가 통과하는 거짓 자신감을 준다.
  - 제안: spec에서 실 `WebsocketModule`의 provider 목록을 재사용하거나, helper 함수 `buildChannelAuthorizerProvider(authorizerTokens)`를 `websocket.module.ts`에서 export해 spec이 동일 팩토리 정의를 import하게 한다.

### `slice` 호출 시 prefix 리터럴 인라인 하드코딩 (INFO)
- **[INFO]** 각 authorizer 구현체에서 `channel.slice('background:run:'.length)` 같이 prefix 문자열이 두 번(matches 및 slice) 등장한다.
  - 위치: `/codebase/backend/src/modules/executions/background-runs/background-run-channel-authorizer.ts` L15, L23; `/codebase/backend/src/modules/executions/execution-channel-authorizer.ts` L22, L30; `/codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` L15, L20; `/codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` L15, L21
  - 상세: 매직 스트링 수준은 낮으나, prefix를 상수화하면 `matches`와 `slice` 호출을 같은 상수에서 파생시켜 오탈자 방어가 된다.
  - 제안: 각 클래스에 `private static readonly PREFIX = 'background:run:'`을 선언하고 `matches`·`slice` 양쪽에서 참조.

### `authorize` 시그니처 일관성 부재 (INFO)
- **[INFO]** `NotificationsChannelAuthorizer.authorize`는 동기 함수지만 `Promise.resolve(...)`를 감싸 반환한다. 반면 나머지 authorizer들은 `async` 키워드를 쓴다. 내부 로직이 동기임을 표현하는 방식이 달라 처음 읽는 사람이 혼란스럽다.
  - 위치: `/codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` L17-L25
  - 상세: 인터페이스 반환 타입이 `Promise<...>`이므로 동기 로직을 `async` 함수로 선언해도 문제없고, 팀 내 다른 authorizer와 패턴을 통일하는 편이 가독성이 높다.
  - 제안: `async authorize(...): Promise<...> { const allowed = ...; return allowed ? null : { error: ... }; }` 형태로 일관화.

### `handleSubscribe` 내 `enriched` 로컬 캐스팅 이중 선언 (INFO)
- **[INFO]** `handleSubscribe` 함수 내부에서 `client`를 `enriched`로 타입 캐스팅하는 블록이 두 번 나타난다(L2003-2006 및 L2083).
  - 위치: `/codebase/backend/src/modules/websocket/websocket.gateway.ts` (handleSubscribe 바디)
  - 상세: M-7 변경 직접 대상은 아니지만, 함수 상단에 단일 캐스팅 후 재사용하면 독자가 두 곳에서 같은 의도를 추적하지 않아도 된다. 이 함수 자체가 이미 길어서 리팩터링 시 주목 포인트다.
  - 제안: `handleSubscribe` 함수 상단에서 한 번만 `const enriched = client as Socket & { workspaceId?: string; userId?: string }` 캐스팅.

### KbChannelAuthorizer에 UUID 검증 누락 (INFO)
- **[INFO]** `KbChannelAuthorizer`는 `documentId`에 대해 `isValidUuid` 검증을 하지 않는 반면, `ExecutionChannelAuthorizer`와 `BackgroundRunChannelAuthorizer`는 UUID 형식 검증(W-6)을 수행한다. 같은 계층의 authorizer끼리 정책이 다르다.
  - 위치: `/codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` L19-L24
  - 상세: KB 문서 ID가 UUID가 아닌 다른 식별자 체계를 쓴다면 의도적 생략이지만, 코드에 그 이유가 명시되어 있지 않다. UUID 체계를 쓴다면 동일한 W-6 방어가 필요하고, 다른 체계면 주석으로 설명이 필요하다.
  - 제안: KB `documentId`가 UUID면 `isValidUuid` 가드 추가. 그렇지 않으면 `authorize` 상단에 `// documentId 는 UUID 아님 — 형식 검증 없이 service 에 위임` 주석 추가.

## 요약

M-7 리팩터링은 gateway 내 인라인 authorizer 배열과 서비스 역참조를 도메인 모듈 소유의 클래스로 분리하는 명확한 책임 역전을 달성했으며, 각 authorizer 클래스와 테스트 파일이 단일 책임·단일 함수 길이 면에서 양호하다. 핵심 유지보수 위험은 채널 prefix 리터럴이 `VALID_CHANNEL_PREFIXES` 배열과 각 authorizer에 이중으로 존재해 신규 채널 추가 시 누락 가능성이 있고, `websocket.module.ts`와 `gateway.spec.ts`의 useFactory inject 목록이 동기화 대상으로 남아 있다는 점이다. 이 두 WARNING을 해소하면 신규 authorizer 추가 비용이 "authorizer 파일 1개 + 도메인 모듈 provider 1줄 + factory inject 1줄"로 완전히 국소화된다.

## 위험도

LOW
