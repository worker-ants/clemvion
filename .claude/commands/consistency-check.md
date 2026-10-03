spec / plan / 구현 착수 전 다관점 일관성 검토 (sub-agent 위임)

## 실행 방법 (main Claude 가 따른다)

checker(정의 5개, 이 저장소는 `plan_coherence` 를 꺼서 4개가 돈다)는 `.claude/agents/<checker>-checker.md` sub-agent 다. fan-out 은 `Workflow` tool 이 결정적으로 처리한다 (옛 수동 Agent fan-out + STATUS/retry 루프 대체). Workflow 의 `agent()` 는 plan-metered harness 경로라 빌링 정책 부합 (CLAUDE.md §외부 LLM 호출 정책). 절차 SSOT: [`.claude/skills/consistency-checker/SKILL.md`](../skills/consistency-checker/SKILL.md).

0. **사전 점검**: 현재 worktree 확인. main 워크트리 호출 시 worktree 안내 후 거부.

1. **세션 준비** (model 호출 없음):
   ```bash
   python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py $ARGUMENTS
   ```
   stdout 마지막 줄이 세션 디렉토리 절대경로.

2. **manifest 로드 + Workflow 실행**: `<session_dir>/_retry_state.json` 을 Read (경로뿐, 작음) → `subagent_invocations` / `summary_subagent_type` / `summary_output_file` 추출 → `Workflow(name="consistency-check", args={invocations, summary:{subagent_type, output_file}})`. Workflow 가 checker 병렬 invoke (각 checker 가 자기 `prompt_file` Read → `output_file` Write) 후 `consistency-summary` 가 통합 SUMMARY.md 를 `summary_output_file` 에 **직접 Write** 하고 짧은 status(`BLOCK`) 만 반환. 완료 시 task-notification.

3. **SUMMARY 기록 + BLOCK 결정**: **반드시** 반환의 `summary_markdown` 을 `summary_output` 에 Write 한다 (`summary_written` 값과 **무관하게 멱등 persist** — 하네스가 `SUMMARY.md` **basename** Write 를 어떤 sub-agent 에게도 허용하지 않고(terminal 여부와 무관 — `subagent-call-contract.md §7` 실측표) workflow 스크립트는 FS 접근이 없으므로, 로컬 SUMMARY 의 **유일한** 경로가 main 의 이 Write 다. 판정 근거는 아니다(판정은 NERV 레코드다)). 그 다음 반환의 `block` (YES/NO) 으로 판정. 반환의 `unfinished[]` 가 있으면 해당 checker 만 재실행.
   - **BLOCK: YES** → Critical 위배. 호출자(planner/developer)에게 즉시 보고하고 작업 차단. (`developer` skill 안에서 호출되면 그 작업을 멈춘다.)
   - **BLOCK: NO** → Warning/Info 만 사용자에게 보여주고 진행.
4. **NERV 제출**: checker 마다 `kind=consistency` 로 낸다. 절차는 SKILL §3.5(인자는 `code-review-agents` SKILL §4). 발견은 `nerv_finding_resolve` 로 처분한다.

## 모드 (택일 필수)

- `--spec <path>` — 스펙 초안 검토. NERV 초안을 저장한 뒤 검토 요청 **전에** 호출한다(`nerv_spec_check` 와 함께). `<path>` 는 초안 본문 파일이다.
- `--impl-prep <scope>` — 구현 착수 **직전** 검토. scope 는 NERV 키 · 미러 영역 폴더 · 미러 파일이고 쉼표로 여럿을 준다(예: `CLE-ENG-SPECEVIDENCE,spec/CLE-API/`). 동결된 옛 트리는 받지 않는다.
- `--impl-done <scope>` — 구현 완료 **후** 사후 검증. scope 형식은 위와 같다. 미러 문서의 `## 구현 위치` 가 바꾼 파일을 덮으면 그 문서가 대상에 더해진다. 결과를 checker 마다 `kind=consistency` 로 제출한다(developer 의 의무 단계).

함께 쓰는 옵션: `--focus <keys>`(랭킹에서 앞세울 NERV 키), `--diff-path <path>`(`--impl-done` 의 구현 diff 경로, 하네스 작업은 `.claude`), `--diff-base <ref>`. `--plan` 모드는 4e 에서 걷었다.

## 사용 예시

- `/consistency-check --spec <scratchpad>/CLE-ENG-FOO.md` — `nerv_spec_get(basis=latest)` 로 받은 초안 본문 파일
- `/consistency-check --impl-prep CLE-CHAT-CORE --focus CLE-CHAT-CORE` — 클레임 scope 의 키
- `/consistency-check --impl-done spec/CLE-ENG/ --diff-path .claude` — 하네스 작업
- `/loop /consistency-check --impl-done <키 · 미러 폴더>` — 사용량 한도 자동 재시도

## 산출물

로컬 산출물은 `.review/consistency/` 아래에 쓰고 커밋하지 않는다(gitignore). 결과는 checker 마다 NERV `kind=consistency` 로 제출한다(`python3 .claude/tools/nerv_review_payload.py <session_dir>`).

- `.review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` — 통합 보고서 (BLOCK 결정 명시)
- `.review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/<checker>.md` — checker 별 상세
- `.review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_retry_state.json` — pending/success/fatal 상태
- `.review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_prompts/<checker>.md` — orchestrator 가 만든 입력 페이로드
- `.review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/meta.json` — 모드·target·checker 명단

## 환경변수

자세한 옵션은 `.claude/skills/consistency-checker/SKILL.md` 참고. 주요 변수:
- `CONSISTENCY_AGENTS` (기본은 `.claude.project.json` 이 켠 checker — 이 저장소는 `plan_coherence` 를 뺀 4개. 전체 키: `cross_spec,rationale_continuity,convention_compliance,plan_coherence,naming_collision`)
- `CONSISTENCY_MAX_CONTEXT_SIZE` (기본 262144자)
- `DISABLE_CONSISTENCY_CHECK=1` 로 비활성화 가능 (예외 케이스만)
