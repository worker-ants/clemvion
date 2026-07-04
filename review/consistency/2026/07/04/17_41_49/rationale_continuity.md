# Rationale 연속성 검토 — PR2b 동시성 cap admission gate

## 검토 범위

- target: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (PR2b, 커밋 `009022ebb` → `c499da0f2` → `bef981c1f` → `5c3f7980b`)
- 대조 spec: `spec/5-system/4-execution-engine.md` §8 "동시 실행 제한" + `## Rationale` "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)"
- 확인 관점: advisory lock 필수화(TOCTOU 대책), `cancelled`+timeout 분기, admission gate 의 PENDING 전이 한정(non-PENDING 재심사 배제)

payload(`_prompts/rationale_continuity.md`)에는 `spec/5-system/1-auth.md`·`10-graph-rag.md` 발췌만 실려 있고 실제 대상인 `4-execution-engine.md` §8/Rationale 은 누락되어 있었다. 이 갭 때문에 `git -C <worktree>` 로 직접 spec 원문·git 이력·현재 코드를 재확인해 검토를 진행했다.

## 발견사항

검토 결과 CRITICAL/WARNING 없음. 아래는 연속성 확인을 위한 INFO 기록.

- **[INFO]** advisory-lock 미채택 초기 구현이 spec 확정 전에 이미 self-correct 됨
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer` (현재 HEAD, 라인 2613~2692)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)" 3번째 항목("TOCTOU 원자화") + §8 본문 라인 1090("**조건부 UPDATE 단독은 불충분**")
  - 상세: 최초 커밋 `009022ebb`(feat: PR2b 동시성 cap admission gate)의 커밋 메시지는 "TOCTOU-safe, **advisory lock 불요**" 라고 명시하며 조건부 UPDATE 단독 방식을 채택했다. 이는 spec 이 최종적으로 명문화한 "조건부 UPDATE 단독은 불충분 — advisory lock 필수" 원칙과 정면으로 배치되는 접근이었다. 그러나 같은 PR 사이클 내 `/ai-review` 12-reviewer 가 CRITICAL(concurrency: "서브쿼리 COUNT 에 락이 없어 동시 admission 이 같은 스냅샷을 보고 cap 초과, 실 Postgres 재현")로 이를 포착했고, 후속 커밋 `bef981c1f`(PR2b ai-review CRITICAL/Warning 조치)에서 `pg_advisory_xact_lock` 트랜잭션 직렬화로 교체했다. 이 시점에 spec §8/Rationale 도 "advisory-lock 필수" 로 함께 갱신됐다(`bef981c1f` diff 에 `spec/5-system/4-execution-engine.md` 10줄 변경 포함). 현재 HEAD 는 advisory lock 버전만 남아 있고, 기각된 "advisory lock 불요" 버전은 코드에 잔존하지 않는다.
  - 제안: 조치 불필요 — 이미 같은 PR 사이클 안에서 발견·수정·spec 동기화까지 완료된 사례다. "먼저 기각된 대안이 잠깐 코드에 있었다가 ai-review 로 걸러졌다" 는 정상적인 spec-driven 교정 흐름이며, target(현재 HEAD) 자체에는 문제가 없다. 향후 유사 PR 착수 시 "조건부 UPDATE 단독으로 충분하다" 는 재제안이 나오면 본 Rationale 항목(및 실 Postgres 재현 근거)을 인용해 즉시 기각할 근거로 삼을 것.

- **[INFO]** admission gate 의 PENDING 한정 범위가 코드·spec 양쪽에서 정확히 대칭
  - target 위치: `execution-engine.service.ts` `runExecutionFromQueue` (라인 3287~3346) — `RUNNING`(stalled 재배달) 분기는 `admitExecutionOrDefer` 호출 이전에 분리돼 `redriveStuckExecution` 으로 우회, `PENDING` 분기만 admission gate 통과
  - 과거 결정 출처: spec Rationale "admission gate 는 PENDING→RUNNING 최초 진입에만" 항목 (§4.2 `jobId=executionId` dedup 직렬화 불변식 근거)
  - 상세: spec 이 명시한 "stalled 재배달(§7.1)·park 재개(§7.5)는 cap 재심사하지 않는다" 원칙이 코드에서 `execution.status === ExecutionStatus.RUNNING` 분기가 `admitExecutionOrDefer` 호출 완전히 이전에 return 하는 구조로 정확히 구현되어 있다. 원칙 위반 없음.
  - 제안: 없음 (확인 완료 기록).

- **[INFO]** `cancelled`+timeout 분기가 spec 이 기각한 `failed` 대안을 재도입하지 않음
  - target 위치: `execution-engine.service.ts` `markQueueWaitTimeout` (라인 2550~2593)
  - 과거 결정 출처: spec Rationale "`cancelled`(+`error.code`) vs `failed`" 항목 — "노드 실행이 시작조차 안 됨 → 실패보다 취소가 의미 정합"
  - 상세: 구현이 `ExecutionStatus.CANCELLED` + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` + `cancelledBy: 'timeout'` 로 정확히 spec 결정을 따른다. `failed` 상태를 쓰지 않는다.
  - 제안: 없음.

## 요약

PR2b 구현(advisory-lock admission gate·`cancelled`+timeout 분기·PENDING-only 전이)은 현재 HEAD 기준 spec `5-system/4-execution-engine.md` §8 및 그 `## Rationale` "동시성 cap admission gate" 항목과 완전히 정합한다. PR2b 개발 과정에서 한 차례 spec 이 최종적으로 기각한 대안("advisory lock 불요, 조건부 UPDATE 단독")이 최초 커밋에 등장했으나, 같은 사이클의 `/ai-review` 로 즉시 포착되어 advisory-lock 버전으로 교체되고 spec 도 동시에 갱신되었다 — 이는 Rationale 위반이 아니라 정상적인 발견-수정-동기화 사례이며, target(현재 워킹트리 HEAD)에는 잔존하지 않는다. admission gate 의 PENDING 전이 한정 범위, `cancelled` vs `failed` 선택 등 나머지 Rationale 항목도 코드와 정확히 일치한다.

## 위험도

NONE

STATUS: SUCCESS
