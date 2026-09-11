# 부작용(Side Effect) 리뷰 — impl-chat-channel-binder-t2 (3라운드, `18_42_05` W1/W2/INFO7-8 해소분)

## 검증 방법

이번 라운드(커밋 `92f4b0607`·`8f43b1f56`)는 `review/code/2026/09/11/18_04_36`·`18_42_05` 두 라운드가
지적한 항목(콜백 URL 인자 순서 → 이름 인자 전환, `teardownChatChannel` adapter 경로 신규 테스트,
`configService.get` mock 의 키 무시 문제, `@param` JSDoc 불일치, 테스트 헬퍼 위치 인자, `Logger.prototype`
spy 복원 시점)을 닫는 diff다. `git diff origin/main...HEAD`로 전체 변경 파일을 확인하고,
`chat-channel-binder.service.ts`·`trigger-callback-url.ts`·`triggers.module.ts`·
`chat-channel-binder.service.spec.ts`는 `Read`로 원문 전체를 직접 열어 대조했다. 저장소에는
아무것도 쓰지 않았다(읽기·grep·`git show`만 수행, 뮤테이션 불필요 — 종료 시 `git status --short`
확인 결과 이 리뷰 산출물 디렉터리 외 변경 없음, 다른 세션의 잔여 뮤테이션도 관측되지 않았다).

## 발견사항

- **[정보/검증 결과 — 결함 아님]** 직전 라운드(`18_42_05`)가 INFO 로 지적한 `Logger.prototype.warn`
  spy 복원이 해피 패스에만 있던 문제는 **이번 커밋에서 해소됨**을 확인했다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts:75-77`
    (`afterEach(() => { jest.restoreAllMocks(); })`)
  - 상세: 종전에는 마지막 `it` 블록 안에서 단언 뒤에 `warn.mockRestore()`를 두어, 그 앞 단언이
    실패하면 전역 `Logger.prototype.warn`이 mock 상태로 남을 수 있었다. 지금은 `describe` 최상단
    `afterEach`로 옮겨져 단언 성패와 무관하게 매 테스트 뒤 복원이 보장된다 — 파일에 테스트가
    추가돼도 전역 오염 위험이 재발하지 않는 구조로 바뀌었다.

- **[정보/검증 결과 — 결함 아님]** `TriggersService.rotateBotToken` describe 의 `ConfigService` mock
  이 키 인식형으로 바뀐 것은 **그 describe 블록 스코프 안에 격리**되어 있어 다른 describe 의
  `ConfigService` mock 동작에 영향을 주지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1899-1906`
    (`get: jest.fn((key: string) => key === 'app.url' ? 'http://localhost:3000' : undefined)`)
  - 상세: 각 `describe`가 자신의 `Test.createTestingModule`을 새로 만들므로 이 mock 교체는
    전역 상태가 아니다. `app.url` 반환값 자체는 그대로 유지돼(`'http://localhost:3000'`) 이
    describe 안의 기존 단언(`setupChannel` 호출 인자 등)에 회귀를 만들지 않음을 diff 로 확인했다.

- **[INFO]** `setupChatChannel`/`teardownChatChannel`이 `TriggersService`의 `private` 메서드에서
  `ChatChannelBinderService`의 **`public`** 메서드로 바뀌어, 모듈 내부 캡슐화 경계가 미세하게
  넓어졌다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — 클래스 선언부
    (`export class ChatChannelBinderService`) 및 두 메서드 시그니처(`async setupChatChannel(...)`,
    `async teardownChatChannel(...)`)
  - 상세: 이동 전에는 두 메서드가 `TriggersService`의 `private`라 `create()`/`update()`/`remove()`가
    수행하는 입력 검증(`assertChatChannelInputSafe` 등)·감사 로그를 반드시 거쳐야만 도달할 수
    있었다. 지금은 `public` 메서드가 됐고, 클래스 자체는 `triggers.module.ts`의 `exports`에 없어
    **모듈 밖에서는** 호출할 수 없지만, **`TriggersModule` 안에 새 provider가 추가되면** 그 provider가
    `ChatChannelBinderService`를 주입받아 검증·감사 경로를 우회해 `setupChatChannel`을 직접 호출할
    길이 형태상 열려 있다. 현재 호출자는 `TriggersService` 단 하나뿐이라(grep 확인) 지금 당장의
    행동 변화는 없다. `architecture.md`(`18_04_36`)의 INFO(`preservedInboundSigningRef` 호출-순서
    불변식이 클래스 내부 계약에서 서비스 간 암묵 계약으로 바뀜)와 같은 축의 관찰이지만, 이 항목은
    "누가 호출할 수 있는가"(가시성) 쪽이라 별도로 남긴다.
  - 제안: 조치 불요(차단 사유 아님) — 다만 향후 `TriggersModule`에 provider가 추가될 때, 이
    메서드를 `TriggersService`를 거치지 않고 직접 호출하지 않도록 리뷰 시 상기할 필요가 있다.

- **[정보/검증 결과 — 결함 아님]** `TriggersService` 생성자 시그니처(신규
  `chatChannelBinder: ChatChannelBinderService` 파라미터)의 호출자 영향은 이전 두 라운드에서 이미
  전수 검증됐고, 이번 diff(테스트 전용)로 그 결론이 달라지지 않는다.
  - 상세: `grep -rn "new TriggersService(" codebase/` 0건(재확인). `TriggersService`를 `jest.Mocked`
    타입으로만 참조하는 주변 spec(`chat-channel-token-rotator.service.spec.ts`,
    `notification-secret-rotator.service.spec.ts`, `triggers.controller.spec.ts` 등)은 실제
    생성자를 호출하지 않으므로 이번 시그니처 변경과 무관함을 확인했다.

- **[정보/검증 결과 — 결함 아님]** 공개 HTTP 계약(엔드포인트·요청/응답 스키마·에러 코드)에 영향
  없음.
  - 상세: `git diff origin/main...HEAD --stat -- codebase/backend/src/modules/triggers/triggers.controller.ts`
    가 빈 결과 — 컨트롤러는 이번 3개 커밋(및 그 이전 리팩터 커밋) 어디에서도 손대지 않았다.
    `chat-channel/` 모듈도 diff 대상에 없다(`git diff --stat -- codebase/backend/src/modules/chat-channel/`
    빈 결과).

- **[정보/검증 결과 — 결함 아님]** 환경 변수·네트워크·파일시스템 부작용 없음.
  - 상세: `configService.get<string>('app.url')` 호출은 이동 전과 동일한 키를 읽을 뿐 새 env 키를
    도입하지 않았다. 이번 3커밋에 신규 외부 I/O·파일 쓰기는 없다(코드 변경은 `codebase/backend/src/modules/triggers/**`
    로 한정, 산출물은 `plan/**`·`review/**` 문서뿐).

## 요약

이번 라운드는 두 차례 선행 리뷰가 지적한 항목(콜백 URL 인자 순서/키, teardown 미검증 경로, JSDoc
불일치, 테스트 헬퍼 위치 인자, `Logger.prototype` spy 복원 시점)을 테스트 신설·강화와 순수 함수
시그니처 조정으로 닫는 diff이며, 프로덕션 로직(`setupChatChannel`/`teardownChatChannel`의 동작)은
바이트 단위로 변경되지 않았다. 직전 라운드가 INFO 로 남긴 `Logger.prototype` 전역 mock 복원 문제는
`afterEach(jest.restoreAllMocks())`로 구조적으로 해소됨을 확인했고, `ConfigService` mock 키 인식
강화도 해당 describe 스코프 안에 격리돼 다른 테스트에 영향이 없다. `TriggersService` 생성자
시그니처 변경의 호출자 영향은 기존 라운드 결론(영향 없음)이 유지된다. 새로 관찰한 것은 두 메서드가
`private`→`public`으로 바뀌며 모듈 내부 캡슐화 경계가 미세하게 넓어졌다는 점인데, 클래스가 모듈
밖으로 export 되지 않고 현재 호출자가 하나뿐이라 즉각적인 위험은 아니다. 전역 변수 신설, 예상치
못한 파일시스템 쓰기, 환경 변수 오·남용, 의도치 않은 네트워크 호출, 공개 HTTP 계약 변경, 이벤트/콜백
(리스너 registry register/unregister) 동작 변경은 발견되지 않았다.

## 위험도

LOW
