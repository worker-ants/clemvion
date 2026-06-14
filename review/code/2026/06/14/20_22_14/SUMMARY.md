# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — 테스트 커버리지 공백(핵심 검증 로직 단위 테스트 누락)과 아키텍처 레이어 의존 방향 역전이 주요 우려 사항. 기능 동작 자체는 spec(EIA-IN-10, form §4·§6.2)을 올바르게 충족하며, 보안·부작용·범위 이탈은 없음.

---

## Critical 발견사항

_Critical 등급 발견사항 없음._

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Testing | `assertFormSubmissionValid` / `coerceFormSubmission` / `coerceFormValue` 핵심 검증 로직에 단위 테스트 부재. `mockNodeRepo.findOneBy` 기본값이 `null`이어서 기존 `continueExecution` 테스트 전부가 form 검증 경로를 우회함. required 누락·email 형식 오류·FormValidationError throw + bus.publish 미호출 경로 미검증. | `execution-engine.service.spec.ts` | `mockNodeRepo.findOneBy`를 `mockResolvedValueOnce`로 override해 (1) required 누락 → FormValidationError throw + publish 미호출, (2) email 형식 오류 → throw, (3) nodeExec null → skip, (4) node null → skip, (5) fields 빈 배열 → skip 케이스 추가. `coerceFormValue` 각 타입 분기도 private access 패턴으로 검증. |
| W-2 | Testing | `executions.controller.spec.ts`에 `FormValidationError → 400 BadRequestException` 케이스 누락. `InvalidExecutionStateError → 422`는 테스트되어 있으나 `FormValidationError → 400` + response body shape 검증 없음. | `executions.controller.spec.ts` | `continueExecution` describe 블록에 `FormValidationError → 400 + { error: { code: 'VALIDATION_ERROR', details: [{ field, code: 'INVALID_FIELD' }] } }` 케이스 추가. |
| W-3 | Architecture | `ExecutionEngineService`(플랫폼 레벨 실행 엔진)가 상위 레이어인 `chat-channel/shared/form-mode`에 직접 의존. 레이어 의존 방향 역전(`execution-engine` → `chat-channel`). | `execution-engine.service.ts` import `../chat-channel/shared/form-mode` | `extractFormFields` / `validateFormSubmission`을 `shared/form/` 채널 중립 경로로 승격. `chat-channel`이 공유 위치를 참조하도록 역전. |
| W-4 | Architecture | `ExecutionEngineService`에 form 검증·타입 강제 변환 로직(69줄) 직접 추가 — SRP 압박 심화. `coerceFormSubmission`/`coerceFormValue`는 순수 데이터 변환 함수. | `execution-engine.service.ts` (`assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue`) | 세 함수를 `execution-engine/form-validation.ts` 또는 `shared/form/`으로 추출. `ExecutionEngineService`는 위임 호출만 유지. |
| W-5 | Architecture | `'VALIDATION_ERROR'` 문자열 리터럴이 3개 파일에 분산 하드코딩. 기존 `MessageTooLongError`·`RetryLastTurnError`는 `ErrorCode` enum 참조 패턴인데 `FormValidationError`만 누락. | `workflow-errors.ts`, `executions.controller.ts`, `interaction.service.ts` | `ErrorCode` enum에 `VALIDATION_ERROR = 'VALIDATION_ERROR'` 추가, 3개소 하드코딩을 enum 참조로 교체. |
| W-6 | Maintainability | `FormValidationError → BadRequestException` 변환 로직과 `'INVALID_FIELD'` 고정 문자열이 두 진입점에 중복 구현. 하나 수정 시 다른 쪽 누락 위험. | `executions.controller.ts` catch 블록, `interaction.service.ts` `dispatchContinuation` catch 블록 | 공통 헬퍼 함수 `toValidationBadRequest(err: FormValidationError)` 추출 또는 controller도 `badRequest()` 패턴 채택. |
| W-7 | Maintainability | `badRequest()` 헬퍼의 `details` 파라미터가 `unknown` 타입. 실제 구조(`Array<{ field, message, code }>`)가 타입으로 강제되지 않아 임의 값 전달 시 컴파일 에러 미발생. | `interaction.service.ts` `badRequest` 함수 시그니처 | `details?: ReadonlyArray<{ field: string; message: string; code: string }>` 또는 `ValidationDetail` 인터페이스로 구체화. |
| W-8 | Maintainability | `interaction.service.spec.ts` 내 동일 테스트 케이스(`submit_form: engine FormValidationError → 400 VALIDATION_ERROR + details[...]`)가 두 개소에 중복 존재. false green 위험. | `interaction.service.spec.ts` | 중복 케이스 중 하나 제거. |
| W-9 | Documentation | `dispatchContinuation` JSDoc 블록이 `InvalidExecutionStateError → 409`, `MessageTooLongError → 400`만 명시하고 신규 `FormValidationError → 400 VALIDATION_ERROR` 매핑 누락. | `interaction.service.ts` `dispatchContinuation` JSDoc | JSDoc에 `FormValidationError (spec form §4·§6.2 / EIA §5.1): submit_form field 검증 실패 → 400 VALIDATION_ERROR + details[{field, message, code:'INVALID_FIELD'}]` 추가. |
| W-10 | Documentation / API Contract | `executions.controller.ts`의 `continueExecution` 엔드포인트에 `@ApiBadRequestResponse` 데코레이터 누락. Swagger UI/OpenAPI spec에 400 VALIDATION_ERROR 응답이 표시되지 않음. `@ApiBadRequestResponse`는 이미 파일 상단 임포트됨. | `executions.controller.ts` `@Post(':id/continue')` | `@ApiBadRequestResponse({ description: 'VALIDATION_ERROR (form field 검증 실패 — details[{field,message,code}])' })` 추가. |
| W-11 | Performance | `assertFormSubmissionValid`에서 form 제출마다 DB 쿼리 2회 순차 발생. `nodeExecutionRepository.findOne` 후 `nodeId`로 `nodeRepository.findOneBy` 재조회. JOIN 단일 쿼리 병합 또는 `resolveWaitingNodeExecutionId` 결과 재사용으로 왕복 절감 가능. | `execution-engine.service.ts` `assertFormSubmissionValid` | `findOne({ relations: { node: true }, select: {...} })` 단일 쿼리로 병합. 또는 상위 흐름에서 `nodeId` 전달. |
| W-12 | Requirement | WS 게이트웨이의 `submit_form` 핸들러에서 `FormValidationError → ack { errorCode: 'VALIDATION_ERROR' }` shape를 직접 assertion하는 테스트 부재. 구조적으로는 `ExecutionError` 계층 자동 처리로 올바르게 동작하나 `buildContinuationErrorAck` 리팩터 시 silent regression 위험. | `websocket.gateway.spec.ts` | `continueExecution → FormValidationError → ack { errorCode: 'VALIDATION_ERROR' }` 케이스 추가. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Security | `FormValidationError.message`가 client-safe 고정 문자열. 사용자 입력값 미포함. JSDoc 명시. | `workflow-errors.ts` | 현행 유지. |
| I-2 | Security | `assertFormSubmissionValid`에서 node 미존재 시 검증 skip — 방어적 설계. `resolveWaitingNodeExecutionId` 선검증으로 악용 경로 제한적. | `execution-engine.service.ts` | node 부재 시 warn 로그 추가 고려(중장기). |
| I-3 | Security | e2e 테스트 JWT_SECRET fallback 하드코딩. 테스트 전용, 프로덕션 리스크 낮음. | `external-interaction.e2e-spec.ts` | CI에서 `JWT_SECRET` 환경 변수 주입 보장 확인. |
| I-4 | Architecture | `executions.controller.ts`와 `interaction.service.ts`의 exception 매핑 이중화. 향후 진입점 추가 시 반복 위험. | 두 파일 catch 블록 | `ExceptionFilter` 또는 `ExecutionErrorMapper` 유틸로 중앙화(중장기). |
| I-5 | Performance | 재제출 시 변경되지 않는 node config를 매번 DB에서 재로딩. 고빈도 재제출 시나리오에서 잠재적 I/O 낭비. | `execution-engine.service.ts` | 단기 in-memory TTL 캐시 또는 기 로딩 노드 정보 재사용 고려. |
| I-6 | Performance | `coerceFormSubmission`의 `Object.entries` + `JSON.stringify` — 현재 규모에서 허용 가능. | `execution-engine.service.ts` | form 필드 수 상한(예: 50개) 입력 검증 추가 시 대량 필드 CPU 소모 방어 가능. |
| I-7 | Requirement | `pattern`, `min`/`max`(number type), file MIME·size·count 검증 미구현. JSDoc에 "Planned — 본 단계 미적용" 의도적 scope-out 명시. | `form-mode.ts`, `assertFormSubmissionValid` JSDoc | 향후 단계 구현 예정 — 현재 scope 충족. |
| I-8 | Requirement | EIA-IN-10 충족: publisher 측 throw로 execution DB 상태 미변경. 응답 shape spec §5.1과 일치. | `execution-engine.service.ts`, `interaction.service.ts` | 현행 유지. |
| I-9 | API Contract | `details[]` 배열이 항상 단일 요소(first-error only) 설계임을 API 문서에 미명시. | `interaction.service.ts`, `executions.controller.ts` | Swagger description에 "현재 단계 FIRST 오류만, details 배열 길이 항상 1" 명시. |
| I-10 | API Contract | `FormValidationError.code`가 `ErrorCode` enum 외부 리터럴. 다른 ExecutionError들은 enum 참조 패턴. | `workflow-errors.ts` | W-5와 동일 — enum 추가 후 참조. |
| I-11 | Documentation | `interaction.controller.ts` `@ApiBadRequestResponse` description이 `VALIDATION_FAILED` → `VALIDATION_ERROR`로 올바르게 업데이트됨. | `interaction.controller.ts` | 현행 유지. |
| I-12 | Documentation | `coerceFormValue`에 함수 수준 JSDoc 부재. 배열 콤마 join의 파싱 가정 등 특수 케이스 즉시 파악 어려움. | `execution-engine.service.ts` `coerceFormValue` | 배열/객체 케이스·expected 동작 JSDoc 추가. |
| I-13 | Documentation | e2e describe 블록 레벨 JSDoc의 커버 범위 목록에 케이스 G(form validation) 미반영. | `external-interaction.e2e-spec.ts` describe 블록 | 커버 범위에 케이스 G 항목 추가. |
| I-14 | Documentation | CHANGELOG.md에 이번 변경(신규 에러 코드 `VALIDATION_ERROR`, `details[]` 응답 구조) 기록 필요. 외부 통합자 영향. | 프로젝트 루트 `CHANGELOG.md` | "EIA submit_form 서버 측 field 검증 추가, 실패 시 `400 VALIDATION_ERROR + details[{field,message,code:'INVALID_FIELD'}]`" 항목 기록. |
| I-15 | Testing | `FormValidationError` 클래스 프로퍼티(`code`, `field`, `name`) 직접 단위 테스트 부재. 응답 매핑이 이 필드를 직접 읽으므로 오타 regression 전파 위험. | `workflow-errors.ts` | `workflow-errors.spec.ts` 신설 또는 기존 spec 파일에 2~3줄 단위 검증 추가. |
| I-16 | Testing | e2e 케이스 G에서 `nodeId` body 값이 실제로 `assertFormSubmissionValid` 내 검증 경로 결정에 영향을 미치지 않는다는 사실이 주석으로 미명시. | `external-interaction.e2e-spec.ts` 케이스 G | 주석 한 줄 추가: "nodeId body는 assertNodeId 유무 검사만 — 실제 field lookup은 node_execution row의 nodeId가 결정한다." |
| I-17 | Scope | 변경된 8개 파일 모두 단일 목적(form validation)에 집중. 범위 이탈·무관 리팩터링·포맷팅 혼입 없음. | 전체 diff | 없음. |
| I-18 | Side Effect | `assertFormSubmissionValid` DB 조회가 read-only. `coerceFormSubmission`/`coerceFormValue`가 순수 함수. `badRequest()` 시그니처 확장이 optional 파라미터로 하위 호환. | 전체 변경 | 없음. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | 핵심 검증 로직(assertFormSubmissionValid, coerceFormValue) 단위 테스트 부재; controller spec FormValidationError 케이스 누락 |
| architecture | MEDIUM | execution-engine → chat-channel 레이어 의존 역전; ExecutionEngineService SRP 압박; VALIDATION_ERROR 리터럴 3개소 분산 |
| security | LOW | badRequest details?: unknown 잠재 리스크(현 호출부 안전); e2e JWT fallback |
| performance | LOW | assertFormSubmissionValid DB 쿼리 2회 순차(JOIN 단일화 가능); node config 재제출 시 캐싱 부재 |
| maintainability | LOW | FormValidationError 변환 로직 중복; details 타입 unknown; 테스트 케이스 중복 |
| documentation | LOW | dispatchContinuation JSDoc FormValidationError 매핑 누락; executions.controller @ApiBadRequestResponse 누락 |
| requirement | LOW | WS ack FormValidationError 직접 assertion 테스트 부재(기능은 구조적으로 올바름) |
| api_contract | LOW | continueExecution Swagger 400 응답 미문서화; details[] first-error 정책 미명시 |
| scope | NONE | 범위 이탈 없음 |
| side_effect | NONE | 의도치 않은 상태 변경·전역 부작용 없음 |

---

## 발견 없는 에이전트

- **scope**: 8개 파일 모두 단일 목적(form validation) — 범위 이탈 없음
- **side_effect**: read-only DB 조회, optional 파라미터 확장, 기존 계층 일관 유지 — 부작용 없음

---

## 권장 조치사항

1. **(W-1, 최우선) `execution-engine.service.spec.ts` 단위 테스트 추가** — `assertFormSubmissionValid`의 실제 검증 경로(required 누락 → FormValidationError throw + bus.publish 미호출, email 형식 오류 → throw, nodeExec/node null → skip)와 `coerceFormValue` 각 타입 분기(null/undefined → '', number/boolean → String(), 배열 join, 객체 JSON.stringify)를 단위 테스트로 커버.
2. **(W-2) `executions.controller.spec.ts` FormValidationError 케이스 추가** — `continueExecution`에서 `FormValidationError → 400 BadRequestException + { code: 'VALIDATION_ERROR', details: [{ field, code: 'INVALID_FIELD' }] }` response body shape 검증.
3. **(W-5) `ErrorCode` enum에 `VALIDATION_ERROR` 추가** — `workflow-errors.ts`, `executions.controller.ts`, `interaction.service.ts` 3개소 리터럴 하드코딩을 enum 참조로 통일. 기존 에러 클래스 패턴과 일관성 확보.
4. **(W-6, W-7) 중복 변환 로직 추출 + `details` 타입 구체화** — `toValidationBadRequest()` 헬퍼 또는 `FormValidationError.toHttpDetails()` 메서드로 중복 제거. `badRequest()` `details` 파라미터를 `ReadonlyArray<{ field: string; message: string; code: string }>` 타입으로 구체화.
5. **(W-10, W-9) 문서 갭 수정** — `executions.controller.ts`에 `@ApiBadRequestResponse` 데코레이터 추가. `interaction.service.ts` `dispatchContinuation` JSDoc에 FormValidationError 매핑 항목 추가. 코드 수정 없이 주석/데코레이터 추가만으로 해결.
6. **(W-8) 중복 테스트 케이스 제거** — `interaction.service.spec.ts`에 동일 테스트 두 개소 존재 확인 후 하나 제거.
7. **(W-11) DB 쿼리 최적화** — `assertFormSubmissionValid`의 2-hop 조회를 JOIN 단일 쿼리 또는 상위 흐름의 NodeExecution 재사용으로 최적화.
8. **(W-12) WS ack 테스트 추가** — `websocket.gateway.spec.ts`에 `FormValidationError → ack { errorCode: 'VALIDATION_ERROR' }` 케이스 추가.
9. **(W-3, W-4, 중기) 아키텍처 레이어 의존 역전 해소** — `extractFormFields`/`validateFormSubmission`을 `shared/form/` 채널 중립 경로로 승격. `ExecutionEngineService`의 form 검증 책임을 별도 서비스/유틸로 분리.
10. **(I-14) CHANGELOG 업데이트** — 신규 에러 코드 VALIDATION_ERROR, details[] 응답 구조, waiting_for_input 유지 재제출 가능 항목 기록.

---

## 라우터 결정

라우터 사용 — 전체 14명 중 10명 실행, 4명 제외.

**실행** (10명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract

**제외** (4명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 신규 외부 패키지 추가 없음 — 기존 내부 모듈 재사용만으로 구성 |
| database | DB 스키마 변경 없음 — 기존 테이블 read-only 조회만 추가 |
| concurrency | 동시성 변경 없음 — 동기 검증 로직, 공유 상태 없음 |
| user_guide_sync | 사용자 가이드 문서 영역 해당 없음 |
