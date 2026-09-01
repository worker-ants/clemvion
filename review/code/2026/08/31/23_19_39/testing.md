# 테스트(Testing) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 검증 방법

`codebase/backend`에서 관련 스위트(`s3.config.spec.ts`, `s3.service.spec.ts`,
`users-avatar.service.spec.ts`, `users-avatar-swagger-sync.spec.ts`,
`users.controller.spec.ts`, `users.service.spec.ts`)를 실제로 실행해 baseline
GREEN(84 tests passed)을 확인했다. 이어서 두 지점을 실제로 뮤테이션해 회귀 스위트가
그 변경을 잡아내는지 직접 관측했다(원본은 세션 scratch 디렉터리에 `cp` 백업 →
수정 → 테스트 실행 → `cp` 로 원복, `git checkout`/`restore` 미사용). 두 뮤테이션 모두
**전부 GREEN으로 생존**했고, 원복 후 `git status --short`로 두 파일 모두 클린 상태임을
확인했다(레포에 잔여 변경 없음).

## 발견사항

- **[WARNING]** `deletePreviousAvatarObject`의 쿼리스트링/프래그먼트 제거 분기가
  회귀 테스트로 커버되지 않는다 — 뮤테이션 실측(GREEN 생존)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:185`
    (`const cleanKey = key.split(/[?#]/)[0];`)
  - 상세: 이 줄을 `const cleanKey = key;`(스트립 제거)로 뮤테이션하고
    `users-avatar.service.spec.ts`를 실행했더니 **27/27 전부 GREEN**으로
    생존했다(회귀 테스트가 이 분기를 가르지 못함). `previousUrl`은
    `s3Service.getPublicUrl()`이 생성한 값(쿼리스트링 없음)뿐 아니라
    `PATCH /users/me`로 사용자가 직접 넣은 외부 URL도 될 수 있고, `@IsUrl()`은
    쿼리스트링·프래그먼트를 허용한다. `avatars/{userId}/` 마커를 포함하면서
    `?`/`#`가 붙은 값이 들어오면(예: 과거에 올린 URL을 그대로 복사해 쿼리를
    붙여 재-PATCH) 이 스트립이 없을 경우 잘못된 키로 `delete()`를 시도해
    정리가 조용히 실패하고 고아 객체가 남는다 — 이 PR이 반복해서 강조하는
    "동작은 하는데 잘못된 채로 동작" 부류의 실패와 같은 성격이다.
  - 제안: `users-avatar.service.spec.ts`의 "축 3" 그룹에 `previousUrl`이
    `avatars/{userId}/old.png?x=1#frag` 형태일 때 `s3.delete`가
    `avatars/{userId}/old.png`(쿼리·프래그먼트 제거된 키)로 호출되는지
    확인하는 케이스를 1건 추가.

- **[WARNING]** `S3Service` 생성자의 `?? endpoint` 2차 방어 폴백이 0% 커버리지 — 뮤테이션 실측(GREEN 생존)
  - 위치: `codebase/backend/src/common/services/s3.service.ts:40-41`
    (`this.publicBaseUrl = this.configService.get<string>('s3.publicBaseUrl') ?? endpoint;`)
  - 상세: `?? endpoint`를 제거(캐스팅만 남김)하고
    `s3.service.spec.ts` + `modules/users/**`를 실행했더니 **81/81 전부
    GREEN**으로 생존했다. 이 줄 바로 위 주석은 "설정 모듈이 아예 로드되지
    않은 조립(주로 부분 mock 을 쓰는 테스트)에서 `undefined` 가 URL 에
    박히는 것을 막는 2차 방어" 라고 명시적으로 주장하는데, 정작 그 주장을
    검증하는 테스트가 없다 — `s3.service.spec.ts`의 `createService()`는
    항상 `'s3.publicBaseUrl'` 키를 값과 함께 제공하므로(overrides로 지워도
    실제로 `undefined`를 넣는 케이스가 없음) 이 분기가 한 번도 실행되지
    않는다. 이 저장소의 컨벤션("설계 근거는 쓰기 전에 뮤테이션으로 반증해
    보라")과 정확히 같은 유형의 미검증 주장이다. 실무 영향은 작다(주석이
    맞다면 프로덕션 경로에서는 애초에 타지 않는 분기) — 다만 그 "맞다면"이
    테스트로 뒷받침되지 않는다.
  - 제안: `createService({ 's3.publicBaseUrl': undefined as unknown as string })`
    같은 케이스로 `getPublicUrl()`이 `endpoint`로 폴백하고 `undefined/...`
    문자열을 만들지 않는지 1건 추가. 또는 이 줄이 정말 프로덕션에서 죽은
    코드라면 그 사실 자체를 주석에 "테스트되지 않음(의도)"로 명시.

- **[INFO]** `UsersService.update()` PATCH를 통한 아바타 명시적 제거(`avatarUrl: null`) 경로가 이름 붙은 케이스로 없다
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` — `describe('UsersService.update — PATCH 로 아바타를 바꿔도 옛 객체를 정리한다', ...)` 블록 (약 235행 부근)
  - 상세: `build(after: string | null)` 헬퍼가 `null`을 받을 수 있는데도
    실제 호출은 `build('https://gravatar.example/x')`와 `build(OLD)`(동일값)
    뿐이다. 값이 "달라졌다"는 조건(`previousUrl !== updated.avatarUrl`)은
    문자열 변경 케이스로 이미 간접 커버되므로 코드 경로 자체는 뚫려 있지만,
    "사용자가 아바타를 지운다"는 것은 실제 사용자 시나리오이고 지금은
    이름 붙은 단언이 없어 의도 문서화가 약하다.
  - 제안: `build(null)` 케이스를 하나 추가해 "avatarUrl 을 null 로 지우면 옛 객체를 정리한다"를 명시적으로 고정.

- **[INFO]** 대문자/혼합 대소문자 확장자(`me.PNG`) 및 파일명에 점이 여러 개인 경우(`a.b.png`)가 명시적으로 테스트되지 않음
  - 위치: `codebase/backend/src/modules/users/users.service.ts:97` (`ext = file.originalname.split('.').pop()?.toLowerCase()`)
  - 상세: 구현이 `.toLowerCase()`로 자명하게 처리하므로 위험은 낮지만, 이
    PR의 다른 모든 축(프로토타입 체인 등)이 "왜 안전한지"까지 문서화하는
    수준의 엄밀함을 보였던 것과 대비하면 이 축만 비어 있다.
  - 제안: `it.each`로 `'me.PNG'`, `'a.b.PNG'` 케이스를 축 2 그룹에 추가(선택).

- **[INFO]** `UsersController.uploadAvatar` 단위 테스트에 서비스 예외 전파 케이스 없음
  - 위치: `codebase/backend/src/modules/users/users.controller.spec.ts` — `describe('UsersController.uploadAvatar (§6.1)', ...)` 블록
  - 상세: 위임 인자·응답 매핑 2건만 있고, `usersService.updateAvatar`가
    던지는 예외(예: `BadRequestException`)가 컨트롤러를 그대로 통과하는지는
    없다. 순수 위임이라 위험은 낮고, 서비스 레벨에서 이미 촘촘히 커버됨 —
    우선순위 낮음.

## 강점 (특기할 만한 테스트 설계)

- `users.service.spec.ts`의 `S3Service` mock이 조용한 no-op이 아니라
  **호출되면 시끄럽게 throw**하도록 설계됨 — 이 스위트가 S3를 건드리지
  않아야 한다는 불변식을 회귀로 고정한다. 좋은 패턴.
- `users-avatar.service.spec.ts`의 `repo.save`도 호출 시 throw하도록 만들어
  `save()`(lost-update 위험) 대신 `update()`(컬럼 단위)를 쓰는지 강제한다.
- 프로토타입 체인 화이트리스트 테스트가 "7개 중 실제로 뚫리는 건 2개뿐"임을
  스스로 실측·문서화하고 나머지 5개가 vacuous임을 숨기지 않았다 — 이
  저장소의 뮤테이션 커버리지 컨벤션에 정확히 부합.
- `users-avatar-swagger-sync.spec.ts`의 전수열거 정규식을 실제 Node
  스크립트로 독립 재현한 결과, 현재 컨트롤러 소스에서 오탐/미탐 없이
  정확히 의도한 2건(확장자 목록)·4건(MB 리터럴)만 매칭됨을 확인했다.
  하한(`MIN_*`) 단언도 있어 리터럴을 지워 커버리지를 줄이는 편집을 잡는다.
- `s3.config.spec.ts`는 env var를 `beforeEach`/`afterEach`로 정확히
  save/restore해 테스트 격리가 깨끗하다.
- e2e 부재(공개 URL GET 200 왕복)는 침묵 누락이 아니라 plan에 근거·재개
  신호와 함께 명시적으로 유예되어 있다(`spec-sync-user-profile-gaps.md`
  W9) — 이 프로젝트의 유예 컨벤션을 잘 따른다.
- 기존 `UsersService` 소비처(auth 모듈의 6개 spec 파일) 전수 확인 결과 전부
  `useValue` mock을 쓰고 있어, 생성자에 `S3Service`가 추가된 것이 회귀를
  일으키지 않는다(grep으로 `new UsersService(` 직접 호출 0건도 확인).

## 요약

리뷰 2라운드를 거치며 이미 여러 CRITICAL(lost update, URIError 500,
프로토타입 오염, 순서 반전)을 실측 기반으로 잡아 회귀 테스트로 고정한
상태이고, 남은 회귀 스위트는 격리·가독성·mock 설계 모두 이 저장소 컨벤션
수준에 부합한다. 실제로 두 지점을 뮤테이션해 검증한 결과 (1)
`deletePreviousAvatarObject`의 쿼리스트링/프래그먼트 스트립 분기와 (2)
`S3Service` 생성자의 `?? endpoint` 2차 방어 폴백, 이 두 곳은 어떤 테스트도
가르지 못하는 진짜 커버리지 갭이다 — 둘 다 실무 위험도는 낮지만(전자는
좁은 입력 형태에서만, 후자는 코드 주석 스스로 "프로덕션에서는 안 탄다"고
주장하는 분기), 이 프로젝트가 반복적으로 강조하는 "근거는 뮤테이션으로
반증하라" 원칙에는 어긋난다. 나머지는 INFO 수준의 선택적 보강.

## 위험도

LOW
