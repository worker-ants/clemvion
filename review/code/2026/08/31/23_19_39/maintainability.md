# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `UsersService.updateAvatar` 가 검증(파일 존재·확장자 화이트리스트) · 사용자 조회 ·
  S3 업로드 · 컬럼 단위 UPDATE · 재조회 · 옛 오브젝트 정리 위임까지 한 함수 안에서 순차 orchestration 한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:79-147` (`UsersService.updateAvatar`)
  - 상세: 같은 파일에서 이미 `avatarKeyPrefix`(:59-61)·`deletePreviousAvatarObject`(:167-194)를
    별도 메서드로 추출해 재사용성·가독성을 챙긴 전례가 있다. 그런데 `updateAvatar` 본체에 남은
    "파일 존재 검사 → 확장자/Content-Type 판정 → 사용자 조회 → 업로드 → UPDATE" 5단계는 여전히
    한 함수에 섞여 있어, 향후 검증 로직만 재사용하거나 단위 테스트하려면 전체 흐름을 함께 끌고
    가야 한다. 실 코드 라인은 주석을 빼면 25~30줄 정도로 절대 길이가 과한 편은 아니지만, 서로
    다른 책임(입력 검증 / 부수효과 / 영속화 / 정리 위임)이 한 메서드 경계 안에 있다는 점에서
    SRP 관점의 개선 여지가 있다.
  - 제안: 파일·확장자 검증(83-111줄)을 `resolveAvatarUpload(file): { key extension, contentType }`
    같은 private 헬퍼로 분리하면, `updateAvatar` 본체는 "검증 → 업로드 → 영속화 → 정리" 4단계로
    좁아지고 검증 로직만 별도로 단위 테스트할 수 있다.

- **[WARNING]** `users-avatar.service.spec.ts` 안에서 `S3Service` mock(`upload`/`getPublicUrl`/`delete`)과
  `Test.createTestingModule({...}).compile()` 보일러플레이트가 6개 `describe` 블록에서
  텍스트상 거의 동일하게 반복된다. 헬퍼 함수 이름도 `setup`(첫 블록)과 `build`(세 번째 블록)로
  갈려 같은 목적의 함수를 다른 이름으로 부른다.
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts`
    — 최초 헬퍼 `setup()` :47-79, 두 번째 인라인 mock :201-205, 세 번째 헬퍼 `build()` :246-270,
    네 번째 인라인 mock :305-309, 다섯 번째 인라인 mock(it.each 콜백 내부) :381-385,
    여섯 번째 인라인 mock :419-425.
  - 상세: 468줄짜리 파일에서 "S3Service 를 mock 하고 UsersService 를 컴파일한다" 는 동일한
    관심사가 최소 6곳에서 반복 정의된다. `s3.service.spec.ts` 의 `createService(overrides = {})`
    (파일 6, :21-37)처럼 이 파일에도 이미 첫 블록에 `setup(existing)` 패턴이 있는데, 뒤따르는
    5개 블록은 그 패턴을 재사용하지 않고 각자 새로 쓴다. 다음 축이 추가될 때마다 6곳 중 일부만
    고쳐질 위험(예: `s3.getPublicUrl` mock 반환 형태를 바꿀 때 한두 곳만 갱신되고 나머지는 stale)이
    구조적으로 남는다.
  - 제안: `createModule(repoOverrides?, s3Overrides?)` 형태의 단일 팩토리로 통합하고, 각
    `describe` 는 필요한 override 만 넘기도록 정리하면 반복이 줄고 이름도 하나로 통일된다.

- **[INFO]** 확장자 → `Content-Type` 판정이 `&&` 단락 평가와 삼항 연산자가 겹친 밀집된 표현식으로
  작성돼 있어 한눈에 읽기 어렵다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:98-105`
  - 상세: `ext && Object.prototype.hasOwnProperty.call(...) ? ... : undefined` 형태로, `ext` 부재·
    화이트리스트 미포함·`hasOwnProperty` 방어까지 세 가지 조건이 한 표현식에 압축돼 있다. 로직
    자체는 옳고 바로 위 주석(93-96줄)이 "왜" 를 잘 설명하지만, "무엇을" 계산하는지는 표현식을
    한 번 더 분해해야 파악된다.
  - 제안: `private static resolveContentType(ext: string | undefined): string | undefined` 로
    추출하면 `if (!contentType) throw ...` 앞뒤 흐름이 더 선형적으로 읽힌다.

- **[INFO]** `S3Service` 생성자의 `publicBaseUrl` 폴백이 `s3.config.ts` 의 3단 폴백 규칙과
  형태상 중복된다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts:32-41`
  - 상세: 주석(32-39줄)이 "이건 규칙의 사본이 아니라 config 미로드 조립에 대한 2차 방어" 라고
    명시적으로 밝히고 있고, 이전 라운드에서 바로 이 지점이 틀렸던 것을 정정한 이력까지 남겨 두어
    의도는 분명하다. 다만 유지보수 관점에서는 "폴백 규칙" 이라는 동일한 개념이 여전히 두 파일
    (`s3.config.ts` 의 `||` 체인, `s3.service.ts` 의 `?? endpoint`)에 각각 다른 연산자로
    표현돼 있다는 사실 자체는 남는다 — `s3Config` 의 폴백 순서가 4단으로 늘어나는 변경이 오면
    이 방어 줄도 함께 검토 대상인지 판단해야 하는 결합이 존재한다.
  - 제안: 현재 주석 수준의 설명이면 실용적으로 충분하다고 보이나, 추후 `s3.config.ts` 를 고칠 때
    이 방어 줄을 리마인드할 수 있게 `s3.config.ts` 쪽에도 "이 값을 참조하는 2차 방어가
    `s3.service.ts` 생성자에 있다" 는 역참조 주석을 붙이는 정도의 대칭 보강을 고려할 수 있다.

- **[INFO]** `users-avatar-swagger-sync.spec.ts` 는 정규식 전수 매칭으로 Swagger 산문과 상수를
  동기화하는데, 정규식 두 개(`/(\d+)\s*MB/g`, `/\b[a-z]{2,5}(?:\/[a-z]{2,5}){2,}\b/g`)의 형태
  자체가 향후 유지보수자에게는 진입장벽이 된다.
  - 위치: `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts` (전체 파일,
    특히 정규식 정의부)
  - 상세: 파일 상단 docstring(7-21줄)이 "왜 접두어 매칭이 아니라 전수 열거인가" 를 상세히 설명해
    설계 의도의 가독성은 이미 잘 확보돼 있다. 다만 확장자 나열 정규식은 "2~5자 소문자 세그먼트가
    `/` 로 2번 이상 이어진 패턴" 이라는 형태 제약을 코드가 아니라 정규식으로만 표현하고 있어,
    새로운 형태의 서술(예: 대문자 확장자, 3자 초과 MIME 서브타입)이 추가되면 이 정규식이 왜
    매칭에 실패하는지 다음 사람이 정규식을 직접 읽어야 알 수 있다.
  - 제안: 현재로선 문서화가 충분해 즉각적인 위험은 낮다. 다만 향후 이 정규식이 깨지는 사고가
    나면, 정규식 옆에 "이 형태 밖의 표현은 감지되지 않는다" 는 명시적 한계 주석을 한 줄 추가하는
    정도로 충분할 것이다.

## 요약

이 PR 은 전반적으로 유지보수성이 높다 — 위험을 만드는 세 축(키 추측 가능성·Content-Type 신뢰·
lost update)마다 "왜" 를 설명하는 주석과 그 주석을 반증한 실측(뮤테이션 실측·정규식 우회 실측)을
코드에 남겼고, `toProfileData`/`avatarKeyPrefix`/`deletePreviousAvatarObject` 같은 추출로 기존
중복(getMe/updateMe 응답 매핑)까지 함께 정리했다. 매직 넘버는 `AVATAR_MAX_BYTES` 같은 명명 상수로
고정돼 있고 네이밍도 목적이 분명하다. 개선 여지는 프로덕션 코드 한 곳(`updateAvatar` 의 다중 책임)과
테스트 코드 한 곳(`users-avatar.service.spec.ts` 의 S3Service mock 보일러플레이트 반복)에 집중돼
있으며, 둘 다 기능적 결함이 아니라 다음 확장 시 "일부만 고쳐지는" 드리프트 위험을 줄이는 리팩터링
성격의 제안이다.

## 위험도

LOW
