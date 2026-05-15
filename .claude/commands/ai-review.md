역할 기반 sub-agent 코드 리뷰

## 실행 방법 (main Claude 가 따른다)

`claude -p` 호출은 더 이상 지원하지 않는다. 13개 reviewer 는 모두 `.claude/agents/<role>-reviewer.md` 에 정의된 sub-agent 이며, main Claude(이 세션) 가 `Agent` tool 로 직접 invoke 한다.

1. **세션 준비**: 아래 orchestrator 를 실행하면 세션 디렉토리·prompt 파일·재시도 상태 파일을 만들고 절대경로를 stdout 에 출력한다 (model 호출 없음).
   ```bash
   python3 .claude/skills/code-review-agents/hooks/code_review_orchestrator.py --prepare $ARGUMENTS
   ```
   stdout 의 각 줄이 하나의 세션 디렉토리(batch). 일반적인 경우 1줄.

2. **상태 파일 로드**: `<session_dir>/_retry_state.json` 을 Read.
   - `subagent_invocations` — `{name, subagent_type, prompt_file, output_file}` 목록.
   - `agents_pending` — 아직 성공·fatal 로 확정되지 않은 reviewer 들.
   - `summary_subagent_type`, `summary_output_file` — summary 단계용.

3. **병렬 sub-agent 호출**: pending 의 각 reviewer 에 대해 **한 응답 안에서** 여러 `Agent` tool 호출을 동시에 보낸다. 각 호출 인자:
   - `subagent_type`: `<role>-reviewer` (예: `security-reviewer`)
   - `description`: 짧은 한 줄
   - `prompt`: 두 줄 — `prompt_file=<...>` 와 `output_file=<...>` (해당 reviewer 의 `subagent_invocations` 항목에서 그대로 사용)

4. **STATUS 파싱**: 각 sub-agent return value 는 한 줄 형식 `STATUS=<...> ISSUES=<n> PATH=<output_file> RESET_HINT=<sec 또는 빈 값>` 이다.
   - `STATUS=success` → `agents_success` 로 이동.
   - `STATUS=fatal` → `agents_fatal` 로 이동 (재시도하지 않음).
   - `STATUS=rate_limit` 또는 `STATUS=network` → `agents_pending` 유지. `RESET_HINT` 가 있으면 `last_reset_hint_sec` 에 반영, `rate_limit_episodes` 1 증가.

5. **상태 갱신**: `_retry_state.json` 을 Write 로 덮어쓴다 (전체 JSON 직렬화 후 Write).

6. **수렴 분기**:
   - `agents_pending` 가 비면 → summary sub-agent 호출: `Agent(subagent_type="code-review-summary", prompt="session_dir=<session_dir>")`. summary sub-agent 가 자기 컨텍스트에서 `_retry_state.json` 과 13개 reviewer 의 `output_file` 을 Read 해 통합한 후 `summary_output_file` 에 Write. 완료되면 사용자에게 `SUMMARY.md` 의 핵심을 1-2문단으로 요약.
   - `agents_pending` 가 남고 `loop_mode=true` 이면 `ScheduleWakeup(delay=last_reset_hint_sec or 1800, prompt="/loop /ai-review", reason="rate-limit retry for N agents")` 호출 후 한 줄 안내 출력하고 turn 종료. 다음 wake 때 동일 session_dir 로 step 2 부터 재진입 (orchestrator 재실행 없이 기존 세션 재사용 — `REVIEW_OUTPUT_DIR=<session_dir>/..` 로 강제하지 말 것).
   - `agents_pending` 가 남고 `loop_mode=false` 이면 partial SUMMARY 작성 후 사용자에게 `/loop /ai-review` 로 재시작 안내.

7. **/loop 결합 시**: `/loop /ai-review` 로 호출되면 orchestrator 에는 `AI_REVIEW_LOOP=1` 을 전달해 `loop_mode=true` 로 초기화한다. 첫 사이클은 새 session 을 만들지만, 이후 wake 들은 기존 session 의 상태 파일을 그대로 재진입한다 — 새로 `--prepare` 호출하지 말 것.

## 사용 예시

### Git diff 기준 (기본)
- `/ai-review` — git diff 기준 (staged + unstaged + untracked)
- `/ai-review --staged` — staged 변경만
- `/loop /ai-review` — 사용량 한도가 풀릴 때까지 자동 재시도

### Git 커밋·범위·브랜치 기준
- `/ai-review --commit abc1234`
- `/ai-review --range HEAD~5..HEAD`
- `/ai-review --branch main`

### 특정 파일·경로 기준
- `/ai-review src/main.py`
- `/ai-review src/components/`
