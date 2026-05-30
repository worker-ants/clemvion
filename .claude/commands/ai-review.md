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
2. **manifest 로드 + Workflow 실행**: `<session_dir>/_retry_state.json` Read (경로뿐) → `Workflow(name="ai-review", args={invocations, router, routing_status, agents_forced, summary})`. Workflow 가 router 선별(structured 반환) → 선택 reviewer 병렬(각자 prompt_file Read·output_file Write) → `code-review-summary` 가 통합 SUMMARY 를 `summary.output_file` 에 Write 시도(best-effort)하고 **항상 status 헤더 + 전문**을 반환. Workflow 는 `summary_output`(경로) + `summary_markdown`(전문, 항상) + `summary_written` + `risk`/`critical_count`/`warning_count` 를 반환. 완료 시 task-notification.
3. **SUMMARY 디스크 기록 + 위험도 확인**: **반드시** 반환의 `summary_markdown` 을 `summary_output` 에 Write 한다 (`summary_written` 값과 **무관하게 멱등 persist** — workflow 의 terminal summary write 는 차단될 수 있고 workflow 스크립트는 FS 접근이 없으므로 디스크 단일 진실의 신뢰 경로는 main 의 이 Write 다. 건너뛰면 SUMMARY.md 가 디스크에 없어 review-before-stop 가드 미해소). 그 다음 반환의 `risk`/`critical_count`/`warning_count` 로 위험도 확인. `unfinished[]` 있으면 해당 reviewer 재실행.
4. **자동 후속 흐름**: 반환의 `critical_count` + `warning_count` 가 0 보다 크면 `Agent(subagent_type="resolution-applier", prompt="session_dir=<...>")` (이 단계는 코드 수정·commit·e2e 라 bespoke Agent — Workflow 부적합). ESCALATE flag 분기:
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
