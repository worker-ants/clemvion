# `.claude/` — Claude Code 운영 디렉토리

Claude Code 의 설정·자동화·역할별 skill·sub-agent definition 이 모이는 곳. 사람과 Claude 가 함께 읽는 영역이라 디렉토리 의미를 한 줄씩 박아둔다.

| 경로 | 의미 | 호출 주체 |
|---|---|---|
| `agents/<name>.md` | sub-agent definition (system prompt + frontmatter) | `Agent` tool 로 main Claude 가 invoke |
| `commands/<name>.md` | slash command 진입점 (`/ai-review`, `/consistency-check`, `/merge-coordinate`) | 사용자 |
| `skills/<skill>/SKILL.md` | 역할별 skill 본문 (절차·정책) | main Claude 가 자기 turn 안에서 따른다 |
| `skills/<skill>/README.md` | 빠른 시작·운영 가이드 | 사람 |
| **`skills/<skill>/scripts/`** | skill 내부 helper script (model 호출 없음, prepare/resume 모드) | main Claude 가 절차 안에서 직접 실행 |
| `skills/<skill>/lib/` | 위 script 가 import 하는 Python module | — |
| **`hooks/<name>.py`** | **Claude Code event hook** (PreToolUse / UserPromptSubmit / PostToolUse 등) | Claude Code harness 가 자동 실행 |
| `hooks/_lib/` | hook 들이 공유하는 helper module (`branch_guard.py` 등) | — |
| `settings.json` | hook 등록·statusLine 등 Claude Code 설정 (checked-in) | Claude Code harness |
| `worktrees/<task>-<slug>/` | 작업 중인 git worktree (모든 신규 작업의 위치) | 사람·Claude |
| `agents/`, `commands/`, `skills/` | Anthropic 표준 네이밍 — 변경 금지 | — |

## `skills/<skill>/scripts/` vs `hooks/`

이 두 디렉토리는 옛날에는 둘 다 `hooks` 라는 단어를 썼지만 의미가 다르다 — 혼동을 막기 위해 분리했다.

- `hooks/` (이 디렉토리 안의 `.claude/hooks/`) — Claude Code 가 정해진 시점(PreToolUse 등) 에 자동으로 실행하는 진짜 hook. 입력은 stdin JSON, 출력은 exit code + stdout/stderr.
- `skills/<skill>/scripts/` — skill 의 한 단계(보통 step 1 "세션 준비") 에서 main Claude 가 `Bash` tool 로 직접 실행하는 helper. orchestrator·prepare·resume 같은 일을 하며 **절대 model 을 호출하지 않는다** (요금제 정책).

## 차단 정책 (요약)

`.claude/hooks/_lib/branch_guard.py` 한 곳에서 판정하며, 동일 규칙을 PreToolUse / UserPromptSubmit / git pre-commit 세 layer 가 공유한다. 정책 본문은 `../CLAUDE.md` 의 "Enforcement (자동 차단 3-layer)" 절 참고.
