# 테스트(Testing) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 사전 확인

이 브랜치는 이미 8라운드의 review-fix 루프를 거쳤고(`git log`: "리뷰 8R" ~ "리뷰 2R" 커밋들),
`s3.service.ts`/`users.service.ts`/`s3.config.ts`/`main.ts`의 주석 다수가 **뮤테이션 실측**
(예: "지워도 81건 GREEN", "85건 GREEN", "26건 중 2건만 RED")을 근거로 테스트를 보강한 이력을
담고 있다. 아래 발견사항은 이 이력을 전제로, 그럼에도 남아 있는 갭만 추린 것이다. 프롬프트에서
diff 가 생략된 파일(`users.service.ts`, `users-avatar.service.spec.ts`,
`users-login-attempts.service.spec.ts`, `users.controller.ts`, `s3.config.spec.ts`,
`users-avatar-upload.e2e-spec.ts` 등)은 저장소의 실제 파일을 직접 열어 확인했다. 저장소 파일은
읽기만 했고 아무것도 쓰지 않았다(`git status --short` 로 변경 없음 확인 완료).

## 발견사항

- **[WARNING]** `uploadAvatar` 컨트롤러 테스트에 **실패 전파 케이스**가 없다 — 같은 파일의 형제
  엔드포인트 테스트들과 패턴이 어긋난다.
  - 위치: `codebase/backend/src/modules/users/users.controller.spec.ts:390-450`
    (`describe('UsersController.uploadAvatar (§6.1)', ...)`)
  - 상세: 이 describe 블록은 happy-path 두 건(위임 인자 확인, 응답 매핑 확인)만 있다. 같은 파일의
    `getMe`(`:111`, `:119-121` — DB 에러 전파), `changePassword`(`:265-280` —
    `UnauthorizedException` 전파), 이메일 변경 확인(`:353-362`)은 전부 서비스가 던진 예외가
    컨트롤러를 거쳐 **그대로** 전파되는지를 `rejects.toThrow(...)` 로 고정한다.
    `uploadAvatar` 만 이 패턴이 빠져 있다 — `UsersService.updateAvatar` 가 던지는
    `BadRequestException('FILE_REQUIRED'/'INVALID_FILE_TYPE')` 나 `NotFoundException` 이 컨트롤러
    레이어에서 삼켜지거나 변형되지 않는지(예: 누군가 나중에 `try/catch` 로 감싸며 실수로
    응답을 바꾸는 회귀)를 잡을 회귀 테스트가 없다.
  - 제안: 형제 테스트들과 같은 형태로 한 건만 추가한다.
    ```ts
    it('서비스가 던진 예외를 그대로 전파한다', async () => {
      updateAvatar.mockRejectedValue(
        new BadRequestException({ code: 'INVALID_FILE_TYPE' }),
      );
      await expect(
        controller.uploadAvatar(payload, {} as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });
    ```

- **[INFO]** 동시 업로드 "패자" 오브젝트 고아화(TOCTOU) — CHANGELOG 에 명시적으로 disclose·유예됐지만,
  같은 스위트 안에 이미 쓰인 "캐너리" 패턴이 이 축에는 적용되지 않았다.
  - 위치: `CHANGELOG.md:29-32`(유예 서술), `codebase/backend/src/modules/users/users-avatar.service.spec.ts:170-256`(`describe('축 3 — 교체 시 옛 객체 정리', ...)` — 전부 단일 요청 순차 흐름만 고정)
  - 상세: 같은 파일 하단의 `describe('OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리', ...)`
    (`users-avatar.service.spec.ts:505-536`)는 "오늘은 문제가 없지만 전제가 바뀌면 깨진다"는
    알려진 미해결 리스크를 **소스 캐너리**로 고정해, 그 전제를 건드리는 사람이 반드시 이 문단을
    보게 만든다. 동시 업로드로 "패자" S3 오브젝트가 영구 고아가 되는 리스크(CHANGELOG 가 스스로
    "여기서 경쟁을 없앴다고 넓게 읽으면 안 된다"고 적은 바로 그 항목)는 CHANGELOG 본문에만 있고,
    테스트 파일에는 그에 대응하는 캐너리나 `it.todo`/스킵 표시가 없다. 실제 동시성 테스트는
    비용 대비 효과가 낮다는 판단(WARNING/CRITICAL 아님)에는 동의하지만, 이 PR 이 이미 확립한
    "유예는 코드 옆에 캐너리로 고정한다"는 자체 관례를 이 축에서만 건너뛴 것은 다음 사람이
    "테스트가 없으니 문제가 없다"고 오독할 여지를 남긴다.
  - 제안: 필수는 아니지만, `it.todo('동시 업로드 시 패자의 S3 오브젝트가 고아로 남는다 — plan/in-progress/spec-sync-user-profile-gaps.md 유예')` 한 줄만 추가해도 "테스트가 이 축을 놓친 것"과 "의도적으로 유예한 것"을 구분할 수 있다.

- **[INFO]** 확장자 파싱의 두 미세 경계값(더블 확장자·트레일링 점)이 명시적으로는 테스트되지 않는다 —
  다만 기존 부정 케이스와 같은 코드 경로라 실질 위험은 낮다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:104-118`(`ext` 파싱 및 화이트리스트 판정), 대응 테스트: `users-avatar.service.spec.ts:142-152`(`it.each([['me.svg', ...], ['me.html', ...], ['me', ...]])`)
  - 상세: `'me.tar.gz'`(더블 확장자 → `ext='gz'`) 나 `'me.'`(트레일링 점 → `ext=''`)는 각각
    "허용되지 않는 확장자"·"확장자 없음"과 코드상 동일 분기(`hasOwnProperty` 미스 → 400)를 타므로
    뮤테이션으로 갈릴 가능성은 낮다. 그래도 두 값 다 사용자가 실제로 보낼 수 있는 입력이고, 특히
    `''`(빈 문자열)는 `ext &&` 단축 평가가 정확히 이 값을 막기 위한 것이라 — 그 단축평가 자체를
    문는 케이스가 없다는 점에서 경계값 커버리지가 완전하지는 않다.
  - 제안: 우선순위는 낮음. `it.each` 배열에 `['me.tar.gz', '더블 확장자']`, `['me.', '트레일링 점 — 빈 확장자']` 두 항목만 추가하면 경계값이 닫힌다.

## 그 외 점검 결과 (강점 — 문제 없음)

- **레이어별 테스트 피라미드가 정확하다**: `S3Service` 는 유닛 테스트(`s3.service.spec.ts`) 전 구간에서
  mock 되고, 실제 버킷 정책·퍼블릭 URL 도달성은 `test/users-avatar-upload.e2e-spec.ts` 가 실
  MinIO 를 상대로 검증한다(익명 GET 200·목록 조회 403). 유닛이 못 잡는 "정책이 실수로 닫혀도
  전부 GREEN" 문제를 e2e 로 정확히 메웠다는 점이 주석에 실측(`mc anonymous set download` 가
  ListBucket 을 함께 연다는 실측)과 함께 명시돼 있다.
- **뮤테이션 검증이 실제로 수행됐다는 증거가 코드에 남아 있다**: `s3.config.spec.ts`(`main.ts` 인라인
  조합 뮤테이션 85건 GREEN → 순수 함수 추출), `users-avatar.service.spec.ts`(Content-Type 매핑
  33건 GREEN·대문자 처리 30건 GREEN·빈 파일 가드 회귀), `users-login-attempts.service.spec.ts`
  (read-modify-write 회귀 시 컬럼 비교로 즉시 실패). 근거 없이 "안전하다"고만 적힌 주석이 없다.
- **"시끄러운 실패" mock 패턴**: `users.service.spec.ts:43-59`, `users-avatar.service.spec.ts` 의
  `save: jest.fn(() => { throw ... })`, `users-login-attempts.service.spec.ts` 의
  `findOne`/`findOneOrFail`/`save` 모두 "호출되면 안 되는 경로"를 조용한 no-op 대신 throw 로
  막아, 회귀가 침묵하지 않고 실패하게 설계했다. Mock 적절성 관점에서 모범적이다.
  (일반 관례: 조용한 no-op mock 은 의도치 않은 호출을 가려 거짓 GREEN 을 만든다 — 이 PR 은
  일관되게 그 함정을 피했다.)
- **테스트 용이성 개선이 리팩터로 이어짐**: `main.ts` 부트스트랩 본문의 조합 판정이 유닛으로 못 잡힌다는
  걸 실측(85건 GREEN)한 뒤 `shouldWarnPublicBaseIsPrivate`/`resolvePublicBaseUrl` 순수 함수로
  추출해 `s3.config.spec.ts` 로 옮겼다 — "코드가 테스트하기 쉬운 구조인가"에 대한 정확한 대응이다.
- **테스트 격리**: `s3.config.spec.ts` 의 `process.env` 조작 블록은 `beforeEach`/`afterEach` 로
  저장·복원하고, `shouldWarnPublicBaseIsPrivate` 블록은 아예 env 객체를 인자로 넘겨 전역 상태를
  건드리지 않는다. `users-avatar.service.spec.ts` 의 각 스위트는 `setup()`/`build()` 헬퍼로 매
  테스트마다 새 `TestingModule` 을 만들어 상호 의존이 없다.
- **회귀 테스트**: 기존 `users.service.spec.ts`/`users.controller.spec.ts` 는 새 생성자 의존성
  (`S3Service`)에 맞춰 provider 를 보강했을 뿐 기존 단언은 그대로 유효하다 — 깨진 회귀 없음.
- **Swagger-코드 드리프트 가드**(`users-avatar-swagger-sync.spec.ts`)는 이전 라운드의 "접두어 요구
  정규식이라 매칭 실패해도 GREEN" 결함을 "전수 열거 + 하한값" 방식으로 정정했고, 실제로 현재
  파일의 리터럴 개수(4개 MB 표기)와 `MIN_MB_LITERALS=4` 가 일치함을 직접 대조해 확인했다.

## 요약

8라운드에 걸친 review-fix 루프의 산물답게 테스트 커버리지가 이례적으로 촘촘하다 — 키 추측 불가능성,
Content-Type 화이트리스트(프로토타입 체인 우회 포함), 교체 시 정리 순서, lost-update 방지(컬럼 단위
update), 로그인 시도 카운터 원자성, 부팅 경고 폴백 규칙까지 각 축이 "왜 이 테스트가 필요한가"를
실측(뮤테이션 생존 건수)과 함께 문서화하고 있다. 남은 갭은 셋뿐이며 전부 경미하다: (1) 새 컨트롤러
테스트만 형제 엔드포인트들의 "예외 전파" 패턴을 따르지 않았다(WARNING), (2) CHANGELOG 가 disclose
한 동시 업로드 고아화 리스크에 이 PR 이 이미 쓴 "소스 캐너리" 관례가 적용되지 않았다(INFO), (3) 확장자
파싱의 두 미세 경계값이 명시 테스트 없이 기존 부정 케이스와 같은 분기에 얹혀 간다(INFO). 전부 조치가
없어도 기능적 위험은 낮다.

## 위험도

LOW
