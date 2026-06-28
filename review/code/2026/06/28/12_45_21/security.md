### 발견사항

- **[INFO]** `TriggerParameterValidationException` 생성자의 `super()` 메시지에 내부 reason 문자열 포함
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L157–161
  - 상세: `super(`Trigger parameter validation failed: ${errors.map((e) => \`${e.field}(${e.reason})\`).join(', ')}`)` 형태로 내부 분류 문자열(`missing_required`, `coerce_failed`, `invalid_schema`)이 Error.message 에 포함된다. 현재 코드에서는 catch 블록이 `TriggerParameterValidationException` 를 잡아 `BadRequestException`으로 변환하므로 원본 메시지는 클라이언트에 직접 노출되지 않는다. 그러나 catch 체인에서 예외가 누락되거나, 로그 집계 시스템이 Error.message를 외부에 노출하는 경우 내부 필드명이 유출될 수 있다.
  - 제안: `super('Trigger parameter validation failed')` 로 단순화하고 내부 상세는 `this.errors`에만 보관한다. 이는 현재 활성 취약점이 아니나 방어적 설계 관점에서 개선 권장.

- **[INFO]** `toTriggerParameterErrorDetails` 의 `field` 값이 사용자 제공 입력에서 유래
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L74–81
  - 상세: `TriggerParameterValidationError.field` 는 파라미터 스키마 정의(서버 측)에서 파생되며, 사용자가 직접 제어하는 값이 아니다. 그러나 `e.field` 가 `error.details[].field` 로 직접 클라이언트에 반환되므로, 스키마에 XSS 공격 벡터가 될 수 있는 문자열이 포함된 경우 응답에 그대로 포함된다. 스키마 저장 시점에 `validateTriggerParameterSchema`가 식별자 유효성을 검사(`/^[a-zA-Z_][a-zA-Z0-9_]*$/` 등)하므로 현실적 위험은 낮다. 단, `(root)` 같은 특수 값이 코드 내부에서 주입되는 점도 확인됨.
  - 제안: 현행 흐름에서 허용 가능. JSON 응답이 `Content-Type: application/json`으로 반환되므로 XSS 표면이 없다. 추가 조치 불필요.

- **[INFO]** e2e 테스트에서 직접 SQL UPDATE로 노드 설정을 조작
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` (B3 테스트, L635–646)
  - 상세: `db.query('UPDATE node SET config = $1 WHERE workflow_id = $2 AND type = \'manual_trigger\'', [JSON.stringify({...}), wfId])` 패턴이 테스트 코드에서 사용된다. 파라미터화된 쿼리(`$1`, `$2`)를 사용하므로 SQL 인젝션 위험은 없다. 테스트 컨텍스트이므로 프로덕션 보안 위험도 없다. 단, 스키마 변경 시 조용히 깨질 수 있어 유지보수성 문제가 있다.
  - 제안: 보안 관점에서 허용 가능(파라미터화 쿼리 사용 확인). 유지보수 개선은 별도 사안.

- **[INFO]** 에러 응답에 `code`/`details` 필드 외 내부 정보 미노출 확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L515–525, `workflows.controller.ts` L598–604
  - 상세: 이번 변경에서 `errors: err.errors` (내부 reason 포함) 대신 `details: toTriggerParameterErrorDetails(err.errors)` (공개 UPPER_SNAKE_CASE 코드로 정규화)로 교체하여 에러 정보 노출을 개선했다. 내부 `reason` 값(`missing_required`, `coerce_failed`)이 클라이언트에 직접 노출되지 않고, 공개 명세(`MISSING_REQUIRED_FIELD`, `TYPE_COERCION_FAILED`)로만 표면화된다. 보안 관점에서 긍정적인 변경.
  - 제안: 현행 유지. 개선된 정보 은닉.

### 요약

이번 변경(`errors` → `details` 키 교체, `toTriggerParameterErrorDetails` 헬퍼 도입)은 보안 관점에서 오히려 개선된 방향이다. 내부 reason 문자열(`missing_required`, `coerce_failed`)이 공개 API에 직접 노출되던 구조를 UPPER_SNAKE_CASE 공개 코드(`MISSING_REQUIRED_FIELD`, `TYPE_COERCION_FAILED`)로 정규화하여 내부 구현 세부사항 노출을 줄였다. 인젝션 취약점(e2e SQL은 파라미터화 쿼리 사용), 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화 알고리즘은 이번 diff 범위 내에서 발견되지 않았다. 한 가지 방어적 설계 개선 사항(`TriggerParameterValidationException.message` 단순화)은 현재 catch-rethrow 구조상 실제 취약점이 아니나, 향후 로그 노출 위험 예방을 위해 비긴급 수준에서 권장된다.

### 위험도

LOW
