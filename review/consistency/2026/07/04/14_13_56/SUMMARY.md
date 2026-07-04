# Consistency Check SUMMARY — spec-draft-concurrency-cap-pr2b (--spec)

- **Mode**: `--spec` (spec draft 검토, 쓰기 직전 게이트)
- **Target**: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md` (PR2b 동시성 cap + 5분 cancel, priority 3-tier 제외)
- **Date**: 2026-07-04 14:13:56

## BLOCK: NO (5/5) — WARNING 흡수 후 반영

| Checker | Verdict | 핵심 |
| --- | --- | --- |
| cross_spec | **NO** (W×2) | W1: cancelled+`EXECUTION_QUEUE_WAIT_TIMEOUT` 이 기존 `cancelledBy:'user'\|'system'\|'timeout'` enum 매핑 미명시(**'timeout' 값 미사용 — 정확히 이 케이스**). W2: `Workflow.settings` cap 키 write API/RBAC 미정의(Workspace=PATCH .../settings Admin+ vs Workflow=PATCH /api/workflows/:id Editor+ 비대칭). state-machine(pending→cancelled)·§4.2·§7.1 arm 제외·V104 정합. |
| rationale_continuity | **NO** (W) | 같은 배치 이슈(cancelled 코드는 §1.5 RESUME_* 선례). INFO: draft "full B3" 인용 부정확 → §4.2 jobId dedup 불변식 + bounded zombie race. priority 분리·consumer-side gate 정합. |
| convention_compliance | **NO** (W×2) | `EXECUTION_QUEUE_WAIT_TIMEOUT`은 정상 명명 → error-codes.md §3(예외부) 부적절. 3-error-handling §1.4(failed 표)와 cancelled 결과 모순. 키/컬럼/V104 명명 정합. |
| plan_coherence | **NO** (W) | exec-intake L51 "V092 이후" stale(V104 정확). scope 재결정 정확 반영, silent drop 없음. |
| naming_collision | **NO** (INFO) | 5 신규 식별자 충돌 0. INFO: `maxConcurrentExecutions`(settings) vs Parallel `maxConcurrency`(node config) 각주 권장. |

## WARNING 흡수 (반영 시 처리 — 모두 planner 재량, 추가 사용자 결정 불요)

1. **cancelled 매핑 (cross W1)** → `EXECUTION_QUEUE_WAIT_TIMEOUT`: Execution `cancelled` + **`cancelledBy='timeout'`**(기존 미사용 enum 첫 실사용) + `error.code`. WS `execution.cancelled` payload 는 이미 `error?:{code,message?}` 동행(RESUME_* 선례) — 6-websocket-protocol §4.1 payload 에 `cancelledBy`/`error?` 정합 명시.
2. **Workflow settings governance (cross W2)**: workspace cap = `PATCH /api/workspaces/:id/settings`(Admin+), workflow cap = `PATCH /api/workflows/:id`(Editor+, workflow 편집 권한). 비대칭을 §8 에 명시.
3. **error-code 배치 (convention/rationale W)**: error-codes.md 는 **제외**(예외 레지스트리 — 정상 명명 코드는 미등재; EXECUTION_TIME_LIMIT_EXCEEDED 도 자체 행 없음). 3-error-handling 은 §1.4(failed) 아니라 **cancelled 귀결 그룹(§1.5 RESUME_* 인접)** 정합 배치.
4. **full B3 인용 (rationale INFO)** → §4.2 `jobId=executionId` dedup 불변식 + PR3 bounded zombie race 로 정정.
5. **naming INFO**: maxConcurrentExecutions vs Parallel maxConcurrency 각주 1줄.
6. **plan (plan W/INFO)**: exec-intake L51 V092→V104, "Q-scope=전체 한 PR" superseded 각주.

## spec_impact 조정
- **제거**: `spec/conventions/error-codes.md` (예외 레지스트리 — 정상 코드 미등재).
- **추가**: `spec/5-system/6-websocket-protocol.md` (execution.cancelled cancelledBy='timeout'+error? 정합).
- 유지: 4-execution-engine.md, 1-data-model.md, 3-error-handling.md.

## 결론
BLOCK: NO. WARNING 6건 전부 반영 시 흡수(추가 결정 불요). spec 반영 진행.
