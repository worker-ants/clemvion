# 데이터베이스(Database) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `updateAvatar` 의 "이전 URL 읽기 → (S3 업로드) → UPDATE" 사이에 DB 레벨 잠금/트랜잭션이 없다 — 다만 DB 정합성 훼손은 아니다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `UsersService.updateAvatar` (`const previousUrl = user.avatarUrl;` 이후 `await this.s3Service.upload(...)` → `await this.userRepository.update(userId, { avatarUrl })`)
  - 상세: `previousUrl` 은 S3 업로드(네트워크 I/O, 수백 ms~수 초)가 시작되기 전에 읽은 스냅샷이다. 이후 실제 반영은 `userRepository.update(userId, { avatarUrl })` — **단일 컬럼만 싣는 targeted UPDATE**라서, DB row 자체는 항상 마지막 커밋이 이기는 well-defined 상태로 남는다(다른 컬럼을 절대 덮어쓰지 않음 — 아래 "확인된 사항" 참조). 즉 고전적인 lost-update(여러 컬럼이 뒤섞여 되돌아가는 것) 는 발생하지 않는다. 다만 같은 사용자가 동시에 두 번 업로드하면 "패자" 쪽이 자신이 기억한 `previousUrl(=OLD)` 만 정리 대상으로 삼으므로, 패자가 새로 올린 S3 오브젝트는 어느 쪽 정리 로직도 참조하지 못해 고아로 남을 수 있다 — 이는 DB 정합성이 아니라 **스토리지 비용/용량** 문제이며, 같은 diff 의 concurrency 리뷰(`review/code/2026/08/31/22_44_14/concurrency.md`)가 WARNING 으로 이미 짚었고 `plan/in-progress/spec-sync-user-profile-gaps.md` 에 유예로 명시 등재돼 있다. DB 리뷰 관점에서는 새 결함이 아니라 위 사실을 재확인하는 수준이라 INFO 로 남긴다.
  - 제안: 조치 불요 — 이미 알려진 트레이드오프이고 별도 트래커에 등재돼 있다. 완전히 닫으려면 per-user advisory lock 또는 직렬화가 필요하지만 비용 대비 효과가 낮다는 판단이 이미 문서화돼 있다.

## 그 외 점검 결과 (문제 없음)

- **Lost update 수정 확인(트랜잭션/컬럼 범위)**: 이전 라운드(`review/code/2026/08/31/22_44_14/concurrency.md`)가 CRITICAL 로 지적했던 "S3 업로드 앞에서 읽은 엔티티 전체를 `save()`" 패턴은 **현재 diff 에서 이미 수정돼 있다** — `updateAvatar` 는 `userRepository.update(userId, { avatarUrl })` 로 `avatarUrl` 컬럼 하나만 UPDATE 문에 싣는다(`users.service.ts`). 같은 유저 row 를 동시에 건드리는 다른 partial-update 경로(로그인 실패 카운터·계정 잠금·2FA 등)의 값을 되돌릴 위험이 없다. 테스트(`users-avatar.service.spec.ts` — `save: jest.fn(() => { throw new Error('save() 를 쓰면 스냅샷 전체가 실린다') })`, `update` 호출 시 patch 에 `avatarUrl` 단 하나만 실렸는지 단언)가 이 회귀를 고정한다. `git diff origin/main...HEAD` 로 실측 확인 — `save(user)` 호출 없이 `update(userId, {avatarUrl})` 만 사용.
- **인덱스**: 모든 쿼리(`findOne`, `update`, `findOneOrFail`)가 PK `id` 로만 필터링된다 — `user` 테이블의 기본키 인덱스로 충분하고 별도 인덱스 필요 없음. 신규 조회 패턴이 없다.
- **N+1 쿼리**: 반복문 안에서 쿼리를 발생시키는 구조가 없다. `updateAvatar` 는 요청당 SELECT 1(findOne) + UPDATE 1 + SELECT 1(findOneOrFail, S3 delete 와 병렬) 로 고정. `update()` 는 페이로드에 `avatarUrl` 이 있을 때만 추가 SELECT 1회를 내고(`'avatarUrl' in data` 가드), 나머지 17개 호출부(로그인 시도 카운터·2FA 등 뜨거운 경로)는 이 추가 SELECT 를 타지 않도록 명시적으로 가드돼 있다 — 오히려 불필요한 조회를 줄인 설계다.
- **트랜잭션(원자성)**: 단일 UPDATE 문으로 컬럼을 좁혀(`update(userId, { avatarUrl })`) 여러 컬럼에 걸친 원자성 요구 자체를 제거했다 — 명시적 DB 트랜잭션(`queryRunner`/`@Transaction`)이나 `@VersionColumn` 낙관적 락이 없어도 정합성이 성립한다. "DB 저장 뒤에 옛 객체 정리" 순서는 `await update()` 완료 후에만 `Promise.all([findOneOrFail, deletePreviousAvatarObject])` 를 실행하도록 보장돼 있어(주석·코드 모두 확인), 저장 실패 시 이미 지워진 아바타를 가리키는 URL 이 남는 사고를 막는다.
- **마이그레이션 안전성**: `avatar_url` 컬럼(`nullable`, `length: 500`)은 이번 diff 이전부터 `User` 엔티티에 존재했다(`user.entity.ts:28`, `@Column({ name: 'avatar_url', nullable: true, length: 500 })`). 신규 마이그레이션 파일이 없고(`git diff --stat` 확인, `migrations/` 디렉터리 변경 없음) 스키마 변경 자체가 없으므로 lock/무중단 배포 위험이 없다.
- **스키마 설계**: 신규 테이블·컬럼·관계 변경 없음. 공개 URL 전체 문자열을 `avatar_url` 에 저장하는 기존 설계를 그대로 재사용한다 — `avatars/{userId}/{uuid}.{ext}` 키 기준으로 `base(가변) + bucket + key` 를 합쳐도 500자 한도 내에서 여유 있다(실측: 대표 URL 길이 ~90~150자 수준).
- **커넥션 관리**: `@InjectRepository(User)` 를 통한 표준 TypeORM 리포지토리 사용만 있고, 수동 커넥션 획득/해제나 별도 커넥션 풀 조작이 없다. 이번 변경이 커넥션 관리 방식에 손댄 곳은 없다.
- **SQL 인젝션**: 이번 diff 가 건드린 쿼리는 전부 TypeORM 리포지토리 API(`findOne`/`update`/`findOneOrFail`)로 파라미터가 자동 바인딩된다. 문자열 결합으로 조립한 raw SQL 이 없다. (참고: 같은 파일의 `emailTakenByOther` 가 `createQueryBuilder` + 바인딩 파라미터(`:email`, `:id`)를 쓰는데, 이는 이번 diff 의 변경 범위 밖 — 기존 코드 그대로이며 파라미터화도 이미 안전하다.)
- **대량 데이터**: 단건 사용자 row 에 대한 조회/갱신뿐이라 페이지네이션·대용량 스캔과 무관하다.

## 요약

DB 관점에서 이번 diff 는 건실하다 — 신규 스키마/마이그레이션이 없고(`avatar_url` 컬럼은 기존 것을 재사용), 모든 쿼리가 PK 기반 파라미터화된 TypeORM 호출이며 N+1 패턴이 없다. 특히 이전 리뷰 라운드(`22_44_14/concurrency.md`)가 CRITICAL 로 지적했던 "느린 S3 업로드 뒤 엔티티 전체 `save()`" 로 인한 lost update 는, 현재 diff 에서 `avatarUrl` 컬럼만 싣는 targeted `update()` 로 이미 수정돼 있고 이를 고정하는 테스트(`save()` 호출 시 throw)까지 갖춰져 있음을 소스·diff·테스트 3중으로 실측 확인했다. 남은 것은 동시 업로드 시 "패자" S3 오브젝트가 고아로 남는 애플리케이션 레벨 TOCTOU 뿐인데, 이는 DB row 자체의 정합성을 훼손하지 않고(스토리지 비용 문제) 이미 별도로 문서화·유예 등재돼 있어 DB 리뷰 기준으로는 INFO 로만 남긴다.

## 위험도

NONE
