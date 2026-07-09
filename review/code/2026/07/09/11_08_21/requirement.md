# 요구사항(Requirement) Review — manual-trigger-default-param

## 발견사항

- **[CRITICAL]** `node-settings-panel.tsx` 의 즉시 store 커밋이 하루 전에 사용자 확인까지 거쳐 확정된 spec 필수 요구사항(ED-SP-05)을 정면으로 뒤집는다.
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` `SettingsTab.handleConfigChange` (변경 후 `updateNodeConfig(nodeId, newConfig)` 호출 추가) / 신규 테스트 `codebase/frontend/src/components/editor/settings-panel/__tests__/node-settings-panel-config-commit.test.tsx`
  - 상세: `spec/3-workflow-editor/_product-overview.md:85` (ED-SP-05, **필수**) — "설정 변경을 `변경 저장`(Settings 탭)·`JSON 적용`(Code 탭) 으로 캔버스(in-memory store)에 반영. 저장 전 다른 노드로 전환하면 미저장 편집은 폐기." `spec/3-workflow-editor/0-canvas.md` §8 Rationale R-3(2026-07-08, "사용자 확인" 명시)은 정확히 이 파일·메커니즘을 지목해 "명시 저장 + 실행 직전 저장은 ... 의도된 설계로 판단해 ... 스펙을 현재 동작으로 정정한다(구현을 옛 스펙에 맞추지 않음)"라고 결론 내렸다 — 즉 "`node-settings-panel.tsx` 의 `key={selectedNodeId}` remount 로 미저장 편집 폐기"가 버그가 아니라 **의도된, 방금 재확인된 설계**라고 명시적으로 못박은 지 하루 만에, 본 PR 이 `handleConfigChange` 에서 (label/notes/errorHandling 은 그대로 두고) 노드-특정 config 필드만 골라 `updateNodeConfig` 로 **즉시 store 커밋 + isDirty**하도록 바꿨다. 새 테스트 `node-settings-panel-config-commit.test.tsx` 는 "commits ... without clicking Save Changes" 를 리그레션 방지 대상으로 명시해, ED-SP-05 가 규정한 "저장 전 다른 노드로 전환하면 미저장 편집 폐기"를 코드로 정면 반증한다. 이 변경은 Manual Trigger 뿐 아니라 `SettingsTab` 을 공유하는 **모든 노드 타입**의 노드-특정 config 에 적용돼 파급 범위도 spec 결정 재검토가 필요한 만큼 크다. CLAUDE.md 규약상 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"인데, 이 변경은 spec 위임 없이 developer 단독으로 최근 확정된 결정을 뒤집었다.
  - 제안: 이 변경은 되돌리거나(원래 "Save Changes/JSON 적용 클릭 시에만 반영" 유지), 정말 필요하다면 `project-planner` 로 위임해 ED-SP-05·0-canvas.md §8/R-3 을 재논의·재결정(사용자 확인 포함)한 뒤 spec 을 먼저 갱신하고 코드를 그에 맞춰야 한다. 원래 버그(Manual Trigger default 미적용)의 실제 근본 원인은 plan 문서 자체가 "(c) 엔진 재진입 input 소실"을 "진짜 핵심"으로 이미 지목했고 e2e 로 그것만으로 재현·해결이 확인됐으므로, 이 프론트 변경(a)은 root cause 수정에 필수가 아닌 부가적 "hardening"으로 보인다 — 그 부가 변경이 하루 전에 명시적으로 재확인된 spec 결정과 충돌한다면 우선순위상 제외하는 편이 안전하다.

- **[WARNING]** 저장 시점 구조 위반에 재사용된 `INVALID_TRIGGER_PARAMETERS` 코드가 spec §6 어디에도 문서화돼 있지 않다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:590-610` (`validateManualTrigger`), 대응 spec `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 (라인 155-183)
  - 상세: spec §6 은 두 개의 별도 표를 갖는다 — (1) "구조 위반(저장 시점, `invalid_schema` reason)" 표는 필드-레벨 reason 코드만 규정하고 top-level `error.code` 는 규정하지 않는다. (2) "실행 시점 어댑터별 누락(`missing_required`)" 표는 Manual 어댑터의 top-level 코드를 `INVALID_TRIGGER_PARAMETERS` (위치: `workflows.controller.ts`, 실행/execute 경로)로 명시한다. 이번 PR 은 **저장(`saveCanvas`) 경로**의 구조 위반에도 동일한 `INVALID_TRIGGER_PARAMETERS` 코드를 재사용하는데, 이는 spec 표 (2)가 규정한 시점·위치(`workflows.controller.ts`, execute)와 다르다. 기능적으로는 합리적인 선택(트리거 파라미터 문제라는 점은 동일)이지만, spec 은 이 저장-시점 응답의 top-level 코드/엔드포인트를 전혀 규정하지 않아 spec 만 보고는 클라이언트가 `INVALID_TRIGGER_PARAMETERS` 를 실행-시점 전용으로 오해할 수 있다.
  - 제안: `project-planner` 에 위임해 spec §6 구조 위반 표에 "시점: handler.validate(저장 시점) — HTTP 응답: 400 `INVALID_TRIGGER_PARAMETERS` at `workflows.service.ts saveCanvas`" 행을 추가하거나, 저장 시점 전용 별도 코드를 검토하도록 명시. 코드 자체를 되돌릴 필요는 없음(선택이 불합리하지 않으므로) — spec 갱신 누락에 가까움.

- **[INFO]** `validateManualTrigger` 가 spec §6 문구("handler.validate")와 달리 `ManualTriggerHandler.validate()` 를 호출하지 않고 `validateTriggerParameterSchema` 를 직접 재호출한다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:598-610` vs `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts:85-96` (`ManualTriggerHandler.validate`)
  - 상세: 두 곳 모두 결국 동일한 SoT 함수(`validateTriggerParameterSchema`, `resolve-trigger-parameters.ts`)를 호출하므로 결과가 서로 갈릴 위험은 없지만, spec 문구를 문자 그대로 읽으면 "handler.validate 가 저장 시점에 호출된다"는 뉘앙스이고 실제로는 `saveCanvas` 가 handler 를 거치지 않고 독립적으로 같은 검증을 재구현한 것이다. 기능적 회귀는 아니며 spec 의도(저장 시점에 구조 위반을 잡는다)는 충족한다.
  - 제안: 참고용. 향후 `validateTriggerParameterSchema` 시그니처가 바뀌면 두 호출부를 함께 갱신해야 함을 주석/PR 체크리스트에 남겨두면 좋음.

- **[WARNING]** 이미 DB 에 영속된 malformed `config.parameters` 를 가진 워크플로우에 대한 마이그레이션/백필 경로가 없다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger` (신규 게이트), `plan/in-progress/manual-trigger-default-param.md`
  - 상세: 이 PR 이전에는 malformed 파라미터(빈 이름 슬롯 등)가 조용히 저장될 수 있었고 실제로 발생했다는 것이 이 버그의 전제다. 이번 게이트는 **신규 저장**만 막는다 — 이미 영속된 malformed 스키마를 가진 워크플로우는, 트리거 파라미터와 무관한 사소한 캔버스 편집(노드 위치 이동 등)을 저장하려 해도 이제부터 항상 400 `INVALID_TRIGGER_PARAMETERS` 로 막혀 스스로 고치기 전까지는 아무것도 저장할 수 없게 된다. plan 문서에는 이 기존 데이터에 대한 백필/자동 정리 언급이 없다.
  - 제안: 배포 전 실 데이터에 malformed manual-trigger 파라미터가 존재하는지 조회하고, 있다면 (a) 배포와 함께 정리 스크립트/마이그레이션을 돌리거나 (b) 최소한 해당 워크플로우 소유자에게 알리는 절차를 검토. `project-planner`/운영 판단 필요.

- **[INFO]** spec frontmatter `code:` 목록에 `workflows.service.ts` 가 없다.
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` (handler/schema/resolve-trigger-parameters/trigger-configs.tsx만 나열)
  - 상세: §6 이 규정하는 "저장 시점 구조 위반 검증"의 실제 구현 지점이 이번 PR 로 `workflows.service.ts` 로 옮겨왔지만 frontmatter 는 갱신되지 않았다. spec-coverage 류 자동 감사에서 커버리지 누락으로 보일 수 있다.
  - 제안: `project-planner` spec 갱신 시 `code:` 목록에 `codebase/backend/src/modules/workflows/workflows.service.ts` 추가 검토.

## 나머지 검토 항목 (문제 없음 확인)

- **엔진 재진입 input 수정** (`execution-engine.service.ts` 3개 호출부 `input: {} → savedExecution.inputData ?? {}`): `gatherNodeInput` 확인 결과 이 값은 진입(no-incoming) 노드 또는 미실행 predecessor 를 가진 back-edge 타깃에만 쓰인다 — "이미 완료된 노드는 skip 되므로 미완료 진입 노드에만 영향" 주석과 실제 동작이 일치. `Execution.inputData` 가 durable 컬럼(코드 생성 시점에 `(input as Record<...>) ?? {}` 로 세팅)이라는 전제도 확인됨. 대응 spec(`5-system/4-execution-engine.md`)에 이 세부사항을 반박하는 문구 없음 — 내부 구현 버그 수정으로 타당.
- **`loadTriggerParameterSchema` category→type 조회 전환**: `NODE_TYPES.MANUAL_TRIGGER === 'manual_trigger'` 확인, 프론트 `is-trigger.ts` 의 `type === 'manual_trigger'` 폴백 근거 주석과 실제 코드 일치. 이 로더를 쓰는 4개 호출부(controller execute / schedule-runner / hooks / executions re-run) 모두 "Manual Trigger 노드가 파라미터 스키마의 유일한 출처"라는 spec 전제와 일치하므로 조회 방식 통일에 문제 없음.
- **`resolve-trigger-parameters.ts`**: 이번 diff에 미포함(변경 없음) — plan 상 "① 되돌림"(strict all-or-nothing 유지) 그대로 확인됨. spec §6 "위 4가지 구조 위반은 모두 단일 `invalid_schema` reason 으로 산출"과 현재 코드 일치.
- **에러 코드 정규화**: `toTriggerParameterErrorDetails` 의 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 가 spec §6 응답 봉투 문단과 정확히 일치.
- **TODO/FIXME/HACK/XXX**: diff 전체에서 미검출.
- **trigger-configs.tsx 프론트 식별자 정규식**: `^[A-Za-z_][A-Za-z0-9_]*$` — 백엔드 `resolve-trigger-parameters.ts` 규칙과 동일(spec §6 표와도 일치). 다만 이 인라인 에러는 "Save Changes" 버튼을 막지 않는다 — 무효 이름인 채로 저장을 시도하면 백엔드 400 에 의존한다(단, 이 400 을 프론트가 사용자에게 어떻게 노출하는지는 diff 범위 밖).

## 요약

핵심 버그(Manual Trigger `defaultValue` 미적용)의 근본 원인 진단·백엔드 수정(엔진 재진입 시 durable input 재사용, 트리거 노드 type 기반 조회, 저장 시점 구조 검증 추가)은 spec §4-nodes/7-trigger/1-manual-trigger.md 본문과 line-level 로 잘 맞고 e2e/unit 테스트도 회귀 방지에 적절하다. 그러나 부가적으로 포함된 프론트엔드 변경(`node-settings-panel.tsx` 의 즉시 store 커밋)은 **하루 전에 사용자 확인까지 거쳐 명문화된 spec 필수 요구사항(ED-SP-05)과 그 근거(0-canvas.md §8 R-3)를 정면으로 위반**하며, 이는 developer 단독 판단으로 넘을 수 없는 spec 결정 재론의 영역이다. 이 CRITICAL 항목의 처리(되돌리기 또는 project-planner 경유 재결정) 전에는 머지하지 않는 것을 권장한다. 그 외에는 에러 코드 재사용 범위 문서화 누락, 기존 malformed 데이터 마이그레이션 부재 등 WARNING/INFO 수준 보완사항이 있다.

## 위험도

CRITICAL
