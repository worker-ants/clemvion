# 요구사항(Requirement) 리뷰

리뷰 대상: `.claude/docs/worktree-policy.md`, `.claude/hooks/guard_review_before_push.py`,
`.claude/tests/README.md`, `.claude/tests/test_push_detection.py`(신설),
`.claude/tests/test_reap_merged_worktrees.py`, `.claude/tools/bootstrap-session.sh`,
`.claude/tools/reap-merged-worktrees.sh`, `plan/in-progress/harness-session-anchor-guards.md`

방법론: diff·전체 파일을 다 읽은 뒤, 실제 저장소의 라이브 파일에 대해 `.claude/tests/` 전체
스위트(264건, 전부 green)를 직접 실행하고, `guard._is_git_push` / `guard._tokenize` /
`guard._git_subcommand` 를 스크래치 스크립트로 직접 호출해 plan 문서가 주장하는 "false negative
양방향 고정" 을 실측으로 검증했다. 아래 CRITICAL 항목은 추측이 아니라 이 세션에서 직접 재현한
사실이다.

## 발견사항

- **[CRITICAL]** `_is_git_push` 가 개행(`\n`)만으로 구분된 다중 `git` 호출을 하나의 세그먼트로
  합쳐버려, 앞선 git 하위커맨드 뒤에 실제로 존재하는 `git push` 를 탐지하지 못한다 — 기존 정규식
  대비 회귀이자, 이번 diff 가 스스로 선언한 "false negative 는 unsafe 방향이라 반드시 막는다" 는
  설계 목표 위반
  - 위치: `.claude/hooks/guard_review_before_push.py:70`(`_SEGMENT_SEPARATORS` — `\n` 미포함),
    `:85-101`(`_tokenize` — `shlex` 의 기본 `whitespace`에 `\n`이 포함돼 있어 `punctuation_chars`
    설정과 무관하게 개행이 항상 공백으로만 소비됨), `:142-149`(`_is_git_push` 의 세그먼트 분리
    루프 — `_SEGMENT_SEPARATORS` 에 없는 토큰은 계속 같은 세그먼트에 누적)
  - 상세: 실측 재현.
    ```
    $ python3 -c "
    import sys; sys.path.insert(0, '.claude/tests'); import _harness
    guard = _harness.load_module_by_path('g', _harness.HOOKS_DIR / 'guard_review_before_push.py')
    print(guard._is_git_push('git add -A\ngit push'))                                    # False
    print(guard._is_git_push(\"git commit -F - <<'EOF'\nmsg\nEOF\ngit push\n\"))            # False
    print(guard._tokenize('git add -A\ngit push'))
    # ['git', 'add', '-A', 'git', 'push']  — 개행이 완전히 사라짐, 세그먼트 경계 없음
    "
    ```
    `_git_subcommand()` 는 병합된 세그먼트 `['git','add','-A','git','push']` 에서 **첫 번째**
    non-flag 토큰(`add`)을 서브커맨드로 반환하고 즉시 리턴하므로, 뒤에 나오는 진짜 `git push` 는
    검사조차 되지 않는다. `git commit -F - <<'EOF' … EOF` 형태의 heredoc 커밋 직후 다음 줄에
    `git push` 를 이어 쓰는 것은 (heredoc 종료 델리미터 줄 뒤에는 `&&` 를 자연스럽게 이어 붙일 수
    없어) **heredoc 커밋과 push 를 한 Bash 호출에 담는 사실상 유일한 자연스러운 문법**이다 —
    실제 bash 로 직접 검증(`bash -x -c '...'`)해 유효한 문법임을 확인했다.

    반대로 **기존(구) 정규식은 이 케이스를 막았다.** `[^&;|]*` 는 개행도 매칭하므로(부정 문자
    클래스는 `re.DOTALL` 과 무관하게 개행을 포함) `git`↔`push` 사이에 개행이 몇 개 있든 끝까지
    탐색해 매칭에 성공한다 — 실측:
    ```
    >>> OLD_REGEX.search("git add -A\ngit push")  # True
    ```
    더구나 이번 diff 를 만든 plan 문서(`plan/in-progress/harness-session-anchor-guards.md:158`)는
    구 정규식의 근본 원인을 **정확히 이 성질**로 진단했다 — "`git` 과 `push` 사이 거리가
    무제한 — `[^&;|]*` 는 **개행도 먹으므로** heredoc 본문까지 넘어간다." 즉 개발자는 "개행을
    건너뛰는 것"을 오탐(heredoc 본문에 등장하는 영어 단어 "push")의 원인으로만 파악했고, 그
    부작용으로 **개행으로만 연결된 진짜 push 를 우연히 잡아주던 효과**까지 함께 사라진다는 점은
    새 구현·새 테스트(`test_push_detection.py`, MUST_BLOCK 14건) 어디에도 반영되지 않았다.
    `_is_git_push` 자체의 docstring("True when the command actually *runs* `git push` in some
    segment")도 이 갭 때문에 과대 주장이 된다(item 4: 의도-구현 괴리).

    영향 범위 확인을 위해 래퍼형 우회도 같이 점검했다 — `time git push` / `nohup git push` /
    `bash -c "git push"` 류는 신·구 코드 **모두** 탐지 못함을 확인했다(구 정규식도 `^`/구분자
    직후에만 `git` 을 앵커링하므로 원래도 못 잡음) — 이건 이번 diff 의 회귀가 아니라 기존
    한계이므로 별도 INFO 로 분리했다. 개행 갭은 그와 달리 **이번 diff 가 새로 도입한 회귀**라는
    점이 핵심이다.
  - 제안: `\n` 을 세그먼트 구분자에 포함시킨다. `shlex` 는 기본 `whitespace`에 `\n` 이 이미
    있어 `punctuation_chars` 에 넣는 것만으로는 부족하고(공백 검사가 punctuation 검사보다
    선행), `lexer.whitespace` 에서 `\n` 을 제거해야 실제로 별도 토큰이 된다. 아래 방향으로 수정
    후 기존 MUST_BLOCK 14건 + MUST_ALLOW 8건 + 신규 개행 3건을 전부 통과시킴을 이 세션에서
    직접 검증했다(무회귀 확인):
    ```python
    def _tokenize(command: str) -> list[str]:
        lexer = shlex.shlex(command, posix=True, punctuation_chars="();<>|&\n")
        lexer.whitespace_split = True
        lexer.commenters = ""
        lexer.whitespace = lexer.whitespace.replace("\n", "")
        return list(lexer)
    ```
    그리고 `_is_git_push` 의 분리 조건을 `token in _SEGMENT_SEPARATORS or (token and set(token) == {"\n"})` 로
    확장(연속 개행은 `shlex` 가 punctuation 런으로 병합해 하나의 `"\n\n"` 같은 토큰이 되므로).
    `test_push_detection.py` 의 `MUST_BLOCK` 에 회귀 테스트로 다음을 추가할 것:
    `"git add -A\ngit push"`, `"git commit -F - <<'EOF'\nmsg\nEOF\ngit push"`.

- **[INFO]** `eval "git push"` 외에도 `bash -c "git push"` / `sh -c 'git push'` /
  `time git push` / `nohup git push` / `command git push` 등 "간접 실행" 계열 전체가 여전히
  탐지되지 않는다 (신·구 코드 동일 — 이번 diff 의 회귀 아님, pre-existing 한계)
  - 위치: `.claude/hooks/guard_review_before_push.py:104-121`(`_git_subcommand` — 세그먼트의
    첫 토큰이 `git` 이 아니면 즉시 `None`)
  - 상세: plan 문서(`harness-session-anchor-guards.md`)는 "`eval "git push"` 는 현행도 이미
    통과시킨다(실측) — 이번 수정의 회귀가 아니다" 라고 `eval` 한 건만 명시한다. 실측 결과 이
    한계는 `eval` 에 국한되지 않고 "git 을 다른 명령의 인자/문자열로 감싸는" 모든 형태로
    넓다(둘 다 구 정규식도 동일하게 놓침 — 대조 확인 완료). 정적 텍스트/토큰 기반 가드의 구조적
    한계이므로 이번 PR 범위에서 고칠 필요는 없지만, "알려진 한계" 서술을 `eval` 한 건에서
    "인터프리터/래퍼로 감싸 실행하는 모든 형태" 로 넓히는 것이 문서 정확도 측면에서 낫다.
  - 제안: (선택) `harness-session-anchor-guards.md` 또는 `guard_review_before_push.py` 모듈
    docstring 의 "알려진 한계" 문구를 `eval` 단일 사례에서 일반화된 서술로 확장.

- **[INFO]** `--keep <path>` 반복 가능("repeatable")이라는 주석/문서 주장이 테스트로 고정되지
  않음(로직 자체는 수동 트레이스로 정확함을 확인 — 버그 아님, 커버리지 갭)
  - 위치: `.claude/tools/reap-merged-worktrees.sh` 인자 파서(`--keep` 분기),
    `.claude/tests/test_reap_merged_worktrees.py`
  - 상세: 파서를 `--keep a --keep b` 로 수동 트레이스하면 `keep_paths` 에 두 경로가 모두
    누적되어 정확히 동작한다. 그러나 `test_reap_merged_worktrees.py` 의 어떤 케이스도 `--keep`
    을 두 번 이상 넘기지 않아, 이 "repeatable" 계약은 코드 리딩으로만 확인되고 회귀 테스트로
    고정되지 않았다.
  - 제안: `--keep A --keep B` 형태로 두 워크트리를 동시에 보호하는 케이스 1건 추가.

- **[INFO]** `--keep` 값이 존재하지 않거나 상대경로여도 사전 검증 없이 `realpath_p` 폴백(원문
  그대로 저장)으로 넘어간다 — 다만 재확인 결과 실제 위험은 없음
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `--keep)` 분기, `realpath_p()`, `is_kept()`
  - 상세: pass 1 은 `case "$wt_path" in "$main_root"/.claude/worktrees/*)` 필터를 먼저 통과한
    실제 워크트리 경로에 대해서만 `is_kept()` 를 호출한다. `--keep` 값이 깨져 있으면 그 결과는
    "보호 실패"(= `--keep` 을 안 준 것과 동일) 이지 "엉뚱한 대상 삭제/차단" 은 아니다. 실제
    운영 경로(`bootstrap-session.sh` 가 `cd … && pwd -P` 로 이미 정규화된 절대경로만 전달, 실패
    시 `anchor=""` 로 `--keep` 자체를 생략)에서는 애초에 이 상황이 발생하지 않는다. 다만
    `worktree-policy.md` 가 "수동 `reap-merged-worktrees.sh [--dry-run] [--keep <path>]`" 를
    1급 사용법으로 문서화하므로 사람이 직접 오탈자 경로를 넘기는 시나리오는 실재한다.
  - 제안: (선택) `--keep` 값이 `$main_root/.claude/worktrees/` 하위가 아니면 경고 로그를
    남기는 정도의 방어적 sanity check. 필수는 아님(재발 원인이었던 사고 시나리오와는 무관).

- **[INFO]** 관련 spec 본문 없음 — 해당 없음, 문서-코드 정합성은 확인함
  - 위치: `spec/` 전체 grep 결과 `reap-merged-worktrees` / `guard_review_before_push` /
    `_is_git_push` 참조 0건
  - 상세: 이번 변경은 전부 하네스 프로세스 컨트롤(`.claude/**`)이며 CLAUDE.md 규약상 제품
    스펙(`spec/`) 대상이 아니라 `.claude/docs/worktree-policy.md` 가 SoT 다. 그 문서 자체가
    이번 diff 에 포함되어 있으므로 "코드 vs 문서" 로 대조했다 — `worktree-policy.md §7` 의
    "사용 중 worktree 제외 — 서로 다른 두 경로(셸 cwd / 세션 앵커)를 모두 제외" 서술은
    `reap-merged-worktrees.sh` 의 실제 skip 로직(cwd 체크 + `is_kept()` 체크, 서로 독립)과
    line-level 로 일치함을 확인했다. `bootstrap-session.sh` 가 `BASH_SOURCE[0]` 기준
    2단계 상위(`../..`)로 앵커를 계산하는 것도 실제 파일 위치(`<worktree>/.claude/tools/
    bootstrap-session.sh`) 와 정확히 일치한다.

## 기능 완전성 관점 — 그 외 확인 사항

- `.claude/tests/test_reap_merged_worktrees.py` 신규 8건 + 기존 9건, 전부 green (17/17,
  실측 실행). `--keep` 이 cwd 스킵과 독립적으로 동작하는지, 접두어 공유 워크트리를 오보호하지
  않는지(`wt-a` vs `wt-a-2`, `grep -x` whole-line 매칭 확인), dry-run 이 실제 변경을 만들지
  않는지, bootstrap→reaper 엔드투엔드까지 모두 커버되어 있고 실제로 검증됐다.
- `.claude/tests/test_push_detection.py` 신규 7건, 전부 green — 그러나 위 CRITICAL 항목이
  보여주듯 "green" 이 "false negative 완전 차단" 을 보장하지 않는다. 전체 하네스 스위트
  (`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`) 264건도 전부 green.
- `plan/in-progress/harness-session-anchor-guards.md` 의 검증 체크리스트(①·② 각 3항목)는
  스스로 정의한 A–E 케이스 범위 안에서는 실제로 전수 충족되어 있다(체크박스 허위 아님) — 이번
  리뷰에서 찾은 개행 갭은 그 스코프 **밖**에서 새로 발견된 케이스이며, plan 자체의 자기 검증이
  틀렸다는 뜻은 아니다.
- 반환값: `_is_git_push`/`_tokenize`/`_git_subcommand` 모두 모든 경로에서 명시적 값을 반환한다
  (예외 경로 포함, `ValueError` 만 의도적으로 catch). TODO/FIXME/HACK/XXX 마커는 변경된 8개
  파일 전체에서 0건.

## 요약

reap 쪽 변경(①, 세션 앵커 보호)은 실제로 발생했던 가용성 사고를 정확히 재현하는 테스트로 뒷받침되며
구현·테스트·문서(`worktree-policy.md`) 삼자가 line-level 로 정합해 완성도가 높다. 반면 push 가드
재작성(②)은 diff 가 명시적으로 표방한 목표("두 가지 오탐(B/C) 을 없애면서 false negative 는 만들지
않는다")를 실제로는 달성하지 못했다 — 개행으로만 이어진 다중 `git` 호출(특히 heredoc 커밋 직후
줄바꿈으로 이어지는 `git push`, 이런 형태를 한 Bash 호출에 담는 사실상 유일한 자연스러운 문법)에서
진짜 `git push` 를 탐지하지 못하는 회귀가 실측으로 확인됐고, 이는 구 정규식이 우연히 막고 있던
동작이 새 구현에서 사라진 것이다. 신설 테스트 스위트가 전부 green 임에도 이 갭은 전혀 커버되지
않는다. 이 가드는 CLAUDE.md 가 "리뷰 없이는 push 불가" 로 명시하는 프로젝트 전역 hard gate 이므로,
이 한 가지 실패 모드가 코드베이스 전체의 "구현 후 자동 review 강제" 안전망을 조용히 무력화할 수
있다는 점에서 파급력이 크다. 구체적이고 검증된 수정 방향(개행을 세그먼트 구분자에 포함)을 함께
제시했으며, 기존 MUST_BLOCK/MUST_ALLOW 22건 전체에 대해 무회귀임을 이 세션에서 직접 확인했다.

## 위험도

CRITICAL
