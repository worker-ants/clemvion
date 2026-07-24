# 요구사항(Requirement) 리뷰

## 검증 방법

정적 분석에 더해 실제 코드를 실행해 검증했다:
- `.claude/tests/test_guard_default_branch_bash_mutating.py` 9건 전체 통과 확인.
- `.claude/tests/` 전체 스위트(510 tests) 통과 확인 — 회귀 없음.
- 비-vacuity 재확인: `_is_mutating` 을 구 버전(`bool(_MUTATING.search(command))`, 세그먼트 분할 없음)으로
  되돌리는 뮤턴트 적용 → `SegmentTest`/`EnvPrefixTest` 계열 7/9 RED. 원본은 `cp` 로 복원(커밋 상태 불변,
  `git status --short` 로 clean 확인).
- `^\s*` 앵커를 제거하는 뮤턴트 적용 → `NoFalsePositiveClassTest` 6건 + `OutOfScopeTest` 2건 RED
  (plan 이 주장하는 "앵커 제거 시 RED" 를 실측 확인). 동일하게 `cp` 로 원복.
- `VAR=value` 접두·단일 `&` 백그라운드 연산자에 대한 추가 프로브(아래 발견사항 참고).

## 발견사항

- **[WARNING]** `VAR=value` 접두 스킵 정규식이 값에 공백이 포함된(따옴표로 감싼) 경우를 처리하지 못해, 문서가 약속한 "환경변수 접두는 건너뛴다" 는 보장이 흔한 실사용 패턴에서 깨진다.
  - 위치: `.claude/hooks/guard_default_branch_bash.py:69` (`^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*(?:`) — `\S+` 는 공백을 포함한 따옴표 값을 매칭하지 못함.
  - 상세: 실측 — `guard._is_mutating('GIT_AUTHOR_NAME="John Doe" git commit -m "x"')` → `False`, `guard._is_mutating('FOO="a b" git commit -m "x"')` → `False`, `guard._is_mutating("VAR='x y' git push")` → `False`. `.claude/docs/worktree-policy.md:73`(변경 후)의 "`VAR=value` 접두는 건너뜀" 서술과 `guard_default_branch_bash.py:57`(전체 컨텍스트 기준) 주석 "optionally after `VAR=value` assignments" 은 이 케이스에 무조건 적용되는 것처럼 읽히지만, 따옴표+공백 값에서는 세그먼트 전체가 어떤 alternation 브랜치와도 매치하지 못해 조용히 `False` 로 떨어진다 — 결과적으로 이 세그먼트는 최초 미수정 코드(env-prefix 처리 자체가 없던 상태)와 동일한 false negative 로 회귀한다. 다만 이 훅은 soft nudge 이고 이미 이런 종류의 부분 개선(quoted separator FP 등)을 의도적으로 수용하는 설계 철학이 문서화돼 있어(`AcknowledgedFalsePositiveTest` 패턴), 이 케이스만 test/문서에 명시적으로 인지되지 않은 채 남아 있다는 점이 문제다.
  - 제안: `\S+` 를 따옴표 인식 값 패턴(`"[^"]*"|'[^']*'|\S+`)으로 확장하거나, 최소한 코드 주석·`worktree-policy.md` 서술에 "따옴표로 공백을 포함한 값은 스킵되지 않는다" 는 한계를 `AcknowledgedFalsePositiveTest`/`OutOfScopeTest` 와 같은 방식으로 명시적으로 pin. 차단하지 않는 넛지이므로 CRITICAL 은 아니나, 현재는 이 갭이 유일하게 "테스트로 고정되지 않은 채 문서가 무조건적으로 약속한" 항목이라 WARNING.

- **[INFO]** `_SEGMENT_SPLIT` 이 셸의 백그라운드 연산자(단일 `&`)를 분리 대상에 포함하지 않아, `&` 뒤에 이어지는 mutating 명령이 세그먼트로 분리되지 않는다.
  - 위치: `.claude/hooks/guard_default_branch_bash.py:111` (`_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|\n]")`)
  - 상세: 실측 — `guard._is_mutating("sleep 5 & rm -rf x")` → `False` (직접 확인). bash 에서 `cmd1 & cmd2` 는 `cmd1` 을 백그라운드로 보내고 `cmd2` 를 즉시 실행하므로 `rm -rf x` 는 실제로 실행되는 명령이지만, 첫 토큰이 `sleep` 이라 전체 문자열이 어떤 alternation 브랜치와도 매치하지 않아 조용히 통과한다. `&&`/`||`/`;`/`|`/개행은 문서·주석·테스트(`SegmentTest`)에 명시됐지만 단일 `&` 는 어디에도 언급되지 않은 채 스코프 밖으로 남아 있다 — `xargs`/`bash -c` 처럼 `OutOfScopeTest` 로 의도적으로 pin 된 항목과 달리, 이 갭은 인지된 흔적이 없다.
  - 제안: 우선순위는 낮음(soft nudge, 상대적으로 드문 셸 패턴). 필요 시 `_SEGMENT_SPLIT` 에 단일 `&`(단, `&&` 와 겹치지 않도록 순서 주의) 를 추가하거나, `OutOfScopeTest` 에 이 케이스를 명시적으로 추가해 "알려서 남긴 갭" 으로 전환할 것을 권장.

- **[INFO]** spec fidelity — 이 변경 영역은 `spec/` (제품 스펙) 이 아니라 `.claude/docs/worktree-policy.md` (하네스 운영 문서) 가 유일한 관련 "spec" 이며, diff 에 문서·구현이 함께 포함돼 있다. `worktree-policy.md:73`(변경 후) 의 서술 — 세그먼트 분할 기준(`&&`/`||`/`;`/`|`/개행), `VAR=value` 접두 스킵, 첫 토큰 앵커로 인용문 속 단어 미분류, 간접 실행(`xargs`, `bash -c`) 스코프 밖 — 은 위 WARNING 항목을 제외하면 `guard_default_branch_bash.py:67-119` 구현과 line-level 로 일치한다(실측 검증됨). `plan/in-progress/harness-guard-followups.md` §C 의 "won't-do" 결론과 "9건 테스트" 주장도 실제 파일(`test_guard_default_branch_bash_mutating.py`, 9개 test method)과 일치.

## 요약

`guard_default_branch_bash.py` 의 세그먼트 분할 도입은 실제 결함(체인 명령 `git add -A && git commit` 이 첫 토큰만 보는 구 앵커에 잡히지 않던 false negative)을 정확히 겨냥해 고쳤고, 신규 테스트 9건이 전부 통과하며 뮤턴트 검증(구 버전 복귀·앵커 제거)으로 비-vacuity 도 실측 확인됐다. 관련 문서(`worktree-policy.md`)와 plan(`harness-guard-followups.md` §C) 서술도 구현과 line-level 로 일치한다. 다만 "VAR=value 접두는 건너뜀" 이라는 문서 상 보장이 공백 포함 따옴표 값에서 조용히 깨지는 케이스(WARNING)와, 단일 `&` 백그라운드 연산자가 분리 대상에서 누락된 케이스(INFO)가 테스트·문서 어디에도 인지된 흔적 없이 남아 있다. 이 훅이 soft nudge(절대 차단하지 않음, 세션당 최대 1회)라는 설계 철학을 고려하면 두 갭 모두 실사용 리스크는 낮지만, 이미 다른 유사 갭들(quoted separator FP, xargs/bash -c)은 전부 명시적으로 pin 되어 있는 반면 이 둘만 그렇지 않다는 비일관성이 있다.

## 위험도
LOW
