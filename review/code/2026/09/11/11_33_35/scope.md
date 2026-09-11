# 변경 범위(Scope) 리뷰

## 검증 방법

프롬프트에 실린 31개 파일을 `git diff origin/main...HEAD --stat`(31개, 라인 수까지 일치)로
전수 대조했다. 두 커밋으로 구성돼 있다 — `0710021f0`(A/B/C/D 4건 최초 구현)·
`0fb691248`(직전 `/ai-review` `11_05_27` 세션의 WARNING 5건/저비용 INFO 4건을 반영한 후속
수정). `plan/in-progress/impl-details-code-wiring.md`(신규, 198줄)를 `Read`로 전문 대조해
"이 PR 의 범위 — 4건" 표(A/B/C/D, E는 후속 PR로 명시적 분리)를 기준선으로 삼았다.
`triggers.service.spec.ts`(프롬프트에 diff 미포함)·`password.util.ts`·`CHANGELOG.md`·
`chat-channel-rejection-messages.const.ts`·`trigger-dto-validation.spec.ts`·
`chat-channel-trigger-create.e2e-spec.ts` 는 `git show`/`git diff`로 직접 열어 확인했다.
`triggers.service.ts`의 신규 추가 라인 중 `code:`/`ErrorCode`/`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`
패턴에 안 걸리는 라인만 따로 grep해 숨은 변경이 없는지 확인했다 — 남은 것은 객체가 세 줄로
늘어나며 생긴 순수 줄바꿈(`details: {`/`field: '...',`/`}`)뿐이었다. 저장소에 뮤테이션을
가하지 않았다(`git status --short`에는 이 리뷰가 만든 변경 없음 — 기존 세션 산출물
`review/code/2026/09/11/11_33_35/`만 untracked로 존재).

## 발견사항

- **[INFO]** 두 개의 성격이 다른 커밋(신규 구현 A/B/C/D + 직전 리뷰 라운드의 WARNING/INFO
  후속 수정)이 이번 diff 범위(`origin/main...HEAD`)에 함께 잡힌다.
  - 위치: 커밋 `0710021f0`(구현) / `0fb691248`(후속 수정) 전체
  - 상세: `0fb691248`이 건드리는 파일(`password.util.ts`·`chat-channel-rejection-messages.const.ts`·
    `triggers.service.ts`·`triggers.service.spec.ts`·`trigger-dto-validation.spec.ts`·
    `chat-channel-trigger-create.e2e-spec.ts`·`CHANGELOG.md`)은 전부 `0710021f0`이 만든 A/D
    항목의 연장(canonical `ErrorCode` 층 분리 적용, 상수 파일의 잘못된 인용 정정, `it.each`
    fixture 중복 제거 + 집합-커버리지 단언 신설, `Record` 양방향 타입, CHANGELOG 신설)이다 —
    새 항목이나 A/B/C/D 밖의 대상을 추가하지 않았다. `plan/in-progress/impl-details-code-wiring.md`
    자신의 "1라운드 리뷰 처분" 절이 각 수정을 리뷰 지적 항목(W2~W5, I3/I4/I7/I9)에 1:1로
    매핑해 근거를 남겼다. 정상적인 fix→재리뷰 사이클이며 스코프 이탈이 아니다.
  - 제안: 없음(기록용).

- **[INFO]** `review/code/2026/09/11/11_05_27/**`(11개 파일, 직전 code-review 세션 산출물)와
  `review/consistency/2026/09/11/10_28_52/**`(8개 파일, `--impl-prep` consistency-check 세션
  산출물)가 이번 diff에 그대로 포함돼 있다.
  - 위치: `review/code/2026/09/11/11_05_27/*`, `review/consistency/2026/09/11/10_28_52/*`
  - 상세: `CLAUDE.md`가 "코드 리뷰 산출물 → `review/code/**`", "일관성 검토 산출물 →
    `review/consistency/**`"를 SoT 위치로 명시하고, "종결 순서 … 코드 커밋 → 그 뒤 리뷰
    세션 → SUMMARY 기록 → `--impl-done` → 리뷰-only 커밋 → push"를 요구한다. 이 diff는
    그 관례대로 두 세션의 산출물을 코드 수정과 같은 커밋에 실은 것이며, 코드 변경과 무관해
    보이지만 실제로는 이번 PR의 게이트 통과 증거물이다 — 직전 `11_05_27` 라운드의 scope.md
    자신도 동일한 관측을 하고 동일하게 INFO로 판정했다(선례와 일관).
  - 제안: 없음 — 프로젝트 워크플로가 요구하는 정상 절차.

## 스코프 안에 있음을 확인한 항목 (기록용)

- `details[].code` 배선(A) — `triggers.service.ts` 13곳(`ErrorCode.INVALID_FIELD`) +
  `password.util.ts` 2곳(리터럴, 계층 근거 주석 포함)으로 plan이 실측한 15자리와 정확히
  일치. `rethrowEndpointPathConflict`(기존 도메인 코드 보유)와 `field` 없는 6개 진단
  payload는 diff에서 실제로 손대지 않았다.
- `chat-channel-rejection-messages.const.ts`(D) — plan이 실측한 정확히 5필드
  (`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·`inboundSigningPlaintext`)만
  다루고, `CHAT_CHANNEL_BLOCKED_FIELDS`(1차 SoT)+`Record<…, string>`(양방향 타입) 구조로
  귀결됐다 — 최초 `satisfies` 판본의 편도 갭을 후속 수정이 닫은 것도 D의 연장이지 새 항목이
  아니다.
- `chat-channel-config.dto.ts`의 `@MinLength(1)`(C) — plan이 실측한 정확히 `botToken`
  필드에만 적용, `inboundSigningPlaintext` 등 다른 필드는 손대지 않았다. 같은 파일의
  `swagger.md:315` 인용 정정(B)도 plan이 사전에 명시한 4건 중 하나다.
- 테스트 파일(`password.util.spec.ts`·`trigger-dto-validation.spec.ts`·
  `triggers.service.spec.ts`·e2e-spec.ts) 신규 `it`/`it.each`는 전부 A/C/D를 검증하는
  캐너리이며, 기존 테스트 케이스의 로직 변경·삭제는 없다(기존 단언 위에 `code`/`toEqual`
  강화 또는 재사용 상수 참조로 치환만 발생).
- `TriggersService` 모듈 경계 추출(E)은 plan이 "이 PR에 넣지 않는다"고 명시했고, 실제 diff에
  구조적 이동·클래스 분리는 없다 — 순수 리터럴/데코레이터 추가만 확인됐다.
- import 추가(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`, `CHAT_CHANNEL_BLOCKED_FIELDS`,
  `ErrorCode`)는 각 파일에서 실제 사용되고 미사용 임포트는 없다.
- 설정 파일(`package.json`·`tsconfig*` 등) 변경 없음.
- `spec/**` 파일 변경 없음 — `plan/in-progress/impl-details-code-wiring.md`가 스스로
  `spec_impact: none`을 선언했고, spec drift(§5.4.1 등의 "배선 전" 시제)를 발견했음에도
  developer 권한 밖이라 판단해 코드를 고치지 않고 planner 턴으로 명시적으로 넘겼다 — 이는
  스코프 이탈의 반대 방향(권한 밖 확장을 자제한 사례)이다.

## 요약

이번 diff(`origin/main...HEAD`, 31개 파일, 두 커밋)는 `plan/in-progress/impl-details-code-wiring.md`가
착수 전에 선언한 A(`details[].code` 배선 15자리)·B(`swagger.md` 인용 정정)·C(`botToken`
`@MinLength(1)`)·D(거부 메시지 상수화, 이후 `Record` 양방향 타입으로 보강) 4건과 그 4건에 대한
직전 `/ai-review` 라운드(`11_05_27`)의 WARNING/INFO 후속 반영으로 정확히 구성된다.
`git diff --stat`으로 실제 커밋과 대조한 결과 프롬프트에 없는 숨은 변경이나 반대로 누락된
변경은 없었고, 계획이 사전에 분리한 5번째 항목(모듈 경계 추출 E)이 diff에 섞여 들지 않았음도
확인했다. `triggers.service.ts`의 대량 추가 라인 중 `code`/`ErrorCode`/상수 참조 패턴에 안
걸리는 라인은 객체가 여러 줄로 늘어나며 생긴 순수 줄바꿈뿐이었다. 리뷰 세션 산출물
(`review/code/2026/09/11/11_05_27/**`, `review/consistency/2026/09/11/10_28_52/**`)이
코드와 함께 커밋된 점은 프로젝트 워크플로가 명시적으로 요구하는 정상 절차이므로 문제로
보지 않는다(참고용 INFO 2건으로만 기록). 의도 이상의 변경, 무관한 리팩토링, 요청하지 않은
기능 확장, 포맷팅/주석/임포트/설정의 임의 변경은 발견되지 않았다.

## 위험도

NONE
