# 변경 범위(Scope) 리뷰

## 검토 방법

prompt 는 두 파일의 전체 스냅샷만 제공하므로, 실제 diff 는 별도로 확보했다: `git merge-base
origin/main HEAD` = `14bc86a53`(PR #965, 본 plan 최초 커밋)를 기준으로 `git diff
origin/main...HEAD`(누적, 42개 파일 +3768/-34)를 받고, 리뷰 대상 2개 파일만 추려
`plan/in-progress/harness-session-anchor-guards.md` §② 의 결함 서술·수정안·"구현 결과"/"review
후속 수정"/"review 후속 수정 2" 절과 라인 단위로 대조했다.

이번 세션은 **직전 리뷰(review/code/2026/07/17/18_04_20, scope 판정 NONE) 이후의 fresh
review**다 — 그 리뷰가 남긴 Critical #1·#2, Warning #1-#3 을 고친 resolution 커밋
(`21c69fa2b`, `16bdd1d3d`, `d989e1f02`)이 이번 프롬프트가 지정한 2개 파일에만 새 diff를
만들었고, 그래서 이번 세션의 리뷰 대상이 정확히 이 2개로 좁혀졌다:

```
git diff f4489d314(직전 리뷰 시점 HEAD) d989e1f02(현재 HEAD) --stat
  → guard_review_before_push.py / test_push_detection.py / tests/README.md /
    plan/in-progress/harness-session-anchor-guards.md / review/code/2026/07/17/18_04_20/** 만 변경
  → reap-merged-worktrees.sh / bootstrap-session.sh / test_reap_merged_worktrees.py /
    worktree-policy.md(①번 결함, session-anchor reap)는 무변경 — 이번 세션이 왜 2개 파일만
    받았는지와 정확히 일치
```

추가로 resolution 커밋(`21c69fa2b`) 자체를 단독 diff로 열어 RESOLUTION.md 의 조치표
(Critical #1/#2→`_find_command_substitutions`/`_shell_dash_c_argument`/`_eval_argument`,
Warning #1→`_has_hostile_control_characters`, Warning #2→`_GIT_OPTS_NO_VALUE`, Warning
#3→`_GIT_OPTS_WITH_VALUE` 독스트링 완화)와 훅 파일 hunk 를 1:1 대조했다. `-w`(whitespace-ignore)
diff 통계 비교, `.claude/settings*.json` 변경 여부, 미사용 임포트/디버그 잔재/반쪽 리네임 그렙,
`.claude/tests/test_push_detection.py` 자체 실행(pytest)도 함께 확인했다.

## 발견사항

특이사항 없음 — CRITICAL/WARNING/INFO 어느 등급도 없음.

두 파일의 누적 diff(`guard_review_before_push.py` +415/-7, `test_push_detection.py` 전량 신규
+621)를 hunk 단위로 확인한 결과, 추가된 모든 상수·함수·테스트 클래스가 plan 문서 또는 직전 두
차례 리뷰(`17_09_10`, `18_04_20`)의 구체적 Critical/Warning 항목 중 정확히 하나에 대응한다.
요청 밖 추가 수정, 무관한 코드 영역 수정, 포맷팅 전용 변경 혼입, 목적 없는 리팩토링, 요청하지
않은 기능 확장, 미사용 임포트, 의도치 않은 설정 변경 중 어느 것도 발견되지 않았다.

## 스코프 매핑 검증

| 변경 | 근거 | 판정 |
| --- | --- | --- |
| `import shlex` 1줄 추가 | `_tokenize()`에서 즉시 사용, 미사용 임포트 없음 | 정합 |
| `_GIT_PUSH` → `_GIT_PUSH_FALLBACK` 리네임 + 역할 재정의(1차 매처→폴백 전용) | shlex 파서가 1차 판정을 맡게 되며 의미가 실제로 바뀌었으므로 이름 변경이 필요(명목상 리팩토링 아님). 저장소 전체에 구 이름 `_GIT_PUSH` 잔존 참조 0건(반쪽 리네임 없음) | 정합 |
| `_GIT_OPTS_WITH_VALUE`/`_SEGMENT_SEPARATOR_CHARS`/`_ENV_ASSIGN`/`_tokenize`/`_git_subcommand`/`_is_segment_boundary` 신설 | plan §② "수정안"(서브커맨드 판정 전환) + "review 후속 수정" Critical #1-#4 표 | 정합 |
| `_GIT_OPTS_NO_VALUE` 신설 + `_git_subcommand` 3줄 삽입 | 18_04_20 리뷰 Warning #2(`--no-pager` 등 boolean 옵션 오탐) — RESOLUTION 조치 commit `21c69fa2b` 와 1:1 | 정합 |
| `_GIT_OPTS_WITH_VALUE` 독스트링 확장(30~60행, `--exec-path`/`--super-prefix` 각주) | 18_04_20 리뷰 Warning #3(전항목 값-소비 확언이 실측과 다름) | 정합. 기능 변경 없이 문서 정정만 |
| `_has_hostile_control_characters`/`_BENIGN_CONTROL_CHARS` 신설 | 18_04_20 리뷰 Warning #1(NUL 바이트가 exact-string 비교를 깨뜨림) | 정합 |
| `_find_command_substitutions`/`_shell_dash_c_argument`/`_eval_argument`/`_segment_runs_push`/`_SHELL_INTERPRETERS`/`_MAX_RECURSION_DEPTH` 신설, `_is_git_push` 재작성(재귀 `_depth` 인자 추가) | 18_04_20 리뷰 Critical #1(명령치환·백틱 미탐지) + Critical #2(오분류 정정, `-c`/`eval` 재귀에 흡수) | 정합 |
| `main()`/`_REVIEW_MSG`/`_PLAN_MSG`/모듈 최상단 docstring | diff 대상 3개 hunk 어디에도 포함 안 됨(hunk 경계: `@@ -28,6 +28,7@@`, `@@ -48,13 +49,147@@`, `@@ -66,10 +201,283@@`, 모두 `_read_payload` 이전에서 종료) | 무변경 확인 |
| `test_push_detection.py` 전체(신규 621줄, 44 test + 71 subtest) | 각 클래스가 위 신설 함수/상수 1개씩과 1:1 대응(`RecursiveIndirectionTest`↔재귀, `CommandSubstitutionExtractionTest`↔`_find_command_substitutions`, `ShellDashCAndEvalArgumentTest`↔`-c`/`eval`, `HostileControlCharacterTest`↔W1, `GitOptsNoValueTest`↔W2, `GitOptsWithValueRegressionTest`↔W3, `ResidualLimitationsTest`↔plan "잔여 한계", `LegacyRegressionDifferentialTest`↔old⊆new 회귀 게이트). `ORDINARY_SHELL_COMMANDS`(ls/npm/docker 등 무관해 보이는 목록)도 차등 테스트의 코퍼스 확장 목적이 파일 자체 docstring에 명시돼 있어 무관한 테스트 혼입이 아님 | 정합, 과잉 케이스 없음 |

## 부가 확인

- **포맷팅 혼입 없음**: `git diff -w`(whitespace-ignore) 통계가 일반 diff 와 완전히 동일(415
  insertions/7 deletions, 동일 hunk) — 공백/줄바꿈만 바뀐 라인이 실질 변경에 섞여 있지 않다.
- **설정 파일 무변경**: `.claude/settings.json`/`settings.local.json` 은 이번 diff에 없음.
- **디버그 잔재 없음**: 두 파일에서 `TODO`/`FIXME`/`pdb.set_trace`/`console.log` 그렙 0건.
- **임포트**: `guard_review_before_push.py` 의 유일한 신규 임포트는 `shlex`(즉시 사용). 테스트
  파일의 `re`/`unittest`/`_harness` 도 전부 사용됨. 미사용 임포트 없음.
- **무관 코드 없음**: `codebase/frontend`·`codebase/backend`·`codebase/packages` 하위 파일은
  이번 브랜치 전체(42개 파일) 중 0개. 이번 두 파일도 `.claude/hooks/`·`.claude/tests/` 밖으로
  나가지 않는다.
- **resolution 자체의 scope 검증**: `21c69fa2b`(이번 프롬프트 대상 2개 파일에만 diff를 남긴
  resolution 커밋)를 단독으로 열어 hunk 별로 확인 — `_GIT_OPTS_NO_VALUE` 삽입은
  `_git_subcommand` 안 3줄 추가가 전부이고 그 외 로직 변경 없음, `_is_git_git_push` 재작성은
  재귀·제어문자 처리 추가가 전부. RESOLUTION.md 조치표(SUMMARY#C1/C2/W1/W2/W3)를 벗어나는
  추가 변경 없음.
- **실행 검증**: `python3 -m pytest .claude/tests/test_push_detection.py -q` → 44 passed, 71
  subtests passed — 코드·테스트가 서로 정합하는 완결 상태(고아 테스트·미정의 헬퍼 참조 없음).
- **참고(비-scope, 기록용)**: 신설 함수 docstring 다수가 이전 리뷰 세션 경로(예: "review/code/
  2026/07/17/18_04_20")와 이전 커밋 SHA(`f4489d314`)를 직접 인용한다 — 이 파일이 4회 연속
  회귀를 겪은 이력에서 비롯된 이 저장소 고유의 방어적 문서화 관행이며, 직전 리뷰(18_04_20)의
  maintainability 리뷰어가 이미 별도 관점(INFO #8·#9, changelog-in-comment 경향)으로 다뤘다.
  내용이 전부 해당 코드의 안전성 근거 설명이라 "불필요한 주석"에 해당하지 않아 scope 관점에서는
  발견사항으로 올리지 않는다.

## 요약

이번 세션은 직전 리뷰(18_04_20, scope=NONE)의 Critical #1·#2·Warning #1-#3 을 고친 resolution
diff에 대한 fresh review다. `guard_review_before_push.py`/`test_push_detection.py` 누적 diff
전체를 hunk 단위로 열어 plan 문서·직전 SUMMARY/RESOLUTION 과 대조한 결과, 신설된 상수·함수·
테스트 클래스 전부가 문서화된 특정 결함 하나씩에 정확히 대응하며, 그 범위를 벗어나는 코드는
없다. `main()`/게이트 메시지/모듈 docstring 등 이번 수정과 무관한 영역은 hunk 경계 밖에서
전혀 건드리지 않았고, 포맷팅 전용 변경·미사용 임포트·설정 변경·디버그 잔재·반쪽 리네임도
없다. resolution 커밋을 단독으로도 대조해 RESOLUTION.md 조치표를 벗어나는 부가 수정이 없음을
확인했고, 테스트 실행으로 코드·테스트 정합성도 검증했다.

## 위험도

NONE
