## 발견사항

### Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 2 PR `MERGED`

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

### 발견사항 (4건)

- **[INFO]** `refactor/05-database.md` C-1 의 main 측 체크박스가 여전히 `[ ] 미착수`
  - target 위치: `plan/complete/auth-refresh-rotation-atomic.md` + worktree 내 `plan/in-progress/refactor/05-database.md` (C-1 `[x] ✅ 완료` 로 갱신됨)
  - 관련 plan: `plan/in-progress/refactor/05-database.md` §C-1 (main 브랜치 사본)
  - 상세: main 브랜치의 `plan/in-progress/refactor/05-database.md` 는 C-1 을 `[ ] 미착수` 로 표시하고 있다. 실제 구현 및 plan-complete 이동은 이 PR(auth-refresh-rotation-atomic) 안에서 모두 처리됐다. PR 머지 시 main 의 `refactor/05-database.md` 에 C-1 완료 표시가 반영된다 — PR 내에서 `plan/in-progress/refactor/05-database.md` 가 이미 `[x]` 로 갱신되어 있어 정상 lifecycle. 충돌 없음, 추적 목적 INFO.
  - 제안: 이미 worktree 내 plan 파일이 갱신됐으므로 추가 조치 불요. PR 머지 후 자동 해소.

- **[INFO]** `spec/5-system/3-error-handling.md §1.4` — `spec-draft-exec-intake-queue` 계획과 잠재 중첩
  - target 위치: `spec/5-system/3-error-handling.md` 내 `TOKEN_INVALID` 행 (§1.x 인증 섹션)
  - 관련 plan: `plan/in-progress/spec-draft-exec-intake-queue.md` §169 — `3-error-handling.md §1.4: EXECUTION_TIMEOUT 정의 범위 축소 + EXECUTION_TIME_LIMIT_EXCEEDED 신규 행`
  - 상세: auth-refresh-rotation-atomic 은 `TOKEN_INVALID` 행의 설명을 확장했고, spec-draft-exec-intake-queue 는 동일 파일의 `§1.4 EXECUTION_TIMEOUT` 행을 수정하는 계획을 가지고 있다. 현재 main 측 `3-error-handling.md` 를 확인한 결과 `EXECUTION_TIMEOUT` + `EXECUTION_TIME_LIMIT_EXCEEDED` 행이 이미 반영되어 있어 spec-draft-exec-intake-queue 의 해당 항목은 사실상 이미 완료 상태다. `TOKEN_INVALID` 행과 `EXECUTION_TIMEOUT` 행은 다른 hunks 이므로 머지 충돌은 없다.
  - 제안: `plan/in-progress/spec-draft-exec-intake-queue.md` 의 §169 항목이 이미 main 에 반영됐는지 확인 후, 완료 처리 가능.

- **[INFO]** `unified-model-mgmt-5af7ee` worktree 가 `spec/data-flow/` 하위 파일을 동시 수정 중 — 파일 단위 충돌 없음
  - target 위치: `spec/data-flow/2-auth.md` (auth-refresh-rotation-atomic 변경)
  - 관련 plan: `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`) — `spec/data-flow/1-audit.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/6-knowledge-base.md`, `spec/data-flow/7-llm-usage.md`, `spec/data-flow/8-notifications.md`, `spec/data-flow/9-observability.md`, `spec/data-flow/13-agent-memory.md`, `spec/data-flow/15-external-interaction.md` 수정
  - 상세: 두 worktree 가 `spec/data-flow/` 폴더를 동시에 수정하고 있으나, 변경 파일이 겹치지 않는다. auth-refresh-rotation-atomic 은 `2-auth.md` 만 수정; unified-model-mgmt-5af7ee 는 1·5·6·7·8·9·13·15 를 수정 — 파일 단위 경합 없음. `spec/5-system/1-auth.md` 도 unified-model-mgmt-5af7ee 가 수정하지만 이 파일은 auth-refresh-rotation-atomic 이 건드리지 않는다. stale cascade Step 1/2: Step 1 NOT_ANCESTOR, Step 2 empty(PR 없음) → active 로 처리.
  - 제안: PR 머지 순서에 무관하게 충돌 없음. 추적 목적 INFO.

- **[INFO]** `spec-fix-eia-token-error-codes.md` 의 미해결 항목이 `TOKEN_REVOKED` 에 관한 것인데 — `TOKEN_INVALID` 확장과 논리적 인접
  - target 위치: `spec/5-system/3-error-handling.md` `TOKEN_INVALID` 행 확장 (회전 경합 시 거부)
  - 관련 plan: `plan/in-progress/spec-fix-eia-token-error-codes.md` §1 — `TOKEN_REVOKED` 코드를 에러 표에 추가, §2 — `SCOPE_MISMATCH` HTTP status 결정 미완
  - 상세: spec-fix-eia-token-error-codes 는 EIA 토큰 revoke 관련 코드를 `3-error-handling.md` 에 추가하는 계획이다. auth-refresh-rotation-atomic 은 같은 표의 `TOKEN_INVALID` 행 설명을 확장했다. 두 변경은 같은 표 내 다른 행이라 hunk 충돌은 없으나, EIA 계획이 착수되면 같은 파일을 손댄다는 점에서 머지 시 rebase 주의 필요. 결정 미완 항목(§2 `SCOPE_MISMATCH` 401 vs 403)은 auth refresh 와 무관한 EIA 전용 결정이라 auth-refresh-rotation-atomic 의 결정과 충돌하지 않는다.
  - 제안: 정합 이슈 없음. spec-fix-eia-token-error-codes 착수 시 main 기준 최신 `3-error-handling.md` 로 rebase 후 진행.

---

## 요약

`spec/data-flow/2-auth.md §1.4` 에 refresh 토큰 rotation 원자성 트랜잭션 박스와 TOCTOU 조건부 revoke 명세를 추가한 변경은 in-progress plan 과의 정합성 관점에서 위험 없다. 해당 변경의 근거인 `plan/in-progress/refactor/05-database.md` C-1 은 "미결정 영역 / 원자화 spec 비저촉(D 판정)" 으로 분류됐고 Option A 를 권장했으므로, 이번 구현은 plan 에서 열린 결정을 우회한 것이 아니라 **plan 이 명시적으로 권장한 경로를 이행한 것**이다. `spec/5-system/3-error-handling.md` 의 `TOKEN_INVALID` 행 확장도 다른 in-progress plan 의 변경 대상 행과 겹치지 않는다. worktree 충돌 후보는 `spec-sync-audit-998544`(MERGED — stale skip), `unified-model-mgmt-5af7ee`(active, 단 파일 단위 겹침 없음) 2건이다. worktree 충돌 후보 2건 중 stale 1건 skip, active 1건 분석 — 파일 단위 경합 없음 확인.

## 위험도

NONE

STATUS: SUCCESS
