# Plan 정합성 검토 — `spec/2-navigation` (--impl-prep, `plan/in-progress/integration-dup-delete.md`)

## 발견사항

- **[WARNING]** `IntegrationsService.remove()` 동시-삭제 수정이 만들 새 관측 가능 동작(`DELETE /api/integrations/:id` 두 번째 요청 → 404)이 `spec/2-navigation/4-integration.md` 에 반영될 자리가 트래커 스코프에서 빠졌다
  - target 위치: `spec/2-navigation/4-integration.md` §9.1/§9.4 (`DELETE /api/integrations/:id` 행 — 현재 "삭제 (사용처 있으면 409)" 만 서술, 성공/동시성 관련 서술 없음)
  - 관련 plan:
    - `plan/in-progress/integration-dup-delete.md` (현재 진행 중 — `IntegrationsService.remove()` 를 무락 `remove(entity)` 에서 원자적 `delete({id, workspaceId})` + `affected===0` 판정으로 바꾼다. 처방대로 구현되면 동시 삭제 두 요청 중 진 쪽은 현재의 `[204, 204]` 대신 `[204, 404]` 를 받게 된다)
    - `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 ~4813 항목("`1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10 · `3-schedule.md` §4 에 «동시 삭제 → 두 번째 404» 서술이 없다", planner, 낮음) — 이 항목은 워크플로(#1369)·트리거(#1370) 수정 뒤 2026-09-20 에 등재됐고, 스케줄(#1371) 착수 시점(`--impl-prep review/consistency/2026/09/20/23_37_12` W2)에 `3-schedule.md §4` 로 **스코프가 확장**된 선례가 있다.
  - 상세: 이 프로젝트는 지금까지 이 결함 계열(워크플로→트리거→스케줄)의 각 수정이 착수될 때마다 해당 화면의 spec 문서에 "동시 삭제 두 번째 요청은 404" 서술을 추가하도록 트래커 항목의 스코프를 그때그때 넓혀 왔다(라인 4817 "2026-09-20 스코프 확장"). 지금 `integration-dup-delete.md` 가 그 계열의 다섯 번째 자리(통합)를 닫으려는 시점인데, 같은 트래커 항목(라인 4813)의 스코프에는 `spec/2-navigation/4-integration.md` 가 들어있지 않다 — 실측 결과 해당 문서 §9.4 결과·에러 목록에도 `RESOURCE_NOT_FOUND`/동시성 서술이 전혀 없다(트리거 쪽 `2-trigger-list.md §4.4` 의 "동시 삭제: 두 번째는 404" 와 대칭되는 서술이 통합 문서엔 부재). 같은 세션에서 `plan/in-progress/integration-dup-delete.md` 작성 시 여섯 번째 자리(`WorkspacesService.removeMember()`)는 트래커에 새로 등재했으면서(라인 4803, "2026-09-21 등재"), 정작 이번 PR 이 직접 바꾸는 통합 화면의 문서 갱신 항목은 스코프 확장이 누락됐다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4813 항목의 스코프에 `spec/2-navigation/4-integration.md §9`(`DELETE /api/integrations/:id`) 를 추가하거나, `integration-dup-delete.md` 체크리스트에 "트래커 문서-갱신 스코프에 4-integration.md 추가" 단계를 명시한다. 선례(다른 세 문서)와 마찬가지로 "급하지 않음/비차단"으로 등재만 해도 정합성은 회복된다 — 지금 항목처럼 등재 자체가 빠지는 것이 문제다.

## 요약

`plan/in-progress/integration-dup-delete.md` 가 닫으려는 결함(통합 동시 DELETE 감사 중복)에 대한 처방은 트래커(`spec-draft-nullable-notation-followups.md` 라인 4793)에 이미 정확히 기술돼 있고 두 문서 사이에 모순은 없다. 미해결 결정을 우회하는 부분도 없다("결정 필요"로 남은 다른 트래커 항목들은 이 PR 스코프와 무관). 다만 이 결함 계열의 앞선 세 수정(워크플로·트리거·스케줄) 모두에서 "spec 문서에 동시 삭제 404 서술 추가"라는 후속 트래커 항목이 착수 시점마다 스코프 확장돼 왔는데, 이번 통합 차례에서는 그 확장이 빠져 있다 — 실제 코드 계약(성공 응답 형태의 변화)이 문서에 반영될 진입점을 놓칠 위험이 있는 낮은 심각도의 후속 항목 누락이다. 이 결함 계열 자체가 저심각도(낮음)로 분류돼 온 만큼 차단 사유는 아니다.

## 위험도

LOW
