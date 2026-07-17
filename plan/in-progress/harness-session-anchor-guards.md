---
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-17
owner: developer
---

# 하네스 가드 2건 — 세션 앵커 reap + push 가드 오탐

> 발견 경위: `claude/report-paths-shared-0edbf0` 작업 중 두 건 모두 **실제로 밟았다**.
> ①은 세션을 완전히 wedge 시켜(모든 Bash·Write 차단) 하네스가 워크트리를 recycle 해야 복구됐고,
> ②는 `git commit` 을 막아 커밋 메시지를 파일로 빼는 우회를 하게 만들었다.
> 둘 다 이 저장소 코드의 결함이며, 아래 진단은 전부 **재현 실측**이다.

## Overview

독립된 두 결함이지만 **같은 계열**이다 — 가드가 *진짜 대상* 대신 *대리 지표* 를 평가한다.

| # | 결함 | 대리 지표 | 진짜 대상 |
| --- | --- | --- | --- |
| ① | reaper 가 세션 앵커 워크트리를 삭제 | 셸 cwd (`git rev-parse --show-toplevel`) | `$CLAUDE_PROJECT_DIR` (훅 스크립트 앵커) |
| ② | push 가드가 push 아닌 명령을 차단 | 명령 **문자열** 정규식 | 파싱된 **git 서브커맨드** |

①은 가용성 사고(세션 사망), ②는 신뢰성 사고(가드가 틀리면 사람이 우회를 학습한다).
`review_guard` 가 push 대상이 아니라 셸 cwd 를 평가하는 기존 이슈와도 같은 뿌리다.

---

## ① reaper 가 세션의 `$CLAUDE_PROJECT_DIR` 워크트리를 삭제한다

### 증상

`manual-trigger-default-param-e0d395` 워크트리가 PR #958 머지 후 SessionStart 에서 자동 reap 됐다.
그런데 그게 **그 세션의 `$CLAUDE_PROJECT_DIR`** 였다. 직후 모든 도구가 죽었다:

```
PreToolUse:Bash  hook error: can't open file '.../manual-trigger-default-param-e0d395/.claude/hooks/guard_review_before_push.py'
PreToolUse:Write hook error: can't open file '.../manual-trigger-default-param-e0d395/.claude/hooks/guard_default_branch_edit.py'
```

모든 훅이 `$CLAUDE_PROJECT_DIR/.claude/hooks/*.py` 로 실행되므로 **Bash·Write·Edit 전부 차단**.
`git worktree add` 로 되살리려 해도 그게 Bash 라 **순환**이다. 세션 자력 복구 불가.

### 근본 원인 (실측)

reaper 에는 current-worktree skip 이 **있다**. 문제는 그게 **셸 cwd** 를 본다는 것이다:

- `.claude/tools/reap-merged-worktrees.sh:75` — `current_top=$(git rev-parse --show-toplevel)`
- 같은 파일 171–172행 — `[ "$wt_path" = "$current_top" ]` 이면 skip
  (주석: *"That skip is the PRIMARY guard against deleting the worktree we are running in"*)
- **`grep -c CLAUDE_PROJECT_DIR reap-merged-worktrees.sh` → `0`.** 앵커 개념 자체가 없다.

평소엔 cwd == 앵커라 이 skip 이 우연히 앵커도 보호한다. 그러나 **`EnterWorktree` 로 다른 워크트리에
들어가면 둘이 갈라진다**. 그 순간 reaper 는 *엉뚱한 쪽*(현재 cwd)을 보호하고 앵커를 지운다.

발동 조건 — 특수 상황이 아니라 **정상 워크플로**다:

1. 세션이 워크트리 A 에서 시작 (`$CLAUDE_PROJECT_DIR` = A)
2. `EnterWorktree` 로 B 로 이동 (셸 cwd = B) ← developer SKILL 이 bg 세션에 **권장**하는 정석
3. A 의 PR 이 머지됨
4. 다음 SessionStart → bootstrap → reaper 가 cwd(B)만 skip → **A 삭제** → 세션 사망

즉 **머지된 PR 의 워크트리에서 시작해 다른 워크트리로 옮긴 세션은 compact 마다 죽는다.**

### 왜 `$0` 로는 못 고치나

reaper 는 **main 체크아웃 경로로** 호출된다 — `bootstrap-session.sh:58-60`:

```bash
reaper="$main_root/.claude/tools/reap-merged-worktrees.sh"
bash "$reaper" || true
```

따라서 reaper 안에서 `$0`/`BASH_SOURCE` 는 main 체크아웃을 가리키지 앵커가 아니다.
bootstrap 자신도 `main_root` 를 `git rev-parse --git-common-dir`(cwd 기반, `:21-22`)로 구하므로
역시 앵커를 모른다. **앵커는 밖에서 주입되어야 한다.**

### 수정안 (권장: B)

| 안 | 방법 | 평가 |
| --- | --- | --- |
| A | reaper 가 `$CLAUDE_PROJECT_DIR` 환경변수를 직접 읽어 skip 집합에 추가 | 가장 단순. **단 훅 env 에 그 변수가 실제로 있는지 미검증** — 선행 확인 필요 |
| **B** | **bootstrap 이 `BASH_SOURCE` 로 앵커를 유도해 `--keep <path>` 로 전달** | **env 의존 없음.** 하네스가 `bash "$CLAUDE_PROJECT_DIR/.claude/tools/bootstrap-session.sh"` 로 호출하므로 `BASH_SOURCE[0]` 이 곧 앵커 경로다 |
| C | reaper 가 모든 워크트리를 보수적으로 skip | 청소 기능 자체를 무력화. 기각 |

**B 권장 이유**: 하네스가 bootstrap 을 *절대경로로 interpolate 해서* 호출한다는 사실이 이미 계약이다
(그래서 앵커가 죽으면 bootstrap 도 못 뜬다). 그 경로를 그대로 되읽는 것이라 새 가정을 추가하지 않는다.
A 는 더 짧지만 "훅 env 에 변수가 있다"는 **미검증 가정** 위에 선다 — Bash 툴 셸에서는 `unset` 이었다
(그건 훅이 아니므로 반증은 아니지만, 확인 없이 의존할 수는 없다).

구현 스케치:

```bash
# bootstrap-session.sh
anchor=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P) || anchor=""
bash "$reaper" ${anchor:+--keep "$anchor"} || true
```

```bash
# reap-merged-worktrees.sh — 인자 파서는 이미 있다 (:53-63, 미지 인자는 exit 2)
--keep) shift; [ -n "${1:-}" ] && keep_paths="$keep_paths$(realpath_p "$1")\n" ;;
# 171행 skip 조건에 keep_paths 포함 검사 추가
```

### 알려진 한계 (범위 밖, 문서화만)

reaper 는 **자기 세션의 앵커만** 알 수 있다. 동시에 열린 다른 세션이 워크트리 C 에 앵커돼 있고
C 의 PR 이 머지되면 그 세션은 여전히 죽는다. 근본 해결은 "살아있는 세션의 앵커 레지스트리"가
필요해 과하다. 하네스가 워크트리를 recycle 해 복구시켜 주는 것이 관측됐으므로(이번 사례) 수용 가능.

### 검증

- [x] 회귀 테스트: 앵커 A + cwd B 인 상태를 재현해 A 가 살아남는지 (`--dry-run` 으로 삭제 목록 검사)
- [x] 기존 동작 유지: 머지된 무관 워크트리는 여전히 reap 되는지
- [x] cwd == 앵커 인 평범한 세션에서 이중 skip 이 오작동 안 하는지

**구현 결과**: 안 B 채택. `bootstrap-session.sh` 가 `BASH_SOURCE[0]` 로 앵커를 유도해
`--keep <anchor>` 로 전달하고, reaper 는 pass 1 에서 cwd skip 과 **별개로** keep 집합을 검사한다.
전제 재확인 완료 — `.claude/settings.json` SessionStart 는 실제로
`bash "$CLAUDE_PROJECT_DIR/.claude/tools/bootstrap-session.sh"` 로 호출하므로 `BASH_SOURCE[0]` 이 곧 앵커다.

테스트는 `.claude/tests/test_reap_merged_worktrees.py` 에 관련 테스트 일체 추가(정확한 현재
건수는 파일을 직접 세는 것이 SoT — 이후 세션에서 커버리지가 늘 때마다 본문의 하드코딩된 숫자가
rot 하는 문제가 실제로 반복됐다: 최초 8건→직전 리뷰 실측 9건→WARNING #2 조치 커밋으로 10건까지
벌어진 뒤에야 정정. review/code/2026/07/17/18_04_20 INFO #2). 핵심 두 가지:

- **bootstrap 을 실제로 구동하는 end-to-end 1건** — reaper 만 단위 테스트하면 bootstrap 이 `--keep`
  전달을 빠뜨려도 통과한다(계약의 양쪽 중 한쪽만 고정됨).
- **비-vacuity**: 앵커 worktree 가 dirty 하면 *무관한* dirty skip 이 살려줘 테스트가 헛돈다.
  `_install_bootstrap` 이 bootstrap 을 앵커 브랜치에 커밋해 clean 을 만들고 이를 단언한다.
  최초 추가분 전체가 fix 이전 코드에서 실패함을 확인(대다수는 직접 실패, `--keep` 인자 검증
  테스트 2건은 구 파서의 unknown-arg exit 2 로 통과).

---

## ② push 가드가 push 아닌 명령을 차단한다

### 증상 — 2가지 오탐 (둘 다 모듈 자신의 `_is_git_push` 로 재현)

```
BLOCK  A. 진짜 push (참 양성이어야)      git push -u origin HEAD
BLOCK  B. grep 으로 문자열 찾기          grep -n "...\|git push\|..." <file> | head -6
BLOCK  C. 커밋 메시지에 push 단어        git commit -F - <<'EOF' … "CLI 는 통과인데 push 가 막힌다" … EOF
  ok   D. 메시지에 push 없음             git commit -F - <<'EOF' … 평범한 메시지 … EOF
  ok   E. 파이프 뒤 무관 명령            echo hi | grep push
```

B·C 가 오탐이다. **C 때문에 `git commit` 이 막혔다** — 커밋 메시지에 "push" 라는 단어를 썼다는
이유만으로. 우회는 메시지를 파일로 빼는 것이었는데, **가드가 틀리면 사람이 우회를 학습한다**는 점에서
이게 진짜 비용이다.

### 근본 원인

`.claude/hooks/guard_review_before_push.py:55`:

```python
r"(?:^|&&|;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*git\b[^&;|]*\bpush\b"
```

두 개의 독립 결함이 겹쳐 있다:

1. **`git` 과 `push` 사이 거리가 무제한** — `[^&;|]*` 는 개행도 먹으므로 **heredoc 본문까지 넘어간다**.
   `git commit -F - <<'EOF'` 뒤 메시지 어디에든 "push" 가 있고 그 사이에 `&`·`;`·`|` 가 없으면 매칭(C).
2. **셸 인용을 모른다** — 따옴표 안의 `|` 를 파이프 구분자로 읽는다. `grep "…\|git push\|…"` 의
   `\|` 가 세그먼트 경계가 되고 그 뒤 `git push` 가 매칭(B).

요약하면 **텍스트 매칭으로 셸 문법을 흉내내려다 실패**한 것이다.

### 수정안

"`git` 뒤 어딘가에 push 가 있다" 가 아니라 **"git 의 서브커맨드가 push 다"** 를 판정한다.

- `shlex.split(posix=True)` 로 토큰화 → 따옴표 안의 `|` 는 구분자가 아니게 된다 (B 해소).
- 토큰 수준에서 `&&`·`;`·`|` 로 세그먼트 분리.
- 각 세그먼트에서 env 대입(`FOO=1`)을 걷어내고 명령이 `git` 인지 확인.
- **첫 non-flag 토큰 = 서브커맨드**. `-C <dir>`, `-c <k=v>`, `--git-dir=`, `--work-tree=`,
  `--namespace=`, `--exec-path=`, `-p`/`--paginate`, `--no-pager` 는 건너뛴다.
- `git commit …` → 서브커맨드 `commit` ≠ push → 통과 (C 해소). heredoc 본문은 애초에 서브커맨드가
  아니므로 별도 처리 불필요.

**fail-safe 방향 고정**: `shlex` 가 던지면(따옴표 불균형 등) **현행 정규식으로 폴백해 차단**한다.
가드는 파싱 실패 시 관대해지면 안 된다.

**거짓 음성을 만들지 말 것** — 이쪽이 안전 방향이다. 아래는 반드시 계속 BLOCK:
`git push` / `git -C <dir> push` / `FOO=1 git push` / `a && git push` / `git push --force`.
참고: `eval "git push"` 는 **현행도 이미 통과**시킨다(실측) — 이번 수정의 회귀가 아니다.

### 검증

- [x] 위 5개 케이스(A–E) 를 `.claude/tests/` 회귀 테스트로 고정 — 특히 **C(커밋 메시지)** 와 **B(grep)**
- [x] 참 양성 목록(`git -C`, env prefix, `&&` 뒤, `--force`) 전수 통과 확인
- [x] `shlex` 예외 시 차단으로 폴백하는지 (자가 sabotage 테스트)
- [x] **review 후속** — 아래 "review 후속 수정" 절의 4건(과소차단 회귀) 회귀 테스트化, 수정 전
      코드에서 전부 FAIL 함을 먼저 확인한 뒤 수정(비-vacuity). WARNING #2(`--keep` 다회 지정)·
      WARNING #3(`_GIT_OPTS_WITH_VALUE` 전항목 파라미터화) 커버리지 갭도 마감

**구현 결과**: `.claude/tests/test_push_detection.py` 신설 (14 BLOCK + 8 ALLOW + 폴백·경계 5건).
수정안대로 서브커맨드 판정 + `shlex` 폴백. 계획에 없던 실측 2건을 추가로 반영:

- **`shlex.split()` 은 공백으로만 쪼갠다** — `git add -A;git push` 가 `['a;git','push']` 가 되어
  세그먼트 분리에 실패(거짓 음성). `shlex.shlex(punctuation_chars=True)` 로 `;`·`&&`·`|` 를
  독립 토큰으로 받게 해 해소.
- **`shlex.shlex()` 는 `#` 을 주석 시작으로 본다**(`shlex.split()` 과 다름) — `commenters` 를
  비우지 않으면 `curl http://x/#frag && git push` 의 push 가 삼켜져 거짓 음성.

계획 대비 차이: `(git push)` 는 이제 BLOCK 된다(기존엔 통과). 진짜 push 이므로 안전 방향이며
거짓 음성을 줄인다. `eval "git push"` 는 계획 기록대로 현행·수정 모두 통과 — 이번 수정의 회귀 아님.

#### review 후속 수정 — 과소차단 회귀 4건 (`/ai-review` `review/code/2026/07/17/17_09_10`)

위 "구현 결과" 시점의 체크리스트는 **과차단**(커밋 메시지 오탐 B·C) 방향만 전수 검증했다.
같은 diff 를 리뷰한 3개 에이전트(requirement·security·side_effect)가 독립적으로 **과소차단**
방향의 실측 회귀 4건을 찾아 Critical 로 분류했다 — 전부 "미검토 코드가 push 게이트를 우회"하는
불안전 방향이라 즉시 수정했다(`resolution-applier`, 신규 테스트가 수정 전 코드에서 FAIL 함을
먼저 확인 → 비-vacuity):

| # | 결함 | 원인 | 수정 |
| --- | --- | --- | --- |
| Critical #1 | **개행(`\n`)만으로 구분된 멀티라인 명령**(`git add -A\ngit push`, heredoc-commit 직후 줄바꿈+push 등)에서 실제 push 미탐지. 구 정규식(`[^&;|]*`)은 개행도 매칭해 이 케이스를 정확히 막았었다 — **shlex 재작성의 실측 회귀** | `_tokenize()` 의 `punctuation_chars=True` 기본값(`();<>|&`)에 `\n` 이 없고, shlex 기본 `whitespace`(`' \t\r\n'`)가 개행을 흡수해 전체가 한 세그먼트로 합쳐짐 | `punctuation_chars` 에 `\n` 명시 추가 + `whitespace` 에서 `\n` 제거. 단 `punctuation_chars` 는 *연속된* 구두점을 한 토큰으로 묶으므로(`&&\n` 이 단일 토큰) `_SEGMENT_SEPARATORS` 의 **정확 토큰 일치**로는 여전히 놓친다 — "토큰이 구분자 문자로만 이루어졌는가"로 판정 방식 자체를 교체(`_SEGMENT_SEPARATOR_CHARS` + `_is_segment_boundary()`). `<`/`>` 는 리다이렉트이므로 구분자 문자 집합에서 제외 |
| Critical #2 | **인용부호 분할**(`git 'pu''sh' --force`)이 셸에선 `git push --force` 로 실행되지만, `_is_git_push()` 첫 줄의 **토큰화 이전** 원시 `"push" not in command` 사전 필터가 "push 아님"으로 오판정 → REVIEW/PLAN 게이트 자체가 스킵 | substring 사전 필터가 셸 인용을 모른 채 원시 문자열만 봄 | 사전 필터 제거(hot-path 성능 영향 `timeit` 실측: 대표 명령 6종 평균 tokenize 비용 6~24us, 이 훅이 매 호출 지불하는 python3 기동 비용(~13ms) 대비 3자릿수 작아 무관측) |
| Critical #3 | **`git` 런처 이름 대소문자 비교**(`os.path.basename(...) != "git"`)가 case-sensitive — macOS(APFS 기본 case-insensitive) 에서 `GIT push` 는 셸이 실제 git 을 실행하지만 게이트는 git 호출로 인식조차 못함 | `_git_subcommand()` 의 정확 문자열 비교 | `.lower() != "git"` 로 정규화 |
| Critical #4 | **미등록 글로벌 옵션**(`--attr-source`, git 2.50.1 실존)이 `_GIT_OPTS_WITH_VALUE` 화이트리스트에 없어 값 토큰(`main`)이 서브커맨드로 오판, 그 뒤 진짜 `push` 를 검사 자체를 건너뜀. "모르는 옵션=값 없는 플래그" 라는 닫힌 목록 설계라 git 이 새 글로벌 옵션을 추가할 때마다 구조적으로 fail-open | `_git_subcommand()` 가 미지 옵션을 무조건 "값 없는 플래그"로 가정 | 두 겹: (a) `--attr-source` 를 화이트리스트에 추가(점 patch), (b) **구조적 fix** — `=` 내장값이 없는 미지 옵션을 만나면 "다음 토큰 = 서브커맨드"로 단정하지 않고, 세그먼트 나머지에 `push` 토큰이 있으면 보수적으로 push 로 판정(fail-closed). `--attr-source` 뿐 아니라 *미래의 어떤* 미지 옵션에도 적용되므로 (a) 없이도 이 케이스는 막힌다 — 회귀 테스트에 별도로 고정 |

WARNING #2(`--keep A --keep B` 다회 지정 미검증)·WARNING #3(`_GIT_OPTS_WITH_VALUE` 8개 중 `-C` 만
테스트됨)도 같은 세션에서 함께 마감 — 둘 다 **로직 결함은 아님**(기존 코드가 이미 올바르게
동작), 회귀 방지용 커버리지만 추가.

#### review 후속 수정 2 — 간접 실행 회귀 + WARNING 3건 (`/ai-review` `review/code/2026/07/17/18_04_20`)

바로 위 4건을 고친 커밋 자체가 **같은 계열의 새 회귀**를 재도입했다 — 인용된 인자 안의 명령
치환(`$(...)`)·백틱으로 감싼 `git push` 를 탐지하지 못함(security 리뷰어가 실제 git 서브프로세스로
재현). main 이 직접 실측해 SUMMARY 를 아래처럼 일부 정정한 뒤 `resolution-applier` 로 수정했다
(신규 테스트가 수정 전 코드에서 FAIL 함을 먼저 확인 → 비-vacuity, 차등 테스트 상세는 아래):

| # | 결함 | 원인 | 수정 |
| --- | --- | --- | --- |
| Critical #1 | **인용된 인자 안의 명령 치환/백틱**(`git commit -m "$(git push)"`, 백틱 변형, 중첩 `$(git push $(date))`)이 실제 push 를 감춤 — 셸은 명령 치환을 먼저 평가하므로 REVIEW/PLAN 게이트가 완전히 우회된 채 실제 push 가 실행됨 | 전체 명령 문자열이 `-m` 인자 하나로 인용돼 있으면 그 안의 `$(...)`/백틱이 세그먼트 토크나이저에 아예 보이지 않음(따옴표 안 내용은 통째로 토큰 하나) | `_find_command_substitutions()` — **균형 괄호 스캔**으로 `$(...)`/백틱 구간을 추출해 `_is_git_push()` 재귀 적용. 정규식(`\$\(([^()]*)\)`)이 아닌 이유: 중첩된 `$(git push $(date))` 에서 `[^()]*` 는 안쪽 `(` 를 못 건너뛰어 바깥 span(진짜 `git push` 를 담은 쪽)을 놓친다 |
| (같은 커밋) | **`sh`/`bash`/`zsh`/`dash`/`ksh` 의 `-c` 인자**, **`eval` 의 인자** 도 같은 "간접 실행" 계열 — `bash -c "cd /tmp && git push"`, `bash -c "git push"`, `eval "git push"` | 세그먼트가 인터프리터 이름 뒤 `-c`/`eval` 을 만나도 그 뒤 문자열을 재귀 검사하지 않음 | `_shell_dash_c_argument()`/`_eval_argument()` 로 해당 세그먼트의 스크립트 문자열을 추출해 재귀. **재귀 깊이 상한 4** (`_MAX_RECURSION_DEPTH`) 로 병리적 중첩 방지 |
| WARNING #1 | **NUL 바이트**를 가진 "push" 토큰(`"git push\x00 extra"`)을 놓침 — 구 정규식은 `\b` 가 NUL 을 비-단어문자로 취급해 정확히 차단했었으나 shlex 는 NUL 을 "push" 에 그대로 붙여 exact-string 비교가 깨짐 | `_tokenize()`/`_git_subcommand()` 가 제어문자를 특별 취급하지 않음 | `_is_git_push()` 진입 시 제어문자(단, `\t`/`\n`/`\r` 제외 — heredoc·멀티라인은 정상 콘텐츠) 존재 시 `ValueError` 케이스와 동일하게 `_GIT_PUSH_FALLBACK` 으로 fail-closed |
| WARNING #2 | fail-closed 분기가 **값을 받지 않는 boolean 전역 옵션**(`--no-pager`, `-p`/`--paginate`, `--bare` 등)까지 "미지 옵션"으로 취급해 `git --no-pager log --grep push` 를 무관하게 과차단(실측 재현, plan 의 "이론적 사례" 서술 반증) | `_git_subcommand()` 가 `_GIT_OPTS_WITH_VALUE` 에 없는 옵션을 전부 "값 있을 수도" 로 fail-closed | `_GIT_OPTS_NO_VALUE` 신설(git 2.50.1 실측: `--no-pager`/`-p`/`--paginate`/`-P`/`--bare`/`--literal-pathspecs`/`--glob-pathspecs`/`--noglob-pathspecs`/`--icase-pathspecs`/`--no-optional-locks`/`--no-replace-objects`/`--no-lazy-fetch`/`--no-advice`) — 자기 자신만 skip 하고 계속 스캔. `--exec-path`/`--html-path`/`-h`/`--help` 등은 **의도적으로 제외**(print-and-exit 이거나 다음 토큰을 "이 옵션의 도움말 대상"으로 재해석 — skip-and-continue 모델이 안 맞음) |
| WARNING #3 | `_GIT_OPTS_WITH_VALUE` 독스트링의 "전항목이 분리 토큰 값을 소비한다"는 확언이 `--exec-path`(공백형은 값 소비 안 하고 즉시 조회-종료)·`--super-prefix`(이 git 빌드에서 미인식 옵션, 즉시 거부) 두 항목과 실측이 다름. 직전 커밋 f4489d314(`_is_segment_boundary` 의 반증된 "인용이 보호한다" 서술)와 같은 계열의 "실측 없는 확신에 찬 서술" 부채 | 독스트링 작성 시점에 9개 옵션 전부를 실제 git 서브프로세스로 검증하지 않음 | 독스트링을 실측 기반으로 완화 + 두 옵션에 각주 추가. 기능 변경 불요(두 경우 모두 git 이 서브커맨드 도달 전에 스스로 종료/거부해 fail-closed 구조가 이미 안전망) |

**SUMMARY 자체 정정 기록**: SUMMARY 의 Critical #2 는 `sh -c`/`bash -c`/`find -exec`/프로세스
치환을 "신·구버전 공통 사각지대(이번 diff 의 신규 회귀 아님)"로 분류했으나, main 이 구 정규식을
직접 재실행해 **`bash -c "cd /tmp && git push"` 는 구 정규식이 `&&` 앵커로 이미 차단하고 있었음을
확인** — 즉 이 특정 케이스는 Critical #1 과 동일한 회귀이지 공유 사각지대가 아니다. 위 표의
Critical #1 행이 이를 흡수해 함께 고쳤다. `bash -c "git push"`(구분자 없음)와 `eval "git push"`
는 구 정규식도 못 잡던 진짜 선재 갭이었지만, 같은 재귀 메커니즘으로 두 줄 만에 닫히므로 함께
처리했다(§"잔여 한계" 의 `eval` 관련 서술도 이에 맞춰 정정).

**차등 테스트(differential test)**: `test_push_detection.py::LegacyRegressionDifferentialTest` 가
구 정규식(`_LEGACY_RE`, 회귀 비교용으로 테스트 안에 고정 복제 — SoT 아님)을 MUST_BLOCK·MUST_ALLOW·
간접실행 케이스·평범한 셸 명령 다수로 구성된 코퍼스에 돌려 "구 정규식이 BLOCK 하던 모든 명령은
신 코드도 BLOCK 해야 한다(old ⊆ new)"를 구조적으로 고정한다. 위반이 발견되면 짧은 명시적 예외
목록(현재 4가지 형태 — 커밋 메시지가 push 를 언급만 함·인용된 grep 의 `\|`·`git config alias.p
push`·WARNING #2 의 boolean 옵션)에 있을 때만 허용하고 아니면 FAIL. 수정 전 코드에서 이 테스트가
정확히 이 세션의 회귀 6건(위 표의 명령 치환/백틱/중첩/`bash -c "cd /tmp && ..."` 4건 + NUL 바이트
1건 + `deploy: $(git push origin main)` 변형 1건)을 예외 목록 밖으로 잡아내는 것을 확인했다 —
같은 계열의 회귀가 앞으로 또 나와도 사람이 사례를 미리 나열하지 않아도 구조적으로 잡힌다.

**잔여 한계 (트레이드오프, 수용 — 정적 토큰 기반 가드의 구조적 한계 전반)**:

- 커밋 메시지 본문·heredoc 본문의 **한 줄이 그 자체로 `git push` 명령처럼 보이면** 여전히 BLOCK
  된다(예: 커밋 메시지 안에 리터럴로 `git push` 로 시작하는 줄이 있는 경우). shlex 는 heredoc
  문법을 모르므로 본문도 동일하게 토큰화되기 때문 — over-block = fail-safe 방향이라 수용
  (Critical #1 수정 이전부터의 성질과 동일선상).
- Critical #4 의 구조적 fail-closed 로 인해, **미지의 글로벌 옵션 뒤에 우연히 "push" 라는 단어가
  값으로 온 비-push 명령**은 실제로는 push 가 아님에도 BLOCK 될 수 있다. ~~이런 옵션은 알려진 git
  옵션 중엔 없어 이론적 사례이며~~ — **반증됨**(review 후속 수정 2, WARNING #2): `--no-pager` 가
  정확히 이 모양으로 실재했다. 지금은 known-boolean 옵션 집합(`_GIT_OPTS_NO_VALUE`)으로 좁혔으나,
  그 집합에 없는 *미래의* 미지 옵션에 대해서는 여전히 같은 트레이드오프가 남는다 —
  false positive(불편) 방향이라 false negative(미검토 push 통과)보다 안전하게 수용.
- **`$(...)`/백틱이 단따옴표 안에 있어도 과차단된다** — 실제 셸은 단따옴표 안의 명령 치환을
  평가하지 않으므로 `git commit -m '$(git push)'` 는 실제로는 push 가 아니다. 그러나
  `_find_command_substitutions()` 는 원시 명령 문자열을 그대로 스캔하므로(따옴표 종류를 모름)
  이 경우도 재귀 대상에 포함해 BLOCK 한다. posix `shlex` 가 인용을 벗긴 뒤엔 단따옴표·쌍따옴표·
  무인용을 구분할 수 없어 애초에 구분이 불가능 — over-block = fail-safe 방향이라 수용.
- **`find … -exec git push \;`, 프로세스 치환(`diff <(git push) x`), git alias(`git config
  alias.p push` 후 `git p`), `_SHELL_INTERPRETERS` 에 없는 임의의 인터프리터/래퍼** — 전부 구
  정규식도 못 잡던 선재 갭이며 이번 세션에서도 의도적으로 고치지 않았다. 정적 토큰 기반 가드가
  구조적으로 다다를 수 없는 영역: `find -exec` 는 별도 프로세스가 인자를 그대로 넘기고, 프로세스
  치환은 `_SEGMENT_SEPARATOR_CHARS` 에 없는 `<(` 라 세그먼트가 갈라지지 않으며, alias 는 git 자신의
  `.gitconfig` 조회 없이는 해석 불가능하다. `eval`/`-c` 처럼 "몇 줄이면 닫히는" 갭이 아니라 각각
  별도의 서브시스템 이해가 필요해 비용 대비 이득이 낮다. **이전 서술 정정**: 개정 전 이 절은
  `eval` 하나만 의식적으로 검토·수용했다고 기록해 나머지(`sh -c`/`bash -c`/`find -exec`/프로세스
  치환)가 마치 인지되지 않은 사각지대처럼 보였다(review/code/2026/07/17/18_04_20 Critical #2 가
  이 비대칭을 지적) — `sh -c`/`bash -c` 는 이번 세션에서 고쳐 더 이상 한계가 아니고, 나머지는
  위와 같이 계열 전체를 일반화해 명시적으로 수용한다.

---

## 체크리스트

- [x] ① 안 B 구현 (bootstrap `--keep` 전달 + reaper skip 집합)
- [x] ① 회귀 테스트 (앵커≠cwd 재현)
- [x] ② 서브커맨드 판정으로 교체 + shlex 폴백
- [x] ② 회귀 테스트 (오탐 B·C + 참 양성 전수) — **단, 최초 구현 시점엔 과소차단 방향은 미검증이었다.**
      아래 항목이 그 갭을 마감한다.
- [x] ② review 후속: `/ai-review` 가 찾은 과소차단 회귀 4건(개행-단독 구분·인용부호 분할·git 대소문자·
      미등록 글로벌 옵션) 수정 + 회귀 테스트 + WARNING #2·#3 커버리지 마감 — "review 후속 수정" 절 참고
- [x] ② review 후속 2: `/ai-review` 가 찾은 간접 실행 회귀(명령 치환·백틱·`-c`·`eval`) + WARNING
      3건(NUL 바이트·boolean 전역 옵션·`_GIT_OPTS_WITH_VALUE` 독스트링) 수정 + 차등 테스트(old ⊆
      new) 신설 — "review 후속 수정 2" 절 참고
- [x] 문서 동기화 — `worktree-policy.md §7` 의 불변식 "현재 세션 worktree 제외" 가 바로 이 결함의
      대리 지표 서술이었다(코드는 셸 cwd 를 봤다). cwd·앵커 두 축으로 정정 + 알려진 한계 명시.
      `.claude/tests/README.md` 에 신규 테스트 행 추가.
- [x] TEST WORKFLOW — `.claude/**` 전용이면 harness 스위트로 충분한지 확인.
      **plan 파일을 건드리면 frontend vitest(`plan-frontmatter.test.ts`) 필수** — backend-only 실행은 이 가드를 못 잡아 CI 에서 터진다.
- [ ] `/ai-review` → RESOLUTION → PR

## Rationale

**왜 별도 plan 인가**: 두 건 다 `claude/report-paths-shared-0edbf0` 작업 중 발견됐지만 그 PR 의
주제(report-path SoT 통합)와 무관하다. 같이 넣으면 scope 오염이고, scope-reviewer 가 정당하게 지적한다.

**왜 지금 안 고치나**: report-paths PR 의 Warning 8건 처리가 선행이다. 다만 ①은 **재발이 확정적**이다 —
머지된 PR 워크트리에서 시작해 `EnterWorktree` 를 쓰는 세션은 매번 죽는다. 우선순위는 ① > ②.

**진단 정정 기록**: 최초에 ②를 "`git push` 문자열 substring 매칭" 으로 보고했으나 **틀렸다**.
실제로는 정규식이 `git`↔`push` 사이를 무제한 허용해 heredoc 본문을 가로지른 것이다(케이스 E 가
통과하는 이유 — `git` 이 앞에 없으면 매칭 안 된다). 코드를 읽고 재현하기 전의 서술이었다.
