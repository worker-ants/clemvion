# Testing Review — `finalizeStalledExhausted` 트랜잭션화

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`(3340행)의 Execution/NodeExecution 두 UPDATE 를 `dataSource.transaction()` 으로 원자화
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `describe('finalizeStalledExhausted (PR4)', …)`(4858행)에 `installStalledTx` 헬퍼 도입 + 테스트 3건 재정비

(그 외 `plan/**`, `review/**`, `CHANGELOG.md` 는 process 문서라 테스트 관점 대상 밖)

## 사전 확인 — 이전 라운드(16_04_38, 16_19_26) 지적사항 반영 상태

`git diff origin/main...HEAD` 로 실제 diff 를 직접 열어 확인한 결과, 직전 라운드들의 testing/maintainability 지적이 이번 스냅샷에 실제로 반영돼 있다(문서 서술만이 아니라 코드로 확인):

- W4(헬퍼 미사용, `16_04_38`): 4914행 첫 테스트가 `installStalledTx(1)` 을 호출해 26줄 수작업 셋업 중복이 제거됐다.
- W1(cascade WHERE 가드 미검증, `16_04_38`): 4985-4989행에 `nodeQb.where`/`nodeQb.andWhere` 단언이 추가됐다.
- W1(Execution UPDATE 의 `id` WHERE 미검증, `16_19_26`): 4972-4974행에 `execQb.where` 단언이 추가됐다.
- "항상 참" 단언 교체: `이미 terminal (affected=0)` 테스트(5022행)가 더 이상 쓰지 않는 `mockNodeExecutionRepo.createQueryBuilder` 미호출 단언 대신 `managerCqb` 호출 횟수(5042행) + `nodeQb.execute` 미호출(5043행)로 교체됐다 — 실제로 무엇을 깨도 통과하던 vacuous 단언이 해소됐다.
- 뮤테이션 판별력: `npx jest execution-engine.service.spec.ts -t "finalizeStalledExhausted"` 로 3건 GREEN 재현 확인. plan 문서(`eia-stalled-atomicity.md`)가 주장하는 "트랜잭션 제거 뮤턴트 RED 3/3", "affected=0 조기 return 제거 RED 1" 은 이번 세션에서 재실행하지 않았으나 mock 구조(`managerCqb` 가 `qbs.shift()` 로 정확히 2회만 유효하게 소비되도록 무장돼 있어 트랜잭션 제거 시 `mockExecutionRepo.createQueryBuilder`/`mockNodeExecutionRepo.createQueryBuilder` 의 throw 무장이 즉시 발동)를 볼 때 서술과 일치한다.

## 발견사항

- **[WARNING]** `finalizeStalledExhausted` 트랜잭션 콜백이 **중간에 실패(reject)하는 경로**를 잠그는 테스트가 없다 — 두 자매 함수는 이미 가지고 있다
  - 위치: 테스트 — `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4858`(`describe('finalizeStalledExhausted (PR4)'`, 그 안의 `it` 은 4914/4946/5022 세 개뿐). 소스 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3340`(`finalizeStalledExhausted`), 특히 3352-3401(트랜잭션 블록 + `if (!finalized) return;`). 대조 대상 — `cancelParkedExecution` 의 동형 테스트는 `execution-engine.service.spec.ts:3383`(`'트랜잭션 자체 throw(DB 인프라 오류) → catch 로 흡수, 호출자에 예외 전파 없음 + emit 미발생'`).
  - 상세: `cancelParkedExecution`/`markWebChatIdleTimeout` 은 함수 전체가 `try/catch` 로 감싸여 있고("DB 오류는 내부 흡수"), 그 계약을 잠그는 전용 테스트가 있다(`dataSource.transaction` 을 reject 로 무장 → 함수는 resolve, emit 은 미호출, `logger.error` 호출됨을 단언). 반면 `finalizeStalledExhausted` 는 **의도적으로** 그런 함수 레벨 `try/catch` 가 없다(JSDoc 도 diff 전후 모두 이를 명시하지 않았고, 이번 diff 도 추가하지 않았다 — 호출부 `execution-run.processor.ts` 의 `onFailed` 가 `.catch()` 로 흡수하는 다른 계약이다). 그런데 이 "예외를 삼키지 않고 그대로 던진다"는 다른 계약을 잠그는 테스트가 이번 신규 테스트 3건 중 **하나도 없다**. 구체적으로 다음 두 가지가 미검증이다: (1) 트랜잭션 콜백 안에서 두 번째 UPDATE(`NodeExecution` cascade)가 throw 하면 `finalizeStalledExhausted(...)` 가 **reject** 하는가(현재 코드상 `await this.dataSource.transaction(...)` 이 그대로 던지므로 그렇다), (2) 그 경우 `finalized` 플래그가 `true` 로 세팅되지 못해 `emitExecution`/`finalizeRehydrationCleanup` 이 **호출되지 않는가**. 이 두 가지는 실 DB 롤백(이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별도 e2e 항목으로 등재돼 있음, `16_19_57` W1)과는 **다른 층위**다 — 실 DB 필요 없이 기존 `installStalledTx` 를 살짝 변형(`nodeQb.execute` 를 reject 로 무장)해서 mock 만으로 지금 당장 잠글 수 있는 함수 계약 테스트다. 이 PR 의 핵심 동기가 "첫 UPDATE 커밋 후 둘째가 실패하면 emit 이 잘못 나가지 않아야 한다"인데, 정작 "둘째가 실패했을 때 emit 이 안 나가는가"를 직접 겨냥한 단위 테스트가 없다는 점에서 유일한 실질 갭이다. 리뷰 배치에 포함된 `concurrency.md`/`database.md` 의 INFO 는 "실 DB 롤백 미검증"만 지적했는데, 그건 이미 트래커에 별도 e2e 항목으로 등재된 사안이라 중복이고, 여기서 지적하는 것은 그보다 **좁고 지금 mock 으로 바로 닫을 수 있는** 갭이다.
  - 제안: `installStalledTx` 를 확장하거나 별도 헬퍼로, `nodeQb.execute` 를 `mockRejectedValue(new Error(...))` 로 무장한 뒤 `await expect(service.finalizeStalledExhausted('exec-stalled')).rejects.toThrow(...)` + `emitSpy` 미호출을 단언하는 테스트 1건을 추가한다. 자매 `cancelParkedExecution` 의 "트랜잭션 자체 throw" 테스트(3383행)와 나란히 두어, 이 함수만 다른 예외 전파 계약을 가진다는 사실 자체도 테스트로 문서화하는 효과가 있다.

- **[INFO]** 첫 번째 신규 테스트만 `emitSpy` 를 변수로 캡처하지 않아 `mockRestore()` 를 호출하지 않는다 (같은 describe 의 나머지 두 테스트는 호출)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4914`(`it('Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다'`) 내부 4916-4927의 `jest.spyOn(...).mockResolvedValue(undefined)` — 비교: 4946/5022 테스트는 `emitSpy` 변수로 잡아 각각 5019/5045에서 `mockRestore()` 호출.
  - 상세: 실질 위험은 낮다 — 최상위 `beforeEach`(255행 부근, "service 는 beforeEach 로 매 테스트 재생성되므로 mutation 누수 없음" 주석 726행)가 매 테스트 `service`(및 `eventEmitter`)를 새로 만들기 때문에 spy 가 다음 테스트로 실제로 새는 일은 없다. 다만 같은 describe 안에서 스타일이 갈려 있어 가독성 관점에서 사소한 비일관.
  - 제안: 통일성을 위해 `const emitSpy = jest.spyOn(...)` 로 잡고 테스트 끝에 `emitSpy.mockRestore()` 를 추가해도 되지만, 기능적 영향이 없으므로 우선순위는 낮다.

## 점검 관점별 확인

1. **테스트 존재 여부**: 변경된 프로덕션 로직(트랜잭션 원자화)에 대응하는 테스트가 갱신·추가됐다 — 충분.
2. **커버리지 갭**: 위 WARNING(트랜잭션 콜백 실패 경로) 1건. 그 외 `durationMs` 스레딩(고정값 4242 → RETURNING 스레딩 확인), affected=0 no-op, cascade WHERE/status 가드는 모두 커버.
3. **엣지 케이스**: `toFiniteNumber`(음수/포화)는 `terminal-duration.spec.ts` 에서 별도 유닛 테스트로 이미 커버되므로 이 describe 에서 재검증할 필요 없음 — 적절한 분리.
4. **Mock 적절성**: `managerCqb = jest.fn(() => qbs.shift())` 로 호출 순서·횟수를 정확히 2회로 고정하고, 트랜잭션 밖 레포지토리 사용 시 즉시 throw 하도록 무장한 설계는 실제 프로덕션 호출 순서(Execution → NodeExecution, 트랜잭션 매니저 경유)와 정확히 대응한다. 다만 위 WARNING 처럼 "성공"만 mock 하고 "중간 실패"는 mock 되지 않은 비대칭이 있다.
5. **테스트 격리**: 최상위 `beforeEach` 가 `service`/mock 레포지토리를 매 테스트 재생성 — 독립 실행 확인됨(직접 실행 확인: `npx jest execution-engine.service.spec.ts -t "finalizeStalledExhausted"` → 3 passed).
6. **테스트 가독성**: `it()` 이름이 한국어로 의도를 명확히 서술하고, 각 단언 앞에 "왜 이 단언이 필요한가"(이전 라운드에서 어떤 뮤턴트가 생존했는지)를 주석으로 남겨 추적성이 좋다.
7. **회귀 테스트**: 기존 2건(성공 경로·no-op 경로)이 새 헬퍼 기반으로 재작성되면서도 원래 검증 대상(상태 전이·emit payload·no-op 조건)을 그대로 유지 — 회귀 테스트로서 유효.
8. **테스트 용이성**: `dataSource.transaction` 을 인스턴스 프로퍼티로 직접 교체하는 방식(`(service as unknown as {...}).dataSource.transaction = txSpy`)이 이미 자매 함수 테스트에서 쓰이던 관용구를 그대로 재사용해 새 구조를 별도 DI 없이 테스트 가능하게 만들었다 — 합리적.

## 요약

`finalizeStalledExhausted` 를 자매 함수와 동형인 `dataSource.transaction` 패턴으로 원자화한 변경에 대해, 테스트 스위트는 (a) 두 UPDATE 가 같은 트랜잭션 manager 를 타는지, (b) 상태·대상(WHERE) 가드가 정확한지, (c) affected=0 no-op 시 cascade/emit 을 건너뛰는지를 견고하게 검증하도록 정비됐고, 직전 두 라운드(`16_04_38`, `16_19_26`)에서 지적된 헬퍼 미사용·WHERE 가드 미검증·vacuous 단언은 실제 diff 로 확인한 결과 모두 해소돼 있다. 유일한 실질 갭은 이 함수가 자매와 달리 함수 레벨 `try/catch` 없이 예외를 그대로 전파하는 계약을 갖는데도, 트랜잭션 콜백이 중간에 실패하는 경로(정확히 이 PR 이 막으려는 "부분 커밋" 시나리오의 함수-레벨 대응물)를 잠그는 테스트가 하나도 없다는 점이다 — 이는 실 DB 가 필요한 롤백 검증(이미 별도 트래커 항목으로 등재됨)과는 달리 지금 mock 만으로 바로 닫을 수 있는 갭이라 WARNING 으로 분류한다.

## 위험도

LOW
