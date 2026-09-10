# 테스트(Testing) 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3) + CRITICAL fix-round

## 검증 방법

- 대상 diff(파일 1~7: DTO·서비스·컨트롤러·e2e·양쪽 spec 파일)를 실제 소스로 열어 게이트 줄번호를
  대조했다. `triggers.service.ts`/`triggers.service.spec.ts` 는 프롬프트에서 diff 가 생략돼
  `git diff origin/main -- <path>` 로 직접 받아 확인했다.
- 저장소를 뮤테이션하지 않고 실제로 테스트를 실행했다(read-only):
  `npx jest src/modules/triggers/dto/trigger-dto-validation.spec.ts src/modules/triggers/triggers.service.spec.ts`
  → `Test Suites: 2 passed / Tests: 179 passed, 1 skipped, 180 total`. 이전 라운드(`23_21_57`
  testing.md)가 실측한 171/172 대비, 이번 라운드에서 추가된 CRITICAL(#1) 회귀 캐너리(대칭
  `inboundSigningRef` 보존 3건 등)가 반영돼 총 케이스가 늘었고 전부 GREEN이다.
- 이전 라운드(`23_21_57`)의 WARNING(“botToken/inboundSigningPlaintext 의 null/빈 문자열 미검증”)이
  이번 라운드에서 실제로 테스트가 추가됐는지 diff 로 대조했다.
- `git status --short` 로 리뷰 중 저장소에 어떤 변경도 만들지 않았음을 확인했다(untracked 항목은
  이 리뷰 세션 자신의 산출물 디렉터리와 병행 진행 중인 consistency-check 세션 산출물뿐).

## 발견사항

- **[WARNING]** 이전 라운드가 지적한 "`@IsEmpty()`가 통과시키는 null/빈 문자열" 테스트가
  `botToken`에는 **두 값 다**(`null`, `''`) 추가됐지만 `inboundSigningPlaintext`에는 **빈 문자열
  하나만** 추가돼, 자매 필드 사이에 비대칭이 남았다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3234`(`it.each(['null', null], ['빈 문자열', ''])('botToken: %s 도 서비스가 400 으로 잡는다', ...)`) vs
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3250`(`it("inboundSigningPlaintext: '' 도 서비스가 400 으로 잡는다", ...)` — `null` 케이스 없음).
  - 상세: 두 필드를 막는 서비스 가드는 동일한 코드 형태다 —
    `assertPatchCarriesNoSecrets`(`codebase/backend/src/modules/triggers/triggers.service.ts`)의
    `typeof carried.botToken !== 'undefined'` 와 `typeof carried.inboundSigningPlaintext !== 'undefined'`.
    `null`이 `botToken`에서만 실측됐고 `inboundSigningPlaintext`에서는 실측되지 않았으므로, 만약
    누군가 `inboundSigningPlaintext` 쪽 검사만 `if (carried.inboundSigningPlaintext)` 처럼(즉
    falsy 체크로) 바꿔 `null`을 놓치는 회귀를 내더라도 두 spec 파일 모두 GREEN을 유지한다. 이
    프로젝트가 반복적으로 겪은 "축은 대칭인데 한쪽만 고정한다" 패턴과 정확히 같은 모양이며, 실제로
    이번 PR의 CRITICAL #1(`inboundSigningRef` fail-open)도 같은 클래스의 결함이었다(RESOLUTION.md
    §CRITICAL #1 "이 세션이 이미 네 번 반복한 …의 다섯 번째"). 심각도는 낮다 — 두 필드의 실제 방어
    코드가 이미 같은 패턴이라 실질적으로 뚫릴 가능성은 작지만, "테스트가 실제로 무엇을 가르는지"
    관점에서 보면 이 축의 회귀는 두 spec 파일 다 놓친다.
  - 제안: `inboundSigningPlaintext`에도 `null` 케이스 1건을 추가해 `botToken`과 대칭을 맞춘다
    (`it.each`로 두 필드·두 값 4콤보를 한 번에 묶어도 됨).

- **[INFO]** CRITICAL #1(`inboundSigningRef` PATCH 후 소실 → 인입 서명 fail-open)의 회귀 방지가
  **두 개의 서로 다른 unit 레벨 spec 파일**(서비스 층 `TriggersService`, 인증 층
  `ChatChannelInboundAuthenticator`)에 나뉘어 있고, 이 둘을 실제 HTTP PATCH → 실제 웹훅 서명
  검증까지 잇는 e2e/통합 테스트는 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
    (`it.each(['slack','discord'])('%s — 카드 편집 PATCH 후에도 inboundSigningRef 가 살아남는다 …')`,
    `persistedChannel()?.inboundSigningRef` 단언) vs
    `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.spec.ts`
    (`inboundSigningRef` 부재 시 skip/fail-open 단언) — 이번 diff 에 포함되지 않은 기존 파일.
  - 상세: 두 테스트가 같은 필드명(`inboundSigningRef`)을 참조하도록 확인은 했으나(grep 대조),
    "PATCH 로 저장된 config 가 실제로 authenticator 가 읽는 그 config다"라는 배선 자체를 한 테스트가
    끝에서 끝까지 검증하지는 않는다 — 필드명이 어느 한쪽에서 리네이밍되면(`config.chatChannel`
    구조 변경 등) 두 spec 다 GREEN을 유지한 채 실제 배선만 끊어질 수 있다. 이번 PR의 CRITICAL #1 도
    바로 이 "쓰기 지점"에서 발생했었다는 점에서, 이 결합 지점을 커버하는 e2e(실제 PATCH 후 잘못된
    서명으로 웹훅을 보내 401을 확인)가 있으면 더 강한 보장이 된다.
  - 제안: 필수는 아님(차단 사유 아님) — 다음에 `chat-channel-slack.e2e-spec.ts` 류에 "PATCH 후
    inboundSigningRef 가 실제로 서명 검증에 쓰이는지" 케이스 하나를 추가하는 것을 고려.

- **[INFO]** `assertChatChannelAlreadySetUp`의 provider 전환 가드(`incoming.provider &&
  incoming.provider !== current.provider`)가 `incoming.provider`가 falsy인 경우를 테스트하지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:728`.
  - 상세: 이 서비스 메서드는 코드 주석대로 "컨트롤러 밖에서 직접 호출되는 경로"까지 겨냥한
    이중 방어다. 그런데 `incoming.provider`가 비어 있으면(직접 호출 시 가능) 이 가드는 **아무
    예외도 던지지 않고 통과**시킨다 — 이후 `mergeExternalConfig`가 `config.chatChannel`을 통째로
    교체하므로 `provider` 필드 자체가 사라질 수 있다. HTTP 경로에서는
    `ChatChannelUpdateConfigDto.provider`가 여전히 필수(`OmitType`이 `provider`를 건드리지
    않음, `chat-channel-config.dto.ts:172`)라 도달 불가능하지만, 서비스 메서드가 스스로 "컨트롤러
    밖 호출을 방어한다"고 주장하는 지점에서 이 특정 분기는 실제로 그 주장을 검증하는 테스트가 없다.
  - 제안: 우선순위 낮음 — 필요 시 `provider` 필드를 생략한 `chatChannel` 객체로
    `assertChatChannelAlreadySetUp`(또는 `service.update`)을 직접 호출해 현재 provider 가 유지되는지/
    거부되는지 문서화하는 테스트 1건 추가를 고려.

## 확인된 것 — 우려했으나 문제 없음 / 이전 라운드 대비 개선 확인

- **이전 WARNING(null/'' 미검증)의 실질 조치 확인**: `botToken`에 대해서는 `null`·`''` 두 값 다
  테스트가 추가됐고(`triggers.service.spec.ts:3227-3247`), 실제 실행 결과도 GREEN이다 —
  RESOLUTION.md가 "둘 다 즉시 GREEN — 방어선은 있었고 관측만 없었다"고 적은 것과 일치한다(실제
  재실행으로 재확인).
- **CRITICAL #1 회귀 캐너리의 설계가 견고**: `botTokenRef`만 걸었던 종전 D-3 캐너리가 놓쳤던
  자매 축(`inboundSigningRef`)을 이번 라운드에서 `it.each(['slack','discord'])`로 대칭 보강했고,
  telegram의 server-issued 재발급 경로·`setupChannel` 실패(degraded) 경로까지 별도 케이스로
  분리해 3가지 시나리오(정상/telegram 재발급/실패 fallback) 전부에서 `inboundSigningRef` 보존을
  단언한다 — 뮤테이션(보존 항 제거) 검증까지 RESOLUTION.md에 기록돼 있어 vacuous 의심이 낮다.
- **create→update 재조준이 여전히 유효**: 기존 SUMMARY#12 10개 케이스가 `service.create()`로
  이관된 것은 이전 라운드가 이미 검증했고, 이번 라운드에서 재실행해도 회귀 없이 GREEN이다.
- **격리**: 서비스 spec의 각 `it`가 `setup()`을 통해 매번 새 `Test.createTestingModule`을
  생성해 mock 상태가 테스트 간 누수되지 않는다. DTO spec도 `run()` 헬퍼가 매 호출마다 순수하게
  파이프를 통과시키는 구조라 순서 의존성이 없다.
- **가독성**: 테스트명·주석이 "왜 이 케이스가 필요한가"(D-1/D-2/D-3, 어느 CRITICAL을 고정하는지)를
  명시적으로 밝혀 회귀 캐너리로서의 의도 전달이 우수하다.

## 요약

이전 라운드(`23_21_57`)가 지적한 핵심 WARNING(null/빈 문자열 미검증)과 이 리뷰 라운드 자체가
새로 만든 CRITICAL(`inboundSigningRef` fail-open)은 둘 다 테스트로 실측·고정됐고, 실제 재실행
결과도 180개 전부 GREEN(1 skip)으로 회귀가 없다. 다만 그 fix 과정에서 `botToken`엔 `null`·`''`
두 값을, 자매 필드 `inboundSigningPlaintext`엔 `''` 하나만 추가해 대칭이 깨졌다 — 이 프로젝트가
반복적으로 겪어 온 "축은 대칭인데 한쪽만 고정" 패턴과 형태가 같아 WARNING으로 기록한다. 그 외
CRITICAL 보안 수정(PATCH 후 인입 서명 fail-open)이 두 개의 분리된 unit spec으로만 커버되고 실제
HTTP→서명검증까지 잇는 e2e가 없는 점, provider 가드의 falsy 분기 미검증은 차단 사유가 아닌 INFO
로 남긴다.

## 위험도

LOW
