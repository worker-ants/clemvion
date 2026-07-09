### 발견사항

- **[WARNING]** 저장시점 검증 추가로 기존에 저장된 malformed trigger 데이터를 가진 워크플로우가 향후 저장/복원 불가능해질 수 있음 (하위 호환성)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger` (line 576-609), `saveCanvas`(395) / `restoreVersion`(431→468, 내부적으로 `saveCanvas` 위임)
  - 상세: 이번 fix 이전에는 `saveCanvas`가 Manual Trigger `config.parameters`의 구조(빈 name 슬롯 등)를 전혀 검증하지 않아, malformed 파라미터가 조용히 DB에 영속될 수 있었다(버그로 인해 실제 발생 가능했던 상태). 이번 변경으로 `saveCanvas` 최상단에서 이를 400 `INVALID_TRIGGER_PARAMETERS`로 거부하는데, 이는 **들어오는 payload 전체**에 적용되므로: (1) 이미 malformed 상태로 저장된 기존 워크플로우는, 트리거와 무관한 다른 노드만 수정해서 저장하려 해도 전체 저장이 막힌다. (2) `restoreVersion`이 내부적으로 `saveCanvas`를 재사용하므로, 과거에는 정상 복원되던 malformed 버전 스냅샷도 이제 복원이 막힌다. 두 경로 모두 이 fix 이전에는 성공하던 동작이 이제 400으로 막히는 회귀성 동작 변화이며, 이를 위한 데이터 마이그레이션/정리 스크립트는 diff에 포함되어 있지 않다.
  - 제안: (a) 기존 malformed 데이터를 정리하는 1회성 마이그레이션 스크립트를 추가하거나, (b) `restoreVersion` 경로에서는 과거 스냅샷 복원을 막지 않도록 예외 처리하거나(복원 후 사용자가 편집 화면에서 인라인 오류로 안내받아 수정하게 유도), (c) 최소한 이 회귀 가능성을 `plan/in-progress/manual-trigger-default-param.md`에 명시하고 롤아웃 전 실제 malformed 데이터 존재 여부를 DB에서 확인할 것을 권고.

- **[WARNING]** 동일한 에러 코드 `INVALID_TRIGGER_PARAMETERS`가 의미가 다른 두 엔드포인트/두 실패 상황에 재사용됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:604-608` (신규, 저장 시점 — 파라미터 *스키마 구조* 위반) vs `codebase/backend/src/modules/workflows/workflows.controller.ts:307-314` (기존, 실행 시점 — 유효한 스키마에 대한 *입력값* 검증 실패)
  - 상세: `POST /api/workflows/:id/save`(신규 400)와 `POST /api/workflows/:id/execute`(기존 400)가 동일한 `code: 'INVALID_TRIGGER_PARAMETERS'`를 반환하지만 `message`는 각각 `'Manual Trigger has an invalid parameter schema'` / `'Invalid trigger parameters'`로 다르다. 두 실패는 근본적으로 다른 사용자 액션(캔버스 저장 vs 실행 트리거)에 대한 응답이며, `error.code`만으로 분기하는 클라이언트/향후 `ERROR_KO`(`codebase/frontend/src/lib/i18n/backend-labels.ts`) 매핑 추가 시 한 코드에 한 메시지만 매핑되어 두 컨텍스트 중 하나에는 부적절한 문구가 노출될 위험이 있다.
  - 제안: 저장 시점 스키마 구조 위반에는 별도 코드(예: `INVALID_TRIGGER_PARAMETER_SCHEMA`)를 부여하거나, 하나의 코드를 의도적으로 공유한다면 그 사실을 코드 주석/스펙에 명시.

- **[INFO]** 신규 400 에러 코드가 프론트 `ERROR_KO` 매핑에 등록되지 않음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (`ERROR_KO`, `LOCALIZED_ERROR_CODES` in `backend-labels.test.ts`)
  - 상세: `INVALID_TRIGGER_PARAMETERS`는 이번에 캔버스 저장 흐름에서 직접 사용자에게 노출 가능한 400이 되었지만(트리거 설정 패널의 인라인 검증이 사전에 막지 못하는 경우, 예: 다른 워크플로우 캔버스 편집기를 통한 직접 API 호출 또는 레거시 malformed 데이터 재저장 시), `ERROR_KO`에는 등록돼 있지 않아 영문 fallback 메시지만 노출된다(가드 테스트는 progressive allowlist라 CI 실패는 아님). 형제 코드인 `GRAPH_VALIDATION_FAILED`(같은 `saveCanvas` 경로, 같은 파일)는 이미 한국어 매핑이 있다.
  - 제안: 대칭성을 위해 `ERROR_KO`에 `INVALID_TRIGGER_PARAMETERS` 항목과 `LOCALIZED_ERROR_CODES`에 등록 추가 검토. `details[]`의 필드별 code/message를 UI에서 활용하는지도 함께 점검.

- **[INFO]** Swagger 문서 설명이 신규 실패 사유를 명시하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:440` (`saveCanvas` 의 `@ApiBadRequestResponse({ description: '입력값 검증 실패' })`)
  - 상세: 동일 컨트롤러의 `execute` 엔드포인트(242행)는 `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })`로 트리거 파라미터 검증 실패를 명시하는 반면, `saveCanvas`는 여전히 포괄적 문구만 유지해 신규 `INVALID_TRIGGER_PARAMETERS` 케이스가 OpenAPI 문서에서 드러나지 않는다.
  - 제안: 필수는 아니나, `description`을 `'입력값 검증 실패 (그래프 검증·중복 라벨·Manual Trigger 파라미터 스키마 등)'` 식으로 보강하면 문서 완결성이 좋아진다.

- **[INFO]** 저장 시점 검증 자체는 기존 컨벤션을 잘 따름 (참고, 액션 불필요)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:576-609`
  - 상세: `{code, message, details}` 형태의 `BadRequestException` 페이로드, `toTriggerParameterErrorDetails` 재사용(이미 `execute`/webhook 경로에서 쓰이던 `TriggerParameterErrorDetail[]` 스키마와 동일한 shape), `saveCanvas` 트랜잭션/영속 이전 최상단에서 fail-fast 검증(다른 구조 검증들과 동일 패턴) 모두 기존 컨벤션에 부합한다. 400이라는 HTTP 상태 코드 선택도 적절하다.

- **[INFO]** `execution-engine.service.ts`의 재진입 input 수정은 응답 스키마 변경이 아니라 버그 수정(내용 정정)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (3개 재진입/redrive 호출부, `input: {} → savedExecution.inputData ?? {}`)
  - 상세: `GET /api/executions/:id` 및 `node_execution.output_data`로 노출되는 `output.parameters` 내용이 특정 재진입 경로(crash-redrive, stalled-redelivery, retry-resume)에서 잘못된 빈 값이던 것을 durable 원본 입력으로 정정한다. 응답 envelope/스키마 구조 변경은 없고, 해당 좁은 경로에서 값이 채워지는 방향으로만 바뀌므로 하위 호환성 리스크는 낮다.

### 요약

이번 변경의 핵심 API 표면은 `POST /api/workflows/:id/save`(및 이를 재사용하는 `restoreVersion`)에 Manual Trigger 파라미터 스키마 구조 검증을 추가해 400 `INVALID_TRIGGER_PARAMETERS`를 새로 반환하는 것과, 실행 엔진 재진입 경로의 `output.parameters` 내용을 정정하는 내부 버그 수정이다. 에러 응답 envelope(`{code, message, details}`)과 HTTP 상태 코드 선택은 기존 컨벤션 및 이미 존재하던 execute/webhook 경로의 `TriggerParameterErrorDetail[]` shape와 일관되며, 새 엔드포인트·버전·페이지네이션·인증 변경은 없다. 다만 이 검증이 "들어오는 payload 전체"에 적용되고 `restoreVersion`도 내부적으로 같은 경로를 타므로, 이 fix 이전에 이미 malformed 상태로 저장된 기존 워크플로우/버전 스냅샷은 이후 저장·복원이 막힐 수 있는데 이를 위한 마이그레이션/완화책이 없다는 점, 그리고 저장 시점(스키마 구조)과 실행 시점(값)이라는 의미가 다른 두 실패에 동일 에러 코드를 재사용한 점은 하위 호환성·클라이언트 에러 처리 관점에서 보완이 필요하다.

### 위험도

MEDIUM
