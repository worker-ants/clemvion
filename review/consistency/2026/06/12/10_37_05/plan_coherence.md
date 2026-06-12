# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-fix-error-code-routing.md`
검토 모드: `--spec`
검토 일시: 2026-06-12

---

## 발견사항

### [WARNING] `spec-update-pr4b-embedding-retire.md` 의 draft §2 After 표가 target 결정과 불일치

- **target 위치**: `plan/in-progress/spec-fix-error-code-routing.md §근거 / §1`
- **관련 plan**: `plan/in-progress/spec-update-pr4b-embedding-retire.md` §2 After 표 (line 60)
- **상세**:
  `spec-update-pr4b-embedding-retire.md` 의 §2 "After" draft 표 line 60 은 `MODEL_CONFIG_DEFAULT_MISSING` 의 발행 경로를 `resolveConfig / resolveEmbedding ws default 경로` 로 기술한다. target plan `spec-fix-error-code-routing.md` 는 사용자 결정(2026-06-12) 에 근거해 `resolveEmbedding` ws-default 부재 시 `MODEL_CONFIG_NOT_FOUND`(404) 를 사용하며 `MODEL_CONFIG_DEFAULT_MISSING`(400) 는 `resolveConfig` 전용이라고 명시한다 — 이 두 기술은 직접 상충한다.

  실제로 commit `77f9641f` (PR4b spec 적용) 는 `spec-update-pr4b-embedding-retire.md` 의 draft 표가 아닌 `resolveConfig` 전용 서술로 spec 을 커밋했다 (현 `spec/5-system/3-error-handling.md §1.3` line 51 확인). 즉 `spec-update-pr4b-embedding-retire.md` line 60 의 `resolveConfig / resolveEmbedding` 표기는 **실제 커밋에서 사용되지 않은 superseded draft** 임에도 plan 이 `in-progress` 상태로 남아있어 혼란을 유발한다.

  두 plan 은 동일 worktree(`pr4b-kb-embedding-retire`) 에 속해 병렬 경합 위험은 없지만, `spec-update-pr4b-embedding-retire.md` 를 읽는 후속 작업자가 해당 line 60 을 그대로 spec 에 적용할 경우 target plan 의 사용자 결정을 무효화할 수 있다.

- **제안**:
  `spec-update-pr4b-embedding-retire.md` §2 After 표 line 60 을 다음 중 하나로 갱신:
  (a) target plan 의 확정 결정을 반영해 `resolveConfig 의 ws default 경로만` 으로 수정 (적용 완료로 대체 표기).
  (b) 해당 행에 "✓ 적용 완료(commit 77f9641f) — resolveEmbedding 분리는 spec-fix-error-code-routing.md 별도 draft" 노트 추가.
  두 plan 이 동일 worktree 에 있으므로 어느 쪽을 먼저 갱신하든 sprint 내 정합이 가능하다.

---

### [INFO] `spec-update-pr4b-embedding-retire.md` §3 (error-codes.md §3) 에 후속 항목 무효화 잠재

- **target 위치**: `plan/in-progress/spec-fix-error-code-routing.md` (target plan 전체)
- **관련 plan**: `plan/in-progress/spec-update-pr4b-embedding-retire.md` §3 (`spec/conventions/error-codes.md §3 historical-artifact`)
- **상세**:
  `spec-update-pr4b-embedding-retire.md` §3 의 "historical-artifact" 표에 `LLM_CONFIG_NOT_FOUND → MODEL_CONFIG_DEFAULT_MISSING(400)` 매핑이 적혀 있다. target plan 의 확정 결정으로 `resolveEmbedding` 는 `MODEL_CONFIG_DEFAULT_MISSING`(400) 가 아닌 `MODEL_CONFIG_NOT_FOUND`(404) 를 유지한다. 이 역사적 rename 표 설명이 "default 미설정 경로 → 신규 코드" 라고만 기술하면 `resolveEmbedding` 경로가 `MODEL_CONFIG_NOT_FOUND`(404) 를 계속 쓰는 이유가 historical-artifact 표에서 불분명해진다. 단, `spec/conventions/error-codes.md` 는 target plan 이 직접 수정하는 파일이 아니므로 충돌 등급은 INFO 로 유지.
- **제안**:
  `spec-update-pr4b-embedding-retire.md` §3 의 `LLM_CONFIG_NOT_FOUND` 행 비고에 "default 미설정 경로(resolveConfig) 전용. resolveEmbedding ws-default 는 MODEL_CONFIG_NOT_FOUND(404) 유지 — spec-fix-error-code-routing.md 사용자 결정 2026-06-12 참조" 를 추가하거나, target plan 적용 후 `spec/conventions/error-codes.md` 를 함께 정합화.

---

## Stale 으로 skip 한 worktree (의무)

아래 plan 들이 `spec/5-system/3-error-handling.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/conventions/error-codes.md` 를 참조하거나 수정 예정이었으나, 해당 worktree branch 의 PR 이 이미 종결됨을 확인하여 §5 worktree 충돌 검토 대상에서 제외하고 INFO 로 기록한다.

| worktree | branch | 판정 |
|---|---|---|
| `spec-exec-intake-queue` | `claude/spec-exec-intake-queue` | Step 2 — PR MERGED |
| `unified-model-mgmt-5af7ee` | `claude/unified-model-mgmt-5af7ee` | Step 2 — PR MERGED |
| `conventions-code-data-9b32d5` | `claude/conventions-code-data-9b32d5` | Step 2 — PR MERGED |
| `prod-fail-closed-guards` | `claude/prod-fail-closed-guards` | Step 2 — PR MERGED |
| `health-probe-status-d9a184` | `claude/health-probe-status-d9a184` | Step 2 — PR MERGED |
| `kb-quality-fba2f2` | `claude/kb-quality-fba2f2` | Step 2 — PR MERGED |
| `rag-rerank-impl` | `claude/rag-rerank-impl` | Step 2 — PR MERGED |
| `rag-quality-proposal-0c618c` | `claude/rag-quality-proposal-0c618c` | Step 2 — PR MERGED |
| `rag-dynamic-cut-12fac1` | `claude/rag-dynamic-cut-12fac1` | Step 2 — PR MERGED |

위 worktree 들은 PR 이 MERGED 되었으나 `plan/in-progress/` 의 plan frontmatter 에 worktree 명이 남아있다. 해당 plan 을 `complete/` 로 이동하거나 worktree cleanup 을 권장한다: `./cleanup-worktree-all.sh --yes --force`

현재 disk 에 존재하는 active worktree 중 target spec 파일을 **실제 커밋으로 수정한** worktree 는 없음 확인:
- `test-code-http-hardening-10aad3`: `3-error-handling.md` 에 자체 커밋 변경 없음 (merge base 가 PR4b 이전 commit 이라 diff 에 나타났으나 해당 worktree 의 HEAD 커밋은 spec 을 건드리지 않음).
- `spec-ragsources-content`, `spec-audit-action-prose`, `audit-sot-hygiene-8fc5f1`: target spec 파일 미수정 확인.

---

## 요약

target plan `spec-fix-error-code-routing.md` 는 사용자 결정(2026-06-12) 에 기반해 `resolveEmbedding` ws-default → `MODEL_CONFIG_NOT_FOUND`(404) / `resolveConfig` ws-default → `MODEL_CONFIG_DEFAULT_MISSING`(400) 분리를 spec 에 명시하는 정합한 변경이다. 미해결 결정 우회 없음. active worktree 와의 직접 충돌 없음.

다만 동일 worktree 내 `spec-update-pr4b-embedding-retire.md` §2 After 표의 stale draft 기술(`resolveConfig / resolveEmbedding ws default 경로`)이 target 결정과 불일치하며, 이 draft 행이 적용되지 않은 채 in-progress 상태로 유지되어 후속 작업자에게 혼란을 줄 수 있다. 해당 draft 를 target 결정에 맞게 정정하거나 superseded 노트를 달아야 한다.

worktree 충돌 후보 9건 중 stale(PR MERGED) 9건 skip, active 0건 분석.

---

## 위험도

LOW
