# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 정확성 및 API 계약 관점에서 모두 안전하다. 내부 `errors` → `details` 키 교체로 spec §5.2 요구사항이 완전히 충족됐으며, CRITICAL 발견사항 없음. WARNING 1건은 테스트 커버리지 미비(mock 여부 불명확)이며 기능 동작에는 영향을 주지 않는다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `hooks.service.spec.ts` 의 `TYPE_COERCION_FAILED` 경로 단위 테스트에서 `resolveTriggerParameters` / `toTriggerParameterErrorDetails` mock 여부가 불명확하다. 결과값만 비교하므로 중간 변환 경로가 실제로 호출됐는지 보장되지 않는다. | `codebase/backend/src/modules/hooks/hooks.service.spec.ts` L269–298 | `toHaveBeenCalledWith` 스타일 검증을 추가하거나, mock 구조가 실제 변환 함수를 통과함을 확인한다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `TriggerParameterValidationException.message` 에 내부 reason 포함. 현재는 catch-rethrow 로 클라이언트에 미노출이나, catch 누락 시 노출 가능. | `trigger-parameter.types.ts` L160–163 | `super('Trigger parameter validation failed')` 로 단순화하고 세부 사항은 `this.errors` 에만 보관하는 방어적 설계 고려(긴급 수정 불필요). |
| 2 | Security | `body.input` 전체가 `executionInput` 에 spread 됨. `parameters` 와 별개로 알 수 없는 키가 downstream 에 전파 가능. | `workflows.controller.ts` L877–882 | 장기적으로 `parameterValues` 단일 경로 이전 권장; 현행 backward-compat 목적이라면 문서화 강화. |
| 3 | Requirement | `INVALID_SCHEMA` 코드 매핑이 runtime webhook/manual 경로에서 실제로 도달하지 않음. 단위 테스트는 white-box 완전성 검증으로 유효. | `trigger-parameter.types.ts` L40–44 | `toTriggerParameterErrorDetails` JSDoc 에 "runtime 경로에서 `invalid_schema` 미도달" 설명 추가(선택). |
| 4 | Testing | `workflows.controller` 의 `INVALID_TRIGGER_PARAMETERS` 경로에 대한 컨트롤러 단위/통합 테스트 미포함. | `workflows.controller.ts` L302–311 | `workflows.controller.spec.ts` 에 `execute()` 가 `TriggerParameterValidationException` 시 `{ code, details }` 응답을 반환함을 검증하는 케이스 추가. |
| 5 | Testing | e2e B3 테스트에서 `TYPE_COERCION_FAILED` 시나리오 미포함. `MISSING_REQUIRED_FIELD` 케이스만 검증. | `webhook-trigger.e2e-spec.ts` B3 케이스 | B3 에 number 타입 파라미터에 비숫자 값 전송 시 `TYPE_COERCION_FAILED` 서브케이스 추가. |
| 6 | Testing | `resolve-trigger-parameters.spec.ts` 케이스 3번(`every field code is UPPER_SNAKE_CASE`)이 케이스 1번(`maps internal reasons`)의 exact match 검증과 중복. | `resolve-trigger-parameters.spec.ts` L230–239 | 케이스 3번 삭제 또는 케이스 1번에 통합. |
| 7 | Testing | 단위 테스트 케이스명 `'preserves order and is empty for empty input'` 에서 순서 보존이 실제로 검증되지 않음. | `resolve-trigger-parameters.spec.ts` L226–228 | `'returns empty array for empty input'` 으로 이름 수정. |
| 8 | Maintainability | `toTriggerParameterErrorDetails` 내부에서 `REASON_TO_DETAIL[e.reason].code` / `.message` 를 두 번 조회. | `trigger-parameter.types.ts` L79–80 | `const { code, message } = REASON_TO_DETAIL[e.reason];` 구조 분해로 한 번만 조회. |
| 9 | Maintainability | `hooks.service.spec.ts` 에서 `{ code: string; details: Array<{ field, code, message }> }` 인라인 타입이 두 케이스에 중복. | `hooks.service.spec.ts` L464–467, L484–487 | 이미 export 된 `TriggerParameterErrorDetail` 임포트 후 재사용. |
| 10 | Maintainability | e2e B3 의 `db.query(UPDATE node SET config = ...)` 직접 조작이 API 경로와 이질적이고 스키마 변경 시 조용히 깨질 수 있음. | `webhook-trigger.e2e-spec.ts` L1341–1355 | API 경로 사용 가능 시 우선; 불가피하면 `setupNodeWithParameters` 헬퍼 추출 + 경고 주석 추가. |
| 11 | Maintainability | `WorkflowsController.execute` 의 `rawValues` 추출 로직이 3단계 fallback 으로 인라인 복잡도 높음(이번 diff 직접 범위 외). | `workflows.controller.ts` L877–882 | `extractRawParameterValues(body)` private 함수로 분리(후속 리팩터링 참고 수준). |
| 12 | Documentation | `TriggerParameterDefinition` / `TriggerParameterValidationError` 기존 인터페이스에 JSDoc 없음. | `trigger-parameter.types.ts` 상단 기존 코드 | 후속 작업으로 간단한 JSDoc 추가. |
| 13 | Documentation | `workflows.controller.ts` 인라인 주석의 spec 참조가 `manual-trigger §6` 만 기재, 파일 경로 미기재. | `workflows.controller.ts` INVALID_TRIGGER_PARAMETERS throw 직전 주석 | `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 형식으로 구체화(필수 아님). |
| 14 | Requirement | `hooks.service.spec.ts` 가 webhook 경로만 업데이트됐고 manual-trigger(`INVALID_TRIGGER_PARAMETERS`) 경로 대칭 단위 테스트 미포함. | `hooks.service.spec.ts` vs `workflows.controller.ts` | `workflows.controller.spec.ts` 에 대응 케이스 추가(INFO #4 와 중복, 기능 누락은 아님). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `TriggerParameterValidationException.message` 에 내부 reason 포함(catch-rethrow 로 현재 미노출). `body.input` spread 경로 backward-compat 확인 권장. |
| requirement | NONE | spec §5.2 / manual-trigger §6 / error-handling §1.7 와 코드·테스트·plan 이 완전히 정합. CRITICAL/WARNING 없음. |
| scope | NONE | 7개 파일 전부 WH-EP-05-2 단일 목표에 귀속. 범위 이탈 없음. |
| side_effect | NONE | 순수 additive 변경. 전역 상태·파일시스템·네트워크 부작용 없음. `errors`→`details` 는 기존 필터 경로 정합. |
| maintainability | LOW | 맵 이중 조회, 인라인 타입 중복, e2e 직접 DB 조작 이질성, `rawValues` 추출 복잡도 — 전부 INFO. |
| testing | LOW | WARNING 1건: `hooks.service.spec.ts` mock 여부 불명확으로 변환 경로 호출 보장 미흡. INFO: controller 단위 테스트 미포함, `TYPE_COERCION_FAILED` e2e 미포함, 케이스 중복. |
| documentation | NONE | 신규 심볼 JSDoc 충실. 기존 인터페이스 JSDoc 부재는 후속 작업 수준. plan 체크박스·spec 본문 모두 갱신 완료. |
| api_contract | NONE | `errors`→`details` 변경은 additive. 최상위 code 유지, HTTP 400 적절, TypeScript Record 로 매핑 완전성 컴파일 타임 보장. |

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음
- **side_effect**: 부작용 없음
- **requirement**: 요구사항 미충족 없음
- **documentation**: 차단 수준 문서 누락 없음
- **api_contract**: API 계약 위반 없음

## 권장 조치사항

1. **(WARNING 해소)** `hooks.service.spec.ts` 의 `TYPE_COERCION_FAILED` 테스트가 실제 `toTriggerParameterErrorDetails` 변환 경로를 통과함을 확인하고, mock 구조가 중간 경로를 우회하는 경우 `toHaveBeenCalledWith` 검증 추가.
2. `workflows.controller.spec.ts` 에 `INVALID_TRIGGER_PARAMETERS` + `details[]` 경로 단위 테스트 추가(두 경로 대칭 커버).
3. e2e B3 에 `TYPE_COERCION_FAILED` 서브케이스 추가(number 타입에 비숫자 입력).
4. `toTriggerParameterErrorDetails` 내부 `REASON_TO_DETAIL[e.reason]` 구조 분해 리팩터링 및 `TriggerParameterErrorDetail` 타입 재사용으로 인라인 중복 제거.
5. `TriggerParameterValidationException.message` 를 단순화해 방어적 설계 강화(선택적 개선).
6. e2e 직접 DB 조작을 `setupNodeWithParameters` 헬퍼로 추출(후속 리팩터링).
7. 기존 `TriggerParameterDefinition` / `TriggerParameterValidationError` 에 JSDoc 추가(후속 작업).

## 라우터 결정

라우터가 선별 실행(`routing_status=done`).

- **실행 (강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명 — 전원 router_safety 강제 포함)
- **제외**: `performance`, `architecture`, `dependency`, `database`, `concurrency`, `user_guide_sync` (6명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)