# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 최고 위험도 LOW, CRITICAL 0건)

## 전체 위험도
**LOW** — target(`spec/2-navigation/`) 델타 0(`spec_impact: none`)의 순수 구현 PR. 5개 checker 모두 새 CRITICAL 위배를 찾지 못했고, 이미 3라운드 `/ai-review`·1라운드 `--impl-prep` consistency-check 를 거쳐 대부분의 이탈을 스스로 해소했다. 남은 항목은 "구현 완료로 spec 문면이 stale 해졌는데 그 후속을 담을 살아있는 트래커 항목이 아직 신설되지 않음"이라는 공통 뿌리의 WARNING 1건(5개 checker 중 4곳에서 각도만 다르게 지적)과, 독립된 WARNING 2건(리뷰 인용 형식 위반, 메서드명 유사성)뿐이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드는 CRITICAL 이 없어 인계 대상도 없다. 다만 아래 경고#1 은 근본적으로 spec 문서 갱신(`project-planner` 권한)이 필요한 사안이므로, 등급은 WARNING 이지만 실행 주체는 planner 임을 명시해 둔다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, plan_coherence, rationale_continuity, convention_compliance, naming_collision (공통 뿌리, 각도만 다름) | 이 PR 구현 완료로 spec 여러 곳의 "미구현 (Planned)" 태그·§4.3 과도기 문구·§4.4 락 범위·frontmatter `code:` 목록·R8 괄호가 즉시 stale 해지는데, 이를 반영할 **살아있는 트래커 항목**이 아직 신설되지 않음(`trigger-deletion-release.md` 자신의 체크리스트 한 줄로만 존재, 미체크) | `spec/2-navigation/2-trigger-list.md §4.3/§4.4`(과도기 문구·frontmatter `code:`), `spec/data-flow/10-triggers.md §1.4`, `spec/data-flow/11-workflow.md §3.1/§3.2`, `spec/data-flow/12-workspace.md §1.10`, `spec/conventions/secret-store.md`(`status: partial`), `spec/5-system/15-chat-channel.md`(R8 괄호) | `plan/in-progress/trigger-deletion-release.md` 체크리스트 "트래커 반영"(미체크) + `plan/in-progress/spec-draft-nullable-notation-followups.md`(자리만 지정, 항목 미신설) | 이 plan 을 `plan/complete/` 로 옮기기 **전에** `spec-draft-nullable-notation-followups.md`(또는 신규 draft)에 실제 planner 후속 항목을 신설: Planned 태그 제거(4곳), `secret-store.md` `partial`→`implemented`, `15-chat-channel.md` R8 괄호에 `WorkflowsService.remove`·`WorkspacesService.deleteWorkspace` 추가, §4.4 락 대기 상한 범위를 워크플로·워크스페이스 부모 잠금까지 확장, `2-trigger-list.md` frontmatter `code:` 에 `trigger-resource-release.ts`·`trigger-resource-releaser.service.ts`·신규 e2e spec 등재 |
| 2 | convention_compliance | 신규 테스트 주석이 `review-citations.md §2` 가 금지하는 bare `hh_mm_ss` 인용을 씀(같은 diff 의 인접 인용 3곳은 전체 경로 사용, 이 1곳만 예외) | `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:735` | `spec/conventions/review-citations.md §2`("bare `hh_mm_ss` 는 쓰지 않는다") | `18_45_09` → `review/code/2026/09/17/18_45_09` 로 전체 경로 표기(developer 쓰기 권한 `codebase/**` 안, 이번 세션에서 즉시 수정 가능) |
| 3 | naming_collision | `teardownChannelConfig`(신규)와 `teardownChatChannel`(기존)이 같은 클래스 안에서 `ChatChannel`↔`ChannelConfig` 순서만 바뀐 이름이라 시각적으로 유사 — 의미는 명확히 다르나(보상 경로 vs 정상 경로) grep·로그에서 구별이 어려움 | `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` | 같은 파일의 기존 `teardownChatChannel(trigger)` | 가독성 개선 권고: 보상 경로 전용임을 드러내는 이름(예: `teardownRegisteredChannel`)으로 rename 검토. 블로킹 아님 — 3라운드 리뷰가 이미 코드 변경 0 으로 수렴한 뒤라 이번 PR 범위에서 강제하지 않음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 워크플로·워크스페이스 부모 삭제 트랜잭션에 신설된 5초 `lock_timeout`이 어느 spec 에도 아직 노출되지 않음 (경고#1의 하위 항목) | `trigger-resource-releaser.service.ts` `lockParentAndListTriggerIds` | 경고#1과 같은 planner 턴에서 §4.4 확장으로 함께 반영 |
| 2 | cross_spec | `data-flow/10-triggers.md §1.4` "Trigger 직접 삭제" 행은 이 PR로 오히려 사실과 정합해짐(순서 반전이 옳은 방향) | `spec/data-flow/10-triggers.md §1.4` | 조치 불필요(긍정 확인) |
| 3 | rationale_continuity | R8 "반드시 unregister" 문구의 괄호가 옛 범위(`TriggersService.remove`)만 나열 (경고#1에 포함) | `spec/5-system/15-chat-channel.md` R8 | 경고#1과 함께 처리 |
| 4 | plan_coherence | `deleteByPrefix` 호출부가 "한 곳"이라는 2026-08-09 시점 실측 서술이 이 PR로 무효화(안전 결함 아님, 가드는 호출부 수와 무관하게 작동) | `plan/in-progress/backend-lint-gate-broken-on-main.md` 라인 211-213 | "(2026-08-09 시점)" 한정어 추가 권장 — 낮은 우선순위, 경고#1 처리 시 곁들여도 됨 |
| 5 | naming_collision | 로그 접두 `TriggersService:` → `ChatChannelBinderService:` 정정이 전수 반영됨을 확인(잔존 0건) | `chat-channel-binder.service.ts` | 조치 불필요(긍정 확인) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0, 순수 구현 PR. 4개 spec 문서의 Planned 태그가 머지로 stale 해짐(이미 plan 이 예견) + 5초 락 미노출 |
| rationale_continuity | LOW | 결정 재도입·번복 없음(Cafe24 lock 기각, `#676` forwardRef 회피 선례 정확히 계승). 3건 모두 이미 추적된 문면-구현 범위 차이 |
| convention_compliance | LOW | 규약 신규 위반 1건(review-citations bare 시각) + code: frontmatter 미갱신(INFO) 외 위반 없음 |
| plan_coherence | LOW | D1/D3~D6 결정 정확히 구현, D7 유예 유지. "트래커 반영" 체크리스트가 아직 살아있는 트래커에 미신설 |
| naming_collision | LOW | spec 식별자 신규 도입 0건. 코드 심볼 전수 grep 충돌 없음. 메서드명 유사성 1건(가독성) |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK:NO) 이 plan(`trigger-deletion-release.md`)을 `plan/complete/` 로 이관하기 전에 `spec-draft-nullable-notation-followups.md`(또는 신규 draft)에 spec drift 5곳(Planned 태그 4곳·R8 괄호·§4.4 범위·frontmatter `code:`)을 실제 planner 후속 항목으로 신설한다.
2. `workspaces.service.spec.ts:735` 의 bare `18_45_09` 인용을 `review/code/2026/09/17/18_45_09` 전체 경로로 수정한다(즉시 가능).
3. (선택) `teardownChannelConfig` rename 검토 — 보상 경로 전용임을 이름에 드러낼 것.
4. (낮은 우선순위) `backend-lint-gate-broken-on-main.md` 의 `deleteByPrefix` "호출부 한 곳" 서술에 시점 한정어를 추가한다.
