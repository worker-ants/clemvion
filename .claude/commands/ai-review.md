역할 기반 sub-agent 코드 리뷰

## 실행 방법 (main Claude 가 따른다)

`claude -p` 호출은 더 이상 지원하지 않는다. 13개 reviewer 는 모두 `.claude/agents/<role>-reviewer.md` 에 정의된 sub-agent 이며, main Claude(이 세션) 가 `Agent` tool 로 직접 invoke 한다.

0. **사전 점검**: 현재 worktree 확인 (CLAUDE.md "Worktree 기반 작업 정책"). main 워크트리에서 호출되면 worktree 안내 후 거부.

1. **세션 준비**: 아래 orchestrator 를 실행하면 세션 디렉토리·prompt 파일·재시도 상태 파일을 만들고 절대경로를 stdout 에 출력한다 (model 호출 없음).
   ```bash
   # /loop 밖
   python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS
   # /loop 안 (loop_mode=true 초기화)
   AI_REVIEW_LOOP=1 python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare $ARGUMENTS
   # wake 사이클 — `$ARGUMENTS` 에 `--resume <session_dir>` 이 들어있을 때
   python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --resume <session_dir>
   ```
   stdout 의 각 줄이 하나의 세션 디렉토리(batch). 일반적인 경우 1줄.

2. **상태 파일 로드**: `<session_dir>/_retry_state.json` 을 Read.
   - `subagent_invocations` — `{name, subagent_type, prompt_file, output_file}` 목록.
   - `agents_pending` — 아직 성공·fatal 로 확정되지 않은 reviewer 들.
   - `agents_skipped` / `agents_forced` — router 결정 적용 결과.
   - `router_subagent_type`, `router_output_file`, `routing_status` (pending|done|skipped), `routing_skip_reason`.
   - `summary_subagent_type`, `summary_output_file` — summary 단계용.

2.5. **라우터 호출** (`routing_status=="pending"` 일 때만, 첫 사이클에서 1회): `Agent(subagent_type="review-router", prompt="prompt_file=<router_prompt_file>\noutput_file=<router_output_file>")` 한 번. router 는 `_prompts/_router.md` 의 변경 코드 본문을 reviewer 와 동일한 수준으로 받고 자유 탐색한다. 정상 응답이면 `_routing_decision.json` 의 `decisions[].selected==false` 인 reviewer 들을 `agents_pending` 에서 `agents_skipped` 로 옮긴다. `agents_forced` 는 무조건 pending 유지. **선택된 수 가드**: filter 후 `agents_pending` 이 0명이면 13명 fallback **하지 않고** main 이 minimal SUMMARY.md ("이 변경에 적용 가능한 reviewer 없음") 만 작성하고 종료. 1명 이상이면 그대로 진행. `STATUS=fatal` 이고 `_routing_decision.json` 이 "no applicable reviewer" 사유면 동일 minimal SUMMARY 경로. 그 외 `STATUS=fatal` (router 자체 오류) → 전체 reviewer fallback. `STATUS=rate_limit/network` → `routing_status="pending"` 유지하고 ScheduleWakeup (loop 안일 때). 처리 후 `routing_status="done"` 으로 갱신 → resume 사이클에서 자동 skip.

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
   - `agents_pending` 가 비면 → summary sub-agent 호출: `Agent(subagent_type="code-review-summary", prompt="session_dir=<session_dir>")`. summary sub-agent 가 자기 컨텍스트에서 `_retry_state.json` 과 실제 실행된 reviewer 들의 `output_file` 을 Read 해 통합한 후 `summary_output_file` 에 Write (skipped 된 reviewer 는 SUMMARY 의 "라우터 결정" 섹션에 표기). 완료되면 사용자에게 `SUMMARY.md` 의 핵심을 1-2문단으로 요약.
   - `agents_pending` 가 남고 `loop_mode=true` 이면 `ScheduleWakeup(delay=last_reset_hint_sec or 1800, prompt="/loop /ai-review --resume <session_dir>", reason="rate-limit retry for N agents")` 호출 후 한 줄 안내 출력하고 turn 종료. 다음 wake 가 `/loop /ai-review --resume <session_dir>` 으로 발화되면 orchestrator 를 `--resume <session_dir>` 으로만 호출 → 동일 session 의 `_retry_state.json` 으로 step 2 부터 재진입.
   - `agents_pending` 가 남고 `loop_mode=false` 이면 partial SUMMARY 작성 후 사용자에게 `/loop /ai-review` 로 재시작 안내.

7. **/loop 결합 시**: `/loop /ai-review` 로 호출되면 첫 사이클에서 `AI_REVIEW_LOOP=1` 환경변수를 prefix 로 추가해 `--prepare` 호출 (loop_mode=true 로 초기화). 이후 wake 사이클은 ScheduleWakeup prompt 안에 박힌 `--resume <session_dir>` 인자로 orchestrator 를 호출 — 새 session 을 만들지 않고 기존 session 의 `_retry_state.json` 을 그대로 재진입.

8. **자동 후속 흐름** (SUMMARY → 이슈 해결 → e2e → 재리뷰): SUMMARY.md 의 Critical / Warning 이 1건 이상이면 main 이 다음을 자동 수행 (단계 8 의 자세한 절차는 SKILL.md 참고):
   - 발견사항을 **spec 관련** / **코드 관련** 으로 분류.
   - spec 관련 → `project-planner` 절차 (draft → `/consistency-check --spec` → `BLOCK: NO` 시 spec 반영). `BLOCK: YES` 면 자동 진행 중단.
   - 코드 관련 → `developer` 절차 (수정 + 단위 테스트 + commit).
   - 모두 처리 후 **로컬 e2e 의무 실행** — 명령은 `PROJECT.md §빌드·린트·테스트 명령` (예: `make e2e-test` / `make e2e-test-full`), 면제 화이트리스트는 `PROJECT.md §e2e 면제 화이트리스트`. **skip 절대 금지** — `[skip-e2e]` 표기 사용 금지, CI/GitHub Action 으로 미루지 말 것, 단위·통합 테스트로 대체 금지, "변경 영역이 작아서" 판단 금지.
   - e2e 통과 → `RESOLUTION.md` 작성 + 종료.
   - e2e 실패 → 원인 분석 + 추가 fix (최대 3회). 그 뒤에도 실패하거나 사전 결함이면 자동 진행 중단 + 사용자 보고.
   - INFO 등급은 RESOLUTION 에 추적 항목으로만 기록.

   안전 가드 — 자동 진행 중단 사유: consistency-check `BLOCK: YES`, e2e 누적 3회 실패, 직전 수정과 무관한 사전 결함, **e2e 인프라 실행 불가** (Docker daemon 미동작 등 — e2e 자체 skip 은 금지이므로 이 경우만 환경 복구 요청), 의미 변경 큰 자동 수정 (DB 마이그레이션·외부 API 계약 등), SUMMARY 본문이 "사용자 결정 필요" 명시한 항목.

## 사용 예시

### Git diff 기준 (기본)
- `/ai-review` — git diff 기준 (staged + unstaged + untracked). 기본 `--route=auto` 로 router 가 reviewer 선별.
- `/ai-review --staged` — staged 변경만
- `/loop /ai-review` — 사용량 한도가 풀릴 때까지 자동 재시도

### Git 커밋·범위·브랜치 기준
- `/ai-review --commit abc1234`
- `/ai-review --range HEAD~5..HEAD`
- `/ai-review --branch main`

### 특정 파일·경로 기준
- `/ai-review src/main.py`
- `/ai-review src/components/`

### Reviewer 선별 제어
- `/ai-review` — 기본. router 자동 선별 (`--route=auto`).
- `/ai-review --route=all` — router skip, 전수 reviewer 실행 (보안 감사·릴리스 직전 등).
- `REVIEW_AGENTS=security,performance /ai-review` — 사용자가 직접 명시 → router 자동 skip.
