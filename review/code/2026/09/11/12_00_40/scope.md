# 변경 범위(Scope) 리뷰

## 검증 방법

`git log --oneline`으로 이번 diff(`origin/main...HEAD`)가 세 커밋으로 구성됨을 확인했다 —
`0710021f0`(A/B/C/D 4건 최초 구현) · `0fb691248`(1라운드 `/ai-review` `11_05_27` WARNING 5건
반영) · `2d0270fbd`(2라운드 `/ai-review` `11_33_35` WARNING 2건 중 W2·I7 반영, W1 은 명시적으로
planner 턴에 위임). `plan/in-progress/impl-details-code-wiring.md`(219줄)를 `cat -n`으로 전문
대조해 "이 PR 의 범위 — 4건" 표(A/B/C/D, E는 후속 PR로 명시 분리)와 1·2라운드 리뷰 처분 표를
기준선으로 삼았다. `git diff origin/main...HEAD --stat`(50개 파일 일치) 및 각 소스 파일의
`git diff origin/main...HEAD -- <file>` 전문을 직접 열어 프롬프트에서 생략/절단된 파일
(`triggers.service.ts`, `triggers.service.spec.ts`, `chat-channel-config.dto.ts`,
`password.util.ts`, `chat-channel-rejection-messages.const.ts`, `CHANGELOG.md`,
`chat-channel-trigger-create.e2e-spec.ts`, 세 번째 커밋 전체)를 실제 라인 단위로 대조했다.
`git status --short`로 저장소 상태를 확인했다 — 이 리뷰가 만든 변경은 없다(기존
`review/code/2026/09/11/12_00_40/`는 이번 세션 자신의 harness 산출물 디렉터리로, 하위에
`_prompts/`·`_retry_state.json`·`meta.json`만 있고 코드 변경은 없다). 저장소 파일을 뮤테이션하지
않았다.

## 발견사항

- **[INFO]** 세 개의 성격이 다른 커밋(신규 구현 A/B/C/D + 1라운드 리뷰 fix + 2라운드 리뷰 fix)이
  `origin/main...HEAD` 범위에 함께 잡힌다.
  - 위치: 커밋 `0710021f0` / `0fb691248` / `2d0270fbd` 전체
  - 상세: 세 번째 커밋(`2d0270fbd`)이 건드리는 파일은 `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`(1곳, `[C]` 테스트의 `toContain`→`toHaveLength(1)`+`toContain` 강화)와 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`/`triggers.en.mdx`(각 1줄, `details.code='INVALID_FIELD'` 문구 추가)뿐이다. 세 곳 모두 직전 리뷰(`review/code/2026/09/11/11_33_35`)의 W2(user_guide_sync WARNING — `chatChannel`/`provider` PATCH 거부 안내에 신규 `code` 필드 누락)와 I7(INFO — 같은 파일 내 `[A]`/`[등가성]`은 `toHaveLength(1)`을 쓰는데 `[C]`만 `toContain`만 써서 엄격도가 갈렸다)에 1:1로 대응하고, 커밋 본문이 그 대응을 명시한다. A/B/C/D 4건 밖의 새 대상을 추가하지 않았다. 같은 라운드의 W1(SPEC-DRIFT, `15-chat-channel.md` 3곳의 "배선 대기" 시제 정정)은 developer 권한 밖(그 문장을 쓴 것은 `#1316` planner 턴이라 자기-반증형 소정정 조건 1 불성립)이라 코드를 고치지 않고 planner 턴에 명시적으로 위임했다 — 커밋 본문에 그 판단 근거가 남아 있다. 정상적인 fix→재리뷰 사이클이며 스코프 이탈이 아니다.
  - 제안: 없음(기록용).

- **[INFO]** `review/code/2026/09/11/{11_05_27,11_33_35}/**`(11+15개 파일)와 `review/consistency/2026/09/11/10_28_52/**`(8개 파일)가 이번 diff에 그대로 포함돼 있다.
  - 위치: 위 세 세션 디렉터리 전체
  - 상세: `CLAUDE.md`가 "코드 리뷰 산출물 → `review/code/**`", "일관성 검토 산출물 → `review/consistency/**`"를 SoT 위치로 명시하고, developer 는 구현 착수 직전 `--impl-prep`을 의무 실행해야 한다. 이 diff는 그 관례대로 두 종류 게이트 세션의 산출물을 코드 수정과 같은 커밋들에 실은 것이며, 앞선 두 라운드(`11_05_27`, `11_33_35`) 자신의 scope.md도 동일한 관측을 하고 동일하게 INFO로 판정했다 — 선례와 일관된 판단이다. 코드 변경과 무관해 보이지만 실은 이번 PR의 게이트 통과 증거물이라 스코프 이탈이 아니다.
  - 제안: 없음 — 프로젝트 워크플로가 요구하는 정상 절차.

## 스코프 안에 있음을 확인한 항목 (기록용)

- `details[].code` 배선(A) — `triggers.service.ts` 13곳(`ErrorCode.INVALID_FIELD` import 참조로 전환) + `password.util.ts` 2곳(리터럴 유지, 계층 경계 근거 주석 포함)으로 plan이 실측한 정확히 15자리와 일치. `rethrowEndpointPathConflict`(기존 도메인 코드 보유)와 `field` 없는 6개 진단 payload는 diff에서 실제로 손대지 않았다.
- `chat-channel-rejection-messages.const.ts`(D, 신규 58줄) — plan이 실측한 정확히 5필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·`inboundSigningPlaintext`)만 다루고, 소비처도 `chat-channel-config.dto.ts`·`triggers.service.ts`·두 spec 파일 4곳으로 `modules/triggers/` 내부에 국한된다 — 그 이상의 리터럴을 흡수하지 않았다.
- `chat-channel-config.dto.ts`의 `@MinLength(1)`(C) — plan이 실측한 정확히 `botToken` 필드에만 적용됐고, 같은 파일의 다른 필드(`inboundSigningPlaintext` 등)는 손대지 않았다. 같은 파일의 `swagger.md:315` 인용 정정(B)도 plan이 사전에 명시한 4건 중 하나다.
- 테스트 파일(`password.util.spec.ts`·`trigger-dto-validation.spec.ts`·`triggers.service.spec.ts`·e2e-spec.ts)의 신규 `it`/`it.each`는 전부 A·C·D를 검증하는 캐너리이고, 무관한 기존 테스트 케이스의 로직 변경이나 삭제는 없다 — 기존 단언 위에 `code`/`toEqual` 강화 또는 공유 상수 참조 치환만 발생했다.
- E(모듈 경계 추출)는 plan이 "이 PR에 넣지 않는다"고 명시했고, `triggers.service.ts` diff 전체를 직접 대조한 결과 함수/클래스 이동은 전혀 없다 — 기존 `throw` 자리의 `message`/`details` 리터럴 치환·추가 줄바꿈만 확인됐다.
- import 추가(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`, `CHAT_CHANNEL_BLOCKED_FIELDS`, `ErrorCode`)는 각 파일에서 실제로 사용되며 미사용 임포트는 없다.
- 설정 파일(`package.json`, `tsconfig*` 등) 변경 없음. `spec/**` 파일 변경도 없음 — plan이 `spec_impact: none`을 선언했고, 발견한 spec drift(W1)조차 developer 권한 밖이라 판단해 코드를 고치지 않고 planner 턴으로 명시적으로 넘겼다(스코프 이탈의 반대 방향).
- 세 번째 커밋의 mdx 수정 2줄(`triggers.mdx:429`, `triggers.en.mdx:418`)은 `details.code='INVALID_FIELD'` 문구만 추가했고, 인접 문장(rotate API 안내 등)은 건드리지 않았다.

## 요약

`origin/main...HEAD` diff(50개 파일, 세 커밋)는 `plan/in-progress/impl-details-code-wiring.md`가 착수 전에 선언한 A(`details[].code` 배선 15자리)·B(`swagger.md` 인용 정정)·C(`botToken` `@MinLength(1)`)·D(거부 메시지 상수화)와, 그 4건에 대한 1·2라운드 `/ai-review`의 WARNING/INFO 후속 반영으로 정확히 구성된다. 직접 `git diff`로 대조한 결과 프롬프트에 없는 숨은 변경이나 반대로 누락된 변경은 없었고, 계획이 사전에 분리한 5번째 항목(모듈 경계 추출 E)이 diff에 섞여 들지 않았음도 확인했다. 세 번째 커밋은 2라운드 리뷰의 WARNING 1건(user_guide_sync, mdx 2줄)과 INFO 1건(테스트 엄격도 통일)만을 정확히 겨냥했고, 같은 라운드의 다른 WARNING(SPEC-DRIFT)은 developer 권한 밖이라 판단해 손대지 않은 점도 스코프 규율의 긍정적 사례다. 리뷰/컨시스턴시 세션 산출물(`review/code/**`, `review/consistency/**`)이 코드와 함께 커밋된 점은 프로젝트 워크플로가 명시적으로 요구하는 정상 절차이므로 문제로 보지 않는다(참고용 INFO로만 기록). 의도 이상의 변경, 무관한 리팩토링, 요청하지 않은 기능 확장, 포맷팅/주석/임포트/설정의 임의 변경은 발견되지 않았다.

## 위험도

NONE
