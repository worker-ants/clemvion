# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `it.each` fixture 배열이 두 테스트 블록에 바이트 그대로 복제됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3100` (`[A]` 테스트)와 `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3142` (`[등가성]` 테스트)
  - 상세: 두 `it.each([...])` 가 `['botToken', { botToken: '111:New' }, 'telegram']` 로 시작하는 5-tuple 배열을 완전히 동일하게 들고 있다(필드명·payload·provider 전부 동일, 순서도 동일). 두 테스트의 목적(서비스 가드의 `details` 검증 vs `message` 검증)은 다르지만 "어떤 필드를 어떤 provider·payload 로 찌르는가"라는 fixture 자체는 하나의 사실이다. 같은 파일 안의 자매 테스트가 이 상수를 하나의 배열로 공유하지 않으면, 6번째 차단 필드가 추가될 때 한쪽 `it.each` 만 갱신되고 다른 쪽은 그대로 남아도 컴파일도 되고 기존 케이스는 계속 통과한다 — 즉 drift 가 조용히 발생할 수 있다. 이 PR 자체가 "두 층의 메시지가 갈리면 안 된다"는 등가성을 상수화(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)로 강제한 것과 같은 이유로, 이 fixture 도 상수화할 가치가 있다.
  - 제안: `describe` 블록 상단에 `const BLOCKED_FIELD_CASES = [...] as const;` 로 한 번만 선언하고 두 `it.each(BLOCKED_FIELD_CASES)` 가 그것을 참조하도록 통합한다.

- **[INFO]** 동일한 "등가성" 검증을 두 파일이 서로 다른 패턴(for-loop 단일 테스트 vs 중복 `it.each`)으로 구현해 스타일이 갈린다
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` 의 `'[등가성] 차단 5필드의 message 는 공유 상수에서 온다 (D)'` 테스트(약 915번째 줄 부근, `CHAT_CHANNEL_BLOCKED_FIELDS` 를 순회하는 for 루프 + 단일 `toEqual`) vs `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3142` 의 `it.each` 5-tuple 중복
  - 상세: 파이프 쪽은 `CHAT_CHANNEL_BLOCKED_FIELDS` 상수를 순회해 각 필드에 동일 규칙(`'x'.repeat(40)`)으로 값을 채우는 방식으로 DRY 하게 작성됐다. 서비스 쪽은 필드마다 provider·payload 가 달라 동일한 패턴을 그대로 쓸 수는 없지만, 결과적으로 "5필드 등가성"이라는 같은 개념을 검증하는 두 자매 테스트가 서로 다른 구조 관용구를 쓰게 됐다. 기능적 결함은 아니지만 다음에 6번째 필드를 추가하는 사람이 어느 패턴을 따라야 할지 판단해야 하는 비용이 생긴다.
  - 제안: 급하지 않음. 위 WARNING 항목(fixture 통합)만 해결해도 두 서비스 테스트 간 불일치는 없어진다.

- **[INFO]** 동일한 4줄 설명 주석이 e2e 테스트 5곳에 문자 그대로 복제됨
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:187-190`, `:243-246`, `:268-271`, `:344-347`, `:367-370`
  - 상세: "`code` 는 2026-09-11 배선분 — …" 로 시작하는 동일한 주석 블록이 5개의 `it()` 안에 그대로 복사돼 있다. 코드 중복은 아니고 설명 주석의 중복이라 동작에는 영향이 없지만, 이 근거 문구가 나중에 부정확해지거나(예: §5.3 조항 번호가 바뀌거나) 보강이 필요해지면 5곳을 각각 찾아 고쳐야 한다.
  - 제안: `describe('POST /api/triggers — chat-channel multi-provider (e2e)', ...)` 블록 상단에 한 번만 이 배경 설명을 적고, 각 `it()` 자리에는 "위 배경 참조"류의 짧은 앵커만 남기거나, 그대로 둔다면 최소한 첫 등장 위치에만 전체 설명을 두고 나머지는 한 줄 요약으로 줄인다.

- **[INFO]** `'INVALID_FIELD'` 문자열 리터럴이 이번 diff 로 15곳에 새로 반복됨 — 다만 기존 코드베이스 관례와 일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 13곳(예: `:655`, `:662`, `:669`, `:700`, `:707`, `:730`, `:741`, `:794`, `:809`, `:821`, `:830`, `:509`, `:995`), `codebase/backend/src/common/utils/password.util.ts` 2곳(`:66`, `:87`)
  - 상세: `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 로 사람이 읽는 `message` 는 공유 상수화했지만, 기계가 읽는 `code: 'INVALID_FIELD'` 는 여전히 각 자리에 원시 문자열로 박혀 있다. 오탈자(`'INVALID_FEILD'` 등)가 나도 TypeScript 가 잡아주지 못한다. 다만 `common/pipes/validation.pipe.ts` 가 이미 같은 방식(리터럴 타입 `'INVALID_FIELD'`)을 쓰고 있어, 이 diff 가 기존 컨벤션을 그대로 따른 것이지 새로운 이탈은 아니다.
  - 제안: 이번 PR 스코프는 아니지만, 후속으로 `INVALID_FIELD` 를 공유 상수(예: `ERROR_DETAIL_CODES.INVALID_FIELD`)로 뽑아 `validation.pipe.ts`·`password.util.ts`·`triggers.service.ts` 가 함께 참조하게 하면 오탈자 방지 효과를 얻을 수 있다. 이번 PR 을 막을 사유는 아니다.

## 요약

이번 변경은 대부분 기존 `BadRequestException` 페이로드 객체 리터럴에 `code: 'INVALID_FIELD'` 필드를 추가하고, 5개의 중복 메시지 리터럴을 `chat-channel-rejection-messages.const.ts` 공유 상수로 뽑아낸 기계적·국소적 리팩터링이다. 새 상수 파일은 "왜 상수인가(등가성, DRY 아님)"를 분명히 설명하고 `as const satisfies` 로 필드 집합과 메시지 집합의 타입 결속을 강제하는 등 이 코드베이스의 문서화·타입-안전 관례를 잘 따른다. `triggers.service.ts` 의 가드 메서드들은 이미 책임별로 잘게 쪼개져 있어 이번 diff 가 중첩이나 함수 길이 문제를 새로 만들지 않았다. 유일하게 실질적인 개선 여지는 `triggers.service.spec.ts` 에 새로 추가된 두 `it.each` 블록이 동일한 5-tuple fixture 배열을 그대로 복제한 점으로, 이 PR 이 프로덕션 코드 쪽에서 막 정립한 "등가성은 상수 하나로 고정한다"는 원칙을 테스트 코드 쪽에는 적용하지 않은 셈이다. e2e 의 반복 주석과 기존에도 있던 `'INVALID_FIELD'` 리터럴 반복은 경미하며 차단 사유가 아니다.

## 위험도
LOW
