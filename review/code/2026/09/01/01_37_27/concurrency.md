# 동시성(Concurrency) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** 아바타 교체 경로의 TOCTOU — 동시 업로드/PATCH 시 "패자"가 올린 S3 오브젝트가 영구 고아로 남을 수 있다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:129-154` (`updateAvatar` — `previousUrl` 캡처 후 `s3Service.upload` → `userRepository.update`), `codebase/backend/src/modules/users/users.service.ts:241-253` (`update` — 동일 패턴)
  - 상세: `updateAvatar`·`update` 모두 "정리 대상 키"(`previousUrl`)를 **비원자적 사전 SELECT**(`findOne`)로 캡처한 뒤, 별도 비동기 작업(S3 업로드 또는 partial `update`)을 거쳐 그 값을 지운다. 같은 사용자가 아바타를 연속으로 두 번 업로드(더블클릭·다중 탭)하거나 업로드와 `PATCH /users/me`(외부 `avatarUrl`)가 겹치면: 두 요청이 같은 `previousUrl=OLD` 를 각각 읽고, 나중에 커밋한 쪽이 DB 를 최종 값으로 확정한다. 두 요청 모두 자신이 기억한 `OLD` 만 지우므로, "패자"가 새로 올린 오브젝트는 그 어떤 정리 로직의 대상도 되지 못해 **영구 고아**로 남는다(기능·정합성은 깨지지 않고 과금/용량으로만 드러남). `users-avatar.service.spec.ts` 는 이 순차 흐름만 고정하며 동시 요청 케이스에 대한 유닛/e2e 커버리지는 없다.
  - 이것은 새로 발견한 결함이 아니라 **이 PR 자신이 CHANGELOG·`plan/in-progress/spec-sync-user-profile-gaps.md` §"동시 업로드 TOCTOU — 고아 객체"에 이미 명시적으로 disclose 하고 유예로 등재한 항목**이다(재개 신호: `avatars/` 접두 객체 수가 사용자 수를 유의미하게 웃돌 때). 다만 코드상 실제로 열려 있는 경쟁이 맞고, 완화(per-user advisory lock 또는 orphan-sweep 배치)가 없는 것도 사실이므로 concurrency 관점에서 WARNING 으로 기록해 둔다.
  - 제안: 새로운 조치가 필요하지는 않다 — 이미 근거가 실측(반증 1회 포함)되고 재개 신호가 프록시가 아닌 직접 측정 가능한 양으로 정의된 상태의 정당한 유예다. 유예 상태가 계속 유지되는지, `avatars/` 접두 객체 수 모니터링이 실제로 설정되는지만 추적하면 된다.

## 확인된 이전 라운드 CRITICAL — 현재 상태는 해결됨 (참고용, 새 발견 아님)

이 diff 에는 과거 리뷰 세션 산출물(`review/code/2026/08/31/22_44_14/concurrency.md`)이 그대로 파일로 포함돼 있는데, 거기서 CRITICAL 로 지적한 "`updateAvatar` 가 S3 업로드 뒤 유저 엔티티 전체를 `save()` 해 다른 요청(로그인 실패 카운터·계정 잠금 등)의 변경을 되돌린다(lost update)" 는 **현재 소스에서는 더 이상 성립하지 않는다.** 확인 사항:

- `updateAvatar`(`users.service.ts:144`)는 `userRepository.save(user)` 가 아니라 `userRepository.update(userId, { avatarUrl })` 로 **`avatarUrl` 한 컬럼만** UPDATE 페이로드에 싣는다. `users-avatar.service.spec.ts:360-412`(`'update 는 avatarUrl 단 하나만 싣는다'`)가 `Object.keys(patch)` 를 `['avatarUrl']` 로 정확히 고정하고 `repo.save` 미호출을 단언한다.
- 반대 방향(회귀 지목: "리뷰 7라운드") — `incrementLoginAttempts` 가 `findOneOrFail` → `save(user)` 였다면, 아바타 업로드가 `avatarUrl` 갱신 + 옛 S3 객체 삭제까지 마친 뒤 이 저장이 늦게 커밋되면 **이미 삭제된 객체를 가리키는 옛 URL 로 되돌아가는** 더 나쁜 상태가 될 수 있었다. 현재 `incrementLoginAttempts`(`users.service.ts:346-373`)는 단일 raw SQL `UPDATE … RETURNING` (`updateReturningRows`)로 원자적이며, `resetLoginAttempts` 도 컬럼 단위 `update()` 다. `users-login-attempts.service.spec.ts` 가 `save` 미호출과 RETURNING 값 사용을 테스트로 고정한다.
- `plan/in-progress/spec-sync-user-profile-gaps.md` 는 `User` 엔티티를 스냅샷 전체로 `save()` 하는 남은 지점이 없음을 표로 재확인해 두었다(`create()` 는 신규 엔티티라 스냅샷 아님, 나머지는 QueryBuilder/컬럼 단위 update/읽기전용).

즉 "경쟁 조건 없앰" 이라는 이 PR 의 주장은 **다른 컬럼 경쟁**에 한해 실제로 검증 가능한 상태로 확인된다. `avatarUrl` 자체를 둘러싼 경쟁(위 WARNING)은 의도적으로 남겨 두고 있다는 CHANGELOG 의 서술과도 일치한다.

## 그 외 점검 결과 (문제 없음)

- **스레드 세이프성**: `S3Service` 의 `client`·`bucket`·`publicBaseUrl` 은 전부 생성자에서 1회만 대입되는 `readonly` 필드이며 이후 어디서도 재대입되지 않는다. Nest 싱글톤 스코프에서 여러 요청이 동시에 같은 인스턴스를 공유해도 인스턴스 상태 변경이 없어 안전하다.
- **async/await 누락**: `updateAvatar`·`update`·`deletePreviousAvatarObject`·`incrementLoginAttempts`·컨트롤러 `uploadAvatar` 전 경로에서 비동기 호출은 모두 `await` 되어 있다. Fire-and-forget 이나 미대기 Promise 는 없다.
- **`Promise.all` 사용**: `updateAvatar`(`users.service.ts:150-154`)의 `Promise.all([findOneOrFail(...), deletePreviousAvatarObject(...)])` 는 서로 결과를 소비하지 않는 독립 작업을 병렬화한 정상적인 사용이다. `deletePreviousAvatarObject` 는 내부에서 모든 오류를 `catch` 해 `warn` 으로 삼키므로(`users.service.ts:191-202`) `findOneOrFail` 이 실패해 `Promise.all` 이 reject 되더라도 정리 작업 자체는 계속 완료되고 unhandled rejection 이 발생하지 않는다.
- **원자성(단일 컬럼 경쟁 한정)**: `avatarUrl` 하나만 건드리는 이번 변경 범위 내에서는 `userRepository.update(id, {avatarUrl})` 가 TypeORM 이 생성하는 단일 SQL `UPDATE ... SET avatar_url = ...` 문이라 원자적이다.
- **이벤트 루프 블로킹**: 신규 코드 경로에 동기 CPU-bound 연산(대용량 루프, 동기 파일 I/O, 동기 정규식 백트래킹 등)이 없다. 파일 버퍼는 그대로 `S3Client.send` 로 전달될 뿐 프로세스 내 추가 변환이 없다.
- **리소스 풀링**: `S3Client` 는 요청마다가 아니라 서비스 생성자(앱 부팅)에서 1회만 만들어진다. `UsersModule` 이 `S3Service` 를 로컬 provider 로 등록해 `KnowledgeBaseModule` 과 별개의 `S3Client`(및 내부 keep-alive 커넥션 풀)를 하나 더 만들지만, 부팅 시 1회 생성이라 요청 경로 성능/동시성 문제는 아니다(이미 performance 리뷰에서 INFO 로 지적됨 — concurrency 관점에서 추가로 문제 삼을 것은 없다).
- **데드락**: 이 diff 는 명시적 락(mutex/semaphore/advisory lock/트랜잭션)을 전혀 도입하지 않는다 — 락이 없으므로 락 순서 역전에 의한 데드락 가능성도 없다(그 대신 위 WARNING 의 경쟁이 남는다).

## 요약

이전 라운드(`review/code/2026/08/31/22_44_14/concurrency.md`)가 CRITICAL 로 지적했던 "S3 업로드 후 유저 엔티티 전체를 `save()` 해 다른 컬럼(로그인 잠금 등)의 동시 변경을 되돌리는" lost-update 경쟁은, 이번 최종 코드에서 `updateAvatar`·`incrementLoginAttempts` 양쪽 모두를 컬럼 단위 원자 UPDATE 로 바꾸고 각각을 전용 테스트(`repo.save` 미호출 단언, `Object.keys(patch)` 정확 비교)로 고정해 실제로 해소된 상태다. 남아 있는 유일한 동시성 경쟁은 `avatarUrl` 자체를 둘러싼 TOCTOU — 동시 업로드/PATCH 시 "패자"가 올린 S3 오브젝트가 영구 고아로 남는 것 — 인데, 이는 이 PR 이 스스로 인지하고 CHANGELOG·plan 문서에 근거(1회 반증 포함)와 함께 명시적으로 유예한 항목이라 심각도가 낮다(데이터 정합성 훼손 없음, 저장 공간 낭비에 그침). 그 외 스레드 세이프성·async/await·Promise 체인·리소스 풀링·데드락 관점에서 새로 도입된 문제는 없다.

## 위험도

LOW
