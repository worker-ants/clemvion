# 부작용(Side Effect) 리뷰 — impl-chat-channel-binder-t2 (2라운드, `18_04_36` W1/W2 해소분)

## 검증 방법

이 라운드는 직전 라운드(`review/code/2026/09/11/18_04_36`)가 지적한 W1(콜백 URL 인자 순서
스왑 뮤턴트 생존)·W2(`teardownChatChannel` adapter 경로 미검증)를 닫는 diff다. 신규 파일
(`chat-channel-binder.service.spec.ts`, `trigger-callback-url.ts`, `trigger-callback-url.spec.ts`)과
그 파생 diff(`triggers.service.ts`, `triggers.module.ts`, `*.spec.ts` provider 등록)를 직접
`Read`/`git diff origin/main`으로 열어 대조했다. 저장소에는 아무것도 쓰지 않았다(읽기·grep만
수행, 뮤테이션 불필요).

- `buildTriggerCallbackUrl(baseUrl, endpointPath)` 위치 인자 → `buildTriggerCallbackUrl({ baseUrl,
  endpointPath })` 이름 인자로 시그니처가 바뀌었다. `grep -rn "buildTriggerCallbackUrl"
  codebase/backend/src` 전수 확인 결과 호출부는 `chat-channel-binder.service.ts:112`와
  `triggers.service.ts:1061` 단 둘뿐이고 **둘 다 이름 인자 형태로 갱신돼 있다.** 이 함수 자체가
  이번 feature 브랜치(`a2e5b7e16`)에서 처음 생겼다 — `main`에 아직 없어 외부 호출자가 존재할 수
  없다. 시그니처 변경의 호출자 영향은 없음.
- `TriggersService` 생성자 시그니처(신규 `chatChannelBinder: ChatChannelBinderService` 파라미터)는
  직전 라운드에서 이미 검증됐고 이번 diff는 그 검증 결과를 바꾸지 않는다(`grep -rn "new
  TriggersService("` 전역 0건, 수동 인스턴스화 경로 없음).
- `triggers.module.ts`: `ChatChannelBinderService`는 `providers`에만 있고 `exports`에는 없다(직접
  파일 전문 확인, `exports: [TriggersService]`) — 모듈 경계 밖 공개 표면 변화 없음.

## 발견사항

- **[INFO]** 신규 테스트가 `Logger.prototype`(공유 프로토타입)을 mock 하는데 복원이 해피 패스에만
  걸려 있다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts` —
    `it('adapter 가 던져도 삼키고 trigger id 와 사유를 warn 으로 남긴다', ...)` 블록(파일 끝
    describe 안의 마지막 `it`). 게이트 기준 103행 `jest.spyOn(Logger.prototype, 'warn')` ~
    115행 `warn.mockRestore()`.
  - 상세: `jest.spyOn(Logger.prototype, 'warn')`는 인스턴스가 아니라 **프로토타입**을 바꾸는
    전역성 mutation이다. `mockRestore()`는 그 사이의 `expect(warn).toHaveBeenCalledTimes(1)` 등
    단언이 전부 통과해야만 도달한다 — 하나라도 실패하면 `Logger.prototype.warn`이 mock 상태로
    남는다. 이 파일에는 `afterEach`/`try…finally` 안전망이 없다. 같은 저장소의
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:544-547`가
    바로 이 위험을 주석으로 명시하며 `try/finally`로 감싸는 걸 관례로 제시하고, `node-handler.registry.spec.ts`·
    `http-request.handler.spec.ts`·`execution-context.service.spec.ts`·`logging.interceptor.spec.ts`는
    `afterEach(() => jest.restoreAllMocks())` 로 같은 문제를 구조적으로 막는다. 다만 저장소 전반을
    보면 `mockRestore()`를 단언 뒤에 맨몸으로 두는 패턴(`discord-message.renderer.spec.ts`,
    `telegram-message.renderer.spec.ts`, `chat-channel-dedup.service.spec.ts`,
    `list-models-cap.spec.ts` 등)도 다수라 이 파일만의 신규 결함이라기보다는 **기존에 섞여 있는
    두 관례 중 약한 쪽을 그대로 따른 것**이다. 현재는 이 `it`이 파일의 마지막 테스트라 실패 시
    같은 파일 내 다른 테스트로 전파되진 않지만, 이 파일에 테스트가 추가되면 그 즉시 잠재 위험이
    현실화된다.
  - 제안: 조치 불요(차단 사유 아님) — 다만 향후 이 파일에 테스트를 추가할 때는
    `warn.mockRestore()`를 `try/finally` 또는 `afterEach`로 옮기는 것을 권장. 신규 파일이니 지금
    고치는 비용이 가장 싸다.

- **[정보/검증 결과 — 결함 아님]** `ChatChannelBinderService`를 실제 클래스(mock 아님)로 주입받는
  `triggers.service.spec.ts`/`triggers.web-chat.spec.ts`의 provider 배열 10곳(`+ChatChannelBinderService`
  1줄씩)이, 그 생성자가 요구하는 4개 협력자(`Repository<Trigger>`·`ChannelAdapterRegistry`·
  `ChannelListenerRegistry`·`SecretResolverService`)를 이미 같은 모듈에서 `TriggersService`용으로
  등록해 둔 **동일 mock 인스턴스**로 해석한다는 것을 표본(`triggers.service.spec.ts` 40번째 줄
  부근 블록)에서 직접 확인했다. 두 서비스가 같은 mock 객체를 공유하므로 `create()`/`update()`/
  `remove()` 경로가 `ChatChannelBinderService`를 경유하도록 바뀌어도, 그 mock에 걸린 기존
  `toHaveBeenCalledWith` 류 단언은 호출 경로가 아니라 "누가 호출했나"만 신경 쓰지 않으므로 깨지지
  않는다 — 새로운 이중 호출·경합 부작용은 관측되지 않았다.
  `ChatChannelBinderService`의 생성자는 필드 대입 외 부수효과(타이머·`OnModuleInit` 등)가 없어,
  chat-channel과 무관한 테스트(`findAll`, `Schedule 역방향 동기화` 등)에 실제 인스턴스를 얹어도
  그 자체로 새 부작용을 만들지 않는다.

- **[정보/검증 결과 — 결함 아님]** `teardownChatChannel`의 로직·에러 처리·로그 문구는 직전 라운드
  구현과 바이트 단위로 동일하다 — 이번 diff는 그 경로를 **처음으로 행사하는 테스트**만 추가했을
  뿐 프로덕션 코드(`chat-channel-binder.service.ts`)는 이 파일에서 변경되지 않았다. 새 테스트가
  검증하는 대상(adapter 호출 인자, best-effort catch, warn 로그 내용)은 기존 코드 경로 그대로다.

## 요약

이번 diff는 직전 라운드 W1/W2를 닫기 위한 **테스트 신설 + 순수 함수 시그니처를 위치 인자→이름
인자로 바꾸는 리팩터**다. 시그니처가 바뀐 `buildTriggerCallbackUrl`은 이번 브랜치에서 갓 태어난
내부 함수라 호출자 영향이 없고, 두 호출부 모두 갱신됐음을 grep으로 확인했다. `TriggersModule`의
export 경계·DI 시그니처 변경 여파는 직전 라운드에서 이미 전수 검증됐고 이번 diff로 달라지지
않는다. 유일한 관찰은 신규 spec 파일의 `Logger.prototype` 전역 mock 복원이 해피 패스에만
의존하는 점인데, 저장소에 섞여 있는 기존 관례 중 약한 쪽을 따른 것이라 이 PR을 막을 사유는
아니며 INFO로 남긴다. 전역 변수 신설, 예상치 못한 파일시스템 쓰기, 환경 변수 오·남용, 의도치
않은 네트워크 호출, 이벤트/콜백(리스너 registry register/unregister) 변경은 발견되지 않았다.

## 위험도

LOW
