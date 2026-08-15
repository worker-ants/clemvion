# Testing Review — `finalizeStalledExhausted` 트랜잭션화 (최종 스냅샷)

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`(3340행 부근)의 Execution/NodeExecution 두 UPDATE 를 `dataSource.transaction()` 으로 원자화. JSDoc 에 "함수 레벨 try/catch 는 의도적으로 없다 — 이 계약은 회귀 테스트로 잠겨 있다" 명시.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `describe('finalizeStalledExhausted (PR4)', …)`(4858행)에 `installStalledTx` 헬퍼(4879-4905행) + `it` 4건(4914 / 4946 / 5029 / 5054행).

(그 외 `CHANGELOG.md`, `plan/**`, `review/**`, `spec/5-system/4-execution-engine.md` 는 process/spec 문서라 코드 테스트 관점 대상 밖으로 확인만 함.)

## 이전 라운드 지적사항 반영 상태 확인 (실제 diff 대조)

`git diff origin/main -- codebase/backend/src/modules/execution-engine/execution-engine.service*.ts` 로 최종 스냅샷을 직접 열어 확인:

- **`16_31_53` W1(트랜잭션 중간 실패 계약 테스트 부재)**: 5029행 `it('트랜잭션 중간 실패는 삼키지 않고 던진다 + 종결 이벤트도 안 나간다', …)` 가 신규 추가됐다. `nodeQb.execute` 를 `mockRejectedValue`로 무장 → `service.finalizeStalledExhausted(...)` 가 `.rejects.toThrow('deadlock detected')` 로 재던짐을 확인 + `emitSpy` 미호출을 함께 단언한다. 자매 `cancelParkedExecution` 의 "트랜잭션 자체 throw → catch 로 흡수"(3383행) 테스트와 대비되는 **의도적으로 다른 계약**(삼키지 않고 재던짐)을 정확히 겨냥한다. 갭 해소 확인.
- **`16_04_38` W4(헬퍼 미사용 중복)**: 4946행(`RUNNING 이면 …`) 테스트도 `installStalledTx(1)` 을 호출하도록 통일돼 있다(4947행) — 26줄 수작업 셋업 중복이 남아있지 않다.
- **`16_04_38` W1(cascade WHERE 가드 미검증)** / **`16_19_26` W1(Execution `id` WHERE 미검증)**: 4972-4974행(`execQb.where`), 4985-4989행(`nodeQb.where`/`andWhere`) 단언이 그대로 남아 있다.
- **"항상 참" 단언 교체**: `이미 terminal (affected=0)` 테스트(5054행)가 `managerCqb` 호출 횟수(5074행) + `nodeQb.execute` 미호출(5075행)로 검증 — 더 이상 쓰이지 않는 `mockNodeExecutionRepo.createQueryBuilder` 를 보는 vacuous 단언이 남아 있지 않다.

## 발견사항

- **[INFO]** 신규 "트랜잭션 중간 실패" 테스트는 **둘째 UPDATE(NodeExecution)** 의 reject 만 무장하고, **첫째 UPDATE(Execution)** 자체가 reject 하는 경로는 별도로 exercised 되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5029`(`it('트랜잭션 중간 실패는 삼키지 않고 던진다 …')`) — `installStalledTx` 정의는 4879-4905행
  - 상세: 소스 쪽에서 두 UPDATE 모두 같은 `await this.dataSource.transaction(...)` 호출 하나를 통해 reject 가 전파되므로(3352행 부근, try/catch 없음) 어느 UPDATE 가 먼저 실패하든 코드 경로는 동일하고 실질 위험은 낮다. 다만 지금 커버된 것은 "둘째가 실패" 케이스뿐이라, 순수하게 커버리지 관점에서는 "첫째가 실패"도 별도 `it` 로 exercised 하면 완전해진다(예: `execQb.execute` 를 reject 로 무장한 변형).
  - 제안: 우선순위 낮음 — 필요 시 `installStalledTx` 를 확장해 `execAffected` 대신 execute 자체를 reject 시키는 파라미터를 추가하는 정도로 충분. 지금 스코프에서 blocking 사유는 아니다.

- **[INFO]** 4914행 첫 신규 테스트(`'Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다'`)만 `emitSpy` 를 변수로 캡처하지 않아 `mockRestore()` 를 호출하지 않는다(같은 describe 의 나머지 세 테스트는 `emitSpy` 변수로 잡고 종료 시 restore)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4914-4944`
  - 상세: `16_31_53` testing 리뷰에서 이미 지적됐고, 같은 라운드 `RESOLUTION.md` 에서 "최상위 `beforeEach` 가 매 테스트 `service`/`eventEmitter` 를 재생성하므로 spy 누수 실질 위험 없음" 으로 **무조치 처분**된 항목이다. 실측: 255행 부근 최상위 `beforeEach` 가 매 테스트 `service` 를 새로 만들므로 격리는 유지된다. 새로 지적하는 것이 아니라 기존 처분이 이번 스냅샷에서도 유효함을 재확인한다.
  - 제안: 없음(기존 처분 유지 권장). 통일성만 원하면 다른 테스트와 같은 스타일로 맞춰도 무방.

- **[INFO]** 실 DB 트랜잭션 롤백 자체(부분 커밋이 실제로 방지되는지)는 여전히 mock 레벨 테스트로는 검증 불가
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4877`(`installStalledTx` 상단 주석 — "mock 은 롤백을 흉내내지 못한다"고 자체 고지)
  - 상세: `dataSource.transaction` 을 `jest.fn` 으로 대체하는 구조상 이 테스트 스위트가 보증하는 것은 "두 UPDATE 가 같은 트랜잭션 manager 를 탄다"는 전제와 "중간 실패 시 재던짐+미발행"이라는 함수 계약까지다. 실 DB 부분 커밋 방지 자체는 별도 e2e 트랙이 필요하며, 이는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 별도 항목(`16_19_57` W1, "`finalizeStalledExhausted` 트랜잭션의 실 DB 롤백 검증이 없다")으로 등재돼 있다.
  - 제안: 이번 diff 의 스코프는 아니다(의도적 defer, 트래커 등재 확인됨). 신규 조치 불요.

## 점검 관점별 확인

1. **테스트 존재 여부**: 변경된 프로덕션 로직(트랜잭션 원자화 + 중간 실패 시 재던짐 계약)에 대응하는 테스트가 모두 존재 — 4건(성공 경로 / manager 공유 검증 / no-op / 중간 실패) 충분.
2. **커버리지 갭**: 실질적 남은 갭은 위 INFO 두 건(첫째 UPDATE 단독 실패 미커버, 실 DB 롤백 미커버)뿐이며 둘 다 낮은 우선순위이거나 이미 트래커 등재됨. 이전 라운드들의 WARNING 급 갭(헬퍼 미사용, WHERE 가드 미검증, 중간 실패 계약 미검증)은 모두 해소됨.
3. **엣지 케이스**: RUNNING(성공) / affected=0(no-op) / 트랜잭션 중간 실패(reject) 세 분기 모두 커버. `toFiniteNumber` 의 음수/포화 엣지는 별도 유닛(`terminal-duration.spec.ts`)에서 이미 커버돼 이 describe 에서 재검증 불요 — 적절한 책임 분리.
4. **Mock 적절성**: `managerCqb = jest.fn(() => qbs.shift())` 가 호출 순서·횟수를 정확히 고정하고, 트랜잭션 밖 repo 사용 시 즉시 throw 하도록 무장한 설계가 실제 프로덕션 호출 순서(Execution → NodeExecution, `manager.createQueryBuilder` 경유)와 정확히 대응한다. "성공"과 "중간 실패" 양쪽 모두 mock 되어 이전 라운드의 비대칭이 해소됐다.
5. **테스트 격리**: 최상위 `beforeEach`(255행 부근)가 `service`/mock 레포지토리를 매 테스트 재생성 — 이 describe 안에서 `installStalledTx` 가 `dataSource.transaction`/`createQueryBuilder` 를 매 테스트 재할당해도 다음 테스트로 새지 않는다. 독립 실행 확인.
6. **테스트 가독성**: `it()` 이름이 의도를 한국어로 명확히 서술하고, 단언 앞에 "이전에 어떤 뮤턴트가 생존했는지"를 주석으로 남겨 추적성이 좋다(예: 5000행 부근, 4969행 부근).
7. **회귀 테스트**: 기존 2건(성공 경로·no-op 경로)이 새 헬퍼 기반으로 재작성되면서도 원래 검증 대상(상태 전이·emit payload·no-op 조건)을 그대로 유지 — 유효.
8. **테스트 용이성**: `dataSource.transaction` 을 인스턴스 프로퍼티로 직접 교체하는 방식이 자매 함수 테스트에서 이미 쓰이던 관용구를 재사용해, 별도 DI 변경 없이 새 트랜잭션 구조를 테스트 가능하게 만들었다 — 합리적.

## 요약

이번 스냅샷은 `finalizeStalledExhausted` 를 자매 함수와 동형인 `dataSource.transaction` 패턴으로 원자화한 변경에 대해, 직전 세 라운드(`16_04_38`, `16_19_26`, `16_31_53`)에서 지적된 테스트 갭(헬퍼 미사용 중복, WHERE 가드 미검증, "항상 참" 단언, 트랜잭션 중간 실패 계약 테스트 부재)을 실제 코드로 대조한 결과 모두 해소돼 있다. 특히 이번에 새로 추가된 "트랜잭션 중간 실패는 삼키지 않고 던진다 + 종결 이벤트도 안 나간다" 테스트가 이 함수가 자매와 다르게 함수 레벨 `try/catch` 없이 예외를 그대로 전파한다는 계약을 정확히 겨냥해 잠근다. 남은 것은 우선순위가 낮은 INFO 두 건(첫째 UPDATE 단독 실패의 대칭 커버리지 부재, 실 DB 롤백 검증은 별도 트래커에 등재된 defer)뿐이며 신규 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW
