# 성능(Performance) 리뷰 — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** best-effort S3 정리(delete)를 응답 임계 경로에서 `await` 해 불필요하게 지연시킨다 — 저장소 자체의 fire-and-forget 관례에서 벗어남
  - 위치: `codebase/backend/src/modules/users/users.service.ts:145` (`updateAvatar` 내부 `await this.deletePreviousAvatarObject(userId, previousUrl);`), 그리고 `codebase/backend/src/modules/users/users.service.ts:242-244` (`update` 내부 동일 패턴)
  - 상세: `deletePreviousAvatarObject`(`users.service.ts:167-194`)는 내부적으로 전체를 `try/catch` 로 감싸 **항상 성공적으로 resolve** 한다(예외를 절대 전파하지 않고 `logger.warn` 만 남긴다, `users.service.ts:182-193`). 그런데 두 호출부(`updateAvatar`·`update`) 모두 이 best-effort 삭제를 `await` 한 뒤 응답을 반환한다. 즉 아바타 교체(2번째 업로드부터)마다, 그리고 `PATCH /users/me` 로 `avatarUrl` 이 바뀔 때마다 클라이언트는 **필수 경로(S3 PUT + DB UPDATE + DB SELECT)에 더해 S3 DELETE 왕복 1회를 그대로 기다린다** — 이 삭제는 실패해도 응답 값에 전혀 영향을 주지 않는데도 그렇다.
  - 이 저장소에는 정확히 이런 상황(실패를 삼키는 best-effort 부수효과)을 **await 하지 않고 fire-and-forget** 으로 처리하는 기존 관례가 있다 — 예: `codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts:135` (`client.del(key).catch(...)`, "best-effort DEL — 공유 연결이 가용할 때만 시도"), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3178` (`void this.redriveStuckExecution(executionId).catch(...)`). 이번 아바타 코드만 같은 성격의 작업을 동기적으로 기다리는 형태로 들어갔다.
  - 참고: OAuth 로그인 콜백(`auth-oauth.service.ts` `resolveUser`)은 raw `QueryBuilder` 를 직접 써 `UsersService.update()` 를 거치지 않으므로(테스트 파일의 "OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리" 참고) 이번 지연은 로그인 리다이렉트 경로에는 영향이 없다. 영향 범위는 `POST /api/users/me/avatar`(교체 시)와 `PATCH /api/users/me`(avatarUrl 이 실제로 바뀔 때)로 한정된다.
  - 제안: `deletePreviousAvatarObject` 호출을 `void this.deletePreviousAvatarObject(...)` 형태로 바꿔 응답을 막지 않게 한다. 이미 내부에서 예외를 전부 흡수하므로 unhandled rejection 위험은 없다. 다만 관련 유닛테스트(`users-avatar.service.spec.ts` 의 "우리가 올린 옛 아바타를 지운다" 등, `s3.delete` 호출을 `await service.updateAvatar(...)` 직후 동기적으로 단언하는 케이스들)는 fire-and-forget 으로 바꾸면 타이밍이 어긋날 수 있어 함께 조정이 필요하다.

- **[INFO]** `UPDATE` 뒤 별도 `findOneOrFail` 재조회 — 왕복을 줄일 여지는 있으나 이 경로에서는 우선순위가 낮다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:137` (`await this.userRepository.update(userId, { avatarUrl });`) + `:139-141` (`findOneOrFail`), 그리고 `:239-240` (`update()` 의 동일 패턴)
  - 상세: `updateAvatar`/`update` 모두 `UPDATE` 커밋 후 곧바로 같은 row 를 다시 `SELECT` 해 최신 상태를 응답에 싣는다(의도는 명확히 주석화됨 — 업로드 도중 다른 요청이 바꾼 컬럼을 반영하기 위함). 이 저장소에는 이미 `UPDATE ... RETURNING` 결과를 한 번에 꺼내는 `common/utils/update-returning-rows.ts` (`updateReturningRows`) 유틸이 여러 모듈(`execution-engine`, `knowledge-base`, `agent-memory` 등)에 정착돼 있어, 원칙적으로는 `UPDATE ... RETURNING *` raw 쿼리 한 번으로 왕복을 줄일 수 있다.
  - 다만 `update-returning-rows.ts` 자신의 JSDoc 이 경고하듯 raw 쿼리 결과는 컬럼명이 snake_case 로 오고 제네릭 타입은 검증이 아니라 단언이라(`rememberMe` 매핑 누락 사고 사례가 이미 그 파일에 기록돼 있음), 이 전환 자체가 별도의 위험을 들여온다. 아바타 엔드포인트는 배치/고빈도 경로가 아니라(§N+1 관점에서 호출부 17곳 전부 사용자 1건 단위, 루프 없음 확인) SELECT 왕복 1회(수 ms 수준)가 S3 PUT/DELETE 왕복(대개 수십~수백 ms)에 비해 지배적이지 않다.
  - 제안: 지금 당장 바꿀 필요는 없다. 향후 이 경로가 고빈도가 되거나 DB 레이턴시가 이슈가 되면 `updateReturningRows` 컨벤션을 적용하되, 그때는 raw row 전용 타입(snake_case)을 새로 선언해 넘길 것.

- **[INFO]** 아바타 파일은 요청당 전체가 메모리에 버퍼링된다 — 2MB 상한과 정합되므로 현재는 문제없음
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar` 의 `FileInterceptor('file', { limits: { fileSize: UsersService.AVATAR_MAX_BYTES } })` (`users.controller.ts` — 새 `@Post('me/avatar')` 블록, `limits` 지정 줄), 소비처는 `users.service.ts:124` (`await this.s3Service.upload(key, file.buffer, contentType);`)
  - 상세: `storage` 옵션을 지정하지 않아 multer 기본값(MemoryStorage)이 적용되고, `file.buffer` 를 그대로 S3 `PutObjectCommand` 에 넘긴다. `AVATAR_MAX_BYTES = 2 * 1024 * 1024`(`users.service.ts:52`)로 상한이 있고 multer 가 스트림 단계에서 초과분을 끊으므로 무한정 버퍼링될 위험은 없다. 다만 동시 업로드가 많아지면 요청당 최대 2MB × 동시 요청 수만큼 힙에 상주한다는 점은 스케일 논의 시 참고할 값이다.
  - 제안: 현재 규모에서는 조치 불필요. 동시성이 커지면 스트리밍 업로드(예: `@aws-sdk/lib-storage` 의 `Upload` + 스트림)로 전환하는 것을 고려할 수 있다.

## 요약

이번 PR 의 핵심 로직(`UsersService.updateAvatar`/`update`, `S3Service.getPublicUrl`)은 알고리즘적으로 단순하고(문자열 조립·slice·prototype-safe lookup 모두 O(1)~O(n) 수준의 사소한 연산), N+1 배치 호출이나 캐싱 누락, 부적절한 자료구조 같은 구조적 문제는 없다. `UsersService.update()` 에 추가된 `avatarUrl` 변경 감지용 사전 `findOne` 은 `'avatarUrl' in data` 가드로 17개 호출부 대부분(2FA·webauthn 등 고빈도 경로)에 추가 SELECT 를 만들지 않도록 이미 잘 스코프돼 있다. 유일하게 실질적인 지적은 실패를 이미 내부에서 삼키는 best-effort S3 정리(delete)를 두 호출부(`updateAvatar`, `update`) 모두 응답 반환 전에 동기적으로 기다린다는 점이다 — 이 저장소의 기존 fire-and-forget 관례(`execution-seq-allocator.service.ts`, `execution-engine.service.ts`)와 어긋나며, 아바타를 교체할 때마다 필요 없는 S3 왕복 1회만큼 사용자 응답이 늦어진다. `UPDATE` 뒤 재조회(`findOneOrFail`)나 메모리 버퍼링은 현재 트래픽/상한 규모에서는 문제가 되지 않는 설계상 트레이드오프로 판단된다.

## 위험도

LOW
