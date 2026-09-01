# 부작용(Side Effect) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** 로그인 잠금 판정에 **쓰기 클록(DB) ↔ 읽기 클록(앱 서버) 비대칭**이 새로 생겼다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `incrementLoginAttempts`(신설 원자 `UPDATE ... RETURNING`, `locked_until = NOW() + interval`)와 `isLocked`(변경 없음, `if (new Date() > user.lockedUntil)`)
  - 상세: 이 PR 은 `incrementLoginAttempts` 를 `findOneOrFail → save(user)` 에서 원자 `UPDATE` 로 바꾸면서 `lockedUntil` 계산을 앱 서버 시계(`new Date(Date.now() + 10*60*1000)`)에서 **DB 서버 시계**(`NOW() + '10 minutes'::interval`)로 바꿨다. 의도는 CHANGELOG/주석에 명시된 대로 "앱 인스턴스가 여럿이면 `Date.now()` 가 인스턴스마다 갈린다" 는 문제 해결이다. 그런데 그 값을 **읽어서 비교하는** `isLocked()` 는 이 diff 대상이 아니라서 그대로 `new Date()`(앱 서버 시계)를 쓴다. 변경 전에는 쓰기·읽기가 같은 시계(앱 서버)를 썼기 때문에 앱 서버 시계가 틀려도 자기 자신과 비교하므로 잠금 지속시간이 자기 일관적이었다. 변경 후에는 쓰기는 DB 시계, 읽기는 앱 서버 시계를 쓰므로 **두 시계 사이의 드리프트만큼 실제 잠금 지속시간이 늘거나 준다.** NTP 로 잘 동기화된 인프라에서는 보통 무시할 수준이지만, 컨테이너·클라우드 환경에서 DB 와 앱 서버가 다른 호스트/리전에 있으면 초 단위 드리프트가 드물지 않다. 계정 잠금이라는 보안에 민감한 경로에서, 이 PR 이 스스로 만든 새 비대칭이며 CHANGELOG·plan 어디에도 disclose 되어 있지 않다.
  - 제안: `isLocked()` 도 DB 시계로 비교하도록 바꾸거나(예: `SELECT NOW() > locked_until` 같은 DB 측 판정, 혹은 `resetLoginAttempts` 를 조건부 `WHERE locked_until <= NOW()` 원자 UPDATE 로), 최소한 이 비대칭을 주석/CHANGELOG 에 명시해 다음 사람이 "잠금이 왜 몇 초 짧게/길게 걸렸다" 는 보고를 받았을 때 원인을 바로 찾을 수 있게 한다.

- **[INFO]** 공용 `UsersService.update()` 가 이제 조건부로 S3 네트워크 호출(삭제)을 낸다 — 이미 disclose 됐지만 향후 재사용 시 지뢰가 될 수 있다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `update(id, data)` (`'avatarUrl' in data` 분기)
  - 상세: 이 메서드는 주석에 스스로 "호출부는 17곳" 이라고 적을 만큼 범용 partial-update 헬퍼다(`auth.service.ts`·`totp.service.ts`·`webauthn.service.ts` 다수). 이번 diff 로 페이로드에 `avatarUrl` 키가 있으면 사전 `SELECT` 한 번과, 값이 바뀌었으면 `S3Service.delete()`(외부 네트워크 호출)까지 추가로 실행하도록 바뀌었다. 현재는 실제로 `avatarUrl` 을 담아 이 메서드를 호출하는 경로가 `PATCH /users/me`(컨트롤러의 `updateMe`) 하나뿐임을 확인했다(`grep` 전수 — auth/totp/webauthn 쪽 17개 호출부 중 `avatarUrl` 을 넘기는 곳 없음, OAuth 재연동은 `dataSource.getRepository(User).createQueryBuilder().update()` 를 직접 써서 이 메서드를 우회한다). 즉 지금 당장 부작용의 반경은 좁다. 다만 이 함수 시그니처(`update(id, data: Partial<User>)`)만 보면 "S3 를 부를 수 있다" 는 사실이 드러나지 않으므로, 나중에 다른 호출부가 전체 DTO 를 스프레드해 넘기다 우연히 `avatarUrl` 을 포함시키면 그 호출부는 예상 못한 SELECT + 네트워크 삭제를 얻게 된다. 개발자가 이미 JSDoc 으로 이유를 남겨 둔 의식적 설계라 CRITICAL/WARNING 은 아니지만, "부작용" 관점에서는 정확히 이 리뷰가 잡아야 할 패턴이라 기록한다.
  - 제안: 조치 불필요(이미 disclose 됨). 다만 향후 새 호출부를 추가할 때 `avatarUrl` 필드가 딸려 들어가는지 리뷰 체크리스트에 남겨 두면 좋다.

- **[INFO]** `UsersService` 생성자 시그니처 변경(`S3Service` 필수 의존성 추가) — 직접 인스턴스화하는 호출부는 없음을 확인
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (constructor), `codebase/backend/src/modules/users/users.module.ts`
  - 상세: `constructor(userRepository, s3Service)` 로 필수 의존성이 하나 늘었다. `new UsersService(...)` 직접 호출은 저장소 전체에 없고(grep 확인), 모든 소비처가 Nest DI(`UsersModule.providers`) 또는 `Test.createTestingModule` 을 통해서만 만든다. 이 PR 은 `users.service.spec.ts` 에 `S3Service` mock provider 를 추가했고(호출 시 시끄럽게 throw 하는 stub), `UsersModule` 을 실제로 import 하는 다른 스펙도 없음을 확인했다(grep 0건) — 그래서 DI 그래프가 깨지는 곳은 없다. 문제 없음, 검증용으로 기록.

## 그 외 점검 결과 (문제 없음)

- **버킷 정책 스코프**: `scripts/minio/avatars-public-read.json` 은 `Resource: arn:aws:s3:::workflow-storage/avatars/*`, `Action: s3:GetObject` 로 정확히 좁게 스코프돼 있다 — `ListBucket` 을 열지 않고, 버킷 전체가 아니라 `avatars/` 접두만 공개된다. CHANGELOG 가 설명하는 "`mc anonymous set download` 는 `ListBucket` 을 함께 연다" 는 기각 근거와 일치하게, 이 정책은 명시적 `Action` 화이트리스트를 쓴다. 의도한 부작용(공개 GET 허용)이 선언된 범위를 벗어나지 않는다.
- **동시성 lost-update (과거 리뷰 CRITICAL)**: 이 저장소에 함께 커밋된 과거 리뷰 산출물(`review/code/2026/08/31/22_44_14/concurrency.md`)이 `updateAvatar` 의 `save(user)` 전체 저장이 다른 컬럼(로그인 잠금 등)을 되돌리는 lost-update 를 CRITICAL 로 지적했는데, 현재 `users.service.ts` 는 `this.userRepository.update(userId, { avatarUrl })` 컬럼 단위 갱신으로 바뀌어 있다. 그 뒤 반대 방향 경쟁(`incrementLoginAttempts` 의 `save(user)`)도 원자 `UPDATE` 로 교체됐다(커밋 `f24584a35`). 두 방향 모두 partial update 로 정리돼 lost-update 자체는 해소된 상태를 확인했다.
- **멀티파트 파싱 vs 커스텀 `bodyParser: false`**: `main.ts` 는 `NestFactory.create(AppModule, { bodyParser: false })` 로 전역 body parser 를 직접 제어하고 `createGlobalBodyParsers()`(json/urlencoded 추정)만 수동 등록한다. 새 `POST /users/me/avatar` 는 `multipart/form-data` 를 `FileInterceptor`(multer)로 받는데, 이 조합이 처음이 아니다 — `knowledge-base.controller.ts` 가 이미 같은 부트스트랩 설정 아래에서 `FileInterceptor` 를 쓰고 있어 선례가 있다. 새로운 파싱 충돌 위험은 없다.
- **환경변수 읽기**: `S3_PUBLIC_BASE_URL`/`S3_ENDPOINT` 는 `s3.config.ts`(`resolvePublicBaseUrl`)와 `main.ts`(`shouldWarnPublicBaseIsPrivate`, 같은 함수 재사용)가 동일 SoT 로 읽는다. 둘 다 `process.env` 를 읽기만 하고 쓰지 않는다. `isPrivateHost` 는 동기 문자열/IP 판정이며 DNS 조회(`dns.promises`) 를 하지 않으므로 부팅 시 예기치 않은 네트워크 호출도 없다.
- **테스트 격리**: `s3.config.spec.ts` 는 `beforeEach`/`afterEach` 로 `process.env.S3_PUBLIC_BASE_URL`/`S3_ENDPOINT` 를 저장·복원한다 — 전역 env 오염 없음. `users-login-attempts.service.spec.ts`/`users.service.spec.ts` 는 매 테스트마다 독립된 `TestingModule` 을 만들고, 호출되면 안 되는 repo 메서드(`findOne`/`findOneOrFail`/`save`)를 throw 하는 stub 으로 대체해 회귀를 시끄럽게 잡는다 — 공유 상태 오염이나 조용한 통과 위험이 없다.
- **DI 모듈 등록**: `UsersModule.providers` 에 `S3Service` 를 지역 provider 로 추가한 것은 `KnowledgeBaseModule` 과 동일 패턴(선례)이며, `S3Service` 는 `@Global()` 이 아니라 다른 모듈에 영향을 주지 않는다. `ConfigModule.forRoot({ isGlobal: true })` 라 `ConfigService` 주입도 별도 import 없이 해결된다.
- **API/응답 인터페이스**: `getMe`/`updateMe`/`uploadAvatar` 세 엔드포인트가 `toProfileData()` 헬퍼로 통일됐고, 필드 추가·제거 없이 동작만 리팩터링됐다(`pendingEmail` 은 여전히 `getMe` 만 스프레드로 얹는다) — 기존 클라이언트에 대한 응답 shape 변경 없음.

## 요약

이 PR 의 핵심 부작용(공개 버킷 노출)은 사용자가 명시적으로 결정하고 CHANGELOG 에 상세히 disclose 한 **의도된** 부작용이며, 버킷 정책도 `avatars/*` + `GetObject` 로 정확히 스코프돼 있음을 직접 확인했다. 과거 리뷰 라운드가 지적한 두 방향의 lost-update(아바타 저장이 로그인 잠금을 되돌리는 것/그 반대)도 현재 코드에서는 양쪽 다 컬럼 단위 원자 갱신으로 해소돼 있다. 다만 그 해소 과정에서 `incrementLoginAttempts` 의 잠금 시각 계산이 DB 시계로 옮겨간 반면 `isLocked()` 의 비교는 여전히 앱 서버 시계를 써서, 두 시계가 드리프트하면 실제 잠금 지속시간이 미묘하게 달라지는 새 비대칭이 disclose 없이 생겼다(WARNING). 그 외에 범용 `UsersService.update()` 가 조건부로 S3 삭제를 내는 것과 `UsersService` 생성자 시그니처 변경은 실질적 반경이 좁고 이미 문서화돼 있어 INFO 로만 남긴다. 전역 변수 신설, 예기치 않은 파일시스템 쓰기, 공개 API 응답 shape 변경, 의도하지 않은 외부 서비스 호출은 관찰되지 않았다.

## 위험도

MEDIUM
