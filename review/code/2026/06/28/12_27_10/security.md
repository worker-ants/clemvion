# 보안(Security) 리뷰

## 발견사항

### **[INFO]** 내부 분류 문자열의 public 노출 분리 — 올바른 패턴
- 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (전체)
- 상세: `toTriggerParameterErrorDetails` 함수가 내부 소문자 reason(`missing_required`/`coerce_failed`/`invalid_schema`)을 `UPPER_SNAKE_CASE` public field code 로 정규화한다. 내부 구현 세부사항이 클라이언트에 그대로 노출되지 않는 올바른 계층 분리 패턴이다.
- 제안: 없음. 현행 유지.

### **[INFO]** e2e 테스트 내 직접 DB 조작
- 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — B3 테스트, 라인 1147~1155
- 상세: `db.query(`UPDATE node SET config = $1 WHERE workflow_id = $2 AND type = 'manual_trigger'`, [JSON.stringify({...}), wfId])` 형식의 파라미터화 쿼리를 사용한다. 값이 `JSON.stringify()` 를 거쳐 `$1` 플레이스홀더로 바인딩되므로 SQL 인젝션 위험은 없다.
- 제안: 없음. 현행 유지.

### **[INFO]** 에러 메시지의 정보 노출 범위 — 검증 완료
- 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` `REASON_TO_DETAIL` 맵
- 상세: 클라이언트에 전달되는 메시지(`Required parameter is missing`, `Value could not be coerced to the declared type`, `Trigger parameter schema is invalid`)는 field 명(`field: e.field`)을 포함하나 내부 구현 세부사항(스택 트레이스, DB 스키마, 내부 변수명 등)을 노출하지 않는다. `field` 는 사용자가 직접 정의한 파라미터 이름이므로 정보 노출로 간주되지 않는다.
- 제안: 없음.

### **[INFO]** `TriggerParameterValidationException.message` 내 필드·reason 노출 — 내부 전용으로 적합
- 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` 라인 160~163
- 상세: `super(`Trigger parameter validation failed: ${errors.map((e) => `${e.field}(${e.reason})`).join(', ')}`)` 는 내부 `reason` 코드를 포함한다. 이 메시지는 `Error.message` 프로퍼티이며 `GlobalExceptionFilter` 가 클라이언트 응답에 노출할 경우 정보 누출이 된다. 단, 이 예외는 `hooks.service.ts` 와 `workflows.controller.ts` 에서 catch 되어 새 `BadRequestException({ code, message, details })` 로 래핑되므로 원본 `Error.message` 는 클라이언트에 도달하지 않는다. 필터가 catch 하지 못한 경로(버그, 리팩터링 후 catch 누락 등)에서는 잠재적 노출 위험이 있다.
- 제안: `super('Trigger parameter validation failed')` 와 같이 message 를 단순화하고, field/reason 세부사항은 `this.errors` 에만 보관하는 방어적 설계를 고려할 수 있다. 현재 두 catch 경로가 명확히 래핑하므로 현행도 수용 가능.

### **[INFO]** `workflows.controller.ts` 내 `body.input.parameters` 의 비제한 전파
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` 라인 877~882 (전체 컨텍스트)
- 상세: `rawValues = body?.parameterValues ?? body?.input?.parameters ?? {}` 에서 `body.input` 전체가 `executionInput` 에 spread 된다(`const executionInput = { ...(body?.input ?? {}), __triggerSource: 'manual', parameters }`). 이미 schema 로 검증된 `parameters` 만 사용하도록 잘 분리되어 있으나, `body.input` 의 나머지 키들이 execution 입력으로 함께 전파된다. 실행 엔진이 알 수 없는 키를 무시한다면 보안 위협은 낮지만, 예상치 못한 키가 downstream 핸들러에 영향을 줄 수 있는지 확인이 필요하다.
- 제안: 현행 동작이 backward-compat 목적이라면 문서화를 강화하고, 장기적으로 `parameterValues` 만을 단일 경로로 사용하도록 이전을 권장한다.

## 요약

이번 변경은 webhook·manual trigger 경로에서 내부 validation reason(`missing_required`/`coerce_failed`/`invalid_schema`)을 외부 공개용 UPPER_SNAKE_CASE field code 로 정규화하는 `toTriggerParameterErrorDetails` 헬퍼를 도입하고, `errors` 키 대신 `details` 키로 예외를 throw 하도록 수정한 것이다. 전반적인 보안 관점에서 이 변경은 오히려 보안 상태를 개선한다. 내부 분류 문자열이 직접 노출되던 이전 `errors[].reason` 방식에서 정규화된 public code 로의 전환은 정보 노출 표면을 줄인다. SQL 인젝션, XSS, 커맨드 인젝션, 하드코딩 시크릿, 인증/인가 우회, 취약한 암호화 알고리즘 등 OWASP Top 10 관련 취약점은 해당 diff 에서 발견되지 않는다. e2e 테스트의 직접 DB 조작도 파라미터화 쿼리를 올바르게 사용하고 있다. `TriggerParameterValidationException.message` 에 내부 reason 이 포함되어 있으나 현재는 catch-and-rethrow 구조로 클라이언트에 노출되지 않으며, 방어적 개선 여지는 있으나 긴급 수정이 필요한 수준은 아니다.

## 위험도

LOW
