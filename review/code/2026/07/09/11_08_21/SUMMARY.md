# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — requirement-reviewer 가 프론트 `node-settings-panel.tsx` 의 즉시 store 커밋 변경이 하루 전에 사용자 확인까지 거쳐 확정된 spec 필수 요구사항(ED-SP-05, `0-canvas.md` §8 R-3)을 developer 단독 판단으로 뒤집었다고 지적 — 머지 전 처리 필요. 그 외 백엔드 핵심 수정(엔진 재진입 durable input, 트리거 노드 `type` 기반 조회, 저장 시점 검증)은 근본 원인에 부합하는 타당한 fix 로 각 리뷰어의 확인을 받았다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT/SPEC | `SettingsTab.handleConfigChange` 가 이제 키 입력마다 `updateNodeConfig(nodeId, newConfig)` 로 store 를 **즉시 커밋**하도록 변경됨. 이는 `spec/3-workflow-editor/_product-overview.md:85` (ED-SP-05, 필수 — "설정 변경은 `변경 저장`/`JSON 적용` 클릭 시에만 캔버스에 반영, 저장 전 다른 노드 전환 시 미저장 편집 폐기")와, 바로 하루 전 이 정확히 이 메커니즘을 재확인한 `spec/3-workflow-editor/0-canvas.md` §8 Rationale R-3(2026-07-08)를 정면 반증한다. 신규 테스트 `node-settings-panel-config-commit.test.tsx` 가 이 동작을 리그레션 방지 대상으로 명시. Manual Trigger 뿐 아니라 `SettingsTab` 을 공유하는 모든 노드 타입에 영향. CLAUDE.md 규약상 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"인데 위임 없이 진행됨 | `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` `SettingsTab.handleConfigChange` | 원래 동작(Save Changes/JSON 적용 클릭 시에만 반영)으로 되돌리거나, 정말 필요하면 `project-planner` 로 위임해 ED-SP-05·0-canvas.md §8 R-3 을 재논의(사용자 확인 포함)한 뒤 spec 을 먼저 갱신. 원 버그의 실제 근본 원인은 "(c) 엔진 재진입 input 소실" 이었고 그것만으로 e2e 재현·해결이 확인됐으므로, 이 프론트 변경은 root cause 수정에 필수가 아닌 부가 hardening 으로 보임 — 우선순위상 제외 검토 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | ARCHITECTURE/SIDE-EFFECT | (위 CRITICAL 항목과 동일 코드 변경의 파생 부작용) `updateNodeConfig` 액션은 `pushUndo()` 를 호출하지 않는데, `handleConfigChange` 가 이를 키 입력마다(디바운스 없이) 직접 호출 — 스토어의 "직접 커밋 액션은 호출자가 먼저 `pushUndo()`" 관례를 어겨 모든 노드 타입의 노드-특정 config 편집이 Ctrl+Z 로 되돌릴 수 없게 됨. 같은 패널 안에서 라벨/노트는 여전히 로컬 버퍼+명시적 저장+undo 가능 구조라 커밋 의미론이 두 갈래로 공존 | `node-settings-panel.tsx` `handleConfigChange`, `editor-store.ts:945` `updateNodeConfig` | `updateNodeConfig` 호출 전 `pushUndo()` 호출(키 입력마다 쌓이지 않도록 debounce/blur 경계 필요) 또는 undo-aware 신규 액션 도입 |
| 2 | PERFORMANCE | 동일 변경으로 config 필드 입력 한 글자마다 전역 `nodes` 배열이 새 참조로 교체되어, `nodes` 를 구독하는 `workflow-canvas.tsx`(ReactFlow 재조정), `use-expression-context.ts`(그래프 순회 재계산), `assistant-panel.tsx`/`assistant-message.tsx` 가 매 keystroke 마다 재실행됨. 이전에는 "Save changes" 클릭 1회에 한정되던 재계산이 편집 세션 내내 발생 — 큰 워크플로우에서 타이핑 랙 가능 | `workflow-canvas.tsx:120`, `use-expression-context.ts:107,112`, `assistant-panel.tsx:41,96,129` | `updateNodeConfig` 호출을 디바운스(200-300ms)하거나 blur 시점 커밋으로 분리(`isDirty` 는 즉시 반영). 또는 `nodes` 구독 컴포넌트들의 selector 를 config 내용이 아닌 최소 shape 로 좁힘 |
| 3 | ARCHITECTURE | 저장 시점 검증(`validateManualTrigger`)이 기존 `NodeHandler.validate()` 다형적 진입점(`ManualTriggerHandler.validate()`가 이미 동일 검증 + `evaluateMetadataBlockingErrors` 수행)을 재사용하지 않고, execution-engine 의 로우레벨 함수(`validateTriggerParameterSchema`)를 `WorkflowsService` 에 manual_trigger 전용으로 직접 하드코딩 — `evaluateMetadataBlockingErrors` 검사가 누락됨. 현재는 blocking rule 이 없어 결과가 우연히 같지만, 향후 스키마에 blocking rule 이 추가되면 "저장은 통과, 실행은 실패"라는 이번에 고치려던 것과 같은 유형의 버그가 재발할 위험. OCP/DRY 위반 | `codebase/backend/src/modules/workflows/workflows.service.ts` (신규 `validateManualTrigger`) | `WorkflowsService.saveCanvas` 가 `NodeHandlerRegistry.get(node.type).validate(node.config)` 를 제네릭하게 호출하도록 바꾸거나, 최소한 `ManualTriggerHandler.validate()` 를 그대로 재사용 |
| 4 | ARCHITECTURE | 파라미터 이름 식별자 정규식(`/^[A-Za-z_][A-Za-z0-9_]*$/`)이 프론트/백엔드 양쪽에 독립 하드코딩(SoT 부재). 프론트 주석이 "backend rule 의 mirror"라고 자인. 이 모노레포는 `@workflow/graph-warning-rules` 등 프론트/백엔드 공유 패키지로 이런 드리프트를 막는 선례가 있는데 이번 규칙은 그 패턴을 따르지 않음 | `trigger-configs.tsx` `PARAM_NAME_RE` vs `resolve-trigger-parameters.ts:77` | 식별자 정규식을 `packages/` 하위 공유 패키지로 옮겨 양쪽이 동일 소스를 import |
| 5 | API-CONTRACT/DOCUMENTATION/REQUIREMENT | `INVALID_TRIGGER_PARAMETERS` 에러 코드가 의미가 다른 두 실패(저장 시점 `saveCanvas` 의 파라미터 *스키마 구조* 위반 vs 실행 시점 `execute` 의 *입력값* 검증 실패, `POST /:id/save` vs `POST /:id/execute`)에 재사용됨. `message` 는 다르지만 top-level `code` 는 동일해 코드만 보는 클라이언트/문서 독자가 혼동 가능. spec §6 표는 실행 시점 사용만 규정하고 저장 시점 재사용은 어디에도 문서화되지 않았으며, `spec/data-flow/11-workflow.md:45` (`POST /:id/save` 시퀀스 노트)도 신규 검증을 반영 못함 | `workflows.service.ts:604-608`(신규) vs `workflows.controller.ts:307-314`(기존); `spec/4-nodes/7-trigger/1-manual-trigger.md` §6; `spec/data-flow/11-workflow.md:45` | spec §6 표/`11-workflow.md` 저장 시퀀스에 저장 시점 재사용을 명시하거나, 저장 시점 전용 별도 코드(예: `INVALID_TRIGGER_PARAMETER_SCHEMA`) 부여 검토. `project-planner` 위임 대상 |
| 6 | REQUIREMENT/API-CONTRACT | 이미 DB 에 영속된 malformed `config.parameters`(빈 이름 슬롯 등)를 가진 워크플로우에 대한 마이그레이션/백필 경로 없음. 신규 저장 게이트는 **들어오는 payload 전체**에 적용되므로, 트리거와 무관한 캔버스 편집(노드 위치 이동 등)을 저장하려 해도 스스로 고치기 전까지 항상 400 으로 막힘. `restoreVersion` 도 내부적으로 `saveCanvas` 를 재사용해 과거 malformed 버전 스냅샷 복원도 막힘 | `workflows.service.ts` `validateManualTrigger`, `saveCanvas`(395)/`restoreVersion`(431→468) | 배포 전 실 데이터에 malformed 파라미터 존재 여부 조회 후 (a) 정리 마이그레이션 스크립트 실행 또는 (b) `restoreVersion` 경로는 과거 스냅샷 복원을 막지 않도록 예외 처리. `project-planner`/운영 판단 필요 |
| 7 | SCOPE | `schedule-runner.service.spec.ts` 에 이번 작업과 무관한 순수 포맷팅(재개행)만 있는 diff hunk 1건 — plan 체크리스트에도 언급 없음 | `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts:321` 부근 | 되돌리거나 별도 formatting-only 커밋으로 분리 |
| 8 | MAINTAINABILITY | "재진입 시 durable trigger input 재사용"(`input: savedExecution.inputData ?? {}`) 로직이 3개 호출부에 중복 구현되고, 각기 다른 언어(한국어 1건, 영어 2건)·분량의 설명 주석이 붙어 있어 단일 SoT 가 없음. 구조적으로 동일한 4번째 호출부(`retry-turn.service.ts`)는 이번 fix 를 받지 못하고 여전히 `input: {}` + 전혀 다른 논리의 독립 주석으로 남아 있어, 이 지점이 의도적 예외인지 놓친 것인지 불명확 | `execution-engine.service.ts:2068-2086`(`driveResumeAwaited`), `:2417-2419`(`driveResumeFrame`), `:3199-3203`(`driveStuckRedrive`); `retry-turn.service.ts:565-577`(`resumeGraphAfterRetry`) | `private reentryTriggerInput(savedExecution)` 같은 헬퍼로 추출해 규칙을 한 곳에 문서화, 4번째 호출부도 같은 헬퍼 참조 또는 예외 사유를 명시적으로 교차 참조 |
| 9 | MAINTAINABILITY | JSX 를 화살표 함수 암묵적 반환에서 블록 반환으로 바꾸는 과정에서 들여쓰기가 일부 누락되어 같은 블록 내 들여쓰기 레벨이 섞임 — 실측 `prettier --check` 실패 | `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:107-143` | `eslint --fix`(prettier CLI 직접 호출은 파일 전체 reflow 위험이 있어 지양)로 들여쓰기 통일 |
| 10 | DOCUMENTATION | `plan/in-progress/manual-trigger-default-param.md` 체크리스트가 같은 diff 에 이미 추가된 테스트(`node-settings-panel-config-commit.test.tsx`)를 반영 못해 미체크 상태로 남음 — stale self-tracking | `plan/in-progress/manual-trigger-default-param.md:40` | 해당 항목 `[x]` 로 갱신하고 테스트 파일명 명시 |
| 11 | DOCUMENTATION | 사용자 체감 영향이 큰 severe 버그 수정(Manual Trigger `defaultValue` 3중 독립 결함으로 조용히 무시되던 문제)임에도 저장소 관례(과거 severe fix 커밋들은 CHANGELOG Unreleased 항목 동반)와 달리 `CHANGELOG.md` 가 갱신되지 않음 | `CHANGELOG.md`(루트) | "Manual Trigger 파라미터 defaultValue 가 무시되던 버그" 요약한 Unreleased 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | PERFORMANCE | `ManualTriggerConfig` 의 `nameCounts`/`nameError` 계산이 `useMemo` 없이 매 렌더마다 재계산됨. 현재 파라미터 배열은 소규모라 영향 미미 | `trigger-configs.tsx:1817-1829` | 우선순위 낮음. 파라미터 수 증가 가능성이 있으면 `useMemo` 고려 |
| 2 | PERFORMANCE | `loadTriggerParameterSchema` 조회 predicate 를 `category`→`type` 으로 변경 — 두 컬럼 모두 전용 인덱스 없어 기존과 동일하게 인덱스 미사용(기존부터 있던 갭, 이번 diff 가 새로 유발한 회귀 아님) | `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:333-335` | 조치 불필요. 노드 수가 매우 큰 워크플로우가 흔해지면 `(workflow_id, type)` 복합 인덱스 검토 |
| 3 | ARCHITECTURE | `WorkflowsService → execution-engine/utils,types` 직접 import 확장은 `workflows.controller.ts`/`workflows.module.ts`의 기존 선례를 따른 것으로 순환 의존은 없음. 다만 "트리거 파라미터 스키마 검증"이 execution-engine 모듈 아래 위치한 배치 자체가 두 모듈 경계를 흐리는 근본 원인 | `workflows.service.ts` 신규 2개 import | 장기적으로 트리거 파라미터 관련 타입/검증기를 `nodes/trigger/manual-trigger/` 아래 두거나 `NodeHandler.validate()` 단일 진입점으로 수렴 검토 |
| 4 | SIDE-EFFECT | 재진입 dispatch 의 `input` 변경 범위가 diff 주석("미완료 entry 노드에만 영향")보다 넓음 — 실제로는 predecessor 미실행 back-edge 재진입 노드에도 적용됨(단, `runExecution` 정상 경로가 이미 동일 폴백을 쓰므로 새로운 미검증 동작은 아니고 일관성 회복에 가까움) | `execution-engine.service.ts:2086,2419,3203`, `gatherNodeInput`(5960-6017) | 주석을 "predecessor 미실행 노드(entry + 백엣지 재진입 포함)"로 정정 |
| 5 | SIDE-EFFECT | 신규 400 게이트(`INVALID_TRIGGER_PARAMETERS`, 저장 시점)는 의도된 API 동작 강화(spec 근거 있음)이며 프론트 inline 검증 + e2e 로 뒷받침돼 위험은 낮음 | `workflows.service.ts:576-611` | 배포 노트/체인지로그에 "저장 시 trigger parameter 구조 검증 강화" 언급 권장 |
| 6 | REQUIREMENT/DOCUMENTATION | `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` 목록이 이번 fix 의 실제 구현 지점(`workflows.service.ts`, `execution-engine.service.ts`, `load-trigger-parameter-schema.ts`)을 누락 — spec-coverage 자동 감사에서 커버리지 누락으로 보일 수 있음 | `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter | `project-planner` spec 갱신 시 `code:` 목록에 3개 경로 추가 검토 |
| 7 | REQUIREMENT/DOCUMENTATION | `validateManualTrigger` 신규 주석이 spec 문구 "handler.validate" 를 인용하지만 실제로는 `ManualTriggerHandler.validate()` 를 호출하지 않고 동일 하위 함수를 서비스 레이어에서 직접 재호출 — 기능적 회귀는 아니나 코드 검색 시 오해 소지 | `workflows.service.ts:590-610` | 주석을 "handler.validate 와 동일한 `validateTriggerParameterSchema` 를 서비스 레이어에서 직접 재사용"으로 명확화 |
| 8 | DOCUMENTATION | e2e 헤더 주석의 "documented limit"("$input 미해소") 인용이 실제로는 이번 fix 와 무관한 별개 코드경로(AI Agent retry 의 `resolveRetryNodeConfig`, `_retryState`)를 가리키는 것으로 보여, trigger-only 워크플로 배제 사유 설명이 혼란스러움 | `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts:14-20` | trigger-only 워크플로가 e2e 인프라에서 실제 겪는 현상을 직접 서술하거나, 이번 PR fix 로 해당 사유가 해소됐는지 재확인 후 주석 갱신 |
| 9 | API-CONTRACT | 신규 400 에러 코드 `INVALID_TRIGGER_PARAMETERS` 가 프론트 `ERROR_KO` 매핑에 등록되지 않아 영문 fallback 메시지 노출 가능(형제 코드 `GRAPH_VALIDATION_FAILED`는 이미 매핑 있음) | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 대칭성을 위해 `ERROR_KO`/`LOCALIZED_ERROR_CODES` 에 등록 검토 |
| 10 | API-CONTRACT | `saveCanvas` 의 Swagger `@ApiBadRequestResponse` 설명이 포괄적 문구("입력값 검증 실패")만 유지해 신규 실패 사유(트리거 파라미터 스키마)가 문서에 드러나지 않음(형제 `execute` 엔드포인트는 구체적으로 명시) | `workflows.controller.ts:440` | `description` 을 "그래프 검증·중복 라벨·Manual Trigger 파라미터 스키마 등"으로 보강 |
| 11 | SCOPE/MAINTAINABILITY | 이번 fix 와 무관한 타입 단언 제거(`settings: { ...dto.settings } as Record<string, unknown>` → `{ ...dto.settings }`)가 같은 diff 에 섞여 있음. 동작 영향 없음 | `workflows.service.ts:293`(288행 인근) | 사소하므로 강제 조치 불요. 다음에 무관한 정리성 변경 발생 시 별도 커밋 분리 권장 |

## 문제 없음으로 확인된 항목

- 엔진 재진입 input 수정(`{} → savedExecution.inputData ?? {}`): `gatherNodeInput` 확인 결과 미완료 진입/재진입 노드에만 영향, durable 컬럼 참조 전달이라 추가 DB I/O·deep clone 없음 — 성능/정합성 문제 없음 (requirement, performance)
- `loadTriggerParameterSchema` category→type 조회 전환: `NODE_TYPES.MANUAL_TRIGGER` 상수 일치, 4개 호출부(controller/schedule-runner/hooks/executions) 모두 목적에 부합 (requirement, side_effect)
- `resolve-trigger-parameters.ts`: 이번 diff 미포함, strict all-or-nothing 정책 그대로 — spec §6 과 일치 (requirement)
- 에러 코드 정규화(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)가 spec §6 응답 봉투와 정확히 일치 (requirement)
- 저장 시점 검증의 `{code, message, details}` 페이로드 구조, `toTriggerParameterErrorDetails` 재사용, fail-fast 배치 모두 기존 컨벤션 부합, 새 엔드포인트/버전/인증 변경 없음 (api_contract)
- TODO/FIXME/HACK/XXX 미검출 (requirement)
- `load-trigger-parameter-schema.ts` JSDoc 품질 양호, 회귀 테스트 이름 의도 명확 (documentation)

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | CRITICAL | 프론트 즉시 store 커밋이 하루 전 확정된 spec 필수요구사항(ED-SP-05) 정면 위반 |
| performance | MEDIUM | 즉시 커밋으로 인한 캔버스/표현식 컨텍스트 매 keystroke 재계산 |
| architecture | MEDIUM | 저장 검증이 NodeHandler.validate() 우회, 이름 정규식 이중정의, undo 계약 위반 |
| side_effect | MEDIUM | undo 스택 우회, 신규 400 게이트로 기존 저장 가능하던 요청이 거부됨 |
| api_contract | MEDIUM | 기존 malformed 데이터 저장/복원 회귀 가능성, 에러 코드 재사용 문서화 부재 |
| scope | LOW | 무관 포맷팅 diff 1건(schedule-runner.service.spec.ts) |
| maintainability | LOW | durable input 로직 3중 중복+주석 언어 불일치, prettier 포맷 실패 실측 |
| documentation | LOW | data-flow/11-workflow.md·plan 체크리스트·CHANGELOG 미갱신 |
| security | 미상 (파일 누락) | status=success 이나 `security.md` 파일 미생성 — 통합 불가 |
| testing | 미상 (파일 누락) | status=success 이나 `testing.md` 파일 미생성 — 통합 불가 |

## 발견 없는 에이전트

없음 (읽을 수 있었던 8개 에이전트 모두 최소 1건 이상의 발견사항 보고. security/testing 은 발견 없음이 아니라 결과 파일 자체를 읽지 못함 — 아래 특이사항 참고)

## 특이사항 — security/testing 결과 파일 누락

manifest 상 `security`, `testing` 은 `status=success` 로 보고됐으나, 명시된 `output_file`(`security.md`, `testing.md`)이 디렉터리에 실제로 존재하지 않아(Read 시도 시 "File does not exist") 이번 통합에 반영하지 못했다. 알려진 workflow FS-write 비결정성 패턴과 일치한다. **보안·테스트 관점 검토가 이번 요약에서 누락된 상태이므로, 별도로 두 reviewer 를 재실행해 결과를 확보할 것을 강력히 권장.**

## 권장 조치사항

1. **(CRITICAL, 머지 차단)** `node-settings-panel.tsx` 즉시 store 커밋 변경 처리 — 되돌리거나(Save Changes/JSON 적용 시에만 반영 유지) `project-planner` 위임으로 ED-SP-05·0-canvas.md §8 R-3 재결정. 원 버그의 root cause 는 엔진 재진입 input 수정만으로 해결 확인됨.
2. 위 결정이 "유지"로 나면, `updateNodeConfig` 호출에 `pushUndo()` 연동 + 디바운스를 함께 적용해 undo 계약 위반과 매 keystroke 재렌더 문제를 동시에 해소.
3. 저장 시점 검증을 `NodeHandler.validate()`(또는 `ManualTriggerHandler.validate()`) 로 통일해 `evaluateMetadataBlockingErrors` 누락 위험 제거.
4. 파라미터 이름 식별자 정규식을 공유 패키지로 이동해 프론트/백엔드 SoT 통일.
5. `INVALID_TRIGGER_PARAMETERS` 코드의 저장/실행 시점 이중 재사용을 spec §6·`data-flow/11-workflow.md` 에 명시하거나 별도 코드로 분리.
6. 배포 전 malformed manual-trigger 파라미터를 가진 기존 워크플로우 존재 여부 확인 + 마이그레이션/완화책 마련(`restoreVersion` 영향 포함).
7. `security`, `testing` reviewer 재실행하여 누락된 보안·테스트 관점 확보.
8. scope-out diff(schedule-runner.service.spec.ts 포맷팅, workflows.service.ts 무관 타입 캐스트 제거) 정리 및 `trigger-configs.tsx` prettier 포맷 수정(`eslint --fix`).
9. `execution-engine.service.ts` durable input 재사용 로직 헬퍼 추출(4번째 호출부 `retry-turn.service.ts` 정합성 확인 포함), plan 체크리스트·CHANGELOG.md 갱신.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 — 소스 코드 변경 시 항상 적용되는 정책상 강제 포함)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(패키지 의존성 변경 없음으로 추정 — 세부 사유는 manifest 에 미포함) |
  | database | 라우터 판단(스키마/마이그레이션 변경 없음으로 추정 — 세부 사유는 manifest 에 미포함) |
  | concurrency | 라우터 판단(신규 동시성 로직 없음으로 추정 — 세부 사유는 manifest 에 미포함) |
  | user_guide_sync | 라우터 판단(사용자 가이드 문서 변경 없음으로 추정 — 세부 사유는 manifest 에 미포함) |