# Database Review — trigger.config lost-update 수정 (6라운드)

## 검토 범위

`git diff origin/main...HEAD --name-only` 로 변경 파일 전수를 확인했다. 이번 라운드의
실질 diff 는 이전 5라운드(`18_17_44`·`19_07_43`·`19_44_08`·`20_17_16`·`20_49_15`)의
지적을 반영한 **삭제 경로 락 강화**(`889c93cd9`) + 그 강화가 새로 만든 지적에 대한
**정정**(`e5319a409` "관측 고리가 없으면 보증도 없다")이다. 핵심 파일
(`trigger-config-lock.ts`, `triggers.service.ts`, `chat-channel-binder.service.ts`,
`trigger-config-lock.spec.ts`, `triggers.service.spec.ts`, `trigger-transaction-mock.ts`,
`trigger-config-lost-update.e2e-spec.ts`)을 소스로 직접 열어 확인했고, 이전 라운드가
지적·수정한 항목이 현재 HEAD 에 실제로 반영됐는지 대조했다. `review/**`·`plan/**`·
`CHANGELOG.md` 는 이번 diff 의 산출물/문서이므로 데이터베이스 관점에서는 해당 없음.

## 발견사항

- **[WARNING]** `remove()` 의 삭제 트랜잭션이 **실패했을 때 감사 로그를 남기지 않는다**는
  보증이 어떤 테스트로도 고정돼 있지 않다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:968-990`
    (`manager.transaction(...).catch((err) => { logger.error(...); throw err; })` 뒤에
    바로 `await this.recordAudit({ ..., action: AUDIT_ACTIONS.TRIGGER_DELETED, ... })`)
  - 상세: 현재 소스는 삭제 트랜잭션(락 획득 + `m.remove(trigger)`)이 던지면 `.catch` 가
    로그만 남기고 **`throw err`** 로 재던지므로, `await` 가 실패해 뒤의 `recordAudit`
    호출까지 도달하지 않는다 — 즉 "행 삭제가 실패하면 TRIGGER_DELETED 감사도 남지 않는다"
    는 것이 코드의 현재 동작이고 이는 올바르다. 그런데 이 보증을 행사하는 테스트가
    `triggers.service.spec.ts` 어디에도 없다 — `m.remove`/락 획득이 던지는 경우를
    시뮬레이션하는 테스트가 0건이다(전수 `grep`: `remove()` 관련 테스트는 모두 성공
    경로만 다룬다). `.catch` 블록 안의 `throw err;` 를 지우거나(swallow) `logger.error`
    만 남기고 넘어가도록 바꾸는 뮤턴트가 있으면, 이 서비스는 **행이 여전히 DB 에 남아
    있는데도** `TRIGGER_DELETED` 감사 로그를 쓰고 컨트롤러는 204 를 반환한다 — 앞서
    이미 되돌릴 수 없이 끝난 `teardownChatChannel`·`secrets.deleteByPrefix`·listener
    unregister 와 합쳐지면 "반쯤 삭제됐는데 감사 로그와 API 응답은 완전 삭제라고
    말하는" 상태가 조용히 굳는다 — 이 파일의 plan/CHANGELOG 이 반복 강조하는 "관측
    고리가 없으면 보증도 없다" 원칙이 정확히 이 자리에는 아직 적용되지 않았다.
    실제로 리뷰 도중 이 파일을 재확인했을 때 `.catch` 블록이 `throw err;` 대신
    `// MUTANT: swallow` 라는 주석만 남긴 상태로 잠깐 관측됐다(아래 "절차 참고" 항
    참조) — 병렬 리뷰 세션의 뮤테이션으로 추정되며 재확인 결과 원상태(`throw err;`)로
    복구돼 있었지만, 공교롭게도 이 WARNING 이 겨누는 정확한 뮤턴트와 일치한다.
  - 제안: `triggers.service.spec.ts` 의 삭제 describe 에, 트랜잭션 mock 이 (락 획득
    이후) 에러를 던지도록 만든 뒤 `await expect(service.remove(...)).rejects.toThrow()`
    와 `expect(audit.record).not.toHaveBeenCalled()` 를 함께 거는 테스트를 추가한다.
    기존 `withTransactionMock`/`onLock` 인프라를 그대로 재사용할 수 있다(예: `query`
    mock 이 락 획득 직후 reject 하도록).

- **[INFO]** (긍정적 확인) 이전 라운드(`18_17_44/database.md`)가 지적한 "삭제 레이스가
  완전히 닫히지 않았다"(findOne 시점 가드는 쓰기 시점 삭제 경합을 못 막는다)는 이번
  라운드에서 실제로 닫혔다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:968-974` (`remove()`
    가 이제 `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })`
    를 잡은 뒤에만 `m.remove(trigger)` 를 부른다), `trigger-config-lock.ts:127-164`
    (`rewriteTriggerConfigLocked` 는 같은 락 안에서 재조회한다)
  - 상세: `remove()` 가 `rewriteTriggerConfigLocked`/창 1 과 **같은** advisory lock
    (`trigger-config:<id>`)을 잡게 되면서, "읽었을 땐 있었는데 저장 직전에 삭제되는"
    경합과 "삭제했을 땐 없었는데 그 사이 다른 요청이 재조회해 쓰는" 경합이 모두
    같은 락으로 직렬화된다. 삭제 경로에만 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5000ms)를
    둬 되돌릴 수 없는 정리(teardown·secret 삭제) 뒤의 무한 대기도 막았다 — 근거
    문서화가 `trigger-config-lock.ts:56-67` 에 정확히 남아 있다. 이 삭제-락 순서와
    상한 자체는 `triggers.service.spec.ts:3851-3872`(순서를 하나의 이벤트 배열로
    단언)로 관측 가능하게 고정돼 있다 — 이전 라운드가 "SQL 한 줄은 관측 고리가 없으면
    지켜지지 않는다"고 남긴 교훈이 이 자리에는 실제로 적용됐다.
  - 조치 불요. 재확인 차원.

- **[INFO]** 전역 32비트 advisory lock 키 공간 공유·창 1(`save(trigger)`)의 비-보안성
  잔여 lost update — 이전 라운드에서 이미 지적·수용된 항목, 이번 diff 로 변화 없음
  - 위치: `trigger-config-lock.ts:1-18`(`TRIGGER_CONFIG_LOCK_PREFIX`), `triggers.service.ts`
    `update()` 의 `m.save(Trigger, target)` (창 1)
  - 상세: `review/code/2026/09/14/18_17_44/database.md`·`20_49_15` 의 plan 처분표에
    각각 "조치 불요(수용됨)"·"후속 등재"로 이미 정리됐고, 이번 diff 가 이 둘을 다시
    건드리지 않는다. 재차 집계하지 않는다.

## 관점별 확인

- **인덱스**: 신규/변경된 쿼리는 전부 `WHERE id = $1`(PK) 필터다 — `rewriteTriggerConfigLocked`,
  창 1 재읽기, `remove()`, e2e 의 raw SQL 모두 동일. 기존 PK 인덱스로 충분, 신규 인덱스 불요.
- **N+1**: 반복문 내 개별 쿼리 없음. 오히려 이번 diff 가 `findByIdForUpdate`(관계 없는
  경량 조회)를 분리해 PATCH 마다 `workflow` JOIN SELECT 가 두 번 돌던 것을 한 번으로
  줄였다(`triggers.service.ts:483-494`).
- **트랜잭션**: `manager.transaction()` + `pg_advisory_xact_lock` 조합이 이번에도
  일관되게 쓰인다. 외부 HTTP 호출(`teardownChatChannel`·`adapter.setupChannel`)은
  트랜잭션/락 **밖**에 남아 Cafe24 advisory lock 기각 선례(HTTP 를 트랜잭션에 묶으면
  커넥션 점유가 늘어남)를 계속 피한다. 삭제 경로만 `SET LOCAL lock_timeout` 으로 대기
  상한을 두고 나머지는 무한 대기(짧은 임계 구간이 근거)를 유지하는 비대칭도 근거와 함께
  문서화돼 있다. 유일한 잔여 갭은 위 WARNING(트랜잭션 실패 시 감사 미기록 경로 미검증).
- **마이그레이션 안전성**: 이번 diff 에 DDL 없음 — 해당 없음.
- **스키마 설계**: `Trigger.config`(jsonb)를 락 안에서 재읽은 최신 값 위에 서브키만
  머지하는 설계가 이번 라운드에도 유지된다. `remove()` 가 같은 직렬화 도메인에
  편입되면서 "config 재작성 vs 행 삭제"라는 같은 애그리게잇 안의 두 쓰기 유형이 하나의
  락 네임스페이스로 통일됐다 — 스키마 자체 변경은 없지만 동시성 모델의 일관성이 개선됐다.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션 획득/해제를
  관리하며, 정상/예외 경로 모두 콜백 종료 시 반환된다. `pg_advisory_xact_lock` 은
  트랜잭션 종료(커밋/롤백) 시 자동 해제라 락 누수 없음. e2e 의 `lockDb`(전용 raw
  connection)도 `afterAll` 에서 `end()` 로 명시 해제한다.
- **SQL 인젝션**: `SELECT pg_advisory_xact_lock(hashtext($1))`, `m.update`/`m.findOne`
  등 TypeORM API, e2e 의 모든 raw 쿼리(`UPDATE trigger SET config = $2::jsonb WHERE id = $1`
  등)가 파라미터 바인딩을 쓴다. 유일하게 문자열 보간을 쓰는 자리는
  `acquireTriggerConfigLock` 의 `` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` ``
  인데(파라미터 바인딩이 안 되는 자리), `timeoutMs` 는 프로덕션 호출부 전수(`grep`
  확인: `triggers.service.ts` 두 곳, `trigger-config-lock.ts` 자기 자신)에서
  하드코딩 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 만 넘어오고 사용자 입력이
  도달하는 경로가 없다 — `Math.trunc` 로도 좁혀 정수 이외 값을 원천 차단한다. 실질적
  인젝션 위험 없음.
- **대량 데이터**: 단일 트리거 단위 read-merge-write/삭제만 발생. 페이지네이션·대용량
  스캔과 무관.

## 절차 참고 (이슈로 집계하지 않음)

리뷰 도중 `triggers.service.ts:975-982` 를 재확인했을 때, `.catch` 블록 본문이
`this.logger.error(...)` 뒤에 `throw err;` 대신 `// MUTANT: swallow` 주석만 남긴
상태로 한 차례 관측됐다. 병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은
워킹트리를 동시에 mutate" 상황으로 보인다. 재확인(`grep -n "throw err" ...`, 재-Read)
결과 파일은 `throw err;` 가 있는 정상 상태였고 `git status --short`/`git diff` 도
이 파일에 대해 clean 하다 — 저장소에 잔여 이상 상태는 없다. 다만 그 순간 관측된
형태가 위 WARNING 이 정확히 겨냥하는 뮤턴트와 일치한다는 점은 그 WARNING 의 현실성을
뒷받침하는 정황으로 기록해 둔다.

## 요약

이번 라운드의 diff 는 이전 5라운드가 축적한 지적 중 "삭제 경로가 같은 config 락에
참여하지 않아 쓰기 시점 삭제 경합이 남는다"를 실제로 닫았고(`889c93cd9`), 그 수정이
새로 만든 위험(되돌릴 수 없는 정리 뒤의 무한 락 대기·순서/게이트 미검증)도 상한
설정과 관측 고리(이벤트 순서 배열 단언)로 추가 정정했다(`e5319a409`). 핵심 동시성
설계(advisory lock + 락 안 재읽기, 외부 호출을 임계 구간 밖에 두는 것, PK 기반
read-merge-write)는 여전히 견고하고 파라미터화 쿼리·커넥션 관리·인덱스 사용에
문제가 없다. 새로 발견한 것은 하나 — `remove()` 의 삭제 트랜잭션이 실패했을 때
"감사 로그를 남기지 않는다"는, 데이터 정합성에 직결되는 보증이 코드상으로는 지켜지고
있지만 이를 지키는 테스트가 없어 향후 리팩터가 조용히 되돌릴 수 있다는 점이다(WARNING).
이 저장소가 스스로 반복 강조해 온 "관측 고리가 없으면 보증도 테스트가 지킬 수 없다"는
교훈이 이 특정 실패 분기에는 아직 적용되지 않은 상태다. 이번 배치를 막을 사유는
아니며, 나머지 항목은 모두 이전 라운드에서 이미 문서화·수용된 것의 재확인이다.

## 위험도

LOW
