# 유지보수성(Maintainability) 코드 리뷰 — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** S3 키 접두 `avatars/{userId}/` 리터럴이 두 메서드에 독립적으로 하드코딩되어 있어 드리프트에 취약하다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:97` (키 생성, `updateAvatar`), `codebase/backend/src/modules/users/users.service.ts:125` (키 복원 마커, `deletePreviousAvatarObject`)
  - 상세: `updateAvatar` 는 `` `avatars/${userId}/${randomUUID()}.${ext}` `` 로 키를 만들고, `deletePreviousAvatarObject` 는 옛 URL 에서 키를 복원하기 위해 같은 접두 `` `avatars/${userId}/` `` 를 다시 문자열로 만들어 `indexOf` 앵커로 쓴다. 두 리터럴은 공유 상수/헬퍼가 아니라 각자 타이핑된 템플릿 리터럴이다. 앞으로 키 레이아웃이 바뀌면(예: 버전 세그먼트 추가, 접두사 변경) 한쪽만 고치고 다른 쪽을 놓치기 쉽고, 그 실패는 조용히 "옛 객체를 못 찾아 고아로 남긴다"는 형태로만 드러난다 — 정확히 이 PR 의 테스트 스위트가 경계하는 "동작은 하는데 잘못된 채로 동작"하는 종류의 결함이다.
  - 제안: `private avatarKeyPrefix(userId: string): string { return \`avatars/${userId}/\`; }` 같은 단일 헬퍼로 추출해 두 곳에서 재사용한다. 접두 변경 시 한 곳만 고치면 되고, 컴파일 타임에 두 메서드가 여전히 같은 소스를 참조함이 보장된다.

- **[WARNING]** Swagger 산문 리터럴 "2MB" 가 컨트롤러에 3곳에 중복되어 있으나, 동기화 가드 테스트는 그중 일부만 실제로 검증한다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:162` (`@ApiOperation` description), `codebase/backend/src/modules/users/users.controller.ts:175` (`@ApiBody` schema description), `codebase/backend/src/modules/users/users.controller.ts:185` (`@ApiPayloadTooLargeResponse` description) / 가드 테스트: `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts`
  - 상세: `users-avatar-swagger-sync.spec.ts` 의 두 단언을 실제로 추적하면 커버리지에 구멍이 있다.
    1. `source.matchAll(/최대 (\d+)MB/g)` 는 "최대 NMB" 패턴만 잡는다. `users.controller.ts:185` 의 `'파일 크기 초과 (2MB)'` 는 "최대" 접두가 없어 이 정규식에 매칭되지 않는다 — 즉 이 리터럴의 숫자 드리프트는 가드가 잡지 못한다.
    2. 확장자 목록 검사는 `source.match(/\(최대 \d+MB, ([a-z/]+)\)/)` 로 **global 플래그 없이** 첫 매치만 취한다. `:162`(`@ApiOperation`)과 `:175`(`@ApiBody`) 둘 다 이 패턴에 매칭되는데, 파일에서 더 앞에 나오는 `:162` 만 검증되고 `:175` 의 확장자 목록이 독립적으로 갈려도(예: `gif` 를 빠뜨려도) 테스트는 계속 통과한다.
    이 파일의 주석("진짜 드리프트 지점은 아래 Swagger 리터럴('최대 2MB')이고, 그건 아래 테스트가 문다" — `users.controller.ts:155`)은 실제 커버리지보다 넓게 약속하고 있어, 다음 사람이 "이미 가드가 있다"고 오판하기 쉽다.
  - 제안: 첫 테스트의 정규식을 "최대 …MB" 뿐 아니라 괄호 안의 "…MB" 전반을 잡도록 넓히거나(`/\((?:최대\s*)?(\d+)MB/g` 등), 두 번째 테스트를 `matchAll` 로 바꿔 발견된 모든 확장자 목록이 전부 `allowed` 와 일치하는지 확인한다. 최소한 현재 커버리지의 한계를 테스트 상단 주석에 명시해 "이 가드가 3곳 전부를 보지 않는다"를 남겨야 다음 사람이 안전하다고 오판하지 않는다.

- **[INFO]** `UsersService.update()` 의 `previousUrl` 계산이 async 호출을 품은 중첩 삼항연산자로 되어 있어 가독성이 떨어진다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:186-190`
  - 상세: `'avatarUrl' in data ? ((await this.userRepository.findOne(...))?.avatarUrl ?? null) : null;` 한 식 안에 `in` 연산자, 조건부 `await`, optional chaining, nullish coalescing 이 모두 섞여 있다. 로직 자체(§6.2 JSDoc 이 설명하는 "필드가 있을 때만 조회")는 타당하지만, 표현식 하나로 압축한 탓에 한눈에 분기를 읽기 어렵다. 이 메서드는 호출부가 17곳이라(JSDoc 자평) 향후 다른 개발자가 자주 열어보게 될 지점이다.
  - 제안: 일반 `if` 블록으로 풀어쓴다.
    ```ts
    let previousUrl: string | null = null;
    if ('avatarUrl' in data) {
      const existing = await this.userRepository.findOne({ where: { id } });
      previousUrl = existing?.avatarUrl ?? null;
    }
    ```
    동작은 동일하지만 조회 여부 분기와 값 추출이 시각적으로 분리되어 다음 사람이 더 빨리 읽는다.

- **[INFO]** `Express` → `ExpressNS` 리네이밍이 다소 이례적인 이름 규칙이지만 인접 주석으로 잘 설명되어 있다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:52-57` (import), `codebase/backend/src/modules/users/users.controller.ts:214-215`, `:301-302` (사용처)
  - 상세: `import ExpressNS from 'express';` 는 전역 `Express` 네임스페이스 shadowing 을 피하기 위한 의도된 수정이고 근거(실측 에러 메시지)까지 주석에 남아 있어 판단은 합리적이다. 다만 `NS` 접미사는 이 저장소의 다른 곳에서 반복 사용되는 네이밍 패턴인지 확인되지 않았고(교차 검증 범위 밖), 향후 유사한 shadowing 이 다른 모듈에서도 발생하면 각기 다른 이름(`ExpressTypes`, `ExpressNS`, `ExpressNamespace` 등)으로 흩어질 위험이 있다.
  - 제안: 이런 shadowing 회피가 재발할 가능성이 있다면 `spec/conventions/` 또는 코드 주석에 표준 별칭(예: 항상 `ExpressNS`)을 명시해 다음 사람이 같은 이름을 재사용하도록 유도한다. 현재 PR 범위에서는 조치 불요, 참고용 INFO.

## 긍정적으로 짚을 점 (참고)

- `UsersController.toProfileData()` 추출(`users.controller.ts:84-93`)은 `getMe`/`updateMe`/`uploadAvatar` 세 엔드포인트에 중복되어 있던 프로필 응답 매핑을 한 곳으로 모아 향후 필드 추가 시의 드리프트를 원천 차단한다 — 이번 PR 이 만든 가장 눈에 띄는 유지보수성 개선이다.
- `users-avatar.service.spec.ts` 는 "조용히 실패할 수 있는 축"이라는 명시적 기준으로 테스트를 3개 축(키 추측 불가능성/Content-Type/정리)으로 조직하고 각 `describe` 상단에 그 축이 왜 필요한지 근거를 남겨, 향후 회귀 원인 추적 시간을 줄여준다.
- `s3.config.ts`/`s3.service.ts` 의 `publicBaseUrl` 2단 폴백(`config.ts` 가 env 폴백, `service.ts` 가 config 폴백만) 은 얼핏 중복으로 보이지만 `s3.service.ts:32-33` 주석이 "여기서 다시 폴백하면 규칙이 두 곳이 된다"고 명시적으로 경계를 그어두어 실제로는 의도된 단일 책임 분리다 — 문제 없음.

## 요약

이번 변경은 아바타 업로드라는 새 기능을 도입하면서도 각 설계 결정(공개 URL 접근 통제, Content-Type 화이트리스트, 정리 순서, base URL 3단 폴백)의 "왜"를 JSDoc/주석에 촘촘히 남겨 전반적으로 가독성과 향후 유지보수 편의성이 높다. `toProfileData` 추출과 3축 회귀 테스트 조직은 특히 모범적이다. 다만 두 지점에서 "가드가 있다고 믿게 만드는데 실제로는 구멍이 있는" 패턴이 발견됐다 — S3 키 접두 리터럴의 이중 하드코딩(공유 헬퍼 부재)과 Swagger "2MB"/확장자 리터럴 동기화 테스트의 부분 커버리지(정규식이 전역이 아니거나 패턴이 좁음)다. 둘 다 지금 당장 버그는 아니지만, "테스트가 지켜준다"는 안도감이 실제 커버리지보다 넓어서 다음 사람의 판단을 오도할 수 있다는 점에서 WARNING 으로 분류했다. `update()` 메서드의 압축된 삼항연산자는 순수 가독성 이슈로 INFO.

## 위험도

LOW
