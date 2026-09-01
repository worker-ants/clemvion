# 동시성(Concurrency) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `avatarUrl` 컬럼 자체에 대한 TOCTOU 레이스가 `updateAvatar()` 와 `update()` 두 진입점 모두에 남아 있다 (팀이 이미 인지·유예했고, 독립 검증 결과 데이터 정합성 파괴는 아니라는 결론에 동의함 — 근거는 상세 참조)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:79`(`updateAvatar`, 특히 `:126`~`:145` 구간의 `previousUrl` 캡처 → S3 업로드 → `userRepository.update` → `deletePreviousAvatarObject`) 및 `:234`~`:247`(`update`, `previousUrl` 사전 SELECT → `userRepository.update` → 비교-후-삭제)
  - 상세: 두 메서드 모두 "정리할 옛 키"를 **비원자적 사전 SELECT**(`findOne`)로 캡처한 뒤, 그 사이(=S3 업로드에 걸리는 수백ms~수초, 또는 단순 두 번의 DB 왕복 사이)에 다른 요청이 같은 사용자의 `avatarUrl` 을 바꿀 수 있다. 검증 결과:
    - `avatarUrl` 컬럼 자체는 여전히 "마지막에 `update()` 를 커밋한 요청이 승자"인 last-writer-wins 경쟁이다 — 동시에 두 번 업로드하거나, 업로드와 `PATCH /users/me`(`avatarUrl` 변경)가 겹치면 승자가 임의로 결정된다.
    - 패자 쪽이 새로 올린 S3 객체(`updateAvatar` 경로)는 어떤 `deletePreviousAvatarObject` 호출도 대상으로 잡지 못해 **영구 고아**로 남는다 — `deletePreviousAvatarObject` 는 각 요청이 "자기 자신이 읽은" `previousUrl` 만 지우고, 그 값은 그 요청 자신의 `update()` 호출로 인해 항상 이미 대체된 상태이기 때문에 삭제 자체는 안전하다(현재 유효 참조를 지우는 사고는 관찰되지 않음).
    - 독립적으로 `updateAvatar()` × `update()` 교차 인터리빙(예: 업로드 진행 중에 `PATCH /users/me` 로 `avatarUrl` 을 다른 값/`null` 로 바꾸는 경우)도 같은 패턴으로 재구성해 보았고, 결과는 "마지막에 커밋한 쪽의 값으로 수렴 + 패자 쪽 값의 무결성은 유지(깨진 참조를 만들지 않음)"으로 동일했다. 즉 `plan/in-progress/spec-sync-user-profile-gaps.md` 의 "동시 업로드 TOCTOU — 고아 객체" 항목이 `updateAvatar`·`update` 를 함께 지목한 것은 정확하고, 이 리뷰가 추가로 찾은 새로운 균열은 없다.
  - 제안: 이미 `plan/in-progress/spec-sync-user-profile-gaps.md`(§동시 업로드 TOCTOU)에 재개 신호(고아 객체 수가 사용자 수를 유의미하게 웃돌 때)와 함께 유예되어 있으므로 이 PR 을 막을 이유는 아니다. 다만 그 유예 항목에 "`updateAvatar()` 뿐 아니라 `update()`(PATCH)와의 교차 인터리빙도 같은 클래스"라는 점을 명시적으로 한 줄 보강해 두면, 다음에 원자성을 도입할 때(per-user advisory lock 등) 범위를 좁게 잡는 실수를 막을 수 있다.

## 그 외 점검 결과 (문제 없음)

- **경쟁 조건 — 다른 컬럼**: `updateAvatar()` 가 스냅샷 전체를 `save()` 하는 대신 `userRepository.update(userId, { avatarUrl })` 로 **컬럼 단위** UPDATE 만 실행하도록 고쳐, S3 업로드 대기 중 다른 요청이 바꾼 `loginAttempts`/`lockedUntil`/`twoFactorSecret` 등이 되돌아가는 lost update 를 제거했다(`users.service.ts:137`). 회귀는 `users-avatar.service.spec.ts` 의 `update 는 avatarUrl 단 하나만 싣는다` 테스트가 `Object.keys(patch)` 를 정확히 `['avatarUrl']` 로 고정해 검증한다.
- **원자성 — 저장 후 정리 순서**: `updateAvatar()` 는 `userRepository.update()` 가 성공한 뒤에만 `deletePreviousAvatarObject()` 를 호출한다(`users.service.ts:137`→`:143`). DB 저장이 실패하면 삭제 자체가 실행되지 않아, "이미 지워진 아바타를 가리키는 URL 이 남는" 더 나쁜 상태를 피한다 — `저장 실패 시 s3.delete 미호출` 테스트로 고정돼 있다.
- **Promise.all 사용**: `updateAvatar()` 의 `Promise.all([findOneOrFail(...), deletePreviousAvatarObject(...)])`(`users.service.ts:143`)은 두 작업이 서로의 결과를 쓰지 않아 병렬화가 안전하다. `deletePreviousAvatarObject` 는 내부에서 모든 실패를 `try/catch` 로 삼키고 절대 reject 하지 않으므로(`users.service.ts:169` 이하), `Promise.all` 이 한쪽 실패로 인해 나머지(`findOneOrFail`)를 건너뛰거나 unhandled rejection 을 만들 위험이 없다.
- **async/await 누락**: `s3Service.upload`/`s3Service.delete`/`userRepository.update`/`userRepository.findOne(OrFail)` 등 모든 비동기 호출이 `await` 되거나 `Promise.all` 로 명시적으로 기다려진다. fire-and-forget 패턴은 없다.
- **스레드 안전성 / 공유 가변 상태**: `S3Service`(`codebase/backend/src/common/services/s3.service.ts`)는 생성자에서 `client`/`bucket`/`publicBaseUrl` 을 `readonly` 로 한 번만 설정하고, `upload`/`download`/`delete`/`deleteMany`/`getPublicUrl` 모두 인자와 지역 변수만 사용해 요청 간 공유 가변 상태가 없다. Nest 싱글톤 스코프 provider + Node.js 단일 이벤트 루프 모델에서 이 형태는 본질적으로 동시 요청에 안전하다.
- **이벤트 루프 블로킹**: `main.ts` 부팅 가드가 새로 부르는 `isPrivateHost()`(`codebase/backend/src/common/utils/ssrf.util.ts`)는 순수 동기 문자열/정규식 매칭이며 DNS 조회 등 블로킹 I/O 를 하지 않는다. 부팅 시 1회만 호출되므로 요청 경로에 영향이 없다.
- **리소스 풀링**: `S3Service` 가 `UsersModule` 의 지역 provider 로 추가되며(`users.module.ts`) `KnowledgeBaseModule` 과 별개의 `S3Client` 커넥션 풀이 하나 더 생긴다. 이미 성능 리뷰어가 INFO 로 지적했고 동시성 버그(경쟁·데드락)는 아니다 — Nest 싱글톤이라 부팅 시 1회 생성, 요청마다 재생성되지 않는다.
- **데드락**: 이번 변경에 명시적 락(mutex/semaphore/advisory lock)이 전혀 도입되지 않았다(의도적으로 "락 대신 쓰는 컬럼을 줄이는" 접근을 택함) — 여러 락의 획득 순서 문제 자체가 성립하지 않는다.

## 요약

핵심 동시성 개선은 견고하다 — S3 업로드 대기 중 스냅샷 기반 `save()` 가 만들던 "다른 컬럼 lost update"를 컬럼 단위 `update()` 로 제거했고, 정리(cleanup)는 항상 DB 저장 성공 후에만 실행되도록 순서가 고정되어 있으며 회귀 테스트로 뒷받침된다. `S3Service` 는 상태를 갖지 않아 동시 요청에 안전하고, `Promise.all`·`await` 사용에도 결함이 없다. 유일하게 남은 것은 `avatarUrl` 컬럼 자체를 둘러싼 TOCTOU(동시 업로드/동시 PATCH 시 승자 임의 결정 + 패자 객체 고아화)인데, 이는 팀이 이미 실측 근거와 재개 신호를 갖춘 채 `plan/in-progress/spec-sync-user-profile-gaps.md` 에 명시적으로 유예한 항목이며, 이 리뷰의 독립 재구성으로도 "정합성은 깨지지 않는다(승자 하나로 수렴, 깨진 참조 없음)"는 그 팀의 주장과 어긋나는 반례를 찾지 못했다.

## 위험도

LOW
