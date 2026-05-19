# Architecture Review — send-email array-only 정준화

## 발견사항

### [INFO] SSOT 원칙 준수 — schema/validator/handler 3-layer 정렬 완료
- 위치: `send-email.schema.ts` (`isRecipientsLike`, `isOptionalRecipientSet`, `sendEmailNodeOutputSchema`), `send-email.handler.ts` (`normalizeRecipients`)
- 상세: 이번 변경의 핵심 목적인 "zod ↔ validator 불일치 해소"가 모든 관련 레이어에서 일관되게 적용되었다. `sendEmailNodeConfigSchema`(zod), `validateSendEmailConfig`(imperative validator), `normalizeRecipients`(handler), `sendEmailNodeOutputSchema`(output echo) 네 곳이 동일한 `string[]` 계약을 공유하게 되었으며, 변경 의도가 plan 문서와 코드 주석에 명확히 기술되어 있다.
- 제안: 현행 유지.

### [INFO] 단일 책임 원칙 — schema SSOT 패턴 유지
- 위치: `send-email.schema.ts`
- 상세: `isRecipientsLike`와 `isOptionalRecipientSet`는 파일-private 함수로 노출 범위가 최소화되어 있고, `validateSendEmailConfig`만 export되어 외부 계약을 단순하게 유지한다. `send-email.handler.ts`의 `normalizeRecipients`도 파일-private이다. 스키마 정의, 검증, 정규화 책임이 각 함수 단위로 명확히 분리되어 있다.
- 제안: 현행 유지.

### [INFO] 레이어 책임 분리 — 방어적 `return []` 배치가 적절
- 위치: `send-email.handler.ts`, `normalizeRecipients` 함수
- 상세: standard path(zod parse → validator)에서 이미 배열이 아닌 입력이 reject되므로, handler의 `normalizeRecipients`에 남은 `if (!Array.isArray(value)) return []`는 legacy 데이터 또는 직접 호출 경로에 대한 런타임 안전망이다. 비즈니스 레이어(handler)가 검증 레이어(schema/validator)의 실패를 silently 흡수하지 않고, 빈 배열 → `to.length === 0` 가드 → `throw Error('No valid recipients...')` 로 연결되어 에러가 은폐되지 않는다.
- 제안: 현행 유지. 다만 `EMAIL_NO_RECIPIENTS` 에러 코드를 `throw`가 아닌 `port:'error'` 경로로 이동하는 개선안(plan §종합 개선안 첫 항목)이 이미 후속 follow-up으로 등록되어 있으므로, 해당 시점에 handler 레이어 책임을 한 번 더 정리하면 좋다.

### [WARNING] `isOptionalRecipientSet`의 암묵적 `true` 반환 — 비배열 타입을 "설정됨"으로 분류
- 위치: `send-email.schema.ts`, `isOptionalRecipientSet` 함수 (라인 `return true;`)
- 상세: 현재 로직은 `undefined`/`null`/빈 배열만 "미설정"으로 처리하고, 그 외는 모두 `true`를 반환한다. 이 상태에서 `cc: 42`(숫자)와 같이 완전히 잘못된 타입이 입력되면 `isOptionalRecipientSet`가 `true`를 반환하고 `isRecipientsLike`가 `false`를 반환하여 `cc must be an array of email addresses` 오류 메시지가 출력된다. 이 동작 자체는 올바르지만, `isOptionalRecipientSet`의 반환 의미("값이 명시적으로 설정되었는가")와 "잘못된 타입도 설정된 것으로 간주"하는 암묵적 동작이 코드를 읽을 때 직관에 반한다. 함수명 또는 주석이 이를 명시하지 않으면 향후 유지보수 시 오해를 유발할 수 있다. (기존 주석이 부분적으로 설명하고 있으나 "잘못된 타입 포함"이라는 의도가 묻혀 있다.)
- 제안: 함수 시그니처 주석에 "잘못된 타입(non-array, non-null)도 '설정됨'으로 분류하여 `isRecipientsLike`가 reject하도록 의도된 설계"임을 한 줄 추가한다. 또는 함수명을 `isOptionalRecipientPresent`처럼 "presence check"임을 명시하는 이름으로 바꾸는 것도 고려할 수 있다.

### [INFO] 개방-폐쇄 원칙 — warningRules DSL과 imperative validator의 역할 경계
- 위치: `send-email.schema.ts`, `warningRules` 배열 vs `validateSendEmailConfig`
- 상세: "canvas badge용 경고"(warningRules DSL)와 "런타임 차단 검증"(validateSendEmailConfig) 두 경로가 분리되어 있다. 이번 변경으로 `to`의 empty-array 케이스는 `length(to) == 0` DSL이 처리하고, 배열 원소 검증 및 비-배열 타입 거부는 imperative validator가 담당하는 역할 분리가 더욱 명확해졌다. 새로운 수신자 관련 검증 규칙이 필요할 때 두 레이어 중 어디에 추가할지 판단 기준이 명확하다.
- 제안: 현행 유지.

### [INFO] 순환 의존성 없음
- 위치: `send-email.handler.ts` → `send-email.schema.ts` 단방향 참조
- 상세: handler가 schema를 import하는 단방향 의존이 유지되며, schema는 handler를 참조하지 않는다. 이번 변경으로 handler의 `normalizeRecipients`에서 `string` 분기가 제거되어 handler와 schema 사이의 암묵적 계약 불일치(schema: array-only, handler: string도 처리)도 해소되었다.
- 제안: 현행 유지.

### [INFO] 확장성 — 표현식 지원 방식이 array 구조에 자연스럽게 통합
- 위치: `send-email.handler.spec.ts`, "accepts an array with a single expression template element" 테스트
- 상세: `to: ["{{ $input.recipients }}"]` 패턴으로 표현식이 배열 원소 단위로 들어가는 구조는 향후 "표현식 1개 + 고정 주소 1개" 혼합(`["{{ $input.email }}", "admin@example.com"]`)으로 자연스럽게 확장된다. sum-type이었을 때는 `string`인 경우와 `string[]`인 경우에 표현식 처리 방식이 달라졌을 가능성이 있었으나, array-only로 통일되어 표현식 평가 엔진이 항상 배열을 기대하는 일관된 계약을 가질 수 있다.
- 제안: 현행 유지.

### [INFO] i18n 레이어 동기화 완료
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts`
- 상세: validator 오류 메시지 변경분("non-empty string or array" → "non-empty array")에 대한 한국어 매핑이 `WARNING_KO`에 추가되었다. 프레젠테이션 레이어(i18n)가 비즈니스 레이어(validator) 변경을 동일 commit에서 따라가 동기화 지연이 없다.
- 제안: 현행 유지.

---

## 요약

이번 변경은 `to/cc/bcc` 수신자 필드를 `string | string[]` sum-type에서 `string[]` array-only로 좁히는 breaking 정준화 작업이다. 아키텍처 관점에서 핵심 가치는 **레이어 간 계약 불일치 해소**에 있다: 이전에는 zod parse가 raw `string`을 거부하면서 imperative validator는 허용하는 모순이 존재했고, `normalizeRecipients`가 handler 레이어에서 string을 split하며 비대칭을 보완하는 구조였다. 이번 변경으로 zod schema, imperative validator, output echo schema, handler 정규화 함수가 모두 동일한 array-only 계약을 공유하게 되어 응집도가 높아졌다. `isOptionalRecipientSet`의 "잘못된 타입도 설정됨으로 간주"하는 암묵적 동작이 유일한 경미한 주의사항이나, 기능적으로는 올바르고 주석으로 보완 가능한 수준이다. 전체 구조는 SOLID 원칙과 레이어 책임 분리 측면에서 건전하며, plan 문서와 코드 주석 간의 추적성도 잘 유지되어 있다.

## 위험도

LOW
