# 부작용(Side Effect) 리뷰 — `impl-chat-channel-binder-t2` (4라운드 누적, `ba634a4b0..HEAD`)

## 검증 방법

`git merge-base HEAD origin/main` = `ba634a4b0`(= `spec-chat-channel-input-rules` 완료 지점)을
diff base 로 삼아 `git diff ba634a4b0..HEAD --stat`, `-- codebase/backend/src/modules/triggers/`
경로별 전체 diff, 그리고 `chat-channel-binder.service.ts`·`chat-channel-binder.service.spec.ts`·
`triggers.module.ts` 는 `Read` 로 원문 전체를 직접 열어 대조했다. `triggers.service.ts` 삭제분과
`chat-channel-binder.service.ts` 신설분을 나란히 놓고 로직 동일성을 재확인했다. 저장소에는 아무것도
쓰지 않았다 — 읽기·`git diff`·`grep`만 수행했고, 종료 시 `git status --short` 결과 이 리뷰 세션
산출 디렉터리(`review/code/2026/09/11/19_30_49/`) 외 미커밋 변경은 없었다(다른 병렬 세션의 잔여
뮤테이션도 관측되지 않음).

이번 프롬프트에는 `codebase/backend/src/modules/triggers/{chat-channel-binder.service.spec.ts,
chat-channel-binder.service.ts, triggers.service.spec.ts, triggers.service.ts}` 4개 핵심 파일의
diff 가 크기 제한으로 생략돼 있어 저장소에서 직접 `Read`/`git diff`로 확인했다(아래 위치 인용은
그 결과 — 실제 파일의 1-기준 줄 번호).

이 라운드(`19_30_49`) 자체는 직전 세 라운드(`18_04_36`→`18_42_05`→`19_06_54`)의 WARNING·INFO 대응이
전부 커밋된 이후 상태이며, 코드 변경분은 `triggers.service.spec.ts`에 `remove()`가
`ChatChannelBinderService.teardownChatChannel`을 위임 호출하는지 확인하는 테스트 1건이 추가된
것(커밋 `68bb34e73`)이 3라운드 이후 유일한 신규 프로덕션/테스트 코드 diff이고, 나머지는 `plan/**`·
`review/**` 산출물 커밋이다.

## 발견사항

- **[정보/검증 결과 — 결함 아님]** `TriggersService.setupChatChannel`/`teardownChatChannel`/
  `buildCallbackUrl`이 `ChatChannelBinderService`/`buildTriggerCallbackUrl`로 옮겨간 것은 **동작을
  바꾸지 않는 순수 이동**임을 재확인했다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 전체 (특히
    `setupChatChannel` 83-271행, `teardownChatChannel` 277-291행) vs
    `codebase/backend/src/modules/triggers/triggers.service.ts`에서 삭제된 구 버전(`git diff
    ba634a4b0..HEAD -- .../triggers.service.ts`의 `-` 블록).
  - 상세: secret store 쓰기 게이팅(`storeUserSuppliedSecrets`) · `inboundSigningRefSurvives` 술어 ·
    `trigger.config`/health 컬럼 갱신 · `channelListenerRegistry.register()` 호출 순서(성공 경로
    전용) · best-effort catch 의 `chatChannelHealth: 'degraded'` 처분이 이동 전후 바이트 단위로
    동일하다. 호출자(`triggers.service.ts`의 `create()`/`update()`/`remove()`)는 호출 대상만
    `this.setupChatChannel(...)` → `this.chatChannelBinder.setupChatChannel(...)`,
    `this.teardownChatChannel(...)` → `this.chatChannelBinder.teardownChatChannel(...)`로 바뀌고
    인자·순서·`preservedInboundSigningRef` 전달 시점은 동일하다.
  - 제안: 조치 불요.

- **[정보/검증 결과 — 결함 아님]** `TriggersService` 생성자 시그니처 변경(`chatChannelBinder:
  ChatChannelBinderService` 파라미터 신규 추가)의 호출자 영향 없음.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 생성자 (기존 constructor 목록
    끝에 추가), `codebase/backend/src/modules/triggers/triggers.module.ts` `providers` 배열.
  - 상세: `grep -rn "new TriggersService(" codebase/backend/src` — **0건**. 모든 spec 파일
    (`triggers.service.spec.ts`·`triggers.web-chat.spec.ts` 등)이 `Test.createTestingModule`로
    provider 목록에 `ChatChannelBinderService`를 추가해 DI 로 해결하고 있어(예:
    `triggers.service.spec.ts` `createBaseProviders()` 및 각 `describe`의 `providers` 배열),
    포지셔널 인자 순서에 의존하지 않는다. 프로덕션 코드에서도 `TriggersModule`을 통한 Nest DI
    외에 이 서비스를 직접 인스턴스화하는 지점이 없다.
  - 제안: 조치 불요.

- **[정보/검증 결과 — 결함 아님]** `ChatChannelBinderService`는 `TriggersModule`의 `providers`에만
  등록되고 `exports`에는 없어 모듈 밖 공개 표면을 넓히지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.module.ts` (providers 배열의
    `ChatChannelBinderService`, `exports: [TriggersService]`).
  - 상세: `grep -rn "ChatChannelBinderService" codebase/backend/src`(non-test) 결과 이 클래스를
    참조하는 파일은 `triggers.service.ts`(주입・호출)와 `triggers.module.ts`(provider 등록)뿐이며,
    다른 모듈에서 import/inject 하는 지점은 없다.
  - 제안: 조치 불요. (기존 라운드가 이미 지적한 대로, `setupChatChannel`/`teardownChatChannel`이
    `private`→`public`으로 바뀌어 *"이 모듈 안에 새 provider 가 추가되면 검증·감사 경로를 우회해
    직접 호출할 수 있는 형태적 여지"*가 생긴 것은 사실이나, 현재 호출자는 `TriggersService`
    하나뿐임을 재확인했다 — 이미 3라운드 `side_effect.md`에 등재된 결론과 동일하며 이번 diff 로
    바뀐 것이 없어 중복 등재하지 않는다.)

- **[정보/검증 결과 — 결함 아님]** 환경 변수·파일시스템·네트워크 부작용 신규 없음.
  - 상세: `buildTriggerCallbackUrl`(`trigger-callback-url.ts`)은 `baseUrl`을 인자로 받을 뿐
    `process.env`를 직접 읽지 않는다(JSDoc 이 `process.env.APP_URL`을 언급하는 것은 `app.config.ts`
    의 기존 동작을 설명하는 주석일 뿐, 이 함수가 직접 읽는 게 아님 — `grep`으로 실제 코드 줄에
    `process.env` 참조 없음을 확인). `configService.get<string>('app.url')` 호출은 이동 전과 동일한
    키를 그대로 사용한다. 이번 diff(`ba634a4b0..HEAD`)에 신규 파일 I/O·신규 외부 HTTP 호출은 없다
    — 코드 변경은 `codebase/backend/src/modules/triggers/**`로 한정되고, 나머지는 `plan/**`·
    `review/**` 문서 산출물(프로젝트 관례상 커밋 대상)이다.

- **[정보/검증 결과 — 결함 아님]** 이벤트/콜백(`ChannelListenerRegistry.register`/`unregister`)
  호출 시점·조건 변경 없음.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:241-244`
    (`setupChatChannel` 성공 경로에서만 `register` 호출), `codebase/backend/src/modules/triggers/triggers.service.ts`
    의 `remove()`(`teardownChatChannel` 호출 직후 `unregister` — 순서 diff 로 보존 확인).
  - 상세: 3라운드까지 `remove()`가 `chatChannelBinder.teardownChatChannel(trigger)`를 실제로
    호출하는지에 대한 단언이 배선 전체를 아무도 안 봐 뮤테이션(호출 삭제)이 backend 9,598개 전부
    GREEN 으로 살아남던 갭이 있었는데, 이번 라운드의 유일한 신규 테스트
    (`triggers.service.spec.ts` `'remove 는 chat-channel teardown 을 binder 에 위임한다'`)가
    `jest.spyOn(binder, 'teardownChatChannel')`로 이 배선 자체를 고정했다 — 테스트 추가일 뿐
    프로덕션 이벤트/콜백 흐름 자체는 바뀌지 않았다.

## 요약

`ba634a4b0..HEAD`(5개 커밋) 전체를 직접 대조한 결과, 이 diff 는 `TriggersService`의 private
메서드 3종(`setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`)을 신규
`ChatChannelBinderService`와 순수 함수 `buildTriggerCallbackUrl`로 옮기는 **동작 보존 리팩터**이며,
`triggers.controller.ts`·DTO·다른 모듈은 diff 밖이다. `TriggersService` 생성자 시그니처 변경은
Nest DI 로만 해소되고 수동 인스턴스화 지점이 없어 호출자 영향이 없으며, 신설 provider 는 모듈
밖으로 export 되지 않는다. 전역 변수 신설, 예상치 못한 파일시스템 쓰기, 환경 변수 오·남용, 의도치
않은 네트워크 호출, 이벤트/콜백 흐름 변경은 발견되지 않았다. 3라운드까지 이미 등재된 항목(private→
public 가시성 미세 확장, 로그 메시지의 `TriggersService:` 접두 잔존, `trigger.config` lost-update —
모두 이동 전부터 존재하던 사전 갭이거나 조치 불요로 처분됨)은 이번 4라운드 diff 로 재확인했을 뿐
새로 바뀐 것이 없어 중복 등재하지 않는다. 이번 라운드 자체의 신규 코드 변경은 `remove()`→binder
위임 배선을 고정하는 테스트 1건뿐이며 프로덕션 부작용 표면을 넓히지 않는다.

## 위험도

NONE
