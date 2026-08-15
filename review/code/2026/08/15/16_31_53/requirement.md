STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# Requirement Review — `finalizeStalledExhausted` 트랜잭션화 (eia-stalled-atomicity)

## 리뷰 대상 요약

핵심 변경은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
의 `finalizeStalledExhausted`(BullMQ stalled 재배달 소진 → `WORKER_HEARTBEAT_TIMEOUT` 마감)
가 Execution UPDATE 와 자식 NodeExecution cascade UPDATE 를 각각 autocommit 으로 실행하던
것을 `dataSource.transaction`으로 단일 트랜잭션화한 것이다. 자매 함수 `cancelParkedExecution`
(`execution-engine.service.ts:1023`)·`markWebChatIdleTimeout`(`:1152`)과 동형 패턴(트랜잭션
안에서 `manager.createQueryBuilder()` 2회, 커밋 이후 best-effort emit/cleanup)을 그대로
따랐다. 부수 변경으로 `execution-engine.service.spec.ts`에 회귀 테스트 3건(트랜잭션 manager
공유·WHERE 가드·no-op 분기), `spec/5-system/4-execution-engine.md` §7.1/Rationale 문서화,
plan/CHANGELOG/이전 리뷰 라운드 산출물(RESOLUTION 반영 포함)이 포함됐다.

## 점검 관점별 확인

1. **기능 완전성**: `git diff origin/main...HEAD -- .../execution-engine.service.ts`로 실제
   운영 코드 diff 를 직접 열람했다. 두 UPDATE(Execution `id=:id AND status=:running` →
   FAILED, NodeExecution `execution_id=:executionId AND status=:running` → FAILED cascade)
   가 `await this.dataSource.transaction(async (manager) => {...})` 콜백 안으로 이동했고,
   `finalized` 플래그로 affected=0(이미 terminal) 조기 return 시 cascade·로그·cleanup·emit
   을 모두 건너뛴다. 의도한 "부분 커밋 방지"를 정확히 구현한다.
2. **엣지 케이스**: affected=0(이미 terminal — setup-throw 경로) no-op 케이스가
   `installStalledTx(0)` 테스트로 커버된다(`execution-engine.service.spec.ts:5022`).
   `result.raw`가 빈 배열일 때 `toFiniteNumber(...) ?? null`로 방어(기존 패턴 유지, 회귀
   없음). 트랜잭션 콜백 내부 두 번째 UPDATE(cascade)는 affected 검사와 무관하게 무조건
   실행되는데, 이는 "Execution 이 실제 전이된 경우에만 진입"(early return 이후 위치)이라
   의도된 동작이다.
3. **TODO/FIXME**: 신규/기존 diff 범위에 `TODO|FIXME|HACK|XXX` 없음(grep 확인).
4. **의도와 구현 간 괴리**: JSDoc(`:3325-3329`)이 "두 UPDATE 는 단일 트랜잭션이다 —
   자매와 동형"이라 명시하고, 실제로 두 UPDATE 모두 트랜잭션 콜백 안의 `manager`를 통해서만
   실행되며 트랜잭션 밖 `executionRepository`/`nodeExecutionRepository`는 더 이상 쓰이지
   않는다(테스트에서 트랜잭션 밖 repo 사용 시 즉시 throw 하도록 무장 — `installStalledTx`,
   `:4879-4905`). 주석과 구현이 일치한다. 단, "자매와 동형" 표현은 트랜잭션 구조에만
   해당하고 함수 레벨 에러 흡수(try/catch)는 자매 둘과 다르다(아래 발견사항 참조) — 이는
   이번 diff 가 만든 회귀가 아니라 기존부터의 차이다.
5. **에러 시나리오**: `finalizeStalledExhausted`는 함수 레벨 `try/catch` 없이
   `dataSource.transaction(...)`이 throw 하면(DB 오류 등) 그대로 호출자에 전파한다. 유일한
   호출부 `execution-run.processor.ts:88`의 `onFailed`가
   `void this.engine.finalizeStalledExhausted(executionId).catch((err_) => {...})`로 이미
   흡수하므로 최종 동작은 자매 두 함수(내부 try/catch)와 동등하다. 기능 결함은 아니다.
6. **데이터 유효성**: `executionId` 자체에 대한 입력 검증은 이번 diff 범위 밖(기존과 동일,
   조건부 WHERE 로 대상 미존재/이미 terminal 을 자연 처리).
7. **비즈니스 로직**: "재배달 attempts 소진 시에만 `status='running'` 조건부로 FAILED +
   `WORKER_HEARTBEAT_TIMEOUT` 마킹, setup-throw 경로는 이미 terminal이라 no-op" 규칙이
   그대로 보존됐다. `id=:id`(Execution)·`execution_id=:executionId`(NodeExecution) 대상
   일치성도 신규 테스트로 단언한다(`:4936-4943`, `:4972-4974`) — 직전 라운드에 자식 cascade
   의 WHERE 만 하드닝하고 Execution UPDATE 의 `id` 조건을 놓쳤던 결함(`16_19_26` testing
   W1)이 이번 HEAD 커밋(`0d9c6166f`)에서 회귀 테스트로 보강됐음을 확인했다(WHERE `id` 절
   자체는 diff 이전부터 이미 존재 — 그 라운드는 코드 수정이 아니라 뮤테이션 커버리지
   보강이었다).
8. **반환값**: `Promise<void>` 전 경로에서 값을 반환하지 않는 계약을 유지한다(early
   return·정상 종료 모두 `void`). 호출부는 반환값을 소비하지 않으므로 문제 없음.
9. **spec fidelity**: 대상 spec 은 `spec/5-system/4-execution-engine.md` §7.1(워커 크래시
   복구)이다. `git diff origin/main...HEAD -- spec/5-system/4-execution-engine.md`로 직접
   확인 — §7.1 본문(`:851`)에 "이 마감은 단일 트랜잭션이다(2026-08-15) — Execution 을
   FAILED 로 쓰는 UPDATE 와 자식 RUNNING NodeExecution cascade UPDATE 가
   `dataSource.transaction` 으로 묶인다" 문장과, `## Rationale`(`:1464-1470`) "dead-letter
   마감의 원자성 (2026-08-15 정정)" 절이 신설됐다. 두 곳 모두 실제 구현(트랜잭션 범위·
   실패 모드·자매 함수 이름)과 line-level 로 일치한다 — 함수명·에러 코드
   (`WORKER_HEARTBEAT_TIMEOUT`)·상태 조건(`status='running'`)·자매 함수명이 코드와 정확히
   대응한다. 또한 `spec/conventions/node-cancellation.md`에는 이번 diff 로 어떤 문자열도
   추가되지 않았음을 `git diff --stat`으로 확인했다 — plan 체크리스트(`eia-stalled-
   atomicity.md:70-73`)가 자백한 impl-prep WARNING("이 함수는 취소가 아니라 워커 크래시
   경로라 `node-cancellation.md`가 아니라 `4-execution-engine.md` §7.1이 SoT")이 실제로
   준수됐다. spec 자체 결함이나 구현과의 불일치는 발견되지 않았다.

## 발견사항

- **[INFO]** `finalizeStalledExhausted`는 함수 레벨 `try/catch`가 없어 DB 예외를 호출자에게
  전파한다 — 자매 `cancelParkedExecution`/`markWebChatIdleTimeout`은 함수 전체를
  `try/catch`로 감싸 "DB 오류 내부 흡수"를 명문화하는 것과 형태가 다르다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3340`
    (`async finalizeStalledExhausted`)
  - 상세: 이번 diff 가 만든 회귀가 아니다(트랜잭션화 이전부터 이 함수만 try/catch 가 없었다).
    유일 호출부 `queues/execution-run.processor.ts:88`의 `.catch()`가 등가로 흡수하므로
    기능적 위험은 없다. 이미 database.md(`16_04_38`)·maintainability.md(`16_04_38`) 두
    이전 라운드에서 동일하게 INFO 로 처분됐고 이번 diff 에서 조치 대상으로 남기지 않았다 —
    독립적으로 재확인해도 같은 결론이다.
  - 제안: 필요하면 JSDoc 에 "에러 흡수는 caller(`onFailed`)의 `.catch()`가 담당 — 함수
    레벨 try/catch 는 의도적으로 없음" 한 줄을 남겨 향후 재작업자가 "자매와 완전 동형"으로
    오독하지 않게 한다. 기능 수정 불요.

## 요약

`finalizeStalledExhausted`의 Execution/NodeExecution 2-UPDATE 를 `dataSource.transaction`
으로 원자화한 핵심 변경은 자매 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`)와
동형 패턴을 정확히 재현하며, 목표(부분 커밋 시 자식 NodeExecution 영구 RUNNING 잔류 방지)를
완전히 달성한다. 회귀 테스트가 트랜잭션 manager 공유·양쪽 UPDATE 의 대상 일치(`id`/
`execution_id`)·WHERE 상태 가드·affected=0 no-op 분기를 모두 뮤테이션 판별력과 함께
검증하고, 이전 라운드에서 지적된 "헬퍼 미사용 중복"·"WHERE 가드 미검증" 결함은 이번 diff
시점 기준 이미 해소돼 있다. spec(`4-execution-engine.md` §7.1 + Rationale)도 같은 턴에
갱신돼 코드와 line-level 로 일치하고, 스코프 경계(`node-cancellation.md` 미접촉)도 plan
체크리스트가 자백한 impl-prep WARNING 대로 준수됐다. 유일한 관찰(함수 레벨 try/catch
비대칭)은 호출부에서 등가 흡수돼 기능 결함이 아닌 INFO 수준이며, 신규 회귀도 아니다.
TODO/FIXME 류 미완성 표식 없음, 모든 경로에서 반환값 계약 준수, 비즈니스 규칙(재배달 소진
시에만 조건부 FAILED 마킹) 보존.

## 위험도

NONE
