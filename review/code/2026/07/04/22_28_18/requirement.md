# 요구사항(Requirement) Review — orphan pending backstop (§8 recoverStuckExecutions)

세션: `review/code/2026/07/04/22_28_18` · diff base: `origin/main...HEAD` (payload 정상 스코프 확인 — CHANGELOG/코드/테스트/plan/spec 실제 diff, mis-scope 없음)

## 점검 방법

- 실제 코드: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`recoverOrphanPendingExecutions`, `recoverStuckExecutions` 통합), `execution-engine.service.spec.ts`(신규 unit 3), `test/execution-concurrency-cap.e2e-spec.ts`(신규 e2e 2) 를 Read 로 직접 확인.
- spec: `spec/5-system/4-execution-engine.md` §7.4(Recovery)·§8(동시 실행 제한), `spec/data-flow/3-execution.md` 상태 전이표/recovery 표를 Read.
- `git diff origin/main...HEAD --stat` 로 payload 파일 목록이 실제 변경분과 일치함을 교차 확인(대부분은 이전 세션(`22_12_26`) 리뷰 산출물·consistency 산출물의 정적 아카이브이며, 실질 코드 변경은 3개 소스 파일 + spec 2개 + plan 2개).
- `npx jest ... -t "orphan pending backstop"` 실행 → 3/3 pass 확인.

## 발견사항

- **[INFO]** plan 체크박스 상태와 실제 구현 상태 일치
  - 위치: `plan/in-progress/exec-intake-followups.md` "orphan pending backstop" 항목 `[ ]→[x]`, `plan/in-progress/orphan-pending-backstop.md` 체크리스트
  - 상세: `[x]` 로 플립된 두 항목("orphan pending backstop" 완료 서술, 하위 plan 파일의 impl/TDD/spec 체크리스트)이 실제 코드(`recoverOrphanPendingExecutions` 구현+통합)·테스트(unit 3 + e2e 2)·spec 반영(§8/§7.1/§7.4 + data-flow) 과 모두 부합한다. `orphan-pending-backstop.md` 의 남은 미체크 항목("ai-review + impl-done consistency", "PR")도 실제로 아직 진행 중(본 리뷰가 그 항목)이라 과대 체크 없음. 불일치 없음 — 정보성 확인.

- **[INFO]** spec fidelity — §8/§7.4 본문과 구현 line-level 일치
  - 위치: `spec/5-system/4-execution-engine.md` §7.4 "Recovery(`recoverStuckExecutions`)" 절의 "Stale 대상 = RUNNING(re-drive) + orphan PENDING(cancel)" 서술과 §8 "트리거 = admission 시점 검사(주 경로) + 부팅 backstop(orphan)" 서술 vs `execution-engine.service.ts` `recoverOrphanPendingExecutions()`
  - 상세: 필터 조건(`status=PENDING AND queued_at < now - EXECUTION_QUEUE_WAIT_TIMEOUT_MS`), 액션(기존 `markQueueWaitTimeout` 재사용 → `EXECUTION_QUEUE_WAIT_TIMEOUT`/`cancelledBy='timeout'`/`releaseExecutionRouting`), 트리거 위치(`recoverStuckExecutions` 안, running early-return 제거 후 항상 실행), NULL `queued_at` 자연 제외(TypeORM `LessThan` → SQL `<`, 3치 논리로 매치 안 함) 가 spec 서술과 정확히 일치한다. 신규 마이그레이션/env/에러코드 없음 서술도 실제 diff(기존 V104 `queued_at` 컬럼·기존 `markQueueWaitTimeout` 재사용, `LessThan` import 만 추가)와 일치. `spec/data-flow/3-execution.md` 상태 전이표의 `pending → cancelled` 갱신(사유 (a)(b) 분기, orphan backstop 명시)도 코드 동작과 부합.

- **[INFO]** 함수명·주석과 실제 구현 일치
  - 위치: `recoverOrphanPendingExecutions` JSDoc, `recoverStuckExecutions` JSDoc(§7.1/§7.2/§7.4/§7.5/§8 갱신), `runStuckRecoveryScan` JSDoc
  - 상세: "같은 스캔이 orphan pending 도 회수한다", "running 재점유 유무와 무관하게 항상 수행" 등 주석 서술이 실제 코드(early-return 제거로 `reclaimedIds.length===0` 이어도 `recoverOrphanPendingExecutions()` 호출)와 일치. test-hook(`runStuckRecoveryScan`) JSDoc 도 orphan cancel 트리거를 명시(이전 세션 W3 조치가 실제 반영됨을 재확인).

- **[INFO]** 엣지 케이스·반환값
  - 상세: 빈 orphan 셋(`orphans.length === 0`)은 즉시 `return`(no-op, 로그 없음) — unit 테스트("초과 pending 이 없으면 아무 것도 cancel 하지 않는다")로 커버. `queued_at IS NULL` 레거시 row 는 `LessThan` 비교에서 자연 제외되어 오탐 없음. `markQueueWaitTimeout` 자체가 조건부 UPDATE(`WHERE status='pending'`)라 이미 admit/cancel 된 stale 후보에 대해 no-op(멱등) — TOCTOU에도 이중 처리 없음. 모든 코드 경로가 `Promise<void>` 로 일관 반환하며 예외 시나리오는 `markQueueWaitTimeout` 내부 try/catch 로 흡수(로그만 남기고 개별 row 실패가 나머지 루프를 막지 않음).
  - 참고(비차단): `for...await` 순차 루프라 하나의 `markQueueWaitTimeout` 이 unhandled reject 없이 종료됨을 전제하는데, 실제 그 메서드는 내부 try/catch 로 항상 resolve 하므로 이 전제는 안전하다.

- **[INFO]** e2e 검증 — 테스트훅 status code, helper 재사용
  - 상세: `_test/recover-stuck-executions` 라우트는 `@HttpCode(HttpStatus.ACCEPTED)`(202) 로 이미 데코레이트되어 있으며 e2e 신규 테스트의 `expect(res.status).toBe(202)` 와 일치. `poll`/`getStatus` 헬퍼는 기존 재사용(신규 정의 아님). 신규 helper `insertPending`/`recoverStuck` 는 그 자체로 spec §8 orphan 시뮬레이션 목적에 부합.

- **[INFO]** TODO/FIXME/HACK/XXX 없음
  - 상세: `git diff origin/main...HEAD` 신규/변경 소스 3파일에서 TODO/FIXME/HACK/XXX 패턴 검색 결과 0건. 미완성 작업 시사 주석 없음.

CRITICAL/WARNING 등급 발견 없음.

## 요약

`recoverOrphanPendingExecutions` 신규 메서드와 `recoverStuckExecutions` 의 early-return 제거 통합은 spec §8("트리거 = admission 시점 검사 + 부팅 backstop(orphan)")·§7.4("Stale 대상 = RUNNING(re-drive) + orphan PENDING(cancel)") 본문과 line-level 로 정확히 일치하며, 기존 검증된 `markQueueWaitTimeout`(조건부 UPDATE, 에러코드·이벤트·라우팅 해제 포함) 을 재사용해 신규 실패 모드를 도입하지 않는다. 신규 unit 3건이 실제로 통과했고(3/3), e2e 2건·헬퍼·라우트 status code 도 정확히 대응한다. plan 체크박스 플립(`exec-intake-followups.md`, `orphan-pending-backstop.md`)은 실제 완료 상태와 일치하며 과대·과소 체크 없음. TODO/FIXME 등 미완성 시사 표식 없음, 반환값·에러 흡수·NULL/빈 컬렉션 엣지케이스 모두 코드·테스트로 커버됨. 요구사항 충족 관점에서 결함 없음.

## 위험도

NONE

STATUS: SUCCESS
