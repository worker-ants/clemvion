# 보안(Security) 코드 리뷰 — 하네스 가드 2건 (세션 앵커 reap + push 가드 오탐)

리뷰 대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tools/reap-merged-worktrees.sh`,
`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_push_detection.py`,
`.claude/tests/test_reap_merged_worktrees.py`, `.claude/docs/worktree-policy.md`,
`plan/in-progress/harness-session-anchor-guards.md`

검증 방법: 주장을 텍스트로만 판단하지 않고, 실제 저장소 파일을 `origin/main`(수정 전)과 현재
워킹트리(수정 후) 양쪽에서 직접 로드해 `_is_git_push()` / `_tokenize()` / `_git_subcommand()`를
동일 입력으로 실행 비교했다(재현 스크립트: 스크래치패드에 보관, 결과는 아래 표에 반영).

## 발견사항

- **[CRITICAL]** `_is_git_push()` — 인용된 인자 안의 명령 치환(`$(...)`)·백틱이 감싼 실제 `git push`
  실행을 탐지하지 못함. **이번 diff가 만든 새로운 회귀** (직전 리뷰가 고친 것과 정확히 같은 계열의
  결함이 재발함)
  - 위치: `.claude/hooks/guard_review_before_push.py:141-227` (`_git_subcommand`, `_is_git_push`) —
    판정 결과 소비처는 `:275` (`if not _is_git_push(command): return 0`, REVIEW/PLAN 게이트를
    통째로 skip)
  - 상세: 아래 6개 명령을 origin/main의 구버전(정규식 `_GIT_PUSH`)과 현재 diff의 신버전(shlex
    서브커맨드 파서) 양쪽에 직접 실행해 비교했다:

    | 명령 | 구버전(origin/main) | 신버전(이번 diff) |
    |---|---|---|
    | `git commit -m "$(git push)"` | 차단(True) | **통과(False)** |
    | `git commit -m '$(git push)'` | 차단(True) | **통과(False)** |
    | `git commit -am "deploy: $(git push origin main)"` | 차단(True) | **통과(False)** |
    | `bash -c "cd /tmp && git push"` | 차단(True) | **통과(False)** |
    | 백틱으로 감싼 `git push` (``git commit -m "`git push`"``) | 차단(True) | **통과(False)** |
    | 백틱, 따옴표 없이 인자로 (``git commit -m `git push` ``) | 차단(True) | **통과(False)** |

    이 6개는 전부 실제 bash가 실행하면 **명령 치환/서브셸이 외부 명령보다 먼저 평가**되므로 진짜
    `git push`(원격 저장소에 대한 실제 push, 네트워크 부수효과 포함)가 수행된다. 그런데 신버전
    `_is_git_push()`는 전부 `False`를 반환하고, `main()`(:275)이 그 즉시 `return 0`으로
    REVIEW·PLAN 게이트 자체를 완전히 우회시킨다. 구버전(원시 정규식)은 `git`과 `push` 사이에
    거리 제한이 없었기 때문에(바로 그 "과도 매칭"이 직전 리뷰에서 Critical #1의 원인이었다) 오히려
    이 6개 전부를 우연히 정확하게 막고 있었다 — 즉 **"과소차단 회귀를 닫으려던 이번 rewrite가,
    정확히 같은 이름(과소차단)의 새 구멍을 다시 열었다."**
  - 근본 원인: `_tokenize()`는 큰따옴표/작은따옴표로 감싼 내용을 통짜 토큰 하나로 취급한다 —
    이는 `test_quoted_pipe_is_not_a_segment_separator`가 고정한 **의도된** 설계로, 따옴표 안의
    `|`를 파이프로 오판하던 구버전 버그(케이스 B, 인용된 grep 패턴)를 고치기 위함이다. 문제는 이
    설계가 `$(...)`/백틱처럼 **따옴표 안에서도 셸이 실제로 재평가·실행하는 하위 명령**까지
    통째로 삼켜버린다는 점이다. `_git_subcommand()`는 "첫 non-flag 토큰 = 이 세그먼트의
    서브커맨드"만 판정하고, 그 뒤 인자(`-m`의 값 등)의 *문자열 내용*을 재귀적으로 다시 파싱하지
    않는다. `git commit -m "$(git push)"`가 최상위 서브커맨드로 `commit`을 갖는다는 판정 자체는
    틀리지 않았지만, 그 인자 값 안에 셸이 실행할 또 다른 `git push`가 숨어 있다는 사실은 이 함수의
    시야 밖에 있다.
  - 왜 CRITICAL인가: (1) 이 파일은 스스로 "리뷰되지 않은 코드가 push되는 것을 막는 유일한 하드
    게이트"라고 문서화한 통제다(모듈 docstring 3-6행). (2) `.githooks/`에는 `pre-commit`만 있고
    `pre-push` git 훅은 존재하지 않으며, `.claude/settings.json`의 PreToolUse matcher는 `"Bash"`
    전체(코스 필터 없음)이므로, `_is_git_push()`가 놓치면 이 push를 막을 다른 계층이 (확인된
    범위 안에는) 없다. (3) 같은 세션 바로 직전에 동일 함수에서 "과소차단 회귀 4건(Critical
    #1-#4)"을 발견·수정한 전례가 있다(`plan/in-progress/harness-session-anchor-guards.md` §review
    후속 수정) — 이 프로젝트는 이 함수의 이 계열 결함을 이미 Critical로 취급해 왔다.
  - 제안: (a) 토큰이 `$(`로 시작하거나 백틱을 포함하는 등 "셸이 재해석·재실행하는 하위 명령
    문자열"로 식별되면 그 내용에 `_is_git_push()`를 재귀 적용하거나, 최소한 Critical #4에서 이미
    쓴 fail-closed 패턴("판정 불가하면 push로 간주")을 여기에도 적용. (b) 위 6개 케이스를
    `test_push_detection.py`의 `MUST_BLOCK`에 추가하고 **수정 전 코드에서 FAIL하는지 먼저
    확인**(이 프로젝트가 이미 채택한 비-vacuity 절차)한 뒤 fix.

- **[CRITICAL]** 셸 래퍼(`sh -c`/`bash -c`/`env sh -c`)·`find -exec`·프로세스 치환을 통한 간접
  실행 — 신·구버전 공통 사각지대이며, plan 문서의 "잔여 한계" 절이 언급하지 않은 미인지 구멍으로
  보임
  - 위치: 동일 함수 (`.claude/hooks/guard_review_before_push.py:141-227`)
  - 상세: `sh -c "git push"`, `bash -c "git push"`, `env sh -c "git push"`,
    `find . -maxdepth 0 -exec git push \;`, `diff <(git push) /dev/null` 는 **origin/main과 현재
    diff 양쪽 모두**에서 `_is_git_push() == False`로 실측 확인됐다(즉 이번 diff의 신규 회귀는
    아니다). 이들 전부 실행 시 실제 `git push` 부수효과를 낸다.
  - 왜 지금 보고하나: `plan/in-progress/harness-session-anchor-guards.md`의 "잔여 한계(트레이드오프,
    수용)" 절은 이 계열의 구조적 한계 중 `eval "git push"` **딱 하나만** 의식적으로 검토·수용했다고
    기록한다("정적 토큰 기반 가드의 구조적 한계"). 그런데 `sh -c`/`bash -c`/`find -exec`는 `eval`
    보다 코딩 에이전트가 훨씬 자연스럽게 타이핑할 법한 패턴이며(디렉터리 변경 후 명령 실행, 파일별
    반복 실행 등), 문서 어디에도 언급이 없다 — 의식적으로 수용된 위험이 아니라 **인지되지 않은
    사각지대**로 보인다. 이 파일 전체가 이번 리뷰 대상("변경 유형: Review")이고, PR 자신이 "이
    계열을 조사해 마감했다"고 주장하는 세션이므로 지적한다.
  - 제안: 최소한 plan의 "잔여 한계" 절과 모듈 docstring에 이 케이스들을 `eval`과 나란히 명시해
    팀이 의식적으로 수용하게 하거나, `sh`/`bash`/`zsh`/`env`가 `-c`로 받는 문자열 인자를 재귀
    토큰화하는 좁은 범위의 fix를 CRITICAL #1 수정과 함께 처리.

- **[WARNING]** REVIEW/PLAN 게이트 전체가 내부 예외에 대해 fail-open (이번 diff 고유 결함은
  아니나, 이 훅의 성격상 트레이드오프가 큼)
  - 위치: `.claude/hooks/guard_review_before_push.py:66-75`(import 단계),
    `:279-284`, `:290-295`(evaluate 단계)
  - 상세: `review_guard`/`plan_guard` import 실패, 또는 `evaluate_review()`/`evaluate_plan()`
    실행 중 예외가 발생하면 해당 게이트는 조용히 `None` 처리되어 push가 허용된다(주석: "fail open
    on internal error"). 이는 이 하네스 훅 체계 전반의 일관된 설계(모듈 docstring에도 "any other →
    treated as runtime error; tool call proceeds (fail-open)"로 명시)라 이번 diff가 새로 만든
    결함은 아니다. 다만 이 훅은 "리뷰 없는 push를 막는 유일한 하드 게이트"이므로, `_lib/review_guard.py`·
    `_lib/plan_guard.py`(이번 리뷰 범위 밖, 파일 목록에 없음)에 예외를 유발하는 상태(손상된 상태
    파일, 예상 밖 git 출력 등)가 있으면 게이트가 소리 없이 꺼진다.
  - 제안: 정책적으로 받아들일 트레이드오프인지는 팀 판단 필요. 최소한 이 fail-open 경로가 실제
    발동했다는 사실을 남기는 텔레메트리(로그 파일 등) 권장. 이번 diff 범위는 아니므로 우선순위 낮음.

- **[INFO]** `BYPASS_REVIEW_GUARD=1` / `BYPASS_PLAN_GUARD=1` 우회에 감사로그 없음
  - 상세: 의도된 설계(문서화된 "의식적 우회")지만, 환경변수 설정만으로 게이트 전체가 꺼지고 그
    사실이 어디에도 기록되지 않는다. 이번 diff의 변경사항은 아니며 참고용으로만 기재.
  - 제안(낮은 우선순위): 우회 발동 시 stderr/로그에 명시적 한 줄이라도 남기면 추적성 개선.

- **[INFO]** `reap-merged-worktrees.sh`의 `is_ancestor()`/`gh_state()`는 `--` 인자 종결자 없이
  브랜치명을 전달 (현재는 도달 불가능한 방어 누락)
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `is_ancestor()`
    (`git merge-base --is-ancestor "$1" "$default_ref"`), `gh_state()`
    (`"$GH" pr view "$branch" --json state --jq .state`)
  - 상세: 같은 파일의 `git branch -d -- "$branch"` / `-D -- "$branch"` 호출은 브랜치명이 `-`로
    시작해 옵션으로 오인되는 것을 명시적으로 막는다(주석에 그 의도가 적혀 있음). `is_ancestor()`/
    `gh_state()`에는 같은 방어가 없다. 다만 이 스크립트가 다루는 모든 브랜치명은 사용 전에
    `claude/*` 패턴으로 필터링되므로(pass 1의 `case "$wt_branch" in claude/*) ;; esac`, pass 2는
    `git for-each-ref refs/heads/claude/`만 순회) 현재 코드 경로상 `-`로 시작하는 브랜치명이
    이 함수들에 도달할 수 없다 — 실질적으로 도달 불가능한 방어 누락이다.
  - 제안: 저비용 defense-in-depth로 두 호출에도 `--`를 추가해 파일 전체의 기존 방어 패턴과
    일관성 유지(시급성 낮음, 필터가 느슨해질 미래 변경에 대비).

- **[INFO]** `--keep`/세션 앵커 보호 로직 자체는 안전하게 구현됨 (신규 코드, 문제 없음 확인)
  - 상세: `bootstrap-session.sh`의 `bash "$reaper" ${anchor:+--keep "$anchor"}` 패턴을 공백·글롭
    문자가 포함된 anchor 경로로 직접 실행 검증했다 — 외곽 `${anchor:+...}`가 인용되지 않았어도
    내부의 `"$anchor"`가 인용돼 있어 단어분리·글롭전개 없이 하나의 인자로 안전하게 전달된다.
    `is_kept()`의 `grep -qxF --`(고정문자열·전체줄·인자종결자)도 안전. 신규 도입된 `--keep` 관련
    코드에서는 인젝션·경로 조작 취약점을 발견하지 못했다.

- **[INFO]** 확인됨(문제 없음): 하드코딩된 시크릿, SQL/XSS/LDAP 인젝션, 안전하지 않은 암호화, ReDoS
  - 7개 파일 전체에서 API 키/비밀번호/토큰/인증서 패턴을 검색했으나 실제 시크릿은 없음(테스트
    코드에서 매칭된 "token"은 전부 셸 렉서 "토큰"을 가리키는 무관한 단어). 대상 코드는 SQL·HTML
    렌더링·LDAP 질의를 다루지 않아 해당 카테고리는 비적용. 암호화/해시 알고리즘 사용 없음(비적용).
  - `_GIT_PUSH_FALLBACK` 정규식의 ReDoS 가능성을 대량 입력(20만~200만 문자 규모)으로 직접
    실행·측정했으나 선형에 가까운 처리 시간으로 catastrophic backtracking 징후 없음.
  - `.claude/tools/bootstrap-session.sh`의 (이번 diff로 변경되지 않은 기존 블록)
    `npm install --no-fund --no-audit --silent`는 설치 시 `npm audit` 취약점 스캔을 생략한다.
    흔한 관행이고 이번 diff 범위 밖이라 낮은 우선순위로만 기재.

## 요약

이번 diff는 `.claude/hooks/guard_review_before_push.py`의 push 탐지 로직을 원시 정규식에서
shlex 기반 서브커맨드 파서로 재작성해, 직전 리뷰가 찾은 4건의 과소차단(개행 단독 구분, 인용부호
분할, 대소문자, 미등록 글로벌 옵션)을 정확히 막아내며 그 범위 안에서는 테스트도 촘촘하다.
`reap-merged-worktrees.sh`/`bootstrap-session.sh`의 `--keep` 세션 앵커 보호 로직도 인용·인자
처리가 안전해 별도 취약점을 찾지 못했다. 하드코딩된 시크릿, 전형적 웹 인젝션(SQL/XSS/LDAP),
안전하지 않은 암호화 등 다수 OWASP 카테고리는 이 코드베이스 성격(로컬 개발 하네스 도구, 웹
요청·DB 처리 없음)상 비적용이며 실제로도 발견되지 않았다. 그러나 실제 파일을 origin/main과
현재 워킹트리 양쪽에 로드해 동일 입력으로 직접 실행 비교한 결과, **"과소차단 회귀를 닫으려던
이번 수정 자체가 같은 계열의 새 과소차단 회귀를 만들었다"**는 것을 확인했다 — 인용된 커밋
메시지 인자 안의 명령 치환(`$(...)`)이나 백틱은 셸이 실제로 먼저 실행하는데도 `_is_git_push()`는
이를 보지 못하고 `False`를 반환해 REVIEW/PLAN 게이트를 완전히 우회시킨다(`git commit -m
"$(git push)"`, `bash -c "cd /tmp && git push"` 등 6개 명령이 origin/main의 구버전에서는 정확히
차단됐었음을 실측 확인). 이 훅은 스스로 "리뷰되지 않은 코드가 push되는 것을 막는 유일한 하드
게이트"라고 문서화하고 있고 이를 뒷받침할 git 레벨 `pre-push` 훅도 없으므로, 이 회귀는 통제의
핵심 목적을 직접 무력화한다. 같은 계열의 `sh -c`/`bash -c`/`find -exec` 간접 실행 사각지대는
신·구버전 공통이라 이번 diff의 신규 회귀는 아니지만, plan 문서가 `eval` 하나만 의식적 한계로
인정하고 나머지는 언급하지 않아 인지되지 않은 사각지대로 보인다. 두 finding 모두 이 프로젝트가
동일 함수에서 이미 Critical로 취급해 온 결함과 정확히 같은 형태이므로 병합 전 조치를 권장한다.

## 위험도

HIGH
