# Plan 정합성 검토 — `spec/2-navigation/` (impl-prep)

검토 일시: 2026-05-26  
검토 모드: 구현 착수 전 검토 (`--impl-prep`, scope=`spec/2-navigation/`)  
Target: `spec/2-navigation/` 하위 7개 파일 (0-dashboard, 1-workflow-list, 10-auth-flow, 11-error-empty-states, 12-workflow-version-history, 13-user-guide, 14-execution-history)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `EH-DETAIL-10` / `EH-DETAIL-11` 구현이 `replay-rerun.md` PR2 에 선점됨
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.2 요구사항 표 — EH-DETAIL-10 (Re-run 버튼 + 모달), EH-DETAIL-11 (Re-run chain 배지 + 드롭다운)
  - 관련 plan: `plan/in-progress/replay-rerun.md` §3 (백엔드 구현) / §4 (프론트엔드 구현) — 모두 `⏳ (PR2)` 미완료 상태
  - 상세: 두 요구사항은 명세 완료(`🚧 명세 ✅ / 구현 PR2`) 이지만 구현이 `replay-rerun.md` PR2 범위 안에 명시적으로 예약되어 있다. `replay-rerun.md` §4 (프론트엔드) 에는 "실행 상세 페이지 헤더에 `[⟳ Re-run]` 버튼 + 모달", "Chain badge + 'View chain' 드롭다운" 항목이 미완료로 남아 있다. 본 impl-prep 가 `spec/2-navigation/14-execution-history.md` 전체를 구현 대상으로 삼을 경우, EH-DETAIL-10/11 을 병렬로 착수하면 `replay-rerun.md` PR2 와 동일 코드 영역에서 중복 작업이 발생한다. `replay-rerun.md` PR2 는 `POST /api/v1/executions/:executionId/re-run`, DB 마이그레이션 (`re_run_of` FK + `chain_id`), 프론트엔드 모달 등 backend/frontend 전 범위를 포함하므로 충돌 위험이 실질적이다.
  - 제안: 본 impl-prep 범위에서 EH-DETAIL-10/11 을 **명시적으로 제외**하거나, `replay-rerun.md` PR2 담당자와 조율한 후 해당 plan 의 작업 단위 안에서 처리한다. `spec/2-navigation/14-execution-history.md` 의 나머지 요구사항(EH-LIST-01~08, EH-DETAIL-01~09, EH-NAV-01~04)은 모두 `✅` 완료 상태이므로 이미 구현되어 있다.

### 발견사항 2

- **[INFO]** `spec/2-navigation/13-user-guide.md` — `spec-harness-impl-coverage.md` 의 후속 구현 plan 5건 중 일부가 아직 in-progress
  - target 위치: `spec/2-navigation/13-user-guide.md` §8 (`<ImplAnchor>` 컴포넌트 항목)
  - 관련 plan: `plan/in-progress/spec-harness-impl-coverage.md` §후속 구현 plan (build-time 가드 구현, `/spec-coverage` slash command 등)
  - 상세: `<ImplAnchor>` 컴포넌트 항목 자체는 이미 main `spec/2-navigation/13-user-guide.md` 에 반영되어 있다. 그러나 `spec-harness-impl-coverage.md` 가 정의한 후속 plan 5건(frontmatter 롤아웃, spec-status-lifecycle 가드, `impl-anchor-existence.test.ts`, plan-stale-audit, /spec-coverage) 중 일부가 아직 `plan/in-progress/` 에 있다. 이 항목들은 spec/2-navigation/ 파일의 직접 수정이 아닌 테스트·도구 구현이라 impl-prep 착수를 차단하지는 않는다. 단, user-guide 구현 시 `<ImplAnchor>` 를 실제로 사용해야 한다면 guard 테스트(`impl-anchor-existence.test.ts`)가 아직 없어 증거 검증이 작동하지 않는다.
  - 제안: `spec/2-navigation/13-user-guide.md` 구현 착수 시, `<ImplAnchor>` 사용 의무 여부를 `spec-harness-impl-coverage.md` 결정 B 와 대조 확인. 가드 미구현 사실을 구현 PR 에 명시.

### 발견사항 3

- **[INFO]** `logo-refresh-2026-05-25.md` Phase 3 (`spec/2-navigation/10-auth-flow.md` 수정) — PR 머지 완료, stale
  - target 위치: `spec/2-navigation/10-auth-flow.md` Rationale R-1 (logo 코드 상태 기술)
  - 관련 plan: `plan/in-progress/logo-refresh-2026-05-25.md` Phase 3
  - 상세: `logo-refresh-2026-05-25.md` 의 worktree `update-logo-and-favicon-cb7b91` 는 PR MERGED (Step 2 GitHub state: MERGED). target 에서 본 문서의 R-1 텍스트는 main 현재 상태와 일치한다. 추가 충돌 없음.
  - 제안: `plan/in-progress/logo-refresh-2026-05-25.md` 을 모든 Phase 완료 여부 재확인 후 `plan/complete/` 로 이동할 것을 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보는 아래 4건이었다. 모두 stale 판정으로 §5번 CRITICAL 분석 대상에서 제외.

| worktree | branch | 판정 경로 | 비고 |
|---|---|---|---|
| `docs-mobile-sidebar` | `worktree-docs-mobile-sidebar` | Step 1 ancestor (HEAD 17c3f028 == main) → stale | 내용 확인 불요 |
| `fix-telegram-webhook-url-8c1f22` | `claude/fix-telegram-webhook-url-8c1f22` | Step 1: NOT_STALE (squash merge 해시 변경). Step 2: PR #313 MERGED → stale. 추가 분석: 해당 worktree 의 유일한 local commit `6394694e` 은 `spec/2-navigation/` 를 건드리지 않음 (triggers.service 만 수정). diff 로 보이는 spec/2-navigation 변경분은 main 이 worktree 분기 이후 진행한 다른 PR(#314 이후)의 변화분임 | `./cleanup-worktree-all.sh --yes --force` 권장 |
| `user-guide-internal-refs-cleanup` | `worktree-user-guide-internal-refs-cleanup` | Step 1: NOT_STALE. Step 2: PR #332 MERGED → stale | `./cleanup-worktree-all.sh --yes --force` 권장 |
| `update-logo-and-favicon-cb7b91` | `claude/update-logo-and-favicon-cb7b91` | Step 1: NOT_STALE (squash merge). Step 2: PR MERGED → stale | logo-refresh plan Phase 완료 후 cleanup |

활성 worktree(stale 아님, `spec/2-navigation/` 를 건드리지 않음):
- `user-guide-writer-harness-guardrails` (PR #334 OPEN) — `spec/conventions/i18n-userguide.md`, `PROJECT.md`, `.claude/agents/user-guide-writer.md` 만 수정. `spec/2-navigation/` 와 무관.
- `llm-model-select-4857c3` — 현재 검토 중인 worktree (main HEAD와 동일).

stale worktree 3건이 git worktree 목록에 남아 있다. `./cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장.

---

## 요약

`spec/2-navigation/` 전체를 구현 착수 대상으로 삼을 때의 Plan 정합성은 **LOW** 수준의 위험이다. 7개 target 파일 중 6개(`0-dashboard`, `1-workflow-list`, `10-auth-flow`, `11-error-empty-states`, `12-workflow-version-history`, `13-user-guide`)는 미해결 결정·선행 미해소·active worktree 충돌 없이 구현 착수 가능하다. 유일한 WARNING 은 `14-execution-history.md` 의 EH-DETAIL-10/11(Re-run 버튼·chain 표시)이 `replay-rerun.md` PR2 에 예약된 범위와 중복되는 것으로, 해당 두 요구사항을 본 impl-prep 에서 제외하거나 plan 간 조율하면 충돌이 해소된다. worktree 충돌 후보 4건 중 stale 4건 skip, active 0건 분석.

---

## 위험도

LOW

STATUS: OK
