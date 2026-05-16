---
worktree: merge-coordinator-d8e9f0
started: 2026-05-15
owner: developer
---

# `/merge-coordinate` skill — 다수 branch 통합 전·중·후 검토 + 충돌 수정 위임

## Context

다수 worktree·PR 이 동시에 진행되는 환경에서, 통합 시점의 충돌은 두 종류:

1. **Text-level** — `git merge` / `git rebase` 의 hunk conflict. 기존 도구로 검출은 가능하지만 자동 수정 능력은 없음.
2. **Semantic** — 같은 spec 영역에 두 branch 가 서로 다른 정의를 도입하거나, 한쪽이 다른 쪽의 가정을 깨는 인터페이스 변경.

기존 `code-review-agents` / `consistency-checker` 는 **단일** 변경을 대상으로 한 사후/사전 검토라 다중 branch cross-conflict 를 못 잡는다. 이번 작업은 그 갭을 메우는 새 skill 을 추가하면서, 두 기존 skill 의 sub-agent 들을 자기 흐름에 통합 호출한다.

## 사용자 결정사항 (반영)

1. 자동 실행 범위: **공격 모드** (분석 + 통합 시도까지 자동). conflict 감지 시점에만 사용자 confirm. `merge-conflict-resolver` 의 patch 적용은 main 이 사용자 confirm 받은 후 apply (resolver 자체는 patch 제안만).
2. 입력 인터페이스: PR 번호와 branch 이름 **둘 다**. main 이 정규화 후 사용자에게 "이 N 개를 통합합니다" 컨펌.
3. 통합 worktree: **신규 worktree** 매번 생성 (`.claude/worktrees/integrate-<slug>/`).
4. base branch: `integration-order-planner` 가 동적 결정 (사용자가 `MERGE_BASE_HINT` 로 힌트 가능).
5. /ai-review · /consistency-check **자동 chain** (Phase 3 통합 직후).
6. `merge-conflict-resolver`: patch 제안만. file Write 는 patch 본문을 `output_file` 에 저장하는 정도. apply 는 main 책임.

## 새 아키텍처

```
사용자: /merge-coordinate <PRs / branches>
       또는 /loop /merge-coordinate ...
   │
   ▼
Phase 0 — 입력 정리
   • PR 번호는 gh CLI 로 → branch 이름·base·title·status 확보
   • branch 이름은 git fetch + show-ref 로 검증
   • 정규화된 [N개 branch] 를 사용자에게 제안 → confirm

Phase 1 — Pre-merge analyze (orchestrator --prepare + 5 sub-agent 병렬)
   merge-conflict-analyzer       text-level conflict 예측, 자동 해결 난이도
   semantic-conflict-analyzer    signature·behavior cross-branch 충돌
   integration-order-planner     topological 순서·base 동적 결정
   cross-branch-spec-analyzer    spec/plan 의 branch 간 충돌
   integration-risk-summary      (session_dir 만 받아 위 4개 통합 → SUMMARY.md, BLOCK 결정)

Phase 2 — 계획 확정
   • BLOCK: YES → 사용자에게 보고 후 종료
   • BLOCK: NO → 통합 순서·base·예상 conflict 표 제시 → confirm

Phase 3 — Execute (격리 worktree, 공격 모드)
   1. .claude/worktrees/integrate-<slug>/ 신설 (base = planner 가 결정)
   2. 통합 순서대로 git merge/rebase
      • conflict 없음 → 계속
      • conflict 발생 → main 멈춤
        → merge-conflict-resolver(prompt_file = conflict 정보, output_file = patch.diff) invoke
        → main 이 patch 를 사용자에게 보여주고 confirm
        → confirm 시 main 이 git apply / hunk 수동 수정 후 commit
        → 거부·미해결 → 사용자 직접 해결 대기 (main 은 그 시점 turn 종료)
   3. 통합 완료 후 자동 chain:
      a. python3 .../code_review_orchestrator.py --prepare --range <integration_base>..HEAD
         → 13 reviewer 병렬 → SUMMARY.md
      b. python3 .../consistency_orchestrator.py --prepare --impl-prep <영향 영역>
         → 5 checker 병렬 → SUMMARY.md
      c. 둘 중 BLOCK: YES → 사용자에게 보고 + 롤백 권고
   4. 모두 통과 → 통합 결과 path 안내. 최종 PR/푸시는 사용자 결정.
```

## 신설 sub-agent (6개, `.claude/agents/`)

| 이름 | 호출 규약 | 역할 |
| --- | --- | --- |
| `merge-conflict-analyzer` | `prompt_file`+`output_file` | text-level git conflict 예측 + 자동 해결 난이도 |
| `semantic-conflict-analyzer` | `prompt_file`+`output_file` | 같은 함수·모듈의 의미 충돌 |
| `integration-order-planner` | `prompt_file`+`output_file` | topological 통합 순서 + base 결정 |
| `cross-branch-spec-analyzer` | `prompt_file`+`output_file` | branch 간 spec/plan 충돌 |
| `integration-risk-summary` | `session_dir` only (self-discovery) | 4 analyzer 결과 통합 + BLOCK 결정 |
| `merge-conflict-resolver` | `prompt_file`+`output_file` | 특정 conflict 의 patch 본문을 output_file 에 Write. 자동 적용 안 함 |

모두 `lib/role_instructions.py` 의 `ANALYZER_INSTRUCTIONS` 에 entry 추가 → orchestrator 가 role-specific prompt body 생성.

## Orchestrator (`merge_coordinator_orchestrator.py`)

기존 두 orchestrator 의 골격과 동일:
- `--prepare` 가 기본. 인자로 PR 번호·branch 이름 (혼용).
- `--resume <session_dir>` /loop wake 용.
- 출력: `review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/{_prompts/<analyzer>.md, _retry_state.json, meta.json}` + stdout last line = session_dir.
- env: `MERGE_OUTPUT_DIR`(`./review/merge`), `MERGE_BASE_HINT`, `MERGE_AUTO_APPLY_PATCH`(`0` 기본).

추가 헬퍼:
- `resolve_pr_to_branch(pr_number)` — `gh pr view <n> --json headRefName,baseRefName,title,state`
- `resolve_branch(branch_name)` — `git fetch origin <branch>` + `git show-ref --verify`
- `branch_diff_stat(branch, base)` — `git diff --stat <base>...<branch>`
- `branch_touched_areas(branch, base)` — frontend/backend/spec/plan 디렉토리별 touched files 분리 (cross-branch-spec-analyzer 의 입력)

## 변경 파일

### 신규
- `.claude/skills/merge-coordinator/SKILL.md`
- `.claude/skills/merge-coordinator/README.md`
- `.claude/skills/merge-coordinator/hooks/merge_coordinator_orchestrator.py`
- `.claude/agents/merge-conflict-analyzer.md`
- `.claude/agents/semantic-conflict-analyzer.md`
- `.claude/agents/integration-order-planner.md`
- `.claude/agents/cross-branch-spec-analyzer.md`
- `.claude/agents/integration-risk-summary.md`
- `.claude/agents/merge-conflict-resolver.md`
- `.claude/commands/merge-coordinate.md`
- `plan/in-progress/merge-coordinator.md` (본 파일)

### 수정
- `.claude/skills/code-review-agents/lib/role_instructions.py` — `ANALYZER_INSTRUCTIONS` dict 추가 (6 entry)
- `CLAUDE.md` — 명명 컨벤션 표 + Skill 체계 표 + Worktree 정책 노트

## 단계

- [x] 1. lib/role_instructions.py 에 6 entry 추가
- [x] 2. merge_coordinator_orchestrator.py 작성 (prepare + resume)
- [x] 3. 6 sub-agent definition 일괄 생성 (스크립트)
- [x] 4. SKILL.md / README.md / slash command 작성
- [x] 5. CLAUDE.md 보강 (명명/저장/skill/worktree 표 모두 갱신)
- [x] 6. smoke test 통과 — `--prepare` 두 cafe24 branch 로 호출 → role-specific prompt 4종 생성, retry_state 의 새 필드 (resolver_invocations, branches, base, auto_apply_patch) 정상, `--resume` valid 분기 정상.
- [~] 7. consistency-check `--plan`: orchestrator `--prepare` 까지만 검증 가능. 실제 sub-agent invoke 검증은 ai-review-subagent merge 후 가능 (`.claude/agents/` 가 main session 에 인식되어야 함).
- [ ] 8. 통합 검증 (follow-up — 사용자 환경 수동):
    - `/merge-coordinate <PR#> <PR#>` 호출 → 4 analyzer 병렬 invoke → SUMMARY.md 의 BLOCK 결정 확인.
    - 통합 자동 chain (`/ai-review` + `/consistency-check`) 가 실제 동작하는지.
    - conflict 발생 시 merge-conflict-resolver invoke + patch 사용자 confirm 흐름.
    - `/loop /merge-coordinate` 의 wake 사이클.
- [x] 9. commit + push (이 단계 직후).

## 검증 결과 (smoke)

| 항목 | 결과 |
| --- | --- |
| `python3 -c "from lib.role_instructions import ANALYZER_INSTRUCTIONS"` | OK (6 entries) |
| orchestrator import (sys.path splice 패턴) | OK |
| `merge_coordinator_orchestrator.py --prepare --branches a,b --base-hint main` | session dir 생성, `_prompts/<4 analyzer>.md` role-specific (각자 다른 perspective + checklist + 통합 대상 branch 메타), `_retry_state.json` 의 새 필드 (`resolver_invocations: []`, `auto_apply_patch: false`, `branches: [...]`, `base: main`) 정상, stdout 마지막 줄에 nested ISO session dir 절대경로. |
| `--resume <session_dir>` valid | session dir echo, exit 0 |
| consistency-check `--plan` orchestrator 호출 | prepare 정상 (실제 plan_coherence sub-agent invoke 는 main session 환경 의존, follow-up 으로 이관) |

## 검증

1. orchestrator import smoke: `python3 -c "import merge_coordinator_orchestrator"`.
2. 환경변수 기본값: `./review/merge/<...>` 로 세션 생성.
3. role-specific prompt 차별화: 5 analyzer prompt 본문이 모두 다른 perspective + checklist.
4. `--resume` valid/invalid 분기.
5. 가상 시나리오: 두 branch (예: 현 worktree 가 base = ai-review-subagent-b7c8d9, 통합 대상 = main) 으로 `--prepare` → conflict 가능성 분석.
6. consistency-check (--plan) 통과 (Critical 0).

## 비-목표

- main 으로의 최종 push / PR merge 자동화 (사용자 결정 유지).
- branch 의 `gh pr merge` 자동 호출.
- 통합 중 abort 자동 처리 (사용자가 abort 결정).
- main 의 `git reset --hard` 자동 (롤백 권고만, 실제 reset 은 사용자).
