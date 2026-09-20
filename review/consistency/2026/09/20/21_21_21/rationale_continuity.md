# Rationale 연속성 검토 — spec/2-navigation (impl-done, dup-delete-audit)

## 발견사항

- **[INFO]** 워크플로·워크스페이스 삭제의 "동시 삭제 → 두 번째 404" 대칭이 `1-workflow-list.md` 본문에 아직 없음
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.6(삭제 액션) · §3(`DELETE /api/workflows/:id`)
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §4.3 "트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다"(2026-09-17 결정) · §4.4 "동시 삭제: 두 번째는 404 RESOURCE_NOT_FOUND"
  - 상세: 이번 diff(`workflows.service.ts`, `workspaces.service.ts`)는 워크플로·워크스페이스 DELETE 의 동시 요청 경합에서 두 번째 요청이 `404`(각각 `RESOURCE_NOT_FOUND` / `WORKSPACE_NOT_FOUND`)로 끝나도록 트리거 삭제 경로의 기존 §4.4 결정을 그대로 확장했다. 코드 주석·CHANGELOG·plan 모두 이 대칭을 명시적으로 인용하고 있어 **결정 자체는 기존 Rationale 과 정합**한다. 다만 `1-workflow-list.md` 와 `data-flow/12-workspace.md` 본문에는 이 동작이 아직 서술돼 있지 않아, 트리거 목록에만 이 계약이 적힌 비대칭이 남는다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목("`1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10 에 «동시 삭제 → 두 번째 404» 서술이 없다", 2026-09-20 등재)으로 등재되어 있고, 같은 세션에서 이미 3라운드 연속 비차단(INFO)으로 처분됨. 추가 조치 불요 — 재확인 목적의 기록.

- **[INFO]** 워크스페이스 삭제 재검사 순서 예외가 spec Rationale 이 아니라 코드 주석에만 있음
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace()` (라인 ~525-535)
  - 과거 결정 출처: 같은 파일 `assertWorkspaceDeletable()` JSDoc(커밋 `a9288bf6e`, 2026-09-18) — "판정 순서(권한 → 존재 → 타입)는 그와 별개로 유지한다"
  - 상세: 위 JSDoc 은 `assertWorkspaceDeletable()` 내부의 오류 우선순위(멤버십/권한 검사가 존재 검사보다 먼저)를 명시적 불변식으로 선언한다. 이번 diff 는 그 함수 자체의 순서는 바꾸지 않았지만, 동시 삭제 경합의 좁은 창(부모 행이 CASCADE 로 이미 사라진 경우)에 한해 `assertWorkspaceDeletable()` 호출 **이전에** `locked.parentPresence === 'absent'` 검사를 끼워 넣어 그 경우엔 403(`OWNER_REQUIRED`) 대신 404(`WORKSPACE_NOT_FOUND`)가 먼저 나가도록 했다. 함수 내부 불변식 자체는 위반하지 않았고, 코드 주석(plan·CHANGELOG 포함)이 "403→404 로 응답이 바뀐다, 의도된 변경" 이라고 명시적으로 밝히고 있어 은폐된 번복은 아니다. 다만 이 결정은 spec `## Rationale` 이 아니라 코드 주석/CHANGELOG/plan 에만 근거가 있다(`spec_impact: none`).
  - 제안: 현재의 `spec_impact: none` 판단(=트리거 §4.4 선례를 워크플로·워크스페이스에 맞추는 적용이지 새 정책이 아니라는 논리)은 위 첫 항목의 tracker 로 이미 흡수돼 있어 추가 조치 불요. 다만 다음에 `assertWorkspaceDeletable()` 의 판정 순서 자체를 건드리는 변경이 있을 경우, 이번에 추가된 "동시 삭제 race 는 예외" 라는 조건을 그 JSDoc 에도 한 줄 반영해 두면 다음 사람이 두 지점(호출부 주석 vs 함수 JSDoc)을 따로 추적하지 않아도 된다.

## 요약

이번 diff(`trigger-resource-release.ts` / `trigger-resource-releaser.service.ts` / `workflows.service.ts` / `workspaces.service.ts` 및 대응 테스트)는 트리거 목록 spec(`2-trigger-list.md`) §4.3(2026-09-17, "트리거 행을 없애는 모든 경로는 자원을 정리한다")과 §4.4("동시 삭제 → 두 번째 요청은 404")에 이미 기록된 결정을 워크플로·워크스페이스 삭제 경로로 확장한 것으로, 기각된 대안을 재도입하거나 합의 원칙을 무시하는 지점은 발견되지 않았다. 오히려 plan(`plan/in-progress/dup-delete-audit.md`)이 스스로 잘못 인용한 "선례" 주장(트리거 삭제도 실제로 404 대칭이라는 가정)을 리뷰 라운드에서 반증·정정하고, 그 결과로 드러난 두 개의 새로운 갭(①`TriggersService.remove()` 자체의 동일 결함 ②`1-workflow-list.md`/`data-flow/12-workspace.md` 본문에 이 계약이 아직 서술되지 않은 비대칭)을 각각 developer/planner tracker 항목으로 명시적으로 등재해 두었다 — 이는 Rationale 연속성 관점에서 모범적인 처리다. 워크스페이스 삭제의 판정 순서 예외(권한 검사보다 부재 검사를 먼저 보는 좁은 창)도 기존 `assertWorkspaceDeletable()` 내부 불변식 자체를 깨지 않고, 코드 주석·CHANGELOG·plan 삼중으로 "403→404 로 바뀌는 의도된 변경" 임을 밝히고 있어 무근거 번복이 아니다. 발견된 두 항목은 모두 이미 기존 트래커에 등재·처분된 사안의 재확인 수준으로 CRITICAL/WARNING 요건에 해당하지 않는다.

## 위험도

LOW
