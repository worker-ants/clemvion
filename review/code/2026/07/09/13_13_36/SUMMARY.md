# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 핵심 버그 수정("진짜 핵심"인 엔진 재진입 시 durable input 전달)을 결정적으로 검증하는 회귀 테스트가 unit·e2e 어디에도 없어 재발 방지 게이트가 없는 상태로 머지된다(CRITICAL 1건). 그 외 보안·아키텍처 관점 실질 결함은 없으나, 3개 reviewer(requirement/scope/api_contract) 산출물이 status=success 로 보고됐음에도 디스크에 파일이 생성되지 않아 내용을 통합할 수 없었다(데이터 갭, 아래 별도 명시).

## 데이터 갭 — success 로 보고됐으나 output_file 이 디스크에 없음

`requirement`, `scope`, `api_contract` 3개 reviewer 는 매니페스트상 `status=success` 이나, 해당 `output_file`(`requirement.md`, `scope.md`, `api_contract.md`)이 세션 디렉토리에 실제로 생성되어 있지 않다(`find` 로 재확인 완료, 존재하지 않음). 알려진 "Workflow FS-write flakiness"(reviewer가 성공했다고 보고해도 파일 쓰기가 비결정적으로 누락되는 현상)와 일치하는 패턴이다. 이 3개 reviewer 의 발견사항은 본 통합 보고서에 반영되지 못했으며, **requirement-reviewer 산출물 부재로 인해 `[SPEC-DRIFT]` 태그 유무도 확인 불가**하다.

- 제안: 호출자가 세 reviewer 를 직접 재실행(Agent fan-out)해 산출물을 확보한 뒤 본 SUMMARY 를 갱신할 것. 특히 requirement-reviewer 는 spec 정합성/SPEC-DRIFT 판정을 담당하므로 누락 리스크가 크다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 이번 PR의 "진짜 핵심" 근본원인 수정(엔진 재진입 시 durable `Execution.inputData` 전달)을 결정적으로 재현·검증하는 회귀 테스트가 unit·e2e 어디에도 없다. Unit(`execution-engine.service.spec.ts`)은 `runNodeDispatchLoop` 자체를 `jest.fn()` 으로 통째로 mock해 실제 `input` 계산 로직이 실행되지 않고 `toHaveBeenCalledWith` 로 인자를 검증하는 곳도 0건. 신규 e2e(`manual-trigger-default-param.e2e-spec.ts`)는 헤더 주석대로 stalled-redelivery를 의도적으로 피하는 정상 1-shot 경로만 수행해 재진입 자체가 발생하지 않는다. 기존 `execution-crash-redrive`/`execution-stalled-redelivery` e2e 는 트리거가 이미 완료된 뒤의 크래시만 합성해 "미완료 진입 노드의 재진입"이라는 이 fix 의 정확한 시나리오를 구조적으로 발생시키지 않는다(side_effect 리뷰도 동일 갭을 WARNING으로 독립 확인). | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`driveResumeAwaited` ~L2067-2083, `driveResumeFrame` ~L2408-2419, `driveStuckRedrive` ~L3188-3203); `execution-engine.service.spec.ts`; `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts` | `execution-stalled-redelivery.e2e-spec.ts` 의 `_test/simulate-execution-run-redelivery` 훅 패턴을 재사용해 "트리거가 아직 완료되지 않은 시점에 재진입"을 결정적으로 유발하고 `output.parameters` 보존을 단언하는 e2e 추가. 최소한 unit 에서 `runNodeDispatchLoop` 를 `jest.spyOn`(전체 mock 아님)으로 잡아 세 호출부가 `input: savedExecution.inputData` 를 넘기는지 assert. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / maintainability / documentation (3개 reviewer 중복 지적) | `driveResumeFrame` 재진입 지점의 신규 주석이 `resumeGraphAfterRetry` 를 근거로 인용하지만, 그 함수는 이 PR 이 의도적으로 배제한 4번째 재진입 지점이며 실제로는 **정반대**(`input: {}` 유지)로 동작한다. 향후 유지보수자가 이 주석을 따라가 "4개 재진입 지점이 전부 동일하게 durable input 을 쓴다"고 오해하면 §retry 의 의도된 `$input` 미해소 동작을 깨뜨릴 위험이 있다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2417-2419` vs `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:564-573` | 참조 대상을 상세 근거가 실제로 있는 `driveResumeAwaited`(~L2067-2075)로 정정. 장기적으로는 공유 helper 로 추출해 세 지점이 동일 문구/함수를 참조하게 하면 이런 오기 자체가 발생하지 않음(아래 #3과 함께 처리 가능). |
| 2 | architecture | 저장 시점 검증(`validateManualTrigger`)이 `NodeHandler.validate()` 다형적 진입점을 우회 — `validateTriggerParameterSchema` 만 직접 재호출하고 `evaluateMetadataBlockingErrors` 는 호출하지 않는다. 현재는 `manualTriggerMetadata` 에 `blockingRule` 이 없어 결과가 우연히 동일하지만, 향후 blocking rule 추가 시 저장 시점 게이트만 조용히 뒤처져 "저장은 통과, 실행은 실패"가 재발할 수 있다. (선행 라운드에서 동일 지적, `details[]` 구조화 포맷 보존을 위한 의도적 선택으로 근거 있게 수용됨 — 그 판단은 타당하나 `evaluateMetadataBlockingErrors` 누락이라는 좁은 완전성 갭은 별도로 남음) | `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()` L579-611 vs `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts` `validate()` L86-97 | 급하지 않음(현재 동작 영향 없음). `ManualTriggerHandler.validate()` 가 구조화 스키마 에러 + blocking 에러를 함께 반환하도록 확장하거나, `evaluateMetadataBlockingErrors` 를 `validateManualTrigger` 에서도 병행 호출. |
| 3 | maintainability | "재진입 시 durable trigger input 재사용" 로직이 3개 호출부(+반대 결론의 4번째 호출부)에 헬퍼 없이 매번 산문 주석으로 반복 서술되어 규칙의 단일 진실 지점이 없다. 이 중 2곳(`driveResumeFrame`, `driveStuckRedrive`)의 신규 주석은 파일의 지배적 한국어 컨벤션에서 벗어나 영어로 작성됨(선행 라운드 WARNING 미해소, RESOLUTION.md 에 명시적 처분 없음). | `execution-engine.service.ts:2068-2076`(한국어), `:2417-2418`(영어), `:3199-3203`(영어); `retry-turn.service.ts:565-573`(한국어, 반대 결론) | `private resolveReentryTriggerInput(savedExecution)` 같은 helper 로 추출해 규칙을 한 곳에 문서화하고 4개 호출부가 동일 함수/짧은 참조 주석만 남기도록 정리. 영어 주석 2곳은 한국어로 통일. |
| 4 | maintainability / architecture (중복) | `saveCanvas` 의 신규 5번째 파라미터(`skipParamSchemaValidation`)를 `restoreVersion` 이 위치 인자 `true` 로 호출 — 이름 없는 boolean literal(boolean trap). 정의부에는 설명 주석이 있지만 호출부(`saveCanvas(..., true)`)만 봐서는 의미를 알 수 없다. | `codebase/backend/src/modules/workflows/workflows.service.ts:472`(호출부), `:386-390`(정의부) | 인라인 주석(`/* skipParamSchemaValidation */ true`) 추가, 또는 `{ skipParamSchemaValidation: true }` 옵션 객체로 전환. |
| 5 | architecture | 파라미터 이름 식별자 정규식(`/^[A-Za-z_][A-Za-z0-9_]*$/`)이 프론트/백엔드에 독립 리터럴로 이중 정의되어 SoT 가 없음. 모노레포에 `@workflow/graph-warning-rules` 같은 공유 패키지 선례가 있음에도 이 규칙은 그 패턴을 따르지 않아, 백엔드 규칙이 바뀌면 프론트가 조용히 뒤처져 "프론트 통과 → 저장 시 400" 회귀가 재발할 수 있다. (선행 라운드에서 이미 지적 → RESOLUTION.md 가 "저위험, 백로그" 로 명시적으로 이연한 항목, 이번 PR 을 막을 사안 아님) | `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:15` vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:77` | 식별자 정규식을 `packages/`(또는 `packages/sdk`) 공유 모듈로 추출. 백로그 처리 방침 자체는 유지 가능. |
| 6 | user_guide_sync | Manual Trigger 파라미터 이름 검증이 이번 PR 로 **저장 시점**(`POST /:id/save`)에도 강제되는데, 유저 가이드(`02-nodes/triggers.mdx`/`.en.mdx`)의 Callout 은 여전히 "실행 시점에만 거부"로 읽히는 문구로 stale 하다. 기존 후속 plan(`spec-update-manual-trigger-save-time-error-code.md`)은 **내부 spec 문서만** 반영 대상으로 명시하고 있어, 사용자가 실제로 열람하는 이 두 유저 가이드 파일은 어디에도 추적되지 않는 별개의 갭이다. | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:61-63`, `triggers.en.mdx:50-52` | Callout 을 "저장 시점(`Save`)에도 즉시 거부돼요" 로 보강하거나, 프론트 인라인 에러 UI(`errorNameRequired`/`errorNameInvalid`/`errorNameDuplicate`)와 함께 UX 를 언급. `spec-update-manual-trigger-save-time-error-code.md` 체크리스트에 이 두 파일 추가 권고. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `workflows.service.spec.ts` 신규 400 케이스가 `details[]` 의 `field`/`code` 매핑을 검증하지 않고 최상위 `code` 만 확인(e2e 도 동일하게 얕음). `toTriggerParameterErrorDetails` 자체는 별도 유닛에서 커버되어 중대 갭은 아님. | `codebase/backend/src/modules/workflows/workflows.service.spec.ts` L326-357 | 최소 한 케이스에서 `response.details` 에 `{ field, code: 'INVALID_SCHEMA', ... }` 형태가 담기는지 확인. |
| 2 | testing | `trigger-configs.test.tsx` 의 중복 이름 케이스가 `getAllByText(...).length > 0` 로만 확인해 "적어도 하나" 만 검증 — 정확한 개수/양쪽 슬롯 여부는 놓칠 수 있음. | `codebase/frontend/.../__tests__/trigger-configs.test.tsx` L704-719 | `.toBe(2)` 로 강화하거나 각 슬롯 에러 텍스트를 개별 조회. |
| 3 | maintainability | `MANUAL_TRIGGER_TYPE`(로컬 리터럴) vs `NODE_TYPES.MANUAL_TRIGGER`(공유 상수) 이중 정의 — 이번 PR 이 "트리거 리터럴 단일 진실 지점" 취지로 `load-trigger-parameter-schema.ts` 는 공유 상수로 옮겼지만 `workflows.service.ts` 자신의 로컬 리터럴은 그대로 둠. 현재 동일 문자열이라 기능 문제는 없음. | `codebase/backend/src/modules/workflows/workflows.service.ts:31` vs `load-trigger-parameter-schema.ts` | 다음에 이 파일을 손댈 때 `MANUAL_TRIGGER_TYPE` 를 `NODE_TYPES.MANUAL_TRIGGER` 로 교체해 통합. |
| 4 | architecture | `WorkflowsService` 가 `execution-engine/utils,types` 를 서비스 레이어까지 직접 import — 기존 단방향 결합 패턴의 연장이라 순환 의존은 없으나, "트리거 파라미터 스키마 검증"이라는 노드-설계-시점 관심사가 `execution-engine/utils/` 에 위치한다는 배치 자체가 모듈 경계를 흐림(WARNING #2 와 결합해서 보면 재사용을 어렵게 만드는 근본 원인). | `codebase/backend/src/modules/workflows/workflows.service.ts` 신규 import 2개 | 즉시 조치 불요. 장기적으로 트리거 파라미터 스키마 검증기를 `nodes/trigger/manual-trigger/` 아래로 옮기거나 `NodeHandler.validate()` 단일 진입점으로 수렴 고려. |
| 5 | documentation | e2e 헤더 주석의 "documented limit"(재진입 시 `$input` 미해소) 인용이 실제로는 AI multi-turn retry 전용 메커니즘을 가리켜, 이번 diff 가 고친 `driveStuckRedrive` 의 별개 이슈와 혼동 소지(이전 라운드부터 미수정, 우선순위 낮음). | `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts:17-20` | 낮은 우선순위. "AI Agent retry 의 `$input` 미해소(별개 메커니즘)" 로 명시하거나 실제 e2e 타이밍 이슈로 재서술. |
| 6 | documentation | CHANGELOG 의 `(a)/(b)/(c)` 레터링이 plan 문서의 동일 레터링과 반대 항목을 가리켜 두 문서를 교차 대조할 때 혼동 소지(각 문서는 자기완결적이라 실질 혼란은 낮음). | `CHANGELOG.md:35-40` vs `plan/in-progress/manual-trigger-default-param.md:19-21` | 조치 불요(사소). 향후 유사 항목에서 레터링 재사용 회피 권장. |
| 7 | user_guide_sync | 재사용된 `INVALID_TRIGGER_PARAMETERS` 코드가 `ERROR_KO`/`LOCALIZED_ERROR_CODES` 에 여전히 미등록 — 이번 PR 이 새로 만든 결함은 아니나(pre-existing), 저장 시점 발행 지점이 추가되며 사용자가 이 미등록 상태를 마주칠 빈도가 늘어남. | `codebase/backend/src/modules/workflows/workflows.service.ts:594-616`(신규 발행 지점), `codebase/frontend/src/lib/i18n/backend-labels.ts` | 필수 아님. `ERROR_KO`/`LOCALIZED_ERROR_CODES` 에 `INVALID_TRIGGER_PARAMETERS` 등록을 후속 plan 에 포함 검토. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 코드 경로 전부 파라미터 바인딩/ORM 사용, 인가 우회·시크릿 노출·인젝션 벡터 없음. 저장 시점 검증 우회 플래그(`skipParamSchemaValidation`)는 공개 API 에서 도달 불가 확인. |
| architecture | LOW | `NodeHandler.validate()` 우회(WARNING, 백로그 수용됨), 식별자 정규식 이중정의(WARNING, 백로그), `saveCanvas` boolean trap 등 INFO 다수. 핵심 fix 3건은 레이어 책임 경계 준수, 프론트 undo 파괴 부작용은 되돌림으로 해소 확인. |
| requirement | 확인 불가 | output_file(`requirement.md`) 미생성으로 내용 확인 불가 — 데이터 갭 섹션 참고. |
| scope | 확인 불가 | output_file(`scope.md`) 미생성으로 내용 확인 불가 — 데이터 갭 섹션 참고. |
| side_effect | MEDIUM | 재진입 dispatch fix 를 결정적으로 검증하는 테스트 부재(WARNING, testing 의 CRITICAL 과 동일 이슈), `driveResumeFrame` 주석 오참조(WARNING). 그 외 `saveCanvas` 하위호환, `loadTriggerParameterSchema` 5개 호출부 일괄 적용은 확인 완료. |
| maintainability | LOW | `driveResumeFrame` 주석 오참조(WARNING), 영어 주석 컨벤션 이탈(WARNING), durable input 로직 중복·SoT 부재(WARNING), boolean trap(WARNING). 핵심 수정 3건 자체는 네이밍·복잡도 양호. |
| testing | HIGH | 핵심 fix(엔진 재진입 durable input)에 대한 결정적 회귀 테스트 부재(CRITICAL). `type` 기반 조회·저장 시점 검증 hardening 은 견고하게 테스트됨. |
| documentation | LOW | `driveResumeFrame` 주석 오참조 재확인(WARNING, 중복). spec 동기화 갭은 이미 별도 follow-up plan 으로 비차단 격리 확인. CHANGELOG/JSDoc/spec 인용 실측 정확도 양호. |
| api_contract | 확인 불가 | output_file(`api_contract.md`) 미생성으로 내용 확인 불가 — 데이터 갭 섹션 참고. |
| user_guide_sync | MEDIUM | 저장 시점 검증 추가가 유저 가이드에 미반영(WARNING, 어디에도 추적 안 됨). `ERROR_KO` 미등록은 pre-existing(INFO). |

## 발견 없는 에이전트

- security — 발견된 취약점 없음(전 항목 INFO, 확인 목적 기록만).

## 권장 조치사항

1. (CRITICAL) 엔진 재진입 시 durable input 전달 fix 에 대한 결정적 회귀 테스트를 추가한다 — `_test/simulate-execution-run-redelivery` 류 훅으로 "트리거 미완료 상태에서 재진입"을 유발하는 e2e, 또는 최소 `runNodeDispatchLoop` 를 spy 로 잡는 unit assertion.
2. requirement/scope/api_contract 3개 reviewer 를 재실행해 누락된 산출물을 확보하고 본 SUMMARY 를 갱신한다(특히 requirement-reviewer 의 SPEC-DRIFT 판정 여부 미확인 상태).
3. `driveResumeFrame` 신규 주석의 `resumeGraphAfterRetry` 오참조를 `driveResumeAwaited` 로 정정한다(3개 reviewer 중복 지적, 향후 유지보수자 오인 위험).
4. 유저 가이드(`02-nodes/triggers.mdx`/`.en.mdx`)에 저장 시점 파라미터 이름 검증 동작을 반영하고, 기존 spec 동기화 follow-up plan 체크리스트에 이 두 파일을 추가한다.
5. (여유 있을 때) durable input 재사용 로직을 helper 로 추출해 SoT 를 만들고, 영어 주석 2곳을 한국어로 통일하며, `saveCanvas` boolean 인자를 옵션 객체 또는 인라인 주석으로 개선한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 표 참고 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 소스 코드/문서 변경에 대한 항상-적용 규칙으로 강제 포함됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단으로 제외 (본 매니페스트에 상세 사유 미포함, 성능 영향 경로 아님으로 판단된 것으로 추정) |
  | dependency | 라우터 판단으로 제외 (이번 diff 는 신규 npm 패키지 추가 없음 — security 리뷰가 별도로 확인) |
  | database | 라우터 판단으로 제외 (신규 마이그레이션/스키마 변경 없음) |
  | concurrency | 라우터 판단으로 제외 |