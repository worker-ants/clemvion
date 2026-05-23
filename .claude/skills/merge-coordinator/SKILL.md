---
name: merge-coordinator
description: 다수 PR/branch 의 통합 전 충돌·정합성·side effect 를 분석하고, 사용자 confirm 을 거쳐 격리 worktree 안에서 통합을 실행한 뒤, /ai-review · /consistency-check 를 자동 chain 으로 호출하는 skill. 사용자가 "다중 PR 통합", "branch merge 검토", "rebase 충돌 분석", "/merge-coordinate" 를 요청할 때 사용합니다. 6개 sub-agent (4 analyzer + 1 summary + 1 conflict resolver) 를 main Claude 가 Agent tool 로 호출하며, conflict 발생 시 사용자 confirm 후에만 patch 를 적용합니다. 사용량 한도 시 `/loop /merge-coordinate` 와 결합해 ScheduleWakeup 으로 무한 재시도.
model: sonnet
---

# Merge Coordinator

다수 branch 통합 전·중·후 검토 + conflict 해결 위임. 격리 worktree 안에서 실행. 통합 끝나면 `/ai-review` · `/consistency-check` 자동 chain.

호출 규약·STATUS 라인·재시도 정책: [`.claude/docs/subagent-call-contract.md`](../../docs/subagent-call-contract.md).

## 절대 원칙

- **격리 worktree**: 통합 작업은 `.claude/worktrees/integrate-<slug>/` 안에서만. main 워크트리 직접 통합 금지.
- **사용자 confirm 의무**: SUMMARY.md 의 통합 plan 표를 사용자가 명시 승인한 뒤에만 통합 시작.
- **conflict patch 적용도 confirm 의무**: merge-conflict-resolver 가 만든 patch 는 사용자 결정 후에만 `git apply`.
- **재진입성**: 통합 중 중단되어도 같은 `integrate-<slug>` 로 재진입.

## 6개 sub-agent

| sub-agent | 역할 |
| --- | --- |
| `merge-conflict-analyzer` | text-level git conflict 예측 + 자동 해결 난이도 평가 |
| `semantic-conflict-analyzer` | signature·behavior·invariant cross-impact |
| `integration-order-planner` | 의존성 그래프 + topological 통합 순서 + base 결정 |
| `cross-branch-spec-analyzer` | branch 간 spec/plan 영역 cross-conflict |
| `integration-risk-summary` | 4 analyzer 통합 + BLOCK 결정 |
| `merge-conflict-resolver` | conflict 한 건당 patch 제안 (자동 적용 X) |

## 실행 절차

### Phase 1 — 분석

#### 0. 사전 점검
worktree 확인. main 워크트리에서 호출되면 `.claude/worktrees/integrate-<slug>/` 생성 안내.

#### 1. 세션 준비

```bash
# /loop 밖
python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --prepare --branches <b1>,<b2>,... [--base <base>]
# /loop 안
AI_REVIEW_LOOP=1 python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --prepare --branches ...
# wake
python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --resume <session_dir>
```

stdout 마지막 줄 = 세션 디렉토리.

#### 2. 세션 상태 한 줄 받기

```bash
python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --summary-state <session_dir>
```

한 줄: `pending=<n> success=<n> fatal=<n> branches=<n> base=<branch> last_reset=<sec|null>`.

#### 3. 병렬 analyzer 호출

`agents_pending` 의 4 analyzer 에 대해 **한 응답 안에서** 동시 `Agent` 호출. prompt: `prompt_file=<...>\noutput_file=<...>`.

#### 4. STATUS 파싱·상태 갱신

```bash
python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --update <session_dir> --agent <name> --status <s> [--reset-hint <sec>]
```

#### 5. 수렴 — Summary

모두 완료되면 `Agent(subagent_type="integration-risk-summary", prompt="session_dir=<session_dir>")`. SUMMARY.md 가 작성되면 main 은 상단 30줄 Read → `BLOCK: YES` 또는 `BLOCK: NO`.

### Phase 2 — 사용자 confirm

SUMMARY 의 통합 plan 표 + Critical/Warning 을 사용자에게 1-2문단 요약 + AskUserQuestion 으로 다음 결정 요청:

- **BLOCK: YES**: 통합 중단 사유 보고 + 해소 후 재실행 안내.
- **BLOCK: NO + 통합 진행 승인**: Phase 3 진입.
- **base 변경 / 순서 변경 / 일부 branch 제외**: 사용자 선택 반영해 orchestrator `--update-plan` (별도 옵션) 후 Phase 1 의 일부 재실행.

### Phase 3 — 통합 실행

격리 worktree 안에서 SUMMARY 의 통합 순서대로:

1. base checkout.
2. 각 branch 를 `merge` 또는 `rebase` (SUMMARY 권고대로).
3. **conflict 발생 시**:
   - `<session_dir>/_conflicts/<file>-<n>.md` 에 conflict 정보 작성.
   - `Agent(subagent_type="merge-conflict-resolver", prompt="prompt_file=<...>\noutput_file=<...>")`.
   - patch 결과:
     - `STATUS=success`: patch markdown 을 사용자에게 보여주고 `AskUserQuestion` 으로 적용 confirm. 승인 시 `git apply <output_file>`. 거절 시 사용자 직접 해결 안내.
     - `STATUS=fatal` (의미 충돌): conflict report markdown 을 사용자에게 표시 + 직접 해결 안내.
4. 모든 branch 통합 후 commit.

### Phase 4 — 자동 chain

통합이 끝난 worktree 에서:

1. `/consistency-check --impl-prep <영역>` (영향 spec 영역).
2. `/ai-review --branch <base>`.

두 결과 SUMMARY 를 사용자에게 보고. 후속 fix 가 필요하면 resolution-applier 흐름으로 자동 진입 (`/ai-review` § 6).

## 환경변수

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MERGE_BRANCHES` | (cli 인자) | 통합 대상 쉼표 구분 |
| `MERGE_BASE_HINT` | (orchestrator 결정) | base branch 힌트 |
| `MERGE_OUTPUT_DIR` | `./review/merge` | 세션 디렉토리 부모 |
| `AI_REVIEW_LOOP` | `0` | loop_mode |
| `RETRY_WAKE_DEFAULT_SEC` | `1800` | wake delay |

세션 디렉토리 스키마·conflict 파일 위치: `./README.md`.
