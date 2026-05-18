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

- **수명 = PR 단위**: PR merge 즉시 `git worktree remove` 로 정리한다.
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
