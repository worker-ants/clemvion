# Plan 정합성 검토 — spec-update-engine-split.md

검토 대상: `plan/in-progress/spec-update-engine-split.md`
기준 plan: `plan/in-progress/refactor/c1-engine-split.md` 및 기타 in-progress plan

---

## 발견사항

### 발견사항 없음 — 미해결 결정 충돌 (CRITICAL)

target 이 일방적으로 우회한 "결정 필요" 항목이 없다. target 의 모든 결정(EngineDriver in-process 전제, WorkflowExecutor 재사용 기각, ExecutionEventEmitter 직접 주입 유지, 4 서비스 분할 확정)은 c1-engine-split.md 의 각 PR 구현 단계에서 이미 합의·완료된 내용이며 02-architecture.md C-1 옵션 A 선택으로 수렴된 결정이다. target 은 그 결정을 spec 에 문서화하는 것이지 새 결정을 내리지 않는다.

### 발견사항 없음 — 선행 plan 미해소 (CRITICAL)

target 이 가정하는 사전 조건 "4 PR 코드 체인 완료 (PR1~4, impl-done 4회 BLOCK:NO)"는 c1-engine-split.md 진행 로그상 2026-06-18 기준 체인이 완성됐다고 명시되어 있다. target 자체도 이 전제를 비고에 명기("구현은 4 PR 모두 정확·검증됨"). 다만 4개 PR (#622·#625·#626·#627)이 GitHub에 push/PR 상태이며 아직 머지 완료 여부가 plan 에서 확인되지 않는다.

- **[INFO]** PR 머지 전 spec 반영 순서
  - target 위치: `## 실행 절차 (planner)` §1
  - 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` PR4 DoD 항목 — "4 PR 머지 후 project-planner 가 spec 반영 + /consistency-check --spec BLOCK:NO"
  - 상세: c1-engine-split.md PR4 절에 "체인 종료 spec-sync: spec-update-engine-split.md (draft 완료) → **4 PR 머지 후** project-planner 가 spec 반영"이라고 명시되어 있다. target 의 실행 절차는 머지 시점을 전제로 하지만 plan 내에 "4 PR 머지 확인" 체크 스텝이 없다. planner 가 본 draft 를 실행할 때 PR 머지 완료 여부를 먼저 확인해야 하는 게이트가 명시되지 않았다.
  - 제안: target 의 `## 실행 절차` 에 "0. PR #622·#625·#626·#627 GitHub 머지 완료 확인" 체크를 추가하거나, c1-engine-split.md PR4 DoD 체크 항목("4 PR 머지 후" 조건)을 planner 에게 명확히 전달하는 서술을 target 비고에 보강한다. 차단이 아닌 추적 메모 수준.

### 발견사항 없음 — 후속 항목 누락 (WARNING)

`spec/conventions/node-output.md` §4.5·§4.2 변경이 `node-output-redesign/` in-progress plan 들과 교차한다.

- **[INFO]** node-output-redesign plan 과의 변경 범위 중첩 추적
  - target 위치: `### spec/conventions/node-output.md` — `§4.5 button_continue data shape 에 selectedItem?·url? optional 등재` + `§4.2 previousOutput 폐기 예정 항에 예외 명시`
  - 관련 plan: `plan/in-progress/node-output-redesign/carousel.md` — `output.interaction.data.selectedItem` (per-item) 및 `url?` 필드가 node-output-redesign/carousel.md §현재 output 에도 등재(line 48/110). `plan/in-progress/node-output-redesign/README.md` — `output.previousOutput` 폐기가 D4 마이그레이션 완료 항목으로 기록.
  - 상세: target 의 두 변경은 PR3 이전부터 verbatim 존재했던 기존 행위를 spec 에 명기하는 것이며 node-output-redesign plan 의 방향(selectedItem 적절·previousOutput 폐기 방향)과 충돌하지 않는다. node-output-redesign plan 은 previousOutput 폐기를 D4 완료로 표기한 반면, target 은 `ButtonInteractionService`(presentation resume 경로)의 Phase 3 완료 전 유예 예외를 명시한다. 두 기술이 모순처럼 보일 수 있으나, node-output-redesign/README.md 의 D4는 spec 본문 반영 완료(폐기 예정 표시)이고 target 은 그 폐기 예정 항에 예외 한 줄을 추가하는 것이므로 실질 충돌 없다. 단 node-output-redesign 슬라이스에 이 예외가 별도 후속 검토 항목으로 있는지 추적이 필요하다.
  - 제안: 조치 불요. 단 node-output-redesign 작업이 재개될 때 `previousOutput` 완전 제거를 검토하면 이 예외 서술도 함께 정리해야 한다는 메모를 c1-engine-split.md `## 후속 고려` 에 한 줄 추가하면 좋다.

---

## 요약

target(`spec-update-engine-split.md`)은 C-1 4-PR 체인의 체인 종료 spec-sync draft 로, c1-engine-split.md 가 공식 위임한 planner 핸드오프 문서다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 관점에서도 심각한 정합성 문제가 없다. 유일한 관찰은 target 의 실행 절차에 "4 PR 머지 완료 확인" 체크가 명시되어 있지 않다는 점(INFO 수준)과 node-output-redesign plan 과의 previousOutput 변경이 충돌 없이 교차한다는 추적 메모 수준의 지적뿐이다. 두 항목 모두 차단 사유가 아니며 실행을 계속해도 된다.

---

## 위험도

NONE
