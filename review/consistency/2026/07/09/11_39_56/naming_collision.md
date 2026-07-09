# 신규 식별자 충돌 검토 — spec/4-nodes/7-trigger/1-manual-trigger.md (impl-done)

## 검토 범위 메모

본 검토는 impl-done 모드다. `spec/4-nodes/7-trigger/1-manual-trigger.md` 본문 자체는 diff 없음(변경 없음) — 검토 대상은 이 spec 이 이미 선언한 계약을 구현이 새로 채운 코드(`workflows.service.ts`/`load-trigger-parameter-schema.ts`/`trigger-configs.tsx`/i18n 등)에서 **새로 도입된 식별자**가 기존 사용처와 충돌하는지다. 코드 확인은 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/manual-trigger-default-param-e0d395`)로 재확인했다.

## 발견사항

- **[WARNING]** `INVALID_TRIGGER_PARAMETERS` 에러 코드가 새 코드 경로(저장 시점)에서 재사용되지만, 기존 spec 문서 두 곳은 이 코드를 실행 경로 전용으로 문서화하고 있어 최신화가 필요
  - target 신규 사용처: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()` (L594-466 부근, diff L433-467) — `POST /api/workflows/:id/save` 저장 시점에 `validateTriggerParameterSchema(params)` 를 호출해 구조 위반(`invalid_schema`: 빈 이름·식별자 규칙 위반·중복·타입 오류) 을 감지하면 `BadRequestException({ code: 'INVALID_TRIGGER_PARAMETERS', ... })` 를 새로 throw 한다. (신규 e2e: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts` L671-699, `expect(save.body.error?.code).toBe('INVALID_TRIGGER_PARAMETERS')`.)
  - 기존 사용처(동일 코드, 다른 시점): `codebase/backend/src/modules/workflows/workflows.controller.ts` L295-315 — `POST /api/workflows/:id/execute` **실행 시점** `missing_required`/`coerce_failed`(그리고 이론상 `invalid_schema`) reason 에 대해 동일한 `INVALID_TRIGGER_PARAMETERS` 를 throw. spec 문서 3곳이 이 실행 경로만을 `INVALID_TRIGGER_PARAMETERS` 의 유일한 발행처로 명시한다:
    - `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표: `| Manual (주 실행 경로) | 400 BadRequest code INVALID_TRIGGER_PARAMETERS | workflows.controller.ts |` — "처리 위치" 컬럼이 `workflows.controller.ts` 하나뿐, `workflows.service.ts` 는 없음.
    - `spec/5-system/3-error-handling.md` L155: "Manual 실행 경로의 `INVALID_TRIGGER_PARAMETERS` 도 동일 헬퍼를 쓴다" — "실행 경로" 로 명시적 한정.
    - `spec/data-flow/10-triggers.md` L44-47: `POST /api/workflows/:id/execute` 시퀀스에서만 `Ctl-->>C: 400 INVALID_TRIGGER_PARAMETERS` 를 그린다. `spec/data-flow/11-workflow.md` 의 `POST /:id/save` 시퀀스(L44-45)는 "Manual Trigger 정확히 1개 (누락/중복 시 400)", "노드 label 중복 거부 (DUPLICATE_NODE_LABEL)" 만 나열하고 파라미터 스키마 검증/`INVALID_TRIGGER_PARAMETERS` 언급이 없다.
  - 상세: 코드 자체 관점에서는 `spec/conventions/error-codes.md` §1 의 "의미 기반 명명" 원칙(코드 이름은 *어디서* 났는지가 아니라 *무엇이* 잘못됐는지를 기술) 에 부합하는 재사용이라 이름 자체는 정당해 보인다 — `invalid_schema`/`missing_required`/`coerce_failed` 세 reason 모두 이미 spec §6 에서 동일 envelope(`INVALID_TRIGGER_PARAMETERS`) + `details[]` 세분화(`INVALID_SCHEMA`/`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`) 구조를 공유하도록 설계돼 있다. 다만 그 설계가 **어느 HTTP 엔드포인트에서 발행되는지**는 spec 3곳이 실행 경로(`/:id/execute`)로만 명시하고 있어, 저장 경로(`/:id/save`)가 같은 코드를 던지는 사실이 문서에 반영돼 있지 않다. 완전한 "다른 의미로 충돌"은 아니지만(둘 다 "트리거 파라미터가 유효하지 않다"는 동일 semantics), 발행 위치·발생 조건이 문서상 실행 경로 전용으로 못박혀 있어 spec 만 읽는 사람·외부 API 소비자가 저장 응답의 `INVALID_TRIGGER_PARAMETERS` 를 예상하지 못할 수 있다.
  - 제안: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표의 "처리 위치" 행에 `workflows.service.ts`(저장 시점 `invalid_schema` 전용) 를 추가하거나 별도 행으로 분리하고, `spec/data-flow/11-workflow.md` 의 `POST /:id/save` 시퀀스에 `INVALID_TRIGGER_PARAMETERS` 400 분기를 추가해 두 경로(저장/실행) 모두 문서화한다. 코드/이름 자체는 변경 불필요.

- **[INFO]** 신규 로컬 식별자(스코프 격리 확인, 충돌 없음)
  - `skipParamSchemaValidation` (workflows.service.ts, `saveCanvas`/`validateManualTrigger` 신규 파라미터) — 저장소 전체 grep 결과 다른 의미의 동명 식별자 없음.
  - `errorNameRequired` / `errorNameInvalid` / `errorNameDuplicate` (frontend i18n, `en`/`ko` `nodeConfigs.trigger.*`) — `nodeConfigs.trigger` 네임스페이스 아래 격리돼 있어 다른 노드 설정 사전 키와 충돌하지 않음.
  - `PARAM_NAME_RE` (`trigger-configs.tsx` 모듈 스코프 상수) — export 되지 않는 로컬 상수, 충돌 없음. spec §6 의 식별자 규칙(`^[A-Za-z_][A-Za-z0-9_]*$`)과 정확히 일치.
  - 신규 파일 `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.spec.ts`, `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts` — 기존 `*.spec.ts`/`*.e2e-spec.ts` 명명 컨벤션과 일치, 기존 파일과 경로 충돌 없음(둘 다 `new file mode`).
  - `NODE_TYPES.MANUAL_TRIGGER` 를 새 조회 조건으로 사용(`load-trigger-parameter-schema.ts`, `category: NodeCategory.TRIGGER` → `type: NODE_TYPES.MANUAL_TRIGGER`)한 것은 기존 상수 재사용이며 신규 식별자가 아님. 다만 `workflows.service.ts` 에는 동일 문자열(`'manual_trigger'`)을 담는 별도 로컬 상수 `MANUAL_TRIGGER_TYPE` 이 이미 존재(본 diff 이전부터, L31)해 두 이름이 같은 값을 병행 정의하는 상태가 유지된다 — 이번 diff 가 만든 문제는 아니므로 참고용으로만 남김.

## 요약

target spec(`1-manual-trigger.md`) 자체는 변경되지 않았고, 구현 diff가 도입한 로컬 식별자(`skipParamSchemaValidation`, 신규 i18n 키, `PARAM_NAME_RE`, 신규 테스트 파일 경로)는 스코프가 격리돼 있어 실질적 충돌이 없다. 유일하게 주목할 사안은 기존 에러 코드 `INVALID_TRIGGER_PARAMETERS` 가 이번 diff로 저장 시점(`POST /:id/save`) 경로에도 재사용된다는 점으로, 코드 자체 재사용은 프로젝트의 "의미 기반 명명" 규약에 부합하지만 spec 3곳(`1-manual-trigger.md` §6, `5-system/3-error-handling.md`, `data-flow/10-triggers.md`/`11-workflow.md`)이 이 코드를 실행 경로 전용으로만 문서화하고 있어 문서 최신화가 필요하다. 엄밀한 "다른 의미의 충돌"이라기보다 "기존 식별자의 사용 범위 확장이 문서에 반영되지 않은" 케이스에 가깝다.

## 위험도

LOW
