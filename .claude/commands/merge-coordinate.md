다수 PR/branch 의 통합 전·중·후 검토 + conflict 해결 위임

## 실행 방법 (main Claude 가 따른다)

6개 sub-agent (4 analyzer + 1 summary + 1 resolver) 가 `.claude/agents/` 에 정의되어 있으며, main Claude(이 세션) 가 `Agent` tool 로 직접 invoke 한다. `claude -p` 호출은 사용하지 않는다.

0. **사전 점검**: 현재 worktree 확인 (CLAUDE.md "Worktree 기반 작업 정책"). main 워크트리에서 호출되면 worktree 안내 후 거부.

### Phase 0 — 입력 정규화 + 사용자 confirm

1. `$ARGUMENTS` 에서 PR 번호(숫자)·branch 이름(그 외) 분리.
2. PR 번호는 `gh pr view <n> --json headRefName,baseRefName,title,state,headRefOid` 로 검증.
3. branch 이름은 `git fetch origin <name>` + `git rev-parse --verify` 로 검증.
4. 정규화된 N개 목록을 사용자에게 제안 (`이 N개를 통합합니다. base 힌트: ...`) → confirm.

### Phase 1 — 세션 준비 + analyze 병렬

```bash
# /loop 밖
python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --prepare $ARGUMENTS

# /loop 안
AI_REVIEW_LOOP=1 python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --prepare $ARGUMENTS

# wake 사이클 (`$ARGUMENTS` 에 `--resume <session_dir>` 포함)
python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --resume <session_dir>
```

stdout 마지막 줄이 세션 디렉토리. `_retry_state.json` Read (경로뿐) 후 analyze→summary 를 `Workflow` tool 이 결정적으로 처리한다 (옛 fan-out→update→summary 수작업 대체). Workflow 의 `agent()` 는 plan-metered harness 경로라 빌링 정책 부합:

```
Workflow(name="merge-coordinate", args={invocations, branches, base, summary})
```

매핑: `invocations=subagent_invocations`, `summary={subagent_type: summary_subagent_type, output_file: summary_output_file}`, `branches`·`base` 동명. Workflow 가 4 analyzer 병렬(각자 prompt_file Read·output_file Write) → `integration-risk-summary` 가 통합 SUMMARY 를 `summary_output_file` 에 Write 시도하고 **항상 status 헤더 + 전문** 반환. 완료 시 Workflow 는 `summary_output`(경로) + `summary_markdown`(전문, 항상) + `summary_written` + `block` 반환. **반드시** `summary_markdown` 을 `summary_output` 에 Write 한다 (`summary_written` 값과 **무관하게 멱등 persist** — workflow 의 terminal summary write 는 차단될 수 있고 workflow 스크립트는 FS 접근이 없으므로 디스크 단일 진실의 신뢰 경로는 main 의 이 Write 다). 그 다음 반환의 `block` (YES/NO) 으로 판정. `unfinished[]` 있으면 해당 analyzer 재실행.

> **Phase 1 만 Workflow** — Phase 2~4(confirm·git execute·conflict resolver·chain)는 bespoke 유지. 절차 SSOT: [SKILL.md](../skills/merge-coordinator/SKILL.md).

**Workflow 불가 시 fallback** — 4 analyzer 를 **한 응답 안에서** 병렬 `Agent` invoke (prompt `prompt_file=<...>\noutput_file=<...>`) → STATUS 파싱·`--update` ([SKILL.md 단계 3-fallback](../skills/merge-coordinator/SKILL.md)) → `Agent(subagent_type="integration-risk-summary", prompt="session_dir=<session_dir>")`.

### Phase 2 — 계획 확정 (사용자 confirm)

Phase 1 반환의 `block` 으로 판정 (SUMMARY.md 전문 재Read 불필요):
- **YES** → Critical 위험 1-2 문단 요약 후 종료.
- **NO** → SUMMARY.md 의 "통합 순서 표" + "예상 conflict 표" + "사용자 confirm 필요 지점" 표시 → confirm. (이 표들이 필요하면 그때 SUMMARY.md 를 Read.)

### Phase 3 — Execute (격리 worktree)

1. `git worktree add .claude/worktrees/integrate-<slug>/ -b claude/integrate-<slug> <base>` (base 는 planner 가 결정).
2. 통합 순서대로 `git merge <branch>` 또는 `git rebase <branch>`.
3. conflict 발생 → main 멈춤:
   - `_conflicts/<n>.md` 작성 (path, base/ours/theirs hunk, branch).
   - `Agent(subagent_type="merge-conflict-resolver", prompt="prompt_file=<n>.md\noutput_file=<n>.patch")`.
   - `STATUS=success` → patch 사용자에게 보여줌 → confirm 후 `git apply <n>.patch` (또는 `MERGE_AUTO_APPLY_PATCH=1` 시 자동).
   - `STATUS=fatal` → markdown 충돌 사유 표시 → 사용자 수동 해결 대기.
   - resolver 호출 기록을 `_retry_state.json` 의 `resolver_invocations` 에 append.
4. 모든 branch 통합 완료 → 자동 chain:
   ```bash
   python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare --range <integration_base>..HEAD
   python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --impl-prep <영향 spec 영역>
   ```
   두 세션 모두 본 skill 흐름과 동일 (Agent 병렬 → SUMMARY → BLOCK 확인). 둘 중 BLOCK 시 사용자 보고 + 롤백 권고.
5. 모두 통과 → 통합 결과 path 안내. **최종 PR/푸시는 사용자 결정** (자동 X).

### 7. /loop 결합

`/loop /merge-coordinate <args>` 호출 시 `AI_REVIEW_LOOP=1` prefix. wake prompt 는 `/loop /merge-coordinate --resume <session_dir>` 형태로 박아 둠. wake 사이클은 orchestrator 를 `--resume` 으로만 호출 → 동일 session 의 상태 파일 재진입.

## 사용 예시

- `/merge-coordinate 123 456` — PR 두 개
- `/merge-coordinate feature/auth feature/billing` — branch 두 개
- `/merge-coordinate --base-hint develop 123 feature/foo` — base 힌트 + 혼용
- `/loop /merge-coordinate 123 456` — 사용량 한도 자동 재시도

## 산출물

- `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` — 통합 보고서 + BLOCK 결정
- `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/<analyzer>.md` — 4 analyzer 별 상세
- `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_retry_state.json` — pending/success/fatal + resolver invocations + branches/base
- `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_prompts/<analyzer>.md` — orchestrator 가 만든 페이로드
- `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_conflicts/<n>.{md,patch}` — Phase 3 conflict 정보 + resolver patch

## 환경변수

자세한 옵션은 `.claude/skills/merge-coordinator/SKILL.md` 참고. 주요 변수:
- `MERGE_OUTPUT_DIR` (기본 `./review/merge`)
- `MERGE_BASE_HINT` — base 힌트
- `MERGE_AUTO_APPLY_PATCH` — `1` 이면 success patch 자동 apply (기본 OFF)
- `MERGE_MAX_PROMPT_SIZE` (기본 131072)
- `AI_REVIEW_LOOP` — /loop 결합 시 자동
