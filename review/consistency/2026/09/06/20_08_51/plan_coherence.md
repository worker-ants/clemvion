# Plan 정합성 검토

## 발견사항

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 구현은 기존 spec 계약을 그대로 실현했고, 미해결 정책결정은 일방적으로 정하지 않고 이미 등재된 planner 항목에 위임했다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 (Webhook Configuration `endpointPath` 행), §3 PATCH 블록쿼트 — "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "도메인 세부 에러 코드의 표현 방식을 정식화한다" (`- [ ]`, planner, 2026-09-06 등재)
  - 상세: 이번 diff(`codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`/`isEndpointPathUniqueViolation`, `triggers.controller.ts` `@ApiConflictResponse`)는 이전부터 spec 에만 적혀 있고 코드에는 없던(`review/consistency/2026/09/06/14_26_32` Critical 1) 문서한 계약을 실제로 구현했다. `details.code` 형태를 택하면서, 저장소 다른 곳의 7건 선례(top-level `code` 교체)와의 "어느 쪽이 기본인가" 라는 미결 정책은 직접 정하지 않고 위 plan 항목에 명시적으로 위임했다(코드 주석 "표현 방식의 정식화는 planner 항목으로 등재했다"). plan 이 "결정 필요" 로 남긴 사안을 우회하지 않은 사례.
  - 제안: 조치 불필요. plan 항목은 그대로 열어 두고 다음 planner 턴에서 처리.

- **[INFO]** 이번 diff 가 만든 잔여 갭(비대칭 `save()` 래핑, e2e 부재)은 같은 세션에서 이미 plan 에 등재됨 — 누락 아님
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`save()` 호출 8곳 중 2곳만 `rethrowEndpointPathConflict` 로 래핑)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "`endpointPath` 를 쓰는 다음 `save()` 가 충돌 래핑을 빠뜨릴 수 있다" (`- [ ]`, developer, `review/code/2026/09/06/19_31_04` INFO#2) 및 "트리거 `endpoint_path` 409 충돌에 e2e 가 없다" (`- [ ]`, developer, `review/code/2026/09/06/15_52_58` INFO#11)
  - 상세: 지금은 `endpointPath` 를 건드리는 `save()` 가 create/update 둘뿐이라 안전하지만, 향후 이 필드를 쓰는 저장 경로가 새로 생기면 그 경로만 미가공 500 이 된다는 구조적 갭이 이미 후속 항목으로 기록돼 있다. 이번 검토에서 새로 발견할 결함이 아니라 이미 plan 에 반영된 상태.
  - 제안: 조치 불필요. 후속 처리 시 위 두 항목을 참조.

- **[INFO]** target(`spec/2-navigation/2-trigger-list.md`)에 남아 있는 기존 미해결 자기모순 3건은 이번 diff 와 무관하며 이미 plan 이 추적 중
  - target 위치: `spec/2-navigation/2-trigger-list.md` R-2(226행 부근, `POST /api/triggers/:id/auth/rotate-secret` v1.1 예고) vs §3 블록쿼트(같은 API 가 "본 PR 에서 폐기됐다" 서술) / frontmatter `status: implemented` vs 본문 §3 "sort/order 반영은 미구현/Planned" / §2.3.1 Auth Config 행의 "새 인증 설정 만들기" 링크(editor 노출)와 `6-config.md §A.4`(Admin+ 전용) 간 권한 불일치
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 3개 미체크 항목(603행 R-2, 619행 frontmatter status, 630행 dead-end 링크 — 셋 다 `- [ ]`, planner, `review/consistency/2026/09/06/15_31_00` W1/W2/W3 유래)
  - 상세: 이번 `--impl-done` 스코프(`spec/2-navigation/`)의 실제 코드 델타는 `2-trigger-list.md`/`3-schedule.md` 가 커버하는 `triggers.controller.ts`/`triggers.service.ts` 뿐이며, 위 3건은 그 이전 리뷰 라운드에서 이미 등재된 spec 문서 내부 결함이다. 이번 diff 가 새로 만들거나 악화시킨 것이 아니다 — dead-end 링크 항목은 이미 "결정할 것이 없다, 문구 정정만 남음" 으로 처분이 확정된 상태(2026-09-06 정정 기록)이고 나머지 둘도 각각 처분 방향(취소선+콜아웃, `status: partial`+`pending_plans`)이 이미 적혀 있다.
  - 제안: 다음 planner 턴에서 이 3건의 문구 정정을 일괄 반영. 이번 PR 의 push 를 막을 이유는 아니다(스코프 밖·이미 처분 확정).

## 요약

이번 diff 가 `spec/2-navigation/` 스코프에서 실제로 건드린 코드는 `triggers.controller.ts`/`triggers.service.ts` 의 `(workspace_id, endpoint_path)` UNIQUE 충돌 처리뿐이며, 이는 기존 spec 계약(§2.3.1·§3 의 `TRIGGER_ENDPOINT_PATH_CONFLICT`)을 문서 그대로 구현한 것으로 plan 이 "결정 필요" 로 남긴 항목(에러 코드 표현 방식 정식화)을 우회하지 않고 명시적으로 위임했다. 이 diff 자체가 남긴 잔여 갭(비대칭 `save()` 래핑, e2e 부재)도 같은 세션에서 이미 plan 에 등재돼 후속 항목 누락이 없다. `spec/2-navigation/2-trigger-list.md` 에 남아 있는 3건의 기존 자기모순(R-2, frontmatter status, dead-end 링크)은 이번 PR 의 델타와 무관한 선행 결함이며 이미 plan 에서 처분 방향까지 확정한 상태로 추적 중이다. 종합적으로 target과 plan/in-progress 사이의 새로운 충돌이나 누락은 발견되지 않았다.

## 위험도

LOW
