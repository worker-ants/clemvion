# Plan 정합성 검토 결과

검토 대상: `spec/4-nodes/4-integration/1-http-request.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-11

---

## 발견사항

### [WARNING] `refactor/04-security.md` C-3 체크박스 미갱신 — 결정 기록 누락
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §8.2 Rationale` — "사용자 결정(2026-06-11): 옵션 A 진행"
- **관련 plan**: `plan/in-progress/refactor/04-security.md §C-3 [Critical] authentication=none HTTP Request 노드 SSRF 가드 미적용` — 현재 `[ ] 미착수` 로 표기
- **상세**: C-3 는 A/B/C 세 옵션이 모두 열려 있고 "미착수" 로 남아 있다. target spec 의 §8.2 Rationale 은 "사용자 결정(2026-06-11): 옵션 A 진행" 을 명기하고 있고, `plan/in-progress/http-ssrf-all-auth.md` 도 같은 결정을 근거로 착수됐다. 그러나 C-3 항목 자체에 결정 결과와 worktree `http-ssrf-all-auth` 인계 기록이 없어, 04-security 를 보는 다른 작업자가 C-3 를 "여전히 미결정 + 미착수" 로 오판할 수 있다. plan lifecycle 상 착수 확인이 C-3 에 반영되지 않은 상태.
- **제안**: `plan/in-progress/refactor/04-security.md` C-3 항목에 "(사용자 결정 2026-06-11, 옵션 A → worktree `http-ssrf-all-auth`, `plan/in-progress/http-ssrf-all-auth.md`)" 를 기록하고 체크박스를 진행 중 또는 완료 후 마감. plan 갱신 주체: developer (worktree 운영자) 또는 project-planner.

---

### [INFO] `spec-fix-prod-guards-prose.md` frontmatter worktree 필드가 stale worktree 참조
- **target 위치**: 간접 관련 — target 과 동일 spec 영역 아님
- **관련 plan**: `plan/in-progress/spec-fix-prod-guards-prose.md` frontmatter `worktree: prod-fail-closed-guards`
- **상세**: `prod-fail-closed-guards` 는 PR #539 가 MERGED 상태(Step 2 확인)이므로 stale worktree. `spec-fix-prod-guards-prose.md` 는 spec prose 보강 작업으로 `1-http-request.md` 를 건드리지 않아 target 과 실제 충돌 없음. 단, worktree 필드가 이미 종료된 branch 를 가리키는 점은 cleanup 트리거로 남긴다.
- **제안**: `spec-fix-prod-guards-prose.md` 의 `worktree` 필드를 신규 worktree 로 재배정하거나 `(unstarted)` sentinel 로 갱신. `cleanup-worktree-all.sh` 실행으로 stale worktree 정리 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석:

active worktree 목록:
- `ai-node-override-fields` (branch `claude/ai-node-override-fields`)
- `audit-coverage-naming` (branch `claude/auth-config-audit`) — PR #547 OPEN → active
- `auth-refresh-rotation-atomic` (branch `claude/auth-refresh-rotation-atomic`)
- `code-node-isolated-vm` (branch `claude/code-node-isolated-vm`)
- `fix-embedding-test-dimension-a3d42a` (branch `claude/fix-embedding-test-dimension-a3d42a`)
- `fix-model-configs-kind-400-88c8b4` (branch `claude/fix-model-configs-kind-400-88c8b4`)
- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`)
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-pr4`)

대상 spec 파일 (`spec/4-nodes/4-integration/1-http-request.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/conventions/node-output.md`) 과의 충돌 후보 검사 결과:
- `prod-fail-closed-guards` — Step 1: ACTIVE (squash merge 로 hash 불일치), Step 2: PR #539 MERGED → **stale skip**. 해당 worktree 가 변경한 파일에 target 3개 파일이 포함되지 않아 실제 충돌면도 없음.
- 그 외 6개 active branch — target 3개 파일을 변경하지 않음 → 충돌 없음.

stale skip 목록:
- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 2 PR #539 MERGED (squash merge). 활성으로 남아있을 이유 없음 → `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target spec `spec/4-nodes/4-integration/1-http-request.md` 는 `refactor/04-security.md` C-3 의 세 선택지 중 "옵션 A" 를 사용자 결정(2026-06-11)으로 채택하고 이를 §8.2 Rationale 에 명기했다. 이는 C-3 에서 열어둔 결정을 target 이 일방적으로 확정한 것이 아니라, 사용자가 직접 결정한 내용을 spec 에 반영한 것이므로 "미해결 결정 우회" 에 해당하지 않는다. 다만 C-3 체크박스 자체에 결정 결과와 worktree 인계가 기록되지 않아 추적 단절이 생겼으며(WARNING), spec-fix-prod-guards-prose.md 의 worktree 참조가 stale PR에 묶여 있다(INFO). worktree 충돌 후보 8건 중 stale 1건(prod-fail-closed-guards) skip, active 7건 분석, target 파일과 실제 동시 편집 충돌 0건.

---

## 위험도

LOW
