# Cross-Spec 일관성 검토 — `spec/4-nodes` (--impl-prep)

## 발견사항

### [CRITICAL] 동적 포트 ID 모델: UUID v4 vs stable-slug — target 내부 + 외부 spec + 코드 3자 모순

- **target 위치**:
  - `spec/4-nodes/0-overview.md §1.3` (포트 정의) — 동적 포트는 **stable slug id** (`^[a-zA-Z0-9_-]{1,64}$`), 형식 위반 시 인덱스 fallback(`case_0`/`branch_1`), SoT = `nodes/core/port-id.util.ts` + `lib/node-definitions/resolve-dynamic-ports.ts`, 명시적으로 "**UUID v4 는 사용하지 않는다**".
  - `spec/4-nodes/1-logic/0-common.md §7` (포트 ID 불변성) — "동적 포트: 생성 시 **UUID v4** 를 할당".
- **충돌 대상**:
  - 같은 target 의 두 문서가 정반대(§1.3 slug "UUID 안 씀" ↔ §7 "UUID v4 할당").
  - 외부(target scope 밖) `spec/3-workflow-editor/1-node-common.md §1.5` — "동적 포트 추가 시 **UUID v4** 를 할당한다". 게다가 이 표는 하단에 `> 상세: [노드 개요 §1.3 PortDef]` 로 target `0-overview.md §1.3` 을 **참조**하는데, 참조 대상(§1.3=slug)과 본문(§1.5=UUID)이 정면 모순.
  - 외부 `spec/conventions/node-output.md` Principle 6 — 동적 포트는 `<prefix>_<index>` (예: `class_0`, `branch_0`), 글로벌 버튼은 `config.buttons[i].id` 그대로. UUID 언급 0건.
  - 코드 SoT `codebase/backend/src/nodes/core/port-id.util.ts` — `PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/`, `resolveStablePortId(id, fallback)` 가 slug 검증 후 미통과 시 fallback 반환. **slug 모델이 구현 현실**.
  - 동일 slug 모델을 따르는 노드 spec: `spec/4-nodes/1-logic/2-switch.md` (case `id` = slug, fallback `case_${index}`), `spec/4-nodes/3-ai/2-text-classifier.md` (`category.id` slug, fallback `class_${i}`).
- **상세**: 구현(코드)·target `0-overview.md §1.3`·switch·text-classifier·`node-output.md` Principle 6 은 모두 **slug 기반(+인덱스 fallback)** 으로 일치한다. 반면 target `1-logic/0-common.md §7`·외부 `3-workflow-editor/1-node-common.md §1.5` 만 **UUID v4** 라는 폐기된 모델을 기술한다. `--impl-prep` 로 `spec/4-nodes` 를 읽고 구현/검증하는 개발자가 §7 을 신뢰하면 UUID 생성·검증 로직을 만들게 되어 코드(`port-id.util.ts`)·다른 노드 spec 과 즉시 충돌한다. 핵심은 **이 conflict 가 target 경계를 넘는다는 점** — target(`spec/4-nodes`) 안의 §7 만 고쳐도 외부 `3-workflow-editor/1-node-common.md §1.5` 가 여전히 UUID v4 라고 남아 cross-spec 모순이 해소되지 않는다.
- **제안**:
  1. target `spec/4-nodes/1-logic/0-common.md §7` 의 "UUID v4 할당" → `0-overview.md §1.3` 과 동일한 stable-slug + 인덱스 fallback 서술로 교체 (SoT `port-id.util.ts` / `resolve-dynamic-ports.ts` 명시).
  2. **함께 갱신 필수(target 밖)**: `spec/3-workflow-editor/1-node-common.md §1.5` 의 "ID 생성 = UUID v4" 행도 slug 모델로 교체. 이 문서는 `project-planner` 의 `spec/**` 쓰기 범위이므로 같은 작업 단위에서 동기화해야 한다.

### [WARNING] carousel 버튼 ID "UUID v4 자동 할당" — 같은 파일·Principle 6 의 user-set id 모델과 모순

- **target 위치**: `spec/4-nodes/6-presentation/1-carousel.md:429` — "버튼 추가 시 **UUID v4** 자동 할당 (ID 불변)".
- **충돌 대상**:
  - 같은 `carousel.md` 본문(§1·§3·§5) 은 버튼 포트를 `<button.id>` (사용자 설정 ID), per-item 은 `<itemButton.id>__item_<idx>` 로 일관 기술하고 JSON 예시도 `{ "id": "approve" }`, `{ "id": "act" }` 같은 **사람이 읽는 slug** 다.
  - `spec/conventions/node-output.md` Principle 6 — "글로벌 버튼: `config.buttons[i].id` 그대로 사용. 사용자가 설정한 ID."
- **상세**: 버튼 포트의 라우팅 키는 `button.id` 이며 `__item_` suffix 분리·reserved 충돌 검증(`carousel.schema.ts`)이 전부 이 id 문자열을 전제로 한다. 429줄의 "UUID v4 자동 할당" 은 §7 동적 포트 UUID 서술과 같은 폐기 모델의 잔재로, carousel 의 실제 버튼 모델(user-set slug)과 어긋난다.
- **제안**: `carousel.md:429` 의 "UUID v4 자동 할당" 을 "버튼 추가 시 user-set slug id 발급(미입력 시 자동 slug), ID 불변" 류로 정정. 동적 포트 모델 정정(위 CRITICAL)과 한 묶음으로 처리 권장.

### [INFO] 데이터 모델·API 계약·상태·RBAC·계층 책임 — 외부 spec 과 정합

target 의 나머지 cross-cutting 계약은 외부 spec·코드와 일치함을 확인했다(충돌 없음):

- **데이터 모델**: `0-overview.md §1.2` Node category enum 7종(`trigger/logic/flow/ai/integration/data/presentation`) = `spec/1-data-model.md §2.6` Node.category enum 과 동일. Node.type 전체 목록(if_else…template, makeshop 포함) 일치. `custom` 카테고리는 양쪽 모두 미구현(Planned) 으로 표기 정합.
- **API 계약(definitions)**: `0-overview.md §1.0` `GET /api/nodes/definitions → { definitions, categories }`, `metadata` 직렬화 시 `validateConfig` strip + `warningRules` 만 노출, cafe24 `extras.operationsByResource[].labelKey` — `spec/3-workflow-editor/1-node-common.md §240` 의 auto-form 트랙 참조 및 `spec/conventions/cafe24-api-metadata.md §421/§471` 의 `labelKey` 결정(label→labelKey 필드명 변경)과 일치.
- **API 계약(background runs)**: `1-logic/12-background.md §8` `GET /api/executions/:executionId/background-runs/:backgroundRunId`, `notifications[].type = background_failed` — `spec/1-data-model.md §2.19 Notification.type` enum 에 `background_failed` 존재, `spec/5-system/4-execution-engine.md §3.3` 의 `background-execution` 큐 + `type: background_failed` Admin in_app 알림 서술과 정합. NodeExecution shape 재사용(`3-workflow-editor/3-execution.md §5.1`)·`parentNodeExecutionId` 그룹핑도 양쪽 일치.
- **상태 전이**: `10-parallel.md §6` 의 `PARALLEL_NESTED_DEPTH_EXCEEDED`·concurrency cap=32·`waitAll=false` reject 가 `spec/0-overview.md §6.2` Parallel 행 요약과 일치. 컨테이너 `done` `{ <컬렉션>, count }` 오버라이트(Principle 9.2)는 `node-output.md` Principle 9 / `0-overview.md §6` 과 정합.
- **계층 책임(ExecutionContext)**: `10-parallel.md §Rationale` 의 `parentParallelConcurrency` → `ParallelBranchContext` 분리(결정 G 번복)가 `spec/conventions/execution-context.md` 원칙 2/§85 의 SoT 결정과 lockstep. `_contextKey` 엔진 내부 필드(원칙 4)·background `bg:<executionId>:<backgroundRunId>` 키 격리도 `execution-context.md` §91 과 일치.
- **핸들러 계약(rawConfig echo)**: `0-overview.md §4.3` `context.rawConfig` echo·`4-nodes/**` 의 config echo(Principle 7) 가 `spec/5-system/4-execution-engine.md §5.5/§6.1` (`rawConfig` shallow `Object.freeze` 주입) 및 `node-output.md` Principle 7 과 정합.
- **RBAC**: background 모니터링 API 권한(workspace 멤버, IDOR→404, Role 추가 제한 미적용)이 `0-overview.md §6.1` 및 기존 `ExecutionsController.findOne` 패턴과 일치(새 권한 구조 도입 없음).

## 요약

`spec/4-nodes` target 의 데이터 모델·API 계약·상태 전이·RBAC·ExecutionContext 계층 책임은 외부 spec(`1-data-model`, `3-workflow-editor`, `5-system/4-execution-engine`, `conventions/*`)·코드와 폭넓게 정합한다. 단 하나의 cross-spec 단층선은 **동적 포트 ID 모델(UUID v4 vs stable-slug)** 로, 이는 단순 명명 비일관이 아니라 구현 현실(코드 `port-id.util.ts` = slug)·다수 노드 spec·`node-output.md` Principle 6 이 모두 slug 로 수렴한 가운데 target `1-logic/0-common.md §7` 과 **target 밖** `3-workflow-editor/1-node-common.md §1.5` 만 폐기된 UUID v4 모델을 기술하는 직접 모순이다. target 내부 정정만으로는 외부 `1-node-common.md §1.5` 잔재가 남으므로 두 문서를 같은 작업 단위에서 동기 갱신해야 한다. carousel 버튼 UUID 서술(WARNING)도 같은 잔재로 함께 정정 권장.

## 위험도

MEDIUM
