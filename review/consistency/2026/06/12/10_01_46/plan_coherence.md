### 발견사항

- **[WARNING]** `spec/5-system/1-auth.md §5 API 엔드포인트` — `POST /api/auth-configs/:id/reveal` 행 미추가
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표 (현재 `/api/audit-logs` 행에서 끝남)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3 "spec 보완 (project-planner 영역)"` 첫 번째 항목 — "`spec/5-system/1-auth.md §5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 행 추가 (현재 §3.2 권한 매트릭스·Rationale 에만 언급)"
  - 상세: reveal 엔드포인트는 §3.2 권한 매트릭스와 Rationale "Auth Config Reveal 권한 분리 근거" 에 명시되어 있으나 §5 엔드포인트 표에 행이 없다. plan §3 은 project-planner 위임 항목으로 아직 미착수이며, 체크박스 미완. §1 (CRUD audit 기록 구현) 은 완료됐으나 §2~4 는 미착수 상태로 plan 이 `in-progress/` 를 유지 중이다.
  - 제안: project-planner 가 `spec/5-system/1-auth.md §5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 행을 추가하고, `auth-config-webhook-followups.md §3` 첫 번째 항목을 체크 완료 처리한다.

- **[WARNING]** `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` — `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 미열거
  - target 위치: `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP (refactor 04 C-1·M-4·M-7)"` 대상 목록
  - 관련 plan: `plan/in-progress/spec-fix-prod-guards-prose.md §SPEC-DRIFT` — `assertProductionConfig` 는 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` production throw 도 응집하나 `1-auth.md §Rationale` 대상 목록에는 3가지(`JWT_SECRET`/`ENCRYPTION_KEY`/`MCP_ALLOW_INSECURE_URL`)만 열거됨. 코드는 올바르고 spec 보강이 필요한 SPEC-DRIFT.
  - 상세: `prod-fail-closed-guards` 구현 PR 은 MERGED 됐으나 spec prose 보강(`OAUTH_STUB_MODE`·`LLM_STUB_MODE` 불릿 추가)은 `spec-fix-prod-guards-prose.md` 가 별도로 추적하며 아직 미적용 상태다. plan 의 `worktree: prod-fail-closed-guards` 필드가 가리키는 branch 는 MERGED 되어 stale 이지만 plan 자체는 `in-progress/` 에 있고 spec 변경이 미완이므로 활성 추적 항목이다.
  - 제안: project-planner 가 `spec-fix-prod-guards-prose.md §SPEC-DRIFT` 의 제안대로 `1-auth.md §Rationale "Production fail-closed 가드"` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 불릿을 추가한다. 적용 후 plan 의 SPEC-DRIFT 항목을 체크 완료 처리.

- **[INFO]** `security-backlog-invitation-token-hash.md` — 초대 토큰 해시 저장 전환 검토 (저우선순위 미착수)
  - target 위치: `spec/5-system/1-auth.md §1.5.D Rationale` — raw 저장 유지 근거 기술
  - 관련 plan: `plan/in-progress/security-backlog-invitation-token-hash.md` (`priority: low`, `worktree: (main — 아직 착수 없음)`)
  - 상세: 현재 target 문서 §1.5.D 는 raw 저장을 유지하는 결정(이메일 일치 강제·단일 사용·7일 만료로 위협 완화)을 명시적으로 기술하고 있다. plan 은 이를 미래에 재검토하는 별도 작업이며, "착수 시 project-planner 에게 spec 결정 위임 먼저" 로 명시되어 일방적 결정 우회가 아니다. 충돌 없음 — 단순 추적 메모.
  - 제안: 조치 불요. 착수 시 §1.5.D 변경을 plan 의 지시대로 project-planner 협의 경유해 진행.

---

### Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `audit-coverage-naming` (branch `claude/auth-config-audit`) — Step 2 PR MERGED. `auth-config-webhook-followups.md §1` (AuthConfig CRUD audit 기록) 구현을 완료한 worktree. 현재 `.claude/worktrees/audit-coverage-naming` 디렉터리는 물리적으로 존재하지 않으므로 cleanup 불요.
- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 2 PR MERGED. `prod-fail-closed-guards.md` 구현(C-1·M-4·M-7)을 완료한 worktree. `spec-fix-prod-guards-prose.md` 의 `worktree:` 필드도 동일 branch 를 가리키나 spec 보강 미완 — plan 은 활성 추적이나 해당 worktree branch 는 stale. 현재 `.claude/worktrees/` 에 `prod-fail-closed-guards` 디렉터리가 활성 체크아웃으로 남아 있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

### 요약

`spec/5-system/1-auth.md` 는 active worktree 와의 직접 파일 충돌이 없고, 미해결 결정과의 일방적 우회도 없다. 다만 두 가지 미적용 spec 보강이 plan 에서 계속 추적 중이다: (1) `auth-config-webhook-followups.md §3` 의 reveal 엔드포인트 §5 표 미추가, (2) `spec-fix-prod-guards-prose.md §SPEC-DRIFT` 의 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` Rationale 미열거. 두 항목 모두 코드는 올바르고 spec 문서만 미흡한 상태이며 보안이나 기능 일관성에 직접적 위협은 없다. worktree 충돌 후보 2건은 stale 판정(MERGED PR)으로 skip 됐다.

### 위험도

LOW

STATUS: OK
