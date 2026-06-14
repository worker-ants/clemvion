# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `FormValidationError.message` 는 client-safe 고정 문자열 — 사용자 입력값 미포함
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `FormValidationError` 클래스 JSDoc
  - 상세: JSDoc 에 "보안: `message` 는 검증 규칙 기반 client-safe 문자열(필드 값 자체는 미포함)"이 명시되어 있다. 실제로 에러 메시지는 '필수 입력 항목입니다.', '올바른 이메일 형식이 아닙니다.' 등 규칙 기반 고정 문자열이며, 사용자가 입력한 원본 값은 포함되지 않는다. 민감 정보 노출 위험 없음.
  - 제안: 현행 유지. 향후 검증 메시지 생성 로직 확장 시에도 이 원칙을 지켜야 한다.

- **[INFO]** `assertFormSubmissionValid` 에서 노드/field 정의 부재 시 검증 skip — 방어적 설계
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` (`if (!nodeExec) return; if (!node) return; if (fields.length === 0) return;`)
  - 상세: 노드/field 정의가 없을 때 검증을 통과(skip)시키는 "fail-open" 설계다. 이는 기존 whitelist-only 동작과의 하위 호환을 위한 방어적 선택이며, `resolveWaitingNodeExecutionId`의 선검증(형식상 실행 ID가 올바른 경우에만 진입)이 악용 경로를 제한한다. 그러나 이론적으로 form 노드가 DB에서 삭제되거나 config 가 손상된 경우 검증 없이 submit 이 통과될 수 있다.
  - 제안: node 부재 시 `warn` 수준 로그 추가를 중장기적으로 검토한다. 당장의 보안 위험은 낮으나 관측성(observability) 개선에 도움이 된다.

- **[INFO]** e2e 테스트 `JWT_SECRET` 환경변수 fallback — 테스트 환경 한정
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` — `mintInteractionToken` 헬퍼(기존 코드)
  - 상세: `mintInteractionToken` 이 `process.env.JWT_SECRET || 'test-secret'` 방식으로 fallback 값을 사용한다면 CI 환경에서 환경변수가 주입되지 않을 경우 `'test-secret'` 이라는 고정 값으로 서명된 토큰이 생성된다. 이는 테스트 전용으로 프로덕션 코드 경로가 아니지만, CI 파이프라인에서 `JWT_SECRET` 이 설정되지 않으면 실제 시크릿 검증을 우회한 채 테스트가 통과될 수 있다.
  - 제안: CI 파이프라인에서 `JWT_SECRET` 환경변수 주입이 보장되는지 확인한다.

- **[INFO]** `coerceFormSubmission` 의 `Object.entries` — prototype pollution 위험 부재 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormSubmission` (`Object.entries(formData as Record<string, unknown>)`)
  - 상세: `formData` 가 `unknown` 타입으로 입력받지만 `typeof formData !== 'object'` 가드 후 `Object.entries` 를 사용한다. `Object.entries` 는 own enumerable properties 만 열거하므로 prototype chain 의 프로퍼티는 포함되지 않는다. JSON.parse 결과물 등 일반적인 요청 페이로드에서는 prototype pollution 위험이 없다.
  - 제안: 현행 유지.

- **[INFO]** `FormValidationError` → HTTP 응답 변환 시 `toHttpDetails()` 메서드 사용으로 정보 노출 범위 통제
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `toHttpDetails()`, `codebase/backend/src/modules/executions/executions.controller.ts` 및 `codebase/backend/src/modules/external-interaction/interaction.service.ts` catch 블록
  - 상세: 에러에서 HTTP 응답 body 로 노출되는 필드가 `toHttpDetails()` 한 곳에서 명시적으로 제한된다(`field`, `message`, `code` 세 필드만). 스택 트레이스, 내부 nodeId, DB 정보 등이 클라이언트에 유출되지 않는다.
  - 제안: 현행 유지.

## 요약

이번 변경은 `submit_form` 커맨드에 서버 측 form field 검증을 추가하는 순수 입력 검증 강화 변경이다. 보안 관점에서 긍정적인 측면이 두드러진다: 검증 실패 메시지는 client-safe 고정 문자열로 사용자 입력 원본을 포함하지 않으며, 에러 응답 body 는 `toHttpDetails()` 를 통해 노출 필드가 명시적으로 제한된다. 하드코딩된 시크릿, 인젝션 취약점, 인가 우회, 안전하지 않은 암호화 등 OWASP Top 10 범주의 취약점은 발견되지 않는다. 유일하게 주의할 점은 fail-open 검증 skip 설계(노드 부재 시 검증 통과)와 e2e 테스트의 `JWT_SECRET` 환경변수 fallback으로, 둘 모두 정보성(INFO) 수준에 그친다.

## 위험도

LOW
