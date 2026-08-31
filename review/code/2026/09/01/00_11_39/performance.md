# 성능(Performance) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 업로드 파일이 디스크 스풀 없이 요청마다 **전량 메모리 버퍼**로 적재된다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:150-160` (`FileInterceptor('file', { limits: { fileSize: UsersService.AVATAR_MAX_BYTES } })`)
  - 상세: `FileInterceptor` 에 `storage` 옵션이 없어 multer 기본값인 `MemoryStorage` 가 쓰인다 — 요청마다 파일 전체가 `Buffer` 로 프로세스 힙에 올라간 뒤(`Express.Multer.File.buffer`) `UsersService.updateAvatar`(`users.service.ts:124`)를 거쳐 `S3Service.upload`(`s3.service.ts:53-67`)로 그대로 전달된다. 상한은 `AVATAR_MAX_BYTES = 2 * 1024 * 1024`(`users.service.ts:52`)로 작고, 이 엔드포인트에도 전역 `UserThrottlerGuard` 가 적용돼 단일 사용자의 폭주는 제한된다. 다만 동시 사용자 수가 늘면 (동시 업로드 수 × 최대 2MB) 만큼 순간 상주 메모리가 늘 수 있다 — 디스크 스풀/스트리밍이었다면 이 피크가 없다.
  - 제안: 현재 규모(2MB 상한, 아바타 전용)에서는 조치 불필요. 향후 더 큰 파일(첨부파일 등)에 같은 패턴을 재사용할 계획이 생기면 그때 `diskStorage`/스트리밍 업로드 전환을 검토.

- **[INFO]** `S3Service` 가 소비 모듈마다 로컬 provider 로 등록돼 `S3Client`(및 내부 keep-alive 커넥션 풀)가 모듈별로 중복 생성된다
  - 위치: `codebase/backend/src/modules/users/users.module.ts:19-25` (`providers: [UsersService, S3Service]`)
  - 상세: `S3Service` 생성자(`s3.service.ts:18-51`)가 인스턴스마다 새 `S3Client` 를 만든다. `UsersModule` 이 이를 로컬 provider 로 선언(주석에 "KB 모듈과 같은 방식"으로 명시)하면서, `KnowledgeBaseModule` 이 이미 생성한 것과 별개의 `S3Client`/커넥션 풀을 하나 더 만든다. Nest 싱글톤 스코프라 앱 부팅 시 1회만 생성되므로 요청 경로 성능 문제는 아니고, 이번 PR 이 새로 만든 문제도 아니라 기존 KB 모듈 컨벤션을 그대로 따른 것이다.
  - 제안: 지금 당장 고칠 필요는 없음. S3 소비 모듈이 더 늘면 `S3Service` 를 `@Global` 로 승격해 커넥션 풀을 공유하는 편을 고려.

## 그 외 점검 결과 (문제 없음)

- **알고리즘 복잡도**: `updateAvatar`(`users.service.ts:79-149`) · `deletePreviousAvatarObject`(`users.service.ts:169-196`) · `getPublicUrl`(`s3.service.ts:86-95`) 모두 O(1)~O(k)(k=키 세그먼트 수, 최대 3) 수준의 단순 문자열·조회 연산. 루프·중첩 순회 없음.
- **N+1 쿼리/호출**: 요청당 DB 접근은 `findOne` 1회 + `update` 1회 + `findOneOrFail` 1회로 고정(`users.service.ts:113,137,145`), S3 호출도 `upload` 1회(:124) + best-effort `delete` 1회(:188)로 고정 — 개수가 입력 크기에 비례하지 않는다.
- **동시 I/O 병렬화**: 재조회(`findOneOrFail`)와 옛 객체 정리(`deletePreviousAvatarObject`)가 서로의 결과를 쓰지 않으므로 `Promise.all` 로 병렬 대기한다(`users.service.ts:143-147`) — 불필요한 순차 대기를 피한 긍정적 변경.
- **DB 쓰기 최소화**: 이전 리뷰 라운드에서 지적된 "전체 엔티티 `save(user)`" 패턴이 컬럼 단위 `userRepository.update(userId, { avatarUrl })`(`users.service.ts:137`)로 교체되어 있다 — 다른 컬럼을 UPDATE 문에 싣지 않아 쓰기 비용도 함께 줄었다(동시성 정합성이 주 목적이나 성능에도 부수 이득).
- **캐싱**: 반복 계산이 없어 캐싱 필요성 자체가 없다.
- **블로킹 I/O**: `S3Client.send`·`userRepository.findOne/update/findOneOrFail` 모두 `await` 로 비동기 처리되며 동기 I/O 호출이 없다. `main.ts` 의 신규 production 부팅 가드(`isPrivateHost` 호출)는 부팅 시 1회만 실행되고 DNS 조회 없이 동기 문자열/정규식 판정만 하므로 요청 경로에 영향 없다.
- **불필요한 연산**: 문자열 연결은 템플릿 리터럴 단발(`avatars/${userId}/${randomUUID()}.${ext}` 등)이고 반복 누적(O(n²) 패턴)이 없다. `getPublicUrl` 의 `key.split('/').map(encodeURIComponent).join('/')` 도 세그먼트 수(최대 3)에 비례하는 상수 수준.
- **데이터 구조**: 확장자→Content-Type 매핑에 `Record`(해시맵)를 써 O(1) 조회 — 용도에 적합(`users.service.ts:43-49`). `hasOwnProperty` 가드 추가도 조회 비용에 영향 없음.
- **지연 로딩**: 업로드·삭제·URL 생성이 모두 실제로 필요한 시점에만 호출되고, 선행 로딩되는 불필요한 리소스가 없다.
- **삭제 순서(저장 후 삭제)**: DB 저장이 실패하면 `deletePreviousAvatarObject` 자체가 호출되지 않는 순차 구조 — 추가 네트워크 왕복이나 트랜잭션 오버헤드 없이 정합성과 성능을 동시에 만족한다.
- **`resolvePublicBaseUrl`/`isPrivateHost`**: 둘 다 순수 문자열 연산이며 부팅 시 또는 설정 로드 시 1회만 평가된다(`s3.config.ts:14-16`, `main.ts` production 가드) — 요청 경로 핫패스에 없다.

## 요약

이번 변경(아바타 업로드 신설 + 공개 URL base 설정)은 요청당 DB/S3 호출이 모두 상수 횟수로 고정되어 있고, 이전 리뷰에서 지적된 "전체 엔티티 `save()`" 패턴도 컬럼 단위 `update()` 로 이미 교체되어 있어 N+1, O(n²) 누적, 과도한 메모리 적재 같은 전형적 성능 결함이 관찰되지 않는다. 남은 두 항목 — (1) multer 기본 메모리 스토리지로 인한 요청당 버퍼 적재, (2) 모듈별 `S3Client` 중복 생성 — 은 둘 다 현재 규모(2MB 상한 + 전역 스로틀, 기존 KB 모듈과 동일 컨벤션)에서 실질적 위험이 낮아 INFO 로만 남긴다. 신규 부팅 가드(`isPrivateHost`)도 요청 경로가 아닌 1회성 부팅 로직이라 영향이 없다.

## 위험도

LOW
