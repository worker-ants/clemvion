# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `normalizeRecipients` — 비배열 입력에 대한 silent `[]` 반환이 하위 호환 경로를 무음 처리
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts` — `normalizeRecipients` 함수 (구 line 302 영역)
  - 상세: 변경 전 `normalizeRecipients`는 `string` 입력을 콤마로 split하여 유효 주소 배열을 반환했다. 변경 후 `!Array.isArray(value)` 조건에서 즉시 `[]`를 반환한다. 코드 주석이 "legacy data safety net"으로 이 동작을 정당화하고 있으나, 이는 단일 string `to` 를 갖는 기존 DB 레코드(pre-정준화 workflow)가 실행될 경우 수신자 목록이 빈 배열이 되어 곧바로 `to.length === 0` throw 로 이어짐을 의미한다. zod와 validator 양쪽에서 reject하므로 정상 실행 경로에서는 닿지 않지만, **직접 DB 패치로 저장된 구형 레코드나 외부 API 직접 호출** 시 무음 throw 경로가 활성화된다. 플랜 문서(`send-email-to-array-only.md`)에는 "마이그레이션 skip" 결정이 명시되어 있어, 레거시 string 레코드가 DB에 잔존할 경우 런타임 실패가 silent하게 발생하고 원인 식별이 어렵다.
  - 제안: `EMAIL_NO_RECIPIENTS` 에러 코드를 반환하는 `port:'error'` 경로로 이동하는 P1 개선안(plan 문서에 이미 `[ ]` 항목으로 존재)을 우선 처리하거나, 적어도 `normalizeRecipients` 내부에서 비-배열 감지 시 경고 로그를 남겨 레거시 레코드 탐지를 가능하게 할 것. 예: `logger.warn('normalizeRecipients: non-array value detected, legacy record?', { type: typeof value })`.

- **[WARNING]** `sendEmailNodeOutputSchema.config.to/cc/bcc` — 출력 스키마 타입 narrowing이 기존 NodeExecution 레코드 파싱에 영향
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` — `sendEmailNodeOutputSchema` 내 `config.to/cc/bcc` 필드
  - 상세: 변경 전 `z.unknown().optional()`이던 세 필드가 `z.array(z.string()).optional()`로 좁혀졌다. `sendEmailNodeOutputSchema`가 DB에 저장된 과거 실행 로그(NodeExecution)를 **파싱/검증하는 데에도 사용**된다면, string 형태로 기록된 구형 레코드에 대한 `safeParse`가 `success: false`를 반환하게 된다. 이는 실행 이력 조회, 재실행, 또는 output 기반 downstream 처리 로직에서 의도치 않은 validation 실패를 일으킬 수 있다. 반대로 이 스키마가 오직 핸들러의 반환값 shape 검증에만 사용된다면 영향 없음.
  - 제안: `sendEmailNodeOutputSchema`의 사용처(조회/재실행 서비스, execution history API 등)를 확인하여 DB 저장 레코드 파싱에 사용되는지 점검할 것. 이력 파싱용이라면 `config.to`를 `z.union([z.string(), z.array(z.string())]).optional()` 또는 `z.unknown().optional()`로 유지하고, 새 레코드 검증용 스키마를 별도로 분리하는 것을 권장.

- **[WARNING]** `validateSendEmailConfig` 반환 오류 메시지 문자열 변경 — 메시지를 키로 사용하는 소비자에 영향
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` — `validateSendEmailConfig` 함수 내 error push 구문 3곳; `codebase/frontend/src/lib/i18n/backend-labels.ts`
  - 상세: `'to is required and must be a non-empty string or array of email addresses'` → `'to is required and must be a non-empty array of email addresses'` 등 세 메시지가 변경되었다. `backend-labels.ts`에 신규 한국어 번역 엔트리가 추가되어 frontend i18n 경로는 커버되었다. 그러나 이 오류 메시지를 **정확한 문자열로 비교**하는 다른 백엔드 코드(e2e 테스트, 로그 파서, 알림 룰 등)가 존재한다면 누락된 갱신이 된다. 삭제된 구형 메시지(`'to is required and must be a non-empty string or array of email addresses'`)의 구 번역 엔트리가 `backend-labels.ts`에 잔존한다면 dead key가 된다(이번 diff에서 삭제 여부 미확인).
  - 제안: 구형 메시지 문자열을 grep하여 테스트·서비스 코드에 문자열 직접 비교가 있는지 확인. `backend-labels.ts`에서 구형 메시지 번역 엔트리(`'to is required and must be a non-empty string or array of email addresses'`, `'cc must be a string or array of email addresses'`, `'bcc must be a string or array of email addresses'`)가 존재하면 제거할 것.

- **[INFO]** `isOptionalRecipientSet` 로직 변경 — 빈 string `''` 을 "설정됨"으로 판정하는 방향 변경
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` — `isOptionalRecipientSet` 함수
  - 상세: 변경 전에는 `typeof value === 'string'`이면 `value.trim().length > 0`으로 평가하여 빈 문자열 `''`을 "미설정"으로 처리했다. 변경 후 `''`은 `Array.isArray('')` → false, `value === null/undefined` → false를 모두 통과하여 `return true`(설정됨)로 판정된다. 즉 `cc: ''`는 이제 "설정되었지만 잘못된 형식"으로 분류되어 `isRecipientsLike('')` 실패 → `'cc must be an array of email addresses'` 에러를 발생시킨다. 이것은 스펙(array-only 정준화)의 의도된 동작이지만, `''`을 "미설정"으로 전송하던 기존 클라이언트가 있다면 새 validation 오류를 마주치게 된다.
  - 제안: 의도된 breaking change임을 plan 문서에 이미 명시하고 있으므로 추가 조치 불필요. 다만 프론트엔드 `field-array` 위젯이 빈 cc/bcc 필드를 `undefined` 또는 `[]`로 직렬화하는지(정상 경로)를 한 번 확인하여 `''` 직렬화 가능성을 배제할 것.

- **[INFO]** `baseConfig.to` 타입 변경이 테스트 픽스처 공유 컨텍스트에 미치는 영향 (테스트 파일)
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.handler.spec.ts` — `baseConfig` 상수 (line 33-38)
  - 상세: `to: 'recipient@example.com'`에서 `to: ['recipient@example.com']`으로 변경. 이 `baseConfig`가 스프레드(`{ ...baseConfig, ... }`)로 활용되는 모든 테스트 케이스의 전제 조건이 바뀐다. 변경은 올바르고 의도된 것이나, `baseConfig`를 참조하는 테스트가 validate의 string-reject 케이스(`to: 'a@example.com, b@example.com'`)와 혼동되지 않도록 명확히 관리되고 있는지 점검 필요. 현재 diff를 보면 각 케이스가 `to`를 명시적으로 오버라이드하고 있어 문제 없음.
  - 제안: 현 상태 유지 가능. 단, `baseConfig`가 다른 describe 블록에서 암묵적으로 참조된다면 향후 추가되는 테스트가 array 타입을 자동 승계하므로 일관성 측면에서는 긍정적.

### 요약

이번 변경의 핵심 부작용은 두 가지다. 첫째, `normalizeRecipients`에서 string 입력에 대한 silent `[]` 반환이 pre-정준화 레거시 레코드를 조용히 `EMAIL_NO_RECIPIENTS` throw 로 연결하는 경로를 남긴다. 마이그레이션이 skip된 상황에서 레거시 데이터가 DB에 잔존한다면 이 경로가 실제로 활성화될 수 있다. 둘째, `sendEmailNodeOutputSchema.config.to/cc/bcc`의 타입 narrowing(`z.unknown` → `z.array(z.string)`)이 기존 실행 이력 파싱에 사용되는지 여부에 따라 DB 레코드 조회 실패를 일으킬 수 있다. 나머지 변경(오류 메시지 문자열 갱신, `isOptionalRecipientSet` 로직 조정, 테스트 픽스처 갱신)은 스펙에 부합하는 의도된 breaking change로, 적절히 주석과 테스트로 커버되어 있다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 접근, 의도치 않은 네트워크 호출은 발견되지 않았다.

### 위험도

MEDIUM
