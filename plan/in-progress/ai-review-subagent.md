---
worktree: ai-review-subagent-b7c8d9
started: 2026-05-15
owner: developer
---

# AI-Review / Consistency-Check — `claude -p` 제거 + Sub-agent 위임

## Context

요금제 정책 변경으로 `subprocess.run(["claude", "-p", ...])` 와
`anthropic.Anthropic().messages.create(...)` 두 model 호출 경로가 모두 사용
불가가 되었다. 현재 `/ai-review` (`code-review-agents`) 와
`/consistency-check` (`consistency-checker`) 의 model 호출이 모두 `claude -p`
이므로 (`lib/agent_runner.py:34`, `lib/summary.py:46`,
`consistency_orchestrator.py:32`) 파이프라인 전체를 sub-agent 위임으로 전환한다.

남는 유일한 model 호출 경로는 **main Claude (현재 session) 가 `Agent` tool
로 sub-agent 를 invoke** 하는 것. sub-agent 는 별도 conversation 으로 자동
격리된다. 사용량 한도 시 무한 재시도는 `/loop` dynamic mode + `ScheduleWakeup`
으로 구현.

## 새 아키텍처

```
사용자 → /ai-review        → 1회 사이클 (한도 걸린 agent 는 pending 유지)
사용자 → /loop /ai-review  → 무한 재시도 (ScheduleWakeup 으로 self-pace)
    │
    ▼
main Claude
  1. orchestrator --prepare 호출 → 세션 디렉토리 + _prompts/<role>.md +
     _retry_state.json 초기화 (model 호출 없음, file IO 만)
  2. _retry_state.json 의 pending 리스트 Read
  3. 각 pending agent 에 대해 Agent tool 병렬 invoke
     (subagent_type=<role>-reviewer, prompt=경로 인자)
  4. sub-agent return value 파싱 (STATUS=success|rate_limit|network|fatal)
  5. _retry_state.json 갱신
  6. pending 비면 summary sub-agent → SUMMARY.md → 종료
     pending 남으면 /loop 안: ScheduleWakeup(reset_hint or 1800s) → turn 종료
                  /loop 밖: partial SUMMARY 후 종료
```

## Sub-agent 정의 (.claude/agents/)

13 reviewer (`<role>-reviewer.md`):
api_contract, architecture, concurrency, database, dependency,
documentation, maintainability, performance, requirement, scope, security,
side_effect, testing

5 checker (`<checker>-checker.md`):
convention_compliance, cross_spec, naming_collision, plan_coherence,
rationale_continuity

2 summary: `code-review-summary.md`, `consistency-summary.md`

각 정의 frontmatter:
```
---
name: <slug>
description: <한 줄>
tools: Read, Grep, Glob, Bash, Write
model: sonnet
---
```

본문은 기존 prompts 의 내용을 그대로 옮기되, 다음 contract 를 끝에 추가:
- review.md 본문은 호출자가 prompt 에 인자로 준 OUTPUT_PATH 에 Write tool 로
  저장한다.
- 호출자에게 return 하는 값은 한 줄: `STATUS=<...> ISSUES=<n> PATH=<...>
  RESET_HINT=<sec or "">`.
- 사용량 한도/네트워크 오류 메시지를 받으면 `STATUS=rate_limit` 또는
  `STATUS=network` 로 보고하고 임의 우회 금지.

## Python orchestrator 슬림화

`code_review_orchestrator.py` / `consistency_orchestrator.py` 가
남기는 역할:
- diff/context 수집 + prompt-budget 압축 (`168-297` 의 기존 로직 유지)
- prompt 파일을 `review/<timestamp>/_prompts/<role>.md` 로 저장
- `_retry_state.json` 초기화 (pending=전체, success=[], fatal=[], attempts=0)
- 세션 디렉토리 경로를 stdout 으로 반환

제거할 코드:
- `from lib import agent_runner, summary`
- `agent_runner.run_agents_parallel(...)` 호출 (`code_review_orchestrator.py:290`)
- `summary.run_summary(...)` 호출 (`code_review_orchestrator.py:308`)
- 동일 위치의 consistency_orchestrator 호출

`lib/agent_runner.py`, `lib/summary.py` → 삭제. `lib/session.py` 유지.

## 변경 파일

### 신규
- `.claude/agents/<role>-reviewer.md` × 13
- `.claude/agents/<checker>-checker.md` × 5
- `.claude/agents/code-review-summary.md`
- `.claude/agents/consistency-summary.md`

### 수정
- `.claude/skills/code-review-agents/hooks/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/hooks/consistency_orchestrator.py`
- `.claude/skills/code-review-agents/lib/__init__.py`
- `.claude/skills/code-review-agents/SKILL.md`
- `.claude/skills/code-review-agents/README.md`
- `.claude/skills/consistency-checker/SKILL.md`
- `.claude/commands/ai-review.md`
- `.claude/commands/consistency-check.md`
- `.claude/skills/code-review-agents/hooks/hooks.json` (PostToolUse 제거)
- `CLAUDE.md` ("외부 LLM 호출 정책" 절 신설)

### 삭제
- `.claude/skills/code-review-agents/lib/agent_runner.py`
- `.claude/skills/code-review-agents/lib/summary.py`
- `.claude/skills/code-review-agents/prompts/`
- `.claude/skills/consistency-checker/prompts/`

## 환경변수

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `RETRY_WAKE_DEFAULT_SEC` | 1800 | reset-hint 없을 때 ScheduleWakeup 대기 |
| `RETRY_WAKE_CAP_SEC` | 3600 | wake delay 상한 |
| `RATE_LIMIT_PATTERNS` | (내장) | sub-agent return value 매칭용 추가 패턴 |
| `NETWORK_PATTERNS` | (내장) | 동일 |

## 단계

- [x] 1. .claude/agents/ 디렉토리 신설 + 20 subagent definition 작성
- [x] 2. code_review_orchestrator.py 축소 (--prepare 모드)
- [x] 3. consistency_orchestrator.py 축소
- [x] 4. lib/agent_runner.py + lib/summary.py 삭제, lib/__init__.py 정리
- [x] 5. prompts/ 디렉토리 삭제 (양 skill)
- [x] 6. SKILL.md / README.md 재작성
- [x] 7. .claude/commands/ 슬래시 정의 갱신
- [x] 8. hooks.json PostToolUse 트리거 제거
- [x] 9. CLAUDE.md 정책 절 신설
- [~] 10. `consistency-check --impl-prep`: spec 변경 없음으로 본 작업에는 적용 안 됨. 대신 `--plan` 으로 smoke test 수행 (orchestrator prepare 까지). 실제 sub-agent 호출은 commit/merge 이후 사용자 환경에서 수동 검증.
- [x] 11. orchestrator smoke test 통과: 두 orchestrator 의 `--prepare` 가 session_dir / _prompts / _retry_state.json 정상 생성. `AI_REVIEW_LOOP=1` 환경변수가 `loop_mode=true` 로 반영됨. subagent_type 매핑 (`side_effect → side-effect-reviewer`, `plan_coherence → plan-coherence-checker`) 정상.
- [ ] 12. 통합 검증 (follow-up — 사용자 환경에서 수동 수행 필요):
    - `/ai-review` 호출 → main Claude 가 13개 Agent tool 병렬 invoke → STATUS 파싱 → SUMMARY.md 생성.
    - `/loop /ai-review` 사용량 한도 시뮬레이션 → ScheduleWakeup 예약 → wake 시 재진입 → pending 만 재호출.
    - `/consistency-check --plan plan/in-progress/ai-review-subagent.md` → 5 checker sub-agent invoke → consistency-summary → BLOCK 결정.
    - 본 worktree 의 `.claude/agents/` 가 main session 에 인식되는 시점 확인 (cwd / merge 시점).
- [x] 13. plan 갱신.
- [x] 14. 단일 커밋 (7a52b93e on `claude/ai-review-subagent-b7c8d9`). PR 은 통합 검증 후 사용자 결정.
- [ ] 15. PR 생성 (통합 검증 완료 후).

## 검증 결과 (smoke)

| 항목 | 결과 |
| --- | --- |
| `python3 -c "from lib import session"` | OK |
| `code_review_orchestrator.py` import | OK (ALL_AGENTS 13개 그대로) |
| `consistency_orchestrator.py` import | OK (ALL_CHECKERS 5개 그대로) |
| `_subagent_type('side_effect')` | `side-effect-reviewer` |
| `_subagent_type('plan_coherence')` | `plan-coherence-checker` |
| `code_review_orchestrator.py --prepare` (전체 diff, 30 파일) | 성공. session_dir/_prompts/security.md + _retry_state.json + meta.json 생성. stdout 마지막 줄에 session_dir 절대경로. |
| `AI_REVIEW_LOOP=1 code_review_orchestrator.py --prepare` | `_retry_state.json` 의 `loop_mode=true`. |
| `consistency_orchestrator.py --plan plan/.../ai-review-subagent.md` | 성공. session_dir/_prompts/plan_coherence.md (header + 모드 + Target 문서 + plan_in_progress) + _retry_state.json (pending=['plan_coherence'], summary=consistency-summary). |

## 통합 검증 follow-up

main session 에서 Agent tool 로 sub-agent 를 invoke 하려면 sub-agent definition 이 main 의 `.claude/agents/` 검색 경로에 등록되어야 한다. 본 작업은 worktree 안에 신설했으므로, **PR merge 후 (또는 cwd 를 worktree 로 옮긴 상태에서)** 실제 호출 검증이 가능하다. 수동 검증 절차는 위 단계 12 참고. 검증 실패 시 plan 을 다시 `in-progress` 로 되돌리고 후속 조치.

## Follow-up — 리뷰 디렉토리 nested 구조 (commit 2)

`review/<timestamp>/` 와 `review/consistency/<timestamp>/` 의 flat 누적이 `ls` 등 파일시스템 조회 시 부담이 커서 nested 형식으로 전환.

- 신규 형식:
  - 코드 리뷰: `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
  - 일관성 검토: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
- 변경된 코드:
  - `lib/session.py:create_session_dir` 가 nested ISO 로 디렉토리 생성. `subdir` 인자는 호환 유지.
  - `code_review_orchestrator.py` 의 `REVIEW_OUTPUT_DIR` 기본값 `./review` → `./review/code`.
  - `consistency_orchestrator.py` 는 prefix 그대로 `./review/consistency` (nested 는 session 모듈이 처리).
- 변경된 문서: `CLAUDE.md` 의 명명 컨벤션 표 + "정보 저장 위치" 표 + Skill 체계 표의 path 표현, `code-review-agents/SKILL.md`, `code-review-agents/README.md` 의 산출물 디렉토리 트리 + `_retry_state.json` 예시, `consistency-checker/SKILL.md`, `.claude/commands/consistency-check.md` 산출물 섹션.
- Smoke test:
  - `REVIEW_OUTPUT_DIR=/tmp/code-nested ... --prepare` → `/tmp/code-nested/2026/05/15/07_47_44/...` ✓
  - `CONSISTENCY_OUTPUT_DIR=/tmp/cons-nested ... --plan ...` → `/tmp/cons-nested/2026/05/15/07_47_46/_prompts/plan_coherence.md` 등 정상 ✓
  - 기본값(환경변수 없음) → `./review/code/2026/05/15/07_47_57/` ✓
- 기존 flat 디렉토리(`review/<ts>/`, `review/consistency/<ts>/`) 의 일괄 이동은 사용자 별도 작업.

## 단계 (이어서)

- [x] 16. `lib/session.py:create_session_dir` 를 nested ISO 로 변경 + docstring 갱신.
- [x] 17. `code_review_orchestrator.py` 기본 `REVIEW_OUTPUT_DIR` 을 `./review/code` 로.
- [x] 18. 문서 path 표현 갱신 (CLAUDE.md / 양 SKILL.md / README.md / commands/consistency-check.md).
- [x] 19. Smoke test (양쪽 orchestrator + 기본값).
- [x] 20. follow-up 단계 본 plan 에 기록.
- [x] 21. follow-up 커밋 + push (commit 241e0ebb).
- [x] 22. summary self-discovery follow-up 커밋 + push (commit 04302603).

## Follow-up — 사용자 테스트 피드백 (commit 5+6)

사용자가 실제 `/ai-review` 호출 시 두 가지 이슈 보고:
1. 이중 경로 — `review/2026-05-15_15-29-14` (옛 flat) 와 `review/code/2026/05/15/15_30_00` (새 nested) 가 동시에 생성됨.
2. 자동 후속 흐름 누락 — 옛 동작 (리뷰 → planner/developer 위임 → 이슈 해결 → e2e) 이 빠짐.

### 이슈 1 — commit 16a80728 (`fix(settings): plugins 등록 제거`)

원인: `.claude/settings.json` 의 `plugins: [".claude/skills/code-review-agents"]` 가 plugin 시스템을 통해 plugin path 의 `hooks.json` 을 PostToolUse 로 자동 등록. 옛 hooks.json (Write/Edit 트리거) 이 옛 orchestrator 를 fork → `session.create_session_dir` 만 옛 flat 형식으로 만들고 본문은 `claude -p` 부재로 실패.

해결: `plugins` 배열 제거. slash command 가 진입점이 된 후로 plugin 자동 등록은 필요 없음. 머지 후 main 의 hooks.json 도 함께 사라지면 옛 path 생성 메커니즘 완전 소멸.

### 이슈 2 — 자동 후속 흐름 (commit 6 in progress)

SKILL.md 에 "단계 8. 자동 후속 흐름" 신설:

- 8.1 분류: spec 관련 / 코드 관련.
- 8.2 spec 관련: `project-planner` 절차 (draft → `/consistency-check --spec` → `BLOCK: NO` 시 spec 반영).
- 8.3 코드 관련: `developer` 절차 (수정 + 단위 테스트 + commit).
- 8.4 모두 처리 후 `make e2e-test` 자동 실행.
- 8.5 실패 시 원인 분석 + 추가 fix (최대 3회).
- 8.6 통과 시 `RESOLUTION.md` 작성.
- 8.7 안전 가드: consistency-check `BLOCK: YES`, e2e 누적 3회 실패, 직전 수정과 무관한 사전 결함, DB 마이그레이션·외부 API 계약 변경, SUMMARY "사용자 결정 필요" 표기 → 자동 중단 + 사용자 보고.

동반 갱신: commands/ai-review.md 의 단계 8 추가, README.md 의 아키텍처 그림에 자동 후속 흐름 추가.

- [x] 23. settings.json plugins 제거 commit (16a80728).
- [x] 24. SKILL.md / commands / README 의 자동 후속 흐름 작성.
- [ ] 25. 자동 후속 흐름 commit + push.

## Follow-up — 지침 통합 보강 (commit 4)

전체 skill·agent 지침 검토 결과 발견된 약점 일괄 보강. 사용자 확인 사항: C3 (role-specific prompt 재작성) 적용, E1·E2 (가독성) 적용, C3 의 단일 공유 제안은 거부 (역할 격리 강화 의도).

- **A1 — `--resume` 모드 도입**: 두 orchestrator (`code_review_orchestrator.py`, `consistency_orchestrator.py`) 에 `--resume <session_dir>` 신설. `_retry_state.json` 존재만 검증 후 그 경로를 stdout 으로 echo. /loop wake 후 동일 세션 재진입 메커니즘이 결정성 있게 동작.
- **A2 — STATUS 미수신 fallback**: SKILL.md 단계 4 에 sub-agent 가 한도/네트워크 오류로 STATUS 라인을 만들지 못한 경우 main 이 응답 본문 키워드 매칭으로 분류하는 규칙 + 패턴 리스트 명시.
- **C3 (재해석) — role-specific prompt body**: `lib/role_instructions.py` 신설 — 13 reviewer + 5 checker 의 `ko_title`·`perspective`·`checklist` 를 single source 로 보관. orchestrator 의 `build_agent_prompt_body(agent_name, ...)` 가 role 마다 다른 본문 (`_prompts/<role>.md`) 을 생성 — system prompt 와 이중 강화로 역할 격리 보장.
- **C1, C2 — /loop 호출 형식 명시**: `AI_REVIEW_LOOP=1` env prefix 의 정확한 명령 라인, ScheduleWakeup prompt 의 `/loop /<slash> --resume <session_dir>` 절대경로 표기.
- **C4 — `_retry_state.json` 갱신 필드 명시**: SKILL.md 단계 5 에 갱신 필드 6개(`agents_*`, `agent_history`, `rate_limit_episodes`, `last_reset_hint_sec`, `wake_history`, `total_wait_sec`) 명시.
- **D1, D2 — output_file 검증 + STATUS 정규식 파싱**: SKILL.md 단계 4 에 보강. sub-agent 본문에도 "Write 실패 시 success 거짓 보고 금지" 추가.
- **B1, B2, B3 — stale path / slash 누락 동기화**: SKILL.md·README.md 의 `REVIEW_OUTPUT_DIR` 기본값 → `./review/code`, project-planner SKILL.md 의 옛 flat path → nested, developer SKILL.md 의 `consistency-checker` → `/consistency-check`.
- **E1, E2 — 가독성**: 18개 sub-agent definition 의 호출 규약·상태 결정 섹션을 통일 패턴으로 일괄 재생성 (`lib.role_instructions` 가 single source). commands 의 step 번호에 0 (사전 점검 — worktree 확인) 추가해 SKILL.md 와 일관.
- Smoke: reviewer 3종 + checker 3종 prompt 가 role-specific 으로 다르게 생성됨, `--resume` valid/invalid 분기 정상.

- [ ] 23. 통합 보강 follow-up 커밋 + push.

## Follow-up — summary sub-agent self-discovery (commit 3)

main 이 매 사이클마다 임시 markdown 을 만들어 summary sub-agent 에 전달하던 단계를 제거. summary sub-agent 가 `session_dir=<...>` 한 인자만 받고 자기 컨텍스트에서 `_retry_state.json` → `subagent_invocations[*].output_file` → `meta.json` 을 직접 Read 해 통합 보고서를 작성하도록 단순화.

- 변경: `.claude/agents/code-review-summary.md`, `.claude/agents/consistency-summary.md` 의 호출 규약 + 수행 절차.
- 동반 갱신: code-review-agents/SKILL.md (단계 6), consistency-checker/SKILL.md (단계 5), commands/ai-review.md, commands/consistency-check.md.
- retry_state 스키마 변경 없음 — `summary_subagent_type` / `summary_output_file` 필드가 summary sub-agent 내부에서 직접 참조된다.
- main 의 절차에서 "임시 `_summary.md` 작성" step 제거 → main 의 turn 길이 1단계 감소, conversation 안에 본문이 들어가지 않아 격리 강화.

- [ ] 22. summary self-discovery follow-up 커밋 + push.

## 검증

1. drift: 20 subagent definition 의 frontmatter 가 Claude Code 가 로드
   가능한 schema 인지 확인.
2. 수동 1: 작은 diff 가 있는 worktree 에서 `/ai-review` → 13 Agent 호출 →
   각 review.md + SUMMARY.md 생성.
3. 수동 2: 한 sub-agent prompt 를 임시로 "강제 STATUS=rate_limit" 로 만들고
   `/loop /ai-review` 진입 → ScheduleWakeup 예약·재진입·재호출 검증.
4. 회귀: hooks.json PostToolUse 제거 후 자동 trigger 가 fire 하지 않는지.

## 비-목표

- `claude -p` 의 동시 실행 성능 보존 (Agent tool 의 병렬성에 위임).
- 13개 sub-agent prompt 내용 자체의 품질 개선.
- /loop 외 자동 재시도 메커니즘 (cron 등 검토 가능하나 본 작업 범위 밖).
