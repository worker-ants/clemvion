# 테스트(Testing) 코드 리뷰 — `impl-chat-channel-binder-t2` (3라운드)

## 검토 범위 및 방법

이 diff 는 `TriggersService` 의 private 메서드였던 `setupChatChannel` / `teardownChatChannel` /
`buildCallbackUrl` 을 신규 `ChatChannelBinderService`(`chat-channel-binder.service.ts`)와 순수 함수
`buildTriggerCallbackUrl`(`trigger-callback-url.ts`)로 옮기는 리팩터다. 이미 이 diff 는
`review/code/2026/09/11/18_04_36`(1라운드)·`18_42_05`(2라운드) 두 차례 `/ai-review` 를 거쳤고,
각 라운드에서 testing 관점 WARNING 이 실측(뮤테이션)으로 확인되어 수정됐다:

- 1라운드 W1(인자 순서 스왑 생존) → 이름 인자로 형태 변경
- 1라운드 W2(`teardownChatChannel` adapter 경로 미실행) → `chat-channel-binder.service.spec.ts` 신설
- 2라운드 W1(`rotateBotToken` 이 읽는 config 키 미검증) → key-aware mock + URL 값 단언 추가

이 회차에서는 위 수정 사항이 실제로 현재 코드에 반영돼 있는지 `Read` 로 직접 대조 확인했고,
그 위에서 **아직 남아 있는 갭**을 뮤테이션으로 재검증했다. 뮤테이션은 저장소 밖 scratch 사본
(`/private/tmp/.../scratchpad/testing-review/triggers.service.ts.orig`)에 원본을 보관한 뒤
`triggers.service.ts` 를 직접 수정 → 테스트 실행 → `cp` 로 즉시 원복했다. 원복 후
`git status --short` 로 확인한 결과 리뷰 세션 산출물(`review/code/2026/09/11/19_06_54/`) 외
잔여 변경 없음 — 뮤테이션 흔적 없이 정상 복구됐다.

## 발견사항

- **[WARNING]** `TriggersService.remove()` 가 `chatChannelBinder.teardownChatChannel(trigger)` 를
  호출한다는 사실 자체를 검증하는 테스트가 없다 — 그 위임 호출을 통째로 지워도 관련 스위트가
  전부 GREEN 이다 (뮤테이션으로 실증).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:855`
    (`async remove(...)` 안의 `await this.chatChannelBinder.teardownChatChannel(trigger);`)
  - 상세: 이 줄을 주석 처리(`// MUTATED-OUT: ...`)하고
    `npx jest triggers.service.spec.ts triggers.web-chat.spec.ts chat-channel-binder.service.spec.ts`
    와 `npx jest triggers.controller.spec.ts` 를 각각 돌렸다 — **전부 GREEN**
    (`Test Suites: 3 passed`, `Tests: 131 passed, 1 skipped`; controller 도 `10 passed`). 원복 후
    `git status --short` 로 잔여 diff 0줄 확인.
    원인은 `triggers.service.spec.ts` 의 유일한 `remove()` 통합 테스트
    (`describe('TriggersService.remove — deleteByPrefix 호출 검증 (SUMMARY#13)')`, 약 1719행)가
    쓰는 트리거 fixture 가 `config: {}` — `chatChannel` 키가 없다는 점이다. 그 결과 실제
    `ChatChannelBinderService`(mock 아님, 진짜 클래스가 등록됨)가 호출돼도
    `teardownChatChannel` 내부의 `if (!chatChannelCfg) return;` 에서 즉시 반환해 아무 관측 가능한
    부수효과도 남기지 않는다. 저장소 전체에서 `teardownChatChannel` 을 참조하는 곳은
    `chat-channel-binder.service.spec.ts`(새 파일, 클래스를 `new` 로 직접 생성해 단위 테스트)
    뿐이다(`grep -rn teardownChatChannel src/ test/` 확인) — **호출부(`remove()`) 를 거치는
    경로는 어디에도 없다.**
    이 갭은 리팩터가 만든 새 결함은 아니다(`git show origin/main:.../triggers.service.ts` 대조
    결과 이동 전에도 `private async teardownChatChannel` 을 `remove()` 가 같은 방식으로 호출했고
    같은 fixture 로 테스트됐다 — 사전 존재). 다만 이 PR 이 정확히 대칭되는 문제
    (`setupChatChannel` 호출부인 `create()`/`update()`)는 실제 adapter mock 을 등록해
    `mockAdapter.setupChannel`/`triggerRepo.update` 값까지 두껍게 단언하는 반면(예:
    `describe('TriggersService — webhook callbackUrl 조립 …')`, `describe('… chatChannel PATCH 는
    사용자 비밀을 쓰지 않는다 (R-CC-21)')`), `teardownChatChannel` 쪽은 그 대칭이 없다 — 이
    PR 이 이미 두 차례(1·2라운드) *"선례가 있는데 비대칭"* 패턴을 스스로 잡아 고쳐 온 것과
    같은 클래스의 결함이다. `ChatChannelBinderService` 가 이제 독립 provider 라 `remove()`
    describe 에서 `jest.spyOn`/mock 으로 호출 여부·인자를 단언하는 비용이 낮아졌다는 점도
    지금 닫기 좋은 이유다.
  - 제안: `remove — deleteByPrefix 호출 검증` describe 에 `chatChannel` 이 있는 트리거로
    `chatChannelBinder.teardownChatChannel` 이 정확한 `trigger` 인자로 호출됐음을 단언하는
    케이스를 추가하거나(실제 클래스 유지 + adapter mock 등록해 `adapter.teardownChannel` 호출
    까지 관측), 최소한 `jest.spyOn(chatChannelBinder, 'teardownChatChannel')` 로 호출 자체만이라도
    고정한다.

- **[INFO]** `chat-channel-binder.service.spec.ts` 가 `teardownChatChannel` 만 다루고
  `setupChatChannel` 을 의도적으로 다시 덮지 않는 설계는 근거가 확인됐다 — 문제 아님, 기록용.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts:1-18` (헤더 주석)
  - 상세: `triggers.service.spec.ts` 가 `create()`/`update()` 공개 진입점을 통해 실제
    `ChatChannelBinderService` 인스턴스(mock 아님)와 mock adapter 로 `setupChatChannel` 의 세
    갈래 뮤테이션(`storeUserSuppliedSecrets` 게이팅·`inboundSigningRefSurvives` 술어·실패 경로
    `fallbackConfig`)을 직접 되짚어 확인했다 — 각 회귀 캐너리 이름(예: *"카드 편집 PATCH 후에도
    inboundSigningRef 가 살아남는다"*, *"server-issued 서명은 PATCH 에서도 재저장된다"*)이
    실제 코드 주석·테스트 제목과 1:1 대응함을 직접 대조. 같은 로직을 두 spec 파일이 중복
    단언하면 다음 사람이 정본을 헷갈린다는 문서상 근거도 타당하다.

- **[INFO]** `buildTriggerCallbackUrl` 순수 함수 단위 테스트는 두껍지만, 연속 슬래시
  (`endpointPath` 가 `//hook-abc` 처럼 선행 슬래시 2개 이상)나 `baseUrl` 자체가 빈 문자열 +
  후행 슬래시가 겹치는 조합은 다루지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.spec.ts` (전체 — 위 조합의
    `it` 블록 부재)
  - 상세: `endpointPath.replace(/^\//, '')` 는 선행 슬래시를 **하나만** 제거하므로
    `endpointPath: '//hook-abc'` 를 넣으면 결과 URL 에 `//hook-abc` 가 그대로 남는다. `Trigger
    .endpointPath` 는 내부적으로 생성되는 값(사용자가 임의로 슬래시 개수를 조작해 넣을 수 있는
    입력이 아닌 것으로 보임)이라 실무 위험은 낮지만, 이 파일이 "분기가 셋이고 셋 다 조용히
    틀릴 수 있다" 는 문제의식으로 만들어진 만큼 경계값 한 줄을 추가하면 그 의도가 더 완결된다.
  - 제안: 급하지 않음 — 후속에 `it('선행 슬래시가 2개 이상이면 하나만 제거한다 (현재 동작 캐너리)')` 류를 추가하는 정도로 충분.

## 회귀 테스트 유효성 확인

- `triggers.service.spec.ts`/`triggers.web-chat.spec.ts` diff 는 `ChatChannelBinderService` provider
  등록(실제 클래스, mock 아님)만 추가했고 `expect` 단언은 한 줄도 바뀌지 않았다 — 이동 전후
  생성자 의존(`Repository<Trigger>`·`ChannelAdapterRegistry`·`ChannelListenerRegistry`·
  `SecretResolverService`·`ConfigService`)이 각 테스트 모듈에 이미 등록돼 있어 새 모듈이 추가
  의존을 요구하지 않음을 grep 으로 확인했다 — 회귀 없이 유효하다.
- `rotateBotToken` 관련 describe(약 1815행)의 `ConfigService` mock 이 2라운드 수정대로
  key-aware(`key === 'app.url' ? … : undefined`)로 바뀌어 있고, `mockAdapter.setupChannel` 호출에
  실린 URL 값(`http://localhost:3000/api/hooks/hook-abc`)까지 단언하는 줄이 실제로 존재함을
  확인했다 — 2라운드 RESOLUTION 의 주장과 현재 코드가 일치한다.

## 테스트 용이성 (설계 관점)

`ChatChannelBinderService` 를 별도 provider 로 뽑아낸 덕에 `teardownChatChannel`/`setupChatChannel`
을 그 자체로 `new` 하여 협력자를 손으로 주입하는 격리 단위 테스트가 가능해졌다(위 WARNING 에서
제안한 보강도 이 구조 덕에 비용이 낮다). `exports` 에 넣지 않아 모듈 밖 오용 경로도 없다 — 테스트
용이성 관점에서 이 리팩터 자체는 개선이다.

## 요약

이 PR 은 두 차례의 선행 `/ai-review` 라운드에서 뮤테이션으로 실증된 테스트 갭(인자 순서·`teardownChatChannel` adapter 미실행·`rotateBotToken` config 키 미검증)을 모두 성실히 닫았고, 이번 회차에서 그 수정들이 실제 코드에 반영돼 있음을 직접 대조로 재확인했다. 다만 같은 성격의 갭이 하나 더 남아 있다 — `TriggersService.remove()` 가 `chatChannelBinder.teardownChatChannel(trigger)` 를 호출한다는 배선 자체는 어떤 테스트도 검증하지 않으며, 그 호출을 통째로 삭제해도 관련 스위트 전체가 GREEN 임을 뮤테이션으로 확인했다. 대칭되는 `setupChatChannel` 호출부(`create()`/`update()`)는 실제 adapter mock 값까지 두껍게 단언하는 반면 `teardownChatChannel` 쪽만 비대칭으로 비어 있다. 이 갭은 리팩터가 새로 만든 것이 아니라 이동 전부터 있던 사전 존재 결함이지만, `ChatChannelBinderService` 가 이제 독립 provider 로 분리되어 이 비대칭을 낮은 비용으로 닫을 수 있는 시점이 됐다. 그 외 나머지는 대체로 견고하다 — 새로 만든 `trigger-callback-url.spec.ts` 는 판별 fixture(둘 다 걸리는 슬래시 조합 등)를 갖춰 뮤테이션 검증을 통과했고, `chat-channel-binder.service.spec.ts` 의 teardown 전용 스코프는 중복 방지 근거가 실측으로 뒷받침된다.

## 위험도

LOW
