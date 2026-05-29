역할 기반 sub-agent 코드 리뷰.

전체 절차: [`.claude/skills/code-review-agents/SKILL.md`](../skills/code-review-agents/SKILL.md). 본 명령은 진입점 trigger.

## 핵심 흐름 (main Claude 가 따른다)

Route → Review → Summary 는 `Workflow` tool 이 결정적으로 처리한다 (옛 라우터→apply-routing→fan-out→update→summary 수작업 대체). Workflow 의 `agent()` 는 plan-metered harness 경로라 빌링 정책 부합. 절차 SSOT: [`.claude/skills/code-review-agents/SKILL.md`](../skills/code-review-agents/SKILL.md).

0. **사전 점검**: worktree 확인.
1. **세션 준비** (model 호출 없음):
   ```bash
   python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS
   ```
   stdout 마지막 줄 = 세션 디렉토리.
2. **manifest 로드 + Workflow 실행**: `<session_dir>/_retry_state.json` Read (경로뿐) → `Workflow(name="ai-review", args={invocations, router, routing_status, agents_forced, summary})`. Workflow 가 router 선별(structured 반환) → 선택 reviewer 병렬(각자 prompt_file Read·output_file Write) → `code-review-summary` 가 통합 SUMMARY 마크다운 **반환**. 완료 시 task-notification.
3. **SUMMARY 기록 + 위험도 확인**: 반환의 `summary_markdown` 을 **main 이 `summary.output_file` 에 Write** (workflow/sub-agent 는 못 씀) → 상단 30줄로 전체 위험도 확인. `unfinished[]` 있으면 해당 reviewer 재실행.
4. **자동 후속 흐름**: SUMMARY 의 Critical/Warning > 0 이면 `Agent(subagent_type="resolution-applier", prompt="session_dir=<...>")` (이 단계는 코드 수정·commit·e2e 라 bespoke Agent — Workflow 부적합). ESCALATE flag 분기:
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
