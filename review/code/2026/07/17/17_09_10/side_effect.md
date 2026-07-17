# 부작용(Side Effect) 리뷰 — 하네스 가드 2건 (세션 앵커 reap + push 가드 오탐)

## 발견사항

- **[CRITICAL]** `guard_review_before_push.py` 재작성이 개행(`\n`)만으로 구분된 멀티라인 명령에서 실제 `git push` 를 놓친다 (탐지 회귀)
  - 위치: `.claude/hooks/guard_review_before_push.py` — `_SEGMENT_SEPARATORS`(전체 파일 385행 부근, 개행 미포함), `_tokenize()`(400–416행), `_is_git_push()` 의 세그먼트 누적 루프(440–465행). 테스트 갭: `.claude/tests/test_push_detection.py` `MUST_BLOCK`(793–809행)에 개행-단독 구분 케이스 부재.
  - 상세: POSIX 셸에서 인용되지 않은 개행은 `;`와 동일하게 명령 구분자로 작동한다. 그런데 새 구현은 `shlex.shlex(command, posix=True, punctuation_chars=True)` + `whitespace_split=True` 로 토큰화하면서 `\n`을 (shlex 기본 `whitespace`에 포함된) 순수 공백으로만 흡수하고 별도 토큰으로 방출하지 않는다. `_SEGMENT_SEPARATORS = frozenset({"&&", "||", ";", ";;", "|", "|&", "&", "(", ")"})` 에도 `"\n"`이 없다. 결과적으로 `git add -A` / `git commit -m …` / `git push` 처럼 각 명령을 **개행으로만** 구분한(대단히 흔한) 멀티라인 명령 문자열은 토큰이 전부 하나의 세그먼트로 합쳐지고, `_git_subcommand()`는 그 세그먼트의 **첫 번째** git 서브커맨드(`add` 또는 `commit`)만 보고 반환해 뒤쪽의 실제 `git push`를 놓친다.

    실측 재현(이 리뷰에서 직접 모듈을 로드해 검증):
    ```python
    guard._is_git_push('git add -A\ngit commit -m "wip"\ngit push')            # => False (놓침)
    guard._is_git_push("git commit -F - <<'EOF'\nmsg\nEOF\ngit push")            # => False (놓침, heredoc 뒤 push 도 동일)
    guard._tokenize('git add -A\ngit commit -m "wip"\ngit push')
      # => ['git','add','-A','git','commit','-m','wip','git','push']  (구분자 토큰 없음, 세그먼트 1개)
    ```
    동일 입력에 대해 **구(舊) 정규식은 정확히 차단했다**(`[^&;|]*` 가 개행도 포함해 매칭하므로) — 즉 이번 리팩터는 실측 가능한 **회귀**다:
    ```python
    OLD = re.compile(r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b")
    bool(OLD.search('git add -A\ngit commit -m "wip"\ngit push'))               # => True (차단)
    ```
    `git add / git commit / git push` 를 각각 별도 줄에 적는 것은 셸 스크립트의 매우 표준적인 관용구이고(오히려 `&&` 체이닝보다 더 흔함), 이 리포지토리의 CLAUDE.md 자체가 heredoc 기반 커밋 예시를 제시할 만큼 heredoc + 후속 명령 패턴이 실제 사용 범위 안에 있다. `guard_review_before_push.py` 의 자체 docstring 은 이 훅을 "리뷰 안 된 codebase/ 변경을 실은 branch 는 push 할 수 없게 만드는 **hard gate**" 로 규정하며, CLAUDE.md 는 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 라고 명시한다 — 이번 회귀는 그 강제 의무의 실제 집행 지점(이벤트 콜백의 발동 조건)을 조용히 무력화한다. 어떤 우회 플래그(`BYPASS_REVIEW_GUARD=1`)도 쓰지 않고, 의도치 않게(공격 목적이 아니어도) 통상적인 멀티라인 커맨드만으로 발생한다는 점에서 심각도가 높다.

    이번 diff 에 함께 추가된 `.claude/tests/test_push_detection.py` 의 `MUST_BLOCK` 14건은 전부 `&&`/`;`/`|`/subshell 구분자만 사용하고 개행-단독 구분 케이스가 하나도 없다. 실제로 하네스 전체 테스트(`python3 -m unittest discover -s .claude/tests`, 264건)를 실행해도 **OK**로 통과하며, 이 회귀는 어떤 기존 테스트로도 검출되지 않는다.
  - 제안: `\n`을 `;`와 동일한 세그먼트 구분자로 취급할 것. 로컬 검증 결과, `lexer.whitespace`에서 `"\n"`을 제거하고 `punctuation_chars`(예: `"();<>|&\n"`)에 추가해 독립 토큰으로 방출시킨 뒤 `_SEGMENT_SEPARATORS`에 `"\n"`을 넣으면 위 두 재현 케이스 모두 정확히 BLOCK 으로 판정됨을 확인했다:
    ```python
    lexer = shlex.shlex(command, posix=True, punctuation_chars="();<>|&\n")
    lexer.whitespace = lexer.whitespace.replace("\n", "")
    lexer.whitespace_split = True
    lexer.commenters = ""
    ```
    다만 이 방향은 heredoc 본문의 각 줄도 별도 세그먼트로 쪼개므로, 본문의 어떤 줄이 `git push …`로 **시작**하는 극단적 케이스에서 새로운(그러나 안전 방향인 = over-block) 과차단이 생길 수 있다 — 이 자체는 기존 fail-safe 철학과 일치하므로 수용 가능하지만 함께 테스트로 고정해야 한다. 최소한 `test_push_detection.py::MUST_BLOCK` 에 `"git add -A\ngit commit -m x\ngit push"`, `"git commit -F - <<'EOF'\n…\nEOF\ngit push"` 같은 개행-단독 케이스를 추가해 재발을 막을 것.

- **[WARNING]** plan 문서의 "참 양성 목록 전수 통과" 완료 표기가 실제로는 개행-구분 케이스를 다루지 않아 완전성 주장이 과장됨
  - 위치: `plan/in-progress/harness-session-anchor-guards.md` — "### 검증" 체크리스트("[x] 참 양성 목록(`git -C`, env prefix, `&&` 뒤, `--force`) 전수 통과 확인") 및 "구현 결과" 서술("거짓 음성을 만들지 말 것 — 이쪽이 안전 방향이다. 아래는 반드시 계속 BLOCK: …").
  - 상세: 위 CRITICAL 항목의 근본 원인과 직결된다. "잔여 한계" 절은 **과차단**(세그먼트 구분자+진짜 push 형태가 커밋 메시지 본문에 있을 때) 방향의 알려진 한계만 기록했을 뿐, **과소차단**(개행-단독 구분으로 실제 push 를 놓치는) 방향은 전혀 언급되지 않는다. "전수 통과 확인" 체크박스가 이미 `[x]` 로 커밋된 상태라, 후속 검토자가 이 게이트를 "검증 완료"로 오판할 위험이 있다.
  - 제안: 위 CRITICAL 수정 반영 후 체크리스트를 재검증하고, "잔여 한계" 절에 개행-분리 케이스(및 그 수정 방향의 트레이드오프)를 명시할 것.

- **[INFO]** `bootstrap-session.sh` 의 앵커 도출이 `.claude/settings.json` SessionStart 항목의 정확한 호출 문자열에 암묵적으로 결합됨 (fail-safe 이지만 문서화되지 않은 결합)
  - 위치: `.claude/tools/bootstrap-session.sh` 의 `anchor=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd -P) || anchor=""` 및 `.claude/settings.json:12` (`"command": "bash \"$CLAUDE_PROJECT_DIR/.claude/tools/bootstrap-session.sh\""`).
  - 상세: `BASH_SOURCE[0]` 기반 앵커 도출은 하네스가 정확히 `bash "$CLAUDE_PROJECT_DIR/.claude/tools/bootstrap-session.sh"` 형태(절대경로, `bash` 직접 호출)로 이 스크립트를 실행한다는 전제 위에 서 있다. 이번 리뷰에서 `.claude/settings.json:12` 를 직접 확인해 현재는 이 전제가 참임을 검증했다. 다만 이 결합이 코드 내 어떤 assertion 으로도 강제되지 않아, 향후 누군가 SessionStart 훅 등록을 다른 방식(래퍼 스크립트 경유, 상대경로, `sh` 사용 등)으로 바꾸면 `anchor` 계산이 조용히 어긋나거나 빈 문자열이 될 수 있다. 다행히 실패 방향은 안전하다 — `anchor=""` 가 되면 `${anchor:+--keep "$anchor"}` 가 통째로 사라져 reaper 는 이번 fix 이전의 cwd-only skip 으로 되돌아갈 뿐, 새로운 위험을 추가하지는 않는다(=이번 fix 가 주는 이득만 조용히 사라짐).
  - 제안: 필수는 아니나, `worktree-policy.md §7` 이나 `bootstrap-session.sh` 주석에 "이 파생은 settings.json 의 호출 형태에 의존한다"는 결합을 명시적으로 남겨, SessionStart 등록 방식을 바꿀 때 함께 검토하도록 유도할 것.

## 검증한 항목 (부작용 없음 확인)

- `reap-merged-worktrees.sh` `--keep` 신규 옵션: 생략 시 `keep_paths=""` → `is_kept()` 는 항상 거짓을 반환해 기존 동작과 100% 하위 호환(회귀 없음). `realpath_p()` 함수 이동은 정의 위치만 앞당긴 것으로 동일 함수 바디, 동작 변화 없음(오히려 `--keep` 파싱 중 호출 가능하도록 만드는 필수 수정). `is_kept()` 는 `grep -qxF`(전체 라인 고정 문자열)로 prefix 오매칭을 차단.
- `_GIT_PUSH` → `_GIT_PUSH_FALLBACK` 심볼 리네임: 리포 전체에서 `_GIT_PUSH` 를 외부에서 import/참조하는 곳 없음(`grep` 확인). `guard_review_before_stop.py` 등 다른 훅은 `guard_review_before_push.py` 를 주석에서만 언급할 뿐 `_is_git_push`/`_GIT_PUSH*` 심볼을 import 하지 않아 시그니처 변경의 파급 없음.
- `test_reap_merged_worktrees.py`/`test_push_detection.py` 신규·확장 테스트: 전부 `tempfile.mkdtemp()` 격리 저장소·서브프로세스 내에서만 git 조작을 수행하며 실 리포지토리·실 홈 디렉토리 상태를 변경하지 않음. `_install_bootstrap` 이 실행하는 실 `bootstrap-session.sh` 사본도 임시 저장소 안에서만 `.githooks`/`mermaid-lint`/state 정리 단계를 스킵하도록 조건이 자연히 막혀 있어(해당 파일·디렉토리가 임시 저장소에 없음) 부작용 없음.
- 문서 변경(`worktree-policy.md`, `tests/README.md`, plan frontmatter/체크박스 갱신): 코드 동작과 대조해 대체로 일치(단, 위 WARNING 항목은 예외).

## 요약

이번 변경 묶음은 두 개의 하네스 가드(세션 앵커 reap, push 오탐)를 고치려는 선의의 리팩터이며, `reap-merged-worktrees.sh` 의 `--keep` 확장과 관련 테스트·문서는 하위 호환을 유지하면서 부작용이 없음을 직접 재현·검증했다. 그러나 `guard_review_before_push.py` 의 핵심 로직 교체는 원래 목표(문자열 매칭 오탐 제거)를 달성하는 과정에서 **개행(`\n`)만으로 구분된 멀티라인 명령의 `git push` 를 탐지하지 못하는 새로운 회귀**를 만들었다 — 실측으로 재현했고, 구 정규식은 동일 입력을 정확히 차단했었다. 이 훅은 리포지토리가 "hard gate" 로 명시한 리뷰-전-push 강제 지점이므로, 이 회귀는 부작용 카테고리 중 "인터페이스/콜백 발동 조건 변경"에 해당하는 가장 심각한 등급의 문제이며, 신설된 회귀 테스트도 이 케이스를 다루지 않아 CI 로도 잡히지 않는다. 이 항목의 수정 없이는 push 하지 않는 것을 권장한다.

## 위험도

CRITICAL
