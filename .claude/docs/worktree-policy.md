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
- **Task 와 결속**: worktree 는 클레임한 NERV Task 하나의 작업 공간이다. NERV 세션은 `nerv_bootstrap` 에 넘긴 `worktree_path` · `branch` 로 이 worktree 를 기록한다.
- **공유 자원 직렬화**: 동일 코드 영역을 두 worktree 가 동시 수정 중이면 직렬화한다. 클레임 scope(`file_globs` · `spec_ids`)가 겹치면 NERV 가 클레임 · heartbeat 응답(`scope_overlaps`)으로 알린다. 그 밖의 충돌은 사용자와 통합 단계(`/merge-coordinate`)의 책임이다.
  > 종전 이 자리는 `consistency-checker plan_coherence` 가 사전 검출한다고 적었으나 그 기능은 `3da85dc3b`(#576)에서 제거됐다(병렬 작업이 다른 머신·세션이면 로컬에 안 보여 신뢰할 수 없다). checker 정의 본문도 그것이 검토 대상이 **아님**을 명시한다.
- **e2e 인프라 자동 격리**: `make e2e-*` 는 worktree dir basename 으로 compose project name 을 도출 — 여러 worktree 동시 실행 시 컨테이너·볼륨·network 자동 분리. 정리는 `make e2e-prune`.
- **hotfix 예외**: 별도 branch 에서 작업. 정말 default branch 에서 직접 commit 해야 하면 `BYPASS_DEFAULT_BRANCH_GUARD=1` 로 한 commit 만 우회.
- **통합 작업 worktree**: `merge-coordinator` 가 `.claude/worktrees/integrate-<slug>/` 신설, merge 후 정리.

## 4. 신규 worktree 생성 — 3가지 경로

**① `ensure-worktree.sh` 헬퍼 (권장)**

```bash
.claude/tools/ensure-worktree.sh <task_name>
# 출력 마지막 줄의 `cd ...` 를 그대로 실행
```

새 worktree 를 만든 직후 main checkout 의 로컬 설정을 링크로 건다(§8). 이미 worktree 안이면 새로 만들지 않고, 빠진 로컬 설정 링크만 채운다. branch guard hook 의 차단 메시지가 가리키는 canonical 명령.

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

②·③ 은 로컬 설정 링크를 걸지 않는다. 그 worktree 에서 **새로 띄운** 세션에는 `bootstrap-session.sh` 가 빠진 자리를 경고한다(§8). `EnterWorktree` 로 옮겨 간 세션은 main checkout 에서 뜬 설정을 그대로 쓰므로 영향이 없다.

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

D 의 read/silent 정책: `ls`, `cat`, `grep`, `find`, `pwd`, `git status`, `git log`, `git diff`, `git show` 등 inspection 명령은 제외. mutating 분류는 `guard_default_branch_bash.py` 의 `_MUTATING` 정규식 참고 — 명령을 `&&`/`||`/`;`/`|`/`&`/개행으로 나눈 **각 세그먼트의 첫 토큰**(`VAR=value` 접두는 건너뜀 — 따옴표로 감싼 공백 포함 값도 인식)에 적용하므로 `git add -A && git commit …` 처럼 체인 뒤쪽 명령도 잡는다. 첫 토큰만 보는 앵커라 인용문 속 단어(`git log --grep="commit"`)는 분류되지 않고, 간접 실행(`xargs rm`, `bash -c …`)은 의도적으로 스코프 밖이다 — D 는 넛지일 뿐이고 실제 강제는 A·C 가 한다. 분류 계약은 `.claude/tests/test_guard_default_branch_bash_mutating.py` 가 고정한다.

**우회**:
- branch 변경 (정상 동선): 자동 통과.
- `BYPASS_DEFAULT_BRANCH_GUARD=1`: 단발성 우회 (release tagging, 긴급 hotfix).

### 5.1 NERV 소유 경로 가드 (4-layer 와 별개)

`guard_nerv_owned_paths.py`(PreToolUse, Write/Edit/MultiEdit/NotebookEdit)는 브랜치와 무관하게 **NERV 가 정본인 경로**의 도구 편집을 막는다. main checkout 과 워크트리 모두 대상이고, 루트에 `.claude/tools/nerv-mirror/pull.py` 가 있는 체크아웃만 본다(다른 저장소는 통과). 지금 막는 경로는 `spec/` · `review/` · `plan/` 이다(전환 단계 1 · 2 · 3 에서 차례로 더했다. `review/` 와 `plan/` 은 단계 3 에서 저장소에서 지웠고, 새 파일이 생기지 않게 계속 막는다). 셸 편집은 이 훅이 못 본다. 미러 파일은 CI `spec-mirror-integrity` 가 지문으로 잡는다.

- 우회: `BYPASS_NERV_OWNED_PATHS=1`. 세션 환경 변수라 켜 둔 동안 막는 경로 전체가 열린다. 문서가 허용한 사용처는 없다(옛 트리의 plan 링크 · `pending_plans` · `status` 를 고치던 예외는 단계 3 에서 `plan/` 과 함께 없어졌다). 꼭 필요하면 사용자 승인을 받고 켜고, 그 편집 직후 끈다.
- 훅은 `$CLAUDE_PROJECT_DIR`(main checkout)에서 실행된다. 등록 명령은 훅 파일이 없으면 통과한다(`test ! -f … || python3 …`). 새 훅을 등록한 PR 이 머지되면 main checkout 을 pull 해야 그 훅이 실제로 돈다.
- **새 훅을 등록할 때는 같은 형태로 등록한다.** 설정(`settings.json`)은 세션이 연 워크트리에서 읽고 훅 파일은 main checkout 에서 찾는다. 둘이 어긋나면(워크트리에는 새 등록이 있고 main 에는 아직 파일이 없으면) `python3 <없는 파일>` 이 exit 2 로 끝나 그 세션의 모든 편집이 막힌다. 2026-10-01 이 훅을 들이던 세션이 재개 뒤 실제로 막혔다(NERV Task `CLE-T-VA4YA1`). 등록 명령을 `bash -c` 로 돌려 파일이 없을 때 exit 0 인지 보는 테스트를 함께 둔다(`test_guard_nerv_owned_paths.py` 선례).

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
| 수동 | `reap-merged-worktrees.sh [--dry-run] [--keep <path>]` | 즉시 정리 / 계획 미리보기 |

**정리 대상·조건** (보수적, 모두 충족 시에만):

- **worktree** (`.claude/worktrees/<name>` 의 `claude/*` 브랜치): PR 상태가 **MERGED** + uncommitted 변경 없음(clean) → `cleanup-worktree.sh <name> --force` 로 worktree+local branch 제거. (squash merge 는 default 의 조상이 아니라 `git branch -d` 가 거부하므로 `--force`=`-D`; merge 가 확인됐으니 안전.)
- **dangling branch** (worktree 없는 `claude/*`): `git branch -d` 먼저(조상-merge 면 성공, 아니면 git 이 거부=안전망) → 실패 + PR 상태가 MERGED 면 `git branch -D`.

**PR 상태 조회** — `gh pr list --state all --limit <REAP_GH_PR_LIMIT>`(기본 200) **1회 배치**로 `branch→state` 맵을 선구성한다. 종전엔 후보마다 `gh pr view <branch>` 를 순차 호출해, SessionStart 가 **동기**인 탓에 후보가 쌓이면 세션 시작이 수 초 블로킹됐다. `--limit` 창 밖(= 오래된 PR)이거나 배치 호출이 실패하면 그 브랜치만 **단건 `gh pr view` 로 폴백**한다 — 배치가 "merge 를 증명할 수 있는 범위" 를 조용히 좁히지 않게 하기 위함. `claude/*` 브랜치가 하나도 없으면 배치 자체를 건너뛴다(gh 호출 0회).

**불변식**:

- **LOCAL-ONLY** — remote ref 는 절대 건드리지 않는다 (GitHub 가 merge 시 PR head 를 auto-delete).
- **사용 중 worktree 제외** — 서로 다른 **두** 경로를 모두 제외한다:
  - **셸 cwd** (`git rev-parse --show-toplevel`).
  - **세션 앵커** — `bootstrap-session.sh` 가 `--keep` 으로 전달하는 `$CLAUDE_PROJECT_DIR`. 모든 훅이 `$CLAUDE_PROJECT_DIR/.claude/hooks/*.py` 로 실행되므로 앵커를 reap 하면 **세션이 wedge 된다** (Bash·Write·Edit 전부 훅 로드 실패 → 자력 복구 불가). 평소엔 cwd == 앵커라 앵커가 우연히 보호되지만 `EnterWorktree` 이후 둘이 갈라지고, 그때 cwd skip 은 엉뚱한 쪽을 지킨다. 앵커는 `BASH_SOURCE` 로 유도한다 — `git rev-parse` 는 cwd 기반이라 같은 오답을 낸다.
  - **한계**: 자기 세션의 앵커만 알 수 있다. 동시에 열린 다른 세션이 앵커로 쓰는 worktree 의 PR 이 merge 되면 그 세션은 여전히 죽는다("살아있는 세션 앵커 레지스트리" 가 필요해 과하다고 판단 — 하네스의 worktree recycle 로 복구되는 것이 관측됨).
- **dirty worktree 보존**(in-flight 작업 안전). 판정은 `git status --porcelain` 이다. 그래서 §8 의 로컬 설정 링크는 반드시 `.gitignore` 에 잡혀야 한다. 잡히지 않으면 링크가 untracked 로 보여 그 worktree 는 영영 정리되지 않는다.
- **fail-safe** — `gh` 없음/미인증/오류면 worktree 제거를 건너뛴다(조상-merge dangling 의 `-d` 만 수행). 증명 못 한 merge 는 그대로 두고 수동 `cleanup-worktree.sh` 로 처리.
- **throttle** — 세션 시작마다의 `gh` 비용을 묶기 위해 실제 실행은 `REAP_MIN_INTERVAL`(기본 6h)당 1회. `--force` 는 throttle 무시, `--dry-run` 은 read-only 라 항상 실행. 한 번 실행될 때의 `gh` 왕복 수는 위 **배치 조회**(`REAP_GH_PR_LIMIT`, 기본 200)가 1회로 묶는다.

활성화: `.claude/settings.json` 의 SessionStart(`bootstrap-session.sh`) 등록만으로 자동.

## 8. 로컬 설정 전파

> 시행 시점: 짝 하네스 PR `#1427`(`local_config.py` 도입, NERV Task `CLE-T-0EZEYF`) 머지.

NERV 연동 설정 세 자리는 gitignore 대상이라 `git worktree add` 가 옮기지 않는다. 옮기지 않으면 worktree 에서 새로 띄운 세션에 NERV MCP · 플러그인 훅의 `NERV_*` env · 오프라인 큐가 없다. 플러그인의 `nerv-init --check` 는 NERV 흔적이 전혀 없으면 아무 말도 하지 않도록 짜여 있어 이 상태를 알리지 않는다.

| 자리 | 담는 것 |
|---|---|
| `.mcp.json` | NERV MCP 접속(서버 주소 · 인증 헤더) |
| `.claude/settings.local.json` | `NERV_SERVER` · `NERV_PROJECT` · `NERV_TOKEN` env, 개인 권한 허용 목록 |
| `.nerv/` | 플러그인 캐시 · 오프라인 큐(`outbox`) · 미러 도구 캐시(`cache/mirror/`, 지워도 된다) |

**규칙** — 판정·실행은 `.claude/tools/local_config.py` 한 곳에서 한다.

- **링크로 건다.** worktree 의 세 자리는 main checkout 의 원본을 가리키는 심볼릭 링크다. 사본을 두지 않으므로 토큰을 바꾸면 모든 worktree 에 바로 반영된다.
- **덮어쓰지 않는다.** 이미 있는 파일 · 디렉터리 · 끊긴 링크는 그대로 둔다. 사람이 일부러 둔 로컬 사본일 수 있다.
- **자격 증명 원문이 든 `.mcp.json` 은 링크하지 않는다.** 원문 토큰을 worktree 로 퍼뜨리면 노출면이 넓어진다. 토큰 값은 `.claude/settings.local.json` 의 `env.NERV_TOKEN` 에 두고, `.mcp.json` 은 `Authorization` 헤더 대신 `headersHelper`(연결할 때 그 값을 읽어 헤더 JSON 을 출력하는 명령)를 쓴다. 이 파일은 gitignore 대상 로컬 설정이라 사람이 승인하고 바꾼다. 판정은 값 대신 위치만 출력한다. 읽지 못하는 JSON 도 링크하지 않는다.
- **`${NERV_TOKEN}` 참조형은 쓰지 않는다.** `"Authorization": "Bearer ${NERV_TOKEN}"` 는 원문이 아니라 판정은 통과하지만 붙지 않는다. `settings.local.json` 의 `env` 가 `.mcp.json` 확장에 쓰이지 않기 때문이다. 실측(2026-09-29, Claude Code 2.1.284, `claude mcp get nerv`): 참조형은 연결 실패, `headersHelper` 는 연결 성공, 틀린 토큰을 내는 헬퍼는 401 로 실패했다. NERV 플러그인 `nerv-init` 템플릿은 참조형이라 그대로 쓰면 안 된다.
- **`.gitignore` 가 링크를 잡아야 한다.** 패턴은 `.nerv`(끝 슬래시 없이)와 `.claude/settings.local.json` 이다. 끝 슬래시 패턴 `.nerv/` 는 디렉터리에만 맞아 `.nerv` 링크를 놓친다. 링크가 잡히지 않으면 `git add -A` 가 링크를 커밋하고 §7 reaper 가 그 worktree 를 dirty 로 본다.
- **두 파일의 `Read` 는 `settings.json` 의 `permissions.deny` 가 막는다.** 토큰이 든 `.claude/settings.local.json` · `.mcp.json` 을 `Read` 도구로 읽는 길을 닫으려는 것이다(리뷰 서브에이전트 `nerv-recorder` 가 `Read` 를 가진 채 리뷰 대상 코드에서 나온 글을 읽는다). 워크트리의 두 파일은 메인 체크아웃으로 가는 심링크라서 `Read(./…)` 와 `Read(**/…)` 두 모양의 규칙을 둔다. 그 부작용으로 Claude 도 두 파일을 읽거나 Edit 하지 못하니 사람이 직접 고친다. `local_config.py` · 훅 · 스크립트는 Claude 의 `Read` 도구를 쓰지 않아 영향이 없다. 규칙이 서브에이전트와 심링크에 실제로 걸리는지는 머지 뒤 실측한다(NERV Task `CLE-T-CD9131`).

| 시점 | 호출 | 동작 |
|---|---|---|
| worktree 생성 | `ensure-worktree.sh` → `local_config.py link` | 세 자리를 링크한다 |
| worktree 안에서 `ensure-worktree.sh` | 같음 | 빠진 링크만 채운다 |
| 수동 | `python3 .claude/tools/local_config.py link` | 현재 worktree 에 링크한다 |
| SessionStart | `bootstrap-session.sh` → `local_config.py check` | 세션 앵커 기준으로 빠진 자리 · 끊긴 링크 · `.mcp.json` 원문 토큰을 경고한다 |

링크를 새로 건 세션은 Claude Code 를 다시 띄워야 MCP 가 붙는다. MCP 설정은 세션 시작 때 읽힌다. 계약은 `.claude/tests/test_local_config.py` 가 고정한다.
