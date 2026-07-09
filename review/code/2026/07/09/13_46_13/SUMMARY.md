# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없음. 기능적으로는 근본원인 3건(엔진 재진입 durable input 미사용, 트리거 조회 `category`→`type`, 저장 시점 파라미터 스키마 미검증) fix 가 spec 과 line-level 로 일치하고 e2e/unit 으로 검증됐으나, `testing` 리뷰어가 지적한 **핵심 fix(재진입 durable input) 3개 호출부 중 2개(`driveResumeAwaited`/`driveResumeFrame`)에 대한 회귀 방지 테스트 공백**이 실질적 위험으로 남아 있어 MEDIUM 으로 판정. 그 외 발견은 대부분 이미 이전 라운드(`review/code/2026/07/09/11_08_21/RESOLUTION.md`)에서 accept 된 트레이드오프의 재확인이거나 SPEC-DRIFT/문서 정합성 수준. 또한 `scope`/`user_guide_sync` 두 reviewer 는 `success` 로 보고됐으나 output 파일이 생성되지 않아(FS-write 비결정성, 기존에도 관측된 현상) 실제 검토 결과를 확인할 수 없다 — 재시도 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 핵심 fix(재진입 durable input) 3개 호출부 중 `driveResumeAwaited`/`driveResumeFrame` 2곳은 이 fix 를 직접 검증하는 테스트가 없음. 기존 스위트는 `runNodeDispatchLoop` 를 완전 mock 하고 `input` 인자를 한 번도 assert 하지 않아, 이 2곳에서 동일 버그(재진입 시 `input:{}`로 되돌아감)가 재발해도 잡히지 않음 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`reentryWorkflowInput` L1471-1483, 호출부 L2102/L2434/L3216) | `reentryWorkflowInput` 순수함수 단위 테스트 추가(inputData 있음/undefined/null) + 기존 `driveResumeAwaited`/`driveResumeFrame` mock 테스트 중 하나에 `toHaveBeenCalledWith(expect.objectContaining({ input: savedExecution.inputData }))` 인자 검증 추가 |
| 2 | side_effect | 재진입 dispatch 의 `input` 폴백 적용 범위가 코드 주석("미완료 entry 노드")보다 넓음 — `gatherNodeInput` 폴백은 순수 entry 노드뿐 아니라 back-edge 재진입 타깃·다중입력 전부 미실행 노드에도 동일 적용됨(정상 실행 경로와 일치시킨 것이라 신규 미검증 동작은 아니나 문서·테스트 공백) | `execution-engine.service.ts:1456-1478`(`reentryWorkflowInput` docblock), `:5978-6017`(`gatherNodeInput`) | 주석을 "predecessor 미실행 노드 전체(entry + back-edge 재진입)"로 정정, 백엣지 재구동 e2e 케이스 추가 검토 |
| 3 | maintainability | 신규 `reentryWorkflowInput` 삽입 위치로 인해 기존 `runNodeDispatchLoop` 의 40줄 JSDoc 이 자신이 설명하는 함수 선언과 분리됨(orphaned doc comment) — TypeDoc/에디터 hover 가 잘못된 함수에 문서를 연결할 수 있음 | `execution-engine.service.ts:1417-1478` | `reentryWorkflowInput`(+JSDoc)을 `runNodeDispatchLoop` JSDoc 앞 또는 함수 본문 뒤로 이동해 doc-선언 인접성 복원 |
| 4 | documentation | CHANGELOG 항목 제목의 spec 섹션 태그(`§4/§5.1`)가 본문 SoT 각주 범위(`§4/§5.1/§6`)보다 좁음 — 다른 항목들의 제목/본문 일치 관례에서 벗어남 | `CHANGELOG.md` L9 vs L13 | 제목 태그를 `§4/§5.1/§6` 으로 맞추거나 좁힌 의도를 명시 |
| 5 | documentation | 코드 주석과 spec §6 표가 저장 시점 체크포인트를 "handler.validate" 로 표기하지만 실제로는 `NodeHandler.validate()`/`ManualTriggerHandler.validate()` 를 호출하지 않고 `WorkflowsService.validateManualTrigger()` 가 `validateTriggerParameterSchema()` 를 직접 호출하는 우회 구현 — 후속 spec 정리 plan 의 TODO 에 이 네이밍 불일치 정정 항목이 없음 | `workflows.service.ts`(`validateManualTrigger` 신규 주석) vs `spec/4-nodes/7-trigger/1-manual-trigger.md §6` | `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 에 "handler.validate 표현이 실제 우회 구현임을 각주로 명시" 항목 추가 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] 저장 시점(`saveCanvas`)에 재사용된 `INVALID_TRIGGER_PARAMETERS` 최상위 에러코드가 spec §6 "처리 위치" 표(실행 시점 `missing_required` 사용처만 문서화)와 `data-flow/10-triggers.md`에 반영돼 있지 않음. 코드가 잘못된 것이 아니라 — spec §6 이 "저장 시점 구조 위반을 잡는다"고 규정한 요구사항을 이번 fix 가 처음 실제 구현했고, 서로 다른 두 실패 상황(저장 시 구조 위반 vs 실행 시 입력값 검증 실패)에 같은 `code`(details 로 구분)를 재사용하는 합리적 확장이라 spec 표가 이 사용처를 못 따라간 것 (requirement, api_contract 공통 지적) | `workflows.service.ts:611-624`(`validateManualTrigger`) vs `spec/4-nodes/7-trigger/1-manual-trigger.md:161-183` §6 표 | 코드 변경 불필요. `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md`(이미 추적 중, project-planner 위임)를 통해 §6 표에 "저장 시점 발행" 행 추가 + `data-flow/11-workflow.md`/`10-triggers.md`/`error-handling.md` 동기화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 파라미터 식별자 정규식(`/^[A-Za-z_][A-Za-z0-9_]*$/`)이 `__proto__`/`constructor`/`prototype` JS 예약 프로퍼티명을 배제하지 않음 — 자기 소유 실행 컨텍스트 내 로컬 객체 prototype 조작 여지(크로스 테넌트/전역 오염 없음, 기존 코드에서 유래해 이번에 프론트/저장게이트로 전파) | `resolve-trigger-parameters.ts:77`, 프론트 `trigger-configs.tsx PARAM_NAME_RE`, `workflows.service.ts validateManualTrigger` | defense-in-depth 로 예약어 차단 추가 검토(비차단) |
| 2 | 하위호환성(requirement/side_effect/api_contract 공통) | 이미 malformed `config.parameters` 로 영속된 기존 워크플로우는 신규 저장 게이트로 인해 트리거와 무관한 편집이라도 이후 모든 `/save` 가 400 으로 막힘. `restoreVersion` 만 `skipParamSchemaValidation=true` 로 예외 처리됨, 백필/정리 마이그레이션은 diff 에 없음 | `workflows.service.ts:586-624`(`validateManualTrigger`) | 이미 `RESOLUTION.md` W6 로 "의도된 트레이드오프, 운영 후속" accept — 배포 전 실 데이터에서 malformed 보유 워크플로우 존재 여부 조회 권장(재확인, 신규 차단 아님) |
| 3 | 테스트/문서 공통 | `INVALID_TRIGGER_PARAMETERS` 가 프론트 `ERROR_KO`/`LOCALIZED_ERROR_CODES` 매핑에 없음(신규 갭 아님, 저장 경로 추가로 노출 표면만 확대) | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 선택적으로 등록 검토(progressive allowlist라 CI 비차단) |
| 4 | testing | `retry-turn.service.ts` 의 "의도적 예외"(재진입 시 `input:{}` 유지)를 고정하는 회귀 테스트 없음 | `retry-turn.service.ts:565-577`, `retry-turn.service.spec.ts` | 관련 mock 테스트에 `toHaveBeenCalledWith(expect.objectContaining({ input: {} }))` 불변식 assert 추가 |
| 5 | testing | `workflows.service.spec.ts` 신규 400 테스트가 top-level `code` 만 확인하고 `details[]` 페이로드 내용은 검증하지 않음 | `workflows.service.spec.ts` L497-524 | 우선순위 낮음 — `details: [expect.objectContaining({ field, ... })]` 수준 assert 보강 검토 |
| 6 | testing | 프론트 `PARAM_NAME_RE` 와 백엔드 식별자 정규식이 현재는 우연히 동일하나 이 일치를 보장하는 parity 테스트가 없음(architecture 리뷰 SoT 부재 지적과 연결) | `trigger-configs.tsx:15` vs `resolve-trigger-parameters.ts:77` | 공유 패키지 추출 전 임시로 정규식 소스 일치 assert 하는 parity 테스트 추가 검토 |
| 7 | maintainability | `trigger-configs.tsx` JSX 블록 들여쓰기 혼재 — 기존 라운드(`11_08_21`)에서 이미 지적·의도적 보류(eslint 통과, CI 비영향) | `trigger-configs.tsx:107-143` | 우선순위 낮음, `eslint --fix` 로 재포맷 |
| 8 | documentation | plan 테스트 체크리스트에 되돌려진(CRIT-1 revert) 기능을 가리키는 미체크 항목이 그대로 남아 "미완료 작업"으로 오독 가능 | `plan/in-progress/manual-trigger-default-param.md` "## 테스트" 섹션 | "CRIT-1 되돌림으로 해당 없음" 각주 추가 |
| 9 | documentation | CHANGELOG 와 plan 문서가 동일 근본원인 집합에 서로 다른 (a)/(b)/(c) 라벨 사용 — 교차 참조 시 혼동 가능 | `CHANGELOG.md` vs `plan/in-progress/manual-trigger-default-param.md` | 필수 아님, 향후 라벨 승계 또는 짧은 태그 사용 권장 |
| 10 | api_contract | `saveCanvas` Swagger `@ApiBadRequestResponse` description 이 신규 `INVALID_TRIGGER_PARAMETERS`(구조 위반) 실패 사유를 구체적으로 언급하지 않음(포괄 문구) | `workflows.controller.ts:440-442` | 문구를 `execute` 엔드포인트 수준으로 구체화 검토(비차단) |

## 발견 없는 에이전트

없음 — 실행된 9개 reviewer 중 7개(security, requirement, side_effect, maintainability, testing, documentation, api_contract)는 최소 1건 이상의 발견을 보고했다. `scope`, `user_guide_sync` 는 output 파일이 생성되지 않아(§재시도 필요 참고) 결과를 확인할 수 없음.

## 재시도 필요

- **`scope`**, **`user_guide_sync`** — manifest 상 `status=success` 로 보고되었으나 대응 output 파일(`scope.md`, `user_guide_sync.md`)이 세션 디렉터리에 생성되어 있지 않음(`_prompts/scope.md`, `_prompts/user_guide_sync.md` 프롬프트 파일만 존재). 과거에도 관측된 reviewer FS-write 비결정성 현상으로, 해당 두 reviewer 의 실제 리뷰 결과는 이번 통합 보고서에 반영되지 못했다. 특히 `scope` 는 이번 diff 가 "재진입 3개 호출부 통합 리팩터 + JSDoc 재배치 + 곁가지 타입 캐스트 제거"(maintainability/side_effect 가 이미 스코프 관련 관찰을 일부 언급) 등 스코프 판단이 필요한 변경을 포함하므로 재실행 권장.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 실질 취약점 없음(인젝션/인증/시크릿). `__proto__` 등 예약어 미배제만 INFO |
| requirement | LOW | 근본원인 3건 spec 과 line-level 일치 확인. SPEC-DRIFT 1건 + 백필 부재 재확인(둘 다 이미 추적 중) |
| side_effect | LOW | 재진입 input 폴백 적용범위가 주석보다 넓음(기존 정상경로와 일치시킨 것, 신규 위험 아님) |
| maintainability | LOW | JSDoc orphaned 이슈 1건(기능 영향 없음). 이전 라운드 WARNING 은 잘 해소됨 |
| testing | MEDIUM | 핵심 fix 3개 호출부 중 2개에 회귀 방지 테스트 공백 |
| documentation | LOW | 교차 문서 정합성 사소한 이슈 다수(모두 병합 비차단) |
| api_contract | LOW | 신규 400 게이트는 컨벤션 부합. 하위호환성/코드재사용 이슈는 이미 accept 된 트레이드오프 재확인 |
| scope | 미확인 | output 파일 미생성 — 재시도 필요 |
| user_guide_sync | 미확인 | output 파일 미생성 — 재시도 필요 |

## 권장 조치사항

1. (최우선) `driveResumeAwaited`/`driveResumeFrame` 재진입 경로에 `input` 인자 검증 테스트 추가 — 이번에 고친 핵심 버그의 재발 방지 안전망 공백 해소 (testing WARNING #1).
2. `scope`, `user_guide_sync` reviewer 재실행 — output 파일 미생성으로 결과 미확인 상태.
3. `reentryWorkflowInput`/`runNodeDispatchLoop` JSDoc 위치 정리로 문서-선언 인접성 복원 (maintainability WARNING #3).
4. side_effect 가 지적한 재진입 input 폴백 범위 관련 주석 정정 + back-edge 재구동 e2e 케이스 추가 검토 (side_effect WARNING #2).
5. `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 후속 작업 이행 시 SPEC-DRIFT(§6 표 저장 시점 발행 경로 명시) + "handler.validate" 표현 정정(documentation WARNING #5)을 함께 반영.
6. CHANGELOG 제목/본문 섹션 범위 정합 (documentation WARNING #4) — 낮은 우선순위, 후속 정리 시 함께.
7. (선택, 비차단) ERROR_KO 매핑 추가, Swagger description 보강, 정규식 parity 테스트, 배포 전 malformed 데이터 실사.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 diff 범위에서 비적용으로 판단(성능 특이 변경 없음) |
  | architecture | 라우터가 이번 diff 범위에서 비적용으로 판단(구조적 변경 없음) |
  | dependency | 라우터가 이번 diff 범위에서 비적용으로 판단(의존성 변경 없음) |
  | database | 라우터가 이번 diff 범위에서 비적용으로 판단(스키마/쿼리 변경 없음) |
  | concurrency | 라우터가 이번 diff 범위에서 비적용으로 판단(동시성 이슈 없음) |

  (workflow 모드 manifest 는 개별 제외 사유 문자열을 전달하지 않아 위 사유는 일반화된 라우터 판단으로 기재함 — 상세 사유는 세션 `_routing_decision.json`(있는 경우) 참고.)

**참고**: `<session_dir>/_retry_state.json` 은 이 세션에서 모든 reviewer 가 `agents_pending`/`agents_success=[]` 인 stale 상태(레거시 session_dir 경로 흔적)로 남아 있었으나, workflow 모드 규약에 따라 이를 무시하고 prompt 본문의 manifest(`ran`/`skipped`/`forced`/`routing`)만을 근거로 이 보고서를 작성했다.