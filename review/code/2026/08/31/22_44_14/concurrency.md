# 동시성(Concurrency) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[CRITICAL]** `UsersService.updateAvatar` — 장시간 I/O(S3 업로드) 뒤 전체 엔티티 `save()` 로
  같은 유저 row 에 대한 동시 쓰기를 조용히 덮어쓸 수 있다 (lost update).
  - 위치: `codebase/backend/src/modules/users/users.service.ts:93-105` (`updateAvatar` 본문 — `findOne` → `await this.s3Service.upload(...)` → `user.avatarUrl = ...` → `await this.userRepository.save(user)`)
  - 상세: `updateAvatar` 는 `userRepository.findOne()` 으로 `user` 엔티티 전체(비밀번호 해시·2FA 시크릿·로그인 시도 횟수·잠금 시각·OAuth 연동 정보 등 전 컬럼)를 로드한 뒤, **네트워크 I/O 인 `s3Service.upload()` 를 `await` 한 다음** 그 메모리 스냅샷에 `avatarUrl` 만 바꿔 `userRepository.save(user)` 를 호출한다. TypeORM 의 `save(entity)` 는 partial diff 가 아니라 **엔티티가 들고 있는 모든 컬럼 값으로 UPDATE 를 낸다** (`repository.update(id, data)` 와 다름). 즉 `findOne` 시점 이후 `save` 시점 사이에 같은 유저 row 를 바꾸는 다른 요청이 있으면, 그 변경은 `updateAvatar` 의 뒤늦은 `save()` 가 **조용히 되돌린다**.
    같은 파일 안에 이미 이 패턴(로드→뮤테이트→`save(user)` 전체 저장)의 위험을 보여주는 기존 예가 있다 — `incrementLoginAttempts()`(`users.service.ts:268-276`, 본 diff 밖) 는 `findOneOrFail` → `loginAttempts += 1` / `lockedUntil` 설정 → `save(user)` 로 로그인 실패 횟수·계정 잠금을 저장한다. 두 흐름이 같은 유저에 대해 겹치면: (1) 로그인 실패로 `incrementLoginAttempts` 가 `loginAttempts`/`lockedUntil` 을 DB 에 커밋 → (2) 그보다 **먼저 시작했지만 S3 업로드로 지연된** `updateAvatar` 가 잠금 이전 상태의 스냅샷을 `save()` → 계정 잠금이 조용히 해제된다. `s3Service.upload()` 는 외부 서비스 호출이라 지속 시간이 가변적(느린 네트워크·큰 파일일수록 창이 넓어짐)이고, 다른 auth 경로들(`totp.service.ts`, `webauthn.service.ts`, `auth.service.ts` 다수 호출부)도 같은 유저 row 에 `usersService.update()`(partial) 를 쏜다 — 이쪽은 partial 이라 안전하지만, `updateAvatar` 만 partial 이 아니라 전체 `save()` 라 **비대칭**이다.
    트랜잭션도, `@VersionColumn` 기반 낙관적 락도, per-user 직렬화(락/큐)도 없다 (`user.entity.ts` 확인: 버전 컬럼 없음).
  - 제안: `updateAvatar` 의 DB 반영을 `userRepository.update(userId, { avatarUrl })` 같은 **targeted partial update** 로 바꾸어 다른 컬럼을 절대 건드리지 않게 한다 (다른 auth 경로들과 동일 패턴). 필요하면 `previousUrl` 도 별도 `SELECT avatar_url` 한 컬럼만 읽어 최소화한다. 근본적으로는 "로드 → 느린 I/O → 전체 `save()`" 패턴 자체(기존 `incrementLoginAttempts` 포함)를 partial update 로 정리하는 편이 안전하다.

- **[WARNING]** 아바타 교체 경로의 TOCTOU — 동시 업로드/PATCH 시 "패자" 의 새 S3 오브젝트가 영구 고아로 남을 수 있다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:93-107` (`updateAvatar`), `users.service.ts:185-199` (`update`)
  - 상세: `updateAvatar` 와 `update` 모두 "정리 대상 키" 를 **비원자적인 사전 SELECT** (`user.avatarUrl` / `findOne(...).avatarUrl`) 로 캡처한 뒤, 별도의 비동기 작업(S3 업로드 또는 partial `update`)을 거쳐 그 캡처값과 "지금" 값을 비교해 지운다. 같은 유저가 아바타를 두 번 연속 업로드(더블클릭·다중 탭)하거나 `PATCH /users/me` 로 `avatarUrl` 을 연속으로 바꾸면:
    1. 요청 A, B 모두 `previousUrl = OLD` 를 읽는다(둘 다 아직 커밋 전).
    2. A 는 `key_A` 를, B 는 `key_B` 를 업로드/설정하고 각각 저장한다 — 최종 DB 값은 나중에 커밋한 쪽(A 또는 B, 요청 도착 순서와 무관하게 커밋 순서로 결정)이 이긴다.
    3. A, B 모두 자신이 기억한 `previousUrl = OLD` 만 지운다. **"패자" 가 올린 오브젝트(예: `key_A`, DB 에 더 이상 참조되지 않음)는 그 어떤 정리 로직도 대상으로 잡지 못해 영구 고아로 남는다.**
    이 결함은 이 PR 이 스스로 "축 3 — 교체 시 옛 객체 정리" 로 명시한 위험("고아 객체는 과금·용량으로만 드러나고 기능은 정상")과 정확히 같은 클래스이지만, **테스트(`users-avatar.service.spec.ts`)는 전부 단일 요청의 순차 흐름만 고정**하고 있어 동시 요청 케이스는 커버되지 않는다.
  - 제안: 심각도는 낮다(데이터 정합성 훼손 없음, 표시되는 아바타는 최종적으로 well-defined). 완전한 해결은 per-user 직렬화(advisory lock 또는 짧은 mutex)가 필요하지만 비용 대비 효과가 낮다면, 최소한 이 갭을 알고 있다는 사실을 코드 주석/spec 에 남기거나, 주기적 orphan-sweep(예: `avatars/{userId}/` 아래에서 현재 `avatarUrl` 이 아닌 오브젝트 정리) 백로그로 남기는 것을 권장.

## 요약

이 변경은 CPU-bound 경쟁이나 스레드 세이프성 이슈는 없다(Node.js 단일 이벤트 루프, `S3Client`/설정 필드는 생성자 이후 불변이라 동시 요청 간 공유해도 안전). 다만 `UsersService.updateAvatar` 가 "느린 외부 I/O(S3 업로드) 이후 로드해 둔 유저 엔티티 전체를 `save()`" 하는 패턴을 새로 도입하면서, 같은 유저 row 를 동시에 건드리는 다른 요청(로그인 실패 카운트·2FA·webauthn·이메일 변경 등, partial `update()` 사용)의 결과를 그 뒤늦은 `save()` 가 조용히 되돌릴 수 있는 lost-update 경쟁을 만들었다 — 트랜잭션도 낙관적 락도 없다. 이는 아바타 업로드라는 기능 자체보다 **계정 보안 상태(로그인 잠금 등)를 은근슬쩍 되돌릴 수 있다는 점**에서 CRITICAL 로 판단한다. 부수적으로 동시 아바타 교체 시 "패자" 오브젝트가 영구 고아로 남는 TOCTOU 도 있으나 이는 저장 공간 누수에 그쳐 WARNING 수준이다.

## 위험도

CRITICAL
