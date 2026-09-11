# 부작용(Side Effect) 코드 리뷰

## 검증 방법

프롬프트의 실제 애플리케이션 코드 변경(파일 1~9)은 두 커밋의 누적 diff다 — `0710021f0`(1차,
`details[].code` 15자리 배선 + `botToken` `@MinLength(1)`)은 이전 라운드
(`review/code/2026/09/11/11_05_27`)에서 이미 side_effect LOW 로 검토됐고, `0fb691248`(2차,
그 라운드의 WARNING 4건 반영)이 이번에 새로 얹힌 부분이다. `git show 0fb691248 -- <file>` 로
2차 커밋만 분리해 대조했고, `nodes/core/error-codes.ts`·`chat-channel-rejection-messages.const.ts`
등 프롬프트에 전문이 없는 자리는 `Read`/`grep` 으로 직접 열어 확인했다. 저장소에 뮤테이션을
가하지 않았다 — `git status --short` 에는 이 리뷰 세션 자신의 출력 디렉터리
(`review/code/2026/09/11/11_33_35/`)만 남아 있다.

파일 10~31(`review/consistency/**`, `review/code/2026/09/11/11_05_27/**`)은 이전 라운드의
consistency-check·code-review 산출물이 이 PR 의 developer 커밋에 함께 실린 것으로, 이 저장소의
워크플로 규약(`--impl-prep`/`--impl-done` 산출물은 `review/**` 에 커밋)에 따른 정상적인 부수
산출물이다 — 런타임 코드가 아니므로 부작용 관점의 별도 발견사항은 없다.

## 발견사항

- **[INFO]** `triggers.service.ts` 의 13개 `details.code` 리터럴이 `ErrorCode.INVALID_FIELD`
  참조로 바뀌면서, 이 파일이 값으로 방출하는 wire 문자열이 이제 **다른 모듈
  (`nodes/core/error-codes.ts`)이 정의하는 공유 상수에 간접 결속**된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:49`(신규 import),
    `:655,662,669,700,707,731,742,795,799,813,817,828,832,840,844,1008,1011`
    (게이트 기준 `code: ErrorCode.INVALID_FIELD` 배선 자리, 프롬프트 파일 8 diff 참조)
  - 상세: 실측 — `ErrorCode.INVALID_FIELD` 값은 `'INVALID_FIELD'` 로
    (`codebase/backend/src/nodes/core/error-codes.ts:116`) 리터럴과 바이트 동일해 **이번
    변경으로 실제 wire 응답값은 바뀌지 않는다.** 또한 `error-codes.ts` 자체는 import 문이
    0개인 순수 상수 파일이라(`grep -n "^import"` 결과 없음) 순환 의존을 새로 만들지도 않는다.
    다만 이 결속은 **행동-거리(action-at-a-distance) 표면을 넓힌다** — 이전에는
    `nodes/core/error-codes.ts` 를 편집해도 `triggers`(chat-channel) 도메인 응답에 영향이
    없었지만, 이 PR 이후에는 그 파일의 `INVALID_FIELD` 값을 바꾸면(예: 다른 소비자
    `modules/execution-engine/workflow-errors.ts` 의 요구로 리네임) `triggers.service.ts` 의
    13개 자리가 **자동으로, 조용히** 따라간다. `common/utils/password.util.ts` 의 동일 의미
    2곳은 의도적으로 리터럴을 유지했으므로(주석·커밋 본문에 근거 명시), 이제 "같은 논리적
    사유(`INVALID_FIELD`)"를 내는 두 파일이 **한쪽은 공유 상수 변경에 따라가고 다른 한쪽은
    안 따라가는** 비대칭 결합 상태가 된다 — 이 PR 이 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`
    로 정확히 막으려 한 "두 층 문면 drift" 와 같은 계열의 위험이 `code` 값 쪽에는 한 겹
    남는다.
  - 제안: 의도된 트레이드오프로 보이며(커밋 본문이 근거를 명시) 즉시 조치가 필요한 결함은
    아니다. 다만 `error-codes.ts` 의 `INVALID_FIELD` 항목에 "이 상수를 바꾸면
    `triggers.service.ts` chat-channel 응답도 함께 바뀐다"는 역참조 주석을 남겨 두면, 다음에
    그 파일을 편집하는 사람이 영향 범위를 놓치지 않는다.

- **[INFO]** `chat-channel-rejection-messages.const.ts` 의 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`
  선언이 `as const` 리터럴 → `Record<ChatChannelBlockedField, string>` 타입 주석으로 바뀌었다 —
  타입 레벨 변경으로 런타임 값·순회 순서·참조 방식은 동일하다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:27-45`
    (게이트 기준, 파일 4 diff)
  - 상세: `CHAT_CHANNEL_BLOCKED_FIELDS` 배열 선언이 메시지 객체보다 **먼저** 오도록 순서가
    바뀌었지만 5개 원소·순서(`botTokenRef, inboundSigningRef, inboundSigning, botToken,
    inboundSigningPlaintext`)는 그대로다. 두 export 를 소비하는 4개 파일
    (`chat-channel-config.dto.ts`, `triggers.service.ts`, `trigger-dto-validation.spec.ts`,
    `triggers.service.spec.ts`) 을 전수 grep 해 property-access(`MESSAGES.field`)와
    배열 순회(`for...of`, `.map`, `.sort()`) 만 쓰고 있음을 확인 — export 재선언 순서에
    의존하는 소비자는 없다.
  - 제안: 없음. 오히려 편도 → 양방향 타입 결속으로 강화된 방향.

- **[INFO]** `triggers.service.spec.ts` 신설 `BLOCKED_FIELD_CASES` 는 `describe` 블록
  스코프의 `as const` 상수이고, 두 `it.each` 가 같은 배열을 읽기 전용으로 참조한다 — 테스트
  간 상태 공유·오염 없음.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`BLOCKED_FIELD_CASES`
    선언부와 신규 `'[A] fixture 가 차단 5필드 전체를 덮는다'` 단언)
  - 상세: 배열 자체나 그 원소(`readonly` 튜플)를 mutate 하는 코드가 없고, 신설된
    exhaustiveness 단언(`BLOCKED_FIELD_CASES.map(...).sort()` vs
    `[...CHAT_CHANNEL_BLOCKED_FIELDS].sort()`)도 순수 비교라 부작용 없음.

- **[INFO]** `CHANGELOG.md` 편집은 순수 문서 추가(파일 상단에 신규 `## Unreleased` 절 삽입)이며
  런타임 코드·설정에 영향 없음.
  - 위치: `CHANGELOG.md:3-45`(게이트 기준, 파일 1 diff)

- **[INFO]** e2e 스펙(`chat-channel-trigger-create.e2e-spec.ts`) 5곳의 반복 주석이 파일 상단
  단일 설명 + 짧은 앵커로 축약됐다 — 주석만 바뀌었고 각 `it()` 의 `expect(...).toEqual(...)`
  단언·기대값은 동일하게 유지된다(2차 커밋 diff 로 직접 대조 확인).
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:1-9`(신규 파일 상단
    주석), `:198,251,276,346,369`(각 자리 축약 주석) — 게이트 기준, 파일 9 diff

## 확인한 항목 (부작용 없음으로 판정, 이전 라운드와 동일 결론 재확인)

- **함수 시그니처**: `validatePasswordStrength`·`TriggersService` 관련 메서드 시그니처 변경 없음
  (2차 커밋도 throw payload 내부 리터럴/참조 교체만).
- **전역 변수**: 신규 전역 mutable state 없음. `CHAT_CHANNEL_BLOCKED_FIELDS`/`_MESSAGES` 는
  module-scope 불변 상수.
- **파일시스템**: 애플리케이션 코드에 파일 I/O 없음. `review/**` 산출물 커밋은 워크플로 규약상
  정상.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 없음. 기존 호출부(`SecretResolver.rotate`, provider 검증) 변경 없음.
- **이벤트/콜백**: 없음.
- **공개 API wire 계약**: `details[].code` additive 확장·`botToken` 빈 문자열 거부는 이전
  라운드에서 이미 검토된 항목이고 이번 2차 커밋은 그 계약값(`'INVALID_FIELD'`)을 바꾸지 않았음을
  실측으로 재확인했다(리터럴 → `ErrorCode.INVALID_FIELD` 치환 전후 값 동일).

## 요약

이번에 새로 얹힌 커밋(`0fb691248`)은 이전 라운드 WARNING 4건(canonical 상수 재사용, 거짓 주석,
fixture 중복, CHANGELOG 누락)을 반영한 정리성 변경으로, 응답 payload 의 실제 wire 값이나 함수
시그니처·전역 상태·파일시스템·환경 변수·네트워크·이벤트 흐름 중 어느 것도 바꾸지 않는다.
`ErrorCode.INVALID_FIELD` 값이 리터럴과 바이트 동일함을 실측했고, 그 상수 파일이 import 를 전혀
갖지 않아 순환 의존도 없다. 유일하게 짚을 만한 것은 `triggers.service.ts` 13곳이 이제
`nodes/core/error-codes.ts` 의 공유 상수에 결속돼, 그 상수를 다른 목적으로 편집하면
chat-channel 응답이 조용히 따라가는 행동-거리 표면이 새로 생긴다는 점이다 — `common/utils/
password.util.ts` 는 의도적으로 리터럴을 유지해 이 결속에서 빠져 있어 두 파일 간 비대칭이
생기지만, 이는 커밋이 스스로 근거를 댄 의도된 트레이드오프이고 실제 동작 회귀는 아니다.
1차 커밋(`0710021f0`)이 도입한 additive 응답 필드 확장·`botToken` 검증 강화는 이전 라운드에서
이미 LOW 로 판정됐고 이번 재검토에서도 새로운 부작용을 추가하지 않았음을 확인했다.

## 위험도

LOW
