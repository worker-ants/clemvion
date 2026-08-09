# 데이터베이스(Database) 리뷰

## 검토 범위 메모

19개 변경 파일 중 실제 DB 관련 코드는 다음으로 좁혀진다:

- `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` — `deleteByPrefix`(TypeORM `QueryBuilder` LIKE 삭제)의 mock 을 강화하고, 쿼리 **형태**(`ref LIKE :prefix`, 바인딩 `<prefix>%`, `ESCAPE` 절 부재)를 단언하는 연결점 테스트 2건 추가.
- `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts` (신규) — 동일 위험을 실 Postgres 에 직접 질의해 검증하는 e2e 3건.
- `codebase/backend/migrations/V063__secret_store.sql` — 이번 diff 의 대상은 아니지만 e2e 근거 주석이 인용하므로 스키마 제약을 대조 확인함(참고용).
- 나머지 파일(README, 워크스페이스 UUID 픽스처/캐너리/가드 spec, plan 문서, consistency-check 산출물)은 애플리케이션 DB 쿼리·스키마·트랜잭션·커넥션 로직을 건드리지 않는다 — 워크스페이스 UUID 는 헤더/토큰 값의 **형태 검증**(`isUuidShaped`) 문제이고, `RolesGuard`/`getMemberRole` 자체의 쿼리 코드는 이번 diff 에 포함되지 않았다.

이하 발견사항은 위 DB 관련 두 파일에 한정된다. 나머지는 DB 관점에서 해당 없음.

## 발견사항

- **[INFO]** `deleteByPrefix` LIKE 삭제 경로에 실행 가능한 존재-근거 테스트가 새로 생겼다 — 긍정적 보강
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts:307`(연결점 단언), `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts:96`,`104`,`116`(e2e 3건)
  - 상세: 프로덕션 코드(`secret-resolver.service.ts:163-181`, 이번 diff 밖)는 이미 파라미터화된 TypeORM 쿼리(`where('ref LIKE :prefix', { prefix })`)를 쓰고, `deleteByPrefix` 앞단에서 `/[%_\\]/` 정규식으로 LIKE 메타문자를 **입력 자체에서 거부**하는 가드를 두고 있다(파라미터 바인딩이라 SQL 인젝션은 아니지만, `%`/`_` 가 섞이면 의도보다 넓게 삭제되는 "돌이킬 수 없는" 위험). 종전 in-memory mock 은 `startsWith` 로 근사해 이 위험을 재현하지 못했는데, 이번 변경은 (1) 단위 테스트에서 실제 쿼리 문자열·바인딩 패턴·`ESCAPE` 절 부재를 관측점(`_lastDeleteQuery`)으로 직접 단언하고, (2) e2e 로 실 Postgres 에 동일 형태 쿼리를 던져 "가드가 없으면 이웃 리소스까지 삭제된다"를 `_`/`%` 각각에 대해 의도(0건) vs 실제(2건) 대조로 고정했다. 대량 삭제·비가역 연산에 대한 존재 근거를 코드로 고정한 모범 사례다.
  - 제안: 조치 불요.

- **[INFO]** e2e 커넥션 관리 — 단일 `pg.Client`, suite 단위 open/close
  - 위치: `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts:56`(`beforeAll` → `db.connect()`), `:61`(`afterAll` → `db.end()`)
  - 상세: 풀(Pool) 대신 단일 `Client` 를 `beforeAll`/`afterAll` 로 열고 닫는 패턴이며 `test/helpers/db.ts`(`createDbClient`)의 기존 e2e 관례와 일치한다. 누수 없이 정상 해제되며, 테스트 격리는 `uniqueName('like')` 네임스페이스 + `beforeEach`/`afterAll` 의 `DELETE ... WHERE ref LIKE $1` 로 확보된다. 문제 없음.
  - 제안: 조치 불요.

- **[INFO]** `beforeEach` 의 정리+시드 2개 INSERT 가 트랜잭션으로 묶여 있지 않음
  - 위치: `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts:68-77`
  - 상세: `DELETE` 후 `refA`/`refB` 를 개별 `INSERT` 로 순차 실행한다. 두 번째 INSERT 가 실패하면 refA 만 남은 상태로 다음 assertion 이 진행될 수 있다. 다만 이 파일은 고정 리터럴 값(메타문자 없는 unique 문자열)만 삽입하므로 실패 가능성은 사실상 없고, e2e 시드 코드에서 트랜잭션 없이 순차 INSERT 하는 것은 이 저장소의 다른 e2e 스펙에서도 흔한 패턴이다. 프로덕션 로직이 아니라 테스트 fixture 셋업이므로 위험도는 낮다.
  - 제안: 조치 불요(원하면 `BEGIN`/`COMMIT` 로 묶어 원자성을 높일 수 있으나 비용 대비 실익 낮음).

- **[INFO]** SQL 인젝션 관점 — 전 구간 파라미터화 확인
  - 위치: `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts:62`,`69`,`73`,`82`,`89`(전부 `$1`/`$2` placeholder), `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts:317-318`(TypeORM named parameter `:prefix`)
  - 상세: raw `pg.Client` 사용 구간도 전부 placeholder 바인딩이며 문자열 결합(concatenation)으로 쿼리를 조립하는 곳이 없다. 프로덕션 `deleteByPrefix` 도 동일하게 TypeORM 파라미터 바인딩을 쓴다. LIKE 메타문자 위험은 인젝션이 아니라 "의도보다 넓은 매칭 범위" 문제이며, 이는 애플리케이션 가드(정규식 거부)로 이미 닫혀 있고 이번 diff 는 그 사실을 테스트로 고정했을 뿐이다.
  - 제안: 조치 불요.

## 요약

이번 변경분에서 실제 DB 쿼리·스키마·트랜잭션·커넥션 로직을 수정한 곳은 없다. 유일한 DB 관련 실질 변경은 기존에 이미 안전하게 구현돼 있던 `SecretResolverService.deleteByPrefix`(파라미터화된 TypeORM LIKE 쿼리 + 메타문자 거부 가드)에 대해 "가드가 없으면 실 Postgres 가 과다삭제한다"는 위험을 실행 가능한 테스트(단위 연결점 + e2e 3건)로 고정한 것이며, 이는 대량·비가역 삭제 연산에 대한 바람직한 보강이다. 커넥션 관리·파라미터 바인딩 모두 문제없이 구성돼 있고, 나머지 파일(README, 워크스페이스 UUID 픽스처/가드 spec, plan 문서, consistency-check 산출물)은 DB 관점에서 다룰 내용이 없다.

## 위험도

NONE
