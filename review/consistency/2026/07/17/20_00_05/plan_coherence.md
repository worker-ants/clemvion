# Plan 정합성 검토 — `plan/in-progress/spec-draft-frontend-layering.md`

## 검토 방법

`plan/in-progress/**` 전 파일(23개, `node-output-redesign/` 하위 서브플랜 포함)을 대상으로:
1. target 의 D1~D4 결정과 다른 plan 의 "결정 필요"/TBD 항목 충돌 여부 (`grep` 으로 `layering`·`eslint`·`src/lib`·`src/types`·`components`·`frontend-layering`·sibling worktree 이름 전수 조회)
2. target 이 가정하는 선행 조건(PR #967/#969 반영, `spec/conventions/spec-impl-evidence.md` §3 규약)의 미해소 여부
3. target 변경(`spec/conventions/frontend-layering.md` 신설, `spec/0-overview.md` §4 등재)이 다른 plan 의 후속 항목을 무효화/신설해야 하는지

를 확인했다. 부가로 target 이 인용하는 선행 산출물(`review/code/2026/07/17/17_29_21/SUMMARY.md`, `review/consistency/2026/07/17/19_44_52/naming_collision.md`)과 실제 워크트리 상태(`git status`, `git worktree list`, `spec/conventions/frontend-layering.md` 실물, `spec/0-overview.md` diff, `codebase/frontend/eslint.config.mjs` 현재 스코프)를 대조해 target 의 진술이 실측과 일치하는지도 확인했다.

## 발견사항

- **[INFO]** 선행 naming_collision CRITICAL(19:44:52 세션)이 target 본문에 처분 기록으로 흡수됨 — 재확인만 필요
  - target 위치: target §"선행 작업과의 관계 (중복 해소 기록)"
  - 관련 plan: 없음(같은 세션의 이전 `review/consistency/2026/07/17/19_44_52/naming_collision.md` CRITICAL — sibling 브랜치 `claude/zen-kapitsa-c5e1de`/워크트리 `nifty-greider-35167d` 가 동일 경로 `spec/conventions/frontend-layering.md` 를 먼저 커밋했던 건)
  - 상세: 실측 확인 결과 target 의 진술은 정확하다 — 워크트리 `nifty-greider-35167d` 와 로컬 브랜치 `claude/zen-kapitsa-c5e1de` 는 여전히 존재(`git worktree list`, `git branch -a` 로 확인)하나 target 이 명시한 "처분"(그쪽 문서를 main `099f63cc` 기준으로 재측정해 채택 + Phase 2 는 재적용)이 실제로 이 워크트리에 반영돼 있다 — `spec/conventions/frontend-layering.md` 가 신규 파일로 존재하고 Rationale 수치가 248/97/64(재측정치, sibling 의 255/106/72 아님)로 정정돼 있으며, `codebase/frontend/eslint.config.mjs` 는 아직 `files: ["src/lib/**"]` 뿐(sibling 이 이미 끝낸 Phase 2 구현을 그대로 가져오지 않고 "재적용" 대상으로 Phase 2 에 남겨둔 것과 일치). 즉 이 항목은 target 이 남긴 미해결이 아니라 **이미 반영된 처분의 기록**이며, plan_coherence 관점에서 다른 in-progress plan 과의 신규 충돌은 없다.
  - 제안: 조치 불필요. 병합 시점에 `nifty-greider-35167d`/`zen-kapitsa-c5e1de` 정리(폐기)는 target 이 이미 "사용자 확인 후 정리"로 스코프 아웃해뒀으므로 그대로 둔다.

- **[INFO]** 다른 in-progress plan 중 target 의 결정 영역(frontend `src/lib`·`src/types`·`components` 의존 방향, `eslint.config.mjs` 레이어 가드)을 다루는 항목 없음
  - target 위치: target 전체 (D1~D4, Phase 1~3)
  - 관련 plan: 없음 — `eia-context-schema-followups.md` 가 `eslint.config.mjs` 를 언급하지만 대상이 `packages/sdk`·`expression-engine` 등 **내부 패키지**(harness/CI 배선)이고 frontend 레이어 경계와는 무관. `node-output-redesign/*.md` 의 frontend 파일 언급(예: `use-execution-events.ts`, `node-config-summary.ts`)도 layering 규약과 직교.
  - 상세: 전 in-progress plan(23개)에 대해 `layering|eslint|src/lib|src/types|frontend-layering|nifty-greider|zen-kapitsa` grep 을 수행한 결과 target 자신을 제외하고 실질적으로 겹치는 항목이 없었다. "미해결 결정과의 충돌"·"후속 항목 누락" 모두 해당 사항 없음.
  - 제안: 조치 불필요.

- **[INFO]** target 이 가정하는 선행 조건은 모두 이미 충족 상태로 실측 확인됨
  - target 위치: target §D4, §Phase 1
  - 관련 plan: 없음(선행 조건은 PR #967/#969 — 이미 main `099f63cc` 에 병합)
  - 상세: `git log` 로 `099f63cc`(#969)·`e370d1d02`(#967) 가 현재 브랜치 base 에 포함됨을 확인. `codebase/frontend/eslint.config.mjs` 에 `COMPONENTS_PATH_RE`/`literalSpecifier`/`backtickSpecifier` 헬퍼가 실재해 target 의 §Phase 2 서술("현재 구조는 ... — PR #969")과 일치. `spec/conventions/spec-impl-evidence.md` §3 이 요구하는 `status: partial` + `pending_plans` 조합도 실제 문서 frontmatter 에 반영돼 있다(자기 자신을 가리키는 `pending_plans: [plan/in-progress/spec-draft-frontend-layering.md]`).
  - 제안: 조치 불필요.

## 요약

`plan/in-progress/spec-draft-frontend-layering.md` 의 D1~D4 결정과 Phase 1~3 실행 계획은 다른 in-progress plan(23개, `node-output-redesign/` 서브플랜 포함) 어느 것과도 미해결 결정 충돌·선행 조건 미해소·후속 항목 누락을 일으키지 않는다. 유일하게 얽혀 있던 선행 이슈(19:44:52 세션의 naming_collision CRITICAL — sibling 브랜치와의 동일 경로 중복)는 target 본문의 "선행 작업과의 관계" 절에서 처분(사용자 결정) 기록으로 이미 흡수됐고, 그 진술은 실제 워크트리 상태(파일 존재, 재측정 수치, Phase 2 미반영 상태)와 정확히 일치함을 확인했다. 새로 발견된 CRITICAL/WARNING 은 없다.

## 위험도
NONE
