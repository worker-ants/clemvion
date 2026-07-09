### 발견사항

- **[WARNING]** `INVALID_TRIGGER_PARAMETERS` 코드가 의미가 다른 두 엔드포인트/실패 상황에 재사용됨 (기존 라운드에서 지적, 코드 유지로 확정)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:614-622` (신규, `POST /:id/save` — 파라미터 *스키마 구조* 위반) vs `codebase/backend/src/modules/workflows/workflows.controller.ts:309` (기존, `POST /:id/execute` — 유효한 스키마에 대한 *입력값* 검증 실패)
  - 상세: 두 실패는 서로 다른 사용자 액션(캔버스 저장 vs 실행)에 대한 응답인데 top-level `code`가 동일하다. `details[].code`(`INVALID_SCHEMA` vs `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`)로는 구분되지만, `code` 단독으로 분기하는 클라이언트나 `ERROR_KO` 매핑 추가 시 한 문구만 두 컨텍스트에 쓰이게 된다. `spec/4-nodes/7-trigger/1-manual-trigger.md §6`·`spec/data-flow/10-triggers.md:47`도 여전히 실행 경로 전용으로만 문서화하고 저장 경로 재사용은 언급하지 않는다(구현이 spec 을 한 걸음 앞섰다).
  - 처리 현황: `review/code/2026/07/09/11_08_21/RESOLUTION.md` W5 에서 "코드 유지가 합리적(동일 도메인, message 로 구분)"으로 의도적 채택했고, spec 문서 반영은 `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md`(project-planner 위임, 비차단)로 추적 중이다. 신규로 차단할 사유는 없으나 코드 리뷰 관점에서는 여전히 유효한 관찰이므로 재기재.
  - 제안: 상기 follow-up plan 이 처리하는 spec §6 표 갱신(저장 시점 발행 경로 명시)을 완료할 것. 코드 레벨 분리(`INVALID_TRIGGER_PARAMETER_SCHEMA` 신설)는 선택.

- **[WARNING]** 저장 시점 검증 추가로, 이미 malformed 상태로 저장된 기존 워크플로우는 (트리거와 무관한 변경이라도) 이후 `POST /:id/save` 가 전부 400 으로 막힘 — `restoreVersion` 경로만 예외 처리됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger`(602-624), `saveCanvas`(388-408, `skipParamSchemaValidation` 기본값 `false`), `restoreVersion`(구 스냅샷 복원 시에만 `true` 전달)
  - 상세: 이번 fix 이전에는 `saveCanvas` 가 `config.parameters` 구조를 전혀 검증하지 않아 malformed 파라미터가 조용히 영속될 수 있었다. 이제 `restoreVersion`(과거 스냅샷 복원)은 게이트를 skip 하도록 수정됐지만, 일반 편집 흐름(`POST /:id/save`)은 여전히 무조건 검증한다 — 즉 이미 malformed 상태로 DB 에 있는 워크플로우를 트리거와 무관한 다른 노드만 고쳐 저장하려 해도 막힌다. 이는 이 fix 이전에는 성공하던 요청이 이제 400 이 되는 회귀성 동작 변화이며, 데이터 정리 마이그레이션은 diff 에 없다.
  - 처리 현황: `RESOLUTION.md` W6 에서 "신규 `/save` 차단은 의도(프론트 인라인 안내로 유도), 잔존 데이터 정리는 운영 후속"으로 명시적으로 채택한 트레이드오프. 새로 지적하는 사항이 아니라 계속 열려 있는(의도된) 하위 호환성 트레이드오프임을 재확인.
  - 제안: 배포 전 실제 malformed `config.parameters` 보유 워크플로우 존재 여부를 DB 에서 1회 조회해 규모를 파악하고, 있다면 정리 마이그레이션 또는 저장 시 자동 정정(빈 슬롯 제거) 경로를 고려.

- **[INFO]** 신규 400 코드가 프론트 `ERROR_KO` 매핑에 미등록 상태 유지
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (`ERROR_KO`) — `INVALID_TRIGGER_PARAMETERS` 항목 없음, 형제 코드 `GRAPH_VALIDATION_FAILED`(같은 `saveCanvas` 경로)는 존재
  - 상세: `INVALID_TRIGGER_PARAMETERS` 는 이번에 캔버스 저장 흐름에서도 사용자에게 노출될 수 있는 400 이 됐지만(트리거 설정 패널의 인라인 검증을 우회하는 경로, 예: 다른 편집기/직접 API 호출, 레거시 malformed 데이터 재저장), 한국어 매핑이 없어 영문 fallback 문구만 노출된다. `LOCALIZED_ERROR_CODES` 가 progressive allowlist 라 CI 실패는 아니다.
  - 제안: `ERROR_KO`/`LOCALIZED_ERROR_CODES` 에 등록 검토(선택, 비차단).

- **[INFO]** `saveCanvas` 의 Swagger `@ApiBadRequestResponse` description 이 신규 실패 사유를 구체적으로 언급하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:440-442` (`description: 'Manual Trigger 누락/중복 또는 입력값 검증 실패'`)
  - 상세: 문구가 포괄적("입력값 검증 실패")이라 기술적으로 신규 `INVALID_TRIGGER_PARAMETERS`(구조 위반) 케이스를 배제하진 않지만, `execute` 엔드포인트(242행, `'트리거 파라미터 검증 실패'`)처럼 명시적이지 않아 OpenAPI 문서 사용자가 이 신규 실패 모드를 쉽게 인지하기 어렵다.
  - 제안: 필수는 아니나 `'Manual Trigger 누락/중복, 파라미터 스키마 위반 또는 입력값 검증 실패'` 식으로 보강 권장.

- **[INFO]** 에러 응답 envelope·검증 위치·HTTP 상태 코드 선택 자체는 기존 컨벤션에 부합 (참고, 액션 불필요)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:614-622`
  - 상세: `{code, message, details}` 형태의 `BadRequestException`, `toTriggerParameterErrorDetails`(기존 execute/webhook 경로와 동일 `TriggerParameterErrorDetail[]` shape) 재사용, `saveCanvas` 트랜잭션/영속 이전 최상단에서 fail-fast 검증 모두 일관적이다. 400 상태 코드도 적절하다.

- **[INFO]** 엔진 재진입 input 수정(`reentryWorkflowInput`)은 API 응답 스키마 변경이 아니라 값 정정
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`reentryWorkflowInput` 헬퍼, 3개 재진입 호출부), `retry-turn.service.ts`(의도적으로 helper 미사용 + 교차주석)
  - 상세: `GET /api/executions/:id` / `node_execution.output_data` 로 노출되는 `output.parameters` 내용이 특정 재진입 경로(crash-redrive, stalled-redelivery)에서 빈 값이던 것을 durable 원본 입력으로 정정한다. 응답 envelope/스키마 구조 변경이 없고 회귀 방지 e2e(`manual-trigger-default-param.e2e-spec.ts`)로 결정적으로 커버되므로 하위 호환성 리스크는 낮다. `retry-turn.service.ts` 가 동일 helper 를 의도적으로 쓰지 않는 것도 문서화된 근거(완료된 중간 AI 노드만 재구동, 진입 트리거 미재실행)가 있어 일관성 문제는 아니다.

- **[INFO]** 신규 엔드포인트·URL 경로·페이지네이션·인증/인가 변경 없음
  - 상세: 이번 diff 는 기존 `POST /:id/save`/`POST /:id/execute`/재진입 내부 로직에 대한 수정으로, 새 라우트나 버전 변경, 목록 API 페이지네이션, 인증/인가(가드) 변경은 포함하지 않는다. `RolesGuard`/`WorkspaceId` 데코레이터 등 기존 인가 경계는 그대로다.

### 요약

핵심 API 표면 변경은 `POST /api/workflows/:id/save`(및 `restoreVersion` 이 재사용하는 동일 경로)에 Manual Trigger 파라미터 스키마 구조 검증을 추가해 신규 400 `INVALID_TRIGGER_PARAMETERS` 를 발행하는 것과, 실행 엔진 재진입 경로의 `output.parameters` 값을 정정하는 내부 버그 수정이다. 에러 envelope(`{code, message, details}`)·HTTP 상태 코드·검증 위치는 기존 컨벤션 및 execute/webhook 경로의 `TriggerParameterErrorDetail[]` shape 와 일관되고, 새 라우트·버전·페이지네이션·인증 변경은 없다. 직전 라운드(`review/code/2026/07/09/11_08_21`)에서 지적된 두 하위 호환성 이슈 — (1) 저장 시점 게이트로 인해 기존 malformed 데이터를 가진 워크플로우의 저장이 막히는 회귀성 동작, (2) 저장/실행 두 경로가 의미가 다른데도 동일 `code` 를 공유하는 점 — 은 팀이 RESOLUTION.md 에서 의도적 트레이드오프로 채택하고 spec 문서화·데이터 정리는 각각 후속 plan(`spec-update-manual-trigger-save-time-error-code.md`)과 운영 조치로 이관했다. `restoreVersion` 만 게이트를 skip 하도록 예외 처리해 과거 스냅샷 복원 회귀는 이미 해소됐다. 남은 항목(ERROR_KO 미등록, Swagger 문구 일반화)은 모두 INFO 급 문서/i18n 완결성 사안으로 API 계약 자체를 위협하지 않는다.

### 위험도

LOW
