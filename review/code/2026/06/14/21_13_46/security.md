# 보안(Security) 리뷰

## 발견사항

### [INFO] 입력 검증 — 필드명 정규식이 경로 탐색·인젝션 차단을 이미 적용
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `extractFormFields`, `FIELD_NAME_RE`
- 상세: `extractFormFields` 내 `FIELD_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/` 정규식이 필드명을 화이트리스트로 필터링한다. 경로 탐색(`../../`), 개행, SQL 특수 문자, HTML 태그 등을 원천 차단하고 있으며 주석에도 이 의도가 명시되어 있다. 이 계층에서 node config 기반의 field 정의를 정규화한 뒤에만 검증이 수행되므로 공격자가 임의 필드명을 주입하는 것은 불가능하다.
- 제안: 현재 구현이 적절하다. 추가 조치 불필요.

### [INFO] 에러 메시지 — 사용자 입력 값 미포함 확인
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `FormValidationError` JSDoc 및 생성자
- 상세: `FormValidationError` 의 `message` 는 `validateFormSubmission` 이 반환하는 고정 한국어 메시지("필수 입력 항목입니다.", "올바른 이메일 형식이 아닙니다." 등)만 사용하며, 사용자가 제출한 실제 필드 값은 절대 포함되지 않는다. JSDoc 블록에도 "보안: message 는 검증 규칙 기반 client-safe 문자열(필드 값 자체는 미포함)"이 명시되어 있다. 이는 정보 노출(OWASP A05) 방지를 올바르게 구현한 것이다.
- 제안: 현재 설계가 적절하다. 향후 새 검증 메시지를 추가할 때 이 원칙(필드 값 미포함)을 유지해야 한다.

### [INFO] `coerceFormSubmission` — 임의 입력 객체를 Record로 캐스팅
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormSubmission`
- 상세: `formData` 가 `unknown` 으로 수신되고 `typeof formData !== 'object'` 검사 후 `Object.entries(formData as Record<string, unknown>)` 로 캐스팅된다. `null` 체크도 선행한다(`!formData`). 배열이 입력되면 인덱스 문자열(`'0'`, `'1'` 등)이 키가 되지만, `extractFormFields` 의 `FIELD_NAME_RE` 를 통과하지 못하므로 검증 대상에서 제외된다. `Object.entries` 는 프로토타입 체인 프로퍼티를 열거하지 않아 프로토타입 오염 위험도 없다.
- 제안: 현재 구현이 안전하다.

### [INFO] SQL 인젝션 — e2e 테스트의 파라미터화 쿼리 확인
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` — 케이스 G
- 상세: e2e 테스트 내 DB 직접 삽입에서 `db.query(sql, [param1, param2, ...])` 파라미터화 패턴을 사용하며 문자열 인터폴레이션으로 SQL을 구성하지 않는다. `formNodeId`, `workflowId`, `executionId`, `randomUUID()` 및 `JSON.stringify(...)` 로 직렬화한 config 값이 모두 파라미터 배열에 바인딩된다. SQL 인젝션 위험 없음.
- 제안: 현재 구현이 안전하다.

### [INFO] 인증/인가 — 신규 검증 로직이 기존 인증 체인 하위에 위치
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 호출 위치
- 상세: `assertFormSubmissionValid` 는 `continueExecution` 내에서 `resolveWaitingNodeExecutionId` 이후에 호출된다. EIA 경로에서는 `InteractionGuard` 가, 내부 executions 경로에서는 기존 인증 미들웨어가 먼저 동작한다. 신규 form 검증은 기존 인증/인가 체계를 우회하거나 변경하지 않는다.
- 제안: 인증 우회 경로 없음.

### [INFO] 검증 실패 시 무제한 재제출 허용 — rate limiting 적용 여부 확인 권장
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 설계
- 상세: 검증 실패 시 `publish` 전에 `FormValidationError` 를 throw 하여 execution 을 `waiting_for_input` 상태로 유지한다. 동일 executionId 에 대해 잘못된 form 데이터를 무제한으로 반복 제출할 수 있으며, 매 요청마다 DB 조회가 2회 발생한다. 이는 이번 변경의 신규 도입 문제는 아니나, 해당 엔드포인트에 `@Throttle` 또는 동등한 rate limiting 이 적용되어 있지 않다면 OWASP A04(Insecure Design) 관점에서 DoS 가능성이 있다.
- 제안: `continueExecution` / EIA `interact` 엔드포인트에 rate limiting 이 이미 적용되어 있는지 확인한다. 미적용 시 throttle 추가를 검토한다(기존 엔드포인트 수준의 문제로 이번 변경 블로커는 아님).

## 요약

이번 변경은 `submit_form` 커맨드에 publisher 측 동기 form field 검증을 추가하고, `FormValidationError` 를 두 진입점에서 `400 VALIDATION_ERROR + details[]` 로 변환하는 구조다. 보안 관점의 핵심 항목들은 모두 안전하게 처리되어 있다. 필드명은 `FIELD_NAME_RE` 화이트리스트 정규식으로 경로 탐색·인젝션을 차단하고, 에러 메시지는 고정 문자열만 사용해 사용자 입력 값이 응답에 노출되지 않으며(OWASP A05 대응 양호), SQL 파라미터는 바인딩 방식으로 처리된다. 인증 우회 경로는 없고 기존 인증 체인 하위에서 검증이 수행된다. 하드코딩된 시크릿, XSS, 커맨드 인젝션, 안전하지 않은 암호화 알고리즘, 알려진 취약점이 있는 의존성 도입 등은 해당 없다. 유일하게 주목할 지점은 검증 실패 시 무제한 재제출을 허용하는 구조에서 엔드포인트 level rate limiting 이 충분히 적용되어 있는지의 확인이며, 이는 기존 엔드포인트의 선제적 점검 사항이고 이번 변경의 신규 취약점 도입은 아니다.

## 위험도

LOW

STATUS: SUCCESS
