# 부작용(Side Effect) 리뷰 — 하네스 가드 2건 (세션 앵커 reap + push 가드 오탐)

## 발견사항

- **[WARNING]** `_git_subcommand()`의 exact-string 비교가 트레일링 NUL 바이트를 가진 "push" 토큰을 놓친다 — 구 정규식 대비 실측 회귀 (false negative 방향)
  - 위치: `.claude/hooks/guard_review_before_push.py:186`(`return token` — 첫 non-flag 토큰을 있는 그대로 반환), `:227`(`_git_subcommand(segment) == "push"` exact-equality 비교), `:119`(`_tokenize()` — NUL 을 `punctuation_chars`/`whitespace` 어디에도 포함하지 않아 인접 문자와 한 토큰으로 결합).
  - 상세: `_tokenize()`는 `\x00`을 일반 문자로 취급해 인접 토큰에 그대로 붙인다. 따라서 `"git push\x00 extra"`는 `['git', 'push\x00', 'extra']`로 분해되고, `_git_subcommand()`(186행)는 두 번째 토큰(`'push\x00'`)을 서브커맨드로 그대로 반환하는데, `_is_git_push()`(227행)는 이를 문자열 `"push"`와 **정확히(`==`)** 비교하므로 trailing NUL 때문에 불일치 → `False`(비-push)를 반환한다.

    실측 재현(모듈 직접 로드 + 실제 하네스와 동일한 JSON stdin 서브프로세스 호출 양쪽으로 검증):
    ```python
    guard._is_git_push("git push\x00 extra")   # => False (미탐지)
    guard._tokenize("git push\x00 extra")       # => ['git', 'push\x00', 'extra']
    ```
    end-to-end(`main()` 경로 그대로, `{"tool_input":{"command": "git push"+chr(0)+" extra"}}` payload 를 `guard_review_before_push.py` 서브프로세스 stdin 에 주입)에서도 **exit code 0(ALLOW)** — REVIEW/PLAN 게이트가 아예 평가되지 않는다.

    이는 **구현 전 정규식 대비 실측 회귀**다. 폴백으로 남아있는 `_GIT_PUSH_FALLBACK`(옛 `_GIT_PUSH`)은 `\bpush\b` word-boundary 를 쓰는데, Python `re`의 `\b`는 `\x00`을 비-단어문자로 취급하므로 동일 입력에 **정확히 매칭(차단)**한다 — 새 코드에서만 생긴 blind spot이다:
    ```python
    OLD = re.compile(r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b")
    bool(OLD.search("git push\x00 extra"))  # => True(차단) — 구 코드는 놓치지 않았다
    ```

    **완화 요인(실측, 중요)**: 이 리뷰 도중 동일한 내용을 Bash 툴 자체의 명령 인자로 직접 구성해 실행을 시도하자, Claude Code 하네스 자신의 Bash 툴 입력검증이 `"command contains control characters that would be hidden in the approval dialog"`로 **선제 거부**하는 것을 직접 관측했다. 이는 실제 제품 경로에서 Bash 툴 호출이 이 PreToolUse 훅에 도달하기 **이전에** 이미 제어문자(NUL 포함)를 걸러낼 가능성을 시사하며, 그렇다면 이 blind spot은 표준 Bash 툴 경로로는 도달 불가능한 defense-in-depth 갭에 가깝다. 다만 (a) 이 상위 검증이 이 훅을 트리거할 수 있는 **모든** 경로에 동일하게 적용되는지는 이 저장소 코드만으로 확인 불가하고, (b) 이 훅 자신이 반복해서 표방하는 설계 원칙("가드는 파싱 실패 시 관대해지면 안 된다")과도 어긋난다 — NUL은 셸 실행 시 C-string truncation 때문에 "파서가 본 것"과 "실제로 실행될 것"이 갈라지는 전형적 사례이므로, 기존 `ValueError`(균형 안 맞는 인용부호) 폴백과 같은 급으로 다뤄야 한다.
  - 제안: `_is_git_push()` 최상단(또는 `_tokenize()` 진입 전)에서 명령 문자열에 제어문자(특히 NUL)가 포함되면 `ValueError` 케이스와 동일하게 `_GIT_PUSH_FALLBACK`으로 fail-closed 처리할 것. 상위 하네스의 제어문자 거부에 안전을 암묵적으로 위임하지 않는 defense-in-depth 조치를 권장.

- **[WARNING]** `_git_subcommand()`의 fail-closed 분기 — 흔한 boolean 전역 옵션 뒤에 우연히 "push" 토큰이 있으면 무관한 명령을 오탐 차단 (plan 문서의 "이론적 사례" 서술이 반증됨)
  - 위치: `.claude/hooks/guard_review_before_push.py:148-186`(`_git_subcommand`, 특히 185행 `return "push" if "push" in segment[i+1:] else None`), `plan/in-progress/harness-session-anchor-guards.md:224-234`("잔여 한계" 절, 특히 232행 "이런 옵션은 알려진 git 옵션 중엔 없어 이론적 사례이며").
  - 상세: `_git_subcommand()`는 `_GIT_OPTS_WITH_VALUE`(값을 소비하는 옵션 9개)에 없는 `-`로 시작하는 토큰을 만나면 **즉시** "세그먼트 나머지에 리터럴 `push` 토큰이 있는가"만 보고 fail-closed 판정한다. 이 목록에는 **값을 아예 받지 않는** 흔한 boolean 전역 옵션(`--no-pager`, `--paginate`/`-p`, `--literal-pathspecs`, `--bare` 등, 전부 실존하는 `git(1)` 전역 옵션)이 없어, 이런 옵션이 서브커맨드 앞에 오고 그 뒤 어딘가에 **정확히** "push"라는 독립 토큰이 있으면(브랜치/태그 이름, `--grep` 검색어, 한 단어 커밋 메시지 등) 실제로는 push가 아닌 명령이 오탐 차단된다.

    실측 재현:
    ```python
    guard._is_git_push("git --no-pager commit -m push")   # => True (오탐 — 실제로는 commit)
    guard._is_git_push("git --no-pager log --grep push")  # => True (오탐 — 커밋 이력에서 "push" 검색)
    guard._is_git_push("git --no-pager checkout push")    # => True (오탐 — "push"라는 브랜치 체크아웃)
    guard._is_git_push("git log --grep push")              # => False (--no-pager 없으면 정상 처리)
    guard._is_git_push("git --no-pager log --grep=push")   # => False (인라인 `=` 형태는 "=" in token 분기로 스킵되어 정상)
    ```
    두 번째 사례(`git --no-pager log --grep push`, 커밋 이력에서 키워드 검색)는 이 저장소를 다루는 개발자/에이전트가 **바로 이 PR의 주제**(과거 push 관련 커밋 조사)를 위해 실제로 타이핑할 법한 개연성 있는 명령이다.

    plan 문서는 이 클래스의 결함을 이미 인지하고 "이런 옵션은 알려진 git 옵션 중엔 없어 이론적 사례"라고 기록했다. 그러나 위 재현에 쓰인 `--no-pager`는 **이 PR 자신의 `test_push_detection.py::MUST_BLOCK`에 이미 실존하는 케이스**이고 `-p`/`--paginate`/`--literal-pathspecs`/`--bare`도 모두 `git(1)` 공식 전역 옵션이다 — "이론적"이라는 서술은 반증된다. `_is_segment_boundary`의 "인용이 보호한다"는 반증된 서술을 고친 직전 커밋(`f4489d314`)과 같은 계열의 부채다.
  - 제안: (a) 즉시 조치가 불필요하다면 최소한 plan 문서의 "이론적 사례" 서술을 "`--no-pager` 등으로 재현 가능하지만 안전한(over-block) 방향이라 수용"으로 정정할 것. (b) 코드 수정을 원한다면 `_GIT_OPTS_WITH_VALUE` 곁에 값 없는 boolean 전역 옵션 집합(`{"--no-pager", "--paginate", "-p", "--bare", "--literal-pathspecs", ...}`)을 추가해 `i += 1`로 skip-and-continue 시키면, 진짜 미지의 옵션에 대해서만 fail-closed 범위를 좁힐 수 있다.

- **[INFO]** push 판별 훅이 모든 Bash 호출의 hot path인 채로 substring pre-filter를 제거 — 명령 길이에 선형 비례하는 지연이 대형 heredoc 등에서 관측 가능한 수준까지 커짐, docstring의 "관측 불가" 주장 및 구 성능 리뷰(LOW)의 전제가 최신 코드 기준으로는 재검증 필요
  - 위치: `.claude/hooks/guard_review_before_push.py:190-227`(`_is_git_push`, 특히 198-208행 docstring의 벤치마크 주장과 210행부터 조기-종료 가드 부재), 대비 `review/code/2026/07/17/17_09_10/performance.md:7`("기존에 있던 조기-종료 가드... 그대로 보존한다"는 전제로 LOW 판정).
  - 상세: `_is_git_push()`는 이전에 있던 `"push" not in command` substring pre-filter(빠른 C-level scan)를 완전히 제거하고, 이제 빈 문자열이 아닌 한 매 호출마다 `shlex.shlex()` 기반 순수 파이썬 토크나이저를 무조건 실행한다. 이 훅은 `.claude/settings.json`에 `Bash` matcher로 등록되어 **세션의 모든 Bash 툴 호출**(git 관련 여부 무관)마다 새 프로세스로 실행된다.

    실측(이 리뷰에서 직접 측정):
    ```
    90KB  명령 문자열(heredoc 본문 포함) → 약 30ms
    360KB                              → 약 123ms
    1MB                                 → 약 350~510ms  (선형 스케일, ~0.35us/byte)
    ```
    동일 입력에 대해 구 substring pre-filter는 1MB에서도 1ms 미만(~0.8ms)이었다 — 새 구현은 바이트당 약 500~600배 느리다. docstring의 "~6-24us, 관측 불가" 주장(205-207행)은 **짧은 명령**에는 정확하지만, heredoc으로 큰 파일을 쓰거나 긴 커밋 메시지를 담는(이 저장소 자체가 관례로 권장하는 heredoc 커밋 패턴) 명령에는 적용되지 않는다.

    이전 리뷰 라운드(`review/code/2026/07/17/17_09_10/performance.md`)는 이 훅을 LOW 위험으로 판정하며 "기존에 있던 조기-종료 가드(`"push" not in command`)를 그대로 보존한다"를 명시적 근거로 들었는데, 그 가드는 바로 이어진 Critical #2 수정(따옴표 분할 우회 차단)에서 **제거되었다**. 즉 그 LOW 판정의 전제가 이후 커밋으로 무효화된 채 review 아카이브에 남아있다(아카이브 자체는 시점 스냅샷이라 문제 아님 — 다만 최신 코드 기준 재확인은 안 된 상태). 기능적 정확성에는 영향 없고(선형 스케일, 실제 120초급 툴 타임아웃까지는 여유가 큼), 오탐/미탐 방향의 결함도 아니다.
  - 제안: 조치 불요(정확성 문제 아님). 다만 (a) docstring의 벤치마크 주장에 "대형 임베디드 콘텐츠(heredoc 등)에는 적용 안 됨" 각주를 남기거나, (b) 필요시 매우 긴 명령에 대한 substring 기반 fast-path를 고려. 성능 리뷰어의 최신 코드 기준 재확인을 권장.

## 검증한 항목 (부작용 없음 확인)

- `reap-merged-worktrees.sh`의 `--keep` 옵션: 미지정 시 `keep_paths=""` → `is_kept()`가 항상 거짓을 반환해 기존 동작과 100% 하위 호환(회귀 없음). `is_kept()` 스킵이 `gh_state()`(네트워크 호출) **이전에** 배치되어, kept worktree는 오히려 `gh pr view` 호출이 줄어든다(부작용이 아닌 긍정적 순서). `--help` 렌더링도 직접 실행해 신규 `--keep` 문단이 올바르게 정렬됨을 확인.
- `bootstrap-session.sh`의 `BASH_SOURCE[0]` 기반 anchor 유도: 새 환경변수 읽기/쓰기 없음(`$CLAUDE_PROJECT_DIR` 직접 참조 없이 해석). `${anchor:+--keep "$anchor"}`의 중첩 quote는 bash 파서가 리터럴로 처리하므로 경로에 공백이 있어도 단일 인자로 보존됨(표준 관용구, 인젝션 위험 없음).
- `_is_git_push`/`_GIT_PUSH_FALLBACK`/`_git_subcommand`/`_tokenize`/`_is_segment_boundary` 등 내부 심볼: 리포 전체에서 이 훅 자신과 신규 테스트 외 import/참조 없음(`grep` 확인) — 시그니처 변경의 외부 파급 없음. `guard_review_before_stop.py`는 주석에서만 이 모듈을 언급하며 심볼을 import하지 않음.
- 신규/확장 테스트(`test_push_detection.py`, `test_reap_merged_worktrees.py`) 전부 `tempfile.mkdtemp()` 격리 저장소 + subprocess로만 동작. 실행 전/후 `git status --porcelain`으로 실 리포지토리 상태 무변경 확인(테스트가 실 `.claude/state/reap_last_run` 등 실제 상태를 건드리지 않음).
- 전체 하네스 테스트 스위트(`.claude/tests`, 270건) 통과 확인 — 이번 diff로 인한 광범위 회귀 없음.
- 문서 변경(`worktree-policy.md §7`, `tests/README.md`, plan frontmatter/체크박스): 코드 동작과 대조해 일치. `worktree-policy.md`의 "세션 앵커 — bootstrap-session.sh가 `--keep`으로 전달하는 `$CLAUDE_PROJECT_DIR`" 서술은 코드가 실제로 env var를 읽는다는 뜻이 아니라 앵커의 *의미*를 설명하는 것이며, 바로 다음 문장에서 "앵커는 `BASH_SOURCE`로 유도한다"고 메커니즘을 정확히 구분해 명시하므로 실제 구현과 모순되지 않음.

## 요약

이번 diff는 두 하네스 가드(세션 앵커 reap, push 가드 오탐)를 고치는 선의의 리팩터이며, `reap-merged-worktrees.sh`/`bootstrap-session.sh`의 `--keep` 경로는 하위 호환·네트워크 호출 순서·환경변수 미사용 등 부작용 관점에서 깨끗함을 직접 재현·검증했다(270건 테스트 통과, 실 리포 상태 무변경). 다만 `guard_review_before_push.py`의 핵심 재작성에서 두 건의 새로운 WARNING급 행동 변화를 실측으로 발견했다: (1) NUL 바이트를 포함한 "push" 토큰이 exact-string 비교를 피해가는 실측 회귀(구 정규식은 이를 정확히 차단했었다) — 다만 Claude Code 하네스 자신의 Bash 툴 제어문자 거부를 직접 관측해 실제 도달 가능성은 제한적일 수 있음도 함께 확인했고, (2) `--no-pager` 등 흔한 boolean 전역 옵션과 결합하면 무관한 명령(예: `git --no-pager log --grep push`)을 오탐 차단하는, plan 문서가 "이론적"이라 서술했지만 실제로는 재현 가능한 케이스. 둘 다 이 PR이 이미 채택한 "안전 방향(fail-closed/over-block)" 철학과 궤를 같이 하지만, 전자는 그 철학의 예외(가짜 음성 방향)라는 점에서 방어적 보완이 바람직하고, 후자는 이 PR 자체의 목표(오탐 감소)를 부분적으로 되돌리는 잔여 갭이라 문서·테스트 정정이 권장된다. 추가로 substring pre-filter 제거가 대형 heredoc류 명령에서 이전 성능 리뷰의 LOW 판정 전제를 무효화할 정도의 지연(수백 ms)을 유발함을 실측했으나 정확성에는 영향이 없어 INFO로 기록한다. CRITICAL급(리뷰 없는 push가 조용히 통과하는, 일상적 입력으로 재현되는 결함)은 발견되지 않았다.

## 위험도

MEDIUM
