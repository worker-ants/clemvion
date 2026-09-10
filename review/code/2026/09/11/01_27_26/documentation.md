# 문서화(Documentation) 코드 리뷰 — `impl-chat-channel-patch-token`

## 개요

이 PR 은 `chatChannel` PATCH 가 사용자 비밀(`botToken`·`inboundSigningPlaintext`)을 받지 못하게
막는 신규 DTO(`ChatChannelUpdateConfigDto`, D-1)와 서비스 레이어 secret 쓰기 게이팅(D-2)을
도입한다. 이미 5라운드의 `/ai-review` + 다회의 `/consistency-check` 를 거쳐 CHANGELOG·Swagger
JSDoc·사용자 가이드(ko/en 8파일)·중앙 트래커(`spec-draft-nullable-notation-followups.md`)가
전부 갱신·정합화된 상태다. `review/code/2026/09/10/23_55_23/user_guide_sync.md` ·
`review/code/2026/09/11/01_10_43/user_guide_sync.md` 가 build-time 가드(`vitest` i18n/parity/
ImplAnchor 268+6378건)까지 직접 실행해 GREEN 을 확인했으므로, 이번 라운드에서는 그 위에서
**아직 보고되지 않은** 두 가지만 새로 발견했다 — 둘 다 이번 diff 가 새로 만든 결함은 아니고,
기존 서술의 잔여 drift 다.

## 발견사항

- **[WARNING]** `SecretResolver.rotate()` 로 실제 구현된 경로를 여전히 `SecretResolver.store()` 라고
  서술하는 JSDoc 이 이번 PR 이 무겁게 편집한 바로 그 두 파일에 **아직 남아 있다** — 트래커가
  같은 결함 클래스를 `spec/**` 9곳에서만 등재하고 `codebase/**` 의 이 2곳을 놓쳤다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:252`
    (`inboundSigningPlaintext` 필드 JSDoc — "입력 후 service 가
    `SecretResolver.store(inboundSigningRef, plaintext)` 로 옮긴 뒤..."),
    `codebase/backend/src/modules/triggers/triggers.service.ts:755`
    (`stripChatChannelPlaintext` JSDoc — "...`SecretResolver.store` 로 옮긴 뒤 ref 만 config 에
    반영.")
  - 상세: `git blame` 확인 결과 두 줄 다 2026-05-24(`f4640ff2d8`) 부터 있던 pre-existing 서술이라
    이번 diff 가 새로 써 넣은 오류는 아니다. 그러나 실측(`grep -rn "secrets\.\(store\|rotate\)"
    codebase/backend/src/modules/triggers/triggers.service.ts`) 결과 이 파일의 secret 쓰기
    호출 8곳이 **전수 `.rotate()`** 이고, 전체 backend 소스에서 `secrets.store(`/
    `SecretResolver.*.store(` 패턴의 실제 호출은 **0건**이다(`SecretResolver.store` 문자열이
    등장하는 곳은 이 두 JSDoc 과 `codebase/backend/src/modules/chat-channel/providers/slack/
    slack.adapter.ts:65` 의 동일 오기 3곳뿐이며 전부 주석/설명문이다). 즉 `store()` 메서드
    자체는 `secret-resolver.service.ts:112` 에 존재하지만 chat-channel 경로는 그것을 호출한
    적이 없다 — 이 PR 이 스스로 발견해 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 등재한 "spec 9곳이 `store()` 라 적는데 실제는 전수 `rotate()`" 항목과 **정확히 같은
    결함 클래스**인데, 그 항목의 대상 목록(`15-chat-channel.md`·`chat-channel-adapter.md`·
    `providers/telegram.md`·`providers/slack.md`)에 이 두 codebase 위치가 빠져 있다. `spec/**`
    는 developer 권한 밖이라 planner 위임이 맞지만, 이 두 곳은 `codebase/**` 라 developer 가
    직접 고칠 수 있는 영역이고 그중 하나(`chat-channel-config.dto.ts`)는 이번 PR 이 바로 위
    (189~197행)와 바로 아래(345행~)를 편집한 파일이다.
  - 제안: 두 JSDoc 의 `store(` 를 `rotate(` 로 정정(사소한 한 단어 수정, 별도 라운드 불필요).
    또는 최소한 위 트래커 항목의 대상 목록에 이 두 codebase 위치(및 `slack.adapter.ts:65`)를
    추가해 후속 정정이 누락되지 않게 한다.

- **[INFO]** 사용자 가이드(mdx)가 `details.field` 를 항상 nested path(`chatChannel.botToken`)로만
  서술해, PATCH 로 `botToken`/`inboundSigningPlaintext` 에 `null` 또는 `''` 를 보내면 실제로는
  flat 이름(`botToken`)이 온다는 이번 PR 자체의 실측 결과를 반영하지 않는다.
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:431` (및 `.en.mdx:420`),
    `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:119`
    (및 `.en.mdx:106`) — "PATCH 본문에 `config.chatChannel.botToken` 을 실으면 400
    `VALIDATION_ERROR` 가 돌아와요 (`details.field='chatChannel.botToken'`)."
  - 상세: 이번 PR 이 신설한 `trigger-dto-validation.spec.ts` 의 `[실측]` 두 케이스가 확정한
    바로는 이 서술이 **비어있지 않은 값**일 때만 참이다 — `null`/`''` 를 보내면 전역 파이프의
    `@IsEmpty()` 를 통과해 서비스 가드가 대신 거부하고 그때 `details.field` 는 **flat**
    `'botToken'`(중첩 아님)이다. 이 갈래 구분은 CHANGELOG(`CHANGELOG.md:52` 표)와 컨트롤러
    Swagger(`triggers.controller.ts` `@ApiBadRequestResponse`)에는 정확히 반영돼 있지만,
    실제 API 통합 담당자가 읽는 mdx 사용자 가이드에는 반영되지 않았다. 어느 문서 정합성 라운드도
    (`23_55_23`·`01_10_43` `user_guide_sync.md` 포함) 이 갈래 자체를 지적하지 않아 신규 발견이다.
  - 제안: 우선순위는 낮다 — 사용자가 명시적으로 `null`/`''` 를 보내는 경로는 흔치 않은 edge case
    이고, 두 문서(CHANGELOG·Swagger)가 이미 기술 사용자를 위한 정본 역할을 한다. 다음에 이 절을
    다시 손댈 때 "값이 없으면(`null`/빈 문자열) `details.field` 는 `botToken`(flat)입니다" 한
    문장을 추가하는 정도로 충분하다. 즉시 차단 사유는 아니다.

## 확인한 것 — 문제 없음 (긍정적 관찰)

- `ChatChannelUpdateConfigDto` 신설 클래스의 JSDoc 이 "무엇을·왜" 뿐 아니라 "왜 이 대안이
  아닌가"(3가지 — `OmitType` 선택 이유, optional-무시 대신 거부를 택한 이유, `Patch` 대신 `Update`
  접두를 쓴 이유)까지 `//` 주석으로 남겨 다음 유지보수자가 재발견 없이 이해할 수 있게 했다
  (`chat-channel-config.dto.ts:363~377`). 그 `//` 선택 자체도 이유가 적혀 있다 — JSDoc 이
  `introspectComments` 플러그인으로 공개 OpenAPI `description` 에 그대로 새는 것을 막기 위해서다
  (`spec/conventions/swagger.md:315` 규약 인용).
- `setupChatChannel` JSDoc 이 세 쓰기 지점(①②③)을 표로 명시하고 "세 번째를 함께 막으면 안 되는
  이유"까지 코드 안에 남긴 것은, 리뷰가 CRITICAL 로 잡았던 인입 웹훅 401 회귀를 다음 사람이
  재도입하지 않도록 막는 실질적 방어다(`triggers.service.ts:1063` 부근).
  `assertChatChannelInputSafe` 를 `mode` 오버로드 2개로 컴파일 타임 결속한 것과 그 이유
  주석("문자열 판별자만 두면 짝 깨짐을 컴파일러가 못 잡는다")도 동일하게 좋은 선택이다.
- `trigger-workflow-ref.e2e-spec.ts` 의 캐너리 docstring 이 "종전에는 판정된 결함을 재현하는
  바디였다 → 지금은 해소됐다" 로 갱신되고 그 근거(리뷰 세션 경로)까지 남아, 캐너리가 왜 그
  형태인지에 대한 서사가 끊기지 않는다.
- CHANGELOG 항목이 "처방이 처음에 왜 위험했는가"(빈 문자열로 토큰이 지워지는 함정)까지 사용자
  관점 서사로 남겨, 단순 변경 로그를 넘어 재발 방지 문서 역할을 겸한다.
- mdx 사용자 가이드 8파일(ko/en × triggers·discord·slack·telegram)이 신설 절 구조·조건·
  `details.field` 표기까지 대칭으로 작성됐고, 이는 이미 다른 리뷰 라운드가 build-time 테스트
  실행으로 직접 검증했다(`vitest` 268+6378건 GREEN).
- API 문서(Swagger `@ApiBadRequestResponse`)가 3가지 400 사유와 `details.field` 형식의 두 갈래
  (배열/nested vs object/flat)를 정확히 서술 — 이번 PR 의 실측을 코드 레벨 정본으로 가장 정확히
  반영한 자리다.
- `spec/**` 로 향하는 모든 `@see`/링크형 참조(`chat-channel-config.dto.ts:190`,
  `triggers.service.ts:66`)의 상대경로를 직접 resolve 해 확인했고, R-CC-21·R-CC-10 앵커도
  실제로 spec 문서에 존재한다 — 깨진 링크 없음.
- 새 환경변수·설정 옵션·외부 의존성 추가 없음(`OmitType` 은 기존 `@nestjs/swagger` export) —
  README/설정 문서 갱신 대상 자체가 없다.
- 발견되지 않은 채 남을 뻔한 spec 문면 drift(`details.field` flat/nested 갈림, `store()`/
  `rotate()` 불일치, 미확정 표기)는 developer 권한 밖이라 전부 중앙 트래커
  (`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 실측치와 함께 정확히
  등재돼 있다 — "예고만 하고 안 지킨" 항목이 없다.

## 요약

이 PR 의 문서화 수준은 이미 다회의 리뷰·정합성 검토 라운드를 거치며 매우 높은 상태로 수렴해
있다 — 신규 코드의 JSDoc·CHANGELOG·API(Swagger) 문서·사용자 가이드(ko/en) 전부 실측에 근거해
정확하고 대칭적으로 갱신됐으며, spec 표기 drift 는 developer 권한 밖이라 트래커에 올바르게
위임돼 있다. 이번 라운드에서 새로 찾은 것은 이 diff 가 만든 결함이 아니라 **이 diff 가 무겁게
편집한 바로 그 두 파일에 남아 있는 pre-existing 주석 오기**(`SecretResolver.store()` → 실제는
`.rotate()`, 트래커가 spec/ 9곳만 잡고 codebase/ 2곳을 놓침, WARNING) 와, 사용자 가이드가
`details.field` 의 edge-case 갈래(값이 `null`/빈 문자열일 때 flat 표기)를 다루지 않는다는
완결성 갭(INFO, 즉시 차단 사유 아님) 두 가지다.

## 위험도

LOW
