# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — `guard_review_before_push.py` 재작성이, 스스로 막으려던 것과 정확히 같은 계열의 "리뷰 없는 push 통과" 결함을 재도입했다. `_is_git_push()`가 인용된 인자 안의 명령 치환(`$(...)`)·백틱을 탐지하지 못해, `git commit -m "$(git push)"` 류 6개 명령이 구버전(정규식)에서는 정확히 차단됐으나 신버전(shlex 파서)은 전부 통과시킨다(security 리뷰어가 실제 git 서브프로세스로 재현). 이 훅은 스스로 "리뷰되지 않은 코드가 push되는 것을 막는 유일한 하드 게이트"라고 문서화하며 이를 뒷받침할 `pre-push` git 훅도 없다. 참고: security 리뷰어 자신의 개별 보고서 하단 위험도 라벨은 HIGH이나, 실제 실행 재현으로 확인된 게이트 완전 우회(2건의 CRITICAL 발견사항)라는 실질에 근거해 이 통합 보고서는 CRITICAL로 상향한다 — 과소 보고(false-clean) 방지가 우선.

forced 화이트리스트(7개: documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `_is_git_push()`가 인용된 인자 안의 명령 치환(`$(...)`)·백틱으로 감싼 실제 `git push` 실행을 탐지하지 못함 — 직전 리뷰가 고친 과소차단 회귀와 **같은 계열의 신규 회귀**. `git commit -m "$(git push)"`, `git commit -am "deploy: $(git push origin main)"`, `bash -c "cd /tmp && git push"`, 백틱 변형 등 6개 명령이 구버전(정규식, `_GIT_PUSH`)에서는 차단(True)됐으나 신버전(shlex 서브커맨드 파서)은 전부 통과(False)시킴 — 실제 bash는 명령 치환을 먼저 평가하므로 REVIEW/PLAN 게이트를 완전히 우회한 채 실제 push가 실행됨(실측 확인) | `.claude/hooks/guard_review_before_push.py:141-227` (`_git_subcommand`, `_is_git_push`), 소비처 `:275` | 토큰이 `$(`로 시작하거나 백틱을 포함하면 그 내용에 `_is_git_push()`를 재귀 적용, 또는 Critical #4(기존)와 동일한 fail-closed 패턴 적용. 위 6개 케이스를 `test_push_detection.py`의 `MUST_BLOCK`에 추가하고 **수정 전 코드에서 FAIL하는지 먼저 확인**(비-vacuity)한 뒤 fix |
| 2 | Security | 셸 래퍼(`sh -c`/`bash -c`/`env sh -c`)·`find -exec`·프로세스 치환(`diff <(git push) ...`)을 통한 간접 `git push` 실행이 신·구버전 공통 사각지대(이번 diff의 신규 회귀는 아님) — plan 문서의 "잔여 한계" 절이 이 계열 중 `eval` 하나만 의식적으로 검토·수용했다고 기록해, 나머지(`sh -c`/`bash -c`/`find -exec`)는 **인지되지 않은 사각지대**로 보임. 코딩 에이전트가 `eval`보다 훨씬 자연스럽게 타이핑할 법한 패턴 | 동일 함수 (`.claude/hooks/guard_review_before_push.py:141-227`) | 최소한 plan의 "잔여 한계" 절과 모듈 docstring에 `eval`과 나란히 명시해 팀이 의식적으로 수용하게 하거나, `sh`/`bash`/`zsh`/`env`가 `-c`로 받는 문자열 인자를 재귀 토큰화하는 좁은 범위 fix를 Critical #1 수정과 함께 처리 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `_git_subcommand()`의 exact-string 비교가 트레일링 NUL 바이트를 가진 "push" 토큰(`"git push\x00 extra"` → 토큰 `'push\x00'`)을 놓침 — 구 정규식은 `\b`가 NUL을 비-단어문자로 취급해 정확히 차단했었음(실측 회귀). 완화 요인: Claude Code 하네스 자신의 Bash 툴이 제어문자 포함 명령을 선제 거부하는 것을 리뷰 중 직접 관측(`"command contains control characters..."`) — 다만 이 훅을 트리거할 수 있는 모든 경로에 동일 상위 검증이 적용되는지는 이 저장소만으로 확인 불가하며, 상위 검증에 안전을 암묵적 위임하는 것은 이 훅 자신의 "파싱 실패 시 관대해지면 안 된다" 설계 원칙과도 어긋남 | `.claude/hooks/guard_review_before_push.py:119`(`_tokenize`), `:186`(`_git_subcommand`), `:227`(exact-equality 비교) | `_is_git_push()` 진입 시(또는 `_tokenize()` 진입 전) 명령 문자열에 제어문자(특히 NUL) 포함 여부를 확인해 기존 `ValueError` 케이스와 동일하게 `_GIT_PUSH_FALLBACK`으로 fail-closed 처리 |
| 2 | Side Effect | fail-closed 분기(`_git_subcommand` 185행)가 값을 받지 않는 흔한 boolean 전역 옵션(`--no-pager`, `-p`/`--paginate`, `--bare` 등 — `--no-pager`는 이 PR 자신의 `test_push_detection.py::MUST_BLOCK`에 이미 실존)을 처리하지 못해, 그 뒤 세그먼트 어딘가에 리터럴 "push" 토큰이 있으면 무관한 명령을 오탐 차단(`git --no-pager log --grep push`, `git --no-pager checkout push` 등 — 실측 재현). plan 문서는 이 클래스를 "알려진 git 옵션 중엔 없어 이론적 사례"라 서술했으나 **반증됨**(안전 방향의 over-block이라 미검토-push 위험은 아님) | `.claude/hooks/guard_review_before_push.py:148-186`(특히 185행), `plan/in-progress/harness-session-anchor-guards.md` "잔여 한계" 절 | plan 문서의 "이론적 사례" 서술을 실측 기반으로 정정(최소 조치). 코드 수정을 원하면 `_GIT_OPTS_WITH_VALUE` 곁에 값 없는 boolean 전역 옵션 집합을 추가해 skip-and-continue 시켜 fail-closed 범위를 진짜 미지 옵션으로만 좁힘 |
| 3 | Requirement | `_GIT_OPTS_WITH_VALUE` 화이트리스트 중 `--exec-path`·`--super-prefix` 두 항목이 "분리 토큰 값을 소비하므로 서브커맨드가 될 수 없다"는 독스트링의 전항목 확언과 실제 git 동작(`git 2.50.1` 실측)이 다름 — `--exec-path`는 공백형이 값을 소비하지 않고 조회-후-즉시종료, `--super-prefix`는 이 git 빌드에서 아예 미인식 옵션(즉시 거부). `_is_segment_boundary`의 반증된 "인용이 보호한다" 서술을 고친 직전 커밋(`f4489d314`)과 **같은 계열**의 "실측 없는 확신에 찬 메커니즘 서술" 부채. 실질 위험은 없음(두 경우 모두 git이 서브커맨드 도달 전에 스스로 종료/거부하므로 fail-closed 구조가 이미 안전망 역할) | `.claude/hooks/guard_review_before_push.py:68-70`(`_GIT_OPTS_WITH_VALUE`), `:175-176`(스킵 로직) | 독스트링의 전항목 확언을 완화하고 두 옵션에 실측 각주 추가. 선택: 실제 git 서브프로세스로 9개 전항목의 "분리 토큰 소비" 가정을 pin하는 테스트 추가(기능 수정은 안전 방향이라 불요) |
| 4 | Security | REVIEW/PLAN 게이트 전체가 내부 예외(임포트 실패, `evaluate_review()`/`evaluate_plan()` 실행 중 예외)에 대해 통째로 fail-open — 이 훅 전반의 기존 설계(모듈 docstring에도 명시, 이번 diff 고유 결함 아님)이나, 이 훅이 "리뷰 없는 push를 막는 유일한 하드 게이트"라는 점에서 트레이드오프가 큼. `review_guard.py`/`plan_guard.py`(이번 리뷰 범위 밖)에 예외를 유발하는 상태가 있으면 게이트가 소리 없이 꺼짐 | `.claude/hooks/guard_review_before_push.py:66-75`, `:279-284`, `:290-295` | 정책적 트레이드오프는 팀 판단 필요. 최소한 fail-open 경로 발동 시 텔레메트리(로그) 남기는 것을 권장. 이번 diff 범위 밖으로 낮은 우선순위 |
| 5 | Performance | `reap-merged-worktrees.sh`가 SessionStart 경로에서 `gh pr view`를 후보 워크트리/브랜치마다 순차 호출(N+1 네트워크 I/O, 병렬화·배치 없음) — `REAP_MIN_INTERVAL`(6h) 스로틀 덕분에 매 세션마다 발생하진 않지만, 스로틀 만료 세션에서 후보가 여러 개 쌓이면 `bootstrap-session.sh`(SessionStart, 동기 실행)가 수 초 블로킹될 수 있음 | `.claude/tools/reap-merged-worktrees.sh` `gh_state()`(L125-130), 호출부 L214/L245/L256, `bootstrap-session.sh` L74 | `gh pr list --state all --json headRefName,state`로 배치 조회해 branch→state 맵 선구성, 또는 후보별 호출을 동시성 상한(`xargs -P4`)으로 병렬화 |
| 6 | Maintainability | `reap-merged-worktrees.sh` pass-1 루프가 빈값 스킵·경로/브랜치 prefix 필터·현재 worktree 스킵·`--keep` 스킵·dirty 스킵·`gh` 상태 조회·dry-run 로그·실제 삭제까지 9~10개 책임을 한 블록(35~45줄)에서 순차 처리 — 향후 필터 조건이 늘면 계속 길어지는 구조. pass-2 루프도 유사 형태를 독립적으로 반복 | `.claude/tools/reap-merged-worktrees.sh:531-576`(pass 1), `:578-608`(pass 2) | `_should_reap_worktree(wt_path, wt_branch)` 류의 판정 전용 함수로 필터 단계를 분리하고, 루프 바디는 "판정 → 실행" 두 단계만 남기는 리팩터 고려(급하지 않음) |
| 7 | Concurrency | 모든 워크트리가 공유하는 단일 `mermaid-lint` `node_modules` 디렉터리에 대해 `npm install`이 check-then-act 경쟁을 가짐(`[ ! -d "$tool_dir/node_modules" ]` 체크 후 설치, 락 없음) — 이 프로젝트가 정석 워크플로로 문서화한 "여러 워크트리에서 병렬 백그라운드 세션" 하에서 두 세션이 거의 동시에 SessionStart 되면(최초 설치 시점 한정) 동시 `npm install`로 손상된 `node_modules`가 생길 수 있고, 이후 세션은 "이미 설치됨"으로 오판해 재설치를 시도하지 않아 mermaid lint가 조용히 무력화된 채 남을 수 있음(이번 diff 미변경, `--keep`/`is_kept` 로직과 무관한 섹션) | `.claude/tools/bootstrap-session.sh:33-42` | 이번 PR 스코프 밖(scope 오염 방지 차원에서 이 diff에서 고칠 필요 없음). 후속으로 `mkdir` 기반 락 또는 임시 디렉터리 설치 후 원자적 `mv` 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement/Testing/Documentation/Security | `.claude/tests/README.md` "What's covered" 표에 `test_reap_merged_worktrees.py` 행이 여전히 없음(이번 diff로 143줄 + 신규 테스트 10건 증가에도 불구, 자매 파일 `test_push_detection.py`는 표에 추가됨) — **4개 리뷰어가 공통 지적**, 직전 리뷰 세션(17_09_10)에서 이미 INFO #14로 지적되어 "전체 감사는 별도 후속"으로 명시적 보류된 기존 갭(신규 아님) | `.claude/tests/README.md` | `test_push_detection.py` 행과 같은 형식으로 1행 추가(선택, 비차단) |
| 2 | Documentation | plan 문서가 `test_reap_merged_worktrees.py` 신규 테스트를 "8건"으로 서술하나 실측(`git diff` grep) 10건 — 직전 리뷰에서 이미 지적된 격차(당시 실측 9건, RESOLUTION.md에서 "미반영, 범위 밖으로 유보")가 후속 WARNING #2 조치 커밋으로 1건 더해지며 8→9→10으로 더 벌어짐 | `plan/in-progress/harness-session-anchor-guards.md` ①"구현 결과" | 정확한 건수로 갱신하거나, 커밋마다 rot하는 하드코딩된 숫자 대신 "관련 테스트 일체 추가"처럼 개수 비의존 표현으로 변경 |
| 3 | Requirement | git alias 경유 push(`git config alias.p push` 후 `git p`)가 여전히 미탐지 — `_git_subcommand`가 alias 해석을 하지 않음. `eval`/`bash -c` 류와 같은 계열의 "정적 토큰 기반 가드의 구조적 한계"로 이미 조치 없음 처리된 사례와 동종(이번 diff의 회귀 아님, 구 정규식도 못 잡았음) | `.claude/hooks/guard_review_before_push.py:213`(`_git_subcommand`) | plan 문서 "잔여 한계" 절에 alias 케이스 병기 정도로 충분, 코드 변경 불요 |
| 4 | Side Effect/Performance | substring 사전 필터 제거로 대형 heredoc/긴 커밋 메시지(90KB~1MB)에서 30~500ms(선형 스케일) 지연 관측 — 정확성 문제는 아니나, 직전 성능 리뷰(`review/code/2026/07/17/17_09_10/performance.md`)의 LOW 판정 근거였던 "조기-종료 가드 보존" 전제가 이후 Critical #2 수정으로 무효화된 채 아카이브에 남아있음(최신 코드 기준 재확인 안 된 상태) | `.claude/hooks/guard_review_before_push.py:190-227`(`_is_git_push`) | docstring에 "대형 임베디드 콘텐츠에는 적용 안 됨" 각주 추가, 필요시 매우 긴 명령에 대한 substring 기반 fast-path 고려. 성능 리뷰어의 최신 코드 기준 재확인 권장 |
| 5 | Architecture | `_git_subcommand()` 반환값이 "확정된 서브커맨드"(정상 경로)와 "보수적 추측"(fail-closed 분기, 185행)을 같은 `str \| None` 타입에 혼재 — 현재 유일 호출부는 `== "push"` 비교만 하므로 문제 없으나, 향후 다른 목적으로 재사용되면 두 신뢰도를 구분 못해 오용될 수 있음 | `.claude/hooks/guard_review_before_push.py:174-213` | 현재 동작 변경 불요. 재사용 시점에 `(subcommand, confident)` 튜플이나 별도 함수로 분리 고려 |
| 6 | Architecture/Dependency | `bootstrap-session.sh` ↔ `reap-merged-worktrees.sh` 간 `--keep` 계약이 버전관리 안 되는 CLI 문자열 하나로만 고정되고, E2E 테스트 1건(`test_bootstrap_keeps_the_worktree_it_was_invoked_from`)이 유일한 방어 — plan 문서 스스로 "reaper만 단위 테스트하면 bootstrap이 `--keep` 전달을 빠뜨려도 통과한다"고 인지하고 이 테스트를 의도적으로 추가했다고 명시. 현재 2-hop 규모에서는 수용 가능하며 이미 최선의 방어(E2E pin)를 갖춤 | `bootstrap-session.sh:96-100`, `reap-merged-worktrees.sh:417-436` | 조치 불요. 스크립트가 추가로 체이닝되기 시작하면 공유 bash 함수 라이브러리(`.claude/tools/_lib/`)로 승격 고려 |
| 7 | Architecture | 이번 PR이 고친 것과 같은 계열("진짜 대상 대신 대리 지표를 평가")의 결함이 `review_guard.py`(push 대상이 아니라 셸 cwd를 평가)에도 남아있을 가능성이 plan 문서에 이미 명시됨 — 이번 diff 범위 밖 | `plan/in-progress/harness-session-anchor-guards.md:1416-1417`, `.claude/hooks/_lib/review_guard.py`(리뷰 대상 미포함) | 차단 사유 아님. 별도 plan/이슈로 추적되고 있는지 확인 권장 |
| 8 | Maintainability | "Critical #1~#4" 회귀 서술이 코드 docstring·테스트 주석·plan 문서 3곳에 각각 다른 표현으로 중복 서술 — 이 진단 중 하나가 추후 정정되면(이번 diff에서 실제로 한 번 있었던 사례) 세 곳 모두 찾아 갱신해야 하는 동기화 부담 | 코드 docstring, `test_push_detection.py:763-780`, plan 문서 표 | 재손볼 일이 생기면 plan 문서를 SoT로 삼고 코드/테스트 주석은 짧은 참조로 축약 고려(현 상태 유지 가능) |
| 9 | Maintainability | 안전-critical 가드 함수들(`_is_segment_boundary`/`_tokenize`/`_git_subcommand`/`_is_git_push`)의 docstring이 각각 함수 본문보다 길어, 회귀 수정이 반복되며 "Critical #N"이 계속 늘어나는 패턴(#1~#4가 한 세션에서 추가) — 앞으로도 반복되면 changelog-in-comment 안티패턴으로 흐를 여지 | `.claude/hooks/guard_review_before_push.py` 전반 | 지금 당장 조치 불요. 다음 라운드부터 "왜 지금 이 형태인가"에 대한 최소 설명만 남기고 사고 이력·번호 매김은 plan/RESOLUTION 문서에 집중 |
| 10 | Maintainability | 축약 변수명 `wt`/`br`이 나머지 코드의 완전한 이름(`wt_path`/`wt_branch`)과 대비(스코프가 작아 실질 혼동은 낮음) | `.claude/tools/reap-merged-worktrees.sh:500-510`(`_parse_worktrees`) | 선택 사항. 일관성을 위해 `worktree`/`branch`로 풀어써도 무방, 우선순위 낮음 |
| 11 | Maintainability | `main_root` 계산 시 `realpath_p` 적용 여부가 두 스크립트 간 다름(reaper만 symlink drift 방지 적용, bootstrap은 경로 비교가 없어 기능적으로 문제없음) — 나란히 볼 때 "왜 한쪽만 감싸는가"라는 의문 유발 가능 | `bootstrap-session.sh:16-17` vs `reap-merged-worktrees.sh:52-53` | bootstrap 쪽 주석에 "경로 비교 없어 realpath_p 불필요" 한 줄 추가하면 의문 예방(급하지 않음) |
| 12 | Testing | `guard_review_before_push.main()` 진입점의 subprocess/E2E 통합 테스트가 여전히 0건(직전 리뷰 INFO #15로 지적, RESOLUTION.md에 "미반영, 후속 과제"로 명시적 보류 — 이번 diff도 `main()` 자체는 미변경이라 신규 회귀 아님) | `.claude/hooks/guard_review_before_push.py:270`(`def main()`) | (비차단, 후속) stdin JSON payload로 exit code를 단언하는 얇은 통합 테스트 1~2건 |
| 13 | Testing | `gh_state()`의 "바이너리는 있지만 호출 자체가 실패"(미인증/에러) 분기가 어떤 테스트로도 실행되지 않음(`\|\| echo ""` 폴백 미검증) — 삭제는 정확히 `"MERGED"` 문자열에만 트리거되므로 이 분기가 깨져도 결과는 "삭제 안 함" 방향이라 fail-safe, 실사용 리스크 낮음 | `.claude/tools/reap-merged-worktrees.sh:125-130`(`gh_state`) | (선택) `exit 1` 스텁 추가로 "존재하되 실패" 경로를 명시적으로 pin |
| 14 | Testing | Critical #4(기존)의 "수용된 트레이드오프"(미지 옵션 뒤 우연히 문자 그대로 "push"인 비-push 명령의 과차단)에 대해 `_is_git_push()` 전체 파이프라인 수준의 pinning 테스트 부재 — 구조적 fail-closed 동작 자체는 다른 테스트가 고정하나 이 구체 시나리오는 비어 있음 | `.claude/hooks/guard_review_before_push.py:185` | (선택) 문서화된 대로 동작함을 1건으로 고정해 향후 재논쟁 예방 |
| 15 | Concurrency | reap 스로틀 마커가 check-then-act이며 락이 없어, 동시 SessionStart 시 본문(pass 1/2) 실행이 중복될 수 있음(git 자체의 ref 락으로 `.git` 손상 위험은 낮음, 최악은 `gh` 중복 호출/`cleanup-worktree.sh` 이중 호출 정도, 이번 diff 미변경) | `.claude/tools/reap-merged-worktrees.sh:116-122`(스로틀 체크), `:268`(마커 touch) | 후속으로 `mkdir` 기반(POSIX 원자적) 락 디렉터리로 감싸는 것 고려 |
| 16 | Concurrency/Performance | `gh pr view` 호출(`gh_state()`)에 타임아웃이 없어, 네트워크 정체·재인증 등으로 응답 지연 시 SessionStart 전체를 무기한 블록할 이론적 경로 존재 — "항상 exit 0" 보장은 끝나야 의미가 있는데 애초에 안 끝나면 무력화(이번 diff 미변경) | `.claude/tools/reap-merged-worktrees.sh:125-130`, 호출부 214/245/256행 | 후속으로 `timeout <N>s "$GH" pr view ...` 워치독 wrapping 고려 |
| 17 | Concurrency | `--keep`은 "이 세션 자신의" 앵커만 보호 — 동시에 열린 *다른* 세션의 앵커는 여전히 무방비(세션 B의 워크트리가 세션 A의 reap 기준을 만족하면 세션 A의 reaper가 세션 B의 anchor를 모른 채 지울 수 있음). 코드·plan·정책 문서 세 곳이 일관되게 정직히 공개한 기존 한계, 은폐된 갭 아님 | `plan/in-progress/harness-session-anchor-guards.md` "알려진 한계" 절, `worktree-policy.md §7` "한계" 절 | 별도 조치 불요 — "살아있는 세션 앵커 레지스트리" 같은 전역 조정 메커니즘은 문서가 이미 과하다고 판단해 기각 |
| 18 | Security | `reap-merged-worktrees.sh`의 `is_ancestor()`/`gh_state()`가 `git merge-base --is-ancestor "$1" ...`/`gh pr view "$branch" ...` 호출 시 `--` 인자 종결자 없이 브랜치명 전달 — 같은 파일의 `git branch -d/-D` 호출은 이 방어가 있음. 현재는 모든 브랜치명이 사용 전에 `claude/*` 패턴으로 필터링되어(`-`로 시작하는 이름이 도달 불가) 실질적으로 도달 불가능한 방어 누락 | `.claude/tools/reap-merged-worktrees.sh` `is_ancestor()`/`gh_state()` | 저비용 defense-in-depth로 `--` 추가해 파일 전체 기존 방어 패턴과 일관성 유지(시급성 낮음, 필터가 느슨해질 미래 변경 대비) |
| 19 | Security | `BYPASS_REVIEW_GUARD=1`/`BYPASS_PLAN_GUARD=1` 우회에 감사로그 없음(의도된 설계, "의식적 우회") | N/A | (낮은 우선순위) 우회 발동 시 stderr/로그에 명시적 한 줄 남기면 추적성 개선 |
| 20 | Documentation | 테스트 docstring이 파일 밖(plan 문서)에서만 정의된 "B-case" 레이블을 자기완결적 설명 없이 인용 — plan이 archive로 옮겨진 뒤 이 테스트 파일만 단독으로 읽으면 의미 불명(직전 리뷰 INFO #18로 지적, "미반영, 선택 사항"으로 이미 합의) | `.claude/tests/test_push_detection.py`(`test_quoted_pipe_is_not_a_segment_separator` docstring) | `"""The quoted-pipe bug (plan's case B), pinned directly."""`처럼 한 구절 추가(선택, 우선순위 낮음) |
| 21 | Documentation | `worktree-policy.md`의 세션 앵커 서술 첫 문장이 코드가 `$CLAUDE_PROJECT_DIR` env var를 직접 읽는다는 인상을 줄 수 있음(실제는 `BASH_SOURCE[0]` 유도, 안 B) — 바로 다음 문장이 메커니즘을 정확히 정정해 실질 오해 소지는 낮음 | `.claude/docs/worktree-policy.md:117` | 사소한 표현 이슈, 조치 선택사항 |
| 22 | Scope | 마지막 커밋(`f4489d314`)은 plan 체크리스트에 문자 그대로 없는 "docstring 정정 + 특성 테스트" 단독 커밋 — 반증된 서술("인용이 보호한다")을 자기 브랜치가 도입한 같은 함수(`_is_segment_boundary`)에 대해 실측대로 교정하고 회귀 테스트로 고정한 자기 완결적 정정. scope 이탈 아님, 정상적 반복 정제 과정 | `.claude/hooks/guard_review_before_push.py` `_is_segment_boundary` docstring, `test_push_detection.py::test_quoted_pure_punctuation_is_read_as_a_boundary_and_that_is_safe` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | HIGH | CRITICAL 2건(명령치환/백틱 미탐지 신규 회귀, `sh -c`/`find -exec` 미인지 사각지대) + WARNING(REVIEW/PLAN 게이트 fail-open) + INFO 다수(`--` 인자 종결자, bypass 감사로그 부재 등). 하드코딩 시크릿·SQL/XSS/LDAP 인젝션·ReDoS는 실측으로 문제 없음 확인 |
| performance | LOW | WARNING(`gh pr view` 순차 N+1 호출로 스로틀 만료 세션에서 수 초 블로킹 가능). `_is_git_push` 알고리즘 복잡도(선형, ReDoS 없음) 독립 재검증 통과 |
| architecture | LOW | INFO 4건(반환타입 신뢰도 혼재, `--help` 텍스트의 자기참조적 결합, 비-formal CLI 계약, 형제 모듈 `review_guard.py`에 동일 계열 결함 잔존 가능성). 전반적으로 fault-isolation·개방-폐쇄 원칙 등 설계 강점 다수 |
| requirement | LOW | WARNING(`--exec-path`/`--super-prefix` 값-소비 확언이 실측과 다름, 실위험 없음) + INFO(git alias 미탐지, README 표 공백 재확인 등). 비-vacuity 재현(6/8, 6/6) 성공, 270건 테스트 전수 통과 확인 |
| scope | NONE | 전 변경이 plan 서술과 1:1 대응, 요청 외 수정·포맷팅 혼입·무관 코드 없음. INFO 1건(자기교정 커밋, scope 이탈 아님) |
| side_effect | MEDIUM | WARNING 2건(NUL 바이트 트레일링 토큰 미탐지 실측 회귀, `--no-pager` 등 boolean 옵션 결합 시 오탐차단 — plan의 "이론적 사례" 서술 반증) + INFO(성능 리뷰 전제 무효화). `--keep`/`is_kept` 경로는 하위호환·부작용 없음 확인 |
| maintainability | LOW | WARNING(reap pass-1 루프의 9~10개 책임 과다) + INFO 다수(가독성/일관성, docstring 누적 위험). 전반적으로 가드절 스타일·명명·테이블 기반 테스트 등 품질 높음 |
| testing | LOW | INFO 4건(`main()` 통합테스트 부재, README 표 공백, `gh_state()` 실패분기 미검증, Critical #4 트레이드오프 pin 부재 — 대부분 fail-safe 방향으로 보호됨). 직전 리뷰 WARNING 2건의 비-vacuity 해소 검증, 270건 전수 재실행 통과 |
| documentation | LOW | INFO 4건(plan 테스트 개수 서술 격차 8→10 확대, B-case 레이블 비자립, README 표 공백, worktree-policy 첫 문장 모호). `f4489d314` 자기교정 커밋을 모범 사례로 강조 |
| dependency | NONE | 신규 외부 의존성 없음, 유일한 신규 import는 stdlib `shlex`. 신규 CLI 내부 계약(`--keep`)은 E2E로 완화됨 |
| database | NONE | SQL/ORM/스키마/마이그레이션/트랜잭션 코드 전무, 해당 없음 |
| concurrency | LOW | WARNING(공유 `node_modules`에 대한 `npm install` check-then-act 경쟁, 병렬 워크트리 세션 워크플로 하에서 실제 트리거 가능) + INFO 다수(reap 스로틀 락 없음, `gh` 호출 타임아웃 없음 — 모두 사전 존재, 이번 diff 범위 밖). 이번 diff 자체(`is_kept`/파서)는 TOCTOU를 오히려 순감소시킴 |
| api_contract | NONE | REST API/DTO/라우팅 변경 없음, 해당 없음 |
| user_guide_sync | NONE | `doc-sync-matrix.json` 21개 trigger 매칭 0건, 해당 없음 |

## 발견 없는 에이전트

database, api_contract, user_guide_sync — 세 에이전트 모두 리뷰 대상이 각자의 관점(DB/REST API 계약/유저 가이드 동반 갱신)에 해당하는 코드·트리거를 전혀 포함하지 않는다고 명시적으로 확인(`없음`).

## 권장 조치사항

1. **[병합 차단 권장]** `_is_git_push()`가 인용된 인자 안의 명령 치환(`$(...)`)/백틱을 탐지하도록 수정 — Critical #1. `git commit -m "$(git push)"` 등 6개 케이스를 `MUST_BLOCK`에 먼저 추가해 수정 전 코드에서 FAIL함을 확인(비-vacuity)한 뒤 fix.
2. plan 문서의 "잔여 한계" 절에 `sh -c`/`bash -c`/`find -exec`/프로세스 치환을 통한 간접 `git push` 실행을 `eval`과 나란히 명시하거나, 좁은 범위의 재귀 토큰화로 커버 — Critical #2.
3. NUL 바이트를 포함한 명령 문자열에 대해 fail-closed(`_GIT_PUSH_FALLBACK`) 처리 추가 — WARNING(side_effect #1).
4. `--no-pager` 등 값 없는 boolean 전역 옵션을 fail-closed 분기가 인식하도록 하거나, 최소한 plan 문서의 "이론적 사례" 서술을 실측 기반으로 정정 — WARNING(side_effect #2).
5. `_GIT_OPTS_WITH_VALUE` 관련 독스트링의 "전항목 값 소비" 확언을 `--exec-path`/`--super-prefix` 실측에 맞게 정정 — WARNING(requirement).
6. (후속, 비차단) `gh pr view` 순차 호출 배치화/병렬화, reap pass-1 루프 책임 분리, 공유 `node_modules` 설치 락 등 성능·유지보수·동시성 WARNING 항목을 별도 후속 항목으로 트래킹.
7. (선택) `.claude/tests/README.md`에 `test_reap_merged_worktrees.py` 행 추가, plan 문서의 테스트 개수 서술("8건"→실제 10건) 정정.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 정상 실행(제외 없음).
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(누락 없음)