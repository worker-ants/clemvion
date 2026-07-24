# 보안(Security) 코드 리뷰

## 리뷰 대상
- `.claude/hooks/guard_review_before_push.py`
- `.claude/tests/test_push_guard_worktree_scope.py`
- `.claude/tests/README.md`

## 발견사항

- **[CRITICAL]** `_is_git_push()`의 첫 `_GIT_PUSH.search(command)` 호출이 길이 상한(`_MAX_REDACTION_INPUT`) 검사보다 먼저 실행되어, 특정 형태의 대용량 입력에 대해 **O(n²) 알고리즘 복잡도(ReDoS류) DoS**가 실제로 재현된다.
  - 위치: `.claude/hooks/guard_review_before_push.py:345`~`372` (`_is_git_push` 함수), 특히 `352`(무제한 길이로 첫 `_GIT_PUSH.search` 호출)과 `354`(길이 상한 검사가 그 *뒤*에 옴)
  - 상세: `_is_git_push`는 다음 순서로 검사한다.
    ```
    350  if not command or "push" not in command:
    351      return False
    352  if not _GIT_PUSH.search(command):      # ← 길이 제한 없이 원본 command 전체에 실행
    353      return False
    354  if len(command) > _MAX_REDACTION_INPUT:  # ← 상한 검사는 여기서야 적용됨
    ```
    `_MAX_REDACTION_INPUT`(16 384 bytes) 상한은 두 번째 `_GIT_PUSH.search(_redact_inert_text(command))`(리댁션 경로)만 보호하고, **첫 번째 blind-pass 검색은 전혀 보호하지 않는다**. `_push_targets()`는 스캔 전에 `command = command[:_MAX_REDACTION_INPUT]`로 명시적으로 자르는데(동일 파일 544번째 줄 부근), `_is_git_push`의 첫 검색에는 이 습관이 적용되지 않았다.

    `_GIT_PUSH` 패턴의 `(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"(?:\\.|[^"\\])*"|\S+)\s+)*` 반복 그룹은, 구분자(`;`/`&&`/`|`)로 나뉘고 공백이 전혀 없는 긴 세그먼트가 이어질 때 각 시작 위치마다 `\S+`가 문자열 끝까지 그리디하게 소비된 뒤 `\s+`를 찾지 못해 한 글자씩 백트래킹하는 패턴이 되어, 시작 위치 수 × 백트래킹 길이 = **O(n²)**가 된다. 직접 재현했다(`python3`):
    ```
    n=2000   len=86,004    0.89s
    n=4000   len=172,004   3.62s   (~4x, 길이 2배)
    n=8000   len=344,004   14.47s  (~4x, 길이 2배)
    n=16000  len=688,004   57.69s  (~4x, 길이 2배)
    ```
    길이가 2배가 될 때마다 시간이 ~4배가 되는 것은 정확히 이차식 스케일링이며, 이 파일 자체가 세 차례에 걸쳐 다른 함수들(`_owns_heredoc_as_message`, `_commit_heredoc_spans`, `_MESSAGE_ARG`)에서 이미 찾아 고친 것과 **완전히 동일한 결함 클래스**다. 트리거 조건은 매우 낮다 — `command` 안 어딘가에 리터럴 `"push"` 문자열만 있으면 되고(코드 350줄의 얕은 사전검사), 세미콜론/`&&`/`|`로 구분된 공백 없는 세그먼트가 다수 있으면 충분하다. 에이전트가 실행하는 대형 heredoc/스크립트(예: 외부에서 가져온 콘텐츠를 담은 큰 블록)에서 우연히도, 혹은 프롬프트 인젝션으로 의도적으로 발생 가능하다.
  - 영향: 이 훅은 파일 docstring이 여러 번 강조하듯 **"gates every Bash call synchronously" — 모든 `git push`를 막는 PreToolUse hard gate**다. 이 경로가 멈추면(수십 초~잠재적으로 수 분) 세션이 멎는다. 더 심각하게는, 만약 harness의 PreToolUse hook 실행에 타임아웃이 있고 타임아웃 시 "미검증 → 통과"로 처리된다면(파일 자체가 "any other → treated as runtime error; tool call proceeds (fail-open)"라고 명시), 이 지연은 단순 DoS를 넘어 **리뷰 게이트 자체를 우회하는 수단**이 될 수 있다 — 바로 이 파일의 헤더 주석이 "working bypass of the review gate"라고 부르며 가장 경계하는 실패 형태다. `_worktree_branches`의 `git worktree list` 서브프로세스에 `timeout=5.0`을 명시적으로 건 것(같은 파일 478번째 줄, "a PreToolUse gate that fronts every push"라는 동일한 이유로)과 대비하면, 정작 가장 먼저 실행되는 이 blind regex에는 같은 보호가 빠져 있다는 비대칭이 뚜렷하다.
  - 제안: 길이 상한 검사를 `_is_git_push` 최상단, 즉 `_GIT_PUSH.search(command)`를 처음 호출하기 **전**으로 옮기거나(예: `if len(command) > _MAX_REDACTION_INPUT: return True` 를 350줄 직후로 이동), 최소한 `_push_targets`가 이미 하듯 첫 검색 전에 `command[:_MAX_REDACTION_INPUT]`로 잘라서 검색한다(이 경우 잘린 뒤에도 "push"가 남아있는지 재확인 필요). 리댁션이 필요 없는 detection 경로라도 반드시 같은 상한을 먼저 적용해야, 이 파일이 스스로 세워둔 "커밋을 하나하나 재스캔하지 않는다", "O(n²) 코너를 모두 상한으로 막는다"는 설계 원칙과 일관된다. 자매 훅으로 문서에 언급된 `guard_default_branch_bash.py`(동일 env-value alternation을 공유한다고 docstring이 명시)도 동일 결함 여부를 함께 점검할 가치가 있다(이번 리뷰 스코프 밖이라 직접 확인은 못함).

- **[INFO]** Fail-open 설계 및 `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 환경변수는 리뷰 게이트를 무력화할 수 있는 지점이지만, 파일 docstring·주석에 정책 결정(2026-07-23)으로 명시적으로 문서화되어 있고 로컬 개발자 workflow 상에서 신뢰 경계 밖 행위자가 임의로 조작 가능한 입력이 아니므로 별도 결함으로 보지 않는다. 다만 위 CRITICAL 항목이 실제로는 "fail-open을 유발하는 새로운 트리거"라는 점에서 이 설계의 위험 표면을 넓힌다.
- **[INFO]** `traceback.print_exc(file=sys.stderr)` 및 예외 메시지(`f"{type(exc).__name__}: {exc}"`)가 여러 지점에서 stderr/stdout에 그대로 노출된다. 로컬 CLI 훅이라 외부 네트워크 소비자에게 노출되는 정보는 아니므로 실질 위험은 낮지만, 예외 메시지에 파일 경로 등 내부 구조가 섞여 나올 수 있다는 점은 참고.
- 코드 인젝션/명령 인젝션: `subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, ...)` 등 모든 서브프로세스 호출이 리스트 인자 + `shell=True` 미사용으로 구성되어 셸 인젝션 표면이 없음을 확인했다. `re.escape(delim)`로 heredoc delimiter를 이스케이프하는 등 정규식 조립도 안전하다.
- 하드코딩 시크릿: 없음. 인증/인가: 해당 없음(로컬 git hook, 외부 아이덴티티 시스템과 무관). SQL/XSS/경로 탐색: 해당 없음(파일 I/O는 hook/테스트 자체 경로에 국한, 사용자 입력을 파일 경로로 사용하지 않음). 암호화: 해당 없음. 의존성: 표준 라이브러리만 사용(`re`, `subprocess`, `json`, `inspect`) — 알려진 취약점이 있는 서드파티 의존성 없음.
- 테스트 파일(`test_push_guard_worktree_scope.py`)은 실제 임시 git repo/subprocess를 사용하지만 모두 로컬 `tempfile.mkdtemp()` 안에서 격리되어 있고, 커맨드 인자는 리스트 형태로만 구성되어 인젝션 표면이 없다. `README.md`는 문서 변경으로 보안 영향 없음.

## 요약
이 세 파일은 로컬 개발 harness의 "push 전 리뷰 강제" 게이트를 다루며, 전형적인 웹 애플리케이션 보안 취약점(SQLi/XSS/인증 우회/시크릿 하드코딩 등)은 발견되지 않았다. 그러나 핵심 검출 함수 `_is_git_push()`가 자신이 명시한 "상한을 우회 없이 항상 먼저 적용한다"는 설계 원칙을 스스로 어겨, 길이 제한 없이 원본 `command` 전체에 대해 O(n²) 정규식 매칭을 먼저 수행한다. 재현 테스트로 688KB 입력에서 약 58초의 지연을 실측했으며, 이는 "모든 Bash 호출을 동기적으로 게이팅"하는 보안 임계 훅에서 세션 정지 또는 (harness의 hook 타임아웃 처리 방식에 따라) 리뷰 게이트 자체의 fail-open 우회로 이어질 수 있는 CRITICAL 결함이다. 이 파일이 이미 세 차례에 걸쳐 동일 클래스의 버그(초선형 정규식 스캔)를 다른 함수에서 찾아 고쳤다는 이력을 감안하면, 같은 원칙(길이 상한을 스캔 이전에 적용)을 첫 blind-pass 검색에도 일관되게 적용하는 수정이 필요하다.

## 위험도
CRITICAL
