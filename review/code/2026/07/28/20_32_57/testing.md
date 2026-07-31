# 테스트(Testing) 리뷰 — retry_last_turn 재진입 원자 claim

대상: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`,
`retry-turn.service.spec.ts`, `continuation/continuation-execution.processor.ts`
(+ 연관 `execution-engine.service.spec.ts` mock 배선)

검증 방법: 전체 파일 컨텍스트 정독 + `git show <commit>` 로 실제 diff 범위 확정 +
`retry-turn.service.spec.ts`(40 tests) / `continuation-execution.processor.spec.ts`(20
tests) 직접 실행(PASS 확인) + `execution-engine.service.spec.ts` 의 retry 관련 37 tests
실행(PASS 확인) + **신규 CLAIM 코드에 대한 독립 mutation 검증 2건** (아래 참조).

## 발견사항

- **[WARNING]** 신규 원자 claim SQL(`applyRetryLastTurn`)이 어느 레이어에서도 실 DB로
  검증되지 않는다 — 자매 항목(`retryLastTurn`)과 동일한 성격의 갭이 새 코드로 반복.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:323-332`
    (CLAIM 쿼리 본문) / `retry-turn.service.spec.ts:406-434` (테스트 `(b3)`)
  - 상세: `(b3)` 은 mock 쿼리빌더에 전달된 `.set()`/`.andWhere()` 인자 문자열이 정규식과
    일치하는지만 검증한다 — `input_data - '_retryState'` raw JSONB 연산자, `jsonb_exists
    (input_data, '_retryState')` 가 실제 Postgres 에서 유효한 SQL 인지, 동시 UPDATE 상황에서
    `affected` 이 기대대로 정확히 1/0 을 반환하는지는 unit 도 e2e 도 검증하지 않는다
    (`grep -rl "retry_last_turn" codebase/backend/test/` 재확인 결과 0건). plan
    (`plan/in-progress/retry-turn-terminal-guard.md` "5차 라운드 이후 위생 정리" 표 #3)이
    자매 메서드 `retryLastTurn` 의 동일 패턴 consume SQL 에 대해 이미 이 정확한 갭을 P2 로
    추적 중이나, 그 항목 문구("`retryLastTurn` atomic-consume SQL … 검증 안 됨")는
    `retryLastTurn` 만 지목하고 이번 커밋이 신설한 `applyRetryLastTurn` claim SQL 은
    언급하지 않는다 — 같은 성격의 미검증 코드가 백로그에 잡히지 않은 채 하나 더 늘었다.
    (SQL 자체는 기존에 이미 프로덕션에서 도는 `retryLastTurn` 의 `output_data - '...'` 패턴을
    컬럼만 바꿔 재사용한 것이라 문법적 위험은 낮지만, "unit 도 e2e 도 실 DB 를 밟지 않는다"는
    사실 자체는 남는다.)
  - 제안: plan 백로그 #3 항목 범위를 `applyRetryLastTurn` claim SQL 까지 포함하도록 넓히거나
    별도 항목 신설. 이 코드베이스에 이미 `test/execution-stalled-redelivery.e2e-spec.ts` 같은
    BullMQ 재배달 시뮬레이션 e2e 선례가 있으므로 그 패턴을 재사용해 실 Postgres 대상 e2e 를
    추가할 수 있다.

- **[WARNING]** 실제 handler/orchestrator 를 구동하는 integration-level engine spec 은
  claim 실패(affected=0) 분기를 단 한 번도 실행하지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:369-381`
    (`retryClaimQb` 배선), describe 블록 `applyRetryLastTurn (multi-turn loop re-entry)`
    (동일 파일 16667행 이하) 및 형제 describe `resumeGraphAfterRetry — downstream graph
    traversal` (16995행 이하)
  - 상세: `retryClaimQb.execute` 는 이 스펙 전체에서 `{ affected: 1 }` 로 한 번만 설정되고
    (`grep -n "retryClaimQb"` → 선언·대입·초기화 3곳뿐) 어떤 테스트도 override 하지 않는다.
    즉 "중복 delivery 가 실 handler/context 파이프라인에 닿기 전에 차단된다"는, 이 커밋이
    고치는 버그의 핵심 시나리오는 driver 를 완전히 mock 한 격리 unit spec
    (`retry-turn.service.spec.ts` 의 `(b2)`)에서만 검증되고, 실제 `ExecutionContextService`
    /handler registry 를 구동하는 이 통합 spec 에서는 검증되지 않는다. 구조적으로는 claim
    실패 시 `rehydrateContext` 호출 전에 조기 반환하므로 현재는 안전하지만(코드 순서가 그것을
    보장), 향후 가드 순서가 바뀌는 회귀가 나면 이 레이어는 잡지 못한다.
  - 제안: 이 describe 블록에 `retryClaimQb.execute.mockResolvedValueOnce({ affected: 0 })`
    로 override 하는 케이스 1개를 추가해 실 handler/context 스택 앞에서 조기 discard 됨을
    통합 레벨에서도 고정.

- **[INFO]** `(claim.affected ?? 0) !== 1` 의 `?? 0` 폴백 분기(= `affected` 가
  `undefined`/`null`)를 전용으로 겨냥한 테스트가 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:333`
  - 상세: 현재 테스트는 `affected: 1`(기본, 성공)과 `affected: 0`(명시적 실패, `(b2)`/`(b3)`)
    만 사용한다. TypeORM `UpdateResult.affected` 타입이 `number | null | undefined` 라
    방어적으로 `?? 0` 을 둔 것으로 보이나, 그 폴백 분기 자체는 어떤 테스트에서도 실행되지
    않는다. 같은 파일의 기존 `retryLastTurn`(`consume.affected ?? 0`)에도 동일 패턴·동일 갭이
    있어 이번 신규 코드만의 회귀는 아니다 — 낮은 우선순위.
  - 제안: `(b2)` 옆에 `execute: jest.fn().mockResolvedValue({})` 케이스를 추가하면 이 폴백
    분기를 닫을 수 있다.

- **[INFO]** 테스트 `(c)` 는 "`_retryState` 부재로 조기 반환"이 신규 CLAIM 쿼리 호출보다
  먼저 실행됨을 직접 단언하지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:436-447`
  - 상세: 현재 소스 순서(코드 293-308행 vs CLAIM 323-332행)상 자동으로 보장되지만, 향후 두
    체크의 순서가 바뀌는 리팩터가 있어도 이 테스트만으로는 감지되지 않는다(다른 단언에 영향이
    없을 수 있음). 매우 낮은 우선순위.
  - 제안: 필요 시 `expect(mockNodeExecutionRepo.createQueryBuilder).not.toHaveBeenCalled()`
    단언 추가 검토.

## 검증 노트 (참고용 — 발견사항 아님)

- plan 이 이 커밋에 요구한 정확한 회귀 테스트("claim 0행 → ack-and-discard,
  `rehydrateContext`/`processAiResumeTurn` 미호출")는 `retry-turn.service.spec.ts` 의 `(b2)`
  로 정확히 구현돼 있고, `expectGraphNotDriven()` + `save` 미호출까지 확인해 요구보다 더
  엄격하다.
- 커밋 메시지가 주장하는 "mutation 4/4 RED" 중 2건(`jsonb_exists` 조건 제거, `affected` 조건
  제거)을 본 리뷰에서 소스를 임시 mutate(백업 후 원복) 해 직접 재현했다 — 둘 다 `(b3)`/`(b2)`
  에서 정확히 RED 로 떨어짐을 확인했다(mock 잔존 없음, 원본과 diff 0 확인).
- `retry-turn.service.spec.ts`(40/40), `continuation-execution.processor.spec.ts`(20/20),
  `execution-engine.service.spec.ts` 의 retry 연관 테스트(`-t "retry"`, 37/37) 모두 PASS —
  신규 mock 배선(`retryClaimQb`)이 없었다면 engine spec 의 `applyRetryLastTurn` 관련 기존
  테스트 전부가 `createQueryBuilder().update is not a function` 로 깨졌을 것이므로, 이 배선은
  회귀 방지에 필수적이며 정확히 그 역할을 하고 있다.
- `continuation-execution.processor.ts` 변경은 주석 전용(로직 무변경)이라 테스트 추가가
  필요 없고, 실제로 추가되지 않았다 — 적절한 판단.
- 테스트 격리: 모든 mock 객체가 outer `beforeEach` 에서 매번 새로 생성되고, `(b2)`/`(b3)`
  가 override 하는 `createQueryBuilder` 도 프로퍼티 재할당이라 참조 동일성(서비스 생성자가
  캡처한 `mockNodeExecutionRepo` 객체) 문제 없이 정상 작동함을 확인했다.

## 요약

이번 커밋은 `applyRetryLastTurn` 재진입 가드의 read-then-branch(비원자) 취약점을 조건부
UPDATE(CAS) claim 으로 교체하면서, plan 이 명시적으로 요구한 회귀 테스트(claim 실패 시
그래프 미구동)를 정확히 구현했고, mutation 검증(직접 2건 재현 포함)으로 그 테스트가 실제로
회귀를 잡는다는 것도 확인된다. 기존 통합 스펙(`execution-engine.service.spec.ts`)의 mock
배선도 새 코드 경로와 충돌 없이 정확히 갱신됐다. 남은 갭은 전부 "이미 동작을 올바르게 잠근
뒤의 심화 검증 부족"에 해당한다 — 신규 claim SQL 이 mock 문자열 비교로만 검증돼 실 Postgres
레벨 검증이 없다는 점(자매 메서드 `retryLastTurn` 에 대해 plan 이 이미 P2 로 추적 중인 것과
동일 성격이나, 범위 문구가 새 코드를 포함하지 않음), 그리고 실제 handler/context 를 구동하는
통합 스펙에서는 claim 실패 분기가 한 번도 실행되지 않는다는 점이다. 둘 다 현재 코드의 정확성
자체를 의심할 근거는 아니며(구조적으로 안전함을 코드 순서로 확인했다), 향후 가드 순서 변경
시 이 통합 레이어가 회귀를 놓칠 수 있다는 방어 심도(defense-in-depth) 이슈다.

## 위험도

LOW
