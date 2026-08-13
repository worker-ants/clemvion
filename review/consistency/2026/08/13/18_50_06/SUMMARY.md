# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — `spec/5-system/` 자체는 이번 diff(`origin/main...HEAD`)로 변경되지 않았고(cross_spec/convention_compliance/plan_coherence/naming_collision 4개 checker 전원 NONE), 실제 변경은 raw-query 결과 shape 방어(`assertRowArray`) 하드닝 4곳 + 회귀 테스트뿐이다. 다만 rationale_continuity 가 그중 admission-throw 재전파 경로의 신규 코드 주석 서술이 `execution-run` 큐의 기존 `attempts:1` 설계 근거(비멱등 노드 이중 실행 방지, 재시도는 크래시 기반 stalled 재배달만 발생)와 어긋나는 오서술("BullMQ 재배달로 자가 치유")을 도입했다고 WARNING 을 제기했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | admission-throw 재전파 경로의 신규 주석이 "BullMQ 재배달 시 재등록되므로 대개 자가 치유"라고 서술하나, `execution-run` 큐는 `attempts:1`(명시적 throw 는 재시도되지 않음 — 비멱등 노드 이중 실행 방지 목적)이라 실제로는 재시도되지 않고 job 이 즉시 dead-letter 된다. 같은 함수의 자매 catch(`runExecution` 호출부)는 정반대로 swallow+best-effort 종결 전략을 쓰는데, 이번 admission catch 는 그 차이를 근거화하지 않고 사실과 다른 서사로 정당화했다 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3671-3685` (`runExecutionFromQueue`, admission catch 및 그 위 주석) | `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:64-78`(`attempts:1` 설계 근거) · `spec/5-system/4-execution-engine.md` §9.3 BullMQ 큐 목록 + §Rationale "PR4 — BullMQ stalled 자동 재배달" · 같은 파일의 자매 catch(:3699-3712, `runExecution` catch, "rethrow 는 이중 실행 유발" 근거) | (a) 코드 정정: admission catch 도 자매 catch 처럼 best-effort 종결(rethrow 없이) 또는 명시적 `cancelled`/`markQueueWaitTimeout` 처리로 바꾸거나, rethrow 유지 시 "admission 단계는 아직 노드 미실행이라 이중 실행 위험이 없다"를 주석에 명시. (b) 코드는 유지하고 주석만 정정: "attempts:1 이라 재시도되지 않고 즉시 dead-letter 된다. Execution 은 pending 에 남아 다음 앱 재기동의 orphan-pending backstop(§Rationale)이 회수할 때까지 대기한다"로 교체. 어느 쪽이든 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 후속 항목으로 등재 권장. (참고: 같은 오서술이 `review/code/2026/08/13/18_38_10/security.md:55` 에도 이미 전파돼 있어 함께 정정 필요) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/5-system/14-external-interaction-api.md` §R8 과 `spec/5-system/15-chat-channel.md` R8 이 서로 다른 결정에 동일 로컬 레이블을 사용 | 두 문서 각각의 R8 절 | 파일별 독립 R1..Rn 번호 매기기가 기존 컨벤션이고 cross-reference 는 항상 문서명 동반이라 실질적 모호성 없음. 액션 불필요 |
| 2 | convention_compliance | orchestrator 가 지정한 target 스코프(`spec/5-system/`)에 이번 diff 변경이 없음 | N/A | 향후 세션에서 diff 범위를 `codebase/` 기준으로 재계산하거나 spec 무변경 턴은 checker 스킵 권장(예산 절약, 액션 불요) |
| 3 | plan_coherence | `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 `worktree:` frontmatter 가 stale(`lint-warning-triage`) — 현재 worktree/브랜치명과 불일치 | `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter | 이번 push 는 `spec-draft-eia-notification-payload-contract.md` 가 독립적으로 "연결된 plan" 조건을 만족시켜 차단되지 않으나, 향후 이 plan 의 잔여 항목만 별도 worktree 에서 처리하면 plan-guard 가 무장 해제될 수 있음. `retry-turn-terminal-guard.md` 선례처럼 `worktree:` 를 현재 값으로 갱신 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/5-system/` 무변경. 코드 diff(assertRowArray 4곳 적용)는 §8 admission gate·§7.5 rehydration·RR-PL-05·EIA §6 종결 이벤트 각 spec 절과 판정 로직 불변으로 대응, 충돌 없음 |
| rationale_continuity | MEDIUM (WARNING 1) | admission-throw 재전파 주석의 "재배달로 자가 치유" 서술이 `execution-run` 큐 `attempts:1` 설계 근거 및 자매 catch 전략과 모순되는 오서술 |
| convention_compliance | NONE | Redis 키·에러 코드·swagger·문서 3섹션 구조 spot-check 전부 위반 없음. target 범위 자체가 이번 diff 로 무변경 |
| plan_coherence | NONE | `backend-lint-gate-broken-on-main.md` 완료/잔여 항목이 코드 diff 와 1:1 대응, 미해소 선행 plan·결정 우회 없음. plan-guard stale frontmatter 는 INFO |
| naming_collision | NONE | `spec/5-system/` 무변경으로 신규 spec 식별자 없음. 코드 신규 식별자(`assertRowArray`, `SNAPSHOT_CACHE_MAX_ENTRIES`) spec 코퍼스와 충돌 없음 |

## 권장 조치사항
1. (WARNING 해소) `execution-engine.service.ts:3671-3685` admission catch 의 "BullMQ 재배달로 자가 치유" 주석을 실제 `attempts:1` 동작(재시도 없음, 즉시 dead-letter, orphan-pending backstop 회수 대기)에 맞게 정정하거나, 코드 자체를 자매 catch 와 동형인 best-effort 종결 전략으로 바꾼다. 같은 오서술이 전파된 `review/code/2026/08/13/18_38_10/security.md:55` 도 함께 정정.
2. (선택) `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter `worktree:` 를 현재 worktree 명으로 갱신해 plan-guard 무장 해제 리스크를 예방.
3. 위 조치는 모두 BLOCK 을 유발하지 않는 개선 사항이며, 이번 push 를 막을 이유는 없다.
