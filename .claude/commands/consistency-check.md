spec / plan / 구현 착수 전 다관점 일관성 검토 (sub-agent 위임)

## 실행 방법 (main Claude 가 따른다)

5개 checker 는 모두 `.claude/agents/<checker>-checker.md` 에 정의된 sub-agent 이며, main Claude(이 세션) 가 `Agent` tool 로 직접 invoke 한다.

0. **사전 점검**: 현재 worktree 확인 (CLAUDE.md "Worktree 기반 작업 정책"). main 워크트리에서 호출되면 worktree 안내 후 거부.

1. **세션 준비**:
   ```bash
   # /loop 밖
   python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py $ARGUMENTS
   # /loop 안 (loop_mode=true 초기화)
   AI_REVIEW_LOOP=1 python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py $ARGUMENTS
   # wake 사이클 — `$ARGUMENTS` 에 `--resume <session_dir>` 이 들어있을 때
   python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --resume <session_dir>
   ```
   stdout 마지막 줄이 세션 디렉토리 절대경로. model 호출 없음.

2. **상태 파일 로드**: `<session_dir>/_retry_state.json` 을 Read.

3. **병렬 sub-agent 호출**: pending 의 각 checker 에 대해 한 응답 안에서 multiple `Agent` tool 호출. `subagent_type` 은 `<checker>-checker` (예: `cross-spec-checker`). prompt 는 `prompt_file=<...>` + `output_file=<...>` 두 줄.

4. **STATUS 파싱·상태 갱신**: `STATUS=success|rate_limit|network|fatal` 한 줄 반환. `/ai-review` 와 동일한 규약. `_retry_state.json` 을 Write 로 갱신.

5. **수렴 분기**:
   - 모두 완료 → `Agent(subagent_type="consistency-summary", prompt="session_dir=<session_dir>")` invoke. summary 가 자기 컨텍스트에서 `_retry_state.json` 과 5 checker 의 결과 파일(`<session_dir>/<checker>.md`)을 Read 해 통합 후 `summary_output_file` 에 Write.
   - 남으면 `/ai-review` 와 동일한 ScheduleWakeup 로직. wake prompt 는 `/loop /consistency-check --resume <session_dir>` 형태 (첫 호출의 --spec/--plan/--impl-prep 인자는 보존할 필요 없음 — _retry_state.json 이 이미 invocations 목록을 가지고 있음).

6. **BLOCK 결정**: SUMMARY.md 작성 후 main 이 그 파일의 상단 30 라인을 Read 해 `BLOCK: YES` 가 있는지 확인.
   - **BLOCK: YES** → Critical 위배. 호출자(planner/developer)에게 즉시 보고하고 작업 차단. (`developer` skill 안에서 호출되면 그 작업을 멈춘다.)
   - **BLOCK: NO** → Warning/Info 만 사용자에게 보여주고 진행.

## 모드 (택일 필수)

- `--spec <path>` — spec draft 검토. project-planner 가 `spec/` 본문에 쓰기 **직전** 의무 호출.
- `--plan <path>` — plan draft 검토. plan 작성 단계에서 호출.
- `--impl-prep <scope>` — 구현 착수 **직전** 검토. scope 는 spec 영역 경로 (예: `spec/2-navigation/`).

## 사용 예시

- `/consistency-check --spec plan/in-progress/spec-draft-<area>.md`
- `/consistency-check --plan plan/in-progress/<task>.md`
- `/consistency-check --impl-prep spec/<area>/`
- `/loop /consistency-check --plan plan/in-progress/<task>.md` — 사용량 한도 자동 재시도

## 산출물

- `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` — 통합 보고서 (BLOCK 결정 명시)
- `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/<checker>.md` — 5 checker 별 상세
- `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_retry_state.json` — pending/success/fatal 상태
- `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_prompts/<checker>.md` — orchestrator 가 만든 입력 페이로드
- `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/meta.json` — 모드·target·checker 명단

## 환경변수

자세한 옵션은 `.claude/skills/consistency-checker/SKILL.md` 참고. 주요 변수:
- `CONSISTENCY_AGENTS` (기본 전체 5개 — `cross_spec,rationale_continuity,convention_compliance,plan_coherence,naming_collision`)
- `CONSISTENCY_MAX_CONTEXT_SIZE` (기본 262144자)
- `DISABLE_CONSISTENCY_CHECK=1` 로 비활성화 가능 (예외 케이스만)
