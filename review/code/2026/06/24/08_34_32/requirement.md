# 요구사항(Requirement) 리뷰 결과

**리뷰 대상**: M-3 2단계 — finish/review 가드를 AssistantFinishGuard 로 분리  
**커밋**: `1c17795c`  
**검토 일시**: 2026-06-24

---

## 발견사항

### **[INFO] [SPEC-DRIFT]** `spec/3-workflow-editor/4-ai-assistant.md §952-961` 의 `shouldSkipReview` 조건 목록이 낡음

- **위치**: `spec/3-workflow-editor/4-ai-assistant.md` §952 "review skip 조건 (`shouldSkipReview`)" — 6번째 항목 `state.finishBlockCount > 0`
- **상세**: spec §952-961 은 `state.finishBlockCount > 0` 을 review skip 조건의 하나로 열거한다. 그러나 동일 spec §1072-1088 (§5 "Review guard 항상 발동") 에서 이 조건을 의도적으로 제거했음이 명시되어 있다. 코드(`assistant-finish-guard.service.ts` `shouldSkipReview` 메서드) 역시 `finishBlockCount > 0` 체크를 포함하지 않으며, 이는 "두 가드는 독립 계층으로 운영"이라는 설계 결정(§1078)을 올바르게 구현한 것이다. 코드가 맞고 spec §952 목록이 §1078 의 결정을 아직 반영하지 못한 상태.
- **제안**: 코드 유지. `spec/3-workflow-editor/4-ai-assistant.md §952-961` 의 `state.finishBlockCount > 0` 항목을 제거하고 §1078 에 기술된 "남은 skip 조건 (최소 안전망)" 목록(`reviewCompleted` / `reviewRoundCount >= 2` / `planClearedThisTurn` / 성공 edit 0 / non-trigger 노드 ≤ 1)으로 교체. 반영 대상: `spec/3-workflow-editor/4-ai-assistant.md §952–961`. 본 reviewer 는 spec 직접 수정 금지 — `project-planner` 위임.

---

### **[INFO] [SPEC-DRIFT]** `spec §945` 가 verify 발동 조건을 `MIN_EDITS_FOR_VERIFY` 로 기술하나 코드는 노드 수 기반(`MIN_NONTRIGGER_NODES_FOR_VERIFY`)으로 대체됨

- **위치**: `spec/3-workflow-editor/4-ai-assistant.md §945` 3번 항목: "성공 edit ≥ `MIN_EDITS_FOR_VERIFY` 이고 non-trigger 노드 ≥ 3 인 non-trivial 턴이면"
- **상세**: spec §680 및 §945 는 `MIN_EDITS_FOR_VERIFY` 상수를 병렬 조건으로 기재한다. 그러나 코드(`assistant-finish-guard.service.ts` L117-125 및 L260-263) 는 edit 수 임계값을 두지 않고 `MIN_NONTRIGGER_NODES_FOR_VERIFY = 3` (non-trigger 노드 수)만으로 발동 여부를 판정한다. 코드의 JSDoc 은 이유를 명확히 설명한다: "회복 라운드에서 update_node 가 반복 호출되면 edit 수는 부풀지만 실제 캔버스 규모는 그대로다 — 노드 수가 의미 검증 비용/이득의 더 정확한 proxy." 이는 의도적 개선이며, 코드가 더 정확한 설계를 반영한다. `MIN_EDITS_FOR_VERIFY` 상수는 코드에 존재하지 않는다.
- **제안**: 코드 유지. `spec/3-workflow-editor/4-ai-assistant.md §945` 에서 `MIN_EDITS_FOR_VERIFY` 언급을 제거하고 "non-trigger 노드 ≥ 3(`MIN_NONTRIGGER_NODES_FOR_VERIFY`)" 단일 조건으로 교체. 마찬가지로 §680 표의 해당 행도 동기화. 반영 대상: `spec/3-workflow-editor/4-ai-assistant.md §680`, `§945`. 반영은 `project-planner` 위임.

---

### **[INFO]** `collectPendingUserConfig` 가 호출될 때마다 `shadow.snapshot()` 을 재호출

- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` L24
- **상세**: `collectPendingUserConfig(shadow, nodeId, ...)` 함수 내부에서 `shadow.snapshot()` 을 매번 호출한다. `evaluateReviewGuard` 는 상단에서 이미 `const snapshot = shadow.snapshot()` 으로 스냅샷을 한 번 찍은 뒤, `detectOnly` 루프에서 노드별로 `collectPendingUserConfig(shadow, n.id, ...)` 를 호출하므로 N번 추가 스냅샷이 발생한다. 버그는 아니며(`shadow.snapshot()` 이 shallow clone 이라 비용이 크지 않음), 기존 `this.collectPendingUserConfig(shadow, n.id)` 도 동일 패턴이었다. 리팩터링 목적(edit 경로·review 가드 공유)은 달성됐다. 추후 성능 민감 경로에서는 스냅샷을 인자로 받는 오버로드를 고려할 수 있다.
- **제안**: 현재 변경 범위에서는 유지. 성능 문제 징후 발생 시 `collectPendingUserConfig(snapshot, nodeId, ...)` 시그니처로 개선 검토.

---

## 기능 완전성 평가

이번 변경의 핵심 목표는 `WorkflowAssistantStreamService.streamMessage` 에 혼재하던 2단계 finish 가드 로직을 무상태 collaborator `AssistantFinishGuard` 로 추출하는 것이다. 이 목표는 완전히 달성됐다.

- `evaluateFinishGuard` / `evaluateReviewGuard` / `shouldSkipReview` 세 메서드가 spec §10 의 상태기계를 정확히 구현한다.
- `FinishGuardState` 의 6개 필드(`finishBlockCount`, `editsSinceLastFinishBlock`, `planClearedThisTurn`, `reviewCompleted`, `reviewRoundCount`, `verifyFiredOnce`) 가 spec 명세와 일치한다.
- `isPlanPendingApproval` 함수가 `active-plan-context.ts` 로 이동해 stream.service 3곳에서 공유된다.
- `collect-pending-user-config.ts` 분리로 edit 경로와 review 가드가 동일 detect 로직을 공유한다.
- `WorkflowAssistantModule` 에 `AssistantFinishGuard` 가 provider 로 등록됐다.
- 단위 테스트 12개가 `evaluateFinishGuard` 전 분기와 `shouldSkipReview` 판정을 커버한다.
- 기존 통합 테스트 381개가 무변 green 으로 동작 보존을 확인했다.

TODO/FIXME/HACK 마커 없음. 에러 반환 타입(`FinishGuardError`) 이 `export` 되어 단위 테스트 import 가능. 모든 코드 경로에서 적절한 반환값이 존재한다. 발견된 SPEC-DRIFT 2건은 모두 코드가 옳고 spec이 낡은 케이스로, 코드 수정 대상이 아니다.

---

## 요약

이번 리팩터링은 spec 3-workflow-editor §10 의 2단계 finish 가드 상태기계를 요구사항 누락 없이 `AssistantFinishGuard` 로 올바르게 추출했다. 가드 상수·타입·메서드 시그니처·상태 전이가 spec 과 일치하며, 의도적으로 제거된 `finishBlockCount > 0` skip 조건과 노드 수 기반 verify 임계값은 코드가 옳고 spec 이 낡은 SPEC-DRIFT 로 분류된다. 코드 수정이 필요한 CRITICAL/WARNING 발견사항은 0건이다.

---

## 위험도

NONE
