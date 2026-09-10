# 테스트(Testing) 코드 리뷰 — `impl-chat-channel-patch-token` (전수 재확인 라운드, `01_27_26`)

## 검증 방법

이 라운드는 4개 타겟 라운드(`23_21_57`→`23_55_23`→`00_21_55`→`00_45_18`)가 이미 핵심 코드
6개 파일(DTO·서비스·컨트롤러·e2e·양쪽 spec)을 반복 검증해 `testing` 자체는 `00_21_55`
LOW→`00_45_18` NONE 으로 수렴한 뒤의 **전수(all-reviewer) 재확인 라운드**다(직전 커밋
`c817a44c4` 이 명시 — 타겟 라운드는 `_summary_is_resolved()` forced 커버리지를 못 채워
push 게이트를 닫지 못했다는 실측 때문에 전수를 한 번 더 돈다).

동일 결함 재보고를 피하려고, 기존 4라운드 `testing.md`(`review/code/2026/09/10/23_21_57`·
`23_55_23`·`review/code/2026/09/11/00_21_55`·`00_45_18`)를 전부 읽고 그 결론이 최신
소스에서 여전히 유효한지를 대조하는 데 집중했다. 그 위에서, 기존 4라운드가 **아직 짚지
않은 축**을 찾으려고 DTO(`chat-channel-config.dto.ts`)·서비스(`triggers.service.ts`)의
`@IsEmpty()` 방어선 5개(`botToken`·`inboundSigningPlaintext`·`botTokenRef`·
`inboundSigningRef`·`inboundSigning`)와 두 spec 파일의 실제 단언 커버리지를 필드 단위로
전수 대조했다.

- 저장소는 뮤테이션 없이 유지했다 — 아래 뮤테이션 검증은 원본을
  `/private/tmp/.../scratchpad/triggers.service.ts.orig` 로 `cp` 해 둔 뒤 실제 파일을 고쳐
  검증하고, 검증 직후 그 백업을 다시 `cp` 로 원복했다(`git checkout`/`restore` 미사용).
  원복 후 `diff <backup> <원본>` 으로 바이트 동일함을, `git status --short`/`git diff --stat`
  로 저장소에 잔여 변경이 없음을 확인했다(둘 다 통과 — 세션 자신의 리뷰 출력 디렉터리
  `review/code/2026/09/11/01_27_26/` 외 untracked/변경 없음).
- 대상 두 spec 파일을 read-only 로 재실행:
  `npx jest src/modules/triggers/dto/trigger-dto-validation.spec.ts src/modules/triggers/triggers.service.spec.ts`
  → **181 passed, 1 skipped, 182 total** — 직전 두 라운드(`00_21_55`·`00_45_18`)와 수치 동일,
  회귀 없음.

## 발견사항

- **[WARNING]** `assertChatChannelInputSafe` 가 무조건(생성·수정 공통) 막는 내부 필드 3개
  (`botTokenRef`·`inboundSigningRef`·`inboundSigning`)는 **`null`/`''` 값에 대해서는 DTO
  층에도 서비스 층에도 테스트가 전혀 없다** — 뮤테이션으로 실제 회귀 무방비를 확인했다.
  - 위치:
    - 테스트 갭 — `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:822`
      (`it('[실측] 값이 null/빈 문자열이면 DTO 를 통과한다 — 거부는 서비스 층이다', ...)` —
      `botToken`·`inboundSigningPlaintext` **두 필드만** null/`''` 로 찌른다)와
      `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3242`
      (`it.each([['botToken', ...], ['inboundSigningPlaintext', ...]])` 4조합 — 역시 같은
      두 필드만).
    - 무방비 코드 — `codebase/backend/src/modules/triggers/triggers.service.ts:650`
      (`if (typeof blocked.botTokenRef !== 'undefined')`), `:658`
      (`if (typeof blocked.inboundSigningRef !== 'undefined')`), `:665`
      (`if (typeof blocked.inboundSigning !== 'undefined')`).
  - 상세: `chat-channel-config.dto.ts` 에서 이 세 필드는 `botToken`/`inboundSigningPlaintext`
    와 **똑같은 `@IsEmpty()` 데코레이터**를 쓴다 — 즉 `null`/`''` 은 전역
    `CustomValidationPipe` 를 그대로 통과해 서비스까지 도달한다(이 사실 자체는 `botToken`
    쪽에서 이미 실측·테스트됐다). 그런데 그 도달 지점을 지키는 세 분기(650/658/665행)는
    `typeof x !== 'undefined'` 라는 **엄격한 형태 검사**를 쓰면서도, 그 엄격함이 실제로
    필요한 이유(=falsy 체크로 완화하면 `null`/`''` 이 새어 나간다)를 검증하는 테스트가
    **하나도 없다**. 이는 이 세션이 반복해서 겪은 "축은 대칭인데 한쪽만 고정한다" 패턴의
    또 다른 사례이고, 대칭축은 이미 같은 파일 안에 존재한다(바로 옆 `assertPatchCarriesNoSecrets`
    의 `botToken`/`inboundSigningPlaintext` 는 3라운드에서 정확히 이 이유로 4조합
    테스트를 받았다 — `RESOLUTION.md` §WARNING 5).
    **직접 뮤테이션으로 확인했다**: `triggers.service.ts:658` 를
    `if (typeof blocked.inboundSigningRef !== 'undefined')` 에서
    `if (blocked.inboundSigningRef)`(falsy 체크)로 바꿔 — `null`/`''` 를 조용히 통과시키는
    회귀를 주입한 뒤 두 spec 파일을 재실행하면 **182개 전부 그대로 GREEN** 이다(RED 0건).
    즉 이 지점이 falsy 체크로 완화되는 회귀가 들어와도 현재 테스트 스위트는 잡지 못한다.
    검증 후 백업에서 `cp` 로 즉시 원복했고 `diff` 로 바이트 동일함을 확인했다.
    - **더 심각한 것은 이 갭이 이미 "닫혔다"고 문서화돼 있다는 점이다.**
      `plan/in-progress/spec-draft-nullable-notation-followups.md:2088-2090` 의
      *"`assertChatChannelInputSafe` 의 세 분기가 dead code 일 수 있다"* 항목이
      2026-09-11 에 *"세 분기는 dead code 가 아니다 — `null`/`''` 갈래에서 실제로 도달한다
      (그 갈래를 고정한 테스트가 ... `triggers.service.spec.ts` 의 두 필드 × 두 값 4조합이다)"*
      로 종결됐는데, 그 4조합이 가리키는 테스트는 실제로는 `botToken`/`inboundSigningPlaintext`
      **두 필드만** 걸었을 뿐 이 항목이 조사하던 **세 필드**(`botTokenRef`·`inboundSigningRef`·
      `inboundSigning`)는 하나도 걸지 않는다(`grep -rn "botTokenRef.*null\|inboundSigningRef.*null"
      codebase/backend/` 결과 0건, 위 뮤테이션으로 재확인). 트래커 자신이 같은 문단에서
      *"다음 사람이 그 자리를 방어선으로 오인하고 파이프 쪽 선언을 지우면 실제 구멍이 열린다"*
      고 정확히 이 위험을 경고해 놓고, 종결 근거로 인용한 테스트는 그 위험을 막지 못한다.
  - 제안: `triggers.service.spec.ts:3242` 의 `it.each` 배열에
    `['botTokenRef', provider, 'null', null]` 류 3필드 × 2값 조합을 추가하거나(생성·수정
    공통 분기이므로 `create()`/`update()` 아무 쪽으로나 호출 가능), 최소한
    `trigger-dto-validation.spec.ts:822` 케이스에 세 필드를 추가해 "DTO 를 통과한다"까지는
    고정한다. 트래커의 2088-2090 항목도 근거 문장을 위 사실대로 재정정할 필요가 있다
    (developer 권한 안 — 자기 자신이 2026-09-11 에 쓴 실측을 실측으로 반증하는 경우다).

## 확인한 것 — 이전 라운드 결론이 최신 소스에서도 유지됨

- **CRITICAL 회귀 방지 3종은 여전히 GREEN**: `inboundSigningRef` fail-open 회귀
  (`triggers.service.spec.ts:3186` `it.each(['slack','discord'])`, telegram 재발급
  `:3216`, `setupChannel` 실패 경로 `:3216` 근방)이 재실행에서 전부 통과했고, 소스 대조로
  `preservedInboundSigningRef`/`inboundSigningRefSurvives` 배선이 변경되지 않았음을
  확인했다.
- **`botToken`/`inboundSigningPlaintext` 축의 null/`''` 비대칭**(`23_55_23` 라운드
  WARNING)은 실제로 대칭 4조합으로 고쳐진 채 유지되고 있다 — 위 새 발견과 대상 필드가
  다르다(이번 라운드는 그 **자매 축**의 갭이다).
- **DTO 비어있지 않은 값 갈래 5필드 전부 커버**(`trigger-dto-validation.spec.ts:846`
  `[실측] 차단 5필드의 details.field 는 비어있지 않은 값일 때 중첩 경로다`)는 실제로 5필드
  모두를 순회하며 `observed` 를 단언한다 — 이 갈래는 과장 없이 정확히 문서화돼 있었다.
  (위 WARNING 은 **그 옆 null/`''` 갈래**가 5필드가 아니라 2필드에 그친다는 것이다.)
- **컴파일 타임 결속**: `assertChatChannelInputSafe` 오버로드(`triggers.service.ts:636-646`)가
  `mode`/DTO 타입을 여전히 묶고 있고, 이전 라운드의 `assertChatChannelAlreadySetUp` 뮤테이션
  검증(첫 분기 제거 → RED)도 코드 변경 없음을 재확인했다.
- **격리**: 신설 `describe('TriggersService — chatChannel PATCH 는 사용자 비밀을 쓰지 않는다
  (R-CC-21)')`(`triggers.service.spec.ts:2928`)의 각 `it` 가 `setup()` 을 호출해 매번 새
  `Test.createTestingModule` 을 만들고, DTO spec 의 `run()` 헬퍼도 매 호출 순수 — 순서
  의존성 없음.
- **carry-over INFO 3건, 여전히 비차단**(재검증만, 재서술 생략): (1) `inboundSigningRef`
  보존이 unit 레벨에서만 검증되고 실제 웹훅 서명검증까지 잇는 e2e 없음, (2)
  `assertChatChannelAlreadySetUp` 의 `incoming.provider` falsy 분기 미검증(HTTP 경로에서는
  DTO 가 `provider` 필수라 실질 도달 불가), (3) `cardBody` fixture 리터럴이
  `trigger-dto-validation.spec.ts`/`triggers.service.spec.ts` 두 곳에 중복.

## 요약

핵심 로직(D-1 비밀 필드 차단·D-2 쓰기 게이팅·D-3 ref 재유도)의 회귀 방지는 4라운드에 걸쳐
촘촘히 검증됐고 이번 라운드 재실행(182/182, 1 skip)도 GREEN 이다. 다만 전수 재확인 과정에서
`assertChatChannelInputSafe` 가 지키는 5개 차단 필드 중 **3개**(`botTokenRef`·
`inboundSigningRef`·`inboundSigning`)는 `null`/`''` 입력에 대한 테스트가 DTO·서비스 어느
층에도 없다는 것을 발견했고, `typeof x !== 'undefined'` → falsy 체크로 완화하는 뮤테이션이
현재 스위트를 전혀 건드리지 않음을 직접 확인했다. 더 문제인 것은 이 정확한 갭을 조사하려던
트래커 항목(`spec-draft-nullable-notation-followups.md:2073-2097`)이 어제 "테스트로 고정
됐다"고 닫았는데, 그 종결 근거로 인용한 테스트가 실제로는 이 세 필드를 하나도 건드리지
않는다는 것이다 — "실측했다"가 측정 범위를 넘어 일반화된, 이 세션이 반복해 온 바로 그
패턴이다. 나머지는 이전 라운드가 이미 비차단으로 분류한 INFO 3건의 재확인뿐이다.

## 위험도

LOW
