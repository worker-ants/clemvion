# 유지보수성(Maintainability) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `ExpressNS` 리네임 이유를 설명하는 주석이 거의 동일한 내용으로 두 번 반복된다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:53-61` (`import ExpressNS from 'express';` 바로 위)
  - 상세: 53~56줄과 57~61줄 두 블록이 "`Express` 를 default import 하면 전역 `Express` 네임스페이스를 가려 `@types/multer` 의 `Express.Multer.File` 을 쓸 수 없다(실측: `Namespace 'e' has no exported member 'Multer'`)" 는 동일한 근거를 문장만 바꿔 두 번 서술한다. 두 번째 블록이 "다른 컨트롤러 4곳은 `Express` 그대로다 — 전역 컨벤션으로 승격하려면 `spec/conventions/` 문서화가 선행돼야 한다" 라는 추가 정보를 담고 있어 완전한 중복은 아니지만, 앞의 4줄은 순수 반복이다. 편집 이력상 초안을 지우지 않고 다시 쓴 흔적으로 보인다. 이런 중복은 한쪽만 갱신되고 다른 쪽이 stale 로 남는 drift 위험을 만든다(이 PR 자체가 CHANGELOG·주석 등 여러 곳에 같은 근거를 반복해서 적는 스타일이라, 정정이 한 곳만 반영될 가능성이 실재한다).
  - 제안: 두 블록을 하나로 합친다. 예: 첫 블록의 핵심 문장 + 두 번째 블록의 "다른 컨트롤러 4곳은 그대로다 / 전역 컨벤션 승격 조건" 부분만 남기고 나머지는 제거.

- **[INFO]** `UsersService.updateAvatar` 가 검증·업로드·영속화·정리 오케스트레이션을 한 메서드에서 처리해 함수가 길다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar` 메서드 (79~149줄)
  - 상세: 파일 존재/빈 버퍼 검증 → 확장자·Content-Type 화이트리스트 검증(prototype-chain 가드 포함) → 사용자 조회 → S3 업로드 → 컬럼 단위 UPDATE → 재조회+구객체 정리 병렬 실행까지 한 메서드 안에 순차적으로 들어 있다(주석을 뺀 실질 코드는 약 30줄, 문서 주석 포함 71줄). 각 단계가 "왜 이렇게 했는가"를 상세히 설명하는 JSDoc/인라인 주석으로 감싸여 있어 개별 결정은 이해하기 쉽지만, 메서드 하나가 훑어야 할 관심사(입력 검증, 보안 판정, 영속화 전략, 캐시/스토리지 정리)가 4가지로 다소 많다.
  - 제안: 현재도 분기 수가 적고(순차 흐름, 중첩 없음) 즉시 리팩터링이 필요한 수준은 아니다. 다만 향후 이 흐름에 단계가 더 늘어난다면(예: 이미지 리사이즈·바이러스 스캔 추가) `resolveContentType(file)` 같은 순수 함수로 확장자 검증 블록을 분리해 메서드 길이를 관리하는 것을 권장한다.

- **[INFO]** 삼항 표현식 하나에 `&&`/`hasOwnProperty` 조건이 함께 들어가 있어 한눈에 읽기엔 다소 밀도가 높다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar` 내 `const contentType = ext && Object.prototype.hasOwnProperty.call(...) ? ... : undefined;` 블록 (97~105줄)
  - 상세: `ext` truthy 검사 + prototype 소유권 검사를 한 조건식에 묶어 삼항으로 표현한다. 바로 위 주석이 "왜 `hasOwnProperty` 가 필요한가"를 상세히 설명해 의도 파악은 가능하지만, 조건식 자체는 `if`/조기 반환보다 읽는 데 한 박자 더 걸린다.
  - 제안: 필수는 아니지만, `if (!ext || !Object.prototype.hasOwnProperty.call(...)) { throw ... }` 형태의 가드절로 바꾸면 조건과 처리(발생하는 예외)가 더 가까워져 가독성이 소폭 개선된다.

## 그 외 점검 결과 (문제 없음)

- **네이밍**: `S3Service.getPublicUrl`/`upload`/`download`/`delete`/`deleteMany`, `UsersService.updateAvatar`/`deletePreviousAvatarObject`/`avatarKeyPrefix`, `resolvePublicBaseUrl` 등 모두 동사 기반으로 목적을 명확히 드러내고 기존 클래스의 네이밍 컨벤션(`camelCase` 메서드, `SCREAMING_SNAKE_CASE` static 상수 `AVATAR_MAX_BYTES`/`AVATAR_CONTENT_TYPES`)과 일치한다.
- **중첩 깊이**: 신규/변경 함수(`updateAvatar`, `deletePreviousAvatarObject`, `getPublicUrl`, `resolvePublicBaseUrl`, `main.ts` 부팅 가드)는 모두 조건문 중첩이 최대 2단(예: `if (NODE_ENV === 'production') { if (isPrivateHost(...)) {...} }`)을 넘지 않는다.
- **매직 넘버**: `AVATAR_MAX_BYTES = 2 * 1024 * 1024`, `S3Service.DELETE_OBJECTS_MAX_KEYS`(기존) 등 숫자 리터럴은 이름 붙은 상수로 추출돼 있고, 컨트롤러 Swagger 설명에 등장하는 "2MB" 같은 산문 리터럴은 `users-avatar-swagger-sync.spec.ts` 가 상수와의 동기화를 전수 검사한다. 이 테스트의 `MIN_MB_LITERALS`/`MIN_EXT_LISTS` 하한값 자체는 하드코딩이지만 "현재 개수, 줄어들면 커버리지가 준다"는 의도가 주석으로 명시돼 있어 임의의 매직 넘버가 아니다.
- **중복 코드**: 아바타 키 접두 로직(`avatars/{userId}/`)은 `avatarKeyPrefix()` 한 곳에서만 정의되어 생성(`updateAvatar`)과 복원(`deletePreviousAvatarObject`) 양쪽이 공유한다. `publicBaseUrl` 폴백 규칙도 `resolvePublicBaseUrl`(SoT) 하나이며, `S3Service` 생성자의 `?? endpoint` 는 폴백 규칙의 사본이 아니라 부분 mock 조립을 위한 별개의 2차 방어임을 주석이 명확히 구분한다 — 이전 라운드에서 실제로 발생했던 "사본이 갈리는" 결함(주석에 명시)이 이번 코드에서는 재발하지 않았다.
- **코드 복잡도**: 신규 로직 전반이 순차적 분기(early-return/throw 위주)로 구성되어 순환 복잡도가 낮다. 루프는 `getPublicUrl` 의 `key.split('/').map(...)` 단일 map 뿐이다.
- **일관성**: 에러 응답 형태(`{ code, message }`), `@ApiOkWrappedResponse`/`@HttpCode(HttpStatus.OK)` 데코레이터 패턴, provider 로컬 등록 방식(`KnowledgeBaseModule` 과 동일하게 `S3Service` 를 `UsersModule` provider 로 등록) 등이 기존 컨트롤러·모듈 컨벤션을 그대로 따른다. 테스트 파일들의 mock 구성(`getRepositoryToken`, `TestingModule`, 강제-throw stub 패턴)도 인접 스펙 파일과 스타일이 일치한다.

## 요약

변경분은 새 엔드포인트(`POST /api/users/me/avatar`)와 `S3Service` 확장을 중심으로 검증·영속화·정리 로직 각각에 "왜 이렇게 했는가"를 촘촘히 남긴 문서화 스타일이 특징이며, 이는 기존 코드베이스의 관례(예: `changePassword`, `update`)와 일관된다. 실질적인 유지보수성 결함은 크지 않다 — 유일하게 지적할 만한 것은 `users.controller.ts` 의 `ExpressNS` 리네임 근거 주석이 거의 동일한 내용으로 두 번 반복된 점(WARNING)이며, 나머지는 함수 길이·조건식 밀도에 대한 경미한 개선 여지(INFO)에 그친다. 네이밍·중복 방지(단일 SoT: `avatarKeyPrefix`, `resolvePublicBaseUrl`)·낮은 중첩/복잡도·기존 스타일과의 일관성은 모두 양호하다.

## 위험도

LOW
