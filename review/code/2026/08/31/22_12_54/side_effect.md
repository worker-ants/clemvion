# 부작용(Side Effect) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** 옛 `avatarUrl` 이 malformed percent-encoding 을 담고 있으면 `deletePreviousAvatarObject` 가
  잡히지 않는 `URIError` 를 던져, **이미 성공한 상태 변경(신규 S3 업로드 + DB 저장)이 클라이언트에는
  500 실패로 보고된다.**
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `deletePreviousAvatarObject` (전체
    파일 컨텍스트 게이트 115~137줄). 문제 지점은 게이트 **125**줄 `const key =
    decodeURIComponent(previousUrl.slice(at));` — 이 줄은 게이트 128줄에서 시작하는
    `try { await this.s3Service.delete(cleanKey); } catch (err) { … }` 블록 **밖**에 있다.
  - 상세: `previousUrl` 은 `user.avatarUrl` 이며, 이 값은 이번 PR 이 만드는 `POST /me/avatar` 뿐 아니라
    기존 `PATCH /api/users/me`(`UpdateMeDto.avatarUrl`, `@IsUrl({ require_tld: false })`)로도 임의
    문자열을 넣을 수 있다. `class-validator`/`validator.js` 의 `isURL` 은 percent-encoding 의 유효성을
    검사하지 않는다 — 직접 실측:
    `validator.isURL('https://example.com/avatars/<uuid>/%zz.png', { require_tld: false })` → **true**,
    이어서 `decodeURIComponent('avatars/<uuid>/%zz.png')` → **`URIError: URI malformed`** (둘 다
    `codebase/backend` 워크스페이스에서 `node -e` 로 실측, 저장소 파일은 건드리지 않음).
    사용자가 이런 값을 `PATCH /users/me` 로 자신의 `avatarUrl` 에 먼저 저장해 두면, 이후
    `POST /me/avatar` 로 새 아바타를 올릴 때 —
    1. 새 파일이 S3 에 업로드되고 (`this.s3Service.upload`)
    2. `user.avatarUrl` 이 새 공개 URL 로 **DB 에 저장**되고 (`this.userRepository.save(user)`)
    3. 그 다음 옛(malformed) URL 정리 단계에서 `decodeURIComponent` 가 예외를 던져
       `updateAvatar` → 컨트롤러 → NestJS 전역 예외 필터를 거쳐 **500** 이 응답된다.
    즉 실질 업로드/DB 갱신은 **이미 성공**했는데 호출자는 실패로 관측한다 — 이 PR 자체가 경계하는
    "동작은 하는데 잘못된 채로 동작" 부류의 정반대 형태("동작했는데 실패로 보고")다. 부수 효과로
    옛(malformed) 오브젝트 정리도 건너뛰어 고아 객체가 남는다. 자기 자신에게만 영향을 주고
    (`avatars/{userId}/` prefix 라 남의 URL 을 침범하지 않음) 인증 경계를 넘지는 않으므로 CRITICAL
    까지는 아니지만, 실제로 트리거 가능하고 상태와 응답이 어긋나는 부작용이라 WARNING.
  - 제안: `decodeURIComponent` 호출도 `try` 블록 안으로 옮기거나(가장 단순), `deletePreviousAvatarObject`
    전체를 try/catch 로 감싸 파싱 실패도 "정리 실패" 와 동일하게 삼키고 `warn` 로그만 남기도록 한다.
    이 함수의 실패는 이미 명시적으로 "best-effort — 주 동작을 깨뜨리지 않는다" 는 게 의도이므로
    (`updateAvatar` 상단 docstring), 그 의도를 실제로 지키려면 파싱 예외도 같은 처리를 받아야 한다.

- **[INFO]** `S3Service` 가 `UsersModule` 에도 지역 provider 로 새로 등록돼(`users.module.ts` 게이트
  8·24줄), 기존 `KnowledgeBaseModule`(`knowledge-base.module.ts:21,66`)의 지역 provider 인스턴스와
  별개로 앱 전체에서 **두 번째 독립 `S3Client`**(자체 커넥션 풀)가 생성된다.
  - 위치: `codebase/backend/src/modules/users/users.module.ts:24` (`providers: [UsersService,
    S3Service]`)
  - 상세: 두 모듈 다 `AppModule` 에 무조건 import 되어 있어(`app.module.ts:168,191`) 새로 boot-time
    필수 의존성이 생기는 것은 아니다(KB 모듈이 이미 동일 요건을 걸고 있었다). 두 인스턴스 모두 같은
    전역 `ConfigService` 값(`s3.publicBaseUrl` 등)을 읽으므로 동작 드리프트는 없다 — 다만 프로세스당
    S3 클라이언트/소켓 풀이 하나 더 생기는 리소스 중복이다. 코드 주석이 "KB 모듈과 같은 방식"이라고
    선례를 명시하고 있어 의도된 패턴으로 보인다.
  - 제안: 조치 불요(의도된 선례 패턴). 다만 향후 S3Service 를 공용 모듈의 싱글턴으로 승격할 계획이
    있다면 이 중복이 그 근거가 될 수 있다.

- **[INFO]** `UsersService` 생성자 시그니처 변경(`s3Service: S3Service` 파라미터 추가, `users.service.ts`
  게이트 24~28줄) — 검증 결과 이 클래스는 저장소 전체에서 Nest DI 로만 인스턴스화되고
  (`new UsersService(...)` 호출부 0건, grep 확인) 기존 `users.service.spec.ts` 와 신규
  `users-avatar.service.spec.ts` 양쪽 모두 새 의존성을 제공하도록 갱신돼 있다. 특히
  `users.service.spec.ts` 는 "조용한 no-op 스텁을 주면 S3 호출 회귀가 통과해 버린다"는 이유로 호출 시
  **예외를 던지는** stub 을 명시적으로 채택했다(게이트 46~59줄) — 의도적으로 좋은 설계다. 호출자 영향
  없음.

- **[INFO]** `users.controller.ts` 의 `import Express from 'express'` → `import ExpressModule from
  'express'` 개명은 이 파일 로컬 스코프에 한정된다. 저장소 grep 으로 확인: `auth.controller.ts` ·
  `sessions.controller.ts` · `webauthn.controller.ts` · `workflow-assistant.controller.ts` 는 여전히
  `import Express from 'express'` + `Express.Request`/`Express.Response` 를 그대로 쓰고 있어 충돌·전파
  없음. 이번 파일 안의 두 기존 사용처(`changePassword`, `verifyEmailChange` 의 `req`/`res` 타입, 게이트
  213~214·300~301줄)는 같은 diff 에서 `ExpressModule.Request`/`ExpressModule.Response` 로 동반
  갱신됐다 — 타입 레벨 변경일 뿐 런타임 동작 변화 없음. 다른 컨트롤러와의 명명 비일관성은 남지만
  side-effect 는 아니다.

- **[INFO]** 컨트롤러 주석(`users.controller.ts` 게이트 143~145줄)이 "`UsersService.AVATAR_MAX_BYTES`
  와 같은 값이어야 한다 … 회귀 테스트가 두 값의 동일성을 고정한다" 고 적지만, 실제로는 `limits: {
  fileSize: UsersService.AVATAR_MAX_BYTES }` 로 **같은 상수를 직접 참조**하므로(게이트 146줄) 애초에
  "두 값"이 아니라 값이 하나이고 구조적으로 갈릴 수 없다. `AVATAR_MAX_BYTES` grep 결과 별도의 동일성
  단언 테스트는 실제로 존재하지 않는다. 기능상 위험은 없으나(참조가 갈릴 수 없어 회귀 자체가
  불가능) 주석이 보호 기제를 과장하고 있다.

## 요약

핵심 부작용 하나가 확인됐다 — 옛 `avatarUrl` 이 `PATCH /users/me` 의 느슨한 `@IsUrl` 검증(percent-encoding
유효성 미검사)을 통과한 malformed 값일 때, `deletePreviousAvatarObject` 의 `decodeURIComponent` 가 try
블록 밖에서 예외를 던져 **이미 성공한 S3 업로드 + DB 갱신이 클라이언트에는 500 으로 보고**된다(직접
`node -e` 실측으로 재현 확인, 저장소는 변경하지 않음·`git status --short` 클린 확인). 영향 범위는
자기 자신의 계정에 한정되고 인증 경계를 넘지 않아 WARNING 등급이 적절하다. 그 외 신규 `S3Service`
provider 중복·`UsersService` 생성자 시그니처 확장·`Express` 로컬 import 개명은 모두 grep 으로 호출자
영향을 실측 확인했고 실질적인 부작용 위험은 없다(설계·선례가 뒷받침하거나 스코프가 파일 내부로
닫혀 있음).

## 위험도

MEDIUM
