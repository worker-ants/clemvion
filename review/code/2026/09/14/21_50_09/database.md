# Database Review — trigger.config lost-update 수정 (8라운드)

## 검토 범위

`git diff origin/main...HEAD --name-only` 로 변경 파일 전수를 확인했다. 핵심 DB 관련
파일(`trigger-config-lock.ts`, `trigger-config-lock.spec.ts`, `triggers.service.ts`,
`triggers.service.spec.ts`, `chat-channel-binder.service.ts`, `hooks.service.ts`,
`hooks.service.spec.ts`, `trigger-transaction-mock.ts`,
`trigger-config-lost-update.e2e-spec.ts`)을 소스로 직접 열어 확인했다. `review/**`·
`plan/**`·`CHANGELOG.md`·`repo-guards/__tests__/**`(정적 분석 가드/픽스처)는 DB 런타임
동작이 아니므로 이번 관점에서는 해당 없음으로 취급했다. 이 세션(`21_50_09`)의 실질
diff 는 직전 라운드(`21_18_21`)가 지적한 항목에 대한 정정 커밋 `bf2becd0c` 다 — 이 한
커밋만 새로 검토하고, 그 이전 7라운드가 이미 검증한 핵심 설계(advisory lock + 락 안
재읽기, 삭제 경로 직렬화·상한, 파라미터화 쿼리)는 재확인만 했다.

## 이전 라운드 지적의 처리 상태 확인

- `21_18_21/database.md` WARNING — "`remove()` 삭제 트랜잭션 실패 시 감사 로그를 남기지
  않는다는 보증을 지키는 테스트가 없다" → **해결 확인**. `bf2becd0c` 가
  `triggers.service.spec.ts` 에 `'remove() 실패는 삼키지 않고 던진다 — 반쯤 삭제된 상태를
  드러낸다'` 테스트를 추가했다. `removeRejects: true` 옵션으로 `m.remove` 가 reject 하게
  만들고, `service.remove(...)` 가 그 에러를 그대로 던지는 것과 `audit.record` 호출
  action 목록에 `'trigger.deleted'` 가 없는 것을 함께 단언한다
  (`codebase/backend/src/modules/triggers/triggers.service.spec.ts`, `remove() 실패는
  삼키지 않고 던진다` 테스트). 코드 쪽(`triggers.service.ts:977-991`)의 `.catch` 도
  `logger.error(...)` 뒤 `throw err;` 로 재던지는 형태가 그대로 유지돼 있다 — 이제
  회귀가 생기면 이 테스트가 RED 로 잡는다.
- 이번 커밋의 나머지 diff(`assertTriggerFound`/`throwTriggerNotFound` 분리,
  `touchLastTriggeredAt`/CCH-NF-03 docblock 재배치, `lock_timeout` 주석 확장,
  `trigger-config-lock.spec.ts` 의 null/undefined `it.each`)는 전부 리팩터링·문서·테스트
  보강이고 SQL 문·트랜잭션 경계·쿼리 파라미터 바인딩 자체를 바꾸지 않는다.

## 관점별 확인

- **인덱스**: 이번 커밋이 건드린 쿼리 없음(문서·테스트·private 헬퍼 분리뿐). 기존 전부
  `WHERE id = $1`(PK) 기준이라 신규 인덱스 불요 — 이전 라운드 결론 유지.
- **N+1 쿼리**: 반복문 내 개별 쿼리 없음. 변경 없음.
- **트랜잭션**: `remove()` 의 `manager.transaction(...).catch(...)` 가 에러를 삼키지 않고
  재던지는 것이 이제 테스트로 고정됐다 — "트랜잭션 실패 = 감사 미기록 = 반쯤 삭제 상태를
  호출자에게 드러낸다"는 데이터 정합성 보증이 회귀에 강해졌다. `acquireTriggerConfigLock`
  의 `SET LOCAL lock_timeout` 이 advisory lock 하나가 아니라 그 트랜잭션의 모든 락 대기
  (뒤따르는 `DELETE` 의 행 잠금, `Schedule.triggerId` CASCADE 연쇄)에 적용된다는 사실이
  주석으로 명시됐고, 이는 실제 Postgres 의미론과 일치한다.
- **마이그레이션 안전성**: 이번 diff에 DDL 없음(`git diff --name-only` 에 migrations 경로
  0건) — 해당 없음.
- **스키마 설계**: 변경 없음. `Trigger.config`(jsonb) 를 advisory lock 안에서 재읽어 병합하는
  기존 설계 그대로.
- **커넥션 관리**: `manager.transaction()` 이 TypeORM 을 통해 커넥션을 관리하고,
  `pg_advisory_xact_lock` 은 트랜잭션 종료(커밋/롤백/에러 재던짐 포함) 시 자동 해제된다.
  `remove()` 의 `.catch` 가 `throw err` 로 재전파해도 `manager.transaction()` 자체는 이미
  콜백 예외 시 롤백을 수행한 뒤이므로 커넥션·락 누수 없음.
- **SQL 인젝션**: `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` 가
  유일한 문자열 보간 자리(파라미터 바인딩 불가 위치)인데, 호출부는 모듈 상수
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 만 넘기고 `Math.trunc` 로 정수만 문자열에
  들어가게 강제한다 — 사용자 입력이 도달하는 경로 없음. 나머지는 전부
  `manager.query('...', [param])` / TypeORM API 파라미터 바인딩. 이번 커밋은 이 자리의
  주석만 확장했고 코드는 바꾸지 않았다.
- **대량 데이터**: 단일 트리거 단위 read-merge-write/삭제만 발생. 페이지네이션·대용량
  스캔과 무관.

## 참고 (조치 불요, 재차 집계 안 함 — 이전 라운드 수용 항목)

- `TRIGGER_CONFIG_LOCK_PREFIX`(`hashtext()` 32비트 해시 공간)는 이론상 서로 다른
  triggerId 가 같은 advisory lock 정수로 충돌해 무관한 트리거끼리 불필요하게 직렬화될
  가능성이 있다 — correctness 문제는 아니고(같은 트리거끼리의 직렬화는 정확히 보장됨)
  드문 성능/대기 시간 영향에 그친다. `redis-keys.md §4` 네임스페이스 등재는 이미
  planner 항목(`review/consistency/2026/09/14/17_10_16` naming_collision WARNING#2)으로
  올라가 있어 이 리뷰에서 중복 집계하지 않는다.

## 요약

이번 라운드의 실질 diff(`bf2becd0c`)는 직전 라운드가 지적한 유일한 데이터베이스
관점 WARNING — "`remove()` 삭제 트랜잭션 실패 시 감사 로그 미기록 보증을 지키는
테스트가 없다" — 를 정확히 그 보증(에러 전파 + 감사 미기록)을 함께 단언하는 테스트로
닫았다. 그 외 변경은 문서·리팩터링(사설 헬퍼 분리, JSDoc 재배치)뿐이라 SQL 문·트랜잭션
경계·파라미터 바인딩에 새로운 위험을 들이지 않는다. 핵심 동시성 설계(advisory lock +
락 안 재읽기, 외부 호출을 임계 구간 밖에 두는 것, 삭제 경로만 대기 상한을 두는 비대칭,
PK 기반 read-merge-write)는 8라운드에 걸쳐 일관되게 검증됐고 이번 라운드도 이를
재확인했다. 이 배치를 막을 데이터베이스 관점의 신규 사유는 없다.

## 위험도

LOW
