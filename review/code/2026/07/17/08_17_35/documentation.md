# 문서화(Documentation) Review 결과

> **payload 노트**: `_prompts/documentation.md` 의 "리뷰 대상 파일" 18개는 전부 (1) `review/consistency/2026/07/17/{01_25_26,07_03_34}/**` 신규 산출물(5개 checker + SUMMARY/meta/retry-state) 과 (2) `spec/2-navigation/{_layout,9-user-profile,10-auth-flow,11-error-empty-states}.md` + `spec/data-flow/12-workspace.md` 5개 spec 문서 diff 뿐이다. 오케스트레이터 지시문이 명시한 `PROJECT.md`·`CHANGELOG.md` 변경은 **payload 에 전혀 포함되지 않았다** (`grep -n "PROJECT.md\|CHANGELOG.md" _prompts/documentation.md` → 0 hit). 실측(`git diff origin/main..HEAD --stat`) 결과 이 두 파일 외에 `.claude/test-stages.sh` 도 이번 PR 이 실제로 수정한 파일인데(이 변경이 PROJECT.md 서술의 근거가 되는 실제 코드) 마찬가지로 payload 에 없다. 아래 분석은 이 gap 을 메우기 위해 worktree 절대경로로 `git diff origin/main..HEAD -- PROJECT.md CHANGELOG.md .claude/test-stages.sh spec/**` 와 관련 코드(`href.ts`·`sidebar.tsx`·`[...rest]/page.tsx`·신규 e2e/unit 테스트)를 직접 Read/검증했다.

## 발견사항

- **[WARNING]** PROJECT.md(및 동일 PR 내 `.claude/test-stages.sh`)가 신설한 문단에서 CI job 이름을 실제와 다르게 표기
  - 위치: `PROJECT.md` "e2e 도 cross-stack 의무" 문단(신규) — "CI(`.github/workflows/e2e.yml`)가 `e2e-backend`·`e2e-frontend` 두 잡으로 양쪽을 반드시 돌리므로…"; 동일 PR 이 수정한 `.claude/test-stages.sh` `cmd_e2e()` 위 주석 — "CI 는 `e2e-backend` 잡이 `make e2e-test`, `e2e-frontend` 잡이 `make e2e-test-full` 로…"
  - 상세: `.github/workflows/e2e.yml` 을 직접 확인하면 job 이름은 `config-guard` / `e2e` / `e2e-frontend` 세 개다 — `e2e-backend` 라는 job 은 **존재하지 않는다**. `git log --follow -p -- .github/workflows/e2e.yml` 로 도입 시점(`c6c2cfdfe`)부터 현재까지 이 job 은 줄곧 `e2e` 로만 명명돼 왔고 리네임 이력도 없다. 즉 이번 diff 가 "오래된 주석이 새 코드와 안 맞는" 케이스가 아니라, **이번 PR 이 신설한 문장 자체가 실제 워크플로 파일과 처음부터 어긋나는** 경우다(같은 오기가 두 파일에 반복돼 "복붙 전파"로 보인다). 워크플로 파일에서 `e2e-backend` 라는 문자열을 검색해도 찾을 수 없어, 이 표현을 신뢰해 job 을 찾으려는 독자를 오도할 수 있다.
  - 제안: 두 파일 모두 `e2e-backend` → `e2e` 로 정정 (`e2e:` job 이 `make e2e-test`, `e2e-frontend:` job 이 `make e2e-test-full` 을 각각 실행하는 실제 구조와 맞춰서).

- **[INFO]** 완료 이동된 plan 문서의 frontmatter 주석에 stale in-progress 경로가 남아 있음 (build 비차단)
  - 위치: `plan/complete/user-guide-routing-loop-fix.md` frontmatter 주석 — "`spec-update-catch-all-terminal-contract.md` 의 spec 문서 보강은 developer 권한 밖이라 durable 분리된 위임 plan 이 책임진다: `plan/in-progress/spec-update-catch-all-terminal-contract.md` (owner: project-planner)"
  - 상세: 같은 PR 안에서 이 두 번째 plan(`spec-update-catch-all-terminal-contract.md`)도 이미 `plan/complete/`로 완료 이동됐다(`git diff origin/main..HEAD --stat -- plan/` 확인 — `plan/complete/spec-update-catch-all-terminal-contract.md` 로 신규 추가, `plan/in-progress/` 경로에는 실존하지 않음). 그런데 첫 번째 plan 파일의 frontmatter 주석은 여전히 `plan/in-progress/…` 경로를 인용한다. 이 필드는 YAML `#` 주석이라 `spec-link-integrity.test.ts`(spec/**.md 본문 + 코드 JSDoc/주석만 스캔, `plan/**.md` 파일 자체는 스캔 대상이 아님 — `spec/conventions/spec-impl-evidence.md:128`)의 build gate 에는 걸리지 않으므로 CI 를 깨지는 않지만, 향후 이 plan 을 참고하는 사람에게 잘못된 경로를 안내한다.
  - 제안: `plan/in-progress/spec-update-catch-all-terminal-contract.md` → `plan/complete/spec-update-catch-all-terminal-contract.md` 로 정정(선택, 비차단).

- **[확인 — 신규 위반 없음]** 오케스트레이터가 지목한 (a)(b) 우려사항은 실측 결과 모두 문제없음
  - 상세 (a): `git diff origin/main..HEAD -- spec/2-navigation/*.md spec/data-flow/12-workspace.md` 전문을 확인한 결과, 이번 PR 이 spec 본문에 추가한 내용은 `code:` frontmatter 경로(신규 2개 코드 파일)와 §2.2 각주·R-3·§1.3 표 행·§3 단서 텍스트뿐이며, **신규 `plan/**` 링크는 전혀 추가하지 않는다.** `grep -n "plan/" spec/2-navigation/*.md spec/data-flow/12-workspace.md` 로 재확인해도 매치는 `9-user-profile.md` 의 기존 `pending_plans: plan/in-progress/spec-sync-user-profile-gaps.md` 한 줄뿐이고, 이는 이번 diff 범위 밖(변경되지 않은 pre-existing 필드)이다. 따라서 #957 이 명확히 한 "spec 본문의 `plan/**` 링크도 spec-link-integrity 대상" 규약과 충돌할 신규 대상 자체가 없다.
  - 상세 (b): `grep -rn "user-guide-routing-loop-fix\|spec-update-catch-all-terminal-contract" spec/` 결과 0 hit — 이번에 완료 이동된 두 plan(`user-guide-routing-loop-fix.md`, `spec-update-catch-all-terminal-contract.md`)을 가리키는 spec→plan 링크는 `spec/` 어디에도 존재하지 않는다. 두 plan 파일 자체가 `git diff origin/main..HEAD --stat -- plan/` 상 `plan/complete/` 에 신규 파일로만 나타나(참고: origin/main 에는 아예 존재하지 않았던 문서라 in-progress→complete 이동에 따른 "기존 참조자의 dangling 링크" 위험 자체가 발생할 수 없음) 링크 무결성 우려가 없다.

- **[정보성 — 정확성 우수]** CHANGELOG·PROJECT.md·spec 서술과 실제 코드/테스트가 정확히 정합
  - "playwright e2e 신규 5건": `codebase/frontend/e2e/workspaces/slug-routing.spec.ts` diff 에서 신규 `test()` 5개(`sidebar user-guide link is bare /docs` 외 4건)를 실측 확인 — 주장과 정확히 일치.
  - "`(main)/w/[slug]/page.tsx` 부재": `find "codebase/frontend/src/app/(main)/w/[slug]" -maxdepth 1 -type f` 결과 `layout.tsx` 만 있고 `page.tsx` 는 실제로 없음 — 주장 사실과 일치.
  - "유닛은 `useParams` 를 mock": `workspace-redirect.test.tsx` 에서 `useParams: () => mockParams` 확인 — 주장과 일치.
  - "`tests=256` 은 jest 형식만 매칭": `run-test.sh` 의 카운트 정규식(`tests:.*pass|passing\b|✓.*passed\b`)을 playwright 요약줄(`51 passed (52s)`)과 jest 요약줄(`Tests: 256 passed`)에 각각 시험한 결과 후자만 매칭 — 주장과 일치.
  - `(main)/[...rest]/page.tsx`·`href.ts`·`sidebar.tsx` 세 코드 파일의 JSDoc(신규/갱신)을 직접 대조한 결과 terminal 분기·`workspaceScoped` 의미·`buildWorkspaceHref` 의 의도적 비-idempotent 설계 등이 실제 구현과 완전히 일치하며, CHANGELOG·spec Rationale(R-3) 문구와도 어긋남이 없다.
  - `run-test.sh e2e` → `make e2e-test-full` (backend supertest + playwright) 로의 전환도 `.claude/test-stages.sh` `cmd_e2e()` 실측과 정확히 일치하며, `Makefile` 의 `e2e-test`/`e2e-test-full` 타겟 동작(backend 실패 시 playwright short-circuit skip)도 PROJECT.md·test-stages.sh 주석의 서술과 부합한다.

## 요약

이번 PR 이 실제로 건드린 문서 파일은 `spec/2-navigation/` 4개·`spec/data-flow/12-workspace.md`·`PROJECT.md`·`CHANGELOG.md`·`.claude/test-stages.sh` 7개인데, 이 documentation reviewer 에게 전달된 payload 에는 뒤 세 파일(`PROJECT.md`·`CHANGELOG.md`·`.claude/test-stages.sh`)이 누락돼 있어 직접 `git diff` 로 보강해 검토했다. spec 5개 문서는 오케스트레이터가 제기한 우려(신규 `plan/**` 링크 도입 여부, 완료 이동된 두 plan 을 가리키는 dangling spec→plan 링크 존재 여부)에 대해 모두 "문제없음"으로 실측 확인됐다 — #957 이 정정한 spec-link-integrity 규약(spec 본문의 plan 링크도 검사 대상)과 충돌할 표면 자체가 없다. `code:` frontmatter 보강·§2.2 각주·R-3 Rationale·§1.3 표 행 등은 실제 코드(JSDoc·테스트)와 정확히 일치해 문서 정확성이 높다. 유일한 실질적 흠은 PROJECT.md(및 같은 PR 이 고친 `.claude/test-stages.sh`)가 새로 쓴 문장에서 CI job 이름을 `e2e-backend` 로 잘못 표기한 것 — 실제로는 `e2e` 라는 job 이며, 두 파일에 반복된 것으로 보아 리뷰 전 정정을 권고한다(WARNING, 병합 차단급은 아님). 그 외 `plan/complete/user-guide-routing-loop-fix.md` 의 stale in-progress 경로 언급은 비차단 INFO.

## 위험도

LOW
