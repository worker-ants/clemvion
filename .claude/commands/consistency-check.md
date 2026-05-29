spec / plan / 구현 착수 전 다관점 일관성 검토 (sub-agent 위임)

## 실행 방법 (main Claude 가 따른다)

5개 checker 는 `.claude/agents/<checker>-checker.md` sub-agent 다. fan-out 은 `Workflow` tool 이 결정적으로 처리한다 (옛 수동 Agent fan-out + STATUS/retry 루프 대체). Workflow 의 `agent()` 는 plan-metered harness 경로라 빌링 정책 부합 (CLAUDE.md §외부 LLM 호출 정책). 절차 SSOT: [`.claude/skills/consistency-checker/SKILL.md`](../skills/consistency-checker/SKILL.md).

0. **사전 점검**: 현재 worktree 확인. main 워크트리 호출 시 worktree 안내 후 거부.

1. **세션 준비** (model 호출 없음):
   ```bash
   python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py $ARGUMENTS
   ```
   stdout 마지막 줄이 세션 디렉토리 절대경로.

2. **manifest 로드 + Workflow 실행**: `<session_dir>/_retry_state.json` 을 Read (경로뿐, 작음) → `subagent_invocations` / `summary_subagent_type` / `summary_output_file` 추출 → `Workflow(name="consistency-check", args={invocations, summary:{subagent_type, output_file}})`. Workflow 가 checker 병렬 invoke (각 checker 가 자기 `prompt_file` Read → `output_file` Write) 후 `consistency-summary` 로 통합 SUMMARY.md 작성. 완료 시 task-notification.

3. **BLOCK 결정**: SUMMARY.md 작성 후 main 이 그 파일의 상단 30 라인을 Read 해 `BLOCK: YES` 가 있는지 확인. Workflow 반환의 `unfinished[]` 가 있으면 해당 checker 만 재실행.
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
