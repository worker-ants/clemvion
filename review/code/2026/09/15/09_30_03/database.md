# Database Review — trigger-lock-followups (2026-09-15 09:30:03)

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 의 `affected` 판정 수정은 정확하고, 락으로 못 막는
  세 번째 삭제 경로(FK `onDelete: 'CASCADE'`)를 올바르게 닫는다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:239-241` (`rewriteTriggerConfigLocked`)
  - 상세: `m.findOne` 은 advisory lock 아래의 평범한 `SELECT`이지 행 잠금(`FOR UPDATE`)이
    아니므로, 그 뒤 `Workflow`/`Workspace` 삭제의 FK CASCADE(`trigger.entity.ts:39,46`,
    `onDelete: 'CASCADE'`)가 커밋되면 재읽기와 `UPDATE` 사이에 행이 사라질 수 있다. 이번 수정은
    `result.affected === 0` 일 때만 `false`를 반환하고, 드라이버가 `affected`를 보고하지 않는
    경우(`null`/`undefined`)는 성공으로 취급한다 — "모른다"를 "없다"로 뒤집지 않는 올바른
    선택이다. `trigger-config-lock.spec.ts`의 새 테스트 두 건(0행 → `false`, `null`/`undefined`
    → `true`)이 이 분기를 각각 구분해서 커버한다. 호출부(`rotateBotToken`)는 `if (!wrote)
    throwTriggerNotFound()`로 이미 이 계약을 소비하고 있어 배선도 확인됨.
  - 제안: 없음 — 그대로 반영 권장.

- **[INFO]** `SET LOCAL lock_timeout` 문자열 보간 방어 심도 강화는 적절하나, 근본적으로 파라미터
  바인딩이 불가능한 자리라는 제약은 그대로 남는다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:45-55` (`toLockTimeoutMs`), 사용처 `:87-89`
  - 상세: `Math.trunc`만으로는 `NaN`/`Infinity`/음수가 그대로 `'NaNms'` 등으로 SQL에 실릴 수
    있었다. `Number.isFinite` 체크 + `[1, 60000]` clamp로 값의 형태를 함수가 스스로 보장하도록
    고쳤고, 유한하지 않은 값은 조용히 clamp하지 않고 던진다(조용한 clamp는 "왜인지 늘
    타임아웃"이라는 다른 실패를 낳는다는 근거가 타당함). 현재 호출부(`triggers.service.ts:1028`,
    `schedules.service.ts:316`) 둘 다 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`만 넘겨
    사용자 입력 경로는 0건이므로 익스플로잇 가능성은 없음 — 진짜 SQL 인젝션 벡터는 아니고
    방어 심도(defense-in-depth) 성격의 변경. `acquireTriggerConfigLock`의 새 테스트 스위트가
    유한성 검사·clamp 경계값(하한/상한/통과)을 뮤테이션으로 검증했다.
  - 제안: 향후 계산식을 넘기는 새 호출부가 생기면 이 함수가 그대로 방어선 역할을 하므로 추가
    조치 불요.

- **[INFO]** `rotateBotToken`에서 secret store 쓰기(`this.secrets.rotate(...)`, `:1301-1307`)가
  `rewriteTriggerConfigLocked` 호출(`:1318`)보다 먼저 커밋 없이 일어난다 — 이번 PR이 고친
  0행 UPDATE 케이스에서도, 트리거 행이 사라지면 secret store에는 새 토큰만 남고 `config`에는
  반영되지 않는 상태가 남을 수 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1300-1307`, `:1318-1354`
  - 상세: 이 PR의 수정으로 응답 자체는 이제 올바르게 404(`throwTriggerNotFound()`)가 되지만,
    secret store 쓰기는 Postgres 트랜잭션 밖의 외부 호출이라 롤백되지 않는다. 이 설계는
    Cafe24 토큰 갱신에서 "lock 보유 중 HTTP 요청을 트랜잭션 안에 묶으면 커넥션 점유 시간이
    늘어난다"는 이유로 명시적으로 기각된 선례를 따른 것으로, `trigger-config-lock.ts` JSDoc에
    의도적 트레이드오프로 문서화되어 있다. 새로 도입된 결함이 아니라 기존 설계의 잔여
    한계이며, 이번 PR의 스코프(0행 UPDATE 오탐 수정)를 벗어난다.
  - 제안: 별도 조치 불요(스코프 밖). 다만 향후 secret store 정리/GC 작업 시 "행은 사라졌는데
    새 토큰만 남는" 이 경로를 orphan 후보로 기억해 둘 것.

- **[INFO]** `SchedulesService.remove()`의 트리거 삭제(락+advisory lock 트랜잭션)와 schedule
  행 삭제(`scheduleRepository.remove(schedule)`)가 서로 다른 트랜잭션이라 원자적이지 않다 —
  이번 diff가 건드린 코드는 아니고(`.spec.ts`만 변경), 기존 동작 그대로다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:297-339` (참고용, 이번 diff 비대상)
  - 상세: 이번 PR은 `triggerId`가 없을 때 락도 안 잡고 trigger도 안 지우는 기존 가드가
    한 번도 실행된 적이 없었다는 테스트 커버리지 갭만 메웠다(`schedules.service.spec.ts` 신규
    테스트). 프로덕션 로직 변경 없음 — DB 관점에서 새로 도입된 리스크 없음.
  - 제안: 조치 불요(참고 사항).

- **[INFO]** 테스트 모킹 정합성 개선 — `withTransactionMock`의 `m.update`가 이제
  `{ affected: 1 }` 기본값을 돌려주도록 고쳐, 프로덕션 코드의 `affected` 판정 로직이 실제
  TypeORM 계약(`UpdateResult` 항상 `{ affected }` 포함)과 어긋나지 않게 대역을 맞췄다.
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:130-146`
  - 상세: 프로덕션 코드를 `result?.affected`로 느슨하게 만드는 대신(그러면 `null`/`undefined`
    분기가 테스트로 검증되지 않을 위험) 공용 mock을 TypeORM 실제 반환 형태에 맞춰 충실하게
    고쳤다. 0행/미보고 분기는 `trigger-config-lock.spec.ts`의 전용 mock이 따로 검증하므로
    공용 mock에서 그 분기를 흉내내지 않는다는 설계 의도가 주석에 명확히 남아 있다. 적절함.
  - 제안: 없음.

- **[INFO]** `findByIdForUpdate` → `findByIdForPatchValidation` 개명은 순수 명명 변경으로
  DB 동작에 영향 없음. 저장소 관용구상 `FOR UPDATE`가 실제 행 잠금을 뜻하는 자리(7개 파일)와
  혼동을 없앤 것은 정확한 방향.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:542` (선언), `:557` (호출부)
  - 상세: 이 메서드는 애초에 행 잠금을 걸지 않는 경량 조회이므로, 락 부재가 결함이었던
    바로 그 코드에서 이름이 잠금을 암시하고 있던 문제를 해소한다. 스키마·쿼리 동작 변경 없음.
  - 제안: 없음.

## 요약

이번 PR의 핵심 DB 변경은 `rewriteTriggerConfigLocked`가 `UPDATE`의 `affected` 행 수를
확인하도록 고친 것으로, advisory lock으로는 막을 수 없는 세 번째 삭제 경로(`Workflow`/
`Workspace` 삭제의 FK `ON DELETE CASCADE`)로 인한 fail-open(0행 UPDATE를 성공으로 오판)을
정확히 닫는다. `affected === 0`과 `affected == null`(드라이버 미보고)을 구분해 처리하는
판정 로직이 타당하고, 전용 단위 테스트와 뮤테이션 검증(각 분기 1 RED)으로 뒷받침된다.
`SET LOCAL lock_timeout` 보간에 대한 `Number.isFinite` + clamp 방어 심도 추가도 적절하며,
현재는 모듈 상수만 전달되어 실질적 SQL 인젝션 벡터는 아니다. 트랜잭션 경계·락 획득 순서(락
먼저, 재읽기 나중)도 올바르게 유지된다. 스코프 밖의 잔여 사항(secret store 쓰기가 트랜잭션
밖에 있어 orphan 가능성, schedule/trigger 삭제가 별도 트랜잭션)은 이번 diff가 새로 만든
문제가 아니며 기존 설계 문서에 이미 트레이드오프로 반영되어 있다. 마이그레이션 변경,
N+1 쿼리, 인덱스, 커넥션 풀 이슈는 이번 diff 범위에 해당 사항 없음.

## 위험도
NONE
