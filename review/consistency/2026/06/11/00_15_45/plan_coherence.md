### 발견사항

- **[INFO]** `spec-sync-workflow-list-gaps.md` worktree stale skip
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 참조
  - 관련 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md` (worktree: `spec-sync-audit`)
  - 상세: `spec-sync-audit` 브랜치는 GitHub PR MERGED 상태 — Step 2 stale 판정. 이 plan 의 미완 항목(정렬 UI · 태그 필터 · 폴더 필터 · 빈 상태 마켓플레이스 링크)은 target 이 건드리지 않는 영역이라 충돌 없음.
  - 제안: stale skip 목록 참조. worktree cleanup 권장.

- **[INFO]** `spec-sync-integration-common-gaps.md` worktree stale skip
  - target 위치: `spec/2-navigation/4-integration.md` §11 개정 영역
  - 관련 plan: `plan/in-progress/spec-sync-integration-common-gaps.md` (worktree: `spec-sync-audit`)
  - 상세: 이 plan 은 `spec/4-nodes/4-integration/0-common.md` 를 대상으로 하며 `spec/2-navigation/4-integration.md` §11 과는 직교. 게다가 worktree `spec-sync-audit` 는 MERGED — stale 판정. 충돌 없음.
  - 제안: stale skip 목록 참조.

- **[INFO]** `spec-code-cross-audit-2026-06-10.md` — V-01 결정 이미 반영
  - target 위치: `spec/2-navigation/4-integration.md` §11.1 makeshop 처리 + `spec/1-data-model.md`
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` (worktree: `spec-sync-audit-998544`) §후속 "V-01 severe — makeshop expired 오격하 코드 수정 결정 대기"
  - 상세: `spec-sync-audit-998544` 브랜치는 GitHub PR MERGED. V-01 결정(`isRefreshCapable` 일반화)과 V-07 결정(§11.2 방향 채택)은 `plan/in-progress/integration-expiry-fixes.md` 에 사용자 결정(2026-06-10)으로 명시 기록된 후 구현됐다 — 미해결 결정 우회가 아니라 정식 결정 후 적용. 충돌 없음.
  - 제안: 두 worktree 모두 MERGED — stale cleanup 권장.

- **[INFO]** `spec/2-navigation/` 범위 내 다른 파일(1-workflow-list, 0-dashboard, 10-auth-flow 등) 미변경
  - target 위치: `spec/2-navigation/` 전체 중 `4-integration.md` 만 변경
  - 관련 plan: `--impl-done` 검토는 `spec/2-navigation/` 폴더 전체를 scope 로 선언하고 있으나 target 의 실제 변경은 `spec/2-navigation/4-integration.md` 에만 국한됨.
  - 상세: consistency checker 의 `/consistency-check --impl-done spec/2-navigation/` scope 가 폴더 전체를 커버하도록 선언됐고, `plan/in-progress/integration-expiry-fixes.md` 체크리스트의 "범위 밖 WARNING(14-execution-history·0-dashboard·16-agent-memory)은 후속 backlog" 가 명시적으로 기재되어 있어 의도적 처리임. 새 미해결 후속 항목을 plan 에 명시 기재했는지 확인 권장.
  - 제안: `integration-expiry-fixes.md` 에 "범위 밖 WARNING" 항목을 해당 spec-sync-* backlog plan 에 크로스 레퍼런스로 등록하거나, 본 plan 을 완료 처리 전 확인.

---

### Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `spec-sync-audit` (branch `spec-sync-audit` 또는 `claude/spec-sync-audit`) — Step 2 PR MERGED. 관련 plan: `spec-sync-workflow-list-gaps.md`, `spec-sync-integration-common-gaps.md`, `spec-sync-canvas-gaps.md`, `spec-sync-config-gaps.md` 등 다수
- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 2 PR MERGED. 관련 plan: `spec-code-cross-audit-2026-06-10.md`, `spec-sync-common-gaps.md`

해당 worktree 들이 물리적으로 checkout 목록에 남아있지 않으므로(git worktree list 미확인) 별도 cleanup 트리거는 불필요할 수 있으나, plan frontmatter 의 `worktree:` 값이 여전히 `spec-sync-audit` / `spec-sync-audit-998544` 로 남아있는 파일들은 정리 권장.

---

### 요약

`spec/2-navigation/` 폴더를 scope 로 하는 이번 `--impl-done` 검토에서 Plan 정합성 관점의 CRITICAL 또는 WARNING 수준 충돌은 발견되지 않았다. `spec/2-navigation/4-integration.md` §11 변경(makeshop refresh-capable 일반화·§11.2 방향 정합)은 `spec-code-cross-audit-2026-06-10.md` 가 "후속 결정 대기"로 남겼던 V-01·V-07 을 사용자 결정(2026-06-10) 후 정식 구현한 것으로, 미해결 결정 우회가 아니다. `spec-sync-workflow-list-gaps.md` / `spec-sync-integration-common-gaps.md` 등 `spec-sync-audit` worktree 소속 plan 들은 해당 worktree branch 가 MERGED 된 stale 상태라 §5 worktree 충돌 대상에서 제외했다. worktree 충돌 후보 2건 모두 stale 판정 skip.

### 위험도

NONE
