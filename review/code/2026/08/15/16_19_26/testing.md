STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
# Testing Review — `finalizeStalledExhausted` 트랜잭션 원자화 (fresh review, `16_19_26`)

## 배경

이 diff 는 이전 라운드(`16_04_38`)에서 이미 리뷰·RESOLUTION 을 거쳤다. `RESOLUTION.md` 는
testing WARNING #1(NodeExecution cascade UPDATE 의 WHERE 가드 미검증)과 #4(신규 테스트가
공유 헬퍼 `installStalledTx` 를 우회)를 조치 완료로 기록했고, 실제로 두 항목 모두 현재
코드에서 확인된다(`installStalledTx(1)` 재사용, `nodeQb.where`/`nodeQb.andWhere` 단언 추가).
이번 라운드는 그 수정을 fresh 로 재검토하고, 같은 함수 안에 **같은 결함 클래스가 하나 더
남아 있는지**를 뮤테이션으로 재확인했다.

## 발견사항

- **[WARNING]** Execution UPDATE 의 `WHERE id = :id` 절이 어떤 assertion 으로도 검증되지 않음
  — 뮤테이션으로 생존 실측(GREEN 유지)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    — `it('RUNNING 이면 failed + WORKER_HEARTBEAT_TIMEOUT 마킹 + 자식 cascade + EXECUTION_FAILED
    emit', ...)` (게이트 4938), `execQb.set` 단언(게이트 4956), `execQb.andWhere` 단언(게이트
    4961) — 이 사이 어디에도 `execQb.where` 단언이 없다. 첫 테스트(게이트 4914, "같은
    트랜잭션 manager 를 탄다")에도 없다. 소스 쪽 대상은
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3369`
    (`.where('id = :id', { id: executionId })`).
  - 상세: 이번 diff 는 정확히 이 결함 클래스(WHERE 값이 잘못돼도 GREEN)를 **NodeExecution
    cascade UPDATE** 에서 발견해 고쳤다(`nodeQb.where`/`nodeQb.andWhere` 단언 추가, 게이트
    4971-4976, RESOLUTION W1). 그런데 같은 함수 안의 **Execution UPDATE 자체의 `id` WHERE
    절**에는 같은 하드닝이 적용되지 않았다 — `execQb.andWhere`(status=running) 만 단언되고
    `execQb.where`(id=executionId) 는 어디서도 단언되지 않는다.
    실제로 소스에서 `.where('id = :id', { id: executionId })` 를
    `.where('id = :id', { id: 'WRONG-VALUE' })` 로 바꿔 뮤테이션 테스트를 돌렸다
    (`npx jest execution-engine.service.spec.ts -t "finalizeStalledExhausted"`) — **3개
    테스트 전부 GREEN 유지**, 뮤턴트가 생존했다(적용 후 원본으로 복원 완료, 저장소는 clean).
    이 WHERE 절이 실제로 깨지면(오타·다른 변수 바인딩) `finalizeStalledExhausted` 가 엉뚱한
    `executionId` 를 대상으로 마킹하거나(다른 실행의 Execution row 를 `WORKER_HEARTBEAT_TIMEOUT`
    로 잘못 종료) affected=0 이 돼 진짜 stalled 케이스를 조용히 no-op 시킬 수 있는데, 유닛
    테스트는 이를 전혀 잡지 못한다. `16_04_38` W1 이 지적한 정확히 같은 결함 형태(사용자
    메모리 "하드닝을 자매 함수 미적용" 패턴)가, 이번엔 자매 *함수* 가 아니라 같은 함수 안의
    자매 *UPDATE 문* 사이에서 재발했다.
  - 제안: `expect(execQb.where).toHaveBeenCalledWith('id = :id', { id: 'exec-stalled' });`
    를 `RUNNING` 성공 테스트(게이트 4938 부근, `execQb.andWhere` 단언 옆)에 추가. 필요하면
    "같은 트랜잭션 manager" 테스트(게이트 4914)에도 대칭적으로 추가해 두 UPDATE 의 WHERE
    가드를 동일 깊이로 커버.

## 확인했으나 문제 없음

- `installStalledTx` 헬퍼는 신규 첫 테스트(게이트 4914)를 포함해 3개 테스트 모두 재사용한다
  — 이전 라운드 W4(헬퍼 미사용)는 실제로 해소돼 있다.
- NodeExecution cascade UPDATE 의 `where`/`andWhere` 는 값까지 단언되며, 뮤테이션(`status =
  :running` → `:waiting`)에서 RED 임을 실측 재현했다(RESOLUTION 기재와 일치, 별도 재검증
  안 함 — 이번 라운드는 위 신규 갭에 집중).
- `affected=0` no-op 테스트는 `managerCqb` 호출 횟수(1) + `nodeQb.execute` 미호출로, 더 이상
  쓰이지 않는 repo mock 을 보던 이전의 "항상 참" 단언을 대체했다 — 정당한 교체.
- `dataSource.transaction` 밖 접근 시 즉시 throw 하는 하드닝(`mockExecutionRepo/
  mockNodeExecutionRepo.createQueryBuilder = () => throw`)은 좋은 방어적 테스트 설계다 —
  트랜잭션 경계가 다시 열리는 회귀를 구조적으로 차단한다.
- 테스트 격리: `installStalledTx` 가 매 `it()` 마다 mock 을 새로 주입하고 `emitSpy.mockRestore()`
  가 각 테스트 끝에서 호출돼 cross-test 오염 없음.
- mock 이 실제 트랜잭션 롤백을 시뮬레이션하지 못한다는 한계는 테스트 주석이 스스로 명시하고
  있고, 이 저장소의 기존 관례(자매 함수들도 동일하게 unit mock 한정)와 일치한다 — 회귀 아님.

## 참고 (낮은 우선순위)

- `finalizeStalledExhausted` 는 자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 달리
  함수 레벨 `try/catch` 가 없어(이전 라운드 database INFO #5, "호출부 `.catch()` 가 흡수하므로
  무조치") 트랜잭션·emit 예외가 그대로 호출자로 전파된다. 이 설계 자체는 이전 라운드에서
  근거 있게 무조치 판정됐지만, 이 "호출자가 흡수한다" 는 계약을 잠그는 유닛 테스트는
  `execution-engine.service.spec.ts` 에도 `execution-run.processor.spec.ts` 에도 없다 —
  자매 함수 쪽엔 "emit throw → warn 으로 흡수" 테스트(게이트 3151 부근 `installCancelTx`
  describe)가 있는 것과 대비된다. 설계 변경을 요구하는 것은 아니고, 이 비대칭이 나중에
  "자매와 통일" 명목으로 조용히 try/catch 가 추가돼도 아무 테스트도 깨지지 않는다는 점만
  기록해 둔다.

## 요약

핵심 원자화 로직(`dataSource.transaction` 단일 트랜잭션, `manager.createQueryBuilder` 를
통한 트랜잭션 내부 접근, 커밋 후 best-effort emit)과 그 테스트 하네스(`installStalledTx`)는
자매 함수 패턴을 정확히 따르고 견고하다. 이전 라운드가 지적한 두 WARNING(헬퍼 미재사용,
NodeExecution WHERE 미검증)은 실제로 해소됐다. 다만 이번 diff 가 NodeExecution cascade
UPDATE 에 적용한 바로 그 하드닝(WHERE 값 assertion)이 같은 함수의 Execution UPDATE 자체에는
적용되지 않았다 — `id` WHERE 절을 잘못 바인딩해도 3개 테스트 전부 GREEN 임을 뮤테이션으로
직접 확인했다. 대상 실행을 오식별할 수 있는 조건절이 검증되지 않은 상태라 WARNING 으로
기록한다.

## 위험도
MEDIUM
