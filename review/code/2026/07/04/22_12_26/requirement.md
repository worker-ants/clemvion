# 요구사항(Requirement) Review — orphan pending backstop

## 스코프 보정 메모

전달된 `_prompts/requirement.md` payload 는 파일 1~3(실제 코드/e2e 변경)과 파일 4~10(plan·기존
consistency-check 산출물)만 실었고, 이번 diff 에 실제 포함된 spec 변경 두 파일
(`spec/5-system/4-execution-engine.md`, `spec/data-flow/3-execution.md`) 의 diff 본문은
payload 에 없었다(기존 사례와 동일한 payload mis-scope). 지시에 따라
`git diff origin/main...HEAD` 로 전체 diff 를 직접 확인하고, 코드(`execution-engine.service.ts`
전체 관련 메서드), 마이그레이션(V104/V105), 엔티티(`execution.entity.ts`), 컨트롤러
(`executions.controller.ts` 의 test-hook), 그리고 유닛 테스트 전체 실행 결과를 근거로 검토했다.

## 검토 대상 요약

- 신규 `private recoverOrphanPendingExecutions()` — `status='pending' AND queued_at <
  now - resolveQueueWaitTimeoutMs()` 인 row 를 TypeORM `find(LessThan)` 로 스캔 후 기존
  `markQueueWaitTimeout(id)` 로 개별 cancel.
- `recoverStuckExecutions()` 의 `if (reclaimedIds.length === 0) return;` early-return 제거 →
  stale RUNNING 재구동 유무와 무관하게 항상 `recoverOrphanPendingExecutions()` 호출.
- 유닛 테스트 3건(초과 pending cancel·이내 pending no-op·early-return 제거 통합) + e2e 2건
  (orphan cancelled+에러코드·threshold 가드) 추가.
- spec §8/§7.1/§7.4 "구현 완료" 갱신 + `## Rationale` 신규 소절("orphan pending backstop") +
  `spec/data-flow/3-execution.md` §3.1 mermaid·§3.3 표 동기화.

## 발견사항

- **[INFO]** `plan/in-progress/exec-intake-followups.md` 의 "orphan pending backstop" 체크박스가
  본 PR 에서 갱신되지 않음
  - 위치: `plan/in-progress/exec-intake-followups.md:21` (`- [ ] **orphan pending backstop**...`)
  - 상세: 이번 diff 는 `exec-intake-followups.md` 를 건드리지 않는다(`git diff
    origin/main...HEAD -- plan/in-progress/exec-intake-followups.md` 결과 없음). 하지만 해당
    항목이 정의한 갭("job 소실로 admission 재큐가 안 되는 pending 회수")은 본 PR 로 완전히
    구현됐다. `review/consistency/.../plan_coherence.md` 도 "구현 완료 커밋에 체크박스 갱신
    포함" 을 명시적으로 권고했으나 반영되지 않았다. 기능적 결함은 아니나 plan 라이프사이클
    추적 정합성 문제(완료된 작업이 미완료로 계속 남음)다.
  - 제안: 본 PR(또는 병합 직전)에 `exec-intake-followups.md:21` 을 `- [x]` 로 전환.

- **[INFO]** boot-only orphan 스캔에 batch/limit 이 없음 (기존 `reclaimStuckRunningExecution`
  과 동일 패턴 — 신규 결함 아님)
  - 위치: `recoverOrphanPendingExecutions()` (`execution-engine.service.ts:2906-2923`)
  - 상세: `executionRepository.find()` 에 `take`/`LIMIT` 이 없어 이론상 orphan 이 대량으로
    누적되면 부팅 스캔이 길어질 수 있다. 다만 (a) 이 스캔은 boot-only + best-effort 로 spec
    §8 이 명시("낮은 확률 엣지")했고, (b) 기존 `reclaimStuckRunningExecution` (RUNNING 재구동
    스캔) 도 동일하게 무제한이라 신규 비일관성이 아니다. 각 row 처리는 `markQueueWaitTimeout`
    개별 await(직렬)이라 매우 많은 row 가 쌓이면 부팅 시간에 선형 영향은 있으나, cap gate 가
    존재하는 한 정상 운영에서 pending 적체량 자체가 크지 않다.
  - 제안: 결함 아님 — 실사용 중 orphan 누적이 실제 문제로 확인되면 그때 batch/limit 도입
    검토(현재 스코프 아님).

- **[INFO]** `(status, queued_at)` 복합 인덱스 부재 — boot-only 라 실질 영향 낮음
  - 위치: `recoverOrphanPendingExecutions()` 의 `WHERE status='pending' AND queued_at < :x`
    쿼리, 참고 인덱스 `codebase/backend/migrations/V105__execution_workflow_status_index.sql`
    (`(workflow_id, status)`, admission-gate hot-path 전용)
  - 상세: 기존 `idx_execution_status(status)` 단일 컬럼 인덱스로 pending row 를 좁힌 뒤
    `queued_at` 은 인덱스 없이 필터링된다. admission gate(§8) 처럼 매 요청마다 도는 hot-path
    가 아니라 boot-only 1회 스캔이므로 CRITICAL/WARNING 급 성능 이슈는 아니다.
  - 제안: 결함 아님 — pending 테이블 규모가 커질 경우의 후속 최적화 후보로만 기록.

## 점검 관점별 확인 결과 (모두 이상 없음)

- **기능 완전성**: `admitExecutionOrDefer`(consumer pick-up 시점 wait-timeout 검사)와 동일한
  임계값(`resolveQueueWaitTimeoutMs()`)·동일한 종결 함수(`markQueueWaitTimeout`)를 재사용해
  boot-time backstop 을 완전히 구현했다. `recoverStuckExecutions` 내부 호출 위치가 RUNNING
  재구동 이후·`finally` lock 해제 이전이라 boot 스캔과 test-hook(`runStuckRecoveryScan`) 양쪽
  트리거를 모두 커버한다(코드 확인: `onApplicationBootstrap` → `recoverStuckExecutions`,
  `runStuckRecoveryScan` → `recoverStuckExecutions`).
- **엣지 케이스**: `queued_at IS NULL`(pre-V104 레거시 row) 은 `LessThan` 비교에서 SQL
  `NULL < x` 가 unknown/false 로 평가돼 자연 제외됨 — `execution.entity.ts:54` 의
  `queuedAt: Date | null` 컬럼 정의와 일치. 빈 orphan 목록(`orphans.length === 0`)은 조기
  `return` 으로 `markQueueWaitTimeout` 호출·로그 없이 정상 종료(유닛 테스트로 검증).
- **TODO/FIXME**: 신규 코드에 TODO/FIXME/HACK/XXX 없음.
- **의도와 구현 간 괴리**: 함수명(`recoverOrphanPendingExecutions`)·JSDoc·실제 구현(스캔 조건,
  cancel 액션)이 정확히 일치. `recoverStuckExecutions` 의 early-return 제거도 주석("running
  재점유 유무와 무관하게 항상 스캔한다")과 실제 코드 흐름이 일치.
- **에러 시나리오**: `recoverOrphanPendingExecutions()` 자체에는 try/catch 가 없지만
  `markQueueWaitTimeout` 내부에 이미 try/catch(개별 row 실패 로그 후 다음 계속은 아니고 함수
  종료)가 있고, 상위 `recoverStuckExecutions` 의 `finally` 가 lock 해제를 보장한다(유닛 테스트
  `rejects.toThrow('db down')` → `releaseLock` 호출 검증, 기존 테스트로 회귀 확인됨). loop 중
  특정 row 의 `markQueueWaitTimeout` 이 throw 하면 나머지 row 는 이번 스캔에서 처리되지 않고
  다음 부팅 스캔에서 재시도된다 — best-effort 설계와 일치, 심각한 미정의 동작 아님.
- **데이터 유효성**: `LessThan(staleThreshold)` 비교 대상이 `Date` 타입으로 일관되고,
  `resolveQueueWaitTimeoutMs()` 가 양의 정수만 채택하는 기존 가드를 그대로 재사용해 입력값
  검증이 이중으로 반복되지 않으면서도 안전하다.
- **비즈니스 로직**: "PENDING 은 cancel, RUNNING 은 re-drive" 구분이 스펙 Rationale 신설
  소절과 코드 주석 양쪽에 동일 논리(진행 흔적 유무)로 명시돼 있고, `markQueueWaitTimeout` 의
  조건부 UPDATE(`WHERE status='pending'`)가 admission 과의 동시 race 에 멱등함을 코드로 확인.
- **반환값**: `recoverOrphanPendingExecutions(): Promise<void>` — 모든 경로(빈 배열 조기 반환,
  루프 완료)에서 명시적으로 resolve, 예외 경로는 caller(`recoverStuckExecutions`)의 `finally`
  로 안전하게 수렴.
- **spec fidelity**: `spec/5-system/4-execution-engine.md` §7.1(boot backstop 서술에 orphan
  pending 문장 추가)·§7.4("Stale 대상 = RUNNING(re-drive) + orphan PENDING(cancel)" 로 갱신,
  스캔 조건·임계값 필드명(`queued_at`, `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`) 모두 코드와 일치)·
  §8(line 1088 "본 PR 스코프 아님" → "구현 완료" 로 정정, 트리거 서술을 "admission 시점 검사
  (주 경로) + 부팅 backstop(orphan)" 으로 갱신) 세 곳 모두 코드 구현과 line-level 로 일치한다.
  `## Rationale` 신규 소절("orphan pending backstop — recoverStuckExecutions 재사용 + PENDING
  cancel")도 추가되어, 앞선 impl-prep consistency-check(`rationale_continuity.md`)가 WARNING
  으로 지적했던 "§7.4 'Stale 대상 한정' 문언이 확장 후 stale 해진다" 우려가 실제로 해소됐음을
  확인했다. `spec/data-flow/3-execution.md` §3.1 mermaid·§3.3 recovery-source 표도 같은 diff
  에서 동기화되어(`cross_spec.md` 가 지적한 companion 문서 stale 리스크도 해소), 두 문서 간
  회수 범위 서술 불일치가 남지 않는다. 에러코드 인용 위치(§3-error-handling §1.4, §1.5 아님)는
  spec 자체 결함이 아니라 문서화 인용 오기였고 코드에는 영향 없음(기존 cross_spec.md 검토가
  이미 이를 확인).

## 요약

`recoverOrphanPendingExecutions` 는 admission 재큐 job 소실로 pick-up 기회 자체를 잃은
`pending` Execution 을 boot-time backstop 으로 회수하는 기능을 의도한 그대로 구현했다. 스캔
조건(`status='pending' AND queued_at < now - resolveQueueWaitTimeoutMs()`)과 회수 액션(기존
`markQueueWaitTimeout` 재사용에 의한 wait-timeout cancel)이 코드·유닛 테스트·e2e 테스트·spec
§8/§7.4/Rationale 서술과 모두 line-level 로 일치하며, `queued_at IS NULL` 레거시 row 제외,
early-return 제거 후에도 lock 해제(finally) 보장, 멱등 조건부 UPDATE 로 admit/cancel race 안전
등 엣지 케이스도 적절히 처리됐다. 앞선 impl-prep consistency-check 가 지적했던 spec 문언 stale
화 우려(§7.4 "Stale 대상 한정")와 companion data-flow 문서 동기화 우려는 이번 diff 에서 실제로
해소됐다. 유일하게 남은 것은 기능적 결함이 아니라 plan 라이프사이클 정리 누락(`exec-intake-
followups.md` 체크박스 미갱신) 한 건으로, INFO 등급이며 병합을 막을 사유가 아니다. CRITICAL/
WARNING 급 발견사항은 없다.

## 위험도

LOW

STATUS: SUCCESS
