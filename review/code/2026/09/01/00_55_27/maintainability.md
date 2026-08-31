# 유지보수성(Maintainability) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `UsersService.updateAvatar` 가 파일 검증·확장자 판정·사용자 조회·S3 업로드·컬럼
  단위 UPDATE·정리 위임까지 한 메서드 안에서 순차 orchestration 한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:79-149` (`updateAvatar`)
  - 상세: 3라운드 리뷰(`review/code/2026/08/31/23_19_39/maintainability.md`)가 WARNING 으로
    지목했던 항목이다. 같은 RESOLUTION 에서 "지금 크기에서 읽기가 나빠지지 않는다" 는 근거로
    조치하지 않기로 결정했고, 이번 라운드까지 메서드 길이·구조는 그대로다(실 코드는 주석 제외
    25~30줄, 5단계가 한 메서드에 있음). 직접 다시 읽어도 각 단계 경계에 주석이 붙어 있어
    순서를 따라가기는 어렵지 않다 — 재평가해도 다음 확장(검증 로직 재사용 필요) 전까지는
    분리를 강제할 만큼 나쁘지 않다는 원 판단에 동의한다.
  - 제안: 새 조치 불요. 파일 업로드 기능이 하나 더 생겨 검증 로직을 재사용해야 하는 시점이
    재개 신호로 이미 RESOLUTION 에 기록돼 있으니 그대로 둔다.

- **[INFO]** `users-avatar.service.spec.ts` 안에서 `S3Service` mock + `Test.createTestingModule().compile()`
  부트스트랩이 6곳에서 반복되고, 헬퍼 이름도 `setup`/`build`로 갈린다.
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:56`(`setup`),
    `:80`, `:267`, `:297`(`build`), `:313`, `:377`, `:437`, `:462` (`createTestingModule` 호출 6곳)
  - 상세: 이 역시 3라운드 WARNING → "조치 안 함"으로 유예된 항목이다. 파일은 그 사이
    468줄(3라운드)에서 520줄로 늘었고(`OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리`
    블록 신설), `createTestingModule` 호출 지점 수는 6곳으로 동일하다 — 반복이 더 늘지는
    않았다. 다음 축이 추가돼 `s3.getPublicUrl`/`s3.delete` 의 mock 반환 형태가 바뀌면 6곳 중
    일부만 갱신될 위험은 여전히 구조적으로 남아 있다.
  - 제안: 즉시 조치는 불요. 다만 이 파일에 describe 블록이 하나 더 늘어나는 다음 변경이
    오면(오늘 이미 그랬듯) `createModule(repoOverrides?, s3Overrides?)` 팩토리로 통합하는
    비용 대비 효과가 역전될 시점이 가까워진다 — 다음 확장이 재개 신호로 적합하다.

- **[INFO]** 확장자 → `Content-Type` 판정이 단락 평가(`&&`)와 삼항 연산자가 겹친 밀집 표현식이다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:98-105`
  - 상세: `ext && Object.prototype.hasOwnProperty.call(...) ? ... : undefined` 한 식에
    "확장자 부재"·"화이트리스트 미포함"·"프로토타입 체인 우회 방지" 세 조건이 압축돼 있다.
    바로 위 주석(`:93-96`)이 "왜" 프로토타입 체인을 걱정하는지는 잘 설명하지만, 식 자체가
    "무엇을" 계산하는지는 한 번 더 분해해야 파악된다. 3라운드에서 이미 INFO 로 지목됐고
    변경 없이 그대로다.
  - 제안: `private static resolveAvatarContentType(ext: string | undefined): string | undefined`
    로 추출하면 `if (!contentType) throw ...` 앞뒤 흐름이 더 선형적으로 읽힌다. 우선순위는
    낮다 — 로직이 짧고 인접 주석·테스트(`users-avatar.service.spec.ts` 축 2, `.constructor`/
    `__proto__` 케이스)가 의도를 이미 충분히 고정하고 있다.

- **[INFO]** `S3Service` 생성자의 `?? endpoint` 2차 방어가 `s3.config.ts` 의 3단 폴백 규칙과
    개념적으로 겹친다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts:32-41`
  - 상세: 3라운드 INFO 와 동일 — 주석(`:32-39`)이 "이건 규칙의 사본이 아니라 config 미로드
    조립에 대한 2차 방어" 라고 명시하고, `s3.service.spec.ts` 의 `'s3.publicBaseUrl 이 없으면
    endpoint 로 떨어진다'` 테스트(리뷰 3라운드에서 추가)가 그 주장을 코드에 묶어 검증까지
    붙었다. 다만 "같은 개념(폴백 규칙)이 두 파일에 서로 다른 연산자(`||` 체인 vs `??`)로
    표현돼 있다"는 결합 자체는 남아 있다 — `s3Config` 의 폴백 단수가 늘어나면 이 방어 줄도
    검토 대상인지 판단해야 한다.
  - 제안: 현재 수준의 주석 + 전용 테스트로 실용적으로 충분하다. 추가 조치 불요.

- **[INFO]** `import Express from 'express'` → `import ExpressNS from 'express'` 리네임이
    `users.controller.ts` 한 곳에만 적용돼, 같은 패턴을 쓰는 다른 컨트롤러 4곳과 네이밍이
    갈린다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:60`(`import ExpressNS from
    'express'`), `:220-221`(`changePassword` 의 `ExpressNS.Request`/`ExpressNS.Response`),
    `:307-308`(`verifyEmailChange`). 대조: `codebase/backend/src/modules/auth/auth.controller.ts`,
    `sessions.controller.ts`, `webauthn.controller.ts`,
    `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` 는
    여전히 `import Express from 'express'` + `Express.Request`/`Express.Response` 를 쓴다.
  - 상세: `import Express from 'express'` 가 전역 `Express` 네임스페이스를 가려 `@types/multer`
    의 `Express.Multer.File` 을 쓸 수 없었다는 실측된 컴파일 차단이 원인이고, 코드 내
    주석(`:58-59`)이 "다른 컨트롤러 4곳은 Multer 타입을 쓰지 않아 `Express` 그대로다 — 전역
    컨벤션으로 승격하려면 `spec/conventions/` 문서화가 선행돼야 한다" 고 그 갭을 스스로
    명시하고, CHANGELOG·scope.md(2라운드)에도 같은 내용이 disclose 돼 있다. 순수 타입 레벨
    변경이라 런타임 영향은 없다.
  - 제안: 새 조치 불요 — 이미 최선의 처리(원인 실측 + 범위 한정 + 명시적 갭 인정)다. 다음에
    Multer 타입을 쓰는 컨트롤러가 하나 더 생기면 그때 `spec/conventions/`에 컨벤션을 확정할지
    판단하는 편이, 지금 미리 4곳을 전수 리네임(이번 PR 의 스코프를 넘는 부수 변경)하는 것보다
    낫다.

## 그 외 점검 결과 (문제 없음)

- **매직 넘버**: `AVATAR_MAX_BYTES = 2 * 1024 * 1024`(`users.service.ts:52`)는 명명 상수이고
  컨트롤러의 `FileInterceptor` limits(`users.controller.ts:162`)가 그 상수를 직접 참조한다 —
  리터럴 중복이 없다. `users-avatar-swagger-sync.spec.ts` 의 `MIN_MB_LITERALS`/`MIN_EXT_LISTS`
  임계값도 "왜 이 숫자인가"가 인접 주석에 설명돼 있다.
- **중첩 깊이**: 이번 diff 전체에서 3단 이상 중첩된 조건문·반복문이 없다 — 가장 깊은 곳은
  `deletePreviousAvatarObject` 의 `if (!previousUrl) / if (at < 0) / try{}catch{}` 로 순차적
  early-return 패턴이라 실질 중첩은 1단이다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:169-196`
- **네이밍**: `resolvePublicBaseUrl`·`shouldWarnPublicBaseIsPrivate`·`avatarKeyPrefix`·
  `deletePreviousAvatarObject`·`getPublicUrl` 모두 동사(구)로 의도를 드러내고, 기존 컨벤션
  (`isPrivateHost`, `assertProductionConfig` 류)과 어울린다.
- **일관성**: `main.ts` 의 신규 부팅 경고 블록(`:155-173`)은 바로 위
  `ALLOW_PRIVATE_HOST_TARGETS` 블록(`:141-153`)과 "판정은 `production-guards`/`s3.config`
  쪽 순수 함수에 두고 `main.ts` 는 `if (...) logger.warn(...)` 만 한다" 는 동일 패턴을 그대로
  따른다 — 새 패턴을 만들지 않았다.
- **테스트 가독성**: `s3.config.spec.ts`·`s3.service.spec.ts`·`users-avatar.service.spec.ts`
  전부 "무엇을 왜 고정하는지"(리뷰 라운드·뮤테이션 실측 포함)를 테스트 바로 위 주석에 남겨,
  실패 시 다음 사람이 의도를 재구성할 필요가 없다.

## 요약

이번 변경(아바타 업로드 엔드포인트, `S3Service.getPublicUrl`, `s3.config.publicBaseUrl` 3단
폴백, `main.ts` 부팅 경고)은 3라운드에 걸친 리뷰를 거치며 이미 상당히 수렴한 상태다. 이번
라운드에서 새로 발견한 구조적 결함은 없다 — 5개 INFO 항목 모두 3라운드에서 이미 지적되고
개발자가 명시적 근거(RESOLUTION.md)와 함께 "지금은 조치하지 않는다" 로 유예했거나(다중 책임·
테스트 보일러플레이트), 이미 최선의 처리를 거친 상태(리네임 범위 한정·2차 방어 주석+테스트)다.
직접 코드를 다시 읽어 그 판단들을 재검증했고 동의한다 — 유예된 두 항목은 "다음 확장 시점"이라는
구체적 재개 신호가 이미 plan/RESOLUTION 에 적혀 있어 방치가 아니라 의도된 지연이다. 매직 넘버·
중첩·네이밍·기존 패턴과의 일관성은 전부 양호하다.

## 위험도

LOW
