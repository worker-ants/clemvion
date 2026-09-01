# 테스트(Testing) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 사전 확인

- 관련 신규/변경 유닛 스펙 6개 파일(`s3.config.spec.ts`, `s3.service.spec.ts`,
  `users-avatar.service.spec.ts`, `users.controller.spec.ts`, `users.service.spec.ts`,
  `users-avatar-swagger-sync.spec.ts`)을 실제로 `jest` 로 실행해 확인 — **96/96 GREEN**.
- `UsersService` 생성자에 `S3Service` 의존성이 추가되어 기존 auth 계열 스펙 6개
  (`sessions.service.spec.ts`, `auth.service.spec.ts`, `totp.service.spec.ts`,
  `auth-oauth.service.spec.ts`, `jwt.strategy.spec.ts`, `webauthn.service.spec.ts`)가 영향받을
  가능성을 점검 — 전부 `UsersService` 를 `useValue` mock 으로 대체해 실제 생성자를 타지 않으므로
  DI 파괴(회귀) 없음을 확인.
- 저장소 트리는 건드리지 않았다(`git status --short` 로 확인, 이 세션이 만든 리뷰 산출물
  디렉터리 외 변경 없음).

이번 변경은 이미 6라운드의 자체 리뷰를 거치며 CRITICAL 급 lost-update·정책 우회·vacuous 테스트를
스스로 찾아 고쳐 온 이력이 있고(`users-avatar.service.spec.ts`·`s3.config.spec.ts` 의 docstring에
각 라운드 실측이 남아 있음), 실제로 뮤테이션 실측 근거(예: "가드를 지워도 N건 GREEN")를 테스트
옆에 남겨 다음 사람이 같은 실수를 반복하지 않게 하는 수준까지 도달해 있다. 아래는 그 위에서 남은
갭이다.

## 발견사항

- **[WARNING]** 아바타 업로드의 실제 파일 크기 상한(2MB, 413)이 어떤 테스트에서도 실행되지 않는다 — 문서 텍스트만 대조될 뿐 enforcement 자체는 미검증
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar` 데코레이터의
    `FileInterceptor('file', { limits: { fileSize: UsersService.AVATAR_MAX_BYTES } })` (162행 부근)
  - 상세: 실제로 요청 크기를 제한하는 것은 이 `limits.fileSize` 옵션 하나뿐이다(`UsersService.updateAvatar`
    자체는 크기를 검사하지 않는다 — `!file?.buffer?.length` 로 "있는지" 만 본다). 그런데
    - 신규 `users-avatar-swagger-sync.spec.ts` 는 **Swagger 산문의 "2MB" 문자열**이
      `AVATAR_MAX_BYTES` 와 같은지만 대조한다("전수 열거"로 매우 꼼꼼하지만, 대상이 어디까지나
      *설명 텍스트*다).
    - 유닛 테스트 어디에서도 `FileInterceptor` 에 실제로 `limits: { fileSize: ... }` 가 걸려
      있는지(메타데이터 검사) 확인하지 않는다 — 같은 파일의 `@HttpCode(200)` 은
      `Reflect.getMetadata('__httpCode__', ...)` 로 메타데이터를 직접 고정하는 테스트가 있는데,
      인터셉터 설정에는 대응하는 테스트가 없다.
    - `users-avatar-upload.e2e-spec.ts` 는 400(허용되지 않는 확장자) 케이스는 실측하면서도
      2MB 를 넘는 실제 바이트를 보내 413 을 확인하는 케이스가 없다.
    - 저장소 전체(`grep -rn "413\|PayloadTooLarge\|fileSize"`)를 봐도 이 값을 실제로 초과 전송해
      검증하는 테스트는 한 건도 없다. (참고: `knowledge-base` 모듈의 `FileInterceptor` 도
      동일 패턴 — 이 PR 이 새로 만든 결함이 아니라 기존 관행을 답습한 것이다.)
    - 즉 누군가 실수로 `limits` 옵션을 지우거나 값을 바꿔도 — 예를 들어 상수 리팩터 중
      `UsersService.AVATAR_MAX_BYTES` 참조가 깨져도 — 어떤 테스트도 RED 로 알려주지 않는다.
      이 PR 의 성능 리뷰(`performance.md`)가 "상한이 2MB 로 작아 메모리 버퍼링 위험이 낮다"고
      판단한 근거 자체가, 실측되지 않은 이 enforcement 에 암묵적으로 의존하고 있다.
  - 제안: `users.controller.spec.ts` 에 `Reflect.getMetadata`(NestJS interceptor 메타데이터 키)로
    `limits.fileSize === UsersService.AVATAR_MAX_BYTES` 를 고정하거나, 더 직접적으로는
    `users-avatar-upload.e2e-spec.ts` 에 2MB+1바이트 파일을 보내 413 을 확인하는 케이스를
    추가한다(다른 경계 케이스들과 동일한 스타일 — 이미 이 PR 은 "옛 URL에 쿼리스트링이 붙어도"
    같은 경계값을 적극적으로 문지르는 관례를 갖고 있어 이 갭만 예외적으로 비어 있다).

- **[INFO]** Swagger 동기화 가드의 "MB 리터럴 전수 카운트"가 코드 주석 문구에도 우연히 결합돼 있다
  - 위치: `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts`
    (`MIN_MB_LITERALS = 4`, `it('파일 안의 모든 "NMB" 가 AVATAR_MAX_BYTES 와 같다', ...)`)
  - 상세: `users.controller.ts` 안에서 정규식 `/(\d+)\s*MB/g` 에 매칭되는 "2MB" 문자열은 실제로
    4곳이다 — `@ApiOperation`/`@ApiBody`/`@ApiPayloadTooLargeResponse` 설명(3곳) 외에, `limits`
    옵션 바로 위 **코드 주석**("진짜 드리프트 지점은 아래 Swagger 리터럴("최대 2MB")이고…")도
    포함된다. 지금은 우연히 값이 일치해 통과하지만, 이 주석 문구가 나중에 (값은 안 바뀌고) 다른
    표현으로 다듬어지면 카운트가 3으로 줄어 `toBeGreaterThanOrEqual(4)` 가 실패한다 — 실제
    드리프트와 무관한 이유로 깨지는 false positive 다. 이 테스트 자체의 docstring 이 "접두어를
    요구하지 않고 전수를 모은다"는 설계를 명시하고 있어 의도된 트레이드오프이긴 하나, 그 대가로
    doc-facing 텍스트가 아닌 구현 주석까지 카운트에 얹힌다는 점은 기록해 둘 만하다.
  - 제안: 즉시 조치 불필요(현재 GREEN, 실제 값 드리프트는 여전히 정확히 잡는다). 다음에 이
    주석을 편집하는 사람이 원인 불명의 실패를 마주치지 않도록, 카운트가 코드 주석까지 포함한다는
    점을 테스트 상단 docstring에 한 줄 덧붙이면 좋다.

## 그 외 점검 결과 (양호)

- **엣지 케이스**: 빈 버퍼 vs 파일 부재를 분리한 fixture, 대문자 확장자, 프로토타입 체인
  (`constructor`/`__proto__`) 우회, 쿼리스트링/프래그먼트가 붙은 옛 URL, base 도메인이 바뀐 뒤의
  키 복원, 깨진 퍼센트 인코딩(`%zz`) — 전부 "왜 이 케이스가 필요한가"와 "지우면 몇 건이 GREEN
  으로 남는가"를 docstring 에 실측으로 남겨 두고 있어 회귀 방지력이 높다.
- **Mock 적절성**: `S3Service` mock 은 인터페이스(`upload`/`getPublicUrl`/`delete`) 형태를
  유지하면서 실제 반환값 형태(URL 조립 규칙)까지 반영한다. `users.service.spec.ts` 의 일반
  스위트에는 "호출되면 시끄럽게 죽는" stub 을 얹어 무관한 회귀가 조용히 통과하는 것을 막았다 —
  조용한 no-op mock 보다 나은 선택.
- **테스트 격리**: `s3.config.spec.ts` 의 `process.env` 조작은 `beforeEach`/`afterEach` 로
  save/restore 되고, `resolvePublicBaseUrl`/`shouldWarnPublicBaseIsPrivate` 테스트는 애초에
  전역 상태 대신 명시적 `env` 인자를 넘겨 전역 오염 자체를 피한다. 각 서비스 테스트는 독립된
  `TestingModule` 을 매 케이스(`setup()`)마다 새로 만들어 상태 누수가 없다.
  실행 확인: 96/96 GREEN.
- **회귀 테스트**: `UsersService`/`UsersController` 생성자 시그니처 변경이 다른 모듈의 기존
  스펙을 깨뜨리지 않음을 grep 으로 전수 확인(위 "사전 확인" 참조). `users.service.ts` 의
  `update()` 에 추가된 아바타 정리 로직도 기존 `update()` 테스트가 `avatarUrl` 을 건드리지 않아
  영향받지 않음을 확인.
- **테스트 용이성**: `main.ts` 의 부팅 경고 판정을 `shouldWarnPublicBaseIsPrivate` 순수 함수로
  분리한 것은 "인라인 조합을 `if (false && …)` 로 뮤테이션해도 85건 GREEN" 이라는 실측을 근거로
  한 설계 개선이며, 이 저장소의 기존 관례(`production-guards.spec.ts` 가 `production-guards.ts`
  의 판정 함수를 같은 방식으로 테스트)와 일치한다. `main.ts` 자체를 부팅 통합 테스트로 커버하지
  않는 것도 기존 컨벤션과 일관되므로 이번 PR 만의 갭이 아니다.
- **e2e**: 버킷 정책(익명 GET 200 / 목록 조회 403)처럼 유닛으로는 원천적으로 검증 불가능한
  축을 정확히 짚어 실 MinIO 로 확인하고, "왜 응답 URL 을 그대로 fetch 하지 않는가"까지 설계
  근거를 남겼다. 대칭성 있게 설계됨.
- **OAuth 우회 경로 캐너리**: `resolveUser()` 가 `UsersService.update()` 를 거치지 않고 raw
  QueryBuilder 로 `avatarUrl` 을 쓰는 우회 경로를 소스 캐너리 테스트로 고정하면서, 런타임
  테스트로는 두 분기를 가를 수 없는 이유(OAuth stub 모드가 `profile.avatarUrl` 을 항상 null 로
  고정)까지 문서화했다 — vacuous 테스트를 피하기 위해 접근 방식 자체를 바꾼 좋은 사례.

## 요약

이번 diff 는 이미 6라운드의 자체 리뷰·실측 뮤테이션 검증을 거쳐 lost-update·정책 우회·vacuous
테스트 등 CRITICAL 급 문제를 스스로 찾아 고정해 온 상태이며, 남은 유닛/e2e 테스트(96건 실행
확인 GREEN)는 커버리지·가독성·격리 모든 축에서 평균 이상이다. 유일하게 남은 실질적 갭은 업로드
크기 상한(2MB→413) 이 문서 텍스트로만 검증되고 실제 enforcement(멀터 `limits.fileSize`)는 어떤
테스트도 거치지 않는다는 점이다 — 다른 모듈(`knowledge-base`)도 같은 패턴이라 이 PR 이 새로
만든 결함은 아니지만, 이 PR 이 지향하는 "동작은 하는데 잘못된 채로 동작"을 잡는 관례에 정확히
들어맞는 미검증 지점이라 WARNING 으로 남긴다. 나머지 하나(INFO)는 Swagger 동기화 가드가 코드
주석까지 카운트에 포함하는 사소한 결합이며 즉시 조치는 불필요하다.

## 위험도

LOW
