# 테스트(Testing) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `main.ts` 부팅 시 `S3_PUBLIC_BASE_URL` 사설/loopback 경고의 **배선(wiring)** 이 어떤 테스트로도 커버되지 않는다 — 뮤테이션으로 실측
  - 위치: `codebase/backend/src/main.ts` 의 `bootstrap()` 함수, `if (process.env.NODE_ENV === 'production') { const publicBase = resolvePublicBaseUrl(process.env); if (publicBase && isPrivateHost(publicBase)) { logger.warn(...) } }` 블록 (신규 추가, `NODE_ENV==='production'` 가드 이후)
  - 상세: `resolvePublicBaseUrl`(폴백 규칙)은 `s3.config.spec.ts` 가, `isPrivateHost`(사설 호스트 판정)는 다른 소비 모듈(`http-safety`·`smtp-host-guard`·`llm-preview`·`model-config`)의 스펙이 간접적으로 각각 잘 고정하고 있다. 그러나 **이 둘을 조합해 `NODE_ENV==='production'` 일 때 실제로 `logger.warn` 을 호출하는 `bootstrap()` 안의 배선 자체**는 어떤 유닛/e2e 테스트도 실행하지 않는다. 실측: 조건문을 `if (false && publicBase && isPrivateHost(publicBase))` 로 뮤테이션해 경고를 영구히 죽인 뒤 관련 스펙 6개(`users-avatar-swagger-sync`·`users-avatar.service.spec`·`s3.config.spec`·`s3.service.spec`·`users.controller.spec`·`users.service.spec`)를 실행했으나 **85건 전부 GREEN** 이었다(원복 완료, `git status --short` 로 확인). CHANGELOG 자신이 "신규 env 를 k8s overlay 에 전파하지 않아 base 기본값인 `localhost` 가 프로덕션에 실릴 뻔한 근접사고가 실제로 있었다" 고 적은 바로 그 클래스의 회귀를 이 배선이 막아야 하는데, 정작 이 배선이 깨져도 아무 테스트도 알아채지 못한다. `production-guards.spec.ts` 도 형제 로직인 `ALLOW_PRIVATE_HOST_TARGETS` 경고에 대해 "does NOT throw ... (warn-only policy, **handled in main.ts**)" 라고 명시하며 같은 갭을 이미 알고 있다 — 이 PR 은 그 기존 미검증 패턴을 그대로 따랐다.
  - 제안: `resolvePublicBaseUrl` 을 뽑아낸 것과 같은 방식으로, 이 조합 판정을 `shouldWarnPublicBaseIsPrivate(env): boolean` 같은 순수 함수로 `s3.config.ts`(또는 별도 유틸)에 추출하고 유닛 테스트로 고정할 것. 최소한으로는 `bootstrap()` 소스 문자열에 대한 canary 테스트(이 PR 이 OAuth 우선순위 우회 케이스에 실제로 쓴 패턴, `users-avatar.service.spec.ts` 의 "OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리" 참고)로라도 이 조합이 지워지면 실패하게 고정할 것.

- **[INFO]** `POST /api/users/me/avatar` 의 2MB 크기 상한이 실제로 413 을 내는지 검증하는 런타임 테스트가 없다 — 정적 동기화 테스트만 존재
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` 의 `uploadAvatar` (`FileInterceptor('file', { limits: { fileSize: UsersService.AVATAR_MAX_BYTES } })`), 대조군: `codebase/backend/test/webhook-trigger.e2e-spec.ts` 의 413 경계 테스트(K/L/M/N)
  - 상세: `users-avatar-swagger-sync.spec.ts` 는 Swagger 문구의 "2MB" 리터럴이 `AVATAR_MAX_BYTES` 상수와 갈리지 않는지만 고정한다. 실제로 2MB 를 초과하는 파일을 `POST /api/users/me/avatar` 로 보냈을 때 NestJS 의 예외 필터가 `LIMIT_FILE_SIZE` multer 에러를 표준 에러 봉투(`{error:{code}}`)를 갖춘 413 으로 변환하는지는 유닛에도 e2e(`users-avatar-upload.e2e-spec.ts`)에도 없다. 같은 저장소의 `webhook-trigger.e2e-spec.ts` 는 라우트별 크기 한도마다 실제 413 응답을 e2e 로 검증하는 선례가 있어, 이 엔드포인트만 그 패턴이 비어 있는 것이 눈에 띈다.
  - 제안: `users-avatar-upload.e2e-spec.ts` 에 2MB 초과 페이로드로 413 을 확인하는 케이스 1개 추가를 검토. 최소 비용 대안으로는 컨트롤러 유닛 테스트에서 `FileInterceptor` 옵션 객체의 `limits.fileSize` 값을 직접 리플렉션으로 읽어 상수와 비교(런타임 동작까지는 아니지만 "옵션이 실제로 걸려 있는지"는 고정 가능).

- **[INFO]** `PATCH /users/me` 로 트리거되는 아바타 정리 경로는 e2e 없이 유닛(mock)로만 검증된다 — `POST /me/avatar` 와 비대칭
  - 위치: `codebase/backend/src/modules/users/users.service.ts` 의 `update()` (`'avatarUrl' in data` 분기), 유닛: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` 의 `describe('UsersService.update — PATCH 로 아바타를 바꿔도 옛 객체를 정리한다', ...)`
  - 상세: `POST /me/avatar` 교체 흐름은 `users-avatar-upload.e2e-spec.ts` 가 실 MinIO 로 "새 것은 200, 옛 것은 404" 를 직접 확인하는 반면, `PATCH /users/me` 로 `avatarUrl` 을 바꿔 같은 정리 경로(`deletePreviousAvatarObject`)를 태우는 흐름은 mock 된 `S3Service` 로만 검증된다. 두 경로가 내부적으로 같은 private 메서드를 공유하므로 실제 결함 위험은 낮지만, `'avatarUrl' in data` 판정이 실제 HTTP 요청 바디 → `UpdateMeDto` → `class-transformer`(`CustomValidationPipe`) 변환을 거친 뒤에도 기대대로 동작하는지(즉 클라이언트가 `avatarUrl` 을 아예 보내지 않았을 때 그 키가 정말 부재로 남는지)는 이 PR 범위에서 실측된 적이 없다. (코드 리딩으로는 `plainToInstance` 가 기본 옵션에서 원본에 없는 선택 필드를 채워 넣지 않으므로 안전할 것으로 보이나, 이는 프레임워크 동작에 대한 추론이지 테스트로 고정된 사실은 아니다.)
  - 제안: 필수는 아님 — 기존 `PATCH /users/me` 자체가 이미 전용 e2e 가 없는 상태(이 PR 이전부터)라 이 PR 이 새로 만든 갭이 아니다. 다만 향후 `PATCH /users/me` e2e 를 추가할 일이 있으면 "avatarUrl 생략 시 S3 호출 없음" 케이스를 함께 넣을 것.

## 그 외 점검 결과 (강점 — 문제 없음)

- **`users-avatar.service.spec.ts`**: 이 리뷰 라운드(들)에서 실제로 발견된 CRITICAL/WARNING 마다 — lost update(컬럼 단위 UPDATE), 퍼센트 인코딩 깨진 URL 의 `URIError` 전파, `save()` 오용 방지, 프로토타입 체인 우회, 쿼리스트링/프래그먼트가 섞인 옛 URL 복원, `constructor`/`__proto__` vs `toString` 등 도달 불가능한 나머지 5개를 정직하게 구분한 서술 — 회귀 방지 테스트가 붙어 있고, 각 케이스가 "왜 이 fixture 가 필요한가(분기를 실제로 가르는가)" 를 뮤테이션 실측(예: "27건 전부 GREEN", "81건 전부 GREEN", "33건 전부 GREEN")으로 기록해 두었다. `feedback_mutation_validity_and_discriminating_input` 교훈이 코드에 실제로 반영된 드문 사례.
- **Content-Type 매핑**: `it.each` 로 확장자→MIME 5종 전수 대조(값 하나만 대표로 보지 않음) — png 하나만 보다가 `jpg→image/jpg` 오타가 통과했던 4라운드 실측을 재발 방지로 남겼다.
- **테스트 격리**: `s3.config.spec.ts` 는 `beforeEach`/`afterEach` 로 `process.env` 를 저장·복원해 다른 스펙 파일의 env 오염을 막는다. `s3.service.spec.ts` 는 `jest.mock('@aws-sdk/client-s3', ...)` 모듈 목이라 실제 네트워크 의존이 없고, `createService(overrides)` 헬퍼로 케이스별 독립 인스턴스를 만들어 상태 누수가 없다.
- **`users.service.spec.ts` 의 강제-throw 스텁**: `S3Service` 를 조용한 no-op 대신 호출 시 throw 하는 스텁으로 주입 — "이 스위트가 실수로 S3 를 부르는 회귀가 조용히 통과하는 것"을 막는 설계다(`feedback_vacuous_test_three_shapes` 의 "부정 단언이 참" 패턴을 사전에 차단).
- **`users-avatar-swagger-sync.spec.ts` 의 전수 열거 전략**: 접두어를 요구하던 정규식(`최대 (\d+)MB`)이 실제 문구(`파일 크기 초과 (2MB)`)를 놓쳤던 사고를, 접두어 없는 전역 매칭 + 하한(`MIN_MB_LITERALS`/`MIN_EXT_LISTS`) 카운트로 재발 방지했다. 직접 재현: 이 정규식들을 `users.controller.ts` 전체(임포트 제외)에 대해 node 로 실행해 실제 매치가 의도한 2건(확장자 목록)·4건(MB 리터럴)과 정확히 일치함을 확인했다 — 하한 값이 헐겁지 않다.
- **OAuth 우회 캐너리**: 런타임 assertion 으로는 두 분기(`byEmail.avatarUrl ?? profile.avatarUrl` vs 반대)를 가를 수 없는 이유(stub 모드가 `profile.avatarUrl` 을 항상 `null` 로 고정)를 정확히 진단하고, 대안으로 소스 문자열 캐너리를 선택한 판단이 타당하다.
- **e2e (`users-avatar-upload.e2e-spec.ts`)**: 응답 `avatarUrl` 을 그대로 fetch 하지 않고 컨테이너 망 주소로 재구성하는 이유(브라우저 도달 주소 vs 컨테이너 망 주소 분리)를 명시하고, 실 MinIO 대상으로 익명 GET 200 / 목록 조회 403 두 축을 모두 검증한다 — 이 PR 이 코드 리뷰로는 못 잡는 **인프라 정책** 표면을 정확히 e2e 로 좁혔다.
- **컨트롤러 위임 테스트**: `uploadAvatar` 가 `payload.sub` 를 그대로 서비스에 넘기는지(다른 사용자 id 오용 방지)와 응답 봉투 매핑(`pendingEmail` 미포함)을 검증 — 이 컨트롤러의 다른 6개 엔드포인트와 커버리지 격차를 메웠다.
- **뮤테이션 검증**: `users.service.ts` 의 `resolvePublicBaseUrl`+`isPrivateHost` 조합을 직접 뮤테이션해(조건을 `if (false && ...)` 로 무력화) 6개 관련 스펙 85건이 전부 GREEN 임을 재현했다 — 위 WARNING 의 근거. 원복 후 `git status --short` 로 저장소가 clean 함을 확인했다(스크래치 사본은 저장소 밖 `mktemp -d` 사용, 저장소 안에는 아무것도 남기지 않음).

## 요약

핵심 리스크 축(키 추측 불가능성·Content-Type 파생·삭제 순서·lost update·프로토타입 체인)마다 뮤테이션으로 "이 fixture 가 실제로 분기를 가르는지"를 실측하며 쌓아 올린 회귀 테스트 스위트로, 최근 5라운드 리뷰에서 발견된 CRITICAL/WARNING 이 전부 이름 붙은 테스트로 고정되어 있다. 실질적 갭은 두 곳이다: (1) `main.ts` 부팅 경고의 실제 배선(조건 조합)이 어떤 테스트로도 검증되지 않는다는 것을 뮤테이션으로 확인했다 — CHANGELOG 가 스스로 "근접사고가 있었다" 고 적은 바로 그 회귀 클래스를 지금은 아무 테스트도 못 잡는다(WARNING). (2) 2MB 업로드 상한의 런타임 413 동작과 `PATCH /users/me` 아바타 정리 경로의 e2e 커버리지는 정적/유닛 수준에 머물러 있다(INFO, 낮은 위험). 나머지는 격리·가독성·회귀 방지 모두 이 저장소의 상위권 수준이다.

## 위험도

MEDIUM
