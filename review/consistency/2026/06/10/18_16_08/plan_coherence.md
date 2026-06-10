# Plan 정합성 검토 결과

검토 대상: `spec/2-navigation/` (구현 완료 후 --impl-done 검토)
대상 plan: `plan/in-progress/trigger-schedule-reverse-sync.md` (worktree: `trigger-schedule-sync-f88604`)

---

## 발견사항

### [WARNING] spec-sync-workflow-list-gaps.md 의 상태 필터 버그 항목이 target spec 변경과 중복 해소 — plan 체크박스 정합 필요

- **target 위치**: `spec/2-navigation/1-workflow-list.md §2.3` — `> ⚠️ 상태 필터 파라미터 불일치 (코드 버그)` callout 제거, "수정 완료" 으로 전환 (commit 8beb1742)
- **관련 plan**: `plan/in-progress/spec-sync-workflow-list-gaps.md` 의 "코드 버그 (구현 수정 필요)" 섹션, `상태 필터 파라미터 불일치 (§2.3)` 항목
- **상세**: target worktree 내 `spec-sync-workflow-list-gaps.md` 는 이미 해당 항목을 `[x]` 로 마킹하고 "수정 완료 확인 (page.tsx 가 ?status=active|inactive 송신, 2026-06-10 impl-prep 검토에서 검증). spec §2.3 경고 문구도 동일 시점 현행화." 메모까지 추가했다. 이는 origin/main 의 해당 파일(체크박스 `[ ]`)과 다른 상태이며, main 에 머지 시 정합하게 반영된다. 이미 worktree 내 일관 처리됨 — 머지 전 확인 권장.
- **제안**: 머지 전 origin/main 의 `spec-sync-workflow-list-gaps.md` 가 worktree 버전(`[x]` + 수정 메모)으로 업데이트됨을 확인. 현재 worktree 내에서는 이미 처리됨.

---

### [WARNING] spec-sync-schedule-gaps.md 의 sort/order 항목이 target spec 변경과 중복 해소 — plan 체크박스 정합 필요

- **target 위치**: `spec/2-navigation/3-schedule.md §4` — GET /api/schedules 의 `sort`/`order` "미구현/Planned" 경고 제거, 구현 완료 서술로 교체 (commit 8beb1742)
- **관련 plan**: `plan/in-progress/spec-sync-schedule-gaps.md` 의 미구현 항목 `GET /api/schedules 의 sort/order 쿼리 반영 (§4)`
- **상세**: target worktree 내 `spec-sync-schedule-gaps.md` 는 해당 항목을 이미 `[x]` 로 마킹하고 "구현 완료 확인 (schedules.service.ts:37-52 whitelist 기반 orderBy, 2026-06-10 impl-prep 검토에서 검증)" 메모를 추가했다. 실제로 `schedules.service.ts` 에 `resolveOrderBy` whitelist 기반 정렬이 PR #448 이전에 이미 구현됨을 코드에서 확인. spec 변경과 plan 체크박스가 일치한다.
- **제안**: 머지 전 origin/main 의 `spec-sync-schedule-gaps.md` 가 worktree 버전(`[x]` 항목)으로 업데이트됨을 확인. 이미 worktree 내 처리됨.

---

### [WARNING] trigger-review-deferred-fixes.md 의 C3(보안) + W4(DB 마이그레이션) 이월 — 후속 plan 누락 가능성

- **target 위치**: `plan/in-progress/trigger-review-deferred-fixes.md` — ai-review 결과 중 C3(rotation 무효), W4(llm_config_workspace_default_unique 마이그레이션 미생성), W7(pruneExpired 스케줄러 없음) 이월
- **관련 plan**: 현재 별도 plan 없음
- **상세**: C3 (Notification signing secret rotation 로직 버그)는 보안 관련 항목으로, `promoteRotatedNotificationSecrets` 내 secretRef 제거 누락이다. W4 (DB partial UNIQUE 마이그레이션 미생성) 는 동시 요청 경합 시 데이터 정합성 위반이 가능하다. 두 항목 모두 `trigger-review-deferred-fixes.md` 에만 기록되고 별도 실행 plan 이 없어 추적 리스크가 있다. W1 (endpoint_path 서버 미강제) 도 마찬가지. 단, 이 plan 파일 자체가 이월 추적 목적으로 생성됐으므로 plan-lifecycle 기준으로는 정상 — 신규 착수 plan 이 아직 없는 것이 유일한 갭.
- **제안**: `trigger-review-deferred-fixes.md` 의 C3/W4 항목을 조기 처리하거나, 해당 스펙 파일(`spec/5-system/`, `spec/data-flow/`) 의 `pending_plans` 에 이 plan 을 등록해 추적성 확보.

---

### [INFO] spec-sync-schedule-gaps.md 잔여 미구현 항목 4건 — target 과 영역 무관, 후속 작업 추적 유효

- **target 위치**: `spec/2-navigation/3-schedule.md` 변경 (§3.1 역방향 동기화 표 + §4 sort/order)
- **관련 plan**: `plan/in-progress/spec-sync-schedule-gaps.md` — 더보기(⋮) 메뉴, 트리거에서 보기, 워크플로우 이름 링크, 타임존 기본값 총 4건 잔여
- **상세**: target 의 spec 변경은 위 4건과 직교하는 영역(역방향 동기화·sort/order)이라 충돌 없음. `3-schedule.md` 의 `pending_plans: [spec-sync-schedule-gaps.md]` 참조는 여전히 유효하다(잔여 4건 때문).
- **제안**: 변경 없어도 됨. 추적 메모로 기록.

---

### [INFO] spec-update-* 계열 plan 4건 — worktree 내부 resolution-applier 산출물, 충돌 없음

- **target 위치**: `plan/in-progress/spec-update-doc-style.md`, `spec-update-gap-callout-plan-links.md`, `spec-update-sse-single-instance-rationale.md`, `spec-update-trigger-schedule-sync.md` (모두 신규, worktree: trigger-schedule-sync-f88604)
- **관련 plan**: 해당 없음 (신규 plan 들)
- **상세**: resolution-applier 가 ai-review SUMMARY 의 WARNING/INFO 에 대한 SPEC-DRIFT 대응으로 생성한 draft plan 들이다. 모두 `worktree: trigger-schedule-sync-f88604` 로 표기되어 있어 현재 worktree 범위 내 작업이고, 다른 active plan 과 충돌하지 않는다.
- **제안**: 변경 없어도 됨.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

다수의 worktree 가 `spec/2-navigation/` 파일 전체를 변경 목록에 포함해 보였으나, 이는 해당 worktree 들이 main 보다 오래된 베이스에서 분기했기 때문이다 (squash merge 후 commit hash 불일치). 각각 stale 판정:

- `kb-lifecycle-groom-57cc46` (branch `claude/kb-lifecycle-groom-57cc46`) — Step 2 PR #511 MERGED
- `kb-unsearchable-warning-b47e20` (branch `claude/kb-unsearchable-warning-b47e20`) — Step 2 PR #511 MERGED  
- `plan-complete-ai-review-backlog-85f80a` (branch `claude/plan-complete-ai-review-backlog-85f80a`) — Step 2 PR MERGED
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`) — Step 1 ancestor (이미 main 에 포함)
- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 2 PR #516 MERGED

나머지 활성 worktree:
- `plan-complete-turn-timing-aa533b` (branch `refactor-backlog-format`) — Step 2 PR #518 OPEN, 단 변경 파일은 `plan/in-progress/refactor/` 만으로 `spec/2-navigation/` 와 **겹치지 않음** — 충돌 없음.

stale worktree 5개가 활성 체크아웃으로 남아있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan (`trigger-schedule-reverse-sync.md`) 의 spec/2-navigation/ 변경은 전반적으로 plan 정합성이 양호하다. 핵심 구현 갭 2건(Trigger→Schedule 역방향 is_active 동기화, DELETE removeJob)을 올바르게 구현 완료 표기로 전환했으며, 이에 맞춰 `spec-sync-schedule-gaps.md`·`spec-sync-workflow-list-gaps.md` 의 완료 항목도 `[x]` 처리했다. 미해결 결정 우회나 active worktree 와의 동시 수정 충돌은 발견되지 않았다 — 외관상 충돌로 보이던 5개 worktree 는 stale 판정(Step 1/2)으로 제외됐다. 유일한 주의 항목은 ai-review 이월 fix 4건(`trigger-review-deferred-fixes.md`) 중 C3/W4 가 보안·DB 무결성 관련이라 별도 추적 plan 이 없다는 점이다. worktree 충돌 후보 6건 중 stale 5건 skip, active 충돌 0건.

---

## 위험도

LOW
