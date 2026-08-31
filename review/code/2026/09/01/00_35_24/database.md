# 데이터베이스(Database) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 범위 판단

이번 diff(110개 변경 파일, 대부분 S3/MinIO 설정·Swagger·k8s/compose·spec/plan 문서·이전 리뷰 라운드 산출물)
중 실제 RDBMS 상호작용이 있는 코드는 여전히
`codebase/backend/src/modules/users/users.service.ts` 의 `updateAvatar()` / `update()`
(TypeORM `Repository<User>`)뿐이다.

직전 리뷰 라운드(`review/code/2026/09/01/00_11_39/database.md`) 이후 커밋(`ecaa785bd`, "리뷰 5R — 버킷
정책 e2e 신설 + 빈-버퍼 가드의 vacuous 테스트 정정")을 `git show --stat`/`git show <file>` 로 직접 대조했다.
이 커밋이 건드린 것은 `users-avatar.service.spec.ts`(테스트 케이스 보강) · `users.controller.ts`(주석
1곳 추가, 로직 무변경) · 신규 e2e 스펙 · plan 문서 · 이전 리뷰 산출물뿐이며, **`users.service.ts` 는 이번
커밋에서 전혀 변경되지 않았다**(`git log --oneline -- codebase/backend/src/modules/users/users.service.ts`
의 최신 항목은 그 이전 커밋 `a1b381678`). 즉 DB 쿼리·트랜잭션·스키마 관련 프로덕션 코드는 직전 라운드
검토 시점과 동일하다.

신규 마이그레이션·엔티티 변경 없음 — `avatarUrl` 컬럼은 기존 컬럼이다
(`@Column({ name: 'avatar_url', nullable: true, length: 500 })`, `entities/user.entity.ts:27-28`).
`codebase/backend/migrations/` 디렉터리에 이 PR 로 추가된 `.sql` 파일이 없음을 확인했다.

## 발견사항

- **[INFO]** `updateAvatar()`/`update()` 의 옛-객체 정리 대상 선정이 비원자적 사전 SELECT 다 — 이미
  문서화·유예된 항목이며 DB row 정합성은 훼손되지 않는다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `UsersService.updateAvatar`
    (`const previousUrl = user.avatarUrl;` 직후 → `await this.s3Service.upload(...)` →
    `await this.userRepository.update(userId, { avatarUrl })`), 그리고 `UsersService.update`
    (`'avatarUrl' in data` 분기의 사전 `findOne`)
  - 상세: 두 메서드 모두 "정리 대상 previousUrl 을 사전 SELECT로 스냅샷 → (I/O) → UPDATE" 패턴이며
    이 read-then-write 구간에 DB 트랜잭션이나 행 잠금(`SELECT ... FOR UPDATE`)이 없다. `updateAvatar`
    (POST, 신규 업로드)와 `update`(PATCH, 기존 메서드에 avatarUrl 정리 로직만 이번 diff 로 추가됨)가
    같은 사용자에 대해 동시에 실행되면, 나중에 커밋한 UPDATE 가 `avatarUrl` 컬럼을 덮어써 먼저 커밋한
    값을 잃을 수 있다(단일 컬럼 last-write-wins). **DB row 자체는 항상 유효한 URL 하나를 갖는 well-defined
    상태로 남으므로 정합성은 깨지지 않는다** — 결과는 승자를 가리는 avatarUrl 컬럼 자체와, 패자가
    올린 S3 오브젝트가 참조를 잃는 스토리지 비용/용량 문제뿐이다. 이 클래스의 경합은 리뷰 2·5라운드에서
    이미 지적됐고(`updateAvatar` 끼리뿐 아니라 `update` 와의 교차 인터리빙도 포함해 5라운드에서 범위가
    보강됐다) `plan/in-progress/spec-sync-user-profile-gaps.md` 에 측정 가능한 재개 신호
    (`avatars/` 접두 객체 수가 사용자 수를 유의미하게 웃돌 때)와 함께 명시적으로 유예 등재돼 있음을
    직접 열어 확인했다.
  - 제안: 추가 조치 불요(문서화된 유예 유지). 재개 시 per-user advisory lock 또는
    `SELECT ... FOR UPDATE` 로 read-modify-write 를 원자화하거나, 주기적 orphan-sweep 배치를 권장.

- **[INFO]** `updateAvatar()` 의 lost-update 방지 — targeted column UPDATE 확인 (긍정 발견, 회귀 없음)
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `UsersService.updateAvatar` —
    `this.userRepository.update(userId, { avatarUrl })` (엔티티 전체 `save()` 아님)
  - 상세: S3 업로드(네트워크 I/O, 수백 ms~수 초) 앞에서 읽은 엔티티 스냅샷을 `save()` 하지 않고 컬럼
    단위 `update()` 만 실행한다. 락이나 `@VersionColumn` 없이도, 업로드가 도는 동안 다른 요청이 바꾼
    다른 컬럼(로그인 실패 카운터·계정 잠금·2FA 등)이 조용히 되돌아가는 lost update 를 원천 차단한다.
    이전 라운드가 CRITICAL 로 지적했던 "엔티티 전체 `save()`" 패턴은 이번 diff 에 없다.
  - 제안: 없음 — 현재 구현이 올바르다.

## 그 외 점검 결과 (문제 없음)

- **인덱스**: 모든 쿼리(`findOne`, `update`, `findOneOrFail`)가 PK `id` 기준이며 기존 PK 인덱스로
  충분하다. 변경 범위 밖의 `emailTakenByOther`(QueryBuilder, `LOWER(:email)`/`!= :id`)는 이 diff 로
  손대지 않았다.
- **N+1 쿼리**: 반복문 안에서 쿼리를 발생시키는 구조가 없다. `updateAvatar` 는 요청당 SELECT 1 + UPDATE 1
  + SELECT 1(findOneOrFail, S3 delete 와 `Promise.all` 병렬)로 고정. `update()` 는 페이로드에 `avatarUrl`
  이 있을 때만 추가 SELECT 1회를 내도록 `'avatarUrl' in data` 로 가드돼 있어, 이 메서드의 나머지 17개
  호출부(로그인 시도 카운터·2FA 등 뜨거운 경로)는 불필요한 SELECT 를 타지 않는다.
- **트랜잭션**: 단일 컬럼 UPDATE 로 원자성 요구 범위 자체를 좁혀, 명시적 `queryRunner`/`@Transaction`
  없이도 DB row 정합성이 성립한다. "DB 저장 뒤에 옛 객체 정리" 순서(`await update()` 완료 후에만
  `Promise.all([findOneOrFail, deletePreviousAvatarObject])`)도 유지된다 — 저장 실패 시 이미 지워진
  아바타를 가리키는 URL 이 남는 사고를 막는다. (S3 업로드 자체는 DB 트랜잭션 범위 밖 — 별도 스토리지라
  원리적으로 함께 묶을 수 없고, 순서 보장으로 대체한 것은 타당한 설계다.)
- **마이그레이션 안전성**: 스키마 변경 없음. `avatar_url` 컬럼은 기존 컬럼이며 신규 `.sql` 마이그레이션
  파일도 없다. lock/무중단 배포 위험 없음.
- **스키마 설계**: 신규 테이블/컬럼/관계 변경 없음. 외부 URL과 자체 업로드 URL 이 같은 `avatar_url`
  컬럼(문자열, 500자)을 공유하는 기존 설계를 그대로 재사용한다.
- **커넥션 관리**: `@InjectRepository(User)` 표준 TypeORM 패턴만 있고 수동 커넥션 획득/해제가 없다.
  `S3Service` 는 stateless local provider 로 추가됐고 DB 커넥션 풀과 무관하다.
- **SQL 인젝션**: 변경된 쿼리는 전부 TypeORM Repository API(`findOne`/`update`/`findOneOrFail`)로
  파라미터가 바인딩된다. 문자열 결합 raw SQL 없음.
- **대량 데이터**: 단건 사용자 row 조회/갱신뿐이라 페이지네이션·대용량 스캔과 무관하다.

## 요약

DB 관점에서 이번 diff 는 직전 라운드(`00_11_39`) 대비 실질 변경이 없다 — 마지막 커밋(`ecaa785bd`)은
테스트·e2e·plan 문서만 건드렸고 `users.service.ts` 는 그대로다. 신규 스키마/마이그레이션이 없고
(`avatar_url` 컬럼은 기존 것을 재사용), 모든 쿼리가 PK 기반 파라미터화된 TypeORM 호출이며 N+1 패턴이
없다. 이전 라운드가 CRITICAL 로 지적했던 "느린 S3 업로드 뒤 엔티티 전체 `save()`" 로 인한 lost update 는
`avatarUrl` 컬럼만 싣는 targeted `update()` 로 이미 수정돼 있다. 남은 것은 동시 업로드/PATCH 교차 시
"패자" S3 오브젝트가 고아로 남는 애플리케이션 레벨 TOCTOU 뿐인데, DB row 자체의 정합성은 훼손하지
않고(스토리지 비용 문제) 측정 가능한 재개 신호와 함께 별도 트래커에 이미 유예 등재돼 있어 INFO 로만
남긴다.

## 위험도

NONE
