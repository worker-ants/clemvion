# Worktree 기반 작업 정책 (상세)

> CLAUDE.md 본문에는 §0 TL;DR 만 있다. 본 문서는 정책의 상세·운영 규칙·자동 차단 4-layer 의 SSOT 다.

## 1. 절대 원칙

모든 신규 작업(spec 개정·구현·리뷰 조치)은 `.claude/worktrees/<task_name>-<slug>/` 안에서 진행한다. main 워크트리는 통합/릴리스 운영용으로만 사용한다.

**예외**: read-only Q&A 만 하는 turn (검색·설명·요약 답변, 어떤 파일도 write 하지 않음) 은 worktree 없이 진행 가능.

**자주 발생하는 오해**: Write 의 `file_path` 에 `.claude/worktrees/<name>/...` 를 적어도 가드는 우회되지 않는다. 가드는 `file_path` 가 아니라 **CWD 를** 본다. worktree 디렉토리가 실제로 존재해야 하고 CWD 도 그 안이어야 한다.

## 2. 명명 규칙

`.claude/worktrees/<task_name>-<slug>/`

- `task_name` — 요청에 맞는 의미 있는 단어 (kebab-case). 예: `nav-redesign`, `auth-refactor`, `webhook-spec-draft`.
- `slug` — 호출자가 부여하는 식별자 (자동 생성된 짧은 코드, 충돌 회피용). 예: `c41f58`, `7ab3d2`.

## 3. 운영 규칙

- **수명 = PR 단위**: worktree 는 PR 이 merge 되면 정리한다. **자동**: 세션 시작 시 GC reaper(§7)가 merge 된 PR 의 worktree·branch 를 제거한다. **수동**(즉시): `.claude/tools/cleanup-worktree.sh <name>`.
- **plan 과 결속**: 새 plan frontmatter 의 `worktree` 필드에 현재 worktree 이름을 기록한다.
- **공유 자원 직렬화**: 동일 `spec/` 파일·코드 영역을 두 worktree 가 동시 수정 중이면 plan 에 명시하고 직렬화 (`consistency-checker plan_coherence` 가 사전 검출).
- **e2e 인프라 자동 격리**: `make e2e-*` 는 worktree dir basename 으로 compose project name 을 도출 — 여러 worktree 동시 실행 시 컨테이너·볼륨·network 자동 분리. 정리는 `make e2e-prune`.
- **hotfix 예외**: 별도 branch 에서 작업. 정말 default branch 에서 직접 commit 해야 하면 `BYPASS_DEFAULT_BRANCH_GUARD=1` 로 한 commit 만 우회.
- **통합 작업 worktree**: `merge-coordinator` 가 `.claude/worktrees/integrate-<slug>/` 신설, merge 후 정리.

## 4. 신규 worktree 생성 — 3가지 경로

**① `ensure-worktree.sh` 헬퍼 (권장)**

```bash
.claude/tools/ensure-worktree.sh <task_name>
# 출력 마지막 줄의 `cd ...` 를 그대로 실행
```

이미 worktree 안이면 no-op. branch guard hook 의 차단 메시지가 가리키는 canonical 명령.

**② `EnterWorktree` tool (백그라운드 세션)**

```
EnterWorktree(name="<task_name>-<slug>")
```

세션 CWD 자동 이동. `name` 에 `<task_name>-<slug>` 형식 명시 (생략 시 random).

> **브랜치명 주의**: 하네스 `EnterWorktree` 는 브랜치를 항상 `worktree-<name>` 로 만든다 (접두를 바꾸는 설정 없음, `WorktreeCreate` hook 은 git repo 에선 미발화). 이 접두는 §6 의 자동 정규화 hook 이 `claude/<name>` 으로 사후 교정하므로 컨벤션 위반이 남지 않는다. ①·③ 은 처음부터 `claude/` 로 생성하므로 정규화 대상이 아니다.

**③ Native `git worktree add` (스크립트·CI)**

```bash
TASK=<task>; SLUG=$(openssl rand -hex 3)
git worktree add ".claude/worktrees/${TASK}-${SLUG}" -b "claude/${TASK}-${SLUG}"
cd ".claude/worktrees/${TASK}-${SLUG}"
```

## 5. Enforcement (자동 차단 4-layer)

판정은 `.claude/hooks/_lib/branch_guard.py` 한 곳에서 한다.

**차단 조건**: 최상위 `.git` 이 디렉토리(== main worktree) **AND** 현재 branch == origin default branch.

| Layer | 위치 | 시점 | 효과 |
|---|---|---|---|
| A. PreToolUse (edit) | `guard_default_branch_edit.py` | Write/Edit/MultiEdit/NotebookEdit 직전 | 차단 |
| B. UserPromptSubmit | `guard_default_branch_prompt.py` | 사용자 prompt 진입 | reminder inject |
| C. git pre-commit | `.githooks/pre-commit` | `git commit` 직전 | exit 1 |
| D. PreToolUse (bash) | `guard_default_branch_bash.py` | mutating Bash 명령 직전 | 세션당 1회 reminder |

활성화: A·B·D 는 `.claude/settings.json` 등록만으로 자동. C 는 `make setup-githooks` 1회 실행.

D 의 read/silent 정책: `ls`, `cat`, `grep`, `find`, `pwd`, `git status`, `git log`, `git diff`, `git show` 등 inspection 명령은 제외. mutating 분류는 `guard_default_branch_bash.py` 의 `_MUTATING` 정규식 참고.

**우회**:
- branch 변경 (정상 동선): 자동 통과.
- `BYPASS_DEFAULT_BRANCH_GUARD=1`: 단발성 우회 (release tagging, 긴급 hotfix).

## 6. 브랜치명 정규화 (worktree- → claude/)

하네스 `EnterWorktree`(§4 ②)가 만드는 `worktree-<name>` 브랜치를 프로젝트 컨벤션 `claude/<name>` 으로 사후 교정한다. 판정·rename 은 `.claude/hooks/_lib/branch_naming.py` (`normalize`) 한 곳에서 한다.

**왜 사후 교정인가**: `EnterWorktree` 의 접두를 바꾸는 설정이 없고, `WorktreeCreate` hook 은 git repo 안에서는 발화하지 않는다(non-git fallback 전용). 생성을 가로챌 수 없으므로, 확실히 발화하는 hook 에서 rename 한다.

| 시점 | hook | 동작 |
|---|---|---|
| UserPromptSubmit | `normalize_worktree_branch.py` | rename 후 알림 reminder inject (cross-turn 케이스) |
| PreToolUse (bash) | `normalize_worktree_branch.py` | `git push` 전 silent rename (same-turn 케이스 — 백그라운드 잡이 한 턴 안에서 생성→push) |

**rename 조건 (모두 충족 시에만)**: linked worktree(`.git` 이 파일) **AND** 현재 branch 가 `worktree-` 로 시작 **AND** upstream 미설정. → `git branch -m worktree-<name> claude/<name>`. `claude/<name>` 충돌 시 짧은 slug 부착.

**안전장치**: upstream 이 붙은(=이미 push/PR) 브랜치는 건드리지 않아 divergence 를 방지한다. main worktree 브랜치는 절대 대상이 아니다. 멱등 — 이미 `claude/` 면 no-op 이라 기존 stray 브랜치도 자동 치유된다.

활성화: `.claude/settings.json` 등록만으로 자동.

## 7. Merge 된 worktree·branch 자동 정리 (GC reaper)

PR 이 merge 되면 그 worktree·local branch 는 더 이상 필요 없다. 정리를 사람 손에 맡기면 stale worktree 가 누적된다(머지된 PR 의 worktree 가 그대로 남아 `git worktree list` 를 오염시키고, 다음 작업의 stale base 위험까지 만든다). 이를 **세션 시작 시 GC** 로 수렴시킨다. 판정·실행은 `.claude/tools/reap-merged-worktrees.sh` 한 곳.

**왜 merge 시점이 아니라 GC 인가**: merge 는 대부분 GitHub 웹에서 일어나 로컬이 그 이벤트를 관측할 수 없다. 그래서 merge 를 가로채는 대신, 세션 시작마다 현재 worktree·branch 의 PR 상태를 조회해 정리한다 — 멱등적이고, merge 가 언제·어디서 일어났든 다음 세션에 수렴한다.

| 시점 | hook/호출 | 동작 |
|---|---|---|
| SessionStart | `bootstrap-session.sh` → `reap-merged-worktrees.sh` | merge 된 PR 의 worktree·branch 정리 (자기 throttle) |
| 수동 | `reap-merged-worktrees.sh [--dry-run]` | 즉시 정리 / 계획 미리보기 |

**정리 대상·조건** (보수적, 모두 충족 시에만):

- **worktree** (`.claude/worktrees/<name>` 의 `claude/*` 브랜치): `gh pr view <branch>` 가 **MERGED** + uncommitted 변경 없음(clean) → `cleanup-worktree.sh <name> --force` 로 worktree+local branch 제거. (squash merge 는 default 의 조상이 아니라 `git branch -d` 가 거부하므로 `--force`=`-D`; merge 가 확인됐으니 안전.)
- **dangling branch** (worktree 없는 `claude/*`): `git branch -d` 먼저(조상-merge 면 성공, 아니면 git 이 거부=안전망) → 실패 + `gh` MERGED 면 `git branch -D`.

**불변식**:

- **LOCAL-ONLY** — remote ref 는 절대 건드리지 않는다 (GitHub 가 merge 시 PR head 를 auto-delete).
- **현재 세션 worktree 제외**, **dirty worktree 보존**(in-flight 작업 안전).
- **fail-safe** — `gh` 없음/미인증/오류면 worktree 제거를 건너뛴다(조상-merge dangling 의 `-d` 만 수행). 증명 못 한 merge 는 그대로 두고 수동 `cleanup-worktree.sh` 로 처리.
- **throttle** — 세션 시작마다의 `gh` 비용을 묶기 위해 실제 실행은 `REAP_MIN_INTERVAL`(기본 6h)당 1회. `--force` 는 throttle 무시, `--dry-run` 은 read-only 라 항상 실행.

활성화: `.claude/settings.json` 의 SessionStart(`bootstrap-session.sh`) 등록만으로 자동.
