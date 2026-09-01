# 성능(Performance) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** 업로드 파일이 디스크 스풀 없이 **전량 메모리 버퍼**로 처리된다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:142-147` (`FileInterceptor('file', { limits: { fileSize: UsersService.AVATAR_MAX_BYTES } })`)
  - 상세: `FileInterceptor` 에 `storage` 옵션이 지정되지 않아 multer 기본값인 `MemoryStorage` 가 쓰인다 — 업로드 요청마다 파일 전체(최대 `AVATAR_MAX_BYTES` = 2MB, `codebase/backend/src/modules/users/users.service.ts:50`)가 `Buffer` 로 프로세스 메모리에 적재된 뒤 `S3Service.upload` 로 그대로 전달된다(`users.service.ts:93`). 상한이 2MB 로 작고, 앱 전역 `UserThrottlerGuard`(기본 100req/60s per user, `codebase/backend/src/app.module.ts:151-152,210`)가 이 엔드포인트에도 적용돼 단일 사용자의 폭주는 이미 제한된다. 다만 동시 사용자 수가 많아지면 (동시 업로드 수 × 최대 2MB) 만큼 상주 메모리가 순간적으로 늘어날 수 있다 — 디스크 스풀이나 스트리밍 업로드였다면 이 피크가 없다.
  - 제안: 현재 트래픽 규모에서는 문제 삼을 수준은 아니다. 아바타보다 큰 업로드(예: 첨부파일)로 이 패턴을 재사용할 계획이 있다면 그때는 `diskStorage` 또는 스트리밍 업로드로 전환을 검토할 것. 지금 범위(2MB, 아바타 전용)에서는 조치 불필요.

- **[INFO]** `S3Service` 가 소비 모듈마다 로컬 provider 로 등록돼 `S3Client`(및 그 내부 HTTP 커넥션 풀)가 모듈별로 중복 생성된다
  - 위치: `codebase/backend/src/modules/users/users.module.ts:24` (`providers: [UsersService, S3Service]`)
  - 상세: `S3Service` 생성자가 매 인스턴스마다 새 `S3Client`(`codebase/backend/src/common/services/s3.service.ts:36-44`)를 만든다. `UsersModule` 이 이 서비스를 로컬 provider 로 선언하면서(주석에 명시된 대로 "KB 모듈과 같은 방식") `KnowledgeBaseModule`(`codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts:66`)과 별개의 `S3Client`/keep-alive 커넥션 풀을 하나 더 만든다. Nest 싱글톤 스코프라 앱 부팅 시 1회만 생성되므로 요청 경로의 성능 문제는 아니지만, 커넥션 풀이 공유되지 않아 자원 활용이 최적은 아니다.
  - 제안: 이 PR 이 새로 만든 문제가 아니라 기존 KB 모듈 컨벤션을 그대로 따른 것이다 — 지금 당장 고칠 필요는 없다. 다만 S3 소비 모듈이 더 늘어나면 `S3Service` 를 `@Global` 모듈로 승격해 커넥션 풀을 공유하는 편이 나을 수 있다는 점을 기록해 둔다.

## 그 외 점검 결과 (문제 없음)

- **알고리즘 복잡도**: `updateAvatar`/`deletePreviousAvatarObject`/`getPublicUrl` 모두 O(1)~O(k) (k=경로 세그먼트 수, 최대 3) 수준의 단순 문자열·조회 연산이다. 루프나 중첩 순회가 없다.
- **N+1 쿼리**: 요청당 DB 접근은 `findOne` 1회 + `save` 1회로 고정이며 반복문 안에서 쿼리를 발생시키는 구조가 아니다. S3 호출도 `upload` 1회 + best-effort `delete` 1회로 고정(개수가 입력 크기에 비례하지 않음).
- **캐싱**: 반복 계산이 없어 캐싱 필요성 자체가 없다.
- **블로킹 I/O**: `S3Client.send`·`userRepository.findOne/save` 모두 `await` 로 비동기 처리되며 동기 I/O 호출이 없다.
- **불필요한 연산**: 문자열 연결은 템플릿 리터럴 단발(`avatars/${userId}/${randomUUID()}.${ext}` 등)이고 반복 누적(O(n²) 패턴)이 없다.
- **데이터 구조**: 확장자→Content-Type 매핑에 `Record`(해시맵)를 써 O(1) 조회 — 용도에 적합하다.
- **지연 로딩**: 업로드·삭제·URL 생성이 모두 실제로 필요한 시점에만 호출되고, 선행 로딩되는 불필요한 리소스가 없다.
- **삭제 순서(저장 후 삭제)**: DB 저장이 실패하면 `deletePreviousAvatarObject` 호출 자체가 실행되지 않는 순차 구조 — 추가 네트워크 왕복이나 트랜잭션 오버헤드 없이 정합성과 성능을 동시에 만족한다.
- **DeleteObjects 청크**: 이번 diff 대상은 아니지만 인접 코드인 `S3Service.deleteMany` 가 1000키 단위로 청크 처리하는 기존 구현을 그대로 유지 — 이번 변경(`delete` 단건 호출)과 일관된다.

## 요약

변경 범위가 단일 리소스(자기 자신의 아바타) CRUD 수준으로 작고, DB/S3 호출이 모두 요청당 상수 횟수(조회 1·업로드 1·저장 1·best-effort 삭제 1)로 고정되어 있어 N+1, O(n²) 누적, 불필요한 캐싱 부재 같은 전형적 성능 결함이 없다. 유일하게 기록해 둘 만한 것은 (1) multer 기본 메모리 스토리지로 인해 업로드 파일 전체가 요청마다 인메모리 버퍼로 적재된다는 점과 (2) `S3Service` 가 모듈별 로컬 provider 라 `S3Client` 커넥션 풀이 중복 생성된다는 점인데, 둘 다 현재 규모(2MB 상한 + 전역 100req/min 스로틀, 기존 KB 모듈과 동일한 컨벤션)에서는 실질적 위험이 낮아 INFO 로만 남긴다.

## 위험도

LOW
