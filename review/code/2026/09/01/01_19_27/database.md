# 데이터베이스(Database) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** (확인 결과, 문제 없음) `incrementLoginAttempts` 의 read-modify-write `save()` 를
  단일 원자 파라미터화 `UPDATE … RETURNING` 으로 재작성 — lost-update 결함이 실제로 닫혔다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `incrementLoginAttempts`
    (raw query, `WHERE id = $1`)
  - 상세: 직전 리뷰 라운드(`review/code/2026/09/01/00_55_27/concurrency.md`)가 CRITICAL 로
    지목한 지점이다 — `updateAvatar` 는 컬럼 단위 `update(userId, {avatarUrl})` 로 lost
    update 를 막았지만, 같은 파일의 `incrementLoginAttempts` 는 여전히
    `findOneOrFail` → 필드 수정 → `save(user)` 라 **반대 방향**(로그인 실패 카운터 저장이
    방금 커밋된 `avatarUrl` 을 옛 스냅샷 값으로 되돌리는 경로, 심지어 이미 삭제된 S3
    오브젝트를 다시 가리키는 상태)이 열려 있었다. 지금 코드는 `UPDATE "user" SET
    login_attempts = login_attempts + 1, locked_until = CASE … END WHERE id = $1 RETURNING
    login_attempts` 단일 문으로 바뀌었고, 파라미터는 `$1`(id) · `$2`(임계값) ·
    `$3`(잠금 분) 로 전부 바인딩된다(SQL 인젝션 표면 없음). 잠금 시각도 앱 서버 시계
    (`Date.now()`) 대신 DB `NOW()` 로 계산해 다중 인스턴스 시계 편차 문제도 함께
    제거했다. `users-login-attempts.service.spec.ts` 가 SET 절 컬럼 집합을 정확히
    (`login_attempts`, `locked_until` 만) 비교해 `avatar_url` 이 다시 섞여 들어가는
    회귀를 구조적으로 고정한다. `updateReturningRows` 헬퍼로 TypeORM 0.3.x + pg 의
    `[rows, rowCount]` 튜플 형태를 안전하게 벗겨 `rows.length === 0` 일 때
    `NotFoundException` 을 던지는 것도 종전 `findOneOrFail` 계약과 동일하다. 새로운
    DB 결함은 없다 — 다른 병렬 reviewer(concurrency)가 낸 CRITICAL 이 이번 라운드
    반영분에서 근거대로 해소됐음을 DB 관점에서도 확인한다.

- **[INFO]** `updateAvatar` 가 `save(entity)` 대신 컬럼 단위 `update(userId, {avatarUrl})`
  를 쓰는 설계는 트랜잭션·락 없이 lost-update 를 없애는 정확한 선택이다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar`
  - 상세: S3 업로드(네트워크 I/O, 수백 ms~수 초)가 끝난 뒤 UPDATE 문에 `avatarUrl` 한
    컬럼만 싣기 때문에, 업로드 도중 다른 요청이 바꾼 `loginAttempts`·`lockedUntil`·
    `twoFactorSecret` 등 다른 컬럼은 이 UPDATE 문에 실리지 않아 되돌아갈 수 없다.
    `@VersionColumn`(낙관적 잠금)이나 명시적 트랜잭션 없이도 이 UPDATE 자체는
    Postgres 레벨에서 원자적이라 정합성이 성립한다. `users-avatar.service.spec.ts`
    가 `Object.keys(patch)).toEqual(['avatarUrl'])` 로 SET 절 컬럼 집합을 정확히
    고정해, 다음 사람이 부주의하게 추가 컬럼을 얹는 회귀를 잡는다.

- **[INFO]** (검증됨, 결함 아님) `updateAvatar`↔`updateAvatar` / `update()` 간 avatarUrl
  자체의 TOCTOU 는 DB 정합성이 아니라 S3 고아 객체로만 귀결되도록 범위가 좁혀져 있고,
  이미 측정 가능한 재개 신호와 함께 명시적으로 유예돼 있다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `update()`(previousUrl
    사전 조회 → `userRepository.update()` → 재조회 → 조건부 정리) /
    `plan/in-progress/spec-sync-user-profile-gaps.md` §"동시 업로드 TOCTOU"
  - 상세: `update()` 는 UPDATE 앞에서 `previousUrl` 을 별도 SELECT 로 읽는데, 이
    SELECT~UPDATE 사이에 동시 요청이 끼어들면 "패자" 가 올린 S3 객체가 어느 쪽 정리
    로직의 대상도 되지 못해 영구 고아로 남을 수 있다(이미 concurrency 리뷰가 인터리빙을
    추적해 확인). 다만 이 경로에서 **DB 컬럼 자체는 항상 유효한 최신 URL 을
    가리킨다** — `update(id, data)` 가 호출 시점의 `data` 를 그대로 쓰는 컬럼 단위
    쓰기라, 두 동시 write 가 경합해도 마지막에 커밋된 쪽 값이 DB 에 남을 뿐 다른
    컬럼을 되돌리거나 값이 소실되지 않는다. `SELECT … FOR UPDATE`/advisory lock 없이는
    막을 수 없는 종류의 경쟁이지만, 그 대가(S3 과금·용량)와 발생 조건이 plan 문서에
    명시돼 있고 새로 지적할 DB 무결성 문제는 없다.

- **[INFO]** `avatar_url` 컬럼 폭(`length: 500`)이 이번에 신설된 URL 조합
  (`{publicBaseUrl}/{bucket}/{encodedKey}`)을 수용하기에 여유가 있다 — 참고용, 결함 아님
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts:27`
    (`@Column({ name: 'avatar_url', nullable: true, length: 500 })`) /
    `codebase/backend/src/common/services/s3.service.ts` `getPublicUrl`
  - 상세: `getPublicUrl` 이 만드는 문자열은 `base + '/' + bucket + '/' + encodedKey` 이고,
    `encodedKey` 는 `avatars/{uuid}/{uuid}.{ext}` 형태(최대 40자 내외)라 일반적인
    CDN 도메인·버킷 이름을 더해도 500자에 크게 못 미친다(실측 예시 기준 150자 내외).
    운영 환경에서 base URL 을 극단적으로 길게 설정하는 경우가 아니면 컬럼 폭 초과로
    인한 저장 실패(Postgres `value too long for type character varying`)는 실질적으로
    발생하지 않는다. 별도 조치 불필요.

## 그 외 점검 결과 (문제 없음)

- **인덱스**: 이번 diff 는 `id`(PK) 기준 조회/갱신만 추가한다(`findOne({where:{id}}})`,
  `update(userId, …)`, `query(... WHERE id = $1 ...)`). `avatarUrl` 값으로 조회하는
  신규 쿼리가 없어 인덱스 추가 필요성이 없다.
- **N+1 쿼리**: `updateAvatar` 는 요청당 SELECT 1(존재 확인) + UPDATE 1(컬럼 단위) +
  SELECT 1(재조회, S3 정리와 병렬)로 고정 횟수이며 반복문 안에서 쿼리를 내는 구조가 아니다.
- **마이그레이션 안전성**: 이번 PR 은 마이그레이션 파일을 포함하지 않는다 —
  `avatar_url` 컬럼은 기존 스키마에 이미 존재했고, DDL 변경이 없어 무중단 배포·lock
  관점의 위험이 없다.
- **스키마 설계**: 신규 테이블/컬럼 없음. 기존 `avatar_url` 컬럼을 그대로 재사용하며
  워크스페이스 종속 없는 `User` 리소스 설계와 일치한다(키 레이아웃도
  `avatars/{userId}/{uuid}.{ext}` 로 workspaceId 미포함이 의도대로 명시돼 있다).
- **커넥션 관리**: 모든 DB 접근이 NestJS `@InjectRepository(User)` 로 주입된 TypeORM
  `Repository`(및 그 매니저의 `query()`)를 통하며, 수동 커넥션 획득/해제가 없다 —
  기존 커넥션 풀 패턴을 그대로 따른다.
- **SQL 인젝션**: `incrementLoginAttempts` 의 신규 raw SQL 은 `$1`/`$2`/`$3` 전부
  파라미터 바인딩이고 문자열 결합이 없다. 나머지 쿼리는 TypeORM Repository/QueryBuilder
  API(파라미터화)를 그대로 사용한다.
- **대량 데이터**: 전부 단일 사용자 row 대상 CRUD 이며 목록 조회·페이지네이션과
  무관하다.

## 요약

이번 라운드의 diff 는 데이터베이스 관점에서 이미 상당 부분 다듬어진 상태다. 직전
라운드(`review/code/2026/09/01/00_55_27`)가 지목한 CRITICAL — `incrementLoginAttempts`
의 전체-엔티티 `save()` 가 `updateAvatar` 의 컬럼 단위 `update()` 를 반대 방향에서
무효화할 수 있다는 lost-update 결함 — 은 파라미터화된 단일 원자 `UPDATE … RETURNING`
문으로 재작성되어 실제로 해소되었고, SET 절 컬럼 집합을 정확히 비교하는 신규 테스트
(`users-login-attempts.service.spec.ts`)로 회귀도 고정돼 있다. `updateAvatar` 자체도
`save(entity)` 대신 컬럼 단위 `update()` 만 쓰도록 설계되어 있어 락·트랜잭션 없이
정합성을 지키는 방식이 두 지점 모두 일관된다. 남아 있는 유일한 동시성 잔여
위험(avatarUrl 자체를 두고 두 동시 업로드가 경합해 패자의 S3 객체가 고아로 남는
TOCTOU)은 DB 컬럼 값 자체의 무결성을 깨지 않는 것으로 이미 확인되었고, 측정 가능한
재개 신호와 함께 plan 문서에 명시적으로 유예되어 있어 새로 지적할 사항이 아니다.
마이그레이션 변경은 없고(`avatar_url` 컬럼은 기존 스키마), 신규 raw SQL 은 완전히
파라미터화되어 SQL 인젝션 표면이 없으며, 인덱스·N+1·커넥션 관리·대량 데이터 처리
어느 항목에서도 새로운 결함을 발견하지 못했다.

## 위험도

LOW
