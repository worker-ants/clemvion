# 아키텍처 리뷰 — `impl-chat-channel-binder-t2` (3라운드)

## 범위

1·2라운드(`review/code/2026/09/11/18_04_36`, `18_42_05`)에서 이미 검증된 Extract-Class
리팩터링(`TriggersService.setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` →
`ChatChannelBinderService`/`buildTriggerCallbackUrl`) 자체는 이번 라운드에서 구조적으로
재변경되지 않았다. 이번 라운드의 실제 코드 diff(`92f4b0607`→`8f43b1f56`)는 세 파일에
한정된 **테스트 품질 강화 + JSDoc 정정**뿐이다:

1. `triggers.service.spec.ts` — `rotateBotToken` describe 의 `ConfigService` mock 을
   키-무관(`get: jest.fn(() => 'http://localhost:3000')`)에서 키-인식형으로 교체하고,
   `setupChannel` 호출 단언을 `toHaveBeenCalled()` → `toHaveBeenCalledWith(..., url)` 로 강화.
2. `chat-channel-binder.service.spec.ts` — 테스트 헬퍼 `makeBinder(adapter, has)` 의 두 번째
   인자를 위치 기반 boolean 에서 이름 인자 객체(`{ adapter, providerRegistered }`)로 전환,
   `Logger.prototype.warn` spy 복원을 `afterEach(jest.restoreAllMocks)` 로 이동.
3. `trigger-callback-url.ts` — 위치 인자 시대의 유물인 `@param baseUrl`/`@param endpointPath`
   JSDoc 태그(구조분해 인자에는 대응하는 최상위 이름이 없어 존재하지 않는 대상을 가리키고
   있었다)를 제거하고 타입 리터럴의 각 프로퍼티에 JSDoc 을 옮겨 붙임.

구조(클래스 경계·모듈 export·의존 방향)에 대한 변경은 없다.

## 재확인한 것 (독립 실측)

- **순환 의존 재발 여부**: `chat-channel.module.ts`, `secret-store.module.ts` 를 직접
  열어 확인 — 둘 다 `TriggersModule` 을 import 하지 않는다(`chat-channel.module.ts` 는
  `../triggers/entities/trigger.entity` **엔티티 타입만** 참조). `#676` 이 제거한
  `chat-channel↔triggers` 순환은 재발하지 않았다 — 1·2라운드 판정과 동일.
- **모듈 export 경계**: `triggers.module.ts:47-54` — `ChatChannelBinderService` 는
  `providers` 에만 있고 `exports` 배열(`triggers.module.ts:55`, `exports: [TriggersService]`)
  에는 없다. `Controller → TriggersService → ChatChannelBinderService` 단방향 레이어
  순서 유지.
- **JSDoc 정정의 정확성**: `trigger-callback-url.ts` 를 직접 열어 확인 — `@param` 태그가
  실제로 사라졌고, 함수 시그니처의 인라인 객체 리터럴 타입 각 프로퍼티(`baseUrl`,
  `endpointPath`)에 JSDoc 주석이 옮겨져 있다(46-53행). 구조분해 매개변수 문서화 관례로
  올바르다.
- **테스트 헬퍼 인자 형태의 일관성**: `chat-channel-binder.service.spec.ts` 의
  `makeBinder` 가 이제 이름 인자를 쓴다 — 프로덕션 코드(`buildTriggerCallbackUrl`)에서
  적용한 "위치 인자 스왑 위험 제거" 원칙을 테스트 헬퍼에도 동일하게 적용한 것으로,
  이전 라운드에서 발견된 "원칙이 프로덕션 코드에만 적용되고 테스트 코드는 예외"라는
  비대칭을 스스로 해소했다.

## 발견사항

- **[INFO]** secret-ref 이름 리터럴(`'bot-token'`, `'inbound-signing'`)을 만드는
  `buildSecretRef({scope:'triggers', resourceId, name})` 호출부가 `ChatChannelBinderService
  .setupChatChannel`(`chat-channel-binder.service.ts` 118-127행 부근)과 `TriggersService
  .rotateBotToken`(`triggers.service.ts` 1019-1037행 부근) 양쪽에 각각 독립적으로 존재한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (함수
    `setupChatChannel` 본문의 `botTokenRef`/`inboundSigningRef` 선언부), `codebase/backend/
    src/modules/triggers/triggers.service.ts` (함수 `rotateBotToken` 본문의 동일 선언부)
  - 상세: 두 클래스가 "이 트리거의 bot-token/inbound-signing secret ref 이름은 무엇인가"
    라는 지식을 각자 갖고 있다. 다만 이는 **이번 리팩터링이 만든 결함이 아니다** — Extract-Class
    이전에도 `setupChatChannel`과 `rotateBotToken`은 같은 `TriggersService` 안의 서로 다른
    메서드로서 이미 같은 패턴을 각자 반복하고 있었고(`triggers.service.ts` 의
    `notification-signing` ref 도 별도로 세 번째 반복), `buildSecretRef` 헬퍼 자체가 이미
    이 저장소 전역에서 호출부마다 `name` 문자열만 바꿔 쓰는 관행(리터럴 6곳)이다. 클래스를
    나눈 것이 이 중복의 "가시성"을 서비스 경계 너머로 옮겼을 뿐, 응집도를 악화시키지는
    않았다.
  - 제안: 이 PR 범위에서 조치 불필요. 향후 세 번째 chat-channel 관련 secret ref 소비자가
    생기면 `buildSecretRef` 호출을 감싸는 `chatChannelSecretRefs(triggerId)` 같은 좁은
    헬퍼로 통합을 고려(지금은 2~3곳뿐이라 과잉 추상화).

- **[INFO]** 이번 라운드가 강화한 `rotateBotToken` 의 `ConfigService` mock(키-인식형)과
  `setupChatChannel` 경로(`triggers.service.spec.ts` 의 "webhook callbackUrl 조립" describe)
  가 이제 대칭을 이루면서, `buildTriggerCallbackUrl` 의 **두 호출부**(`ChatChannelBinderService
  .setupChatChannel`, `TriggersService.rotateBotToken`) 모두 "어떤 config 키를 읽는가"까지
  실측하는 캐너리를 갖게 됐다 — 서비스 경계를 넘어 공유되는 순수 함수 하나를 두 소유자가
  각자 테스트로 계약을 지키는 구조가 이번 수정으로 완성됐다. 긍정적 관찰이며 조치 불필요.

## 참고 — 리뷰 도중 관측된 (자체 해소된) 워크트리 뮤테이션

리뷰 중간 시점의 `git status --short` 에서, 내가 어떤 파일도 Write/Edit 하지 않았음에도
`codebase/backend/src/modules/triggers/triggers.service.ts` 가 일시적으로 미커밋 수정
상태였다: `remove()` 안의 `await this.chatChannelBinder.teardownChatChannel(trigger);` 가
`// MUTATED-OUT: ...` 주석으로 바뀌어 있었다. 이는 병렬로 같은 워크트리를 도는 다른
reviewer 의 뮤테이션 테스트(원복 전 중간 상태)로 추정된다 — 내가 만들지 않았고 프로토콜에
따라 `git checkout`/`git restore` 로 손대지 않았다. **후속 확인 결과 이 상태는 이미 정상
복원됐다**(`grep -n teardownChatChannel triggers.service.ts` → 855행에 원래 호출이 그대로
있음, `git status --short` 재확인 결과 해당 파일 unmodified). 즉 해당 reviewer가 스스로
cp 복원을 완료한 것으로 보인다. 이 PR 의 아키텍처 결함이 아니며 현재는 잔여 오염이 없다 —
기록만 남긴다.

## 요약

이번 라운드의 실제 diff 는 1·2라운드에서 이미 LOW/NONE 로 판정된 Extract-Class 구조
자체를 다시 손대지 않고, 직전 라운드가 지적한 두 갭(config 키 무관 mock · 위치 기반 테스트
헬퍼 boolean · 구조분해 인자에 대응하지 않는 `@param` 태그)을 테스트 강화와 문서 정정으로
닫았다. 모듈 export 경계·순환 의존 부재는 소스를 직접 열어 재확인한 결과 1·2라운드와
동일하게 유지되고 있다. 새로 도입된 구조적 결합·순환·레이어 위반은 없으며, 유일한 관찰
(secret-ref 이름 리터럴의 이중 소유)도 이 리팩터링이 만든 것이 아니라 이미 존재하던
저장소 전역 관행의 재확인이다. 리뷰 도중 다른 reviewer 로 추정되는 일시적 워크트리
뮤테이션을 관측했으나 확인 시점에 이미 자체 복원돼 잔여 영향은 없다.

## 위험도

NONE
