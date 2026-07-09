### 발견사항

- **[WARNING]** 저장 시점 파라미터 스키마 게이트가 이미 malformed 상태로 영속된 기존 워크플로우의 **향후 모든 저장**을 계속 막는다 — 마이그레이션/백필 없음 (하위 호환성, 아직 미해소)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger`(L586-611), `saveCanvas`(L386-399)
  - 상세: `POST /:id/save` 의 `SaveCanvasDto` 는 "캔버스에 존재하는 모든 노드" 를 매번 전체 동기화(full-replace)하는 계약이다(`save-canvas.dto.ts:184-188` — "포함되지 않은 노드는 삭제됩니다"). 즉 사용자가 트리거와 무관한 노드 위치만 옮겨 저장해도 기존 트리거 `config.parameters` 가 그대로 payload 에 실려 재검증된다. 이번 diff 로 `validateManualTrigger` 가 malformed `config.parameters`(빈 이름 슬롯 등)를 `400 INVALID_TRIGGER_PARAMETERS` 로 거부하므로, 이 gate 도입 이전에 이미 malformed 상태로 저장돼 있던 실 워크플로우는 **트리거를 건드리지 않는 일반 편집조차 저장이 영구적으로 막힌다**(스스로 트리거 파라미터를 고치기 전까지). `restoreVersion` 은 `skipParamSchemaValidation=true` 로 예외 처리됐지만(이전 라운드 CRITICAL/WARNING 대응, 적절함), 일반 `POST /:id/save` 경로는 여전히 예외가 없다. 이 리스크는 이미 이전 라운드 리뷰(`review/code/2026/07/09/11_08_21/RESOLUTION.md` W6)에서 식별되어 "운영 후속(배포 전 실 데이터 조회/정리는 운영 판단)"으로 의식적으로 이연됐으나, 이번 diff 에는 실제 데이터 조회·백필 스크립트가 포함돼 있지 않아 배포 시점까지 미해결 상태다.
  - 제안: 배포 전 프로덕션 DB 에서 malformed `manual_trigger.config.parameters` 를 가진 워크플로우 존재 여부를 조회하고, 있다면 (a) 배포와 함께 1회성 정리 마이그레이션을 수행하거나 (b) 최소한 소유자에게 "이 워크플로우는 트리거 파라미터를 수정해야 저장 가능"이라는 사전 안내를 제공. 이미 추적 중인 항목이므로 신규 차단 사유는 아니나, 실행 전 확인이 필요.

- **[WARNING]** `INVALID_TRIGGER_PARAMETERS` 코드가 두 개의 서로 다른 엔드포인트·실패 시점에 재사용되고, spec 은 아직 이를 구분 문서화하지 않음 (에러 응답 일관성)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:605-609`(신규, `POST /:id/save` — 구조 위반 `invalid_schema`) vs `codebase/backend/src/modules/workflows/workflows.controller.ts:242` 인근(기존, `POST /:id/execute` — 값 누락 `missing_required`)
  - 상세: 두 실패는 서로 다른 사용자 액션(캔버스 저장 vs 실행)·다른 HTTP 엔드포인트·다른 `message` 문자열에 대해 동일한 top-level `error.code` 를 반환한다. `details[]` 의 필드 코드(`INVALID_SCHEMA` vs `MISSING_REQUIRED_FIELD`)로는 구분 가능하지만, top-level `code` 만 보고 분기하는 클라이언트·향후 `ERROR_KO`(`codebase/frontend/src/lib/i18n/backend-labels.ts`) 매핑 추가 시에는 한 코드에 한 메시지만 매핑돼 두 컨텍스트 중 하나에 부적절한 문구가 노출될 위험이 있다. 이 gap 은 후속 plan(`plan/in-progress/spec-update-manual-trigger-save-time-error-code.md`)으로 project-planner 에 위임돼 있어 프로세스상 추적은 되고 있으나, 코드/spec 자체는 아직 갱신 전이다.
  - 제안: 저장 시점 구조 위반에 별도 코드(예: `INVALID_TRIGGER_PARAMETER_SCHEMA`)를 부여하거나, 하나의 코드를 의도적으로 공유한다면 spec §6 표에 두 발행처(저장 시점/실행 시점)를 명시적으로 병기 — 이미 후속 plan 에 반영돼 있으므로 해당 plan 완료 시 자동 해소.

- **[INFO]** 저장 시점 검증(`validateManualTrigger`)이 실행 시점 `ManualTriggerHandler.validate()` 를 경유하지 않고 동일 하위 함수를 직접 재호출 — 두 경로의 향후 drift 가능성
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:586-611` vs `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts`
  - 상세: 현재는 `validateTriggerParameterSchema` 라는 동일 SoT 함수를 양쪽이 호출해 결과가 동등하지만, `ManualTriggerHandler.validate()` 에는 `evaluateMetadataBlockingErrors` 같은 추가 검사가 있고 저장 시점 게이트는 이를 건너뛴다. 향후 handler 쪽에 blocking rule 이 추가되면 "저장은 통과하지만 실행은 실패"라는, 이번 fix 가 없애려던 것과 유사한 계약 불일치가 재발할 수 있다. 현재 diff 범위에서는 실질적 차이가 없어 CRITICAL 은 아니다.
  - 제안: 조치 불요(현시점). 향후 매뉴얼 트리거에 blocking rule 이 추가될 때 두 경로를 재수렴시키는 것을 체크리스트에 남겨두면 좋음.

- **[INFO]** Swagger 문서(`@ApiBadRequestResponse`)가 `POST /:id/save` 의 신규 실패 사유를 아직 반영하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:440`(`saveCanvas`, `description: '입력값 검증 실패'`) — 형제 엔드포인트 `execute`(L242)는 `'트리거 파라미터 검증 실패'` 로 구체적
  - 상세: 필수는 아니나 OpenAPI 문서 완결성 관점에서 신규 `INVALID_TRIGGER_PARAMETERS` 케이스가 `saveCanvas` 스펙에 드러나지 않는다. 이번 diff 로도 갱신되지 않음.
  - 제안: `description` 을 "입력값 검증 실패(그래프 검증·중복 라벨·Manual Trigger 파라미터 스키마 등)" 로 보강 검토.

- **[INFO]** 프론트 `ERROR_KO` 매핑에 `INVALID_TRIGGER_PARAMETERS` 미등록 — 영문 fallback 노출 가능
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts`
  - 상세: 이번 diff 로 저장 흐름에서도 직접 노출될 수 있게 됐으나(트리거 설정 패널 inline 검증이 막지 못하는 경로 — 예: 레거시 malformed 데이터 재저장, 직접 API 호출), 한국어 매핑은 아직 없다. 가드 테스트는 progressive allowlist 라 CI 실패는 아님.
  - 제안: 대칭성을 위해 `ERROR_KO`/`LOCALIZED_ERROR_CODES` 등록 검토(선택).

- **[INFO]** 엔진 재진입 3개 dispatch 지점의 `input` 수정(`{} → savedExecution.inputData ?? {}`)은 응답 스키마 변경이 아니라 값 정정
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`)
  - 상세: `GET /api/executions/:id` 및 `node_execution.output_data` 로 노출되는 `output.parameters` 내용이 특정 재진입 경로(crash-redrive, stalled-redelivery)에서 잘못된 빈 값이던 것을 durable 원본 입력으로 정정한다. 응답 envelope/스키마 구조 변경 없음, 값이 채워지는 방향으로만 바뀌므로 하위 호환성 리스크는 낮다. `retry-turn.service.ts` 의 구조적으로 동일한 4번째 재진입 호출부는 의도적으로 `input:{}` 유지(AI multi-turn retry — 진입 트리거 재실행 안 됨, spec §retry 문서화 동작) — 교차 주석으로 근거가 남아 있어 API 표면 관점에서 불일치는 아님.

- **[INFO]** 저장 시점 검증 자체의 형식은 기존 컨벤션에 부합
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:605-609`
  - 상세: `{code, message, details}` `BadRequestException` 페이로드, `toTriggerParameterErrorDetails` 재사용(기존 execute/webhook 경로와 동일 `TriggerParameterErrorDetail[]` shape), 트랜잭션/영속 이전 fail-fast 검증 패턴 모두 기존 컨벤션과 일치. HTTP 400 선택도 적절. `restoreVersion` → `skipParamSchemaValidation=true` 로 과거 스냅샷 복원을 차단하지 않도록 예외 처리한 것도 이전 라운드 지적(WARNING W6 일부)에 대한 타당한 대응이다.

### 요약

이번 변경의 핵심 API 표면은 `POST /api/workflows/:id/save`(및 이를 재사용하는 `restoreVersion`, 단 후자는 `skipParamSchemaValidation` 으로 게이트 예외 처리됨)에 Manual Trigger 파라미터 스키마 구조 검증을 추가해 신규 400 `INVALID_TRIGGER_PARAMETERS` 를 발행하는 것과, 실행 엔진 재진입 경로의 `output.parameters` 내용을 정정하는 내부 버그 수정이다. 에러 응답 envelope·HTTP 상태 코드는 기존 컨벤션과 일관되고, 새 엔드포인트·버전·페이지네이션·인증 변경은 없다. `restoreVersion` 예외 처리로 버전 복원 경로의 회귀는 이전 라운드 리뷰 이후 해소됐으나, 일반 `POST /:id/save` 는 full-replace 계약이라 트리거와 무관한 편집을 저장하려는 기존 malformed 데이터 보유 워크플로우가 계속 차단된다는 하위 호환성 리스크는 마이그레이션 없이 남아 있다(이미 추적 중, 배포 전 확인 필요). 저장 시점(스키마 구조)과 실행 시점(값)이 동일 에러 코드를 재사용하는 문제도 spec 후속 plan 으로 추적은 되고 있으나 아직 반영 전이다. 나머지는 문서 완결성 수준의 INFO.

### 위험도

MEDIUM
