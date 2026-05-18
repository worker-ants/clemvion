# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `to/cc/bcc` 필드 타입 변경은 Breaking Change — 기존 클라이언트 영향 미고지
  - 위치: `send-email.schema.ts` diff, `sendEmailNodeConfigSchema` + `sendEmailNodeOutputSchema`
  - 상세: `to/cc/bcc` 의 raw 입력 타입이 `string | string[]` 에서 `string[]` (array-only) 로 축소됨. 이 변경은 기존 workflow DB 에 `to: "a@example.com"` 또는 `to: "a@x.com, b@x.com"` 형태로 저장된 레코드를 가진 클라이언트에게 breaking change 다. plan 문서에 "breaking, 스테이징 단계로 마이그레이션 skip" 이라고 명시되어 있으나, 기존 string 형태 레코드가 실행 시 어떤 경로로 처리되는지 — `normalizeRecipients` 의 `return []` fallback → `EMAIL_NO_RECIPIENTS` 에러 — 가 API 응답 관점에서 소비자에게 명시적으로 문서화되어 있지 않다. 런타임에 기존 워크플로우가 조용히 실패할 수 있다.
  - 제안: (1) 변경 이전 버전의 API 를 사용하는 클라이언트에 deprecation 공지 또는 마이그레이션 가이드를 제공하거나, (2) `normalizeRecipients` 의 fallback 경로(`return []`)가 유발하는 `EMAIL_NO_RECIPIENTS` 에러를 API 오류 응답 스펙에 명시적으로 기재한다.

- **[INFO]** `validateSendEmailConfig` 에러 메시지 변경이 클라이언트-직접 파싱 위험을 수반
  - 위치: `send-email.schema.ts` 241-971행 (diff 기준), `backend-labels.ts` 추가 항목
  - 상세: 에러 메시지가 `"to is required and must be a non-empty string or array of email addresses"` → `"to is required and must be a non-empty array of email addresses"` 로 변경됨. 프론트엔드 `backend-labels.ts` 에 신규 키가 추가되었으나, 이 에러 문자열을 API 응답에서 직접 파싱하는 외부 클라이언트가 있다면 매칭 실패가 발생할 수 있다. 해당 메시지가 API 스펙에 노출되는 구조적 에러 코드(e.g., `code: "EMAIL_NO_RECIPIENTS"`) 가 아닌 자유 텍스트 형태이므로, 클라이언트가 문자열에 의존하면 취약하다.
  - 제안: 에러 응답을 `{ code: string, message: string }` 형태로 구조화하고, `code` 필드에 안정적인 식별자(예: `INVALID_RECIPIENT_FORMAT`)를 부여하여 메시지 텍스트 변경이 하위 호환성을 깨지 않도록 한다.

- **[INFO]** `sendEmailNodeOutputSchema` 의 `config.to` 타입 강화 — 런타임 echo 값과의 정합성 확인 필요
  - 위치: `send-email.schema.ts` `sendEmailNodeOutputSchema` diff (894-899행)
  - 상세: output schema 의 `config.to` 가 `z.unknown()` → `z.array(z.string())` 으로 좁혀짐. 이는 handler 에서 `rawConfig.to` 를 그대로 echo 하는데, `rawConfig` 가 engine 에 의해 평가된 후 `to` 가 string 배열이 아닌 값(예: 표현식 평가 실패로 null 등)을 가질 경우 output schema 검증이 실패할 수 있다. `.passthrough()` 가 적용되어 있어 실제 런타임 reject 는 없으나, 스키마와 실제 데이터 간 불일치가 잠재한다.
  - 제안: output schema 의 `config.to` 에 `.optional()` 과 함께 런타임 실패 케이스(표현식 평가 미완 등)를 포함하는 unit test 를 추가하거나, `z.array(z.string()).or(z.unknown())` 형태로 방어적으로 선언한다.

- **[INFO]** `isOptionalRecipientSet` 의 비-배열·비-null 타입 처리 — API 계약 명확성
  - 위치: `send-email.schema.ts` `isOptionalRecipientSet` 함수 (944-951행)
  - 상세: 개정 후 `isOptionalRecipientSet` 은 `undefined/null` 과 `빈 배열` 만 "미설정" 으로 취급하고 나머지(`string`, `number`, 비-비어있는 배열 등) 는 `true` 를 반환하여 `isRecipientsLike` 검증으로 넘긴다. 이로 인해 `cc: 42` 같은 완전히 잘못된 타입도 "설정됨" 으로 분류 후 `isRecipientsLike` 에서 `false` 반환 → `cc must be an array of email addresses` 에러가 발생한다. 동작은 올바르지만, `isOptionalRecipientSet` 의 의미("설정 여부 판단") 와 실제 동작(타입 무관 any-non-null-non-empty 체크)이 미묘하게 어긋나 있어 API 계약 문서화 관점에서 혼동이 생길 수 있다.
  - 제안: 함수 주석에 "배열이 아닌 비-null 값은 '잘못된 타입으로 설정됨' 으로 간주하고 이후 isRecipientsLike 가 reject 한다" 를 명시한다.

## 요약

이번 변경의 핵심은 `to/cc/bcc` 수신자 필드를 `string | string[]` sum-type 에서 `string[]` array-only 로 좁히는 것으로, zod 레이어와 imperative validator 간의 기존 불일치를 해소한다. API 계약 관점에서 가장 중요한 사항은 **기존 string 형태로 저장된 워크플로우 데이터가 런타임에 `EMAIL_NO_RECIPIENTS` 에러로 조용히 실패**할 수 있다는 점이다. plan 문서에 breaking change 임을 인식하고 마이그레이션을 명시적으로 skip 하기로 결정했음을 기록하였으나, 이 결정이 API 소비자(워크플로우 저장 시스템, 외부 API 클라이언트)에게 어떤 런타임 영향을 주는지는 API 스펙 문서나 에러 코드 수준에서 충분히 드러나 있지 않다. 에러 메시지 문자열 변경도 구조적 에러 코드 없이 자유 텍스트로 노출되는 점은 장기적 하위 호환성 관점에서 개선 여지가 있다. 전반적으로 검증 로직 강화와 두 레이어 정합화는 올바른 방향이나, breaking change 에 대한 API 계약 명시화가 보완되어야 한다.

## 위험도

MEDIUM
