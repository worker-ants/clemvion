# Plan 정합성 검토 — `spec/2-navigation` (impl-done)

## 검토 배경 확인

- 이번 diff(`codebase/backend/src/modules/integrations/**`, 3파일/357줄)는 `IntegrationsService.remove()` 의 동시 DELETE 중복 감사 결함을 원자적 `delete().affected` 판정으로 고치는 코드다. `spec/2-navigation` 델타는 0파일 — target 문서(1-workflow-list.md / 2-trigger-list.md / 3-schedule.md) 는 이번 PR 에서 손대지 않았다. 이는 정상이다(코드 전용 PR).
- 담당 plan `plan/in-progress/integration-dup-delete.md` 는 워크플로(#1369)·트리거(#1370)·스케줄(#1371) 에 이은 다섯 번째 "동시 삭제 감사 중복" 계열이며, 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목을 닫는 작업이다.
- 이 plan 은 이미 자체 체크리스트에서 `--impl-prep spec/2-navigation` (`review/consistency/2026/09/21/10_27_27`, BLOCK: NO, Critical 0 · WARNING 3) 을 실행·처분했다고 기록한다. 아래는 그 처분이 실제로 트래커 파일에 반영됐는지, 그리고 target 문서와 plan 간 새로운 불일치가 없는지 재확인한 결과다(파일을 직접 열어 검증, 인용에 의존하지 않음).

## 발견사항

- **[INFO]** 목표 문서의 "동시 삭제→두 번째 404" 문서 공백은 사전에 추적된 상태이며 이번 diff 로 새로 생긴 것이 아님
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.6, `spec/2-navigation/3-schedule.md` §4 — 트리거 목록만 §4.4 에서 "두 번째 요청 404" 계약을 서술하고, 워크플로/스케줄 축은 침묵
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4822-4829` (planner 소유, 2026-09-20 등재 · 2026-09-20/09-21 두 차례 스코프 확장으로 `3-schedule.md §4`·`4-integration.md §9` 추가) — "`--impl-prep` 부터 세 라운드 연속 «비차단» 으로 처분됐으니 급하지 않다" 로 명시적 저심각도 유예
  - 상세: 이 항목은 이번 통합(integrations) diff 와 무관하게 워크플로·스케줄 축의 원래 결함(#1369/#1371)이 만든 공백이다. 이번 PR 은 그 두 문서를 건드리지 않으므로 새 갭을 만들지도, 기존 갭을 악화시키지도 않는다. `developer` 는 `spec/` 쓰기 권한이 없어 이 항목을 직접 닫을 수 없고, planner 가 소유자로 이미 등재돼 있어 절차상 올바르게 처리됐다
  - 제안: 조치 불요 — 기존 트래커 항목이 계속 추적. 재-flag 하지 말 것

- **[INFO]** `1-workflow-list.md` frontmatter 의 완료 plan 참조는 이미 알려진 위생 이슈이며 developer 권한 밖
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` (실측 확인: `plan/in-progress/marketplace-and-plugin-sdk.md`, `plan/complete/workflow-duplicate-nodes-edges.md` 2건)
  - 관련 plan: 없음(spec 쪽 위생 이슈) — 동일 세션 `review/consistency/2026/09/21/10_27_27` SUMMARY WARNING #2 (convention_compliance 축) 가 이미 지적: "완료·반영된 plan 을 미구현 surface 로 계속 지목"
  - 상세: `workflow-duplicate-nodes-edges.md` 는 이미 `plan/complete/` 로 이동됐는데 frontmatter 가 여전히 미해소 항목처럼 지목한다. `integration-dup-delete.md` 의 체크리스트도 이를 "W2, spec 이라 권한 밖이고 이 PR 의 코드와 무관 — 기존 오픈 항목이 덮는다" 로 정확히 처분했다(개발자가 spec 을 고치지 않은 것이 맞는 판단)
  - 제안: planner 턴에서 `pending_plans:` 정리 필요 — 단, 본 plan_coherence 축의 새 발견이 아니라 convention_compliance 축이 이미 캡처한 항목의 재확인. 이중 카운트 주의

- **[INFO]** 트래커 스코프 확장(W3) 검증 — 실제로 반영됨
  - target 위치: 해당 없음(target 문서는 변경되지 않음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4793-4801`(이 PR 이 닫는 항목), `:4828-4829`("2026-09-21 재확장: `4-integration.md` §9(§9.1 DELETE 행 · §9.4 코드 목록)도 같은 침묵이다 — 통합 축이 네 번째로 빠지지 않게 함께 넣는다")
  - 상세: `integration-dup-delete.md` 체크리스트가 주장한 "W3 는 그 자리에서 트래커 스코프에 `4-integration.md §9` 를 더해 닫았다" 를 트래커 파일에서 직접 grep 으로 확인 — 실재한다. 아울러 이 계열의 여섯 번째 자리(`WorkspacesService.removeMember()`)도 `:4803-4811` 에 정확히 등재돼 있음을 확인했다(체크리스트의 "grep 0→1 확인" 주장과 일치)
  - 제안: 조치 불요 — plan 의 자기 서술과 실제 파일 상태가 일치함을 확인한 것으로 충분

## 요약

이번 diff 는 `spec/2-navigation` 을 전혀 변경하지 않는 코드 전용 PR(integrations 모듈)이며, 담당 plan(`integration-dup-delete.md`)이 target 문서에 대해 새로운 결정을 내리거나 미해결 결정을 우회한 사실이 없다. target 문서에 남아있는 유일한 관련 공백("동시 삭제→두 번째 404" 서술 부재, 완료 plan 을 가리키는 stale `pending_plans`)은 모두 이 PR 이전부터 존재했고 이미 별도 트래커 항목·이전 impl-prep 리뷰(`10_27_27`)에서 저심각도·비차단으로 등재·처분된 것으로, 실제 트래커 파일을 직접 열어 그 처분(트래커 스코프 확장, W2 out-of-scope 판단)이 그대로 반영돼 있음을 확인했다. 새로운 CRITICAL/WARNING 을 낼 근거가 없다.

## 위험도
NONE
