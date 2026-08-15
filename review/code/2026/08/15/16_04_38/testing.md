# 테스트(Testing) 리뷰

대상: `finalizeStalledExhausted` 를 `dataSource.transaction` 으로 원자화한 변경(자매
`cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형화) + 대응 spec 갱신.

## 사전 검증 (실행 결과)

- `finalizeStalledExhausted` describe 블록 3건 단독 실행: **PASS** (3/3).
- 전체 스펙 파일 실행: **PASS** (453/453, 회귀 없음).
- Mutation 1 — `if (!finalized) return;` 가드 제거 → `이미 terminal (affected=0)` 테스트가
  **RED** (emit 이 호출됐음을 잡아냄). plan 이 자기 기록한 판별력 표(`affected=0 조기 return
  제거 → RED 1`)와 일치 — 확인됨.
- Mutation 2 — NodeExecution cascade UPDATE 의 `andWhere('status = :running', { running:
  NodeExecutionStatus.RUNNING })` 를 `WAITING_FOR_INPUT` 로 치환 → **GREEN** (3/3 그대로 통과).
  즉 이 WHERE 가드 조건은 어떤 테스트로도 관측되지 않는다. (뮤테이션 후 복원·`git diff` 로
  clean 확인 완료.)

## 발견사항

- **[WARNING]** NodeExecution cascade UPDATE 의 WHERE 가드 조건(`execution_id`, `status =
  :running`)이 어떤 assertion 으로도 검증되지 않는다 — mutation 으로 실측 확인(위 Mutation 2).
  `nodeQb.set` 값만 단언하고 `nodeQb.where`/`nodeQb.andWhere` 호출 인자는 아무도 보지 않는다.
  이 값이 잘못되면(예: 상태 오타·`executionId` 대신 다른 컬럼) DB 에서는 엉뚱한 행을 건드리거나
  전혀 건드리지 못하는 실질 결함인데도 스펙은 계속 GREEN 이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4992-5000`
    (`RUNNING 이면 failed + ... ` it 블록의 `nodeQb.set` 단언부 — `where`/`andWhere` 단언 부재)
  - 대상 소스: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3391-3392`
    (`.where('execution_id = :executionId', ...).andWhere('status = :running', { running:
    NodeExecutionStatus.RUNNING })`)
  - 제안: `expect(nodeQb.where).toHaveBeenCalledWith('execution_id = :executionId', { executionId:
    'exec-stalled' })` 와 `expect(nodeQb.andWhere).toHaveBeenCalledWith('status = :running',
    { running: NodeExecutionStatus.RUNNING })` 를 추가한다. (참고: 자매 `cancelParkedExecution`/
    `markWebChatIdleTimeout` 테스트도 이 항목을 검증하지 않아 파일 전반의 기존 패턴이지만,
    바로 이 diff 가 해당 cascade 문장을 새로 트랜잭션 안으로 옮기며 재작성한 자리이므로
    닫을 좋은 기회다.)

- **[INFO]** 첫 신규 테스트(`Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를
  탄다`)가 바로 위에서 정의된 `installStalledTx` 헬퍼를 재사용하지 않고 동일한 mock 배선
  (qb 셋업·`managerCqb`·`txSpy`·`dataSource.transaction` 오버라이드·트랜잭션 밖 repo 무장)을
  약 45줄 그대로 복제한다. 바로 다음 두 테스트는 이 헬퍼를 정상적으로 재사용한다 —
  헬퍼가 반환하는 `txSpy`/`managerCqb` 를 그대로 쓸 수 있었다(`emitExecution` spy 만 별도
  추가). 두 군데를 손으로 동기화해야 하는 드리프트 위험(예: mock 형태를 바꿀 때 한쪽만
  갱신).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4914-4960`
    (헬퍼 정의는 `:4879-4905`)
  - 제안: `const { execQb, nodeQb, txSpy, managerCqb } = installStalledTx(1);` 로 교체하고
    `emitExecution` spy 만 별도로 추가.

- **[INFO]** `finalizeStalledExhausted` 는 자매 두 함수(`cancelParkedExecution`,
  `markWebChatIdleTimeout`)와 달리 `dataSource.transaction` 호출을 함수 레벨 `try/catch` 로
  감싸지 않는다 — 트랜잭션이 throw 하면 예외가 그대로 호출자(`execution-run.processor.ts`
  의 `onFailed` 안 `.catch()`)로 전파된다. 자매 두 함수는 "트랜잭션 자체 throw → catch 로
  흡수, 호출자에 예외 전파 없음" 을 전용 테스트로 명시적으로 락(`3383-3409` 부근)하는데,
  이번에 트랜잭션화된 `finalizeStalledExhausted` 에는 대응하는 테스트가 없다. (이 비대칭은
  이번 diff 이전에도 존재했던 pre-existing 구조이고, 같은 세션의 consistency-check
  `rationale_continuity` 가 이미 "caller 가 `.catch()` 로 흡수 중이라 실질 동작은 동등,
  조치 불요(선택)" 로 판정한 항목이라 이 리뷰에서도 INFO 로만 남긴다.) 테스트로 잠가두면
  향후 누군가 무심코 내부 try/catch 를 추가(흡수 방향 전환)하거나 제거해도 회귀로 잡힌다.
  - 위치: 소스 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3334-3413`
    (`finalizeStalledExhausted` 전체, 특히 `:3348` `await this.dataSource.transaction(...)` 에
    try/catch 부재)
  - 제안(선택): "트랜잭션 자체 throw → 예외가 호출자에 그대로 전파된다"(자매와 반대 방향
    계약)를 잠그는 테스트 1건 추가. 이번 PR 필수는 아님.

## 회귀·기존 테스트 유효성

- `이미 terminal (affected=0)` 테스트의 종전 단언(`mockNodeExecutionRepo.createQueryBuilder`
  미호출)이 트랜잭션화로 인해 "그 repo 를 아예 안 쓰므로 항상 참" 이 되는 vacuous 위험을
  스스로 인지하고 `managerCqb` 호출 횟수(1회) + `nodeQb.execute` 미호출로 교체한 점은
  적절하다 — mutation 으로 확인(위 Mutation 1, RED).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5040-5044`
- 트랜잭션 밖 repo(`mockExecutionRepo.createQueryBuilder`/`mockNodeExecutionRepo.
  createQueryBuilder`) 호출 시 즉시 throw 하도록 무장한 것은 "회귀 시 조용히 통과" 를
  막는 좋은 패턴이다(테스트 격리·의도 표현 모두 명확).
- 전체 스펙 453/453 PASS, 대상 describe 3/3 PASS — 기존 테스트가 변경 후에도 유효함을 확인.
- Mock 은 결과값(`affected`, `raw`)만 흉내내고 실제 롤백은 재현하지 못한다는 한계를
  테스트 주석(`4912-4913`)이 스스로 명시한다 — mock 적절성 관점에서 스코프를 과대 주장하지
  않는 정직한 태도로 평가한다.

## 요약

핵심 변경(단일 트랜잭션으로 두 UPDATE 를 묶고, 밖으로 나가는 회귀를 트랜잭션-밖-repo
throw 로 무장)에 대한 테스트는 견고하며 mutation 으로 판별력을 실측 확인했다(가드 제거
RED, 트랜잭션 우회 RED). 다만 새로 트랜잭션 안으로 옮겨진 NodeExecution cascade UPDATE 의
WHERE 조건 자체는 어떤 assertion 도 커버하지 않아 mutation 으로 생존이 확인됐고(WARNING),
첫 테스트가 방금 도입한 헬퍼를 재사용하지 않아 유지보수 드리프트 위험이 있다(INFO). 자매
함수 대비 함수-레벨 에러 흡수 비대칭은 consistency-check 가 이미 실질 동작 동등으로 판정한
pre-existing 항목이라 정보 제공 수준으로만 남긴다. 회귀는 없다(453/453 PASS).

## 위험도

MEDIUM
