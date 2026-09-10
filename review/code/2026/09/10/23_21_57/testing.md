# 테스트(Testing) 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3)

## 검증 방법

- 대상 diff(파일 1~6)를 정독하고, 실제 소스 파일(`chat-channel-config.dto.ts` 404줄·
  `trigger-dto-validation.spec.ts` 880줄·`triggers.service.ts` 1778줄·
  `triggers.service.spec.ts` 3159줄 등)을 `Read`/`grep` 으로 직접 열어 게이트 줄번호를 대조했다.
- 저장소를 뮤테이션하지 않고, **실제로 테스트를 실행**해 GREEN 을 실측했다(다른 reviewer 오염
  방지를 위해 read-only 명령만 사용):
  - `npx jest src/modules/triggers/dto/trigger-dto-validation.spec.ts src/modules/triggers/triggers.service.spec.ts`
    → `Test Suites: 2 passed / Tests: 171 passed, 1 skipped, 172 total`.
  - `python3 scripts/check-backend-typecheck-ratchet.py` → `OK: backend 타입 진단 197건 / 36파일 —
    baseline 과 일치` (신규 타입 오류 없음 — jest 의 타입 strip 사각지대를 별도로 확인).
- 다른 e2e/unit 스펙 중 이번 DTO 변경(`ChatChannelUpdateConfigDto` 신설)의 영향권에 있는데
  **이번 diff 에서 갱신되지 않은 PATCH 호출**이 남아 있는지 전수 grep 했다
  (`chat-channel-{slack,discord,trigger-create}.e2e-spec.ts`·`triggers.controller.spec.ts`·
  `schedule-trigger.e2e-spec.ts` 등) — PATCH+chatChannel+비밀필드 조합은 없음, 회귀 누락 없음.

## 발견사항

- **[WARNING]** `botToken`/`inboundSigningPlaintext` 에 **명시적 `null`/빈 문자열**을 실은 PATCH가
  어느 계층에서도 테스트되지 않는다 — "이중 방어" 주석이 스스로 지목하는 시나리오다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `assertPatchCarriesNoSecrets`
    (게이트 669~687, `typeof carried.botToken !== 'undefined'` 검사) ·
    `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    `ChatChannelUpdateConfigDto.botToken`/`inboundSigningPlaintext` (`@IsEmpty()`, 게이트 383~403)
  - 상세: `class-validator`의 `@IsEmpty()`는 `undefined`·`null`·`''` 를 전부 "비어 있음"으로
    통과시킨다. 즉 `{ botToken: null }` 또는 `{ botToken: '' }` 를 실은 PATCH 는 **DTO 파이프를
    그대로 통과**하고, 서비스 층의 `typeof carried.botToken !== 'undefined'` 검사가 이를 잡아야
    비로소 400 이 난다(`null`/`''` 모두 `typeof` 가 `'undefined'` 가 아니므로 실제로는 잡힌다).
    새로 추가된 두 테스트 파일(`trigger-dto-validation.spec.ts` 게이트 827~849 의 "[실측] 5필드"
    루프, `triggers.service.spec.ts` 게이트 3057~3097 의 "botToken 이 실리면 400" 류)은 모두
    **비어 있지 않은 문자열 값**(`'x'.repeat(40)`, `'111:New'`, `'a'.repeat(32)`)만 입력으로
    쓴다 — DTO 레벨의 `@IsEmpty()` 가 절대 안 걸리는 입력만 시험한 것이다. 코드 주석이
    "서비스는 컨트롤러 밖에서도 호출될 수 있고 spec 의 VALIDATION_ERROR 봉투 형식을 서비스
    층에서도 보장한다" 고 명시적으로 근거를 대는 바로 그 이중 방어 지점인데, **그 지점만
    골라서 시험하는 케이스가 없다.** 회귀가 나면(예: 서비스 검사를 `!!carried.botToken` 처럼
    바꿔 `null`/`''` 를 놓치는 실수) 두 테스트 파일 다 GREEN 을 유지한 채 통과한다.
  - 제안: `trigger-dto-validation.spec.ts` 의 "[실측]" 케이스나 `triggers.service.spec.ts` 의
    "botToken 이 실리면 400" 케이스에 `botToken: null` / `botToken: ''` 변형을 최소 1개씩
    추가해, DTO 레이어가 놓치는 값을 서비스 레이어가 실제로 잡는지 직접 고정한다.

- **[INFO]** `chatChannel` 최초 setup 이 실패해 `degraded` 로 멈춘 트리거의 "복구 경로"가
  테스트로 고정돼 있지 않다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`
    `assertChatChannelAlreadySetUp` (게이트 689~706, `if (current?.provider) return;` 만으로
    "이미 설정됨" 판정)
  - 상세: 이 게이트는 `config.chatChannel.provider` 존재 여부만 보고 "설정됨"으로 판정한다.
    그런데 provider 는 있지만 `botTokenRef`/`inboundSigningRef` 가 비어 있는(예: 최초 POST 에서
    `setupChatChannel` 이 도중에 실패해 `chatChannelHealth=degraded` 로 남은) 트리거는 이 게이트를
    통과해 PATCH 를 받아들이고, 그 뒤 `setupChatChannel(..., {storeUserSuppliedSecrets:false})`
    이 호출된다. telegram 이면 server-issued 서명이 다시 발급돼 스스로 복구될 수 있지만,
    bot token 자체가 한 번도 저장된 적 없는 상태라면 이후 어댑터가 secret store 에서 토큰을
    못 찾는 실패가 반복될 개연성이 있다 — 이 경계 상태(부분 setup 후 degraded)를 검증하는
    테스트가 diff 어디에도 없다. `existing()` 헬퍼(`triggers.service.spec.ts` 게이트 2938~2953)는
    항상 `botTokenRef`·`inboundSigningRef` 가 둘 다 채워진 "완전히 setup 된" 트리거만 만든다.
  - 제안: 필수는 아니나, `config.chatChannel = { provider }` 만 있고 `botTokenRef` 가 없는
    "부분 setup" 트리거에 PATCH 를 보냈을 때의 기대 동작(성공/실패/degraded 유지)을 한 케이스로
    문서화하면 이 경계가 의도인지 우연인지 다음 사람이 재추정하지 않아도 된다.

- **[INFO]** plan 체크리스트의 "TEST WORKFLOW" 항목이 diff 스냅샷 시점 기준 미체크 상태
  - 위치: `plan/in-progress/impl-chat-channel-patch-token.md` 게이트 94
    (`- [ ] TEST WORKFLOW (lint · unit · build · e2e)`)
  - 상세: 코드 자체의 결함은 아니다 — 이 리뷰에서 실제로 `trigger-dto-validation.spec.ts` +
    `triggers.service.spec.ts` 를 직접 실행해 171/172 GREEN(1 skip)과 backend 타입체크 ratchet
    baseline 일치를 실측했다. 다만 plan 문서상 이 단계가 아직 "수행됨"으로 표시되지 않았으므로,
    체크리스트 갱신 시점에 실제 통과 결과를 반영해야 한다(메모리 관례 —
    "수행 후에만 체크").

## 확인된 것 — 우려했으나 문제 없음

- **`OmitType` + 재선언 필드 검증**: `ChatChannelUpdateConfigDto` 가 `botToken`/
  `inboundSigningPlaintext` 를 `OmitType` 으로 제거한 뒤 `@IsEmpty()` 로 재선언한 것이
  실제로 부모의 `@IsString()` 필수 제약과 충돌 없이 동작하는지는, "카드 편집 바디가
  통과한다"(`trigger-dto-validation.spec.ts` 게이트 792~797, 3-provider `it.each`)가 **실제
  `CustomValidationPipe` 를 통과시켜** 직접 실측한다 — mock 이 아니라 진짜 클래스 메타데이터
  동작을 검증하는 점이 좋다.
- **`details.field` 중첩 경로 실측**(게이트 827~849)도 가정이 아니라 5필드 전부를 실제로
  파이프에 태워 관측값을 `toEqual` 로 고정한다 — "아마 이럴 것" 대신 "실측이 이렇다"를
  테스트에 남긴 좋은 사례.
- **회귀 테스트 이관**: `triggers.service.spec.ts` 의 기존 10개 케이스(SUMMARY#12)를
  `service.update()` 에서 `service.create()` 로 옮긴 것(게이트 1252~1263 `createWithChannel`)은
  PATCH 가 더 이상 비밀을 받지 않는 이번 변경과 정확히 정합한다 — PATCH 전용 계약은 별도
  suite(게이트 2928~3159)가 새로 커버하므로 커버리지 손실이 없다. `triggerRepo.findOne` mock 이
  이 suite 에서 죽은 설정처럼 보였으나, `create()` 내부의 setup-후 재조회(`triggers.service.ts`
  게이트 471~475)가 실제로 소비하므로 유효하다.
- **비대칭 3-쓰기 회귀 캐너리**: "telegram — server-issued 서명은 PATCH 에서도 재저장된다"
  (게이트 3038~3054)는 `storeUserSuppliedSecrets:false` 상황에서도 telegram 의 server-issued
  서명 rotate 가 **무조건** 호출되는지 적극적으로 단언한다 — 이 축을 실수로 같이 게이팅하면
  즉시 RED 가 나는 구조라 매우 적절한 회귀 방지 설계다.
- **이중 방어 테스트 분리**: DTO 파이프 레벨(`trigger-dto-validation.spec.ts`)과 서비스
  직접호출 레벨(`triggers.service.spec.ts` 게이트 3057~3097, `service.update()` 를 컨트롤러
  경유 없이 직접 호출)을 나눠 각각 검증한 것은 "서비스가 컨트롤러 밖에서도 호출될 수 있다"는
  설계 근거를 실제로 입증하는 좋은 테스트 용이성 사례다.
- **e2e 캐너리 갱신**(`trigger-workflow-ref.e2e-spec.ts` 게이트 237~261): PATCH 바디에서
  `botToken` 을 제거하고 200 을 기대하도록 갱신됐고, 이 파일이 원래 고정하려던 축
  (`workflow` 관계 재조회 분기)은 그대로 유지된다 — DTO 변경으로 인한 캐너리 stale 화가 없다.
  다른 e2e 파일(`chat-channel-{slack,discord,trigger-create}.e2e-spec.ts`) 은 애초에 PATCH 로
  chatChannel 비밀을 보내지 않으므로 갱신 누락도 없다(grep 전수 확인).

## 요약

전반적으로 테스트 설계 품질이 높다 — 실제 `CustomValidationPipe` 를 통해 관측값(중첩 경로)을
가정 없이 실측하고, 비대칭 3-쓰기 지점 중 위험한 축(telegram server-issued rotate)을 명시적으로
회귀 캐너리로 고정했으며, DTO·서비스 이중 방어를 각각 독립적으로 시험한다. 기존 10개 케이스도
PATCH→POST 로 정확한 진입점 재조준을 거쳐 커버리지 손실 없이 이관됐다. 직접 실행한 결과
171/172 GREEN(1 skip)·타입체크 ratchet baseline 일치로 vacuous 테스트 의심도 없다. 다만 서비스
층 이중 방어가 스스로 근거로 대는 "DTO 가 놓칠 수 있는 값"(명시적 `null`/빈 문자열)에 대한
전용 테스트가 빠져 있어 그 방어선 자체의 유효성이 아직 실측되지 않았고, degraded 상태에서의
PATCH 복구 경계도 문서화되지 않았다 — 둘 다 즉시 차단 사유는 아니지만 다음 회귀 창구가 될 수
있는 지점이다.

## 위험도

LOW

## 부기 — 리뷰 도중 관측된 저장소 변경 (내가 만든 변경 아님)

본 리뷰 작성 도중 `git status --short` 확인 결과 `plan/in-progress/impl-chat-channel-patch-token.md`
가 **본 세션이 건드리지 않았음에도** 워킹트리에서 수정된 상태로 관측됐다(병렬로 진행 중인 다른
프로세스의 작업으로 추정 — 본 리뷰는 저장소에 어떤 파일도 쓰지 않았고 `git status --short` 는
읽기 전용 명령이다). diff 내용은 위 "TEST WORKFLOW"·"타입체크 ratchet 2종" 두 체크리스트 항목을
`[ ]` → `[x]` 로 바꾸며 "unit PASS(backend 9,536 / frontend 6,379) · e2e PASS 305 · 타입체크
ratchet 2종 baseline 일치"를 기록한 것이다. 이는 본 리포트의 INFO 항목("TEST WORKFLOW 체크박스
미체크")이 리뷰 스냅샷 시점 이후 해소됐을 수 있음을 뜻한다 — 다만 이 변경은 이 리뷰가 검증한
것이 아니므로 그 PASS 수치 자체는 별도로 재확인이 필요하다. 이 상태를 조용히 넘기지 않고 그대로
기록만 남긴다(원복 시도하지 않음 — 내가 만든 변경이 아니고 되돌리면 다른 세션의 정당한 작업을
지우게 된다).
