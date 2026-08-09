# RESOLUTION — 20_33_02

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1        | 코드(docs) | `5b7ada443` | `_changed-paths.yml`·`test_required_check_skip_jobs.py`·`test_changed_paths_reusable.py`·`README.md` 의 "세/three 워크플로" 잔존 표현을 개수-비종속("전환된 워크플로들이 공유하는")으로 정리. `test_review_gate_ci.py:828` 의 "세 워크플로"는 실측 결과 무관한 다른 셋(PyYAML pin 동기화)이라 미변경. |
| #2        | 코드(테스트) | `5b7ada443` | `DeadFilterTest.test_no_pathspec_is_a_dead_filter` 신설 — `CONVERTED` 8개 전체에 죽은 필터 검출 일반화. `test_harness_checks_paths_coverage.filter_covers_file`/`_tracked_files` 재사용. strict(GitHub paths) vs git pathspec 오탐 가능성은 8개 워크플로 전체 실측으로 닫음 — `codebase/package.json` 1건만 예외 등재(`DEAD_FILTER_EXCEPTIONS`, 근거 명시: 아직 없는 파일을 겨냥한 depth-0 선제 pathspec). |
| #3        | 코드(테스트) | `5b7ada443` | `test_each_workflow_registers_its_own_path` 신설 — 워크플로 자기참조(명시 등재 또는 상위 글롭 커버) 강제. `harness-checks.yml` 은 `.github/workflows/**` 광역 글롭 커버 분기로 처리(단순 assertIn 이면 상시 RED였을 자리). |
| #4        | 코드(plan) | `8ed9a43c2` | `plan/in-progress/ci-required-check-skip-jobs.md` frontmatter `worktree:` 를 이미 삭제된 `ci-required-check-skip-jobs-42f5d8` → 현재 `ci-skip-jobs-remaining-8aa9f8` 로 갱신. 같은 커밋에 INFO#1·INFO#8 후속 항목도 §후속에 등재. |

INFO 8건은 이번 턴 수정 대상이 아니었다. INFO#1·INFO#8 은 위 표 #4 커밋으로
`plan/in-progress/ci-required-check-skip-jobs.md` §후속에 등재했다(아래 보류·후속 항목 참고).

## TEST 결과

- lint  : 통과 (63s)
- unit  : 통과 (77s, tests=14 passed)
- build : 통과 (113s)
- harness unittest 전수(`.claude/tests/**`, 983 tests) : 통과 — `test_required_check_skip_jobs.py` 신설 테스트 2건은 뮤테이션으로 RED 확인 후 원복:
  - `test_no_pathspec_is_a_dead_filter`: `packages-checks.yml` 에 죽은 pathspec 한 줄(`codebase/packages/does-not-exist-mutation-check/**`) 추가 → RED, 원복 확인
  - `test_each_workflow_registers_its_own_path`: (a) `packages-checks.yml` 자기 등재 줄 삭제 → RED, 원복 확인. (b) `harness-checks.yml` 의 `.github/workflows/**` 삭제(자기 개별 등재가 없는 워크플로) → RED, 원복 확인
- e2e   : 통과 (289s, backend jest e2e tests=261 passed, log=`_test_logs/e2e-20260809-210129.log`). **면제 아님** — 브랜치 전체 diff(`git diff --name-only origin/main...HEAD`)에 `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts`·`internal-package-registration.test.ts` (선행 커밋 `0f5ed9acf`) 가 포함돼 PROJECT.md §e2e 면제 화이트리스트의 부분집합이 아니었다. 이번 resolution 세션 자체의 신규 fix commit(`5b7ada443`·`8ed9a43c2`)은 `.claude/**`+`.github/**`+`plan/**` 뿐이라 화이트리스트 부분집합이지만, 지침에 따라 브랜치 전체 diff 기준으로 판정해 e2e 를 재실행했다.

## 보류·후속 항목

- INFO#1 (`permissions:` 미선언 비대칭, 신규 편입 4개 워크플로 + `_changed-paths.yml`): `plan/in-progress/ci-required-check-skip-jobs.md §후속 — ai-review INFO 항목` 에 등재. 이번 PR 이전부터의 상태라 회귀 아님, 이번 스코프 아님.
- INFO#8 (`on.push.paths` 부활 방지 대칭 가드 부재, push 유지 3개 워크플로): 같은 §후속 절에 등재. required check 데드락은 PR 전용이라 심각도 낮음.
- INFO#2·#3·#4(제외)·#5·#6·#7: 조치 불요(이미 유예 결정됨/구조적 제약/우선순위 낮음) — SUMMARY 본문 참고, plan 등재 대상 아님(사용자 지침이 INFO#1·#8 만 등재를 명시).
