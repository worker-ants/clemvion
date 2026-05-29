# Plan 정합성 검토 — spec-frontmatter-status-migration (2026-05-29 21:22:42)

> 검토 대상 변경 세트 (worktree `spec-frontmatter-status-migration-027c17` vs `origin/main`):
> - 신규 in-progress plan: `plan/in-progress/execution-engine-residual-gaps.md`
> - 신규 in-progress plan: `plan/in-progress/spec-frontmatter-status-migration.md`
> - 수정 spec: `spec/5-system/4-execution-engine.md` (frontmatter + 본문 2곳)

---

## 발견사항

### [WARNING] spec-update-workflow-resumable-phase3-followup.md 변경 7 체크박스 미갱신

- **target 위치**: `plan/in-progress/spec-frontmatter-status-migration.md` B0 섹션 (본 PR 실행분 완료 표기)
- **관련 plan**: `plan/in-progress/spec-update-workflow-resumable-phase3-followup.md` 25번 줄 `- [ ] **변경 7 (잔여 — project-planner)**`
- **상세**: `spec-update-workflow-resumable-phase3-followup.md` 는 변경 1~6을 [x]로 완료하고 변경 7(`4-execution-engine.md` frontmatter `status: spec-only → partial + code: + pending_plans:`)만 [ ]로 남겨둔 상태. 본 worktree가 정확히 변경 7을 구현했지만, 해당 plan의 변경 7 체크박스가 [ ]그대로이고 해당 plan이 `plan/complete/`로 이동되지 않았다. plan-lifecycle 규약상 모든 항목 완료 시 `git mv`로 `plan/complete/`로 이동해야 한다.
- **제안**: 본 PR에서 `spec-update-workflow-resumable-phase3-followup.md` 의 변경 7을 [x]로 갱신하고, 모든 항목이 완료되었으므로 `git mv plan/in-progress/spec-update-workflow-resumable-phase3-followup.md plan/complete/`를 포함할 것.

---

### [WARNING] 0-unimplemented-overview.md §11 Graceful Shutdown "완료" 표기와 G1/G2 미구현 모순

- **target 위치**: `plan/in-progress/execution-engine-residual-gaps.md` §G1 / §G2 (WS `execution.start` gate + errorPolicy continue on SIGTERM)
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md` 81번 줄: `| **Spec 5-system/4-execution-engine §7.5 / §11 Durable Continuation & Graceful Shutdown** | Phase 0~3 + 변경 2.3 완료 2026-05-29 ...`
- **상세**: `0-unimplemented-overview.md`는 §11 Graceful Shutdown을 "완료"로 표기하고 있다. 그러나 `execution-engine-residual-gaps.md`는 §11 항목 1(WS `execution.start` gate)과 §11 항목 4(errorPolicy `continue` on SIGTERM, G2)가 명시적으로 미구현임을 선언한다. spec `4-execution-engine.md §11`의 Phase 1 구현 노트도 이 두 항목이 "후속 예정"임을 명시하고 있다. 0-unimplemented-overview.md의 "완료" 표기는 G1/G2 미구현 사실과 충돌.
- **제안**: `plan/in-progress/0-unimplemented-overview.md` 81번 줄의 §11 표기를 "Phase 0~3+변경 2.3 §7.5·§9.2·§9.3 완료. §11 G1(WS execution.start gate)/G2(errorPolicy continue SIGTERM)/G3(seq TTL)는 `execution-engine-residual-gaps.md` 추적"으로 갱신. 본 PR 또는 별도 PR에서 처리.

---

### [WARNING] execution-engine-residual-gaps.md G2 전제조건 — parallel-p2.md errorPolicy 미구현 의존성 미명시

- **target 위치**: `plan/in-progress/execution-engine-residual-gaps.md` §G2 (`errorPolicy='continue'` 분기 on SIGTERM)
- **관련 plan**: `plan/in-progress/parallel-p2.md` 작업 단위 §1 (`errorPolicy` schema 노출 — 미완료)
- **상세**: G2는 `errorPolicy='continue'` 인 노드의 SIGTERM 시 다음 노드 enqueue 처리를 다룬다. 그런데 `errorPolicy` 필드 자체가 `parallel-p2.md` §1에 의해 아직 schema에 미노출된 상태(사용자가 `continue`를 설정할 수단 없음). G2 구현 착수 전에 parallel-p2.md errorPolicy schema 노출이 선행되어야 한다. `execution-engine-residual-gaps.md`에 이 의존성이 명시되지 않았다.
- **제안**: `plan/in-progress/execution-engine-residual-gaps.md` §G2 항목에 "전제: `parallel-p2.md §1` errorPolicy schema 노출 완료 후 착수" 비고 추가.

---

### [INFO] retry-handler-followup.md WARNING #1/4/5 — 4-execution-engine.md 후속 수정 예고

- **target 위치**: `spec/5-system/4-execution-engine.md` (본 PR 변경 없음, 후속 영향)
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #1(`_retryState` 소비 원자성), #4(`_retryState` 단일 소비 마킹), #5(`_retryState.expiresAt` TTL SoT) — 모두 project-planner가 `spec/5-system/4-execution-engine.md`에 내용 추가 필요
- **상세**: 본 PR은 해당 섹션(§7.5 / §8 / 보존 예외 절)을 건드리지 않으므로 직접 충돌 없음. 그러나 `retry-handler-followup.md`의 WARNING #1/4/5는 4-execution-engine.md를 계속 수정할 예정이며, 본 PR merge 후 해당 plan의 다음 PR이 base를 새로 확인해야 한다. 관계 인지 목적 기록.
- **제안**: 추적 메모. 충돌 없음 — retry-handler-followup.md 착수 시 4-execution-engine.md의 최신 상태 기준으로 진행.

---

### [INFO] multiturn-error-preserve.md / retry-handler-followup.md — worktree 필드가 존재하지 않는 branch를 가리킴

- **target 위치**: 해당 없음 (기존 plan 문제)
- **관련 plan**: `plan/in-progress/multiturn-error-preserve.md` frontmatter `worktree: multiturn-error-preserve`, `plan/in-progress/retry-handler-followup.md` frontmatter `worktree: multiturn-error-preserve`
- **상세**: 두 plan 모두 `worktree: multiturn-error-preserve`를 가리키나 해당 branch가 local/remote에 존재하지 않는다(Step 1, Step 2 cascade 모두 음성, PR도 없음). 물리적 worktree도 없음. plan-lifecycle 규약에서 worktree 필드는 활성 작업 추적용. 이 plan들의 현재 작업이 어느 worktree에서 진행되는지 불명확.
- **제안**: `multiturn-error-preserve.md`와 `retry-handler-followup.md`의 worktree 필드를 실제 작업이 진행될 신규 worktree 슬러그로 갱신하거나, 아직 미착수라면 `(project-planner 픽업 시 지정)` 패턴으로 정정. 본 PR 범위 외 — 별도 처리.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip된 항목:

| worktree | branch | 판정 근거 |
|---|---|---|
| `workflow-resumable-phase3-a4ea4a` | `claude/workflow-resumable-phase3-a4ea4a` | Step 2: PR #355 MERGED — `spec/5-system/4-execution-engine.md` 동시 수정 후보였으나 stale |
| `spec-update-ai-error-output-fields-594d0a` | `claude/spec-update-ai-error-output-fields-594d0a` | Step 2: PR #346 MERGED — `plan/in-progress/multiturn-error-preserve.md` 수정 후보였으나 stale |
| `move-resolved-plans-to-complete-b034cd` | `claude/move-resolved-plans-to-complete-b034cd` | Step 2: PR #349 MERGED |
| `chat-channel-form-native-modal-c021b9` | `claude/chat-channel-form-native-modal-c021b9` | Step 2: PR #351 MERGED |
| `docs-mobile-sidebar-complete-8659c2` | `claude/docs-mobile-sidebar-complete-8659c2` | Step 2: PR #344 MERGED |
| `eia-jti-tracking-7e68c5` | `claude/eia-jti-tracking-7e68c5` | Step 2: PR #347 MERGED |
| `fix-mail-send-status-59d3b3` | `claude/fix-mail-send-status-59d3b3` | Step 2: PR #350 MERGED |
| `llm-model-select-followup-refactor-4a3d96` | `claude/llm-model-select-followup-refactor-4a3d96` | Step 2: PR #345 MERGED |
| `telegram-guide-realign-6ad222` | `claude/telegram-guide-realign-6ad222` | Step 2: PR #353 MERGED |
| `trigger-drawer-829934` | `claude/trigger-drawer-829934` | Step 2: PR #352 MERGED |
| `triggers-auth-column-a80393` | `claude/triggers-auth-column-a80393` | Step 1: ancestor of `origin/main` (STALE) |
| `w4-cidr-ipwhitelist-a829b8` | `claude/w4-cidr-ipwhitelist-a829b8` | Step 2: PR #348 MERGED |
| `webhook-url-env-5de041` | `claude/webhook-url-env-5de041` | Step 2: PR #354 MERGED |
| `harness-spec-impl-coverage-befc2f` | `claude/harness-spec-impl-coverage-befc2f` | Step 2: PR #287 MERGED (plan frontmatter에 claude/ prefix 없이 등재) |

총 14개 stale skip. 해당 worktree들은 활성 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

worktree 충돌 후보 중 ACTIVE로 분석한 항목: 0건 (spec-frontmatter-status-migration-027c17 자신 제외).

---

## 요약

본 변경 세트(`spec-frontmatter-status-migration-027c17`)는 두 신규 plan과 하나의 spec 수정으로 구성된다. active worktree와의 실제 파일 충돌(§5 CRITICAL 기준)은 0건이며, 14개 충돌 후보 worktree가 모두 stale 판정으로 skip되었다. 주요 정합 이슈는 두 가지 WARNING이다: (1) `spec-update-workflow-resumable-phase3-followup.md`의 변경 7이 본 PR로 해소되었음에도 체크박스 미갱신 및 plan complete 이동 누락, (2) `0-unimplemented-overview.md`의 §11 "완료" 표기가 신규 plan이 선언한 G1/G2 미구현 사실과 모순. 두 항목 모두 plan 내 체크박스 갱신 및 인덱스 표기 수정으로 해소 가능하며 spec 본문이나 코드 변경은 불필요하다. G2의 parallel-p2 errorPolicy 선행 의존성 미명시는 추가 WARNING으로 기록. worktree 충돌 후보 14건 중 stale 14건 skip, active 0건 분석.

## 위험도

LOW

STATUS: SUCCESS
