# 성능(Performance) 리뷰 — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 옛 아바타 객체 정리(S3 DELETE)가 응답을 블로킹한다 — fire-and-forget 가능
  - 위치: `codebase/backend/src/modules/users/users.service.ts:105` (`await this.deletePreviousAvatarObject(...)` 호출부), 구현은 `:120-147`
  - 상세: `updateAvatar()` 는 `upload → save → deletePreviousAvatarObject` 순으로 전부 `await` 한다. 정리 단계는 이미 "best-effort" 로 설계돼 실패를 내부에서 삼키고 `logger.warn` 만 남긴다(`:140-146`, 응답에 영향 없음). 그런데도 컨트롤러 응답은 이 삭제 네트워크 호출(S3 DELETE 왕복)이 끝날 때까지 대기한다 — 실패해도 사용자에게 드러나지 않는 부수 작업을 위해 요청 지연시간을 늘리는 셈이다.
  - 제안: DB 저장이 성공한 **뒤에** 정리를 시작하는 순서(현재 설계의 핵심 불변식)는 유지한 채, `await` 대신 fire-and-forget(`.catch(...)` 로 실패만 로깅)으로 바꾸면 사용자 응답 latency 에서 S3 delete 왕복 1회를 제거할 수 있다. 다만 이는 "정리는 저장 뒤" 순서 보장과 무관하므로 필수 수정은 아니고 지연시간 최적화 여지로 남긴다.

- **[INFO]** 아바타 업로드 전용 rate-limit 부재 — 전역 기본값(100회/분/사용자)에만 의존
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:143-158` (`@Post('me/avatar')` ~ `FileInterceptor` 설정 블록)
  - 상세: 같은 컨트롤러의 `email-change/request`·`email-change/resend` 는 `@Throttle({ default: { ttl: 60_000, limit: 5 } })` 로 낮은 전용 한도를 건다(`:253`, `:330`). `uploadAvatar` 에는 그런 전용 `@Throttle` 이 없어 `app.module.ts` 의 전역 기본값(`ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] })`, `UserThrottlerGuard` 로 사용자별 적용)만 적용된다. 최대 2MB 파일을 분당 100회까지 올릴 수 있어(이론상 최대 ~200MB/분/사용자), S3 PUT/DELETE 대역폭·스토리지·DB write 소비가 다른 엔드포인트보다 크다.
  - 제안: CRITICAL/WARNING 은 아니다 — 전역 가드가 이미 무제한을 막고 있고, 이 값은 남용 방지보다 "정상 사용자가 실수로 반복 업로드" 정도의 완화다. 필요하면 파일 업로드 특성(대역폭 비용)에 맞춘 더 낮은 전용 `@Throttle` 을 고려할 수 있다는 정도의 참고 사항.

- **[INFO]** `UsersService.update()` 에 `avatarUrl` 이 포함되면 DB 왕복이 2회→3회로 늘어난다 — 의도된 트레이드오프, 결함 아님
  - 위치: `codebase/backend/src/modules/users/users.service.ts:185-199` (`update()`, 특히 `:186-190` 의 조건부 `findOne`)
  - 상세: `'avatarUrl' in data` 일 때만 사전 `findOne` 을 추가해 옛 URL 을 비교한다. 이 메서드의 호출부 17곳 중 대다수(totp·webauthn·auth 등 hot path)는 `avatarUrl` 을 건드리지 않으므로 그 경로들은 추가 쿼리 없이 그대로다 — 오히려 "무조건 사전 조회"보다 나은 설계이며, `users-avatar.service.spec.ts:270-275` 가 "avatarUrl 없는 페이로드는 사전 조회조차 하지 않는다" 를 명시적으로 고정한다. 성능 결함이 아니라 올바르게 스코프를 좁힌 사례로 기록만 남긴다.

- **[INFO]** `FileInterceptor` 가 기본 in-memory storage 사용 — 현재 2MB 상한에서는 무해
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:147-157` (`FileInterceptor('file', { limits: { fileSize: UsersService.AVATAR_MAX_BYTES } })`)
  - 상세: `storage` 옵션을 지정하지 않으면 multer 는 기본으로 `MemoryStorage` 를 쓰므로 파일 전체가 `Buffer` 로 메모리에 올라온 뒤 핸들러에 전달된다(`users.service.ts:98` 의 `file.buffer` 사용과 일치). 상한이 `AVATAR_MAX_BYTES = 2MB`(`users.service.ts:52`)로 낮게 고정돼 있어 동시 다발 업로드가 있어도 메모리 사용량은 유계다. 향후 상한을 크게 올리거나 다른 업로드 경로에 재사용할 경우에는 스트리밍 업로드(S3 멀티파트 등)를 고려할 필요가 있다는 정도의 참고.

## 요약

이 변경(아바타 업로드 엔드포인트 + `S3Service.getPublicUrl` + `s3.config.publicBaseUrl` 3단 폴백)은 단일 요청당 단일 사용자 리소스만 다루는 CRUD 성격의 작업이라 N+1, O(n²) 문자열 누적, 부적절한 자료구조, 캐싱 부재 같은 전형적 성능 결함 패턴은 보이지 않는다. `updateAvatar()`/`deletePreviousAvatarObject()`/`getPublicUrl()` 의 모든 문자열·경로 처리(정규식 트레일링 슬래시 제거, 세그먼트별 `encodeURIComponent`, `indexOf`+`decodeURIComponent` 기반 키 복원)는 짧은 입력에 대한 선형 연산이며 동기 블로킹 I/O 도 없다. `UsersService.update()` 의 조건부 사전 조회는 hot-path 17곳의 쿼리 비용을 늘리지 않도록 의도적으로 좁혀졌고 테스트로 고정돼 있다. 유일하게 남기는 항목은 응답 latency·자원 소비 관점의 개선 여지(정리 삭제의 동기 대기, 전용 rate-limit 부재, in-memory 파일 버퍼)이며 전부 현재 규모(2MB 상한, 전역 throttle 존재)에서는 실제 위험이 아니라 참고용 INFO 로만 남긴다.

## 위험도

LOW
