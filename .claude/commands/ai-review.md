역할 기반 sub-agent 코드 리뷰.

전체 절차: [`.claude/skills/code-review-agents/SKILL.md`](../skills/code-review-agents/SKILL.md). 본 명령은 진입점 trigger.

## 핵심 흐름 (main Claude 가 따른다)

0. **사전 점검**: worktree 확인.
1. **세션 준비** (model 호출 없음):
   ```bash
   python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS
   # /loop 안: AI_REVIEW_LOOP=1 prefix
   # wake 사이클: --resume <session_dir>
   ```
   stdout 마지막 줄 = 세션 디렉토리.
2. **세션 상태 한 줄 받기**:
   ```bash
   python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --summary-state <session_dir>
   ```
3. **라우터 호출** (`routing=pending` 일 때만, 첫 사이클): `Agent(subagent_type="review-router", ...)`. STATUS=success 면 orchestrator `--apply-routing` 으로 state 갱신.
4. **병렬 reviewer 호출**: pending 의 각 reviewer 를 한 응답 안에서 동시 `Agent` 호출.
5. **STATUS 갱신**: 각 응답에 대해 orchestrator `--update <session_dir> --agent <name> --status <s> [--reset-hint <sec>]`.
6. **수렴**:
   - 모두 완료: `Agent(subagent_type="code-review-summary", prompt="session_dir=<...>")` → SUMMARY.md.
   - 남고 loop: `ScheduleWakeup(prompt="/loop /ai-review --resume <session_dir>")`.
7. **자동 후속 흐름**: SUMMARY 의 Critical/Warning > 0 이면 `Agent(subagent_type="resolution-applier", prompt="session_dir=<...>")`. ESCALATE flag 분기:
   - `no` → 사용자 1-2문장 보고 + 종료
   - `spec` → `/consistency-check --spec <NEEDS_SPEC>` → BLOCK:NO 시 spec 반영 + resolution-applier 재호출
   - `user-decision` / `infra` / `e2e-fail-3x` / `sensitive-fix` → AskUserQuestion 으로 escalate
   - `rate_limit` / `network` → ScheduleWakeup 으로 재예약 (idempotency 복구)

세부 절차·etc: SKILL.md.

## 사용 예시

### Git diff 기준 (기본, router 자동)
- `/ai-review`
- `/ai-review --staged`
- `/loop /ai-review` — 한도 풀릴 때까지 무한 재시도

### Git 커밋·범위·브랜치 기준
- `/ai-review --commit abc1234`
- `/ai-review --range HEAD~5..HEAD`
- `/ai-review --branch main`

### 특정 파일·경로 기준
- `/ai-review src/main.py`
- `/ai-review src/components/`

### Reviewer 선별 제어
- `/ai-review` — router 자동 선별 (`--route=auto`)
- `/ai-review --route=all` — router skip, 전수 실행 (보안 감사·릴리스 직전 등)
- `REVIEW_AGENTS=security,performance /ai-review` — 사용자 명시 → router skip
