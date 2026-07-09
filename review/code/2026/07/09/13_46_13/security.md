# 보안(Security) Review

## 발견사항

- **[INFO]** 파라미터 식별자 정규식이 JS 예약 프로퍼티명(`__proto__`/`constructor`/`prototype`)을 배제하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:77`(`validateTriggerParameterSchema`, 기존) 및 이를 그대로 미러링한 신규 `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:PARAM_NAME_RE`, 그리고 이번에 새로 추가된 저장 시점 게이트 `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger`(내부적으로 동일한 `validateTriggerParameterSchema` 재사용)
  - 상세: 식별자 규칙 `/^[A-Za-z_][A-Za-z0-9_]*$/` 는 `__proto__`, `constructor`, `prototype` 같은 문자열도 유효한 이름으로 통과시킨다. `resolveTriggerParameters`(동일 파일 118~140행, 이번 diff 로 변경되지 않은 기존 코드)는 `resolved[def.name] = coerced` 형태로 일반 객체 리터럴에 직접 대입하므로, 파라미터 이름을 `__proto__` 로 설정하면 `resolved` 객체 자신의 `[[Prototype]]` 내부 슬롯을 덮어쓸 수 있다(전역 `Object.prototype` 오염은 아니며, 워크플로우 소유자 본인이 자신의 트리거 스키마에 정의하는 값이라 외부 공격자가 임의로 주입할 수 있는 경계는 아니다 — 편집 권한이 있는 동일 워크스페이스 사용자만 영향받는 자기 자신의 실행 컨텍스트). 이번 PR 은 정확히 이 검증 로직을 (a) 프론트에 새로 미러링하고 (b) 저장 시점 게이트로 강제 적용을 확대하는 두 지점에서 이 약점을 그대로 재사용/전파했다.
  - 제안: `validateTriggerParameterSchema` (및 프론트 `PARAM_NAME_RE` 사용처)에 `__proto__`/`constructor`/`prototype` 예약어 차단을 추가하는 defense-in-depth 강화를 권장한다. 심각도는 낮음(같은 사용자의 자기 소유 데이터, 크로스 테넌트 영향 없음) — 이번 PR 을 막을 사유는 아니나, 저장 시점 게이트를 신설한 김에 함께 반영하면 좋다.

- **[INFO]** 저장 시점 검증 실패 시 사용자가 제출한 파라미터 이름이 400 응답의 `details[].field` 로 그대로 반영됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:553-561`(`validateManualTrigger`), `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`(`toTriggerParameterErrorDetails`)
  - 상세: `field` 값은 사용자가 직접 입력한 파라미터 이름(`def.name`) 또는 인덱스 문자열이며 별도 이스케이프 없이 JSON 응답에 포함된다. 응답이 JSON API 이고 프론트가 React 로 렌더링(자동 이스케이프)하는 한 XSS 위험은 없으며, 이 값은 애초에 같은 요청자가 자신의 요청 본문에 넣은 값을 반사하는 것뿐이라(persist 되지 않고 저장은 거부됨) 추가 위험도 없다. 참고용 기록.

- **[INFO]** 이번 PR 의 핵심 변경(엔진 재진입 시 `savedExecution.inputData` 재사용, 트리거 노드 `type` 기반 조회, 저장 시점 스키마 검증)은 인젝션/인증/암호화/시크릿 관점에서 새로운 위험을 도입하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`reentryWorkflowInput`), `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts`, `codebase/backend/src/modules/workflows/workflows.service.ts`(`saveCanvas`/`validateManualTrigger`)
  - 상세: (1) `reentryWorkflowInput` 은 동일 `Execution` 레코드의 durable `inputData` 컬럼을 재사용할 뿐, 다른 실행/테넌트의 데이터를 끌어오지 않는다 — 크로스 테넌트 데이터 노출 없음. (2) `loadTriggerParameterSchema` 의 조회 기준을 `category=TRIGGER` → `type='manual_trigger'` 로 바꾼 것은 TypeORM `findOne({ where: {...} })` 파라미터 바인딩을 그대로 사용해 SQL 인젝션 여지가 없고, `workflowId` 스코프는 그대로 유지된다. (3) `saveCanvas`/`validateManualTrigger` 는 기존 `findById(id, workspaceId)` 워크스페이스 스코프 검증 이후에 실행되며, 신규 `skipParamSchemaValidation` 플래그는 `private validateManualTrigger` 의 내부 파라미터로만 존재하고 컨트롤러(`workflows.controller.ts:453`, `saveCanvas(id, workspaceId, user.sub, dto)`)는 이를 노출하지 않는다 — `restoreVersion` 내부 호출에서만 하드코딩된 `true` 로 전달되므로 사용자가 저장 시점 게이트를 우회할 API 경로가 없다. 하드코딩된 시크릿, 안전하지 않은 해시/암호화, 평문 전송 관련 변경도 없음.

- **[INFO]** 신규 e2e 전용 엔드포인트(`_test/simulate-execution-run-redelivery`) 사용은 기존의 다층 방어(레이스·환경변수·역할)로 이미 보호됨 (본 diff 가 신설한 게이트 아님, 확인 목적 기록)
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts`(신규 테스트, 해당 엔드포인트 호출) / `codebase/backend/src/modules/executions/executions.controller.ts:217,232-240`(기존 가드: `NODE_ENV==='test'` **AND** `E2E_TEST_HOOKS==='1'` **AND** `@Roles('owner')`)
  - 상세: 신규 e2e 스펙이 이 test-only 훅을 호출하지만, 훅 자체의 가드는 이번 diff 에서 변경되지 않았고 프로덕션 이미지(`NODE_ENV=production`, 플래그 미설정)에서는 활성화되지 않는다. 새로운 취약점을 추가하지 않는다.

## 요약

이번 diff 는 Manual Trigger `defaultValue` 미적용 버그의 근본 원인 3건(엔진 재진입 시 durable input 재사용, 트리거 노드 조회를 `category` 대신 `type` 기준으로 전환, 저장 시점 파라미터 스키마 구조 검증 신설)과 프론트 인라인 이름 검증을 다룬다. SQL/커맨드/경로 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 에러 노출 등 OWASP Top 10 관점의 실질적 취약점은 발견되지 않았다 — TypeORM 파라미터 바인딩이 일관되게 사용되고, 신규 `skipParamSchemaValidation` 내부 플래그는 API 표면에 노출되지 않으며, 재진입 시 재사용하는 입력값은 동일 실행(Execution)의 durable 데이터로 테넌트 경계를 넘지 않는다. 유일하게 주목할 만한 항목은 파라미터 이름 식별자 정규식이 `__proto__`/`constructor`/`prototype` 같은 JS 예약 프로퍼티명을 배제하지 않아 자기 소유 실행 컨텍스트 내에서 지역 객체의 프로토타입을 조작할 수 있는 여지(기존 코드에서 유래, 이번에 프론트/저장-시점 게이트로 전파)인데, 크로스 테넌트·전역 오염 영향이 없어 심각도는 낮다. 새로 추가된 저장 시점 검증은 이전에는 조용히 영속되던 malformed 데이터를 fail-closed 로 차단하는 방향이라 보안 관점에서는 오히려 개선이다.

## 위험도

LOW
