# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** `isOptionalRecipientSet` 에서 non-array 타입을 `true` 반환하는 경로
  - 위치: `send-email.schema.ts` — `isOptionalRecipientSet` 함수
  - 상세: 현재 구현은 `undefined/null` → `false`, 빈 배열 → `false`, 나머지 → `true` 를 반환한다. 이 "나머지" 범위에는 `'string-value'` 같은 string 타입도 포함된다. 그 결과 `cc: 'b@x.com'` 이 들어오면 `isOptionalRecipientSet` 은 `true` 를 반환하고, 이어서 `isRecipientsLike` 가 `false` 를 반환해 에러가 적절히 발생한다. 따라서 최종 동작은 올바르다. 다만 "사용자가 명시적으로 값을 넣은 것으로 보고" 라는 주석과 의도가 완벽히 정렬되는지 미묘하다 — `cc: 42` 같은 number 타입도 "명시 설정됨" 으로 판정해 `isRecipientsLike` 검증으로 넘긴다. 이 동작 자체는 정확하지만, 향후 함수 재사용 시 오해를 유발할 수 있다.
  - 제안: 주석에 "비-배열 타입도 set 으로 간주해 isRecipientsLike 가 reject 하도록 위임" 이라는 의도를 명시하거나, `Array.isArray(value)` 체크를 추가해 non-array 를 명시적으로 set-but-invalid 경로로 표현 (`return Array.isArray(value) || typeof value !== 'object'` 등). 현재 동작에는 버그 없음.

- **[INFO]** `normalizeRecipients` 의 defensive fallback 과 upstream validate 순서 보장
  - 위치: `send-email.handler.ts` — `normalizeRecipients` 함수 및 `execute` 상단부
  - 상세: 주석에서 "legacy data or direct handler invocation that bypassed schema parsing" 을 safety net 으로 명시한다. `validate()` 는 `handler.validate()` 를 통해 선행 호출되지만, 엔진이 `validate` 실패 시 실제로 `execute` 호출을 막는지는 이 파일 범위 밖의 계약이다. `normalizeRecipients` 가 비-배열에 `[]` 를 반환하면 곧바로 `to.length === 0` throw 가 발생해 호출자에게 예외가 전파된다. `to.length === 0` 의 throw 가 `port:'error'` 가 아닌 미처리 예외(throw)로 남아 있어, 향후 `EMAIL_NO_RECIPIENTS` 를 runtime error 포트로 이동하는 작업(plan 에 이미 P1 후보로 명시됨)이 완료되기 전까지 엔진 레벨의 에러 처리에 의존하게 된다.
  - 제안: 현재 동작에 버그는 없으나, plan 의 `EMAIL_NO_RECIPIENTS` P1 후보 항목을 조기에 처리하면 에러 계약이 더 명확해진다. 현 상태에서는 INFO 수준.

- **[INFO]** `validateSendEmailConfig` 가 `bcc` string reject 케이스에 대한 테스트 미포함
  - 위치: `send-email.schema.spec.ts` — `validateSendEmailConfig` describe 블록
  - 상세: `cc` string reject 는 `'rejects cc when set but is a string (array-only)'` 케이스로 포함되어 있으나, 대응하는 `bcc` string reject 테스트는 `validateSendEmailConfig` describe 블록 안에 없다. `send-email.handler.spec.ts` 안의 `handler.validate` 레벨에서는 `bcc: ''` / `bcc: 'd@x.com'` 케이스가 커버되지만, schema 레벨의 `validateSendEmailConfig` 직접 호출 테스트는 `bcc` string 케이스가 누락되어 있다. 두 레이어의 테스트 대칭성 측면에서 미흡.
  - 제안: `send-email.schema.spec.ts` 의 `validateSendEmailConfig` describe 블록에 `'rejects bcc when set but is a string (array-only)'` 케이스를 `cc` 테스트와 대칭으로 추가.

- **[INFO]** plan 파일 내 spec 예시 JSON 이 구버전 string 형식을 유지
  - 위치: `plan/in-progress/node-output-redesign/send-email.md` — §현재 output (spec 인용) 의 JSON 블록
  - 상세: plan 문서 본문의 spec 인용 JSON 블록(`"to": "{{ $input.email }}"`)이 array-only 정준화 이후에도 구버전 string 형식으로 남아 있다. plan 파일의 "spec 인용" 섹션이 spec 원본과 다른 값을 보여주어 읽는 사람에게 혼란을 줄 수 있다. 동일 문서 하단의 "개선안 — 정리된 output" JSON 의 `"to": <raw>` 는 타입을 추상적으로 표기해 형식 중립적이지만, 상단 "현재 output (spec 인용)" 섹션은 `"to": "{{ $input.email }}"` 을 그대로 인용하고 있다.
  - 제안: spec 인용 JSON 블록의 `"to"` 를 `["{{ $input.email }}"]` 로 갱신해 실제 spec(§5.1 updated)와 정합을 유지. plan 이 역사 기록 목적이기도 하므로, 갱신 시 간단한 각주(예: "(2026-05-19 array-only 정준화 반영)")를 추가하는 방식도 유효.

- **[WARNING]** `warningRules` 주석에 "recipient sum-type validation (string | string[])" 표현 잔류
  - 위치: `send-email.schema.ts` — `sendEmailNodeMetadata.warningRules` 블록 직전 주석
  - 상세: 주석 `// Recipient sum-type validation (string | string[]) lives in validateConfig because the mini-DSL can't model that shape.` 가 array-only 정준화 이후에도 그대로 남아 있다. 코드 자체(`isRecipientsLike`)는 이미 array-only 로 변경되었지만, 이 주석은 구버전 sum-type 설명을 그대로 유지한다. 새 개발자가 주석을 읽으면 sum-type 이 여전히 의도된 동작이라고 오해할 수 있다.
  - 제안: 해당 주석을 `// Recipient array-only validation lives in validateConfig because the mini-DSL's length(to) == 0 rule only catches the empty-array case, not invalid element types.` 로 갱신.

- **[INFO]** `frontend backend-labels.ts` 에 추가된 새 i18n 키가 알파벳 정렬 삽입 위치와 다름
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` — 추가된 3개 키
  - 상세: 추가된 3개 키(`bcc must be...`, `cc must be...`, `to is required...`)는 알파벳 정렬로 봤을 때 "Y-axis field must be entered." 앞에 위치해야 하고, diff 도 그렇게 되어 있다. 다만 `"bcc..."` < `"cc..."` < `"to..."` 는 알파벳 순서에 부합한다. 배치 자체는 정상. 파일의 나머지 부분이 일관된 알파벳 정렬을 유지하는지 확인 필요하나, 변경 범위 자체는 문제 없음.
  - 제안: 정렬 일관성 확인 차원에서 파일 전체가 알파벳 정렬로 유지되는지 lint 규칙이 있다면 확인.

## 요약

이번 변경은 `send-email` 노드의 수신자 필드(`to/cc/bcc`)를 `string | string[]` sum-type 에서 `string[]` array-only 로 일원화한 작업이다. zod schema, imperative validator(`validateSendEmailConfig`), handler(`normalizeRecipients`), output schema, i18n, 테스트까지 6개 레이어가 일관되게 변경되어 있으며, 기능 완전성과 비즈니스 로직 반영 측면에서 전반적으로 양호하다. 핵심 요구사항인 "raw string reject + array accept" 동작은 두 계층(zod + validator) 에서 중복 방어되고 있으며, defensive fallback(`normalizeRecipients` 의 비-배열 → `[]`)과 그에 따른 `to.length === 0` throw 도 안전하게 처리된다. 주요 지적사항은 CRITICAL·HIGH 없이 WARNING 1건(주석 내 구버전 표현 잔류) + INFO 4건 수준으로, 런타임 동작이나 계약 위반 없는 문서·테스트 대칭성 미흡이다.

## 위험도

LOW
