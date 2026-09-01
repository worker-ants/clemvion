# 테스트(Testing) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `S3Service.getPublicUrl`(신규 메서드)의 실제 구현이 어떤 테스트에서도 실행되지 않는다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts:80-89` (`getPublicUrl`)
  - 상세: `codebase/backend/src/common/services/s3.service.spec.ts` 는 이번 PR 에서 **수정되지 않았고**, 여전히 `deleteMany` 청크 경계만 다룬다(직접 확인함). 반면 `users-avatar.service.spec.ts` 는 `S3Service` 전체를 `jest.fn()` 으로 mock 하며 `getPublicUrl: jest.fn((key) => \`https://cdn.example/bucket/${key}\`)` 처럼 **실제 로직과 다른 단순 문자열 결합**으로 대체한다. 그 결과 트레일링 슬래시 제거(`base.replace(/\/+$/, '')`), 세그먼트별 `encodeURIComponent`(vs 통째로 인코딩 시 `/`→`%2F` 회귀 방지 로직), 버킷 경로 조합(`${base}/${bucket}/${encoded}`) — 이 세 가지 모두 어떤 테스트에서도 한 번도 호출되지 않는다. 소스 코드 주석은 이 인코딩 방식을 "통째로 encodeURIComponent 하면 경로가 깨진다" 는 구체적 회귀를 방지하려는 의도로 설명하지만, 그 회귀를 잡을 테스트가 없다.
  - 또한 `S3Service` 생성자의 `publicBaseUrl` 폴백(`this.configService.get<string>('s3.publicBaseUrl') ?? endpoint`)과 `s3.config.ts` 의 3단 폴백(`S3_PUBLIC_BASE_URL || S3_ENDPOINT || 'http://localhost:9000'`)도 대응하는 `s3.config.spec.ts` 자체가 존재하지 않아(확인함) 전혀 검증되지 않는다. "폴백 규칙이 두 곳이 되어 갈라진다" 는 것을 코드 주석이 명시적으로 경계하고 있는데, 정작 그 분리된 두 지점(`s3.config.ts`/`s3.service.ts`)의 폴백 우선순위가 실제로 일치하는지 잠그는 테스트가 없다.
  - 제안: `s3.service.spec.ts` 에 `getPublicUrl` 전용 `describe` 를 추가 — base 트레일링 슬래시 유/무, `publicBaseUrl` 미설정 시 `endpoint` 폴백, 키 세그먼트 인코딩(적어도 `/` 보존 확인). `users-avatar.service.spec.ts` 의 mock 은 그대로 두더라도(단위 경계상 타당), 최소 한 통합형 테스트로 실제 `getPublicUrl`→`deletePreviousAvatarObject` 왕복(encode→decode)이 맞물리는지 확인하면 좋다.

- **[WARNING]** `AVATAR_MAX_BYTES` 관련 코드 주석이 존재하지 않는 회귀 테스트를 주장한다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:143-146`
  - 상세: 주석은 *"`UsersService.AVATAR_MAX_BYTES` 와 같은 값이어야 한다 … 회귀 테스트가 두 값의 동일성을 고정한다"* 라고 적고 있다. 그러나 저장소 전체에서 `AVATAR_MAX_BYTES` 를 참조하는 곳은 정의(`users.service.ts:50`)와 이 사용처(`users.controller.ts:146`) 단 두 곳뿐이며(grep 으로 확인), 이를 다루는 테스트는 0건이다. 실제로는 컨트롤러가 상수를 직접 참조하므로 "두 값" 이 구조적으로 항상 같지만(같은 변수), 진짜 리스크는 `@ApiOperation`/`@ApiBody` 의 하드코딩된 설명 문자열("최대 2MB")이 `AVATAR_MAX_BYTES` 값과 별개로 존재한다는 점이다 — 상수가 바뀌어도 이 문자열은 자동으로 갱신되지 않고, 어떤 테스트도 이 드리프트를 잡지 않는다. "문서화된 보장이 실제 구현/테스트보다 넓다" 는 패턴에 해당한다.
  - 제안: 주석에서 "회귀 테스트가 고정한다" 는 문구를 제거하거나, 실제로 `AVATAR_MAX_BYTES` 값과 Swagger 설명 문자열의 "2MB" 표기가 일치함을 확인하는 테스트를 추가한다.

- **[WARNING]** `users.controller.spec.ts` 가 신규 `uploadAvatar` 엔드포인트를 전혀 다루지 않는다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:178-193` (`uploadAvatar`) / `codebase/backend/src/modules/users/users.controller.spec.ts` (이번 PR 에서 미수정 — 확인함)
  - 상세: 이 파일은 `getMe`·`updateMe`·`changePassword`·이메일 변경 4종 등 **기존 모든 엔드포인트가 controller-level 테스트로 커버**돼 있다(응답 매핑, 민감 필드 미노출, 실패 시 부수효과 없음 등). 그런데 신규 `uploadAvatar` 만 대응 테스트가 없고, `providers` 의 `UsersService` mock 에도 `updateAvatar` 가 없다. 컨트롤러가 `payload.sub`/`file` 을 올바르게 `service.updateAvatar` 로 위임하는지, 응답 매핑에서 `pendingEmail` 이 (다른 엔드포인트와 달리) 의도적으로 빠지는지 등은 이번 PR 의 어떤 테스트로도 검증되지 않는다.
  - 참고: 저장소에 `FileInterceptor` 를 쓰는 사례가 하나 더 있다(`knowledge-base.controller.ts`)는데 그쪽은 controller spec 파일 자체가 없다 — 즉 이 gap 이 이 PR 이 만든 새 패턴은 아니다. 다만 이 파일은 다른 6개 엔드포인트가 이미 다 테스트돼 있어 새 엔드포인트의 공백이 상대적으로 두드러진다.
  - 제안: 최소한 "정상 업로드 시 service.updateAvatar 로 위임하고 매핑된 프로필을 반환한다" 1건 정도는 추가할 가치가 있다.

- **[WARNING]** `deletePreviousAvatarObject` 의 `decodeURIComponent` 호출이 try/catch **밖**에 있어 "best-effort" 문서화 의도와 어긋나는 예외 전파 경로가 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:124-136` (`deletePreviousAvatarObject`), 특히 125행 `const key = decodeURIComponent(previousUrl.slice(at));`
  - 상세: try 블록은 `this.s3Service.delete(cleanKey)` 호출만 감싸고, 그 앞의 `decodeURIComponent` 는 감싸지 않는다. `previousUrl` 이 `avatars/{userId}/` 마커는 포함하되 그 뒤에 잘못된 percent-encoding(예: 단독 `%`)을 담고 있으면 `URIError` 가 던져지고 catch 되지 않아 `updateAvatar` 전체가 실패한다 — 이미 DB 저장(`userRepository.save`)은 성공한 뒤이므로, 실제로는 성공한 업데이트에 대해 사용자가 500 을 받는다. 메서드 JSDoc 은 "실패는 삼킨다 … 고아 객체 하나가 사용자 흐름을 깨뜨릴 이유가 없다" 고 명시하는데 이 특정 실패 지점은 그 보장 밖에 있다.
  - 도달 가능성: `avatarUrl` 은 `PATCH /users/me` 의 `UpdateMeDto`(`@IsUrl({ require_tld: false })` 만 검증, percent-encoding 유효성은 검증하지 않음)로 사용자가 임의 문자열을 넣을 수 있어, 자기 자신의 `userId` 접두를 포함한 문자열을 직접 구성하면 이론상 도달 가능한 자기-자신 대상 경로다(피해는 자기 계정 국한).
  - 제안: `decodeURIComponent` 를 try 블록 안으로 옮기거나 별도로 감싸고, 잘못된 percent-encoding 을 가진 `previousUrl` 에 대한 회귀 테스트를 `users-avatar.service.spec.ts` 축3 에 추가한다.

- **[INFO]** `updateAvatar` 의 `NotFoundException`(`USER_NOT_FOUND`) 분기가 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:89` / `codebase/backend/src/modules/users/users-avatar.service.spec.ts` (해당 케이스 부재)
  - 상세: `setup(existing: User | null)` 시그니처는 `null` 을 받을 수 있지만, 실제 호출은 전부 `setup(buildUser(...))` 형태로 항상 유효한 사용자를 반환한다. `findOne` 이 `null` 을 반환해 `updateAvatar` 가 사용자를 못 찾는 경로는 이 스위트에서 한 번도 exercise 되지 않는다.

- **[INFO]** `s3.upload` 실패 시 DB/정리 로직이 실행되지 않음을 명시적으로 고정한 테스트가 없다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:93` (`await this.s3Service.upload(...)`)
  - 상세: 코드 흐름상 업로드 실패는 자연히 전파되어 이후 `userRepository.save`/`deletePreviousAvatarObject` 가 실행되지 않지만, 이를 단언하는 축이 없다. 다른 축들(순서 반전 방지 등)과 같은 엄격도로 "업로드 실패 시 DB 를 건드리지 않는다" 를 캐너리로 고정해 두면 향후 리팩터가 순서를 흔들 때 더 빨리 잡을 수 있다.

- **[INFO]** 확장자/빈 파일 거부 테스트가 예외 타입만 검증하고 `code`(`INVALID_FILE_TYPE`) 값은 검증하지 않는다.
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:105-119` (`.rejects.toBeInstanceOf(BadRequestException)`)
  - 상세: "빈 파일" 과 "허용되지 않는 확장자" 두 분기가 동일한 `code: 'INVALID_FILE_TYPE'` 을 쓰는데(`users.service.ts:72`, `:83`), 테스트는 `BadRequestException` 인스턴스 여부만 확인해 `code`/`message` 값이 바뀌거나 두 분기가 서로 다른 code 로 갈리는 회귀를 잡지 못한다. 이 저장소는 에러 코드 안정성을 중요하게 다루는 컨벤션(`spec/conventions/error-codes.md`)이 있으므로, 적어도 `code` 값 단언을 추가할 가치가 있다.

- **[INFO]** e2e 커버리지 부재.
  - 위치: `codebase/backend/test/` (avatar 관련 e2e spec 부재 — `users-change-password.e2e-spec.ts`·`users-email-change.e2e-spec.ts` 는 존재)
  - 상세: 이번 PR 은 저장소에서 두 번째로 `FileInterceptor`/multer 를 쓰는 경로이자 `Express.Multer.File` 을 다루는 첫 케이스다(`users.controller.ts` 상단 주석이 그 사실을 직접 언급). 단위 테스트는 `S3Service` 를 전부 mock 하므로, multipart 파싱·`FileInterceptor` 배선·multer `limits.fileSize` 의 실제 413 동작·`JwtAuthGuard` 와의 상호작용 같은 NestJS 파이프라인 자체의 회귀는 어떤 테스트로도 잡히지 않는다. 다만 기존 `knowledge-base.controller.ts` 의 `FileInterceptor` 경로도 e2e·controller spec 이 전무해, 이 gap 이 이 PR 고유의 새 패턴은 아니라는 점은 밝혀둔다.

## 요약

핵심 보안 축(공개 버킷에서 키 추측 불가능성 · Content-Type 화이트리스트 · 옛 객체 정리 순서)을 겨냥한 `users-avatar.service.spec.ts` 13건은 "조용히 실패할 수 있는" 시나리오를 정확히 겨냥해 설계됐고 각 테스트가 왜 존재하는지 주석으로 명확히 설명해 가독성·의도 전달이 우수하다. 기존 `users.service.spec.ts` 도 새로 늘어난 `S3Service` 의존을 시끄러운 throwing stub 으로 방어해 조용한 회귀를 막는 좋은 패턴을 따랐다. 다만 커버리지가 `UsersService.updateAvatar` 한 계층에만 집중돼 있고, 그 아래 계층(`S3Service.getPublicUrl`·`s3.config.ts` 폴백)과 위 계층(`UsersController.uploadAvatar`, e2e 배선)은 이 PR 에서 손대지 않은 기존 spec 파일에 가려 실질적으로 무검증 상태다. 특히 `AVATAR_MAX_BYTES` 관련 "회귀 테스트가 고정한다" 는 코드 주석은 실제로 존재하지 않는 테스트를 가리키는 부정확한 서술이며, `deletePreviousAvatarObject` 의 `decodeURIComponent` 가 try/catch 밖에 있어 문서화된 best-effort 보장이 특정 입력(마커는 매치하되 percent-encoding 이 깨진 URL)에서 깨지는 좁지만 실재하는 엣지 케이스가 무테스트 상태다. CRITICAL 급 결함은 없다.

## 위험도

MEDIUM
