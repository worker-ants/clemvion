# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — push 리뷰 게이트(`guard_review_before_push.py`)가 실제 재현 가능한 4가지 방식(개행-전용 다중 명령, 따옴표 분할, git 런처 대소문자, 미등록 글로벌 옵션)으로 우회되어 미검토 코드가 이 프로젝트의 "리뷰 없이는 push 불가" hard gate 를 통과해 push 될 수 있음. 세 명의 reviewer(security·requirement·side_effect)가 서로 다른 관점에서 실측 재현으로 이를 독립 확인했다. 반대로 이번 diff 의 다른 축(세션 앵커 reap 보호, `--keep`)은 세 reviewer 모두 견고함을 확인했다.

> 참고: `forced`(router_safety 강제) 화이트리스트 7건(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 정상 확보되었다 — 강제 포함 미이행은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/부작용 | `_is_git_push` 재작성이 개행(`\n`)만으로 구분된 멀티라인 명령(예: `git add -A\ngit commit -m "wip"\ngit push`, 특히 heredoc 커밋 직후 줄바꿈으로 이어지는 `git push` — heredoc+push 를 한 Bash 호출에 담는 사실상 유일한 자연스러운 문법)에서 실제 `git push` 를 탐지하지 못함. `_SEGMENT_SEPARATORS` 에 `\n` 이 없고 `shlex` 기본 whitespace 가 개행을 흡수해 전체가 한 세그먼트로 합쳐지며 `_git_subcommand()` 가 첫 서브커맨드(add/commit)만 보고 반환. **구 정규식은 `[^&;|]*` 가 개행도 매칭해 이 케이스를 정확히 차단했었다 — 이번 diff 의 실측 회귀.** requirement·side_effect 양쪽이 독립적으로 동일 재현(`guard._is_git_push('git add -A\ngit commit -m "wip"\ngit push')` → `False`) | `.claude/hooks/guard_review_before_push.py` `_SEGMENT_SEPARATORS`(개행 미포함), `_tokenize()`, `_is_git_push()` 세그먼트 누적 루프 | `lexer.whitespace` 에서 `"\n"` 제거 + `punctuation_chars` 에 `\n` 포함 + `_SEGMENT_SEPARATORS` 에 `"\n"` 추가. requirement.md 가 이 수정으로 기존 MUST_BLOCK 14건+MUST_ALLOW 8건+신규 개행 3건 전부 무회귀 통과함을 로컬 검증 완료. `test_push_detection.py::MUST_BLOCK` 에 개행-단독 구분 케이스(`"git add -A\ngit push"`, heredoc-then-push) 추가 |
| 2 | 보안 | 인용부호 분할(quote-splitting)로 사전 substring 필터 우회 — `git 'pu''sh' --force` 는 셸이 실제로 `git push --force` 를 실행하지만 `_is_git_push()` 첫 줄의 **토큰화 이전** 원시 `"push" not in command` 필터가 이를 "push 아님"으로 판정, REVIEW/PLAN 게이트 자체가 스킵됨(`main()` 이 `return 0`) | `.claude/hooks/guard_review_before_push.py:133-134`(원시 substring 사전 필터) | 사전 substring 필터를 제거하거나 토큰화 이후 결과에만 적용 |
| 3 | 보안 | `git` 런처 이름 대소문자 비교(`os.path.basename(segment[i]) != "git"`)가 case-sensitive — macOS(APFS 기본 case-insensitive) 등에서 `GIT push`/`Git push` 는 셸이 실제 git 을 정상 실행하지만 게이트는 이를 git 호출로 인식조차 못해 무조건 통과 | `.claude/hooks/guard_review_before_push.py:110`(`_git_subcommand`) | 대소문자 비구분 파일시스템을 고려해 비교를 정규화(`.lower()`) 또는 흔한 변형 인식 |
| 4 | 보안 | `_GIT_OPTS_WITH_VALUE` 화이트리스트에 실존하는 git 글로벌 옵션 `--attr-source`(공백-분리 값 지원, git 2.50.1 실측 확인)가 누락 — 값 토큰(`main`)이 서브커맨드로 오판정되어 그 뒤의 진짜 `push` 가 검사 자체를 건너뜀. "모르는 옵션=값 없는 플래그" 라는 닫힌 목록 설계라 git 이 새 글로벌 옵션을 추가할 때마다 구조적으로 fail-open | `.claude/hooks/guard_review_before_push.py:63-66`(`_GIT_OPTS_WITH_VALUE`) | 화이트리스트를 뒤집어 "값을 받지 않는" 플래그만 등록하고 미지의 `-`옵션은 안전 방향(보수적 폴백)으로 처리. 최소한 `--attr-source` 추가 |

**공통 사항**: 4건 모두 `.claude/tests/test_push_detection.py`(신설 7건, 전부 green) 의 `MUST_BLOCK` 목록에 없어 현재 테스트 스위트로는 검출되지 않는다("green"이 "false negative 완전 차단"을 보장하지 않음). 전체 하네스 스위트(264건)도 이 갭을 잡지 못한다.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/부작용 | plan 문서의 "참 양성 목록 전수 통과 확인" 체크리스트(`[x]`)와 "잔여 한계" 절이 **과차단** 방향(커밋 메시지 본문 오탐)만 기록하고, 위 Critical #1(개행-단독 구분 **과소차단** 회귀)은 전혀 언급하지 않아 완료 표기가 실제보다 과장됨 | `plan/in-progress/harness-session-anchor-guards.md` "### 검증" 체크리스트 및 "구현 결과" 서술 | Critical #1 수정 반영 후 체크리스트 재검증, "잔여 한계" 절에 개행-분리 케이스와 트레이드오프 명시 |
| 2 | 테스트 | `--keep` 의 "repeatable"(다회 지정) 계약이 회귀 테스트로 고정되지 않음 — 로직 자체는 수동 트레이스/프로브로 정상 동작 확인됨(버그 아님)이나, 향후 파서 리팩터링(예: 누적→덮어쓰기 실수) 시 현재 스위트는 아무것도 잡지 못함 | `.claude/tools/reap-merged-worktrees.sh` `--keep` 분기(`keep_paths` 누적), `.claude/tests/test_reap_merged_worktrees.py` | `--keep A --keep B` 로 두 워크트리 동시 보호를 단언하는 케이스 추가 |
| 3 | 테스트 | `_GIT_OPTS_WITH_VALUE` 8개 항목 중 6개(`--work-tree`/`--namespace`/`--exec-path`/`--config-env`/`--super-prefix` 등)가 "분리 토큰 값 스킵" 경로로 전혀 테스트되지 않음 — 표에 오타가 들어가도 현재 스위트는 통과하며, 그 상태에서 해당 옵션을 쓴 `git push` 는 거짓 음성이 됨(Critical #4 와 같은 실패 계열) | `.claude/hooks/guard_review_before_push.py:63-66`, `.claude/tests/test_push_detection.py` | `_GIT_OPTS_WITH_VALUE` 8개 전항목을 파라미터화한 테이블 테스트로 회귀 가드 승격 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `eval`/`bash -c`/`sh -c`/`time`/`nohup`/`command` 등 "인터프리터·래퍼로 감싸 실행" 계열 전체가 여전히 미탐지(신·구 코드 동일, 이번 diff 의 회귀 아님 — 정적 토큰 기반 가드의 구조적 한계) | `.claude/hooks/guard_review_before_push.py:104-121`(`_git_subcommand`) | plan/모듈 docstring 의 "알려진 한계" 서술을 `eval` 단일 사례에서 일반화된 서술로 확장(선택) |
| 2 | 보안/요구사항 | `--keep` 값이 존재하지 않거나 상대경로여도 사전 검증 없이 그대로 저장됨 — 다만 pass1 이 실제 워크트리 경로 필터를 먼저 통과한 항목에만 `is_kept()` 를 호출하므로 실제 위험(엉뚱한 대상 삭제/차단)은 없음을 확인. `worktree-policy.md` 가 수동 `--keep` 사용을 1급 사용법으로 문서화하므로 오탈자 시나리오 자체는 실재 | `.claude/tools/reap-merged-worktrees.sh` `--keep)` 분기, `is_kept()` | `$main_root/.claude/worktrees/` 하위가 아니면 경고 후 무시하는 sanity check 추가(선택, 필수 아님) |
| 3 | 보안/부작용 | `bootstrap-session.sh` 의 앵커 계산 실패가 조용히 무시됨(`anchor=""`, `--keep` 자체 생략)이자, 이 계산이 `.claude/settings.json` SessionStart 항목의 정확한 호출 문자열에 암묵적으로 결합됨(문서화 안 됨) — 실패 방향은 안전(이번 fix 이전 상태로 조용히 회귀할 뿐 새 위험 추가 없음)이나 관측 가능성 문제 | `.claude/tools/bootstrap-session.sh` 앵커 계산부, `.claude/settings.json:12` | anchor 계산 실패 시 stderr 경고 로그 추가, `worktree-policy.md §7`/스크립트 주석에 settings.json 호출형태 결합 명시(둘 다 선택) |
| 4 | 성능 | push 판별 훅이 모든 Bash 호출의 hot path — 조기-종료 가드(`"push" not in command`) 통과 시 순수 파이썬 `shlex` 토크나이저 실행. O(n) 이며 실사용 규모(수십~수백 바이트, 큰 경우 수 KB)에서 체감 지연 미미 | `.claude/hooks/guard_review_before_push.py` `_is_git_push()`/`_tokenize()` | 현재 조치 불요. 워드 바운더리 사전 검사(`\bpush\b`)로 무관한 부분일치(예: "pushed") 진입을 더 줄일 수 있음(선택) |
| 5 | 성능 | `is_kept()` 가 워크트리마다 서브프로세스(`printf`\|`grep`) fork — 현재 스케일(세션당 드문 호출, 워크트리 한 자릿수)에서 무시 가능 | `.claude/tools/reap-merged-worktrees.sh` `is_kept()` | 조치 불요. 워크트리 수가 크게 늘어나면 bash-native 매칭 고려 |
| 6 | 성능 | (Positive) `is_kept()` 스킵이 네트워크 호출(`gh pr view`)보다 먼저 배치되어 kept 워크트리는 불필요한 API 라운드트립을 만들지 않음 — 확인된 좋은 설계 패턴 | `reap-merged-worktrees.sh` pass-1 루프 순서 | 해당 없음(양호) |
| 7 | 성능 | 신규 통합 테스트 8건이 서브프로세스 체인을 늘려 하네스 스위트 실행 시간 소폭 증가 — 세션 wedge 방지라는 가용성 회귀 대비 타당한 트레이드오프 | `.claude/tests/test_reap_merged_worktrees.py` | 조치 불요. 유사 패턴 누적 시 CI 시간 모니터링 |
| 8 | 범위 | 서로 독립된 두 결함(① reaper 세션 앵커 보호, ② push 가드 서브커맨드 판정)이 하나의 plan/커밋으로 묶임 — plan Overview·Rationale 에 명시적으로 정당화되어 있어 은폐된 범위 확장 아님 | 전체 diff, `plan/in-progress/harness-session-anchor-guards.md` | 조치 불요. 완전 독립 결함을 묶을 때 Rationale 에 근거를 남기는 현 패턴 유지 권장 |
| 9 | 범위 | plan frontmatter `worktree:` 값(`llm-usage-doc-alignment-01d7a4`)이 실제 branch(`claude/harness-session-anchor-guards-611d98`)·plan 주제와 다름 — 기록값 자체는 실제 worktree 와 사실 일치하므로 규약 위반 아님, 코드 diff 범위와 무관한 환경 관찰 | `plan/in-progress/harness-session-anchor-guards.md` frontmatter | 조치 불요, 인지 목적 기록 |
| 10 | 범위/테스트 | `--keep` 이 다회 지정(repeatable) 을 지원하도록 일반화됐으나 유일 호출자(`bootstrap-session.sh`)는 1회만 사용 — 구현 비용이 거의 0 이고 CLI 관용구라 과잉설계 아님(선제적 설계로 평가). 다만 WARNING #2 가 지적하듯 이 계약 자체는 테스트로 고정 안 됨 | `.claude/tools/reap-merged-worktrees.sh` `--keep` 파서 | 조치 불요(설계 자체는). 테스트 보강은 WARNING #2 참고 |
| 11 | 유지보수성 | `_is_git_push` 의 세그먼트 판정 조건(`_git_subcommand(segment) == "push"`)이 루프 내부와 루프 이후("flush") 두 곳에 중복 — "누적 후 flush" 흔한 패턴이라 위험 낮음 | `.claude/hooks/guard_review_before_push.py` `_is_git_push()` | 필수 아님. 원하면 세그먼트 리스트를 먼저 모두 만든 뒤 한 곳에서 판정하도록 리팩터링 가능 |
| 12 | 유지보수성 | `keep_paths` 누적이 파일 내 다른 개행 생성 관례(`printf '...\n'`)와 달리 소스에 리터럴 개행을 직접 삽입 — 동작은 정상이나 diff 상 의도적 개행인지 우발적 줄바꿈인지 구분이 덜 명확 | `.claude/tools/reap-merged-worktrees.sh` `--keep)` 케이스 블록 | `$'\n'`(ANSI-C 따옴표) 또는 기존 `printf` 관례로 통일(선택, 급하지 않음) |
| 13 | 유지보수성 | "앵커가 reap 되면 세션이 wedge 된다"는 동일 진단 설명이 5개 산출물(policy 문서·bootstrap 주석·reaper 헤더·테스트 docstring·plan 본문)에 거의 그대로 반복 — 결함은 아니나 향후 진단이 정정될 경우(과거 "terminal 메커니즘" 오설명 사례처럼) 5곳을 동시에 고쳐야 drift 방지 | 5개 파일 각 위치 | 액션 아님. 추후 진단 수정 시 5개 위치를 체크리스트로 사용 권장 |
| 14 | 테스트 | `test_reap_merged_worktrees.py` 가 `.claude/tests/README.md` "What's covered" 표에 없음(이 PR 이전부터 없었던 pre-existing 누락, 다른 6개 파일도 동일 상태 — 이 PR 만의 문제는 아니나 README 가 이번 diff 대상 파일임) | `.claude/tests/README.md` | 이번 PR 범위에서 `test_reap_merged_worktrees.py` 행 추가 고려(선택), 전체 감사는 별도 후속 |
| 15 | 테스트 | `guard_review_before_push.main()` 자체(JSON payload 파싱, `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 분기, 실제 exit 0/2 결정)는 여전히 subprocess 수준 테스트 없음 — 이번 diff 에서 손대지 않아 새 회귀는 아니나, "판정 로직은 테스트됐지만 그걸 소비하는 배선은 아무도 실행 안 함" 간극 잔존 | `.claude/hooks/guard_review_before_push.py::main` | 후속 과제(비차단): stdin JSON 을 넣어 exit code 를 단언하는 얇은 통합 테스트 1~2건 |
| 16 | 테스트 | `_is_git_push` 세그먼트 처리의 일부 대칭 케이스(push 가 첫 세그먼트, trailing/선행 구분자) 미검증 — 코드 구조상 위치 무관하게 대칭 동작해 실제 위험은 낮음 | `.claude/hooks/guard_review_before_push.py:281-307` | 선택. `("push first of two", "git push && echo done")` 등 1건 추가 |
| 17 | 문서화 | plan 문서가 "테스트는 8건 추가"라고 서술하나 실제 diff 의 `def test_` 신규 정의는 9건(`test_unknown_argument_still_rejected` 는 `--keep` 과 무관한 기존 unknown-arg 파서 회귀 보호용 동반 테스트로 보임) — 문자 그대로 diff 와 대조하면 개수가 안 맞는 것처럼 읽힘 | `plan/in-progress/harness-session-anchor-guards.md` "구현 결과" 문단, `.claude/tests/test_reap_merged_worktrees.py` | "8건 추가(그중 8건이 `--keep`/앵커 가드 관련, 1건은 기존 unknown-arg 파서 회귀 보호용 동반 테스트)"로 명확화(선택) |
| 18 | 문서화 | 신규 테스트 docstring(`"""The B-case root cause, pinned directly."""`)이 plan 문서에만 정의된 "A–E" 알파벳 레이블을 자기완결적 설명 없이 인용 — 테스트 파일만 단독으로 읽는 독자는 "B-case" 가 무엇인지 알 수 없음 | `.claude/tests/test_push_detection.py` `test_quoted_pipe_is_not_a_segment_separator` | docstring 을 `"""The quoted-pipe bug (plan's case B), pinned directly."""` 등으로 자립하도록 보강(선택) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | push 탐지 3가지 우회 실측 재현(따옴표 분할·git 런처 대소문자·`--attr-source` 화이트리스트 누락) |
| performance | LOW | CRITICAL/WARNING 급 성능 결함 없음(전부 INFO). hot-path 토크나이저·subprocess fork 는 현재 스케일에서 무시 가능 |
| requirement | CRITICAL | 개행-전용 구분 멀티라인 명령(heredoc-commit 뒤 push 포함)에서 push 탐지 회귀 — 구 정규식 대비 실측 퇴행, 구체적 수정안까지 로컬 검증 |
| scope | LOW | 스코프 이탈 없음. 두 결함 묶음은 plan Rationale 로 정당화, `--keep` repeatable 은 과잉설계 아님 |
| side_effect | CRITICAL | requirement 와 독립적으로 동일 개행 회귀 재확인 + plan "전수 통과" 체크리스트 과장(WARNING) |
| maintainability | LOW | CRITICAL/WARNING 없음. 세그먼트 판정 중복·개행 생성 비일관 등 사소한 스타일 이슈만 |
| testing | LOW | 회귀 테스트 신설은 비-vacuity 까지 직접 검증한 견고한 작업이나, `--keep` repeatable·`_GIT_OPTS_WITH_VALUE` 커버리지 갭(WARNING 2건) |
| documentation | LOW | 문서화 전반 우수(함수별 docstring, 정책 문서 근본 정정). 테스트 개수 서술·레이블 자기완결성만 INFO |

## 발견 없는 에이전트

없음 — 8개 에이전트 전원이 최소 INFO 이상을 발견했다.

## 권장 조치사항

1. **(최우선, push 전 필수)** `_is_git_push()` 의 세그먼트 구분자에 개행(`\n`)을 추가해 멀티라인/heredoc-후-push 패턴의 탐지 회귀를 수정한다 — `lexer.whitespace` 에서 `\n` 제거 + `punctuation_chars` 에 `\n` 포함 + `_SEGMENT_SEPARATORS` 에 `"\n"` 추가. requirement.md 가 제시한 수정안은 기존 22건 테스트에 대해 로컬로 무회귀 검증됨(Critical #1).
2. 사전 substring 필터(`"push" not in command`)를 제거하거나 토큰화 이후 결과에만 적용해 따옴표 분할 우회를 차단한다(Critical #2).
3. `_git_subcommand()` 의 git 런처 이름 비교를 대소문자 비구분으로 정규화한다(Critical #3).
4. `_GIT_OPTS_WITH_VALUE` 화이트리스트를 fail-safe 방향(알려진 "값 없는" 플래그만 등록, 미지 옵션은 안전 폴백)으로 재설계하고 최소 `--attr-source` 를 반영한다(Critical #4).
5. 위 4건 수정 후 `test_push_detection.py::MUST_BLOCK` 에 개행-단독 구분 2건, 따옴표 분할 1건, 대소문자 1건, `--attr-source` 1건을 회귀 테스트로 추가한다.
6. `_GIT_OPTS_WITH_VALUE` 8개 전항목을 파라미터화한 테이블 테스트로 승격하고, `--keep A --keep B` 다중 지정 케이스를 추가한다(WARNING #2·#3).
7. plan 문서(`harness-session-anchor-guards.md`)의 "전수 통과" 체크리스트를 수정 반영 후 재검증하고, "잔여 한계" 절에 개행-분리 회귀 사례를 명시한다(WARNING #1).
8. (선택, 병합 비차단) INFO 항목 중 문서화 2건(테스트 개수 서술, B-case 레이블 자기완결화)과 유지보수성 스타일 이슈를 여유 있을 때 정리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **제외**: 표 (reviewer · 이유, 6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 사유 미제공(router가 개별 사유 문자열을 전달하지 않음). 8개 reviewer 가 확인한 실제 diff 스코프(`.claude/hooks`·`.claude/tools`·`.claude/tests`·`.claude/docs`·`plan/`만 변경)와 정합적으로, 시스템 아키텍처 변경은 없는 것으로 보임 |
  | dependency | 사유 미제공. 신규 의존성 없음(`shlex` 는 표준 라이브러리) — security.md 가 확인 |
  | database | 사유 미제공. 이번 diff 는 DB 스키마/쿼리 변경 없음(하네스 셸/파이썬 스크립트 및 문서만) |
  | concurrency | 사유 미제공. 동시성 관련 코드 변경 없음(로컬 셸 도구, 세션 내 순차 실행) |
  | api_contract | 사유 미제공. API/DTO 변경 없음 — `codebase/` 미변경 |
  | user_guide_sync | 사유 미제공. 유저가이드 대상 아님 — documentation.md 가 확인한 대로 `codebase/`·`spec/` 미변경으로 CHANGELOG·doc-sync-matrix 갱신 대상 아님 |