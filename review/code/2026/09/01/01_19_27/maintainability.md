# 유지보수성(Maintainability) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `Express` → `ExpressNS` 리네임이 이 파일 한 곳에만 적용돼, 동일한 `import ... from 'express'` 가 코드베이스 안에서 두 가지 이름으로 공존하게 됐다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:60` (`import ExpressNS from 'express';`)
  - 상세: `@types/multer` 가 전역 `Express` 네임스페이스를 augment 하는 것과 충돌해 이름을 바꾼 이유는 명확하고 주석(53~59행)에도 잘 설명돼 있다. 다만 같은 패턴(`import Express from 'express'`)이 `auth.controller.ts`, `sessions.controller.ts`, `webauthn/webauthn.controller.ts`, `workflow-assistant.controller.ts` 4곳에 그대로 남아 있어(확인: `grep -rn "import Express from 'express'" codebase/backend/src`), 앞으로 이 5개 파일 중 어디를 보느냐에 따라 같은 import 를 `Express`/`ExpressNS` 두 이름 중 하나로 기억해야 한다. `Express.Request`/`ExpressNS.Request` 를 검색으로 찾을 때도 한쪽만 걸린다.
  - 제안: 지금 당장 5곳을 통일할 필요는 없다(주석이 "전역 컨벤션으로 승격하려면 `spec/conventions/` 문서화가 선행돼야 한다"고 이미 명시). 다만 이런 부분적 리네임이 반복되면 이름 자체가 파일마다 달라지는 문제가 누적되므로, 다음에 Multer 타입을 쓰는 컨트롤러가 하나 더 생기면 그때는 5곳 전체를 한 번에 통일하는 편이 좋다.

- **[INFO]** `UsersService.updateAvatar` 한 메서드가 파일 존재 검증 → 확장자/Content-Type 판정 → 사용자 조회 → S3 업로드 → DB 갱신 → 병렬 재조회/정리까지 6단계를 순차로 오케스트레이션한다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:86-156` (`UsersService.updateAvatar`)
  - 상세: 실제 실행 코드는 약 30줄이고 나머지는 각 단계의 "왜"를 설명하는 주석이라 각 단계 자체는 이해하기 쉽지만, 메서드 하나가 입력 검증(2종)과 부수효과가 있는 I/O(업로드 1회·DB 갱신 1회·병렬 재조회+정리)를 모두 담당해 함수 하나의 책임 범위가 넓다. `architecture.md`(이전 라운드)가 클래스 레벨 SRP 누적을 이미 지적했는데, 이는 그와 별개로 이 메서드 자체의 가독성 관점 — 파일 검증/타입 판정 부분(90-118행)만 별도 헬퍼로 분리하면 `updateAvatar` 본문이 "검증된 contentType 을 받아 업로드-저장-정리한다"는 한 흐름으로 더 짧게 읽힌다.
  - 제안: 지금 길이·복잡도가 문제를 일으킬 정도는 아니라 강제 리팩터는 불필요. 다음에 이 메서드가 더 커지면(예: 이미지 리사이즈 추가 등) `resolveAvatarContentType(file)` 같은 private 헬퍼로 검증 부분을 먼저 분리하는 게 좋다.

- **[INFO]** `users-avatar.service.spec.ts` 안에서 `{ upload: jest.fn(...), getPublicUrl: jest.fn(...), delete: jest.fn(...) }` 형태의 `S3Service` mock 객체 리터럴이 파일 전체에서 6회 이상 거의 동일하게 반복된다
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:58-64`(`setup` 내부), `:252-256`, `:298-302`, `:356-360`, `:432-436`, `:470-476` — 각 `describe` 블록이 자체적으로 같은 3-메서드 mock 을 새로 정의한다
  - 상세: 파일 상단에 이미 `setup()` 헬퍼가 있는데도 뒤쪽 4개 `describe` 블록(242행 이후)은 각자 자신만의 `s3`/`repo` mock 을 인라인으로 새로 만든다. 값 자체는 대부분 동일하거나 사소하게만 다르다(`upload`/`getPublicUrl`/`delete` 세 메서드 stub). 파일 전체가 "조용히 실패하는 축을 하나씩 문다"는 명확한 목적으로 잘 구조화돼 있어 지금 당장 읽기 어려운 수준은 아니지만, `S3Service` 인터페이스에 메서드가 하나 더 생기면(예: `head`) 6곳을 각각 찾아 고쳐야 한다.
  - 제안: 파일 상단에 `function makeS3Mock(overrides = {})` 같은 공용 팩토리를 하나 두고 6곳에서 재사용하면 인터페이스 변경 시 갱신 지점이 하나로 줄어든다. 지금 스타일(각 describe 가 독립적으로 자기 mock 을 소유)이 테스트 간 격리를 명확히 보여주는 의도적 선택일 수 있어 필수 조치는 아니다.

## 그 외 점검 결과 (양호)

- **네이밍**: `resolvePublicBaseUrl`·`shouldWarnPublicBaseIsPrivate`·`getPublicUrl`·`deletePreviousAvatarObject`·`avatarKeyPrefix`·`toProfileData` 등 새로 추가된 함수/메서드 이름이 모두 동사+목적어 형태로 역할을 명확히 드러낸다. `AVATAR_MAX_BYTES`·`AVATAR_CONTENT_TYPES`·`LOGIN_LOCK_THRESHOLD`(기존) 같은 상수도 SCREAMING_SNAKE 컨벤션을 그대로 따른다.
- **매직 넘버**: `2 * 1024 * 1024`는 `AVATAR_MAX_BYTES` 상수로 명명돼 있고 컨트롤러가 그 상수를 직접 참조한다(`users.controller.ts:162`). Swagger 설명문의 "2MB" 리터럴은 `users-avatar-swagger-sync.spec.ts`가 전수 대조로 고정해 드리프트를 방지한다.
- **중복 코드**: `getMe`/`updateMe`/`uploadAvatar` 세 엔드포인트의 응답 매핑을 `toProfileData()` 로 통합한 것은 이번 diff 에서 기존 중복(2곳)을 없앤 개선이다(`users.controller.ts:87-96`).
- **함수 길이/중첩**: `s3.config.ts`의 `resolvePublicBaseUrl`(1줄)·`shouldWarnPublicBaseIsPrivate`(3줄), `s3.service.ts`의 `getPublicUrl`(약 9줄)은 모두 짧고 중첩 깊이 1단 이하다. `main.ts`에 추가된 부팅 경고 블록도 단일 `if` 로 얕다.
- **일관성**: `S3_PUBLIC_BASE_URL` 도입이 `.env.example`·`README.md`·`docker-compose.yml`·`docker-compose.e2e.yml`·k8s base/overlay 전체(local/prod/staging)에 누락 없이 전파됐고, 각 파일의 주석 스타일(왜 필요한지·안 하면 어떻게 되는지)이 일관되게 반복된다 — 새 env 변수 도입 시 이 저장소가 취하는 기존 패턴과 부합한다.

## 요약

핵심 로직(`UsersService.updateAvatar`/`deletePreviousAvatarObject`, `S3Service.getPublicUrl`, `s3.config.ts`의 폴백/경고 함수)은 각 단계의 "왜"를 상세한 JSDoc/인라인 주석으로 남겨 다음 유지보수자가 왜 이런 형태인지 재구성할 필요가 없게 잘 작성돼 있고, 짧고 목적이 분명한 순수 함수(`resolvePublicBaseUrl`, `shouldWarnPublicBaseIsPrivate`)로 판정 로직을 분리한 점도 테스트 용이성과 가독성 모두에 긍정적이다. 발견된 이슈는 전부 INFO 수준이다 — (1) `Express`→`ExpressNS` 리네임이 5개 컨트롤러 중 1곳에만 적용돼 이름이 파일마다 갈리는 점, (2) `updateAvatar` 한 메서드가 검증과 I/O 오케스트레이션을 모두 담당해 함수 하나의 책임이 다소 넓은 점, (3) 테스트 파일 하나(`users-avatar.service.spec.ts`) 안에서 동일한 S3 mock 객체가 여러 describe 블록에 걸쳐 반복 정의되는 점이다. 셋 다 기능 결함이 아니고 즉각적인 조치를 요구하지 않는다.

## 위험도

LOW
