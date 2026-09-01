# 성능(Performance) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 업로드 파일이 디스크 스풀 없이 **전량 메모리 버퍼**로 처리된다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` (`uploadAvatar` 데코레이터 — `FileInterceptor('file', { limits: { fileSize: UsersService.AVATAR_MAX_BYTES } })`)
  - 상세: `FileInterceptor` 에 `storage` 옵션이 없어 multer 기본값인 `MemoryStorage` 가 쓰인다. 업로드 요청마다 파일 전체(최대 `AVATAR_MAX_BYTES` = 2MB, `codebase/backend/src/modules/users/users.service.ts` 의 `AVATAR_MAX_BYTES` 상수)가 `Buffer` 로 프로세스 메모리에 적재된 뒤 `S3Service.upload()` 로 그대로 전달된다(`users.service.ts` `updateAvatar` 본문의 `s3Service.upload(key, file.buffer, contentType)`). 상한이 2MB 로 작고, 앱 전역 `UserThrottlerGuard` 가 이 엔드포인트에도 적용돼 단일 사용자의 폭주는 이미 제한된다. 동시 사용자 수가 매우 많아지면 (동시 업로드 수 × 최대 2MB) 만큼 상주 메모리가 순간적으로 늘어날 수 있으나, 디스크 스풀·스트리밍 대비 부담이 크지 않은 규모다.
  - 제안: 현재 범위(2MB, 아바타 전용)에서는 조치 불필요. 첨부파일처럼 더 큰 업로드로 이 패턴을 재사용할 계획이 생기면 그때 `diskStorage`/스트리밍 업로드 전환을 검토.

- **[INFO]** `S3Service` 가 소비 모듈마다 지역 provider 로 등록돼 `S3Client`(및 내부 HTTP 커넥션 풀)가 모듈별로 중복 생성된다
  - 위치: `codebase/backend/src/modules/users/users.module.ts` (`providers: [UsersService, S3Service]`)
  - 상세: `S3Service` 생성자가 인스턴스마다 새 `S3Client` 를 만든다(`codebase/backend/src/common/services/s3.service.ts` 생성자). `UsersModule` 이 주석대로 "KB 모듈과 같은 방식" 으로 이 서비스를 지역 provider 로 두면서 `KnowledgeBaseModule` 과 별개의 `S3Client`/커넥션 풀을 하나 더 만든다. Nest 싱글톤 스코프라 앱 부팅 시 1회만 생성되므로 요청 경로 성능 문제는 아니지만, 자원 공유가 최적은 아니다.
  - 제안: 이 PR 이 새로 만든 문제가 아니라 기존 KB 모듈 컨벤션을 그대로 따른 것 — 지금 당장 고칠 필요는 없다. S3 소비 모듈이 더 늘어나면 `S3Service` 를 `@Global` 모듈로 승격하는 편을 고려.

- **[INFO]** `updateAvatar` 한 요청이 DB 왕복 3회(`findOne` → `update` → `findOneOrFail`)를 낸다 — 병렬화는 이미 적용되어 있음
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`updateAvatar` — `userRepository.findOne` 존재 확인 → `userRepository.update(userId, { avatarUrl })` → `Promise.all([userRepository.findOneOrFail(...), this.deletePreviousAvatarObject(...)])`)
  - 상세: 이전 라운드(리뷰 세션 `2026/08/31/23_46_40`) 가 "재조회(SELECT)와 S3 삭제가 서로 결과를 안 쓰는데 순차 `await` 로 묶여 있다" 는 점을 지적했고, 그 지적은 이미 반영되어 현재 코드는 `Promise.all` 로 두 I/O 를 병렬 대기한다 — 응답 지연 관점에서 개선된 상태를 확인했다. 다만 `UPDATE` 뒤 별도 `findOneOrFail` SELECT 를 또 실행하는 구조 자체는 남아 있어(PostgreSQL `UPDATE ... RETURNING` 이면 이 SELECT 를 없앨 수 있다), DB 왕복 횟수 자체는 `findOne`(1) + `update`(1) + `findOneOrFail`(1) = 3회다. 같은 파일의 `update()`(범용 PATCH 경로) 도 동일한 2단계(`update` 뒤 `findOneOrFail`) 패턴이라 이번 PR 이 새로 만든 관례는 아니다.
  - 제안: 아바타 업로드는 hot path 가 아니고(사용자당 저빈도, 업로드 자체가 이미 네트워크 I/O 로 수백 ms 걸림), 우선순위는 낮다. 저장소가 이미 `raw UPDATE ... RETURNING` 헬퍼(`update-returning-rows.spec.ts`, CHANGELOG 언급)를 다른 경로(`incrementLoginAttempts`)에 쓰고 있으므로, 필요해지면 같은 패턴으로 SELECT 1회를 줄일 수 있다는 점만 기록.

## 그 외 점검 결과 (문제 없음)

- **알고리즘 복잡도**: `updateAvatar`/`deletePreviousAvatarObject`/`getPublicUrl`/`isPrivateHost` 모두 O(1)~O(k)(k=경로 세그먼트 수 또는 URL 길이) 수준의 단순 문자열·해시맵 조회 연산. 루프나 중첩 순회 없음.
- **N+1 쿼리/호출**: 요청당 DB 접근·S3 호출 모두 입력 크기와 무관하게 상수 횟수로 고정(DB 3회, S3 업로드 1회 + best-effort 삭제 1회). `S3Service.deleteMany`(이번 diff 밖, 인접 코드)는 1000키 단위 청크 처리를 유지해 배치 우려 없음.
- **캐싱**: 반복 계산이 없어 캐싱 필요성 자체가 없다. `S3_PUBLIC_BASE_URL` 폴백(`resolvePublicBaseUrl`)은 요청마다 재계산되지 않고 부팅 시 `s3.config.ts`/`S3Service` 생성자에서 한 번만 평가된다.
- **블로킹 I/O**: `S3Client.send`·`userRepository.findOne/update/findOneOrFail` 모두 `await` 로 비동기 처리. `main.ts` 의 신규 production 부팅 가드(`shouldWarnPublicBaseIsPrivate` → `isPrivateHost`)는 부팅 시 1회만 실행되며, 여기서 쓰이는 `isPrivateHost` 는 동기 문자열/정규식 판정만 하고(URL 파싱 + 정규식) DNS 조회를 하지 않으므로(`resolvesToPrivate` 와 달리 `dns.lookup` 미호출) 요청 경로는 물론 부팅 경로에도 블로킹 I/O 가 없다.
- **불필요한 연산**: 문자열 연결은 템플릿 리터럴 단발(`avatars/${userId}/${randomUUID()}.${ext}` 등)이고 반복 누적(O(n²) 패턴) 없음. `getPublicUrl` 의 세그먼트별 `encodeURIComponent` 도 키 세그먼트 수(≤3)에 비례하는 상수 작업.
- **데이터 구조**: 확장자→Content-Type 매핑(`AVATAR_CONTENT_TYPES`)이 `Record`(해시맵)라 O(1) 조회 — 화이트리스트 검증 용도에 적합.
- **지연 로딩**: 업로드·삭제·URL 생성이 모두 실제 필요 시점에만 호출되고, 선행 로딩되는 불필요한 리소스가 없다.
- **삭제 순서(DB 저장 후 정리)**: DB `update()` 실패 시 `deletePreviousAvatarObject`/재조회 자체가 실행되지 않는 순차 구조 — 정합성 보장과 함께 불필요한 I/O 도 피한다(실패 조기 반환).

## 요약

이번 diff 는 이미 8라운드에 걸친 리뷰-수정 사이클을 거친 상태이며, 이전 라운드가 성능 관점에서 지적했던 항목(재조회·삭제의 불필요한 순차 대기)은 `Promise.all` 병렬화로 이미 해소되어 있음을 소스 직접 확인으로 재검증했다. `updateAvatar`/`update`/`getPublicUrl`/`deletePreviousAvatarObject`/`incrementLoginAttempts`(원자적 `UPDATE...RETURNING`으로 재작성됨) 모두 요청당 상수 횟수의 I/O 만 발생시키며, N+1·O(n²) 누적·불필요한 캐시 부재 같은 구조적 성능 결함은 관찰되지 않는다. 남은 것은 전부 이미 알려진 트레이드오프다: (1) multer 기본 메모리 스토리지로 업로드 파일 전체가 요청마다 인메모리 버퍼로 적재되는 점(2MB 상한 + 전역 스로틀로 완화됨), (2) `S3Service` 가 모듈별 로컬 provider 라 `S3Client` 커넥션 풀이 KB 모듈과 별도로 중복 생성되는 점(부팅 1회, 기존 컨벤션), (3) `updateAvatar` 가 `UPDATE` 뒤 별도 `findOneOrFail` SELECT 를 한 번 더 내는 점(병렬화는 이미 됨, hot path 아님). 셋 다 현재 규모에서 실질 위험이 낮아 INFO 로만 남긴다.

## 위험도

LOW
