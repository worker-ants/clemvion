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

## Agent 레지스트리 (소속 flow 별)

31개 `agents/<name>.md` 는 모두 main Claude 의 `Agent` tool 로만 invoke 된다. 아래는 "어느 흐름이 부르는가 / 언제 부르는가" 로 분류한 인덱스다. perspective·checklist 같은 내용 카탈로그는 각 흐름의 README/SKILL 이 SSOT (마지막 열).

| 소속 흐름 (trigger) | agents | 부르는 시점 | 내용 SSOT |
|---|---|---|---|
| `/ai-review` (code-review-agents) | 14 reviewer + `review-router` + `code-review-summary` | router 가 부분집합 선별 → 병렬 reviewer → summary 수렴 | [`skills/code-review-agents/README.md`](skills/code-review-agents/README.md) |
| `/ai-review` §6 자동 후속 | `resolution-applier` | SUMMARY Critical/Warning > 0 일 때만 | [`agents/resolution-applier.md`](agents/resolution-applier.md) |
| `/consistency-check` (consistency-checker) | 5 checker + `consistency-summary` | spec/구현 착수 전 병렬 → summary | [`skills/consistency-checker/SKILL.md`](skills/consistency-checker/SKILL.md) |
| `/merge-coordinate` (merge-coordinator) | 4 analyzer + `integration-risk-summary` | Phase 1 병렬 분석 → summary | [`skills/merge-coordinator/SKILL.md`](skills/merge-coordinator/SKILL.md) |
| `/merge-coordinate` (조건부) | `merge-conflict-resolver` | Phase 3 에서 **conflict 한 건당** 만 | [`skills/merge-coordinator/SKILL.md`](skills/merge-coordinator/SKILL.md) §Phase 3 |
| `/spec-coverage` (spec-coverage) | `spec-impl-coverage-auditor` | 수동 standing audit | [`skills/spec-coverage/SKILL.md`](skills/spec-coverage/SKILL.md) |
| `developer` §4 DOCUMENTATION (조건부) | `user-guide-writer` | user-guide 작성·갱신 필요 + `agents.writers.user_guide` enabled 시 | [`../PROJECT.md`](../PROJECT.md) §유저 가이드 파일 컨벤션 |

- **enable 토글**: reviewer/checker/writer 는 `.claude.project.json` 의 `agents.{reviewers,checkers,writers}` 로 부분 disable. analyzer·summary·router·resolution-applier·auditor 는 토글 대상 아님 (흐름 고정 구성).
- **registry drift 가드**: 위 reviewer/checker 목록 ↔ `role_instructions.py` ↔ `.claude.project.json` ↔ code-review README 표의 일치는 [`tests/test_agent_consistency.py`](tests/test_agent_consistency.py) 가 검증.

## 차단 정책 (요약)

`.claude/hooks/_lib/branch_guard.py` 한 곳에서 판정하며, 동일 규칙을 PreToolUse(edit) / PreToolUse(bash) / UserPromptSubmit / git pre-commit **4-layer** 가 공유한다. 정책·layer 표·우회의 SSOT 는 [`docs/worktree-policy.md`](docs/worktree-policy.md) §5. branch 정규화(`worktree-*`→`claude/*`)는 동 문서 §6.
