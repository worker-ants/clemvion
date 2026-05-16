---
name: merge-coordinator
description: 다수 PR/branch 의 통합 전 충돌·정합성·side effect 를 분석하고, 사용자 confirm 을 거쳐 격리 worktree 안에서 통합을 실행한 뒤, /ai-review · /consistency-check 를 자동 chain 으로 호출하는 skill. 사용자가 "다중 PR 통합", "branch merge 검토", "rebase 충돌 분석", "/merge-coordinate" 를 요청할 때 사용합니다. 6개 sub-agent (4 analyzer + 1 summary + 1 conflict resolver) 를 main Claude 가 Agent tool 로 호출하며, conflict 발생 시 사용자 confirm 후에만 patch 를 적용합니다. 사용량 한도 시 `/loop /merge-coordinate` 와 결합해 ScheduleWakeup 으로 무한 재시도.
---

# Merge Coordinator

다수 worktree·PR 동시 진행 환경에서 통합 시점의 **text-level conflict + semantic conflict + spec/plan cross-conflict** 를 사전에 검출하고, 격리 worktree 안에서 통합을 시도한 뒤 사후 검토(`/ai-review`·`/consistency-check`) 까지 자동 chain 으로 진행한다.

모든 model 호출은 main Claude(이 session) 가 `Agent` tool 로 sub-agent 를 invoke 하는 방식 — `claude -p` 와 Anthropic SDK 직접 호출은 요금제 정책상 사용 불가.

## 언제 사용하는가

- 사용자가 "이 PR 들 통합해줘", "branch A 와 B 를 main 에 머지", "/merge-coordinate ..." 를 요청할 때
- 다수 worktree 가 동시에 진행 중이라 단순 머지 시 충돌 가능성이 있을 때
- 통합 후 정합성 점검까지 한 번에 끝내고 싶을 때

## 6개 sub-agent

| sub-agent type | 역할 |
|----------------|-----|
| `merge-conflict-analyzer` | text-level git conflict 예측 + 자동 해결 난이도 |
| `semantic-conflict-analyzer` | signature·behavior·invariant 충돌 |
| `integration-order-planner` | 의존성 그래프 + topological 순서 + base 동적 결정 |
| `cross-branch-spec-analyzer` | branch 간 spec/plan 영역 충돌 (multi-draft) |
| `integration-risk-summary` | 위 4개 결과 통합 → SUMMARY.md + BLOCK 결정 (session_dir self-discovery) |
| `merge-conflict-resolver` | 단일 conflict 한 건의 patch (unified diff) 제안. 적용은 호출자 책임 |

## 실행 절차 (main Claude 가 따른다)

### 0. 사전 점검

- 현재 worktree 확인 (CLAUDE.md "Worktree 기반 작업 정책"). main 워크트리에서 호출되면 worktree 안내 후 거부.
- 통합 작업은 별도 `.claude/worktrees/integrate-<slug>/` 에서 진행한다 — Phase 3 에서 생성.

### Phase 0 — 입력 정리 (model 호출 없음, 사용자 confirm)

1. 사용자 명령에서 PR 번호 (숫자) 와 branch 이름 (그 외 문자열) 을 분리.
2. PR 번호는 `gh pr view <n> --json headRefName,baseRefName,title,state,headRefOid` 로 정규화.
3. branch 이름은 `git fetch origin <name>` + `git rev-parse --verify <name>` 또는 `origin/<name>` 으로 검증.
4. 정규화된 N개 branch 목록을 사용자에게 제안 — "이 N개를 통합합니다. base 힌트(있으면): ..." → confirm.

### Phase 1 — 세션 준비 + analyze (orchestrator + 4 sub-agent 병렬)

```bash
# /loop 밖
python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --prepare $ARGUMENTS

# /loop 안 (loop_mode=true 초기화)
AI_REVIEW_LOOP=1 python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --prepare $ARGUMENTS

# wake 사이클 — `$ARGUMENTS` 에 `--resume <session_dir>`
python3 .claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py --resume <session_dir>
```

옵션:
- `--prs N1,N2` — PR 번호 명시
- `--branches b1,b2` — branch 이름 명시
- positional 인자도 가능 (`/merge-coordinate 123 456 feature/foo` 처럼 혼용)
- `--base-hint <ref>` — base 힌트 (없으면 PR base 또는 main 자동 결정)

orchestrator 가 만드는 결과 (`review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`):
- `_prompts/<analyzer>.md` — 4 analyzer 별 role-specific 페이로드 (perspective + checklist + branches + 동시 수정 파일/영역)
- `_retry_state.json` — `subagent_invocations`(4) + summary 정보 + `resolver_invocations`(빈 배열, Phase 3 에서 append) + `branches`/`base`/`auto_apply_patch`
- `meta.json` — 통합 대상 메타
- stdout 마지막 줄 = 세션 디렉토리 절대경로

상태 파일 로드 후 4 analyzer 를 **한 응답 안에서 multiple Agent tool calls** 로 병렬 invoke. STATUS 파싱·`_retry_state.json` 갱신은 ai-review 와 동일 규약 ([SKILL.md 단계 4](../code-review-agents/SKILL.md) 참고).

모두 success 가 되면 summary sub-agent 호출:
```
Agent(subagent_type="integration-risk-summary", prompt="session_dir=<session_dir>")
```
SUMMARY.md 작성 후 main 이 그 파일 상단 30 라인을 Read 해 `BLOCK: YES/NO` 확인.

### Phase 2 — 계획 확정 (사용자 confirm)

- **BLOCK: YES** → 사용자에게 Critical 위험 1-2 문단 요약 + 권장 조치 보고 후 종료.
- **BLOCK: NO** → SUMMARY.md 의 "통합 순서 표" + "예상 conflict 표" + "사용자 confirm 필요 지점" 을 사용자에게 표시 → confirm.
- confirm 시 main 이 Phase 3 진입.

### Phase 3 — Execute (격리 worktree, 공격 모드)

1. **통합 worktree 신설**:
   ```bash
   git worktree add .claude/worktrees/integrate-<slug>/ -b claude/integrate-<slug> <base>
   cd .claude/worktrees/integrate-<slug>/
   ```
   `<base>` 는 `integration-order-planner` 가 결정 (or 사용자 힌트). `<slug>` 는 새 random hex.

2. **순서대로 통합**: SUMMARY.md 의 통합 순서 표대로 `git merge <branch>` 또는 `git rebase <branch>`.

   - conflict 없음 → 다음 branch 진행.
   - conflict 발생 → main 멈춤:
     a. main 이 conflict 정보를 임시 markdown 으로 작성: `<session_dir>/_conflicts/<n>.md`. 포함 정보:
        - `path=<conflicted file>`
        - `ours_branch=<...>`, `theirs_branch=<...>`
        - base/ours/theirs hunk (`git show :1:<file>`, `:2:<file>`, `:3:<file>`)
     b. `Agent(subagent_type="merge-conflict-resolver", prompt="prompt_file=<...>/_conflicts/<n>.md\noutput_file=<...>/_conflicts/<n>.patch")` invoke.
     c. STATUS 파싱:
        - `STATUS=success` → main 이 `output_file` 의 patch 본문을 Read 해 사용자에게 보여줌 → confirm 받음 → `git apply <output_file>` 으로 적용 → 다음 conflict 진행.
        - `STATUS=fatal` (의미 충돌) → main 이 `output_file` 의 markdown 을 사용자에게 보여줌 → 사용자 수동 해결 대기 (turn 종료).
     d. `MERGE_AUTO_APPLY_PATCH=1` env 가 설정되어 있으면 `STATUS=success` patch 를 사용자 confirm 없이 자동 적용 (기본 OFF).
     e. main 은 `_retry_state.json` 의 `resolver_invocations` 에 호출 기록 append (`{conflict_id, file, ours_branch, theirs_branch, status, applied}`).

3. **사후 검토 자동 chain** (모든 branch 통합 완료 후):
   ```bash
   # 코드 리뷰 (integration_base..HEAD)
   python3 .claude/skills/code-review-agents/scripts/code_review_orchestrator.py --prepare --range <integration_base>..HEAD
   # 일관성 검토 (영향 받은 spec 영역)
   python3 .claude/skills/consistency-checker/scripts/consistency_orchestrator.py --impl-prep <영향 spec 영역>
   ```
   두 세션 모두 본 skill 의 절차와 동일하게 진행 (Agent tool 병렬 호출 → SUMMARY.md → BLOCK 확인).

   - 둘 중 **BLOCK: YES** → 사용자에게 보고 + 통합 worktree 롤백 권고 (`git worktree remove` 또는 `git reset --hard <integration_base>`).
   - 둘 다 통과 → 통합 결과 path 안내. **최종 PR 생성·push 는 사용자 결정** (자동 X).

### 7. /loop 결합

`/loop /merge-coordinate ...` 가 호출되면:
- 첫 사이클: `AI_REVIEW_LOOP=1` prefix 로 prepare. 또는 wake prompt 가 `--resume <session_dir>` 형태로 발화되면 orchestrator 를 `--resume <session_dir>` 호출.
- wake 사이클: 동일 session_dir 의 `_retry_state.json` 재진입.
- pending 이 비면 ScheduleWakeup 미호출 → /loop 자연 종료.

ScheduleWakeup prompt 는 `/loop /merge-coordinate --resume <session_dir>` 형태로 박아 둠.

## 사용량 한도 처리 정책

ai-review · consistency-check 와 동일. sub-agent 가 `STATUS=rate_limit RESET_HINT=<sec>` 를 보고 → main 이 pending 유지 → `/loop` 안이면 ScheduleWakeup, 밖이면 partial 종료.

## 환경변수

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `MERGE_OUTPUT_DIR` | `./review/merge` | 세션 디렉토리 부모 (nested ISO 분할은 lib.session 이 담당) |
| `MERGE_BASE_HINT` | (없음) | 사용자가 명시하는 통합 base 힌트 (planner 가 우선 검토) |
| `MERGE_AUTO_APPLY_PATCH` | `0` | `1` 이면 resolver 의 success patch 를 사용자 confirm 없이 자동 적용. 기본 OFF (사용자 결정 6) |
| `MERGE_MAX_PROMPT_SIZE` | `131072` | analyzer 1개분 prompt body 상한 (자) |
| `AI_REVIEW_LOOP` | `0` | `1` → `loop_mode=true` 로 초기화 |
| `RETRY_WAKE_DEFAULT_SEC` | `1800` | reset-hint 없을 때 ScheduleWakeup 대기 |
| `RETRY_WAKE_CAP_SEC` | `3600` | wake delay 상한 |

## 기존 skill 과의 관계

- `code-review-agents` 의 lib (`session`, `role_instructions`) 를 그대로 import. orchestrator 패턴·`_retry_state.json` 스키마·`--resume`·`/loop` ScheduleWakeup 모두 공유.
- Phase 3.3 에서 `code_review_orchestrator.py` 와 `consistency_orchestrator.py` 를 직접 sub-process 로 실행해 두 skill 의 sub-agent 들을 자동 chain.
- `developer` skill 의 "구현 직전 consistency-check" 의무는 본 skill 과 무관 (본 skill 은 통합 작업 자체).
- `project-planner` skill 의 spec 작성 흐름과도 무관.

## 산출물 구조

```
review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/
├── _prompts/
│   ├── merge_conflict_analyzer.md
│   ├── semantic_conflict_analyzer.md
│   ├── integration_order_planner.md
│   └── cross_branch_spec_analyzer.md
├── _conflicts/                          ← Phase 3 에서 main 이 생성 (conflict 마다 1 파일 + patch)
│   ├── 1.md, 1.patch
│   └── ...
├── _retry_state.json
├── meta.json
├── merge_conflict_analyzer.md            ← analyzer 별 결과 (<analyzer>.md)
├── semantic_conflict_analyzer.md
├── integration_order_planner.md
├── cross_branch_spec_analyzer.md
├── SUMMARY.md                            ← integration-risk-summary 가 작성
└── RESOLUTION.md                          ← 사용자/main 이 통합 결과 기록 (선택)
```

## 세부 문서

운영 가이드(빠른 시작, `_retry_state.json` 스키마, conflict resolver 동작, /loop 사용법) 는 `./README.md` 참고.
