# 요구사항(Requirement) 리뷰 — review/code/2026/07/26/13_47_42

## 최우선 검증: 직전 라운드 CRITICAL C5 해소 여부

**결론: 해소 확인.**

직전 라운드(`review/code/2026/07/26/12_55_55/SUMMARY.md`)의 CRITICAL C5 — `ParallelExecutor`
의 `errorPolicy:'continue'` 가 `ExecutionCancelledError` 를 `{settled, failures}` 로 흡수해
Parallel 노드가 거짓 `done` 포트로 종결되던 결함 — 은 `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:273-284` 에서 `errorPolicy` 분기(`stop`/`continue`/`cancel-others-on-fail`)
**이전**에 무조건 우회 재throw 로 수정됐다.

```ts
const cancellation = failures.find(
  (f) => f.error instanceof ExecutionCancelledError,
);
if (cancellation) {
  throw cancellation.error;
}
```

- `errorPolicy:'continue'` 경로가 `if (cancellation) throw` 이전에 도달할 방법이 없다 —
  이 블록이 `stop`/`cancel-others-on-fail` 분기(`:291`, `:294`)보다 앞서 위치.
- `parallel-executor.spec.ts:225-284` 의 `describe.each(['stop','continue','cancel-others-on-fail'])`
  가 정책별로 (a) 단독 취소, (b) branchIndex 0 의 일반 실패와 동시 발생(co-occurring) 두 케이스를
  모두 검증 — `'continue'` 가 흡수하지 않고 재throw 하는지, `'stop'` 이 `failures[0]`(일반 에러)
  대신 취소를 우선하는지까지 커버.
- 실측: `npx jest parallel-executor.spec.ts foreach-executor.spec.ts workflow.handler.spec.ts` →
  3 suites / 92 tests 전부 통과(별도 실행 확인, 로그 생략).
- RESOLUTION.md(`review/code/2026/07/26/12_55_55/RESOLUTION.md` C5 행)의 "mutation 검증:
  재throw 블록 제거 → 4 tests failed → 복원 → 27/27 GREEN" 주장도 코드·테스트 정합 확인.

C5 는 재차 CRITICAL 로 내지 않는다. C1·C2·C4·W1~W6 등 이전 라운드에서 이미 해소 확인된 항목도
지시에 따라 재검토하지 않았다.

---

## 발견사항 (신규 — 스로틀/헬퍼/Parallel 재throw 범위)

- **[WARNING]** 신규 W10 회귀 테스트가 실제 벽시계 시간(`Date.now()`)에 의존해 **비결정적으로
  flake** 한다 — 스로틀 자체의 프로덕션 로직은 정상이나, 그 정상 동작을 검증하는 테스트가
  시스템 부하에 따라 스스로 실패한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:10224`
    (`it('짧은 간격 내 아이템 경계 반복은 실제 DB 조회를 1회로 스로틀한다 (W10)', ...)`),
    단언은 `:10290` (`expect(mockExecutionRepo.findOne.mock.calls.length).toBeLessThan(itemCount)`).
  - 상세: 이 테스트는 아이템 10개를 연속 실행하며 `assertExecutionNotCancelled(executionId,
    { throttle: true })` 의 250ms 스로틀 창 안에서 실제 DB 조회(`findOne`)가 아이템 수보다
    뚜렷이 적게 일어나는지 확인한다. 그런데 **`Date.now()` 를 전혀 제어하지 않는다** — 같은
    파일의 자매 회귀 테스트인 C3 테스트(`:10014-10017`, `짧은 간격` 케이스 바로 위)는 정확히
    이 문제를 인지하고 `jest.spyOn(Date, 'now')` 로 시각을 통제하는데("아이템이 실제 시간차
    없이 연속 실행되므로... 스로틀 창을 실제로 넘기도록 만든다"는 주석까지 남겼다), W10
    테스트에는 그 교훈이 적용되지 않았다. 실측(본 리뷰, 동일 파일 415개 테스트 반복 실행
    40회): 3회 flake(RED) 관측, 그 중 1회는 정확히 이 테스트가 `findOne` 호출 11회(스로틀이
    아예 없을 때의 이론값과 동치, mutation-removed 상태와 수치적으로 구분 불가)를 받아
    `<10` 단언에 실패했다:
    ```
    ● ExecutionEngineService › Container runtime › 짧은 간격 내 아이템 경계 반복은
      실제 DB 조회를 1회로 스로틀한다 (W10)
      expect(received).toBeLessThan(expected)
      Expected: < 10
      Received:   11
    ```
    단독 실행(해당 테스트 1건만, 또는 소규모 파일 3개 합산 92건) 시에는 매번 통과했다 —
    같은 415-테스트 파일을 통째로 반복 실행할 때만(시스템 부하·GC·이웃 테스트의 실제 타이머
    경합 등으로 개별 아이템 간 간격이 250ms 를 초과하는 경우가 생김) 간헐적으로 재현된다.
    RESOLUTION.md 의 "mutation 검증: 호출부의 `{ throttle: true }` 제거 → 1 test failed(RED,
    findOne 호출 11회) → 복원 → GREEN" 주장 자체는 사실이지만(뮤턴트 제거 시 항상 11), 그
    **복원 후 GREEN 확인이 CI 환경의 안정성까지 보장하지 못한다** — 스로틀이 정상 동작 중에도
    같은 실패 시그니처(11회)가 우연히 재현될 수 있다.
  - 제안: C3 테스트와 동일하게 `jest.spyOn(Date, 'now')` 로 아이템 0→1 경계(또는 매 경계)의
    시각을 결정적으로 제어해 스로틀 창 안/밖을 코드로 고정한다. 예: 처음 N 개는 동일
    `simulatedNow` 를 유지해 스로틀 적중을 보장하고, 이후 `+300` 등으로 창을 넘겨 실제 조회가
    재개됨을 검증 — 현재처럼 real time 경합에 결과가 좌우되지 않게 한다.

## 참고 (검증했으나 새 결함 없음)

- **`finalizeCancelledExecution` 헬퍼 추출(W12)** — `runExecution` catch(`:4529-4531`)와
  `finalizeResumedExecutionOutcome`(`:2643-2650`) 양쪽이 동일 헬퍼(`:4568-4581`)로 위임하며,
  추출 전 인라인 로직(방어적 `finishedAt`/`durationMs` 계산 → guarded `updateExecutionStatus`
  → `emitCancellationEvent({cancelledBy:'user'})`)과 동작이 1:1 대응한다. 로직 변경 없음.
- **`containerCancelCheckedAtMs` 누수 방지** — `runExecution` 의 `finally`(성공/실패 공통,
  `:4537-4544`)와 `finalizeRehydrationCleanup`(재개 세그먼트 종료 지점 다수에서 호출,
  `:2667-2670`) 양쪽에서 `delete` — 실행 종료 시점 커버리지 확인. 순수 최적화 상태(Map 소실 시
  correctness 영향 없음)라는 JSDoc 주장과도 일치.
- **`executeParallelBranchBody` 는 스로틀 미적용**(`:7155`, `assertExecutionNotCancelled(executionId)`
  — opts 없음) — 노드 경계마다 매번 실제 조회, RESOLUTION/CHANGELOG 주장과 일치. 컨테이너
  아이템 경계(`executeContainerBody:6515`)만 `{ throttle: true }`.
- **`runContainer` catch 의 W9 재throw**(`:7574-7576`)가 FAILED 마킹/`NODE_FAILED` emit
  (`:7577-7613`) 이전에 위치 — 컨테이너 자신의 NodeExecution 이 취소를 실패로 오분류하지 않음.
- **`LoopExecutor` 무변경 근거**(`loop-executor.ts:76-80`) — 이 실행기는 per-iteration
  try/catch 가 없어 `executeContainerBody` 가 던지는 `ExecutionCancelledError` 가 `finally`
  (loopContext 복원)만 거쳐 그대로 전파된다는 주석 주장을 코드로 확인(`:81-116`, catch 블록
  자체가 없음).
- **`ForEachExecutor` 의 우회 재throw**(`foreach-executor.ts:99-101`)가 errorCode/message
  추출(`:102-103`) 이전, `switch(errorPolicy)` 이전에 위치해 `skip`/`continue` 모두 흡수하지
  않음 — `foreach-executor.spec.ts:176-202` 의 `describe.each(['stop','skip','continue'])` 가
  세 정책 전부에서 아이템 2·3(나머지)이 dispatch 되지 않음(`seen).toEqual([1])`)을 직접 단언.
- **TODO/FIXME/HACK/XXX** — 변경분(`codebase/backend/src/modules/execution-engine/`,
  `test/node-cancellation-propagation.e2e-spec.ts`)에 신규 추가된 미완성 마커 없음(grep 확인).

## 참고 (INFO — spec 초안 정합성, spec 본문 자체는 미변경)

- `spec/` 자체는 이번 라운드에서도 변경되지 않았다(`git diff --stat origin/main -- spec/` 무출력)
  — developer 쓰기 권한 밖 규약 준수 확인.
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임
  (2026-07-26 #6)" 절 — §2.3 에 붙일 제안 문구("노드 경계마다 Execution 행을 다시 읽어...")가
  **이 절이 작성된 시점(11_48_55 라운드) 이후 도입된 W10 스로틀(컨테이너 아이템 경계만 최대
  250ms 지연 허용)을 반영하지 않는다** — "노드 경계마다" 라는 표현이 컨테이너 아이템 경계에는
  더 이상 문자 그대로 참이 아니다(스로틀 창 안에서는 스킵). 스로틀 트레이드오프 자체는
  같은 plan 패키지의 자매 문서(`node-cancellation-residual-signal-propagation.md:164-189`)에
  이미 상세히 기록돼 있으나, **project-planner 가 실제로 spec 에 붙여넣을 문구를 담은 쪽
  문서에는 반영되지 않았다** — 이대로 planner 턴이 진행되면 spec §2.3 신규 bullet 이 실제
  구현(스로틀 예외 있음)보다 강한 문구("매번")로 등재될 위험. 코드 버그는 아니므로 CRITICAL
  로 올리지 않으나, planner 위임 전에 `spec-update-node-cancellation-shutdown-classification.md`
  §"제안 변경" 의 §2.3 bullet 문구에 "(단, 컨테이너 아이템 경계는 최대 250ms 스로틀 — 별도
  W10 문서 참조)" 류의 각주를 덧붙이는 것을 권장.

## 요약

이번 라운드에서 발생한 실제 코드 변경(스로틀 도입, `finalizeCancelledExecution` 헬퍼 추출,
`ParallelExecutor` 취소 우회 재throw)은 모두 의도한 요구사항을 정확히 구현하고 있고, 직전
라운드의 CRITICAL C5(`ParallelExecutor` `errorPolicy:'continue'` 의 취소 흡수)는 `errorPolicy`
분기 이전 무조건 재throw + 6건의 대칭 회귀 테스트로 완전히 해소됐음을 코드 읽기와 실행(92/92
통과)으로 직접 확인했다. 다만 같은 라운드에 새로 추가된 W10 스로틀 회귀 테스트
(`execution-engine.service.spec.ts:10224`)가 실제 wall-clock 시간에 의존해 시스템 부하 시
간헐적으로 false-RED 를 낼 수 있음을 40회 반복 실행 중 3회 실측했다(그 중 1회는 스로틀이
전혀 없을 때와 수치적으로 구분 불가능한 실패 시그니처) — 프로덕션 로직 자체는 옳으나 그
검증 테스트의 결정성이 부족해 향후 CI 에서 회귀 없는 재실행이 필요해질 수 있다. 그 외
`assertExecutionNotCancelled` 스로틀 옵션의 호출부 분리(컨테이너=throttle, 선형/Parallel=매번),
누수 방지 cleanup, `runContainer`/`LoopExecutor`/`ForEachExecutor` 의 우회 재throw 는 전부
코드·테스트가 주장과 일치했고, spec/ 본문 자체는 변경되지 않아 line-level 불일치는 없다(제안
초안 문서 간의 정합성 갭만 INFO 로 기록).

## 위험도

LOW
