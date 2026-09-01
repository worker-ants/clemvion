# 유지보수성(Maintainability) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `UsersService.updateAvatar` 가 검증(파일 존재·확장자 화이트리스트)·S3 업로드·컬럼 단위 DB 갱신·재조회·정리 오케스트레이션까지 한 메서드에서 처리해 70줄에 가깝다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:86-156` (`updateAvatar`)
  - 상세: 함수 자체의 각 단계는 순차적이고 중첩은 얕아(최대 2단, `ext && hasOwnProperty(...) ? ... : undefined` 삼항 정도) 읽기 어렵지는 않다. 다만 "파일 유효성 검증"(90-118행)과 "업로드·저장·정리 오케스트레이션"(120-155행)이라는 두 성격이 한 함수에 섞여 있어, 다음에 검증 규칙이 늘거나(예: 이미지 매직 바이트 검사) 오케스트레이션이 변경되면 함수가 더 길어질 여지가 있다.
  - 제안: 지금 크기에서 강제로 쪼갤 필요는 없다 — `plan/in-progress/spec-sync-user-profile-gaps.md` 의 "조치하지 않음: 검증 로직 private 헬퍼 분리(W5)" 항목이 이미 같은 판단을 내려 두었다(재확인). 다음에 검증 규칙이 하나 더 늘어나는 시점을 재개 신호로 삼는 편이 적절하다.

- **[INFO]** 사용자 부재(`USER_NOT_FOUND`) `NotFoundException` 객체 리터럴이 컨트롤러·서비스 5곳에 독립적으로 반복된다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:110`(`getMe`), `:140`(`updateMe`), `codebase/backend/src/modules/users/users.service.ts:125`(신규 `updateAvatar`), `:277`(`changePassword`, 기존), `:368`(신규 `incrementLoginAttempts`)
  - 상세: `{ code: 'USER_NOT_FOUND', message: 'User not found' }` 리터럴이 5곳에 그대로 복붙되어 있다. 이번 PR 이 그중 2곳(`updateAvatar`, `incrementLoginAttempts`)을 새로 추가하면서 기존 패턴을 그대로 따랐다 — 새로운 스타일 일탈은 아니다. 다만 API 계약 리뷰가 이미 한 번 "같은 코드인데 `message` 가 빠진 경로가 있다"는 드리프트를 지적했던 이력이 있는 값이라(현재는 5곳 모두 일치), 문자열이 하드코딩된 채 5곳에 흩어져 있으면 다음 수정에서 다시 갈릴 표면이 남는다.
  - 제안: 급하지 않음. 다음에 `USER_NOT_FOUND` 문구가 또 갈리는 사고가 나면, `throwUserNotFound()` 같은 작은 팩토리로 묶는 리팩터의 근거로 이 관찰을 참고할 것.

- **[INFO]** `UsersService.update()` 의 `previousUrl` 계산이 `await` 를 품은 중첩 삼항 표현식이라 한눈에 읽히지 않는다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:241-246`
    ```
    const previousUrl =
      'avatarUrl' in data
        ? ((await this.userRepository.findOne({ where: { id } }))?.avatarUrl ??
          null)
        : null;
    ```
  - 상세: 바로 위(227-239행) JSDoc 이 "왜 `'avatarUrl' in data` 로 가두는가" · "왜 값이 바뀐 경우에만인가"를 잘 설명해 두어 의도 파악 자체는 어렵지 않다. 다만 표현식이 `삼항 ? (await(...).optional-chain ?? null) : null` 3단으로 접혀 있어, 다음에 조건을 하나 더 추가해야 하면(예: 다른 필드도 정리 대상이 되는 경우) 이 한 줄에 분기가 더 쌓이기 쉬운 모양이다.
  - 제안: `if ('avatarUrl' in data) { const existing = await this.userRepository.findOne(...); previousUrl = existing?.avatarUrl ?? null; }` 형태의 일반 `if`/변수 할당으로 풀면 조건 분기가 늘어도 읽기가 나빠지지 않는다. 지금 상태로도 차단 사유는 아니다.

- **[INFO]** `users-avatar.service.spec.ts` 에서 `Test.createTestingModule` + `S3Service`(`upload`/`getPublicUrl`/`delete`) mock 보일러플레이트가 파일 안에서 6번 독립적으로 반복된다(536줄)
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:80, 284, 330, 394, 454, 479` (각 `Test.createTestingModule` 호출부)
  - 상세: `setup()`(56-88행)이 첫 `describe` 블록의 반복은 줄였지만, 이후 4개의 별도 `describe` 블록(정리 실패 축·`update()` PATCH 축·lost-update 축·프로토타입 체인 축·사용자 부재 응답 축)이 각자 자체 `TestingModule` 조립 코드를 새로 쓴다. 파일 크기가 커질수록 이 반복이 눈에 띈다.
  - 상세(추적): `plan/in-progress/spec-sync-user-profile-gaps.md` 가 이미 "조치하지 않음: spec 보일러플레이트 팩토리 통합(W6) — 지금 크기에서 읽기가 나빠지지 않는다"로 명시 유예해 둔 항목이라 새로운 지적이 아니라 재확인이다.
  - 제안: 급하지 않음. 다음 `describe` 블록이 추가되는 시점을 재개 신호로 삼을 것.

- **[INFO]** `UsersService.updateAvatar` 의 `if (!user) throw ...` 다중행 분기만 이 파일의 다른 다중행 조건 분기와 달리 중괄호가 없다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:121-127`
    ```
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    ```
  - 상세: 같은 파일의 다른 다중행 조건 분기(`changePassword` 의 276·283·291행 등)는 전부 `{ }` 로 감싸져 있다. 진짜 한 줄 조기 반환(`if (!previousUrl) return;` 류)은 의도적으로 중괄호를 생략한 것으로 보이는 일관된 패턴이라, 121행만 "다중행인데 중괄호 없음"으로 도드라진다. 기능 결함은 아니지만 다음에 이 분기에 문장을 추가하는 사람이 중괄호 없이 이어 붙이면 그 문장이 `if` 밖으로 빠지는 전형적인 실수를 유발할 수 있다.
  - 제안: `if (!user) { throw new NotFoundException({...}); }` 로 감싼다.

## 그 외 확인한 개선점 (문제 없음, 참고용)

- `UsersController.toProfileData()`(`users.controller.ts:82-96`)가 `getMe`·`updateMe`·`uploadAvatar` 세 엔드포인트가 공유하던 프로필 응답 매핑을 한 곳으로 모았다 — 세 엔드포인트가 각자 필드를 나열하던 기존 중복(`id`/`email`/`name`/`avatarUrl`/`locale`/`theme`)을 걷어낸 좋은 리팩터다.
- 매직 넘버는 전부 이름이 붙어 있다 — `AVATAR_MAX_BYTES`, `AVATAR_CONTENT_TYPES`, `LOGIN_LOCK_THRESHOLD`, `LOGIN_LOCK_MINUTES`, `S3Service.DELETE_OBJECTS_MAX_KEYS`. `incrementLoginAttempts` 의 원자 SQL 도 `5`·`10` 을 리터럴로 박지 않고 파라미터 바인딩으로 넘긴다.
- `avatarKeyPrefix()`(`users.service.ts:66-68`) 로 키 접두 문자열을 한 곳에 모아 생성(`updateAvatar`)과 복원(`deletePreviousAvatarObject`)이 같은 문자열을 보게 했다 — 두 곳에 하드코딩했다면 레이아웃 변경 시 한쪽만 고쳐지는 전형적인 드리프트가 났을 자리다.
- `S3Service.getPublicUrl`/`upload`/`delete`/`deleteMany` 각각 단일 책임의 짧은 메서드로 나뉘어 있고, 순환 복잡도가 낮다.
- 이전 라운드(`review/code/2026/08/31/23_46_40/maintainability.md`) 가 지적했던 "`S3_PUBLIC_BASE_URL` 폴백 규칙이 `s3.config.ts`/`s3.service.ts`/`main.ts` 세 곳에 독립 사본으로 흩어져 있다"는 WARNING 은 이번 diff 에서 `resolvePublicBaseUrl`/`shouldWarnPublicBaseIsPrivate` 를 `s3.config.ts` 에서 export 하고 `main.ts` 가 그 함수들을 그대로 호출하는 형태로 정리되어 **해소됐다**(`codebase/backend/src/main.ts:166-172`, `codebase/backend/src/common/config/s3.config.ts:16-35`).
- 이전 라운드가 지적했던 "`updateAvatar` 의 `USER_NOT_FOUND` 응답에 `message` 가 빠져 형제 엔드포인트와 갈린다"는 문제도 현재 코드(`users.service.ts:125-126`)에서 `message: 'User not found'` 가 포함돼 있어 **해소됐다**.
- `ExpressNS` 로의 import 개명(`users.controller.ts:53-60`)은 실측된 컴파일 차단(전역 `Express` 네임스페이스 가림)을 해소하기 위한 것으로, 주석이 "다른 컨트롤러 4곳은 그대로 `Express` 다 — 전역 컨벤션 승격은 별도 문서화 선행"이라고 범위를 명시해 두어 조용한 컨벤션 분기가 아니다.

## 요약

핵심 변경(`S3Service.getPublicUrl`, `UsersService.updateAvatar`/`deletePreviousAvatarObject`, `UsersController.uploadAvatar`)은 가독성·네이밍·매직넘버·중첩 깊이 면에서 전반적으로 양호하고, `toProfileData()`·`avatarKeyPrefix()` 같은 작은 헬퍼로 기존 중복까지 걷어냈다. 이전 라운드가 지적했던 두 항목(`S3_PUBLIC_BASE_URL` 폴백 규칙의 3중 사본, `updateAvatar` 의 `message` 누락)은 이번 diff 에서 실제로 해소된 것을 확인했다. 남은 항목은 전부 INFO 수준이며, 그중 둘(`updateAvatar` 함수 길이·`update()` 의 SRP 확장 방향, spec mock 보일러플레이트 반복)은 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` 에 재개 신호와 함께 명시적으로 유예되어 있어 재확인 수준이고, 나머지(`NotFoundException` 리터럴 5중 반복, `update()` 의 중첩 삼항, `updateAvatar` 의 중괄호 생략 1곳)는 새로 관찰했지만 기능·안전에 영향이 없는 스타일 수준 관찰이라 병합을 막을 사유는 아니다.

## 위험도

LOW
