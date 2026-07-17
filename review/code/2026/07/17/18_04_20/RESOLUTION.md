# RESOLUTION — review/code/2026/07/17/18_04_20

main 이 SUMMARY.md 를 실측(구 정규식 재실행 + 실제 git 2.50.1 서브프로세스)으로 직접 검증하고
일부 정정한 뒤 위임한 작업 지시를 그대로 따랐다. 아래 표·서술은 그 정정을 반영한다.

## SUMMARY 자체의 오분류 (main 실측으로 확인)

SUMMARY 의 Critical #2 는 `sh -c`/`bash -c`/`find -exec`/프로세스 치환을 "신·구버전 공통
사각지대(이번 diff 의 신규 회귀 아님)"로 분류했다. main 이 구 정규식
(`(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b`)을 직접 재실행해
`bash -c "cd /tmp && git push"` 는 구 정규식이 `&&` raw substring 앵커로 **이미 차단하고
있었음**을 확인 — 즉 이 특정 케이스는 Critical #1 과 동일한 회귀이지 공유 사각지대가 아니다.
아래 조치 항목 표에서 Critical #2 는 "Critical #1 의 재귀 수정에 흡수"로 표기한다(별도 코드
변경 없음, 코드 변경 자체는 이미 Critical #1 수정이 커버).

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | 코드 | `21c69fa2b` | 인용된 인자 안 명령치환(`$(...)`)·백틱으로 감싼 `git push` 미탐지 — 균형 괄호 스캔 재귀(`_find_command_substitutions`) + `sh`/`bash`/`zsh`/`dash`/`ksh` `-c` 재귀(`_shell_dash_c_argument`) + `eval` 재귀(`_eval_argument`), 재귀 깊이 상한 4 |
| Critical #2 | 코드 | `21c69fa2b` (흡수) | **오분류 정정**: "신·구 공통 사각지대"가 아니라 Critical #1 과 동일 회귀(`bash -c "cd /tmp && git push"` 는 구 정규식이 `&&` 앵커로 이미 차단). Critical #1 의 `-c` 재귀가 그대로 해소. `sh -c "git push"`(구분자 없음)·`eval "git push"` 는 진짜 선재 갭이었으나 같은 재귀로 함께 마감(plan 의 "eval 은 수용" 서술도 정정) |
| Warning #1 | 코드 | `21c69fa2b` | NUL 등 제어문자가 shlex 토큰을 오염(`push\x00`)시켜 exact-string 비교가 깨지던 회귀 — `_has_hostile_control_characters()` 로 `_GIT_PUSH_FALLBACK` fail-closed 폴백 (`\t`/`\n`/`\r` 은 예외, heredoc 등 정상 콘텐츠) |
| Warning #2 | 코드 | `21c69fa2b` | fail-closed 분기가 값 없는 boolean 전역 옵션(`--no-pager` 등)까지 미지 옵션으로 취급해 `git --no-pager log --grep push` 과차단(실측 재현, plan "이론적 사례" 서술 반증) — `_GIT_OPTS_NO_VALUE` 신설(git 2.50.1 실측 13개), skip-and-continue 로 fail-closed 범위를 진짜 미지 옵션으로 좁힘 |
| Warning #3 | 코드+문서 | `21c69fa2b` | `_GIT_OPTS_WITH_VALUE` 독스트링의 "전항목 값 소비" 확언이 `--exec-path`(공백형 값 미소비)·`--super-prefix`(이 빌드 미인식) 실측과 다름 — 독스트링을 실측 기반으로 완화 + 각주. 기능 변경 없음(안전 방향으로 이미 무해) |
| INFO #1 | 문서 | `16bdd1d3d` | `.claude/tests/README.md` "What's covered" 표에 `test_reap_merged_worktrees.py` 행 추가 |
| INFO #2 | 문서 | `16bdd1d3d` | plan 의 "8건" 하드코딩(실측 10건+ 로 어긋남)을 개수 비의존 표현으로 교체 + rot 이력(8→9→10) 본문 기록 |

## TEST 결과

- lint  : 미적용 — 변경 set 이 `.claude/**`/`plan/**` 뿐이라 `run-test.sh lint`(pnpm 기반, `codebase/**` 워크스페이스만 순회)가 구조적으로 이 파일들을 검사하지 않음. 대신 이 diff 의 실제 CI 게이트(`.github/workflows/harness-checks.yml`)가 요구하는 두 명령을 직접 실행:
  - `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **302/302 통과**(직전 세션 268건 + 이번 세션 신규 케이스)
  - `node --test .claude/tests/test_agent_return.mjs` → **11/11 통과**
- unit  : 위와 동일(harness self-test 스위트가 이 변경의 unit 계층). `.claude/hooks/guard_review_before_push.py` 대상 pinning 테스트 44건 전부 `test_push_detection.py` 안에 위치, 개별 실행 결과도 44/44 통과
- build : 해당 없음(Python/Markdown 전용, 빌드 아티팩트 없음). plan 파일 수정 → `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` → **93/93 통과**
- e2e   : 면제 (화이트리스트: `PROJECT.md §e2e 면제 화이트리스트` — "`.claude/**`(skills, hooks, agents 정의)", "`spec/** · plan/** · review/** · CLAUDE.md · AGENTS.md · README.md · PROJECT.md`". 변경 set = `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_detection.py`, `.claude/tests/README.md`, `plan/in-progress/harness-session-anchor-guards.md` — 전항목이 두 화이트리스트 행의 부분집합)

### 비-vacuity 확인 (수정 전 코드에서의 실패)

`test_push_detection.py` 의 신규 테스트를 **먼저 추가**하고 코드 수정 전에 실행 → 18 failures +
23 errors(신규 헬퍼 함수 미존재로 인한 AttributeError) 확인. 특히 차등 테스트
(`LegacyRegressionDifferentialTest`)가 예외 목록 밖에서 정확히 **6건**의 회귀를 잡아냈다:

```
'git commit -m "$(git push)"'
'git commit -m "`git push`"'
'git commit -am "deploy: $(git push origin main)"'
'git commit -m "$(echo $(git push))"'
'bash -c "cd /tmp && git push"'
'git push\x00 extra'
```

코드 수정 후 전부 통과로 전환 확인 후 커밋.

### 검증 스크립트 (main 이 제시한 표·MUST 목록 직접 재확인)

`main 이 직접 실측한 분류` 표 7행 전부와 "절대 깨지면 안 되는 것" 3건을 수정 후 코드로 직접
호출해 기대값과 일치 확인(전항목 OK) — 응답 본문에 실행 로그 포함.

## 보류·후속 항목

- **Warning #4 (Security, REVIEW/PLAN 게이트 fail-open)**: SUMMARY 자신의 제안 열이 "정책적
  트레이드오프는 팀 판단 필요... 이번 diff 범위 밖으로 낮은 우선순위"라 명시 — main 의 "고칠 것"
  목록에도 없어 이번 세션에서 다루지 않음. 조치 원하면 별도 논의 필요(fail-open 발동 시 텔레메트리
  로깅 추가 등).
- **Warning #5 (Performance, `gh pr view` 순차 N+1 호출)**: SUMMARY 자신이 "후속, 비차단"으로 표기.
  이번 diff 무변경.
- **Warning #6 (Maintainability, reap pass-1 루프 책임 과다)**: SUMMARY 자신이 "급하지 않음"으로
  표기. 이번 diff 무변경.
- **Warning #7 (Concurrency, 공유 `node_modules` npm install 경쟁)**: SUMMARY 자신이 "이번 PR
  스코프 밖(scope 오염 방지 차원)"으로 명시. 이번 diff 무변경.
- **INFO #3~#22 (SUMMARY.md 참고)**: 대부분 리뷰어 자신이 이미 "조치 불요"/"선택, 우선순위 낮음"/
  "비차단"으로 표기한 항목(예: git alias 미탐지 — 정적 토큰 가드 구조적 한계로 이미 plan "잔여
  한계" 절에 반영, `review_guard.py` 의 동일 계열 결함 가능성 — 별도 추적 확인 권장, docstring
  누적 패턴 등). 개별 조치 없이 SUMMARY.md 자체를 기록으로 유지.
- **정적 토큰 기반 가드의 구조적 한계 (plan "잔여 한계" 절 참고, 이번 세션에 일반화 서술로 갱신)**:
  `find … -exec git push \;`, 프로세스 치환(`diff <(git push) x`), git alias(`git config alias.p
  push` 후 `git p`), `_SHELL_INTERPRETERS` 밖 임의 인터프리터 — 전부 구 정규식도 못 잡던 선재 갭이며
  의도적으로 미수정. 단따옴표 안 `$(...)` 과차단(신규 트레이드오프, 안전 방향)도 함께 명시.

## 커밋

- `21c69fa2b` — `fix(harness): push 가드 간접실행(명령치환·-c·eval) 회귀 + 제어문자·불리언옵션 오탐 (SUMMARY#C1 SUMMARY#C2 SUMMARY#W1 SUMMARY#W2 SUMMARY#W3)`
- `16bdd1d3d` — `docs(plan): push 가드 잔여한계 정정 + README 커버리지 표·테스트 건수 비의존화 (SUMMARY#C1 SUMMARY#W2 SUMMARY#I1 SUMMARY#I2)`
