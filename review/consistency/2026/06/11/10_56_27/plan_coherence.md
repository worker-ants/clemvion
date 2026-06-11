## 발견사항

### [CRITICAL] spec/5-system/1-auth.md §4.1 동시 편집 — audit-coverage-naming vs unified-model-mgmt-5af7ee
- **target 위치**: `spec/5-system/1-auth.md §4.1 기록 대상 액션` — §339 이하 전체 표 재구성 (구현됨/Planned 분리, 13행 추가)
- **관련 plan**: `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`, active — Step 1 ancestor 검사 ACTIVE, Step 2 PR 없음)
- **상세**: `claude/unified-model-mgmt-5af7ee` 브랜치가 동일 §4.1 표의 "설정" 행을 `llm_config.*/rerank_config.*` → `model_config.*` 로 교체하고, `spec/data-flow/1-audit.md` §1.1 표에서도 같은 용어를 수정한다. `audit-coverage-naming` 브랜치는 같은 §4.1 을 구현됨/Planned 로 재구성하면서 Planned 표 "설정" 행에 `llm_config.*/rerank_config.*` 를 여전히 기재한다(원본 기준). 두 브랜치를 동시에 머지하면 `spec/5-system/1-auth.md` §4.1 과 `spec/data-flow/1-audit.md` §60 부근에서 머지 충돌이 발생한다. `unified-model-mgmt-5af7ee` 는 원본 main 을 베이스로 하므로 audit-coverage-naming 의 신규 구현됨/Planned 구조를 모른다.
- **제안**: `audit-coverage-naming` 를 먼저 머지하고, `unified-model-mgmt-5af7ee` 브랜치를 새 main 으로 rebase 한 후 §4.1 Planned 표의 `llm_config.*`/`rerank_config.*` → `model_config.*` 전환을 rebase 위에서 적용하거나, 반대 순서를 선택할 경우 audit-coverage-naming 이 Planned 표 "설정" 행을 `model_config.*` 로 맞춰 작성해야 한다. 두 브랜치 담당자 간 직렬화 순서 합의 필요.

---

### [CRITICAL] spec/data-flow/1-audit.md §60 동시 편집 — audit-coverage-naming vs unified-model-mgmt-5af7ee
- **target 위치**: `spec/data-flow/1-audit.md` §1.1 커버리지 갭 문단 (line ~60)
- **관련 plan**: `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`, active)
- **상세**: `unified-model-mgmt-5af7ee` 는 §60 의 "`llm_config.*` / `rerank_config.*`" 열거를 "`model_config.*`(create/update/delete/set-default — 구 `llm_config.*`/`rerank_config.*` 통합)" 으로 대체한다. `audit-coverage-naming` 은 같은 문단을 "표기 비일관 존재 → 표기 규약 dot-prefix 기준 통일" + AuditAction union 신설로 전면 재작성한다. 두 변경은 같은 라인 범위에서 충돌한다.
- **제안**: 위 §4.1 충돌과 동일한 직렬화 결정을 따른다. 나중에 머지되는 브랜치가 앞서 머지된 변경 위에서 rebase 후 갱신.

---

### [WARNING] auth-config-webhook-followups.md §1 — AuditAction 타입 강제 후 후속 작업 시그니처 변경 필요
- **target 위치**: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 신설 — `AUDIT_ACTIONS` union 에 `AUTH_CONFIG_REVEAL` 포함, `AuditLogsService.record({ action: AuditAction })` 타입 강제
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md §1` (worktree unstarted) — `AuthConfigsService.create/update/remove/regenerate` 에 `AuditLogsService.record` 추가 예정
- **상세**: target 이 `record({ action })` 을 `AuditAction` union 타입으로 강제했으므로, auth-config-webhook-followups §1 을 구현할 때 인라인 문자열(`'auth_config.create'` 등)은 컴파일 오류가 난다. 해당 action 상수를 `AUDIT_ACTIONS` 에 먼저 추가한 뒤 사용해야 한다. plan 본문에는 이 새 제약이 언급되지 않았다.
- **제안**: `plan/in-progress/auth-config-webhook-followups.md §1` 에 "구현 시 `AUDIT_ACTIONS` 에 `AUTH_CONFIG_CREATE`/`AUTH_CONFIG_UPDATE`/`AUTH_CONFIG_DELETE`/`AUTH_CONFIG_REGENERATE` 상수를 추가한 뒤 사용 — `AuditAction` union 강제(G-01)" 선결 조건 한 줄 추가.

---

### [WARNING] spec-code-cross-audit-2026-06-10.md SUMMARY §2 "전 도메인 audit 기록 확대 별도 plan 이월" — 후속 plan 미생성
- **target 위치**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — G-01·G-02 완료 기록에 "전 도메인 audit 기록 확대는 별도 기능 plan 으로 이월(Planned)" 명기
- **관련 plan**: 현재 `plan/in-progress/` 에 전 도메인 audit 기록 확대(workflow.*/trigger.*/member.*/schedule.* 등)를 추적하는 별도 plan 없음
- **상세**: target 이 Planned 표에 미구현 action 커버리지 목표를 명시했으나, 이를 추적할 후속 plan 이 생성되지 않았다. auth-config-webhook-followups.md §1 이 auth_config CRUD 감사를 부분 커버하지만 그 plan 은 backlog 상태이며 workflow/trigger/schedule 도메인은 어디에도 추적되지 않는다.
- **제안**: target 머지 전 또는 직후에 "audit-coverage-planned-actions.md" 또는 동등한 in-progress plan 을 생성해 Planned 표 항목들의 구현 우선순위·담당·선결 조건을 기록. 또는 기존 plan(auth-config-webhook-followups.md) 의 scope 를 명시적으로 확장.

---

### [INFO] spec/5-system/1-auth.md §2.1 동시 편집 — prod-fail-closed-guards (독립 영역, 충돌 없음)
- **target 위치**: `spec/5-system/1-auth.md` — target 은 §4.1 표만 수정
- **관련 plan**: `plan/in-progress/refactor/04-security.md` (worktree `prod-fail-closed-guards`, active — Step 1 ACTIVE, Step 2 PR 없음) — §2.1 JWT token 표 아래 Production fail-closed 가드 callout 추가 + §Rationale 신규 섹션
- **상세**: 두 브랜치가 모두 `spec/5-system/1-auth.md` 를 수정하지만 수정 위치가 다르다 — `prod-fail-closed-guards` 는 §244/§550 (JWT 표 아래 callout + Rationale 신규), `audit-coverage-naming` 은 §339~§360 (§4.1 감사 로그 표). 라인이 겹치지 않아 자동 머지 가능성 높음. 그러나 `prod-fail-closed-guards` 가 먼저 머지되면 라인 번호가 밀려 rebase 필요.
- **제안**: 충돌 위험은 낮으나 두 브랜치 머지 순서 조율 권장. 먼저 머지하는 쪽이 rebase 부담 없음.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검사 대상:
- `ai-node-override-fields` (branch `claude/ai-node-override-fields`)
- `auth-refresh-rotation-atomic` (branch `claude/auth-refresh-rotation-atomic`)
- `exec-history-structure-ff390e` (branch `claude/exec-history-structure-ff390e`)
- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`)
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`)

stale 으로 skip 된 worktree: **0건**

모든 후보 worktree 에 대해:
- `claude/ai-node-override-fields`: Step 1 — ACTIVE (not ancestor of main). Step 2 — PR 없음. → active (분석 결과: audit 관련 파일 미접촉, 충돌 없음)
- `claude/auth-refresh-rotation-atomic`: Step 1 — ACTIVE. Step 2 — PR 없음. → active (audit 관련 파일 미접촉, 충돌 없음)
- `claude/exec-history-structure-ff390e`: Step 1 — ACTIVE (main 과 동일 HEAD 230a0fba이나 ancestor 아님). Step 2 — PR 없음. → active (audit 관련 파일 미접촉, 충돌 없음)
- `claude/prod-fail-closed-guards`: Step 1 — ACTIVE. Step 2 — PR 없음. → active (INFO 수준, 별개 섹션 편집)
- `claude/unified-model-mgmt-5af7ee`: Step 1 — ACTIVE. Step 2 — PR 없음. → active (**CRITICAL 수준 충돌**)

---

## 요약

`audit-coverage-naming` 브랜치(G-01/G-02 — `re_run_initiated`→`execution.re_run` 개명 + `AUDIT_ACTIONS` union 상수 강제)는 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 SUMMARY §2 결정(사용자 승인)을 충실히 이행한다. 미해결 결정과의 충돌은 없다. 단, `spec/5-system/1-auth.md §4.1` 과 `spec/data-flow/1-audit.md §60` 을 동시에 수정 중인 active worktree `unified-model-mgmt-5af7ee` 와 실제 머지 충돌이 발생할 수 있다 — 두 브랜치의 직렬화 순서 합의 또는 나중 브랜치의 rebase 가 선행돼야 한다(CRITICAL 2건). `auth-config-webhook-followups.md §1` 후속 구현에 `AuditAction` 타입 제약이 추가됐으나 plan 에 미반영(WARNING). worktree 충돌 후보 5건 중 stale 0건, active 5건 분석(CRITICAL 1 worktree, INFO 1 worktree, 나머지 3건 충돌 없음).

---

## 위험도

**HIGH**

(active worktree 동시 spec 파일 편집 충돌 — 머지 순서 직렬화 없이 두 브랜치 병합 시 `spec/5-system/1-auth.md` §4.1 + `spec/data-flow/1-audit.md` 충돌 발생)
