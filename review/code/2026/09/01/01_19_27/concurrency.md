# 동시성(Concurrency) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `updateAvatar`/`update()` 자기 자신끼리의 `avatarUrl` 경합 — 동시 업로드(더블클릭·다중 탭) 시 "패자"의 S3 객체가 영구 고아로 남을 수 있다 (기존 발견, 코드 재확인 — 여전히 존재, 의도적으로 유예됨)
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar`(약 79~150행, 특히 `const previousUrl = user.avatarUrl;` → `await this.s3Service.upload(...)` → `await this.userRepository.update(userId, { avatarUrl })`), `deletePreviousAvatarObject`(약 169~196행), `update()`(약 234~248행)
  - 상세: `previousUrl` 을 요청 시작 시점(S3 업로드 전)에 스냅샷으로 캡처한 뒤, 그 스냅샷만 근거로 정리 대상을 판단한다. 같은 사용자가 두 요청(A, B)을 겹쳐 보내면 둘 다 같은 `previousUrl`(OLD)을 읽고, 나중에 커밋되는 쪽이 DB `avatarUrl` 을 최종적으로 갖지만 — 먼저 커밋된 쪽이 올린 객체(예: `key_A`)를 "previous" 로 다시 관측할 기회가 어디에도 없어 추적 불가능한 영구 고아로 남는다. `avatars/{userId}/` 접두 밖으로는 삭제가 절대 나가지 않으므로(남의 키를 지울 위험은 없음) 데이터 정합성·보안 훼손은 없고, 순수 스토리지 누수다.
  - 검증: 실제 코드를 직접 읽어 확인 — 여전히 이 스냅샷 방식이며, per-user 직렬화(advisory lock)나 조건부 UPDATE(`WHERE avatar_url = :expected`)는 없다. `plan/in-progress/spec-sync-user-profile-gaps.md` §"동시 업로드 TOCTOU"(약 83~121행)에 재개 신호(`avatars/` 접두 객체 수가 사용자 수를 유의미하게 웃돌 때)와 함께 명시적으로 유예 등재돼 있고, 그 유예 노트의 전제("스냅샷 전체 `save()` 가 `User` 에 없다")도 표로 실측해 두었다 — 유예 처리 자체는 이 저장소의 "유예 근거는 실측 가능해야 한다" 관례를 충족한다.
  - 제안: 현재 유예 상태를 유지하는 것은 근거가 있다(심각도 낮음, 재개 신호 측정 가능). 추가 조치가 필요하면 `avatarUrl` 컬럼에 조건부 UPDATE 또는 `pg_advisory_xact_lock(hashtext(userId))` 로 이 메서드를 직렬화. 새 조치를 요구하지는 않음 — 상태 확인 목적의 재기재.

- **[INFO]** `AuthOAuthService.resolveUser()`(diff 밖, 기존 코드)가 raw `QueryBuilder` 로 `avatarUrl` 을 직접 써 이 PR 이 신설한 "avatarUrl 변경 → S3 정리" 불변식을 우회한다 — 오늘은 값 우선순위 때문에 비활성(dormant), side_effect/architecture 리뷰에서 이미 광범위하게 다뤄짐
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` `resolveUser()` 약 390~401행 (`createQueryBuilder().update(User).set({ ..., avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined }).where('id = :id AND oauth_provider IS NULL', ...)`)
  - 상세: 이 경로는 `byEmail.avatarUrl`(기존 값)을 OAuth 프로필 사진보다 우선하므로, 오늘 시점에는 실제 값 변경이 일어나지 않아 `updateAvatar`/`update()` 와 인터리빙되어도 avatarUrl 이 뒤집히지 않는다(비활성 경합). 다만 이 우선순위가 뒤집히거나(OAuth 프로필 사진을 최신으로 반영하는 요구 등) 유사 패턴이 늘면, `updateAvatar` 가 S3 삭제까지 마친 직후 이 QueryBuilder 가 스냅샷 값(`byEmail.avatarUrl` = OLD)으로 커밋될 경우 DB 가 **이미 삭제된 S3 객체를 가리키는 URL** 로 되돌아가는 경로가 원리적으로 열려 있다 — 이는 위에서 이미 수정된 `incrementLoginAttempts` 의 CRITICAL 과 정확히 같은 클래스(전체/직접 컬럼 쓰기가 새 정리 불변식을 우회)이지만, `avatarUrl` 자체를 대상으로 한다는 점이 다르다.
  - 검증: `users-avatar.service.spec.ts` 에 이 우회를 감지하는 소스-레벨 캐너리 테스트(`describe('OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리')`)가 실제로 존재함을 파일을 열어 확인했고, `plan/in-progress/spec-sync-user-profile-gaps.md` W8/W9 로 추적 중임을 확인했다. `auth-oauth.service.ts` 는 이번 diff 대상 파일이 아니다.
  - 제안: 새 조치 불필요 — 이미 캐너리+plan 트래킹으로 disclose 돼 있고, 오늘은 트리거 불가능하다. concurrency 관점에서는 "avatarUrl 컬럼의 writer 가 `users.service.ts` 2곳 + `auth-oauth.service.ts` 1곳, 총 3곳"이라는 사실만 기록해 둔다 — 다음에 이 컬럼에 새 writer 를 추가하는 사람이 이 목록을 봐야 한다.

- **[정보/검증됨]** `incrementLoginAttempts` — 이전 라운드(00_55_27)의 CRITICAL(전체 엔티티 `save()` 가 `updateAvatar` 의 S3 정리를 반대 방향으로 되돌림)이 원자적 `UPDATE ... RETURNING` 으로 수정되어 있음을 코드로 직접 확인
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `incrementLoginAttempts`(약 346~373행)
  - 상세: `updateReturningRows` 로 감싼 raw `UPDATE "user" SET login_attempts = login_attempts + 1, locked_until = CASE ... END WHERE id = $1 RETURNING login_attempts` 단일 원자 문으로 바뀌어 있다 — `findOneOrFail` → 필드 수정 → `save(user)` 패턴이 사라졌으므로, `updateAvatar` 가 커밋+구 객체 삭제를 마친 직후 이 메서드가 낡은 스냅샷을 되쓸 경로가 더 이상 없다. 잠금 판정도 DB `NOW()` 기준이라 다중 인스턴스 시계 불일치 문제도 없다.
  - 검증: `codebase/backend/src/modules/users/users.service.ts:346-373` 를 직접 읽어 확인(재현 시도 불필요 — 코드 형태 자체가 read-modify-write 패턴을 갖지 않음). `git status --short` 로 리포지토리에 어떤 뮤테이션도 남기지 않았음을 확인.
  - 결론: 새 발견 아님 — 이전 CRITICAL 이 해소되었음을 확인하는 기록.

- **[정보/검증됨]** `S3Service` 신규 상태(`publicBaseUrl`)와 `getPublicUrl()` — 생성자 1회 계산 불변값·순수 함수라 요청 간 공유 상태 경쟁 없음
  - 위치: `codebase/backend/src/common/services/s3.service.ts:16, 32-41, 69-95`
  - 상세: `publicBaseUrl` 은 `readonly` 이고 생성자에서만 대입된다(Nest 싱글톤이라 부팅 시 1회). `getPublicUrl(key)` 는 인자만으로 결과가 정해지는 순수 함수이며 인스턴스 필드를 변형하지 않는다. `resolvePublicBaseUrl`/`shouldWarnPublicBaseIsPrivate`(`s3.config.ts`)도 순수 함수이고 `main.ts` 부팅 시 1회 평가된다. 동시 요청이 이 값들을 읽어도 경쟁이 성립하지 않는다.

- **[정보/검증됨]** `updateAvatar` 안의 `Promise.all([findOneOrFail, deletePreviousAvatarObject])` 은 서로 결과를 소비하지 않는 독립 연산이라 병렬 대기가 안전함
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`updateAvatar` 말미, `const [updated] = await Promise.all([...])`)
  - 상세: 두 프라미스 모두 앞선 `userRepository.update(userId, { avatarUrl })` 커밋 이후에만 시작하므로 "DB 저장 뒤 정리" 불변식은 유지된다. `deletePreviousAvatarObject` 는 내부에서 실패를 전부 삼키고(`try/catch` + `logger.warn`) reject 하지 않으므로, `Promise.all` 이 삭제 실패로 인해 예기치 않게 거부되어 응답 자체가 실패하는 경우도 없다.

## 그 외 점검 결과 (문제 없음)

- **데드락**: 신규 코드는 락(mutex/advisory lock)을 전혀 도입하지 않는다 — lock-free 설계이므로 데드락 가능성 자체가 없다.
- **async/await**: `updateAvatar`/`update()`/`deletePreviousAvatarObject`/`incrementLoginAttempts` 전부 비동기 I/O(S3, DB)를 정확히 `await` 한다. 누락된 await 는 발견되지 않았다.
- **이벤트 루프 블로킹**: 신규 코드에 동기 CPU-bound 연산(정규식 백트래킹, 대용량 동기 파싱 등)이 없다 — 문자열 분해·인코딩은 짧은 입력(경로 세그먼트 최대 3개)에 대한 선형 연산이다.
- **리소스 풀링**: `S3Service` 가 모듈별 지역 provider 로 등록되어 `S3Client` 커넥션 풀이 KB 모듈과 별개로 생성되지만, 부팅 시 1회뿐이고 요청 경로에 영향 없음(이미 performance 리뷰가 다룬 사안, concurrency 관점에서는 무해).

## 요약

이전 라운드가 발견한 CRITICAL — `incrementLoginAttempts` 의 전체 엔티티 `save()` 가 `updateAvatar` 의 S3 정리를 반대 방향으로 되돌려 "이미 삭제된 객체를 가리키는 URL" 상태를 재현하던 결함 — 은 원자적 `UPDATE ... RETURNING` 전환으로 실제 소스에서 해소되어 있음을 직접 확인했다. 남아 있는 리스크는 두 가지이며 둘 다 새 발견이 아니다: (1) `avatarUrl` 자기 자신의 동시 교체 경합(더블클릭 등)으로 인한 고아 S3 객체 — 데이터 정합성 훼손 없이 스토리지 누수에 그치고, 측정 가능한 재개 신호와 함께 명시적으로 유예돼 있어 WARNING 으로 재기재한다. (2) `auth-oauth.service.ts` 의 계정 연동 경로가 raw QueryBuilder 로 `avatarUrl` 을 직접 써 새 정리 불변식을 우회하는데, 오늘은 값 우선순위 때문에 비활성이고 소스 캐너리 테스트+plan 트래커로 이미 광범위하게 disclose 돼 있어 INFO 로 남긴다. `S3Service` 의 신규 상태는 불변·순수 함수라 경쟁이 없고, `Promise.all` 병렬 대기·async/await 사용도 정확하다. 락을 쓰지 않는 설계라 데드락 리스크는 없다. 검증 과정에서 리포지토리에 어떤 파일도 쓰거나 고치지 않았다(`git status --short` 클린 확인).

## 위험도

LOW
