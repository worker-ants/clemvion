# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 다만 (1) 이번 PR 이 고치려던 "재진입 시 입력 소실" 버그 자체가 3개 dispatch 지점 중 2곳(`driveResumeAwaited`/`driveResumeFrame`)에서 실제 배선을 잠그는 테스트가 없어 향후 리팩터링으로 조용히 재발할 수 있고, (2) 저장 시점 스키마 게이트가 기존 malformed 워크플로우의 향후 모든 저장을 마이그레이션 없이 영구 차단하는 하위호환 리스크가 배포 전 미해소로 남아 있어 MEDIUM 판정. `documentation` reviewer 는 `ran` 목록엔 `success` 이나 `output_file` 이 디스크에 실제 생성되지 않아(known FS-write flakiness) 재시도 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 재진입 3개 dispatch 지점 중 2곳(`driveResumeAwaited`/`driveResumeFrame`)의 실제 배선(`input: this.reentryWorkflowInput(savedExecution)` 전달 여부)이 어떤 테스트로도 잠기지 않음 — 헬퍼 함수 자체만 격리 유닛 검증되고, e2e 는 `driveStuckRedrive` 경로만 결정적으로 재현. 향후 리팩터링에서 이 두 곳만 `input: {}` 로 되돌아가도 CI 가 잡지 못함 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2103`(driveResumeAwaited), `:2435`(driveResumeFrame) | `driveStuckRedrive` 기존 테스트 패턴(`runNodeDispatchLoop` spy + populated `inputData`)을 두 경로에도 적용해 `input` 인자 단언 추가, 또는 WAITING re-drive e2e 케이스 보강 |
| 2 | Testing | `retry-turn.service.ts` 의 "의도적 예외"(`input: {}` 유지, AI multi-turn retry 는 트리거 재실행 안 함)를 잠그는 회귀 테스트 부재 — 향후 "일관성을 위해" 이 경로도 `reentryWorkflowInput` 을 쓰도록 수정돼도 어떤 테스트도 실패하지 않음 | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:564-581` | mock `runNodeDispatchLoop` 호출 인자에 `input: {}` 단언 추가, 또는 통합 테스트에서 downstream `$input` 미해소를 검증 |
| 3 | API Contract / 하위호환성 | 저장 시점 파라미터 스키마 게이트가 이미 malformed 상태로 영속된 기존 워크플로우의 향후 모든 저장(트리거와 무관한 편집 포함, `SaveCanvasDto` 는 full-replace 계약)을 계속 차단 — 마이그레이션/백필 스크립트 없음. 이전 라운드(RESOLUTION W6)에서 이미 식별·이연됐으나 배포 시점까지 미해소 | `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger`(L586-611), `saveCanvas`(L386-399) | 배포 전 프로덕션 DB 에서 malformed `manual_trigger.config.parameters` 보유 워크플로우 존재 여부 조회 → 필요 시 백필 마이그레이션 또는 소유자 사전 안내 |
| 4 | Requirement / API Contract | `INVALID_TRIGGER_PARAMETERS` 에러 코드가 저장 시점(구조 위반, 신규)과 실행 시점(값 누락, 기존) 두 엔드포인트/실패 시점에 재사용되는데, spec §6 어디에도 저장 시점 발행이 명시돼 있지 않음(spec 이 애초에 구조 위반의 HTTP 코드를 규정한 적 없던 공백을 이번 구현이 채움). `details[]` 로만 두 케이스 구분 가능해 향후 ko 라벨 매핑 시 부적절한 문구 노출 위험 | `codebase/backend/src/modules/workflows/workflows.service.ts:595-609` vs `codebase/backend/src/modules/workflows/workflows.controller.ts:242` 인근; `spec/4-nodes/7-trigger/1-manual-trigger.md:161-179` | `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 대로 §6 표에 저장 시점 발행 행 추가(이미 project-planner 위임됨, 코드 되돌림 불필요 — spec 갱신만 남음) |
| 5 | Architecture | 저장 시점 검증(`validateManualTrigger`)이 기존 `NodeHandler.validate()` 다형적 진입점을 우회하고 `validateTriggerParameterSchema` 를 직접 재호출 — `ManualTriggerHandler.validate()` 가 함께 수행하는 `evaluateMetadataBlockingErrors` 검사가 저장 경로엔 없음. 현재는 `manualTriggerMetadata` 에 blocking rule 이 없어 결과가 우연히 동일하지만, 향후 blocking rule 추가 시 "저장 통과·실행 실패"가 재발할 수 있음(이번 버그와 같은 계열의 위험 재도입) | `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()`(L579-611) vs `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts` `validate()`(L85-100) | `saveCanvas` 가 `NodeHandlerRegistry.get(node.type).validate()` 를 노드 타입 무관하게 호출하도록 일반화하거나, 최소한 `ManualTriggerHandler.validate()` 결과를 재사용해 save/execute 두 경로를 단일화 |
| 6 | Maintainability | 파라미터 이름 식별자 정규식(`/^[A-Za-z_][A-Za-z0-9_]*$/`)이 프론트/백엔드 양쪽에 독립 하드코딩(SoT 부재) — 백엔드 쪽은 이름 있는 상수조차 아니며, drift 를 잡는 테스트도 없음. 모노레포에 이미 `@workflow/graph-warning-rules` 같은 프론트/백엔드 공유 패턴 선례가 있음에도 이번 규칙만 따르지 않음 | `codebase/frontend/.../trigger-configs.tsx:14-15`(`PARAM_NAME_RE`) vs `codebase/backend/.../resolve-trigger-parameters.ts:77` | 정규식을 `codebase/packages/` 공유 패키지로 이전(최소 조치: 백엔드 쪽 named export 상수화 + 양쪽 동일 소스 참조 + 동일성 단언 테스트 추가) |
| 7 | Maintainability | `trigger-configs.tsx` 리팩터링(화살표 함수 바디를 map 블록으로 전환) 과정에서 JSX 자식 요소 절반의 들여쓰기만 재정렬됨 — `<select>`/`<label>`/조건부 블록/description `<Input>` 이 실제 트리 구조(모두 `<div key={i}>` 자식)보다 한 단계 얕게 표시돼 눈으로 구조를 오독하기 쉬움(렌더링엔 영향 없음, 로컬 eslint 도 미검출) | `codebase/frontend/.../trigger-configs.tsx:107-143`(`<select>` ~ `</div>`) | 해당 블록을 자식 레벨(12칸)로 재정렬(에디터 reindent 또는 수동 정렬, 전체 파일 `prettier --write` 는 지양) |
| 8 | Maintainability | `saveCanvas`/`validateManualTrigger` 에 위치 기반 boolean 매개변수(`skipParamSchemaValidation`) 추가 — "boolean trap". 현재는 단일 플래그·단일 호출부(`restoreVersion`)라 심각하지 않으나, 두 번째 조건부 검증이 추가되면 인자 순서 조합 폭발로 이어지기 쉬움 | `codebase/backend/src/modules/workflows/workflows.service.ts:386-395`(`saveCanvas`), `472-479`(`restoreVersion` 호출부), `586-611`(`validateManualTrigger`) | 향후 플래그가 하나 더 필요해지면 `opts?: { skipParamSchemaValidation?: boolean }` 옵션 객체로 전환 검토(현재는 즉시 조치 불요) |
| 9 | Scope | `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts` 에 이번 작업과 무관한 모듈의 순수 포맷팅 diff(assertion 개행 스타일만 변경) 포함 — 커밋 메시지/RESOLUTION.md(W7)에 "lint 통과에 필요했던 사전 존재 prettier 에러"로 근거 명시, 이전 라운드에서도 이미 지적·수용됨 | `schedule-runner.service.spec.ts:321` 부근 | 조치 불요(이미 인지·문서화·수용됨). 향후 유사 상황은 별도 커밋으로 분리 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `trigger-configs.test.tsx` 의 중복 이름 테스트가 정확한 개수(2) 대신 `> 0` 만 확인 — "한쪽만 표시" 같은 회귀를 못 잡음 | `.../__tests__/trigger-configs.test.tsx:99-114` | `toBe(2)` 로 정밀화 |
| 2 | API Contract | Swagger(`@ApiBadRequestResponse`) 문서가 `POST /:id/save` 의 신규 실패 사유(트리거 파라미터 스키마)를 아직 반영하지 않음 | `codebase/backend/src/modules/workflows/workflows.controller.ts:440` | `description` 을 "그래프 검증·중복 라벨·Manual Trigger 파라미터 스키마 등"으로 보강 |
| 3 | API Contract | 프론트 `ERROR_KO` 매핑에 `INVALID_TRIGGER_PARAMETERS` 미등록 — 이번 diff 로 저장 흐름에서도 직접 노출 가능해졌으나(레거시 malformed 데이터 재저장 등) 영문 fallback 노출 가능 | `codebase/frontend/src/lib/i18n/backend-labels.ts` | `ERROR_KO`/`LOCALIZED_ERROR_CODES` 등록 검토(선택) |
| 4 | Maintainability | `validateManualTrigger` 내부에 plain-string(기존)과 구조화 `{code,message,details}`(신규) 두 에러 응답 스타일 공존 — 유지보수자 혼란 유발 가능 | `workflows.service.ts:593-601` vs `615-621` | 스코프 밖, 이 메서드 재손질 시 통일 검토 |
| 5 | Side Effect | `reentryWorkflowInput` fallback 이 `gatherNodeInput` 규칙상 Manual Trigger 진입 노드뿐 아니라 back-edge 루프 타깃·다중 미실행 predecessor merge 노드에도 적용되나, 신규 테스트는 진입 노드 케이스만 커버 | `execution-engine.service.ts` `reentryWorkflowInput`, `gatherNodeInput`(L5974-6031) | 필수 아님. back-edge/다중 predecessor 재진입 e2e 보강 권장 |
| 6 | User Guide Sync | 저장 시점 `INVALID_TRIGGER_PARAMETERS` 400 이 `02-nodes/triggers.mdx` 에는 반영됐으나 저장 차단 안내 전용 페이지 `05-run-and-debug/validation-errors.mdx`(현재 Parallel 중첩 규칙만 다룸)에는 미반영 | `codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.mdx` | 비긴급 — 노드별 저장 차단 규칙 목록으로 일반화할 때 편입 검토 |
| 7 | Requirement | 프론트 인라인 이름 검증(`nameError`)이 저장 버튼을 막지 않아 무효 이름 상태로 "Save" 시 서버 400 에 최종 의존 — 의도된 이중 방어 설계, spec 위반 아님 | `.../trigger-configs.tsx:32-39` | 조치 불요(설계 선택). 필요 시 저장 버튼 disable 백로그 검토 |
| 8 | Security | 저장 시점 파라미터 스키마 검증 추가는 방어적 강화(긍정적) — `skipParamSchemaValidation` 은 클라이언트가 제어 불가한 내부 전용 플래그로 기본값(`false`)이 안전 | `workflows.service.ts` `validateManualTrigger` | 없음(이미 안전하게 구현됨) |
| 9 | Architecture | `reentryWorkflowInput()` 헬퍼 추출로 3개 호출부의 중복 로직/주석이 한 곳(JSDoc)으로 통합됨 — 이전 라운드 maintainability WARNING("3중 반복 주석")이 같은 PR 내에서 해소됨을 확인(긍정적) | `execution-engine.service.ts` L1417-1439 | 없음(참고 기록) |
| 10 | Maintainability | e2e `poll()` 헬퍼가 공유되지 않고 파일마다 재정의됨(기존 10개 e2e 파일의 기존 컨벤션 답습, 이번 PR 신규 문제 아님) | `test/manual-trigger-default-param.e2e-spec.ts:54-69` | 스코프 밖. `test/helpers/` 공유 폴링 헬퍼 추출을 후속 백로그로 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 저장 시점 검증 추가는 방어적 강화, 취약점/우회 경로/인젝션 없음 |
| architecture | LOW | 저장 시점 검증이 `NodeHandler.validate()` 우회(향후 drift 위험), 정규식 SoT 부재. 순환 의존 없음 |
| requirement | LOW | 3대 근본원인 fix 실측 확인, 기능 완전성 문제 없음. 유일 잔여는 spec §6 문서화 gap(이미 위임됨) |
| scope | LOW | 무관 포맷팅 diff 1건(수용됨) 외 범위 1:1 일치. 1라운드 scope 이탈(즉시 store 커밋)은 이미 완전 원복 확인 |
| side_effect | LOW | `POST /:id/save` 동작 변경(문서화 완비), `reentryWorkflowInput` fallback 범위 확장 부분 테스트 갭 |
| maintainability | LOW | JSX 들여쓰기 오정렬, boolean trap, 정규식 중복 — 개별 사소하나 누적 시 인지 비용 상승 |
| testing | MEDIUM | 재진입 3곳 중 2곳 실제 배선 미검증, `retry-turn.service.ts` 의도적 예외 회귀 가드 부재. 그 외 계층은 견고(load-trigger-parameter-schema 신규 커버리지 등) |
| documentation | 재시도 필요 | `ran` 목록 success 이나 `output_file` 미생성(디스크 부재) — FS-write flakiness로 추정, 내용 미확보 |
| api_contract | MEDIUM | malformed 기존 워크플로우 저장 영구 차단(마이그레이션 없음), 에러코드 재사용이 spec 미반영 |
| user_guide_sync | NONE | 매트릭스 19행 중 `new-ui-string` 1건만 매칭, 같은 커밋에 이미 처리(i18n parity 등 guard test 전수 PASS) |

## 발견 없는 에이전트

없음 (읽어들인 9개 reviewer 모두 최소 INFO 이상의 기록을 남김).

## 권장 조치사항

1. `driveResumeAwaited`/`driveResumeFrame` 의 재진입 input 배선을 실제로 잠그는 회귀 테스트 추가 — 이번 PR 의 핵심 버그 재발 방지 실효성이 걸린 항목 (WARNING #1)
2. 배포 전 프로덕션 DB 에서 malformed `manual_trigger.config.parameters` 보유 워크플로우 조회, 필요 시 백필/사전 안내 (WARNING #3)
3. `retry-turn.service.ts` "의도적 예외"(트리거 재실행 안 함)를 실행 가능한 회귀 가드로 전환 (WARNING #2)
4. `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 후속 작업으로 spec §6 에 저장 시점 `INVALID_TRIGGER_PARAMETERS` 행 추가(project-planner 위임 완료, 진행 확인) (WARNING #4)
5. 저장 시점 검증과 `NodeHandler.validate()` 를 재수렴시키는 방안을 체크리스트에 남겨 향후 blocking rule 추가 시 즉시 대응 (WARNING #5)
6. 파라미터 이름 식별자 정규식을 공유 패키지로 이전하거나 최소 백엔드 쪽 상수화 + drift 방지 테스트 추가 (WARNING #6)
7. `trigger-configs.tsx` JSX 들여쓰기 정리, `skipParamSchemaValidation` boolean 플래그의 향후 옵션 객체 전환 검토 (WARNING #7, #8)
8. `documentation` reviewer 결과가 디스크에 없으므로 재실행하여 내용 확보

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 소스 코드 변경 시 항상 적용되는 안전장치 강제 포함 규칙에 의해 router 판단과 무관하게 실행됨)
  - **제외**: 표 (4명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위와 무관(성능 영향 경로 없음으로 분류) |
  | dependency | router 판단상 이번 diff 범위와 무관(의존성 변경 없음) |
  | database | router 판단상 이번 diff 범위와 무관(스키마/마이그레이션 변경 없음) |
  | concurrency | router 판단상 이번 diff 범위와 무관(동시성 제어 로직 변경 없음) |