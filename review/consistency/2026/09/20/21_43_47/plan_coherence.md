# Plan 정합성 검토 — spec/2-navigation (--impl-prep)

## 발견사항

- **[INFO]** §4.4 "동시 삭제 → 404" 서술이 아직 미검증 상태이며, 그 사실이 caveat 없이 단정문으로 남아 있다
  - target 위치: `spec/2-navigation/2-trigger-list.md:318` — "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4761-4769` (planner 항목, `[ ]` 미해소) 의 (b) — "`2-trigger-list.md` §4.4 의 «두 번째는 404» 는 **구현 검증 대기** 라는 caveat 이 필요하다 — 바로 위 developer 항목이 그 선례가 코드에서 성립하는지 실측할 때까지는 spec 이 단정하고 있다." / 같은 파일 4753-4759 의 developer 항목("`TriggersService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수 있다") / `plan/in-progress/trigger-dup-delete.md` (금번 --impl-prep 대상 developer plan)
  - 상세: 코드 실측 결과 `TriggersService.remove()` (`codebase/backend/src/modules/triggers/triggers.service.ts:1060-1107`, 특히 1080-1086) 는 advisory lock 을 잡은 뒤 행 존재를 재확인하지 않고 바로 `m.remove(trigger)` 를 호출한다 — 즉 현재 코드는 동시 두 DELETE 모두 204 로 끝나고 감사 행이 두 번 남는다(`trigger-dup-delete.md` §A 의 재현 서술과 일치). 그런데 spec §4.4 는 caveat 없이 "두 번째는 404" 를 현재형 사실로 단정한다 — target 이 전제하는 사전 조건(락 안 재조회 → 404)이 바로 이 --impl-prep 대상 plan(`trigger-dup-delete.md`)에서 아직 구현되지 않은 상태다. tracker 는 이 간극을 이미 알고 있고(4768-4769), `trigger-dup-delete.md` 도 "이 PR 이 §4.4 를 사실로 만들면 그 caveat 자체가 불필요해진다" 고 스스로 정리해 두 plan 이 서로 어긋나지 않는다 — 다만 그 조율이 오직 산문으로만 적혀 있고 `trigger-dup-delete.md` 의 체크리스트에는 "트래커 항목 해소" 로만 뭉뚱그려져 있다.
  - 제안: 차단 사유는 아니다(양쪽 plan 이 이미 같은 결론을 공유). 다만 `trigger-dup-delete.md` 종결 시 `spec-draft-nullable-notation-followups.md:4761-4769` 항목의 (b) 를 "e2e 로 실측 완료 — caveat 불필요, spec §4.4 는 이제 참" 으로 명시 처분하고, 그 항목의 (a)(`1-workflow-list.md`/`data-flow/12-workspace.md` 서술 누락)는 **별개로 남겨** 이번 PR 의 범위 밖임을 분명히 적는 것을 권장한다 — 지금처럼 (a)(b) 가 한 체크박스에 묶여 있으면, (b) 만 해소된 뒤 실수로 항목 전체를 `[x]` 처리하거나 반대로 (b) 의 해소 사실이 묻힐 위험이 있다.

## 요약

`plan/in-progress/trigger-dup-delete.md` 는 `TriggersService.remove()` 의 동시 DELETE 중복 감사 결함을 고치는 developer plan 으로, `spec_impact: none` 을 선언하고 spec 을 직접 건드리지 않는다. target `spec/2-navigation/2-trigger-list.md` §4.4 가 이미 caveat 없이 "동시 삭제 → 두 번째 404" 를 단정하고 있는 것은 실측(코드 확인)상 현재 거짓이지만, 이 간극은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 살아 있는 트래커에 planner 항목으로 이미 등록돼 있고 `trigger-dup-delete.md` 도 그 항목을 명시적으로 인지·인용하며 "이 PR 이 착지하면 caveat 자체가 불필요해진다" 는 동일한 결론을 공유한다. 미해결 결정과의 정면 충돌이나 후속 항목의 완전한 누락은 없고, 두 plan 간 조율은 이미 산문 수준에서 일치하지만 체크리스트/트래커 항목의 문언이 그 조율을 명시적으로 반영하지 않아 종결 시 누락 위험이 남는다.

## 위험도
LOW
