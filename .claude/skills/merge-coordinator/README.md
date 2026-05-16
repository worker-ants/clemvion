# Merge Coordinator

다수 PR/branch 의 통합 전·중·후 검토와 conflict 해결을 6개 sub-agent 위임으로 수행하는 skill. main Claude 가 `Agent` tool 로 격리 컨텍스트에서 호출.

## 아키텍처 한 줄 요약

```
/merge-coordinate <PRs/branches>
   │
   ▼
main Claude
   Phase 0 — 입력 정규화 → 사용자 confirm
   Phase 1 — orchestrator --prepare → 4 analyzer 병렬 → integration-risk-summary
            → SUMMARY.md (BLOCK 결정)
   Phase 2 — BLOCK=NO 면 통합 계획 표시 → 사용자 confirm
   Phase 3 — 격리 worktree(.claude/worktrees/integrate-<slug>/) 에서 순서대로
            merge/rebase → conflict 발생 시 merge-conflict-resolver invoke
            → 사용자 confirm 후 git apply → 모두 통합 완료
            → /ai-review + /consistency-check 자동 chain → BLOCK 시 롤백 권고
```

자동 chain 의 두 skill 은 sub-agent 위임 패턴 동일 — 본 skill 의 orchestrator 가 직접 두 skill 의 orchestrator 를 sub-process 로 실행하고, main 이 각 결과 SUMMARY 를 검사.

## 빠른 시작

```bash
# PR 번호로
/merge-coordinate 123 456

# branch 이름으로
/merge-coordinate feature/auth feature/billing

# 혼용 + base 힌트
/merge-coordinate --base-hint develop 123 feature/foo

# 사용량 한도 자동 재시도
/loop /merge-coordinate 123 456

# wake 사이클 (자동 발화)
/loop /merge-coordinate --resume /abs/path/to/review/merge/.../HH_MM_SS
```

## 6개 sub-agent

| sub-agent type | 호출 규약 | 역할 |
|----------------|----------|------|
| `merge-conflict-analyzer` | `prompt_file`+`output_file` | text-level conflict 예측 |
| `semantic-conflict-analyzer` | `prompt_file`+`output_file` | signature/behavior/invariant 충돌 |
| `integration-order-planner` | `prompt_file`+`output_file` | base + 통합 순서 결정 |
| `cross-branch-spec-analyzer` | `prompt_file`+`output_file` | branch 간 spec/plan 충돌 |
| `integration-risk-summary` | `session_dir` only | 4 analyzer 결과 통합 + BLOCK 결정 |
| `merge-conflict-resolver` | `prompt_file`+`output_file` | 단일 conflict patch 제안 (apply 안 함) |

reviewer/checker 와 동일한 STATUS 한 줄 반환 규약:
```
STATUS=<success|rate_limit|network|fatal> ISSUES=<n> PATH=<output_file> RESET_HINT=<sec 또는 빈 값>
```

resolver 의 patch 본문은 응답이 아닌 `output_file` 에 기록.

## 산출물 디렉토리 구조

```
review/
└── merge/
    └── 2026/05/15/13_30_00/
        ├── _prompts/
        │   ├── merge_conflict_analyzer.md
        │   ├── semantic_conflict_analyzer.md
        │   ├── integration_order_planner.md
        │   └── cross_branch_spec_analyzer.md
        ├── _conflicts/                    ← Phase 3 동적 생성
        │   ├── 1.md (conflict info), 1.patch (resolver 출력)
        │   └── ...
        ├── _retry_state.json
        ├── meta.json
        ├── merge_conflict_analyzer.md    ← analyzer 별 결과 (<analyzer>.md)
        ├── semantic_conflict_analyzer.md
        ├── integration_order_planner.md
        ├── cross_branch_spec_analyzer.md
        ├── SUMMARY.md
        └── RESOLUTION.md (선택)
```

## `_retry_state.json` 추가 필드

`code-review-agents` / `consistency-checker` 의 기본 스키마에 다음 필드를 더한다:

```jsonc
{
  // ... (기본 필드는 ../code-review-agents/README.md 참고)
  "resolver_invocations": [
    {
      "conflict_id": 1,
      "file": "/abs/.../path/in/integration-worktree",
      "ours_branch": "feature/a",
      "theirs_branch": "feature/b",
      "prompt_file": "/abs/.../_conflicts/1.md",
      "output_file": "/abs/.../_conflicts/1.patch",
      "status": "success",
      "applied": true,
      "ts": "2026-05-15T13:32:11Z"
    }
  ],
  "auto_apply_patch": false,
  "branches": [
    {"name": "feature/a", "sha": "...", "source": "PR#123", "title": "..."},
    {"name": "feature/b", "sha": "...", "source": "branch:origin/feature/b", "title": ""}
  ],
  "base": "main"
}
```

## conflict 해결 흐름

1. main 이 `git merge <branch>` 시도 → conflict 발생.
2. `_conflicts/<n>.md` 작성 — 충돌 정보 (path, base/ours/theirs hunk, branch identifier).
3. `Agent(subagent_type="merge-conflict-resolver", prompt="prompt_file=<...>/<n>.md\noutput_file=<...>/<n>.patch")` invoke.
4. STATUS 한 줄 받음:
   - `STATUS=success` → main 이 `<n>.patch` Read → 사용자에게 보여줌 → confirm 후 `git apply` (또는 `MERGE_AUTO_APPLY_PATCH=1` 시 자동 apply).
   - `STATUS=fatal` → main 이 `<n>.patch` 의 markdown 충돌 사유를 사용자에게 보여줌 → 수동 해결 대기.
5. resolver invocations 에 결과 append → `_retry_state.json` 갱신.

## /loop 결합 — 무한 재시도

ai-review · consistency-check 와 동일. ScheduleWakeup delay = `last_reset_hint_sec` 또는 `RETRY_WAKE_DEFAULT_SEC` (1800s). cap = `RETRY_WAKE_CAP_SEC` (3600s).

## 환경변수

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `MERGE_OUTPUT_DIR` | `./review/merge` | 세션 디렉토리 부모 |
| `MERGE_BASE_HINT` | (없음) | base 힌트 |
| `MERGE_AUTO_APPLY_PATCH` | `0` | `1` 이면 success patch 자동 apply (기본 OFF) |
| `MERGE_MAX_PROMPT_SIZE` | `131072` | analyzer prompt body 상한 |
| `AI_REVIEW_LOOP` | `0` | `/loop` 결합 시 자동 설정 |
| `RETRY_WAKE_DEFAULT_SEC` | `1800` | wake delay 기본 |
| `RETRY_WAKE_CAP_SEC` | `3600` | wake delay 상한 |

## 디버그 로그

`/tmp/merge-coordinator-log.txt` 에 orchestrator 의 prepare/resume 이벤트 기록. model 호출 자체는 main session 의 transcript 에 남는다.

## 기존 skill 활용 지점

- **lib 재사용**: `code-review-agents/lib/session.py` (세션 디렉토리·meta·logger), `code-review-agents/lib/role_instructions.py` (ANALYZER_INSTRUCTIONS dict 추가) 그대로 import.
- **자동 chain**: Phase 3 마지막에 `code_review_orchestrator.py --prepare --range <base>..HEAD` 와 `consistency_orchestrator.py --impl-prep <영역>` 을 sub-process 로 실행. main 이 각 SUMMARY 검사.
- **공통 규약**: STATUS 반환 한 줄, output_file Write, `_retry_state.json` 스키마, `--resume`, `/loop` ScheduleWakeup, nested ISO 산출물 경로 — 모두 동일.

## 비-목표

- `gh pr merge` 자동 호출.
- main branch 로의 최종 push 자동화.
- conflict resolver 가 직접 `git apply` 실행 (apply 는 항상 main 책임).
- integration worktree 자동 정리 (`git worktree remove`) — 사용자 결정.
