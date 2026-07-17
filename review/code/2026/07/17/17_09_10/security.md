# 보안(Security) 리뷰

리뷰 대상: `.claude/docs/worktree-policy.md`, `.claude/hooks/guard_review_before_push.py`,
`.claude/tests/README.md`, `.claude/tests/test_push_detection.py`,
`.claude/tests/test_reap_merged_worktrees.py`, `.claude/tools/bootstrap-session.sh`,
`.claude/tools/reap-merged-worktrees.sh`, `plan/in-progress/harness-session-anchor-guards.md`

이번 변경은 하네스(Claude Code 에이전트) 자체의 두 가드를 고친다: ① 세션 앵커 워크트리가
GC reaper 에 삭제되는 가용성 결함, ② `git push` 오탐지(false positive) 를 줄이려는 push 게이트
재작성. 애플리케이션 코드(`codebase/**`)가 아니라 하네스 프로세스-무결성 컨트롤이지만,
`guard_review_before_push.py` 는 이 리포지토리 CLAUDE.md 가 명시하는 "리뷰 없이는 push 불가"
**hard gate** 이므로 인가(authorization) 성격의 컨트롤로 간주해 검토했다. 아래 CRITICAL 항목은
전부 실제 코드에 대해 직접 실행/재현하여 확인한 사실이다(추측 아님).

## 발견사항

- **[CRITICAL]** push 검토 게이트(`_is_git_push`)가 최소 3가지 방법으로 완전히 우회된다 — REVIEW/PLAN 게이트가 아예 호출되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:133-134`(원시 substring 사전 필터),
    `:110`(`_git_subcommand` 의 `os.path.basename(segment[i]) != "git"` 대소문자 비교),
    `:63-66`(`_GIT_OPTS_WITH_VALUE` 화이트리스트), `:198`(`if not _is_git_push(command): return 0` — 우회 시 REVIEW/PLAN 게이트 자체가 스킵됨)
  - 상세: 이번 diff 는 `_is_git_push` 를 "문자열에 어딘가 push 가 있는가" 에서 "파싱된 git
    서브커맨드가 push 인가" 로 재작성해 기존 오탐(B: 따옴표 안 `\|`, C: 커밋 메시지 속 "push")을
    없앴다고 주장하고, 신설 `test_push_detection.py` 의 docstring 은 "false negative 는 unsafe
    방향" 이라며 양방향을 모두 고정했다고 밝힌다. 그러나 아래 3가지는 실제로 `git push` 를
    실행하면서도 `_is_git_push()` 가 `False` 를 반환해 REVIEW/PLAN 게이트를 완전히 건너뛰는
    경우이며, 새 테스트 스위트 어디에도 커버되지 않는다. 전부 이 세션에서 직접 재현했다:

    **(a) 인용부호 분할(quote-splitting) — 사전 substring 필터를 우회.**
    `_is_git_push()` 의 첫 줄 `if not command or "push" not in command: return False` 는
    **토큰화 이전** 원시 문자열에서 "push" 부분문자열을 찾는다. bash 는 인접한 따옴표 구간을
    하나의 단어로 병합하므로(`'pu''sh'` → `push`), 원시 문자열에는 "push" 라는 연속 부분문자열이
    없지만 셸이 실행하면 정확히 `git push` 가 된다. 실측:
    ```
    $ set -- git 'pu''sh' --force ; echo "$1 $2 $3"
    git push --force
    $ function git() { echo "FAKE-GIT-CALLED-WITH: $*"; }; git 'pu''sh' --force
    FAKE-GIT-CALLED-WITH: push --force
    >>> guard._is_git_push("git 'pu''sh' --force")
    False
    ```
    즉 `git 'pu''sh' --force` 는 실제로 `git push --force` 를 실행하지만 게이트는 이를
    "push 아님" 으로 판단해 `main()` 이 `return 0` 으로 즉시 통과시킨다(REVIEW/PLAN 게이트 미실행).
    이 필터를 우회하면(직접 `_tokenize`+`_git_subcommand` 호출) 이번 diff 가 새로 만든 토크나이저
    자체는 정확히 `push` 를 인식한다 — 즉 결함은 새 토크나이저가 아니라 **그 앞을 막고 있는
    원시 substring 사전 필터 한 줄**이다.

    **(b) `git` 런처 이름 대소문자 — `os.path.basename(...) != "git"` 이 대소문자 구분.**
    본 리뷰 환경(Platform: darwin, 기본 APFS 대소문자 비구분)에서 실측:
    ```
    $ which GIT
    /usr/bin/GIT
    $ GIT status   # 실제 git 바이너리가 대소문자 무시 파일시스템 조회로 실행됨
    (정상 동작)
    >>> guard._is_git_push("GIT push")
    False
    ```
    `GIT push` 는 원시 substring 필터는 통과하지만("push" 리터럴이 존재), `_git_subcommand()` 의
    `os.path.basename("GIT") != "git"` 비교가 대소문자 구분이라 `None` 을 반환 — git 호출 자체를
    인식하지 못한다. macOS(및 기본 설정 Windows)의 대소문자 비구분 파일시스템에서 `GIT push` /
    `Git push` 는 셸이 문제없이 실제 git 을 실행하지만 게이트는 무조건 통과시킨다.

    **(c) `_GIT_OPTS_WITH_VALUE` 화이트리스트 누락 — 분리 토큰 값을 갖는 실제 git 글로벌 옵션.**
    로컬 git 버전(2.50.1)으로 실측:
    ```
    $ git --attr-source main rev-parse --abbrev-ref HEAD   # 공백 분리 형태도 정상 동작
    claude/harness-session-anchor-guards-611d98
    >>> guard._tokenize("git --attr-source main push")
    ['git', '--attr-source', 'main', 'push']
    >>> guard._git_subcommand([...])  # "main" 을 서브커맨드로 오판정
    'main'
    >>> guard._is_git_push("git --attr-source main push")
    False
    ```
    `--attr-source <tree-ish>` 는 실제로 존재하고 공백-분리 형태를 지원하는 git 글로벌 옵션인데
    `_GIT_OPTS_WITH_VALUE`(`.py:63-66`) 에 없다. 값 토큰(`main`)이 서브커맨드로 오인되어 그 다음
    진짜 서브커맨드(`push`)는 아예 검사되지 않는다. 이 화이트리스트는 "이 안에 없으면 값이 아니라
    다음 토큰이 서브커맨드" 라는 **닫힌 목록** 설계라, git 버전이 새 글로벌 옵션을 추가할 때마다
    구조적으로 뒤처질 수 있는 fail-open 설계다.

    세 경우 모두 `.claude/tests/test_push_detection.py` 의 `MUST_BLOCK` 목록에 없어 현재
    테스트는 전부 통과한다(`python3 -m unittest discover -s .claude/tests -p
    'test_push_detection.py'` → `OK`, 7/7) — 즉 "false negative 를 양방향 다 고정했다"는
    스위트의 주장과 달리 회귀 방지가 되지 않는 잔여 우회가 존재한다.
  - 제안:
    1. `_is_git_push()` 의 원시 substring 사전 필터(`"push" not in command`) 를 제거하거나,
       최소한 토큰화 이후 결과에 대해서만 사용한다 — 커맨드 문자열 길이는 짧고 hook 은 매
       Bash 호출마다 한 번뿐이므로 성능상 사전 필터가 꼭 필요하지 않다. (b)/(c) 를 막기 위해서도
       결국 모든 커맨드가 토크나이저에 도달해야 한다.
    2. `_git_subcommand()` 의 `os.path.basename(segment[i]) != "git"` 비교를 대소문자
       비구분 파일시스템을 고려해 정규화(`.lower()`)하거나, 최소한 `git`/`GIT`/`Git` 등 흔한
       변형을 인식하도록 완화한다 — git 서브커맨드 자체(`push`)의 비교는 대소문자 구분을 유지해도
       무방하다(git 은 대문자 서브커맨드를 인식하지 않으므로).
    3. `_GIT_OPTS_WITH_VALUE` 를 fail-safe 방향으로 뒤집는다: 알려진 "값을 받지 않는" 플래그
       목록(`-p`/`--paginate`/`--no-pager`/`--bare`/`-P`/`--no-replace-objects` 등)만 화이트리스트로
       두고, 그 외 `-`로 시작하는 미지의 옵션을 만나면 **차단 방향**(예: 세그먼트를 전체
       "확인 불가 → `_GIT_PUSH_FALLBACK` 로 폴백해 보수적으로 판단")으로 처리한다. 지금처럼
       "모르는 옵션은 값 없는 플래그로 간주" 는 새 git 옵션이 추가될 때마다 조용히 fail-open 된다.
    4. `test_push_detection.py` 의 `MUST_BLOCK` 에 위 (a)(b)(c) 세 케이스를 회귀 테스트로 추가한다
       — 특히 (a)(b) 는 git 버전에 의존하지 않는 결정론적 셸 동작이라 우선순위가 높다.

- **[INFO]** `reap-merged-worktrees.sh` 의 `--keep <path>` 인자가 실제 워크트리 경로인지 사전 검증하지 않음
  - 위치: `.claude/tools/reap-merged-worktrees.sh` 인자 파서(`--keep` 분기), `is_kept()`
  - 상세: `--keep` 값은 존재 여부·`.claude/worktrees/` 하위 여부를 검증하지 않고 그대로
    `realpath_p` 후 저장한다. 다만 실제 삭제 로직(pass 1)은 `case "$wt_path" in
    "$main_root"/.claude/worktrees/*)` 필터를 먼저 통과한 항목에 대해서만 `is_kept()` 를
    호출하므로, 이 필터를 거친 검증된 워크트리 경로 집합 밖에서 `--keep` 값이 실제로 위험한
    영향을 주는 경로는 확인되지 않았다(악용 불가 확인, 실제 취약점 아님).
  - 제안: 방어적 코딩 관점에서 `--keep` 값이 `$main_root/.claude/worktrees/` 하위가 아니면
    경고 후 무시하는 sanity check 를 추가하면 향후 호출부 변경 시에도 안전성이 명시적으로
    보장된다. 필수는 아님.

- **[INFO]** `bootstrap-session.sh` 의 앵커 계산 실패가 조용히 무시됨
  - 위치: `.claude/tools/bootstrap-session.sh` — `anchor=$(cd ... && pwd -P) || anchor=""`
  - 상세: `BASH_SOURCE[0]` 기반 `cd` 가 실패하면(예: 이례적인 권한/마운트 문제) `anchor=""` 가
    되어 `${anchor:+--keep "$anchor"}` 가 `--keep` 자체를 생략한다 — 이 세션은 이번 PR 이 고치려는
    "세션 앵커 reap" 취약 상태로 조용히 되돌아간다. 에러/경고 로그가 없어 운영자가 인지하기 어렵다.
    보안 취약점이라기보다 가용성 회귀의 관측 가능성(observability) 문제.
  - 제안: `anchor` 계산 실패 시 stderr 로 경고 한 줄만 남기면 향후 디버깅 비용을 줄일 수 있다.
    Blocking 은 부적절(SessionStart 훅은 항상 exit 0 이어야 한다는 기존 원칙과 일치).

## 검증한 항목 (문제 없음)

- `bootstrap-session.sh` 의 `bash "$reaper" ${anchor:+--keep "$anchor"}` — 중첩 따옴표 관용구가
  공백 포함 경로에서도 정확히 2개 인자(`--keep`, 전체 경로)로 분리됨을 실측 확인(`argc=2`). 인자
  주입/워드 스플리팅 문제 없음.
- `reap-merged-worktrees.sh` 의 `is_kept()`(`grep -qxF --`), `git branch -d/-D --` 는 `-`로
  시작하는 브랜치명/경로가 플래그로 오인되지 않도록 `--` 가드가 이미 적용되어 있어 인자 주입에
  안전. `-x`(whole-line) 매칭이라 `wt-a` 가 `wt-a-2` 를 오탐 보호하지 않음(신설 테스트로 확인).
  물리 경로(`pwd -P`) 정규화로 `/var`↔`/private/var` 심볼릭 링크 불일치도 방지.
  `.claude/tools/reap-merged-worktrees.sh`/`bootstrap-session.sh` 변경 자체는 이전에 실제로
  발생한 세션 wedge 사고(하네스 훅이 로드되지 않아 Bash/Write/Edit 전부 차단)를 막는 방어적
  수정으로, 새로 도입된 공격 표면은 없다.
  실제 테스트 스위트도 통과 확인(`python3 -m unittest discover -s .claude/tests -p
  'test_reap_merged_worktrees.py'` → `OK`, 17/17).
- 문서 변경(`worktree-policy.md`, `tests/README.md`, `plan/in-progress/harness-session-anchor-guards.md`)
  은 순수 서술 변경 — 하드코딩된 시크릿, 인젝션 벡터, 민감정보 노출 없음.
- 신규 의존성 없음(`shlex` 는 표준 라이브러리) — `.claude/tests/README.md` 가 명시하는 "harness
  Python 은 서드파티 의존성 0" 컨벤션과 일치.
- 암호화/평문전송 해당 없음(로컬 셸 도구, 네트워크 통신 없음 — `gh` CLI 호출은 기존 인증을 그대로
  사용하며 이번 diff 가 변경하지 않음).

## 요약

이번 변경 중 ①(reap-merged-worktrees.sh/bootstrap-session.sh 의 `--keep` 세션 앵커 보호)은
과거 실제 발생한 가용성 사고를 잘 막는 견고한 수정으로, 인자 주입·경로 순회·심볼릭 링크 문제를
꼼꼼히 방어했고 실측 테스트도 전부 통과했다. 반면 ②(`guard_review_before_push.py` 의 push 탐지
재작성)는 diff 가 명시적으로 목표한 "false negative 제거" 를 달성하지 못했다 — 실제로 `git push`
를 실행하면서도 탐지를 피해가는 3가지 방법(따옴표 분할, 대소문자, git 글로벌 옵션 화이트리스트
누락)을 이번 세션에서 직접 재현했으며, 셋 다 새 회귀 테스트에 없다. 이 push 게이트는 이
리포지토리 CLAUDE.md 가 "리뷰 없이는 shipping 불가" 라고 명시하는 hard gate 이므로, 이 우회는
프로세스 무결성 관점에서 인가 우회에 준하는 영향(비검토 코드가 병합 브랜치로 push 될 수 있음)을
가진다. 다만 exploitation 은 다른 사용자의 데이터·프로덕션 시스템이 아니라 이 하네스 자신의
자기-거버넌스 범위에 한정된다.

## 위험도

CRITICAL
