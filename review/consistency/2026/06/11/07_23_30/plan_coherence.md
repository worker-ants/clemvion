## 발견사항

- **[INFO]** send-email transport 후속 미추적
  - target 위치: `plan/in-progress/db-pool-creds-pubsub.md` §현황 — "send-email.handler.ts 도 동일 패턴(invalidateTransport(id)) — 동일 갭. 본 PR 은 DB 풀만 와이어링하고 bus 는 generic 설계 → email 은 후속 1줄(별 항목)"
  - 관련 plan: 없음 — `plan/in-progress/` 어디에도 send-email transport invalidation 후속 추적 항목이 없음.
  - 상세: target plan 이 "email 후속은 별 항목"으로 미룬다고 명시하지만, 대응하는 plan 항목이 존재하지 않는다. `IntegrationCacheBus` 가 generic 으로 설계된다는 점이 spec 에 기록되지 않으면 bus 의 범용성이 spec 에 드러나지 않는다.
  - 제안: target plan 체크리스트에 "send-email 후속 plan 항목 생성 또는 `spec/4-nodes/4-integration/2-database-query.md` §4 신규 문단에 bus 범용성(email transport 등 타 핸들러도 register 가능) 명시" 를 추가하거나, 별도 plan 항목으로 추적 시작.

- **[INFO]** `spec-sync-audit` 워크트리 sentinel — 실제 checkout 없음
  - target 위치: 해당 없음 (target plan 자체 이슈 아님)
  - 관련 plan: `plan/in-progress/spec-sync-canvas-gaps.md`, `spec-sync-5-system-metrics-gap.md` 등 다수가 `worktree: spec-sync-audit` 를 frontmatter 에 보유.
  - 상세: `git worktree list` 에 `spec-sync-audit` 또는 `spec-sync-audit-998544` 체크아웃이 없음. 해당 플랜들이 참조하는 spec 파일(`spec/3-workflow-editor/`, `spec/5-system/` 등)은 target plan(`spec/4-nodes/4-integration/2-database-query.md`)과 직교하므로 충돌은 없다. target plan 진행 자체를 차단하지 않음.
  - 제안: 이 sentinel worktree 들은 실제 체크아웃이 없으므로, 재개 시 `ensure-worktree.sh` 로 실제 worktree 배정 필요.

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `integration-expiry-fixes-1d7c7d` (branch `claude/integration-expiry-fixes-1d7c7d`) — Step 1: ACTIVE (squash merge 케이스), Step 2: PR #526 MERGED → **stale**. 해당 branch 가 건드린 spec 파일(`spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`)은 target 과 다른 파일이므로 충돌 없음.
- `health-probe-status-d9a184` (branch `claude/health-probe-status-d9a184`) — Step 1: ACTIVE, Step 2: PR #527 MERGED → **stale**. 해당 branch 가 건드린 spec 파일(`spec/5-system/16-system-status-api.md`, `spec/5-system/3-error-handling.md`, `spec/data-flow/9-observability.md`)은 target 과 다른 파일이므로 충돌 없음.
- `makeshop-catalog-labels` (branch `claude/makeshop-catalog-labels`) — Step 1: STALE (merge-base ancestor 확인). PR 조회 생략 (Step 1 이미 stale). target 과 관련 없음.

해당 3개 worktree 가 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

## 요약

`plan/in-progress/db-pool-creds-pubsub.md` 는 `refactor/04-security.md` m-4 의 사용자 승인(2026-06-10) 에 직접 근거하며, 미해결 결정을 우회하거나 일방적으로 내린 항목이 없다. target plan 이 손대는 `spec/4-nodes/4-integration/2-database-query.md` 를 다른 active worktree 가 동시에 수정 중인 사례는 없다. 선행 조건(사용자 승인 + spec 갱신 선행)도 plan 내 체크리스트에 명시되어 있고 순서가 올바르다. 후속 항목으로 "send-email transport invalidation 추적 plan 미생성" 하나가 INFO 로 도출된다. worktree 충돌 후보 3건은 모두 stale(PR #526·#527 MERGED, makeshop-catalog-labels ancestor)로 skip 처리했다.

## 위험도

LOW
