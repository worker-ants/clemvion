# 동시성(Concurrency) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[CRITICAL]** `incrementLoginAttempts` 의 전체-엔티티 `save()` 가, `updateAvatar` 가
  방금 커밋한 `avatarUrl` 을 **낡은 스냅샷 값으로 되돌릴 수 있다** — 이 PR 이 "없앴다"고
  주장하는 lost-update 클래스가 **반대 방향**으로는 여전히 열려 있다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:317-325`
    (`incrementLoginAttempts`, 특히 323행 `await this.userRepository.save(user);`) —
    이 메서드 자체는 이번 diff 에 포함되지 않은 기존 코드이지만, 이번 PR 이 새로 만든
    `updateAvatar`(`users.service.ts:79-149`)와 같은 `User` row 를 두고 경합한다.
  - 상세: CHANGELOG(`CHANGELOG.md` "**`avatarUrl` 컬럼 하나만 UPDATE 한다**" 항목)와
    `users.service.ts:126-135` 의 주석은 "S3 업로드가 도는 수백 ms~수 초 사이 다른 요청이
    바꾼 컬럼(**로그인 실패 카운터**·계정 잠금·2FA 등록)이 스냅샷의 옛 값으로 조용히
    되돌아간다"는 lost-update 를, `updateAvatar` 가 `save(entity)` 대신 컬럼 단위
    `userRepository.update(userId, { avatarUrl })` 를 쓰도록 바꿔서 없앴다고 명시적으로
    주장한다. 이 수정은 **"아바타 저장이 로그인 실패 카운터를 되돌리는" 방향만** 막는다.
    **"로그인 실패 카운터 저장이 아바타를 되돌리는" 반대 방향은 그대로 남아 있다** —
    `incrementLoginAttempts` 는 여전히 `findOneOrFail` 로 전체 엔티티를 읽고
    (`users.service.ts:318`), `loginAttempts`/`lockedUntil` 만 바꾼 뒤
    `userRepository.save(user)` 로 **엔티티 전체를 다시 쓴다**(`users.service.ts:323`).
    `User` 엔티티에는 `@VersionColumn` 이나 낙관적 잠금이 없고(`entities/user.entity.ts`
    확인, PK/타임스탬프 컬럼만 존재), TypeORM 의 `Repository.save()` 는 인자로 받은
    엔티티 객체에 present 한 모든 매핑 컬럼을 그대로 UPDATE 문에 싣는다(부분 diff 가
    아니다) — `updateAvatar` 의 코드 주석 자체가 정확히 이 동작을 근거로 "컬럼을
    지정해 쓰면 이 경쟁이 성립하지 않는다"고 설명하고 있어, 반대 방향에서 같은 메커니즘이
    적용됨은 이 PR 저자의 진단과 일관된다.

    **경쟁 시나리오**: (1) 사용자가 `POST /api/users/me/avatar` 로 아바타를 업로드
    시작 — S3 업로드(네트워크 I/O, 수백 ms~수 초)가 도는 동안 아직 DB 는 옛 `avatarUrl`.
    (2) 그 사이 **같은 계정으로 다른 곳에서(무차별 대입 시도·다른 기기의 오타 등)
    로그인 실패**가 발생해 `AuthService`(`modules/auth/auth.service.ts:340`)가
    `incrementLoginAttempts(user.id)` 를 호출 — 이때 `findOneOrFail` 이 **아직 옛
    avatarUrl 이 담긴 스냅샷**을 읽는다. (3) `updateAvatar` 의
    `userRepository.update(userId, { avatarUrl: 새값 })` 이 먼저 커밋되고, **곧이어**
    `updateAvatar` 의 `Promise.all` 안 `deletePreviousAvatarObject` 가 **옛 S3 객체를
    실제로 지운다**(`users.service.ts:143-147`). (4) 이어서 `incrementLoginAttempts` 의
    `save(user)` 가 커밋되면 — 옛 스냅샷을 통째로 다시 쓰므로 — DB 의 `avatarUrl` 이
    **방금 지워진 옛 URL 로 되돌아간다**. 결과: 업로드는 200 으로 성공했지만, DB 는
    이미 삭제된 S3 오브젝트를 가리키는 상태가 된다 — `deletePreviousAvatarObject` 의
    JSDoc 이 "순서를 뒤집으면 사용자에게 **이미 지워진 아바타를 가리키는 URL** 이
    남는다 — 고아 객체보다 나쁘다"(`users.service.ts:140-142`)고 스스로 경계하는
    바로 그 상태가, 순서를 지켰음에도 이 반대 방향 경쟁으로 재현된다. 부수로
    `loginAttempts`/`lockedUntil` 도 `incrementLoginAttempts` 자신의 최신 값이 아니라
    다른 동시 write 가 있었다면 그 스냅샷의 옛 값으로 갈릴 수 있어(같은 메커니즘), 계정
    잠금 카운터의 정확성에도 영향을 줄 수 있다.
  - 제안: `incrementLoginAttempts` 도 컬럼 단위 갱신으로 바꾼다 — 예:
    `SELECT` 로 현재 `loginAttempts` 를 얻어 `+1` 계산한 값과 (필요시) `lockedUntil` 만
    `userRepository.update(id, { loginAttempts, lockedUntil })` 로 쓰거나, DB 레벨
    원자 증가(`increment()` 또는 raw `UPDATE ... SET login_attempts = login_attempts + 1`)
    를 쓴다. `save(entity)` 패턴을 `User` 에 대해 유지하는 한, 이번 PR 이 명시한
    "락 없이 컬럼을 줄여 lost update 를 없앴다"는 주장은 **편도로만 참**이므로, 관련
    plan 문서(`plan/in-progress/spec-sync-user-profile-gaps.md` §"동시 업로드 TOCTOU")
    의 "데이터 정합성은 깨지지 않는다"는 유예 근거에도 이 경로는 반영돼 있지 않다 —
    같이 갱신이 필요하다.

- **[INFO]** (검증 결과, 결함 아님) `updateAvatar`↔`updateAvatar`, `updateAvatar`↔`update()`
  의 avatarUrl 자체 경쟁은 이미 정확히 진단되고 의도적으로 유예돼 있다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:79-149`(`updateAvatar`),
    `:169-196`(`deletePreviousAvatarObject`), `:234-248`(`update`) /
    `plan/in-progress/spec-sync-user-profile-gaps.md:83-98`
  - 상세: 두 동시 업로드(또는 업로드와 `PATCH /users/me` 의 avatarUrl 변경)가 겹치면,
    양쪽이 같은 `previousUrl` 스냅샷을 공유해 "패자"가 올린 S3 객체가 어느 쪽 정리
    로직의 대상도 되지 못하고 영구 고아로 남을 수 있음을 직접 인터리빙을 추적해
    확인했다. 다만 이 경로에서는 **DB 의 최종 `avatarUrl` 이 실제로 존재하는 유효한
    객체를 계속 가리킨다** — 위 CRITICAL 항목과 달리 "이미 지워진 객체를 가리키는"
    상태로는 귀결되지 않는다. `avatars/` 접두 하에서만 삭제가 시도되고(`남의 아바타
    키는 지우지 않는다` — `users-avatar.service.spec.ts:201-207` 로 고정), 버킷 세그먼트
    불일치도 같은 userId 접두 아래로만 삭제 범위가 제한돼 있어(주석 `users.service.ts
    :159-164`) 임의 객체 삭제로 번지지 않는다. per-user advisory lock 없이 컬럼 폭을
    줄이는 것만으로는 avatarUrl 자체의 "누가 이겼나" 경쟁까지는 못 막는다는 진단은
    정확하고, 재개 신호(고아 객체 수)도 측정 가능한 형태로 적혀 있다 — 새로 지적할
    것은 없다. (단, 위 CRITICAL 항목이 이 유예 노트의 "정합성은 깨지지 않는다"는
    문장의 반례이므로, 그 문서도 함께 갱신할 필요가 있다.)

- **[INFO]** `updateAvatar` 안의 `Promise.all([findOneOrFail, deletePreviousAvatarObject])`
  은 두 작업이 서로의 결과를 쓰지 않는 독립 연산이라 병렬 대기가 올바르다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:143-147`
  - 상세: `deletePreviousAvatarObject` 가 실패해도(`catch` 내부에서 처리, `promise
    rejection` 을 밖으로 던지지 않음 — `:184-195`) `Promise.all` 전체가 reject 되지
    않는다. 재조회(`findOneOrFail`)와 삭제 사이에 원자성이 필요하지도 않다(둘 다 이미
    커밋된 `update()` 이후에만 시작하므로 "DB 저장 뒤 정리" 불변식은 유지된다,
    `users-avatar.service.spec.ts:225-238` 로 고정). 문제 없음.

- **[INFO]** `S3Service` 의 신규 상태(`publicBaseUrl`)와 `getPublicUrl`은 인스턴스 생성
  시점에 1회 계산되는 불변값·순수 함수라 요청 간 공유 상태 경쟁이 없다
  - 위치: `codebase/backend/src/common/services/s3.service.ts:16,40-41,86-95`
  - 상세: `publicBaseUrl` 은 생성자에서만 대입되는 `readonly` 필드이고, `getPublicUrl`
    은 인자만으로 결과가 정해지는 순수 함수라 동시 요청 간 가변 공유 상태가 없다.
    `S3Client` 자체는 AWS SDK v3 설계상 다중 동시 요청 재사용을 전제하므로 문제 없음.

## 요약

이번 변경의 핵심 동시성 설계(“`save()` 대신 컬럼 단위 `update()`로 아바타 갱신이 다른
컬럼을 되돌리는 lost update 를 없앤다”)는 **`updateAvatar` → 다른 컬럼** 방향으로는
정확하고 테스트로도 뒷받침된다. 그러나 같은 파일 안의 기존 메서드 `incrementLoginAttempts`
가 여전히 전체 엔티티 스냅샷을 `save()` 로 되쓰기 때문에, **다른 컬럼(로그인 실패
카운터) → `avatarUrl`** 방향의 같은 클래스 lost update 가 그대로 열려 있다. 이 반대
방향 경쟁은 단순한 "덮어쓰기"가 아니라, `updateAvatar` 가 이미 성공적으로 삭제한 S3
객체를 DB 가 다시 가리키게 만들 수 있어 — 이 PR 자신의 문서가 "고아 객체보다 나쁘다"고
명시한 바로 그 상태를 재현한다. 아바타 자체의 동시 업로드 경쟁(고아 객체)은 이미
정확히 진단되고 측정 가능한 재개 신호와 함께 의도적으로 유예돼 있어 추가 지적 사항이
없다. `Promise.all` 사용과 `S3Service` 의 신규 상태는 모두 안전하다.

## 위험도

CRITICAL
