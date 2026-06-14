### 발견사항

- **[INFO]** FormValidationError 에러 메시지가 client-safe 설계로 올바르게 구현됨
  - 위치: `workflow-errors.ts` FormValidationError 클래스
  - 상세: `message` 는 검증 규칙 기반 고정 문자열로, 실제 사용자 입력값이 포함되지 않는다는 JSDoc 명시가 있음. 이는 올바른 설계임.
  - 제안: 현행 유지.

- **[INFO]** error.message 가 FormValidationError 에서 EIA 응답의 `message` 와 `details[].message` 양쪽에 동일하게 노출됨
  - 위치: `executions.controller.ts` continueExecution catch 블록, `interaction.service.ts` dispatchContinuation catch 블록
  - 상세: `details[].message` 에 `error.message` 를 그대로 재사용. `message` 가 client-safe 고정 문자열이라는 설계 전제가 유지되는 한 노출 문제 없음. 다만 향후 `FormValidationError` 생성자에서 메시지 포맷이 변경될 경우 세부 필드 정보가 의도치 않게 노출될 위험 경로가 됨.
  - 제안: 허용 가능한 수준이나, `FormValidationError.message` 의 client-safe 고정 문자열 정책을 코드 레벨에서도 린트/타입으로 강제하는 것을 고려.

- **[INFO]** coerceFormValue 에서 Array 요소를 콤마로 join 처리
  - 위치: `execution-engine.service.ts` `coerceFormValue` 정적 메서드
  - 상세: multi-select 값을 `join(',')` 로 단일 문자열화함. 콤마가 포함된 값(예: "a,b")과 다중 선택("a", "b")이 구분 불가한 모호성이 있으나, 이는 `validateFormSubmission` 의 입력 포맷 규약 문제이며 직접적 보안 취약점은 아님. XSS 또는 인젝션으로 이어질 경로 없음.
  - 제안: 인젝션 경로 없음. 현행 유지.

- **[INFO]** e2e 테스트 파일에 하드코딩된 JWT_SECRET fallback 값 존재
  - 위치: `external-interaction.e2e-spec.ts` JWT_SECRET 상수 선언
  - 상세: `'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'` 가 환경 변수 미주입 시 fallback 값으로 소스 코드에 하드코딩됨. 주석에 "do-not-use-in-prod" 명시가 있고, 환경 변수 우선 처리 후 fallback으로 설계된 테스트 전용 값. docker-compose.e2e.yml 에서 별도 값이 이미 설정.
  - 제안: 테스트 코드 내 fallback 이므로 프로덕션 리스크는 낮음. CI 환경에서 반드시 `JWT_SECRET` 환경 변수가 주입되어야 함을 CI 구성에서 보장할 것.

- **[INFO]** e2e 테스트의 DB 직접 INSERT 쿼리에 파라미터화(parameterized) 처리 적용됨
  - 위치: `external-interaction.e2e-spec.ts` INSERT 쿼리 전체
  - 상세: 모든 INSERT 쿼리가 `$1, $2, $3` 파라미터 바인딩을 사용하므로 SQL 인젝션 위험 없음.
  - 제안: 현행 유지.

- **[INFO]** assertFormSubmissionValid 에서 node 정의가 없을 때 검증을 skip 하는 방어적 설계
  - 위치: `execution-engine.service.ts` `assertFormSubmissionValid` private 메서드
  - 상세: `nodeExec` 또는 `node` 가 null 이면 early return 으로 검증을 통과시킴. 이는 "whitelist-only 동작 유지"를 위한 의도적 설계. 공격자가 node 정의 없는 execution에 임의 데이터를 제출하는 경우 검증 우회 가능성이 있음. 그러나 이 경우 `resolveWaitingNodeExecutionId` 단계에서 execution 이 waiting 상태인지 먼저 검증되므로 실제 악용 경로는 제한적.
  - 제안: 현행 방어적 설계는 하위 호환성을 위한 것으로 수용 가능. 중장기적으로 node 정의 부재 시 명시적 warn 로그 추가를 권장.

- **[INFO]** `badRequest` 헬퍼 함수의 `details` 파라미터가 `unknown` 타입으로 선언됨
  - 위치: `interaction.service.ts` `badRequest` 모듈 레벨 함수
  - 상세: `details?: unknown` 타입이 spreadable 구조(`{ ...(details ? { details } : {}) }`)로 응답 객체에 포함됨. 현재 호출 지점에서는 배열 리터럴만 전달되어 문제 없으나, 향후 호출자가 내부 상세 정보를 `details`에 담아 전달할 경우 민감 정보 노출 가능성.
  - 제안: `details` 타입을 `Array<{ field: string; message: string; code: string }>` 으로 구체화하여 타입 레벨에서 허용 형태를 제한.

### 요약

이번 변경은 form 제출 데이터의 publisher 측 동기 검증(`assertFormSubmissionValid`)을 도입하고, 검증 실패 시 `FormValidationError`를 통해 client-safe 고정 메시지만 외부에 노출하는 설계를 적용했다. 에러 처리 계층 전반에서 내부 식별자나 입력값이 응답에 포함되지 않도록 `serverDetail` 분리 정책이 일관되게 적용되어 있으며, 인증/인가(IDOR 차단, workspace 소유권 검증)도 기존 패턴을 그대로 유지하고 있다. SQL 인젝션 위험은 파라미터 바인딩 사용으로 차단되어 있고, 하드코딩된 시크릿은 테스트 전용 fallback 값으로 프로덕션 노출 위험이 낮다. `badRequest` 헬퍼의 `details` 파라미터가 `unknown` 타입이어서 잠재적 민감 정보 포함 경로가 존재하나 현재 호출 지점은 안전하다. 전체적으로 보안 관점에서 잘 설계된 변경이다.

### 위험도

LOW
