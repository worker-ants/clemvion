# 변경 범위(Scope) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 검증 방법

프롬프트에 첨부된 diff 는 앞선 8라운드 리뷰의 산출물(`review/code/2026/08/31/**`,
`review/code/2026/09/01/{00_11_39,00_35_24,00_55_27,01_19_27}/**`)까지 포함해 132개
review 아티팩트 + 28개 실제 코드/설정/문서 파일로 조립돼 있다. review 아티팩트는 저장소
컨벤션(`review/code/<날짜>/<시간>/`)상 정상 산출 위치이므로, scope 판단은 **실제 코드/설정/
plan 변경 28개 파일**(`git diff --stat origin/main...HEAD -- codebase/ spec/ plan/ CHANGELOG.md
README.md docker-compose*.yml k8s/ scripts/` = 2081줄 추가/31줄 삭제)에 집중했다. 프롬프트가
크기 제한으로 생략한 파일(`users.controller.ts`·`users.service.ts`·`users.module.ts`·
`plan/in-progress/*.md`·`scripts/minio/*`)은 `git diff origin/main...HEAD -- <path>` 로
직접 열어 전문을 대조했다.

## 발견사항

- **[INFO]** `import Express from 'express'` → `ExpressNS` 리네임이 기능과 무관한 두
  기존 엔드포인트의 파라미터 타입 표기까지 함께 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — import 선언부(파일
    상단, `AuthService` import 아래), `changePassword`(`@Req() req: ExpressNS.Request`,
    `@Res() res: ExpressNS.Response`), `verifyEmailChange`(동일 패턴). 정확한 게이트 번호는
    프롬프트 파일 3 블록(`58~117`행 부근 CHANGELOG 발췌)이 아니라 `users.controller.ts`
    자체를 열어 확인 요망 — 이번 리뷰에서 `git diff`로 직접 대조했다.
  - 상세: default import 는 파일 전체에 한 바인딩만 허용되므로, 신규 `uploadAvatar` 가
    `Express.Multer.File` 타입을 쓰려면 기존 `import Express from 'express'` 를 리네임할
    수밖에 없고, 그러면 같은 파일의 **모든** `Express.*` 참조가 기계적으로 함께 바뀐다.
    실측 컴파일 오류(`Namespace 'e' has no exported member 'Multer'`)가 CHANGELOG·
    `plan/in-progress/spec-sync-user-profile-gaps.md`("부수 — Express 네임스페이스
    shadowing") 양쪽에 근거로 남아 있고, 같은 문제가 없는 다른 4개 컨트롤러의
    `import Express` 는 건드리지 않았다고 plan 문서가 명시한다(`ExpressModule` →
    `ExpressNS` 로 재조정한 이력까지 포함). 런타임 동작 변화는 없는 순수 타입 레벨
    리네임이다.
  - 제안: 조치 불필요 — 불가피한 side effect 이며 disclose 도 충분하다. 참고 기록.

- **[INFO]** `UsersService.update()`(호출부 17곳 — TOTP·WebAuthn·OAuth 등 인증 핫패스
  포함)가 avatar 정리 로직을 새로 얻어, "avatar 업로드 엔드포인트 신설" 이라는 요청 범위를
  넘어 기존 공용 PATCH 경로의 관측 가능한 부작용(옛 S3 객체 삭제)을 새로 만든다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `update()` 메서드
    (`'avatarUrl' in data` 조건부 사전 SELECT → `deletePreviousAvatarObject` 호출).
  - 상세: `PATCH /users/me` 로 `avatarUrl` 을 외부 URL로 바꾸는 것도 "아바타 교체"의 또
    다른 진입점이므로, 업로드 경로에서만 정리하면 PATCH 로 교체된 업로드 객체가 영구
    고아로 남는다는 논리로 범위를 넓혔다. `'avatarUrl' in data` + 값 비교(같은 값 재전송
    시 스킵)로 나머지 16개 호출부에 SELECT 를 추가하지 않도록 스코프를 최소화했고,
    `users-avatar.service.spec.ts` 가 "PATCH 로 바꿔도 정리된다"/"avatarUrl 없는 payload 는
    사전 조회조차 하지 않는다"를 모두 회귀 고정한다. 정당성·범위 축소 근거가 plan 문서에
    기록돼 있다.
  - 제안: 조치 불필요. 같은 기능(아바타 생애주기)의 정합성을 지키기 위한 필연적 확장이다.

- **[INFO]** `UsersController.toProfileData()` 헬퍼 추출이 기존 `getMe`·`updateMe` 두
  엔드포인트의 응답 조립 코드도 함께 리팩터링한다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — 신규 `private
    toProfileData(user: User)`, `getMe`(스프레드로 교체), `updateMe`(`return { data:
    this.toProfileData(updated) }` 로 교체), 신규 `uploadAvatar` 도 동일 헬퍼 사용.
  - 상세: 새 `uploadAvatar` 가 세 번째로 동일한 프로필 응답 봉투를 만들어야 하므로 기존
    두 곳의 인라인 리터럴을 공통 헬퍼로 추출한 순수 구조적 변경(로직 변화 없음,
    `users.controller.spec.ts` 기존 테스트 그대로 통과). 세 번째 소비자가 실제로 생겨서
    발생한 통상적 DRY 추출이라 "무관한 리팩토링"으로 보기 어렵다.
  - 제안: 조치 불필요.

- **[INFO]** 이번 diff 는 아바타 기능을 넘어 **기존 CRITICAL 을 낳은 자매 메서드
  `incrementLoginAttempts`** 를 read-modify-write(`findOneOrFail`→필드 수정→`save(user)`)
  에서 원자적 raw `UPDATE ... RETURNING` 으로 재작성한다 — 표면적으로는 avatar 업로드
  범위 밖처럼 보이지만, 직접 대조한 결과 실제로는 이 PR 자신이 도입한 결함의 반대편
  writer 를 고친 것으로 확인했다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `incrementLoginAttempts()`
    (신규 raw SQL) 및 `isLocked()` (JSDoc 갱신, 쓰기·읽기 시계 비대칭 disclose). 신규 파일
    `codebase/backend/src/modules/users/users-login-attempts.service.spec.ts` 가 이 메서드
    전용 회귀를 처음으로 고정한다(종전에는 `auth.service.spec.ts` 의 mock 이 유일한
    참조였다는 서술을 소스 diff·plan 서술 양쪽에서 확인).
  - 상세: `git log --oneline origin/main..HEAD` 로 커밋 이력을 직접 대조한 결과,
    `f24584a35 fix(users): 리뷰 7R — 내가 고친 경쟁이 반대 방향으로 그대로 있었다 (로그인
    카운터)` 커밋이 이 변경을 만들었다. 아바타 업로드가 `avatarUrl` 을 컬럼 단위 `update()`
    로 바꿔 lost-update 를 없앴는데, 로그인 실패 카운터가 여전히 전체 스냅샷 `save(user)`
    를 쓰고 있어 — 아바타 업로드가 URL 갱신+옛 S3 객체 삭제까지 끝낸 뒤 이 저장이
    나중에 커밋되면 DB 가 **이미 삭제된 객체를 가리키는 옛 URL** 로 되돌아가는, 고아
    객체보다 나쁜 상태가 만들어진다는 것이 리뷰 7라운드 실측이었다. 즉 이 파일 변경은
    "avatar 업로드와 무관한 기존 코드 정리"가 아니라 **이 PR 자신이 만든 경쟁의 대칭
    짝**을 고친 것이며, `update-returning-rows.ts`(원자 UPDATE 헬퍼)는 이 PR 이 신설한
    것이 아니라 `origin/main` 에 이미 있던 공용 유틸을 재사용한 것도 확인했다(신규 의존
    아님). scope 관점에서는 "avatar 업로드"라는 라벨보다 넓어 보이지만, 근본 원인이
    이 PR 안에 있다는 점에서 무관한 파일 수정이 아니라 정당한 인과적 확장으로 판단한다.
  - 제안: 조치 불필요 — 근거가 커밋 이력·plan 문서(`spec-sync-user-profile-gaps.md` "이
    근거는 한 번 반증됐다" 절)에 실측과 함께 명시돼 있다.

## 그 외 점검 결과 (문제 없음)

- **plan 문서**: `plan/in-progress/spec-sync-user-profile-gaps.md`(+182줄)·
  `plan/in-progress/spec-update-avatar-upload-implemented.md`(신규 94줄) 모두 이 기능의
  진행 트래킹·planner 위임 문서로, spec 본문을 developer 가 직접 고치지 않고 권한 경계를
  지킨 것을 `git diff` 로 확인했다(취소선 예고, `spec/` 자체는 diff 대상에 없음).
- **인프라/설정**: `docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/**`·
  `codebase/backend/.env.example`·`README.md` 는 전부 신규 `S3_PUBLIC_BASE_URL` env
  전파와 MinIO 버킷 정책(`scripts/minio/avatars-public-read.json`, 신규) 적용에 한정된다.
  이미지 태그·다른 서비스 설정 변경은 없다.
- **의존성**: `package.json`/`pnpm-lock.yaml` 변경 없음 — 신규 패키지 없이 기존
  `@aws-sdk/client-s3`·`@nestjs/platform-express`·`@types/multer`·`node:crypto`
  (`randomUUID`)를 재사용한다.
- **`users.module.ts`**: `S3Service` provider 추가 한 줄 + 주석 3줄만 — 기존
  `KnowledgeBaseModule` 과 동일한 지역 provider 패턴이라 새 아키텍처 패턴을 만들지 않았다.
- **포맷팅/주석/임포트**: 전 파일에서 diff 밖의 라인을 건드리는 순수 포맷팅 변경이나
  본문과 무관한 주석·임포트 정리는 발견되지 않았다. 모든 신규 주석은 해당 라인의 설계
  근거(리뷰 라운드 실측 포함)를 서술한다.

## 요약

핵심 변경(28개 실제 코드/설정/plan 파일, 2081줄)은 전부 "아바타 이미지 업로드(공개 버킷 +
공개 URL)"라는 단일 기능으로 추적 가능하다. `git diff origin/main...HEAD` 를 직접 열어
대조한 결과, scope 밖처럼 보일 수 있는 네 지점 — ① `Express`→`ExpressNS` 리네임의 collateral
2곳, ② 공용 `update()` 확장, ③ `toProfileData` 추출, ④ `incrementLoginAttempts` 원자성
재작성 — 은 모두 새 엔드포인트가 강제하는 불가피한 side effect 이거나(①·③), 같은 기능의
정합성 불변식을 지키기 위한 의도된 확장이거나(②), **이 PR 자신이 만든 lost-update 의 대칭
결함**을 고친 인과적 수정(④)이다. 넷 다 CHANGELOG·plan 문서·커밋 이력에 근거와 함께
disclose 돼 있고 범위를 스스로 최소화한 흔적(다른 4개 컨트롤러의 `Express` import 는
안 건드림, 17개 호출부 중 avatarUrl 관련 경로만 조건부 SELECT)이 뚜렷하다. review/**
아래 132개 아티팩트는 8라운드 반복 리뷰-수정 사이클의 정상 산출물(저장소 컨벤션)이며
기능 코드가 아니다. 새 패키지 의존성 추가, 무관한 파일 수정, 의미 없는 포맷팅/공백
변경, 불필요한 주석/임포트 정리, 의도치 않은 설정 변경은 발견되지 않았다.

## 위험도

LOW
