# 테스트(Testing) 리뷰 — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `POST /api/users/me/avatar` 신규 엔드포인트에 대한 e2e(supertest) 테스트가 없다 — 실 MinIO/multer 통합이 unit 만으로는 검증되지 않는다
  - 위치: 파일 부재. 대조군: `codebase/backend/test/users-change-password.e2e-spec.ts`, `codebase/backend/test/users-email-change.e2e-spec.ts` (같은 `POST /users/me/*` 패턴의 자매 엔드포인트는 둘 다 e2e-spec 을 갖고 있다). 신규 엔드포인트 쪽엔 `codebase/backend/test/users-avatar*.e2e-spec.ts` 류가 이번 diff 에 없다.
  - 상세: `PROJECT.md` §e2e 테스트 작성 가이드는 "실 인프라 의존 (Postgres, Redis, MinIO, Flyway 마이그레이션, BullMQ)" 을 e2e 작성 기준으로 명시한다. 이 엔드포인트는 정확히 그 기준에 해당한다 — 실제 `multipart/form-data` 파싱(`FileInterceptor`), multer 의 실제 413(payload too large) 응답, 실 MinIO 왕복(`upload`→`getPublicUrl`→객체 존재), 실제 `JwtAuthGuard` 적용 여부가 전부 unit 테스트로는 원리적으로 검증되지 않는다(unit 은 `S3Service` 를 통째로 mock 하고 `controller.uploadAvatar()` 를 HTTP 계층 없이 직접 호출한다).
    또한 이번 diff 는 `docker-compose.e2e.yml`/`docker-compose.yml`/`k8s/*` 세 곳에 `S3_PUBLIC_BASE_URL` 을 새로 추가했지만, `createbuckets` 서비스(두 compose 파일 모두)는 여전히 `mc mb local/workflow-storage --ignore-existing` 뿐이고 `avatars/` 접두에 대한 익명 GET 정책(`mc anonymous set download` 류)을 설정하지 않는다. 즉 지금 e2e 인프라 자체가 "공개 URL 이 실제로 200 을 내는가" 를 검증할 준비가 안 되어 있다 — CHANGELOG 가 반복 경고하는 "업로드는 성공하고 이미지만 403" 케이스를 e2e 로 실증할 수 있는 회귀 안전망이 이번 PR 에 없다는 뜻이다.
  - 제안: `codebase/backend/test/users-avatar.e2e-spec.ts` 신설 — 실제 multipart 업로드(성공/타입 거부/사이즈 초과 413), `S3_PUBLIC_BASE_URL` 로 조립된 URL 에 실제 GET 을 날려 200 을 확인(이 경우 `createbuckets` 에 익명 다운로드 정책 추가가 선행되어야 한다), 교체 시 이전 객체가 실제로 사라지는지(HeadObject 404) 를 최소 축으로 포함.

- **[WARNING]** `users-avatar-swagger-sync.spec.ts` 의 정규식이 세 곳 중 한 곳의 "2MB" 리터럴을 포착하지 못한다 — 이 spec 자체가 존재 이유로 내세운 드리프트 감시가 불완전하다
  - 위치: `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts:20` (`const found = [...source.matchAll(/최대 (\d+)MB/g)]...`), `codebase/backend/src/modules/users/users.controller.ts:185` (`@ApiPayloadTooLargeResponse({ description: '파일 크기 초과 (2MB)' })`)
  - 상세: 정규식 `/최대 (\d+)MB/g` 는 리터럴 앞에 정확히 `"최대 "` 접두사를 요구한다. `users.controller.ts:185` 의 `@ApiPayloadTooLargeResponse` 설명은 `"파일 크기 초과 (2MB)"` 로, `"최대"` 라는 단어 자체가 없다 — 이 문자열은 구조적으로 이 regex 에 절대 매칭되지 않는다(`grep -n "최대" users.controller.ts` 로 확인: 185번째 줄은 매칭되는 3건에 포함되지 않음). 즉 `AVATAR_MAX_BYTES` 를 예컨대 5MB 로 바꾸고 `@ApiOperation`/`@ApiBody` 의 두 "최대 NMB" 문구만 고치면(그래서 이 spec 은 GREEN), `@ApiPayloadTooLargeResponse` 의 "2MB" 는 조용히 stale 로 남고 어떤 테스트도 잡지 못한다. 이 spec 의 자체 JSDoc(파일 8, 8~13행)이 "진짜로 갈릴 수 있는 곳은 여기" 라고 명시적으로 주장하는 바로 그 보장이 이 한 곳에서 깨진다.
  - 제안: `@ApiPayloadTooLargeResponse` 의 설명 문구를 `"파일 크기 초과 (최대 2MB)"` 형태로 통일하거나(다른 두 곳과 같은 "최대 NMB" 관용구), 이 값을 별도로 추출해 검사하는 두 번째 assertion 을 추가한다.

- **[INFO]** 같은 spec 의 확장자 목록 검사가 `String.match()`(비-global)라 두 번째 리터럴(`@ApiBody` 필드 설명)은 실제로 핀되지 않는다
  - 위치: `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts:28` (`const m = source.match(/\(최대 \d+MB, ([a-z/]+)\)/);`) — `@ApiOperation.description` (`users.controller.ts:162`) 과 `@ApiBody...file.description` (`users.controller.ts:175`) 둘 다 현재 `"png/jpg/jpeg/webp/gif"` 리스트를 나열하지만, `g` 플래그가 없는 `.match()` 는 소스 전체에서 **첫 번째 occurrence(162행)만** 반환한다.
  - 상세: `AVATAR_CONTENT_TYPES` 에 확장자를 추가/제거하면서 162행(첫 매치)만 고치고 175행(`@ApiBody` 필드 설명)을 빠뜨려도 이 테스트는 계속 GREEN 이다 — 두 번째 리터럴은 애초에 검사 대상에 들어오지 않는다. 위 WARNING 과 같은 유형의 갭이다.
  - 제안: `matchAll` + `/g` 로 바꿔 파일 내 모든 occurrence 를 순회하며 각각 `allowed` 와 비교한다.

- **[INFO]** `S3Service` 생성자의 `publicBaseUrl` `?? endpoint` 폴백 분기가 어떤 테스트에서도 실행되지 않는다
  - 위치: `codebase/backend/src/common/services/s3.service.ts:34-35` (`this.publicBaseUrl = this.configService.get<string>('s3.publicBaseUrl') ?? endpoint;`) / 대응 테스트 헬퍼: `codebase/backend/src/common/services/s3.service.spec.ts:21-37` (`createService`)
  - 상세: `createService()` 헬퍼는 기본값 목록에 `'s3.publicBaseUrl': 'http://localhost:9000'` 를 항상 채워 넣으므로(파일 6, 30행), `overrides` 로 다른 키를 바꿔도 `publicBaseUrl` 자체를 `undefined` 로 만드는 케이스는 이번 diff 의 어떤 테스트에도 없다 — 즉 33~35행의 `?? endpoint` 라는 방어적 폴백 로직 자체가 한 번도 실행되지 않은 채 커밋된다. (`s3.config.ts` 가 자체적으로 3단 폴백을 이미 보장하므로 프로덕션에서는 사실상 도달 불가능한 분기이긴 하지만, 코드가 명시적으로 존재하고 주석까지 달려 있다면 그 분기가 실제로 동작하는지 최소 1건은 고정하는 편이 낫다.)
  - 제안: `createService({ 's3.publicBaseUrl': undefined as unknown as string })` 류로 `configService.get` 이 undefined 를 반환하는 케이스를 1건 추가해 `?? endpoint` 폴백이 실제로 endpoint 값을 쓰는지 확인한다.

- **[INFO]** `service as unknown as {...}` 로 private `userRepository` 필드에 직접 접근 — 같은 파일 뒤쪽 `build()` 헬퍼가 이미 더 나은 패턴을 쓰고 있다
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:166-169` (`const repo = (service as unknown as { userRepository: { save: jest.Mock } }).userRepository;`)
  - 상세: `setup()` 헬퍼(같은 파일 44~68행)가 `repo` 참조를 반환하지 않아서, "정리는 DB 저장 뒤에 일어난다" 테스트가 private 필드를 타입 캐스팅으로 뚫어 우회한다. 필드명(`userRepository`)이 바뀌면 이 캐스트는 컴파일은 통과하되 런타임에 `undefined.mockRejectedValue` 로 알아보기 어려운 실패를 낸다. 반면 파일 뒤쪽 `describe('UsersService.update — PATCH...')` 의 `build()` 헬퍼(232~256행)는 `{ service, s3, repo }` 를 반환해 같은 문제를 깔끔하게 피한다.
  - 제안: `setup()` 도 `repo` 를 반환하도록 시그니처를 바꿔 private 필드 리플렉션을 제거한다(가독성·리팩터링 내성 개선).

- **[INFO]** "빈 파일을 거부한다" 테스트가 `file: undefined` 형태만 검증하고, 실제 0바이트 멀티파트 업로드가 만드는 `{ buffer: Buffer.alloc(0), ... }` 형태(즉 `file` 객체는 존재하되 `buffer` 가 빈)는 별도로 검증하지 않는다
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:113-119`
  - 상세: 가드 로직(`!file?.buffer?.length`, `users.service.ts:72`)은 두 형태를 동일하게 처리하도록 작성되어 있어 현재는 버그가 아니지만, multer 가 실제로 만드는 형태는 `file: undefined` 가 아니라 "빈 buffer 를 가진 file 객체" 쪽에 더 가깝다(필드 미첨부 시에만 `undefined`). 이 가드가 리팩터링되면서 두 분기 중 하나만 살아남는 회귀가 나도 이 스위트는 여전히 GREEN 일 수 있다.
  - 제안: `makeFile('x.png')` 를 변형해 `buffer: Buffer.alloc(0)` 인 케이스를 추가로 1건 고정한다.

## 요약

이번 변경의 핵심 로직(`UsersService.updateAvatar`/`deletePreviousAvatarObject`/`update`, `S3Service.getPublicUrl`, `s3Config.publicBaseUrl`)은 unit 레벨에서 매우 두텁게 테스트되어 있다 — plan 문서가 기록한 6축 뮤테이션 전부 RED 이고, "조용히 실패할 수 있는" 세 위험(키 추측 가능성·Content-Type 스푸핑·고아 객체)마다 happy-path 뿐 아니라 순서 반전·부분 실패·URL 파싱 오류 같은 부정 경로까지 고정되어 있어 이 클래스의 리뷰에서 보기 드물게 견고하다. 남은 갭은 세 갈래다: (1) 이 PR 이 신설한 `POST /api/users/me/avatar` 자체의 e2e(HTTP·실 MinIO·multer 413) 커버리지가 없고, 심지어 e2e 인프라(compose `createbuckets`)조차 아직 공개 GET 정책을 갖추지 않아 "공개 URL 이 실제로 열리는가" 는 이번 PR 로는 어디서도 실증되지 않는다 — 자매 엔드포인트(`change-password`/`email-change`)의 e2e-spec 선례와 대비된다. (2) `users-avatar-swagger-sync.spec.ts` 는 스스로 "Swagger 산문 리터럴 드리프트를 문다" 고 주장하지만 정규식 범위가 좁아 실제로는 세 리터럴 중 하나(`@ApiPayloadTooLargeResponse`)를 완전히 놓치고, 확장자 목록도 첫 occurrence 만 검사한다 — 이 spec 이 주는 보장이 스스로 서술한 것보다 좁다. (3) 나머지는 사소한 테스트 위생(private 필드 리플렉션, 도달 불가능에 가까운 폴백 분기 미검증, 빈 파일 형태 1종 누락) 수준이다.

## 위험도

MEDIUM
