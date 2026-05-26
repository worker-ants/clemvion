# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-update-user-guide-mobile.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-26

---

## 발견사항

### [INFO] plan 체크리스트 항목 3번이 이미 실행되어 sync 불일치

- target 위치: `plan/in-progress/spec-update-user-guide-mobile.md` 체크리스트 3번 — `[ ] frontmatter \`pending_plans\` 등록 → 머지 시 제거`
- 관련 plan: `plan/in-progress/docs-mobile-sidebar.md` — commit `65e0bf47` C-1 항목
- 상세: `spec/2-navigation/13-user-guide.md` frontmatter 에 `pending_plans: [plan/in-progress/spec-update-user-guide-mobile.md]` 추가 작업이 ai-review 후속 처리 커밋(65e0bf47) 에서 이미 완료되었다. target plan 의 3번 체크리스트 항목은 `[ ]` (미완) 로 남아 있어 실제 상태와 불일치한다. 단, 이 작업을 developer skill 범위 안에서 실행한 것은 target plan 의 본래 의도(project-planner 가 spec 본문 수정) 와 다소 어긋나지만, frontmatter 에만 한정된 가벼운 메타데이터 변경이라 실질적 BLOCK 사유는 없다.
- 제안: target plan 의 3번 체크리스트를 `[x]` 로 표시하고 "(65e0bf47 에서 developer 가 선처리)" 주석 추가. spec 본문 정정(§10 표 + Rationale) 은 아직 미완이므로 1·2번 항목을 우선 처리해야 한다.

---

### [INFO] spec-harness-impl-coverage 의 13-user-guide.md 수정 계획과 target plan 간 영역 중복 — 단, stale 처리 완료

- target 위치: `plan/in-progress/spec-update-user-guide-mobile.md` — `spec/2-navigation/13-user-guide.md` 수정 전반
- 관련 plan: `plan/in-progress/spec-harness-impl-coverage.md` (worktree: `harness-spec-impl-coverage-befc2f`) — 검증 단계 2번에서 `spec/2-navigation/13-user-guide.md` 갱신(§공용 MDX 컴포넌트에 `<ImplAnchor>` 추가) 명시
- 상세: `spec-harness-impl-coverage` 가 계획했던 `spec/2-navigation/13-user-guide.md` 의 `<ImplAnchor>` 항목 추가는 이미 main 에 반영되어 있다(PR #334 `worktree-user-guide-writer-harness-guardrails` MERGED, `spec/2-navigation/13-user-guide.md §8` 에 `ImplAnchor` 카탈로그 현존 확인). `harness-spec-impl-coverage-befc2f` worktree 는 물리적으로 존재하지 않으며 해당 branch 의 GitHub PR 검색 결과도 empty — 작업은 다른 경로(#334)를 통해 main 에 반영됨. target plan 이 수정 예정인 §10 과 Rationale 절은 spec-harness 가 이미 완료한 §8 영역과 다른 절이므로 실제 충돌 없음.
- 제안: `plan/in-progress/spec-harness-impl-coverage.md` 는 이미 main 에 효과가 반영된 상태이므로 `plan/complete/` 로 `git mv` 하여 정리하는 것을 권장.

---

### [WARNING] target plan 완료 후 spec frontmatter \`status:\` 승격 미명시

- target 위치: `plan/in-progress/spec-update-user-guide-mobile.md` 체크리스트 — spec 머지 이후 절차 없음
- 관련 plan: `plan/in-progress/spec-harness-impl-coverage.md` 결정 A — `status: partial` 은 `pending_plans:` 의무화, pending_plans 가 모두 `complete/` 로 이동하면 `implemented` 로 승격 의무 (`spec-impl-evidence.md` 가드: `spec-status-lifecycle.test.ts`)
- 상세: `spec/2-navigation/13-user-guide.md` 의 현재 `status: spec-only`, `pending_plans: [spec-update-user-guide-mobile.md]` 이다. target plan 이 머지되면 `pending_plans:` 가 비워지고 동시에 `status:` 도 갱신해야 하는 조건이 생긴다. 현재 target plan 의 체크리스트에는 "머지 시 frontmatter `pending_plans` 제거 + `code:` 갱신 검토" 문구가 있지만 `status:` 승격(`spec-only` → `partial` 또는 `implemented`) 결정이 명시되지 않았다. 결정 A 가드(`spec-status-lifecycle.test.ts`) 가 활성화되면 이 미결 사항이 빌드 경고를 유발할 수 있다.
- 제안: target plan 완료 체크리스트에 "spec frontmatter `status:` 를 `partial`(모바일 진입 구현됨, 기타 미구현 surface 없으면 `implemented`) 으로 갱신" 항목 추가. 현재 `status: spec-only` 는 구현이 없는 상태를 뜻하므로 docs-mobile-sidebar PR 머지 직후 최소 `partial` 로 전환이 맞다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석 대상: 4개 활성 worktree 전수 검토.

`spec/2-navigation/13-user-guide.md` 를 수정하는 다른 worktree 를 탐색한 결과:

- `fix-telegram-webhook-url-8c1f22` (branch `claude/fix-telegram-webhook-url-8c1f22`) — Step 1: ACTIVE (ancestor 아님), Step 2: PR MERGED — **stale skip**. 해당 worktree 가 `spec/2-navigation/13-user-guide.md` 를 수정하지 않음(no diff) 으로 추가 확인.
- `user-guide-internal-refs-cleanup` (branch `worktree-user-guide-internal-refs-cleanup`) — Step 1: ACTIVE (ancestor 아님), Step 2: PR MERGED — **stale skip**. 해당 worktree 의 diff 확인 결과 `spec/2-navigation/13-user-guide.md` 미수정.
- `llm-model-select-4857c3` (branch `claude/llm-model-select-4857c3`) — Step 1: ACTIVE, Step 2: PR 없음(empty) — **active 로 처리**. 단, diff 확인 결과 `spec/2-navigation/13-user-guide.md` 미수정 (`spec/2-navigation/5-knowledge-base.md`, `spec/2-navigation/6-config.md`, `spec/5-system/8-embedding-pipeline.md` 만 수정). 실제 worktree 충돌 없음.

stale 판정 cascade Step 1/2 결과 요약:
- worktree 충돌 후보 3건 중 stale 2건 skip, active 1건 분석 (active 1건은 target spec 파일 미수정으로 충돌 없음).
- `fix-telegram-webhook-url-8c1f22` 와 `user-guide-internal-refs-cleanup` 은 PR MERGED 확인. 해당 worktree 가 물리적으로 남아있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan `spec-update-user-guide-mobile.md` 는 plan 정합성 관점에서 **BLOCK 사유 없음**. 미해결 결정 우회 없음, active worktree 와의 실질적 파일 충돌 없음, 선행 plan 미해소 없음. 발견된 항목은 INFO 2건 + WARNING 1건으로, 체크리스트 sync 불일치(INFO), 이미 stale 된 spec-harness worktree 의 잔류 plan 파일(INFO), spec frontmatter `status:` 승격 절차 미명시(WARNING) 이다. WARNING 의 `status:` 승격 항목은 결정 A 가드(`spec-status-lifecycle.test.ts`) 가 활성화된 이후 빌드 레벨 문제가 될 수 있으므로 target plan 완료 전에 체크리스트에 추가하는 것을 권장한다. worktree 충돌 후보 3건 중 stale 2건 skip, active 1건 분석 (target 파일 미수정으로 충돌 없음).

---

## 위험도

LOW

STATUS: SUCCESS
