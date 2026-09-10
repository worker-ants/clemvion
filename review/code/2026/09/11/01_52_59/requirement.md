# 요구사항(Requirement) 코드 리뷰 — `impl-chat-channel-patch-token` (8라운드)

## 검토 방법

이 changeset 은 이미 7라운드의 리뷰를 거쳐 CRITICAL 0 으로 수렴한 상태다(직전 라운드
`review/code/2026/09/11/01_27_26`). 과거 라운드의 결론을 그대로 재인용하지 않고, 핵심
소스(`chat-channel-config.dto.ts` · `update-trigger.dto.ts` · `triggers.service.ts` 의
`create`/`update`/`assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/
`assertChatChannelAlreadySetUp`/`setupChatChannel`)를 `Read` 로 직접 열어 D-1/D-2/D-3 세
설계 항목이 실제 코드와 일치하는지 재확인했고, `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`
를 직접 열어 "유일한 소비자가 비밀 필드를 안 보낸다"는 CHANGELOG 주장을 재검증했다.
`spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1 본문과 `trigger-dto-validation.spec.ts`
단언을 line-level 로 대조했다. 마지막으로 `npx jest src/modules/triggers`(단일 targeted
실행, 저장소 뮤테이션 없음)로 213 passed / 1 skipped 를 직접 실측했다 — 이전 라운드가
보고한 207~213 수치를 재인용이 아니라 재실행으로 확인했다. 저장소 트리는 건드리지
않았다(`git status --short` — 이 리뷰 세션 출력 디렉터리 외 변경 없음).

## 발견사항

- **[SPEC-DRIFT]** `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1 이 `details.field` 를
  "미확정 — 후속 e2e 확인 대기" placeholder 로 남겨 두고 있는데, 이번 PR 의 구현·테스트가
  이미 그 값을 **두 갈래로 확정**했다.
  - 위치(spec, 미확정 문구): `spec/5-system/15-chat-channel.md:375`, `:392`.
  - 위치(코드, 확정 근거): `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:846`
    (`it('[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일 때** 중첩 경로다', ...)`,
    단언 블록 `:861`-`:867`) + `:822`(`null`/`''` 갈래가 DTO 를 통과함을 고정하는 케이스) +
    `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `assertPatchCarriesNoSecrets`
    (`details: { field: 'botToken' }` 류 flat 단일 object).
  - 상세: 실측 결과는 "비어있지 않은 문자열 → 전역 `CustomValidationPipe` 가 먼저 거부 →
    중첩 경로(`chatChannel.botToken`), `details` 는 배열" / "`null`·`''` → `@IsEmpty()` 통과
    → 서비스 가드가 거부 → flat(`botToken`), `details` 는 단일 object" 두 갈래다. `spec` 문면은
    지금도 두 줄 다 "미확정" 이거나(§5.4.1.1 rotation 행) `details.field='botTokenRef'` 식의
    **캐비아트 없는 flat 확정 서술**(§5.4.1 rotation 행의 앞부분, 내부 3필드)로 남아 있어
    실제 HTTP 응답(중첩 배열)과 line-level 로 어긋난다. 이 갭은 **코드가 틀린 것이 아니라
    spec 이 낡은 쪽**이다 — 구현은 `3-error-handling.md §2.1` 의 "중첩/배열 경로를 유지한다"
    규약을 그대로 따르고 있고, 실측을 통해 그 사실이 confirmed 됐다.
  - 다만 이 갭 자체는 **이미 정확히 식별되고 등재돼 있다** —
    `plan/in-progress/spec-draft-nullable-notation-followups.md:2034`-`:2071` 이 같은 실측표를
    싣고 "남은 것은 planner 의 문면 정정뿐" 이라 명시한다. 대상 spec 문서(`15-chat-channel.md`
    §5.4.1/§5.4.1.1)가 developer 쓰기 권한 밖이라 이번 PR 이 직접 고치지 않은 것은 CLAUDE.md
    역할 경계에 맞는 처신이다. `git blame` 상 "미확정" 문구 자체는 planner PR(`#1311`/`#1313`
    계열)이 쓴 것이라 developer 의 자기-반증형 소정정 예외(조건 1 — "developer 자신이 그
    문서에 썼다")도 적용되지 않는다 — 즉 이 항목은 코드 수정이 아니라 **다음 planner 턴에서
    §5.4.1/§5.4.1.1 의 placeholder·flat 표기를 위 표로 교체**하는 것이 맞는 해소 경로다.
  - 제안: 코드 변경 불요. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    해당 항목이 이미 planner 인계로 열려 있음을 재확인 — 이 리뷰는 그 갭이 여전히 spec 본문에
    남아 있음을 독립적으로 재검증한 결과다. planner 턴에서 `15-chat-channel.md:375,392` 를
    실측표 내용으로 정정할 것.

- **[INFO]** `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` 조건절이 사실상 상수
  참이라 방어 코드로서의 실효는 없다(기능 결함 아님, 기록만).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `assertChatChannelAlreadySetUp`
    본문의 `if (incoming.provider && incoming.provider !== current.provider)`.
  - 상세: `ChatChannelUpdateConfigDto` 는 `OmitType(ChatChannelConfigDto, ['botToken',
    'inboundSigningPlaintext'])` 로 파생되며 `provider` 필드는 여기서 생략되지 않아
    `ChatChannelConfigDto` 의 `@IsString() @IsIn(CHAT_CHANNEL_PROVIDERS)`(옵션 아님, `@IsOptional()`
    없음) 를 그대로 물려받는다. 즉 이 함수에 도달하는 모든 유효 요청에서 `incoming.provider`
    는 항상 truthy 한 문자열이라 `incoming.provider &&` 절은 실행 흐름을 바꾸지 않는다.
  - 제안: 조치 불요 — 해가 없는 방어적 관용구이며, 이 diff 의 범위(D-1/D-2/D-3)와 무관.

- **[확인 완료]** 세 provider(telegram/slack/discord) 모두 `ChatChannelCard` 의 편집-저장
  PATCH 바디가 실제로 비밀 필드를 싣지 않음을 프런트엔드 소스에서 직접 확인 — CHANGELOG.md 의
  "유일하게 알려진 소비자는 영향 없다" 주장과 일치.
  - 위치: `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:346`-`:367`
    (`saveMutation` 의 `patchChatChannel` 객체 리터럴 — `provider`/`uiMapping`/
    `rateLimitPerMinute`/`languageLocale`/`languageHints` 만 포함, `botToken`·
    `inboundSigningPlaintext`·`botTokenRef` 없음).
  - 제안: 조치 불요.

- **[확인 완료]** `assertChatChannelInputSafe` 오버로드 2개 + `mode` 분기가 실제로 생성/PATCH
  경로를 컴파일 타임·런타임 양쪽에서 분리하고 있고, 10-조합 `it.each`(신규 2필드 + 내부
  3필드 × `null`/`''`)가 실제로 통과함을 targeted jest 재실행으로 직접 확인했다(213 passed).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:636`-`:687`
    (`assertChatChannelInputSafe` 오버로드·본문), `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3242`-`:3279`
    (`it.each` 10-조합), `:3286`-`:3300`(provider 전환 차단 케이스).
  - 제안: 조치 불요.

## 요약

핵심 요구사항(R-CC-21 / D-1 "PATCH 는 사용자 비밀을 받지 않는다", D-2 "secret 쓰기 3개 중
사용자 입력 2개만 게이팅", D-3 "`inboundSigningRef` 보존")은 소스 직접 대조와 targeted 테스트
재실행으로 독립 검증했으며 정확히 구현돼 있다. `chatChannel` 최초 부착 차단(`assertChatChannelAlreadySetUp`)·
provider 전환 차단·telegram server-issued 서명의 무조건 재저장(fail-open 방지)도 코드와 테스트가
서로 대칭으로 고정하고 있다. TODO/FIXME/HACK 류 미완성 표식은 이번 diff 파일 전체에서 0건이다.
유일하게 남는 항목은 `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1 의 `details.field`
placeholder 가 이번 PR 이 실측으로 확정한 두 갈래 사실을 아직 반영하지 않은 SPEC-DRIFT 인데,
이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 인계 항목으로
정확히 등재돼 있어 이번 PR 의 코드 변경을 막을 사유가 아니다. 그 외 사전 존재 설계 부채(동시
PATCH lost update, `setupChatChannel` 크기, `botToken` MinLength(1) 부재, `SecretResolver.rotate`
빈 값 가드 부재)는 developer SKILL 수렴 정책에 따라 적절히 후속 등재됐다.

## 위험도

LOW
