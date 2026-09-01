# 유지보수성(Maintainability) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `Express` 네임스페이스 임포트 별칭이 코드베이스 전역 컨벤션과 어긋난다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:57` (`import ExpressNS from 'express';`)
  - 상세: 이 저장소에서 `import Express from 'express'` 로 default import 해 `Express.Request`/`Express.Response` 타입 네임스페이스로 쓰는 패턴이 이미 최소 4개 파일에 있다(`auth.controller.ts:74`, `sessions.controller.ts:38`, `webauthn.controller.ts:58`, `workflow-assistant.controller.ts:18`). `users.controller.ts` 만 `ExpressNS` 로 다르게 이름 붙였다 — CHANGELOG·인라인 주석에 "전역 `Express` 네임스페이스가 `@types/multer` 의 `Express.Multer.File` 을 가려서" 라는 근거가 잘 남아 있고 그 판단 자체는 타당하지만, 결과적으로 **같은 모듈의 로컬 별칭이 파일마다 달라졌다**(`Express` 4곳 vs `ExpressNS` 1곳). `spec/conventions/` 에도 이 리네임 규칙을 기록한 문서가 없다(확인함 — 관련 convention 문서 없음). 다음 사람이 파일 업로드가 필요한 다른 컨트롤러(`auth.controller.ts` 등)를 고치다 같은 네임스페이스 충돌을 밟으면, 이 파일의 선례를 몰라 `ExpressType`·`ExpressApi` 같은 제3의 이름을 또 만들 위험이 있다 — grep 으로 "같은 걸 가리키는 이름"을 찾기 어려워진다.
  - 제안: 실질적 동작 문제는 아니므로 급하지 않다. 다만 다음 리팩터 시 이 리네임을 `spec/conventions/`(또는 최소 이 파일의 import 주석)에 "Multer 파일 파라미터가 있는 컨트롤러는 `ExpressNS` 를 쓴다" 같은 명시 규칙으로 남겨, 다음 충돌 지점에서 이름이 또 갈리지 않게 한다.

- **[INFO]** `S3Service` 생성자의 `publicBaseUrl` 폴백이 `s3.config.ts` 의 SoT 폴백 규칙을 부분적으로 재현한다
  - 위치: `codebase/backend/src/common/services/s3.service.ts` 생성자, `this.publicBaseUrl = this.configService.get<string>('s3.publicBaseUrl') ?? endpoint;` 줄
  - 상세: architecture 리뷰가 이미 SSOT 위반(WARNING)으로 잡은 지점과 같다. 유지보수성 관점에서 보충하면, 다음 사람이 "이 값이 왜 이렇게 정해지는가"를 온전히 이해하려면 `s3.config.ts` 와 `s3.service.ts` 두 파일을 모두 열어 주석을 대조해야 한다 — 주석은 상세하지만 코드 표현식 자체는 두 곳에 남아 있어, 코드만 훑는 리더는 "폴백이 하나"라는 주석 주장과 실제 두 번째 `?? endpoint` 를 스스로 대조해야 알 수 있다.
  - 제안: architecture 리뷰 제안과 동일 — `?? endpoint` 를 제거해 실제로 단일 SoT 를 강제하거나(non-null assertion), 정말 이중 방어를 유지할 거라면 주석의 "폴백은 config 한 곳" 문구를 "1차: config / 2차: 생성자 방어"로 정정해 코드-주석 드리프트를 없앤다.

- **[INFO]** Swagger 설명 문자열에 "최대 2MB" 매직 리터럴이 3곳 하드코딩되어 있다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar` 의 `@ApiOperation` description, `@ApiBody` 의 `file.description`, `@ApiPayloadTooLargeResponse` description
  - 상세: 실제 상한은 `UsersService.AVATAR_MAX_BYTES`(`2 * 1024 * 1024`) 상수 하나인데, Swagger 산문에는 "2MB" 라는 문자열이 3번 따로 적혀 있어 상수가 바뀌면 세 곳을 손으로 맞춰야 한다. 다만 이 드리프트 위험은 이미 인지되어 `users-avatar-swagger-sync.spec.ts` 가 파일 전체에서 `(\d+)\s*MB` 패턴을 전수 매칭해 상수와 대조하는 회귀 테스트로 고정해 두었다(접두어 매칭이 아니라 전수 열거 방식이라 커버리지가 조용히 줄지도 않는다).
  - 제안: 테스트가 드리프트를 잡아주므로 급한 조치는 아니다. 근본적으로 없애고 싶다면 문자열을 `` `최대 ${UsersService.AVATAR_MAX_BYTES / (1024 * 1024)}MB` `` 템플릿으로 바꾸는 방법도 있다 — 그러면 이 동기화 테스트 자체가 불필요해진다.

- **[INFO]** `users-avatar.service.spec.ts` 의 최상위 `describe` 블록마다 `TestingModule` 조립 보일러플레이트가 거의 동일한 형태로 반복된다
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` — `describe('UsersService.updateAvatar — 정리 실패는 요청을 깨뜨리지 않는다', …)`, `describe('UsersService.update — PATCH 로 아바타를 바꿔도 옛 객체를 정리한다', …)`, `describe('UsersService.updateAvatar — 아바타 외의 컬럼을 건드리지 않는다 (lost update)', …)`, `describe('UsersService.updateAvatar — 확장자 화이트리스트는 프로토타입 체인을 타지 않는다', …)`, `describe('UsersService.updateAvatar — 사용자 부재 응답이 형제 엔드포인트와 같다', …)` (총 5개 블록, 첫 블록의 `setup()` 헬퍼와 별개로 각자 `Test.createTestingModule({ providers: [UsersService, {provide: getRepositoryToken(User), …}, {provide: S3Service, …}] })` 를 새로 작성)
  - 상세: 첫 `describe('UsersService.updateAvatar (§6.1 — 공개 URL 서빙)', …)` 안에 정의된 `setup()` 헬퍼가 그 블록 스코프에 갇혀 있어 나머지 5개 블록이 재사용하지 못하고, 각각 S3Service mock(`upload`/`getPublicUrl`/`delete`)과 repo mock(`findOne`/`update`/`findOneOrFail`/`save`)을 조금씩 다른 모양으로 손으로 다시 만든다(예: 어떤 블록엔 `save: jest.fn(() => { throw … })` 가드가 있고 어떤 블록엔 아예 없음). 각 블록이 특정 리뷰 라운드의 회귀를 독립적으로 문서화하려는 의도는 이해되나, `UsersService` 생성자 의존성이 하나 더 늘면(예: 감사 로그 주입) 5곳을 각각 고쳐야 한다.
  - 제안: 지금 규모(5블록)에서는 시급하지 않다. 파일 최상단에 `makeUsersService(overrides?: {...})` 같은 공용 팩토리를 두고 각 describe 가 필요한 부분만 override 하는 형태로 정리하면, 다음 생성자 의존성 추가 시 한 곳만 고치면 된다.

- **[INFO]** `main.ts` `bootstrap()` 에 구조가 거의 동일한 production 가드 블록이 하나 더 인라인으로 추가되어 함수가 길어진다
  - 위치: `codebase/backend/src/main.ts:160-174` (`if (process.env.NODE_ENV === 'production') { const publicBase = resolvePublicBaseUrl(...); if (publicBase && isPrivateHost(publicBase)) { logger.warn(...) } }`)
  - 상세: 바로 위 `ALLOW_PRIVATE_HOST_TARGETS` 검사(142-151행)와 형태가 동일하다 — `NODE_ENV==='production'` 조건 → 판정 함수 호출 → `logger.warn`. `bootstrap()` 은 이미 `assertProductionConfig`·workspace reflection canary·body parser 설정 등 여러 책임을 순차 나열하는 긴 함수인데, 유사 형태의 production 경고가 이번에 세 번째로 인라인됐다. 개별 블록은 각각 잘 주석돼 있어 지금 당장 읽기 어렵지는 않다.
  - 제안: production 가드가 하나 더 늘 경우를 대비해 `runProductionBootWarnings(env, logger)` 같은 헬퍼로 묶어 `bootstrap()` 자체는 "가드 실행" 한 줄로 유지하는 리팩터를 고려할 만하다. 지금 시점에 강제할 정도는 아니다.

## 그 외 점검 결과 (문제 없음)

- **가독성**: 신규/변경 코드 전반에 "왜"를 설명하는 JSDoc·인라인 주석이 촘촘히 달려 있고, `resolvePublicBaseUrl`·`getPublicUrl`·`updateAvatar`·`deletePreviousAvatarObject` 모두 함수 하나가 하는 일이 이름과 주석만으로 파악 가능하다.
- **네이밍**: `resolvePublicBaseUrl`·`avatarKeyPrefix`·`toProfileData`·`deletePreviousAvatarObject` 등은 목적을 명확히 드러내며, 기존 `AVATAR_MAX_BYTES`/`AVATAR_CONTENT_TYPES` 명명 규칙과도 일관된다. (`ExpressNS` 는 위 WARNING 참고.)
- **함수 길이**: `updateAvatar`(약 35 실행 라인)·`deletePreviousAvatarObject`(약 15 실행 라인) 모두 과도하지 않다. 여러 책임(검증→업로드→저장→정리)이 있지만 각 단계가 주석으로 구획돼 있어 단일 함수가 여러 관심사를 뒤섞어 놓은 느낌은 없다.
- **중첩 깊이**: 3단 이상 중첩된 조건문/반복문이 없다. `updateAvatar` 의 조건문은 모두 얕은 early-return 형태다.
- **매직 넘버**: `AVATAR_MAX_BYTES`·`DELETE_OBJECTS_MAX_KEYS` 등 의미 있는 상수로 명명돼 있다(Swagger 문자열의 "2MB" 3중복은 위 INFO 참고).
- **중복 코드**: `toProfileData()` 추출로 `getMe`/`updateMe`/`uploadAvatar` 세 응답 매핑의 중복을 오히려 제거했다(긍정적 리팩터). `avatarKeyPrefix()` 헬퍼도 생성 측(`updateAvatar`)과 복원 측(`deletePreviousAvatarObject`) 모두가 같은 함수를 호출해 접두 문자열 하드코딩 중복을 막았다.
- **코드 복잡도**: 순환 복잡도가 눈에 띄게 높은 함수는 없다. `updateAvatar` 는 분기 3~4개 수준으로 여전히 낮다.
- **일관성**: `UsersModule` 의 `S3Service` 지역 provider 등록은 `KnowledgeBaseModule` 과 동일한 기존 패턴을 그대로 따르고, 에러 응답 형태(`{code, message}`)·Swagger 데코레이터 사용 패턴도 형제 엔드포인트들과 대체로 일치한다.

## 요약

이번 변경은 전반적으로 유지보수성이 양호하다 — 각 결정("왜 UUID 인가", "왜 컬럼 단위 update 인가", "왜 try 안에서 파싱하는가")에 대한 근거가 코드 인접 주석에 상세히 남아 있고, `toProfileData`/`avatarKeyPrefix` 같은 추출로 기존 중복까지 줄였다. CRITICAL 급 결함은 없다. 다만 네 가지는 다음 유지보수자를 위해 기록해 둘 만하다: (1) `ExpressNS` 리네임이 기술적으로는 타당하지만 코드베이스 전역의 `Express` 별칭 컨벤션과 어긋나 파일마다 다른 이름이 같은 모듈을 가리키게 됐고 이 결정이 컨벤션 문서에 남아 있지 않다, (2) `S3Service` 생성자의 이중 폴백이 "폴백은 config 한 곳"이라는 주석 주장과 코드가 어긋난다(architecture 리뷰와 중복 지적), (3) Swagger 산문의 "2MB" 리터럴 3중복은 회귀 테스트가 이미 방어하고 있어 급하지 않다, (4) 신규 테스트 파일의 `describe` 블록별 모듈 조립 보일러플레이트 반복과 `main.ts` `bootstrap()` 의 점증하는 인라인 production 가드는 지금 규모에서는 문제 없지만 다음 확장 시 헬퍼 추출을 고려할 만하다.

## 위험도

LOW
