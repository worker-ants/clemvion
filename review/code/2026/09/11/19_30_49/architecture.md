# 아키텍처 리뷰 — `impl-chat-channel-binder-t2` (4라운드)

## 범위 재확인

`origin/main` 대비 이번 PR 전체 diff(커밋 `a2e5b7e16`~`68bb34e73`)를 대상으로 하되, 1~3라운드
(`review/code/2026/09/11/18_04_36`, `18_42_05`, `19_06_54`)에서 이미 구조 관점으로 검증된
Extract-Class 리팩터링(`TriggersService.setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`
→ `ChatChannelBinderService`/`buildTriggerCallbackUrl`) 자체는 이번 라운드에서 다시 손대지
않았음을 직접 소스로 재확인했다(아래 "재확인" 절).

**이번 라운드의 실제 신규 diff(3라운드 검토 시점 `8f43b1f56` → 현재 `68bb34e73`)는 코드 관점에서
`triggers.service.spec.ts` 테스트 1건 추가뿐**이다(그 외 diff 는 `plan/in-progress/*.md`,
`review/code/2026/09/11/19_06_54/*` 등 문서/리뷰 산출물). 나머지 파일(`chat-channel-binder.service.ts`,
`chat-channel-binder.service.spec.ts`, `trigger-callback-url.ts`, `trigger-callback-url.spec.ts`,
`triggers.module.ts`, `triggers.web-chat.spec.ts`)은 3라운드 검토 이후 변경이 없다.

```
git diff 8f43b1f56..HEAD --stat -- codebase/backend/src/modules/triggers
 .../modules/triggers/triggers.service.spec.ts | 25 ++++++++++++++
```

## 신규 diff 분석 — `triggers.service.spec.ts`

`TriggersService.remove` describe 블록에 `ChatChannelBinderService` 인스턴스를 `moduleRef.get`
으로 뽑아 `jest.spyOn(binder, 'teardownChatChannel')` 로 위임 호출 자체(호출 여부·인자)를
단언하는 테스트 1건을 추가했다. 3라운드 WARNING1(`remove()` 가 binder 를 부른다는 배선 자체를
아무도 안 본다 — 삭제해도 9,598개 전부 GREEN)에 대한 후속 조치다.

아키텍처 관점에서 이 추가는:

- **레이어/의존 방향에 변경 없음** — 테스트가 협력자(`ChatChannelBinderService`)를 DI 컨테이너에서
  꺼내 스파이하는 방식은 `create`/`update` → `setupChatChannel` 위임을 검증하는 기존 자매 테스트와
  동일한 패턴이며, 새로운 결합을 만들지 않는다.
- **오히려 Extract-Class 분리의 이점을 실증한다** — 클래스 경계가 없었다면(같은 클래스 내부
  private 메서드 호출) 이런 위임 단언은 스파이 대상이 없어 더 비쌌을 것이다. 협력자 인터페이스가
  생겨 "위임 여부"를 저비용으로 고정할 수 있게 된 것은 이번 리팩터링이 의도한 테스트 용이성
  (testability) 향상이 실제로 작동함을 보여주는 사례다.
- **SRP/응집도에 영향 없음** — `TriggersService.remove()` 는 여전히 오케스트레이션(레포지토리 삭제
  + binder 위임)만 하고, teardown 의 세부(어댑터 조회·best-effort catch)는 `ChatChannelBinderService`
  안에 남아 있다.

## 재확인 (독립 실측, 회귀 여부)

- **모듈 export 경계**: `triggers.module.ts` 직접 열람 — `providers: [TriggersService,
  ChatChannelBinderService, ...]`, `exports: [TriggersService]`. `ChatChannelBinderService` 는
  여전히 모듈 밖으로 노출되지 않는다. `Controller → TriggersService → ChatChannelBinderService`
  단방향 레이어 순서 유지, 1~3라운드와 동일.
- **의존 주입 방향**: `triggers.service.ts` 에서 `constructor(... private readonly
  chatChannelBinder: ChatChannelBinderService ...)` 로 협력자를 주입받고, `setupChatChannel`
  호출부 2곳(448행·565행 부근) + `teardownChatChannel` 호출부 1곳(855행 부근)이 전부 위임 형태다 —
  역방향 호출(binder → TriggersService)은 없다.
- **순환 의존 재발 여부**: 3라운드까지 확인된 대로 `chat-channel.module.ts`/`secret-store.module.ts`
  는 `TriggersModule` 을 import 하지 않는다 — `#676` 이 끊은 `chat-channel↔triggers` 순환은
  재발하지 않았다.

## 발견사항

이번 라운드에서 새로 발견된 구조적 결함은 없다. 과거 라운드에서 이미 등재·처분된 INFO 항목
(secret-ref 이름 리터럴의 이중 소유 — `chat-channel-binder.service.ts` `setupChatChannel` vs
`triggers.service.ts` `rotateBotToken`; `getAppBaseUrl()` 중복 등)은 이번 라운드의 신규 diff
범위(테스트 1건) 밖이라 재론하지 않는다 — 3라운드 `architecture.md`(`review/code/2026/09/11/
19_06_54/architecture.md`)에 이미 상세가 남아 있다.

## 요약

이번(4)라운드의 코드 관점 실질 변경은 `TriggersService.remove()` → `ChatChannelBinderService
.teardownChatChannel` 위임 배선을 고정하는 테스트 1건뿐이며, 클래스 경계·모듈 export·의존
방향·순환 의존 등 구조적 요소는 3라운드까지의 판정에서 재변경되지 않았음을 직접 소스 대조로
재확인했다. 새로 도입된 결합도 상승, 레이어 위반, 순환 의존, 안티패턴은 없다. Extract-Class
리팩터링이 만든 클래스 경계 덕분에 위임 호출 자체를 저비용으로 단언할 수 있게 됐다는 점에서
이번 추가 테스트는 오히려 구조 개선의 실효성을 보여주는 사례로 평가한다.

## 위험도

NONE
