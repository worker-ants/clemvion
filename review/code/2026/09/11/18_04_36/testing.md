# 테스트(Testing) 리뷰 — `impl-chat-channel-binder-t2`

대상: `ChatChannelBinderService`/`trigger-callback-url.ts` 신설 + `TriggersService` 에서
`setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 을 뽑아낸 순수 이동 리팩터.

## 검증 방법

프롬프트만으로 판단하지 않고 저장소를 직접 열어 대조하고, 3가지 뮤테이션을 **실행**해
가설을 검증했다(결과는 아래 발견사항에 근거로 인용). 뮤테이션 절차: `git show HEAD:<path>`
로 스크래치 디렉터리(`/private/tmp/.../scratchpad/testing-review-mutation/`)에 원본을
저장 → 저장소 파일을 직접 수정 → `npx jest` 실행 → `cp` 로 원복 → `git status --short` 로
클린 확인(매 라운드 확인, 최종 상태는 `?? review/code/...` 한 줄만 남아 클린).

- 베이스라인: `npx jest src/modules/triggers/` → **7 suites / 246 passed / 1 skipped** (plan 이
  체크리스트에 적은 수치와 일치).
- 뮤테이션 1: `chat-channel-binder.service.ts:133` `if (storeUserSuppliedSecrets)` → `if (true)`
  → **RED 2건** (telegram bot-token 미회전 기대 위반, slack 비밀 미쓰기 기대 위반).
- 뮤테이션 2: `chat-channel-binder.service.ts:185` `inboundSigningRefSurvives` 술어 → `false` 고정
  → **RED 4건** (`it.each(['slack','discord'])` fail-open 회귀 캐너리 2건 + telegram 재발급 캐너리
  + degraded 실패경로 캐너리).
- 뮤테이션 3: `chat-channel-binder.service.ts:258` 실패경로 `fallbackConfig` 의 `internalCfg` →
  `sanitizedCfg` (ref 유실 재현) → **RED 1건** ("setupChannel 이 실패해도(degraded)
  inboundSigningRef 를 잃지 않는다").
- 뮤테이션 4(신규, plan 목록에는 없던 것 — 아래 발견 W2): `triggers.service.ts:1061`
  `buildTriggerCallbackUrl(baseUrl, endpointPath)` 인자 순서를 `(endpointPath, baseUrl)` 로 교체
  → **전량 GREEN** (124개 중 0 실패). 이 결과가 발견 W2 의 근거다.

세 원본 파일은 매 라운드 `cp` 로 정확히 원복했고, 마지막 `git status --short` 는
`review/code/2026/09/11/18_04_36/` (본 리뷰 산출물) 한 줄만 보여 저장소는 클린하다.

## 발견사항

- **[WARNING]** `buildTriggerCallbackUrl` 의 두 번째 호출부(`rotateBotToken`)가 인자 순서를
  검증하는 테스트 없이 GREEN 을 유지한다 — 뮤테이션 4로 실증.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1061` (신규 호출부,
    `buildTriggerCallbackUrl(this.configService.get<string>('app.url'), trigger.endpointPath)`).
    회귀 캐너리 부재 지점: `triggers.service.spec.ts` `rotateBotToken` describe 의
    `'정상 — old token resolve → v2 백업 → primary rotate → setupChannel → webhook secret store
    → trigger 갱신'` 테스트 — `expect(mockAdapter.setupChannel).toHaveBeenCalled()` 만 확인하고
    두 번째 인자(콜백 URL 문자열)는 단언하지 않는다.
  - 상세: 이 PR 전에는 `this.buildCallbackUrl(trigger.endpointPath)` 처럼 인자가 1개라 순서를
    틀릴 여지가 없었다. 이번 이동으로 `buildTriggerCallbackUrl(baseUrl, endpointPath)` 2-인자
    공유 함수가 되면서 호출부가 2곳(= `ChatChannelBinderService.setupChatChannel` 내부와
    `TriggersService.rotateBotToken`)으로 늘었는데, **첫 번째 호출부만** 실제 URL 값을
    단언하는 전용 describe(`'TriggersService — webhook callbackUrl 조립 (app.url 사용 회귀
    방지)'`, `triggers.service.spec.ts:1539`)가 있다. 두 번째 호출부는 그런 단언이 없어
    실제로 두 인자를 바꿔치기해도(뮤테이션 4) 전체 스위트가 통과했다 — 같은 함수의 두
    호출부 사이에 검증 수준이 비대칭이다.
  - 제안: `rotateBotToken` 테스트에 `expect(mockAdapter.setupChannel).toHaveBeenCalledWith(
    expect.anything(), '<기대 URL>')` 형태로 두 번째 인자를 단언하는 줄을 추가한다 — "단언
    diff 0줄" 이라는 이 PR 의 증거 기준과는 별개로, 이 특정 호출부는 **이번 diff 가 새로
    만든** 인자-순서 위험이므로 신규 단언 추가가 정당하다.

- **[WARNING]** `teardownChatChannel` 의 핵심 분기(adapter 가 등록된 경우의 실제
  `adapter.teardownChannel()` 호출 + try/catch best-effort 로그)가 전체 백엔드 테스트
  스위트에서 단 한 번도 실행되지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:277-291`
    (`teardownChatChannel` 전체, 특히 284-289행 try/catch).
  - 상세: `triggers.service.spec.ts`/`triggers.web-chat.spec.ts` 전체를 grep 한 결과
    `.remove(...)` 를 호출하는 모든 describe 블록이 `ChannelAdapterRegistry` 를
    `{ has: jest.fn(() => false), get: jest.fn() }` 로 고정해 뒀다(`createBaseProviders`
    헬퍼의 기본값 포함, `triggers.service.spec.ts:64-65`). 따라서
    `if (!this.channelAdapterRegistry.has(...)) return;` 에서 항상 조기 반환하고,
    실제 `adapter.teardownChannel(chatChannelCfg)` 호출도 그 실패 시 warn 로그 경로도
    한 번도 도달하지 않는다. `grep -rln "teardownChannel"` 로 backend 전체를 봐도
    이 조합(레지스트리 조회 → 실제 adapter 호출 → 실패 시 best-effort 처리)을 검증하는
    테스트는 없다(각 adapter 자신의 `teardownChannel` 단위 테스트는 `discord/telegram/
    slack` `*.adapter.spec.ts` 에 있지만 그건 오케스트레이션 래퍼가 아니라 adapter 내부
    로직만 본다). 이 갭은 이동 전(`TriggersService` 안에 있을 때)에도 이미 존재했던
    사전 갭이지만, 이번 diff 가 이 로직을 담은 **완전히 새로운 파일**을 만들었으므로
    이 리뷰의 스코프 안에서 재확인할 가치가 있다.
  - 제안: `remove()` 경로에 대해 `ChannelAdapterRegistry.has` 가 `true` 를 반환하는 케이스를
    최소 2개 추가한다 — (a) `adapter.teardownChannel` 이 정상 호출되는 happy path, (b) 그것이
    reject 됐을 때 `remove()` 자체는 여전히 성공하고(best-effort) `logger.warn` 만 발생하는
    경로. `chat-channel-binder.service.ts` 자체의 전용 spec 파일에서 테스트하는 편이
    `TriggersService` 의 거대한 spec 에 더 얹는 것보다 낫다(아래 발견 참고).

- **[WARNING]** `ChatChannelBinderService` (신규 292줄 클래스)를 직접 대상으로 하는 독립
  unit spec 파일이 없다 — 모든 커버리지가 `TriggersService`/`triggers.web-chat.spec.ts` 를
  통한 간접 행사뿐이다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (클래스 선언,
    49행) — 짝이 될 `chat-channel-binder.service.spec.ts` 가 존재하지 않는다.
  - 상세: 이 클래스의 JSDoc(17-25행)이 스스로 "Nest provider 로 만든 이유"의 선례로 같은
    폴더의 `chat-channel-token-rotator.service.ts` 를 든다. 그런데 그 선례 자신은
    `chat-channel-token-rotator.service.spec.ts` 에서 `new ChatChannelTokenRotatorService(
    triggersMock, queueMock)` 로 **직접 인스턴스화**해 독립적으로 단위 테스트된다(NestJS
    TestingModule 조차 거치지 않는다). `ChatChannelBinderService` 는 구조적으로 동일한
    "DI 대상 소수 협력자를 가진 클래스"인데도 같은 방식의 직접 테스트가 없고, 9개
    `describe` 블록에 provider 로 끼워 넣어져 `TriggersService` 의 공개 메서드(`create`/
    `update`/`remove`)를 통해서만 행사된다. 지금은 "단언 diff 0줄" 이 이 PR 의 명시적
    설계 목표라 새 스펙 파일을 추가하지 않은 것이 의도적일 수 있으나, 결과적으로
    이 클래스의 공개 계약(`setupChatChannel`/`teardownChatChannel`)에 대한 실패 메시지는
    항상 "TriggersService 의 어떤 시나리오가 깨졌다" 형태로만 나오고 "ChatChannelBinderService
    의 무엇이 깨졌다" 로는 나오지 않는다 — 가독성·디버깅 관점에서 실제 뮤테이션 로그도
    (본 리뷰의 검증 섹션) 전부 `TriggersService — chatChannel PATCH ...` 라는 상위 describe
    이름으로 실패를 보고했다.
  - 제안: 필수는 아니지만, 후속 PR 에서 `chat-channel-binder.service.spec.ts` 를 신설해
    (a) provider 미등록 skip, (b) endpointPath 부재 400, (c) 위 세 가지 뮤테이션 대상 분기를
    **이 클래스만 놓고** 직접 단언하면, 실패 메시지의 귀속이 정확해지고 `TriggersService`
    거대 spec 파일(126KB)에 대한 결합도 낮아진다.

## 긍정적으로 확인된 점 (오탐 방지용 기록)

- 3개 뮤테이션 대상(플랜이 스스로 지정한 `storeUserSuppliedSecrets` 게이팅 ·
  `inboundSigningRefSurvives` 술어 · 실패경로 `fallbackConfig`)은 실제로 전부 RED 를 낸다 —
  "GREEN 은 증거가 아니다" 원칙에 따라 리뷰어가 직접 재현했고 plan 의 주장은 유효하다.
  다만 리뷰 시점의 plan 체크리스트(`plan/in-progress/impl-chat-channel-binder-t2.md`
  "뮤테이션 3곳 RED")는 아직 미확인(`[ ]`)으로 남아 있다 — 순서(plan `## 순서` 4번)상
  이 `/ai-review` 가 그 확인보다 먼저 실행된 것으로 보인다. 결함은 아니고 프로세스 순서
  기록.
- 새 파일의 JSDoc 안에 있는 "회귀 캐너리" 3개 인용(`telegram — server-issued 서명은 PATCH
  에서도 재저장된다`, `slack/discord — 카드 편집 PATCH 후에도 inboundSigningRef 가
  살아남는다`, `setupChannel 이 실패해도(degraded) inboundSigningRef 를 잃지 않는다`)를
  전부 `triggers.service.spec.ts` 에서 grep 으로 확인 — 3개 모두 실재하는 테스트 이름과
  정확히 일치한다(각각 3062행 · 3314행(`it.each`) · 3344행). 이름이 낡거나 존재하지 않는
  테스트를 가리키는 흔한 결함 클래스가 여기서는 재발하지 않았다.
- `*.spec.ts` diff 는 실제로 provider 등록 10줄 + import 2줄뿐이고 단언(`expect`) 줄은 하나도
  바뀌지 않았다 — plan 의 "단언 diff 0줄" 주장과 diff 내용이 일치한다.
- `ChatChannelBinderService` 는 `TriggersModule` 에 등록되되 `exports` 에는 없다(diff 그대로
  확인) — 의도한 "이 모듈 안에서만 쓰는 협력자" 설계와 일치하고, 다른 모듈이 실수로
  주입하면 Nest 부팅 시점에 즉시 드러난다.
- 테스트 격리: 9개 `describe` 블록 모두 자체 `Test.createTestingModule(...).compile()` 을
  `beforeEach` 에서 새로 만들어 `ChatChannelBinderService` 인스턴스를 매번 새로 얻는다 —
  클래스에 static/module-level 상태가 없어(Logger 인스턴스만 보유) 테스트 간 누수 위험 없음.

## 요약

순수 이동 리팩터라는 설계 목표에 맞게 기존 회귀 테스트가 이동된 로직의 핵심 3분기를
실제로 커버한다는 것을 뮤테이션으로 직접 재현·확인했다(plan 의 미검증 주장을 이 리뷰가
검증). 다만 이 diff 가 새로 만든 위험 표면 2곳은 아직 비어 있다 — (1) `buildTriggerCallbackUrl`
의 두 번째 호출부(`rotateBotToken`)는 인자 순서 오류를 잡을 단언이 없고 실제로 뮤테이션이
전량 GREEN 으로 살아남았으며, (2) `teardownChatChannel` 의 실제 adapter 호출·실패 경로는
before/after 를 통틀어 어떤 테스트도 도달하지 못한다(사전 존재 갭이지만 신규 파일 스코프
안에서 재확인됨). 새 클래스 자체를 겨냥한 독립 unit spec 부재는 이 PR 의 "선례"로 인용한
자매 서비스의 테스트 관행과도 비대칭이다. 세 항목 모두 동작을 깨지는 않지만(현재 코드는
정확하다) 다음 편집에서 회귀를 조용히 통과시킬 수 있는 커버리지 갭이다.

## 위험도

MEDIUM
