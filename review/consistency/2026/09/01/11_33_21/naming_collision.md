# 신규 식별자 충돌 검토 — spec/5-system/ (avatar-upload-public-url, impl-done)

## 검토 방법

- diff-base `origin/main` 대비 target 스코프(`spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`) 델타를 `git diff origin/main...HEAD` 로 실측.
- 프롬프트 번들의 구현 diff(15 파일)와 워킹트리를 `git grep`/`git diff`로 절대경로 확인.
- 이번 PR 이 도입하는 신규 식별자를 전수 열거해 저장소 전체(`spec/`, `codebase/`)에서 기존 사용처와 대조.

새로 도입되는 식별자:
- API endpoint: `POST /api/users/me/avatar`
- 에러 코드: `FILE_REQUIRED`, `INVALID_FILE_TYPE`(재사용)
- ENV var / config key: `S3_PUBLIC_BASE_URL` / `s3.publicBaseUrl`
- 코드 식별자: `S3Service.getPublicUrl`, `UsersService.AVATAR_MAX_BYTES`/`AVATAR_CONTENT_TYPES`/`avatarKeyPrefix`/`LOGIN_LOCK_THRESHOLD`/`LOGIN_LOCK_MINUTES`, `resolvePublicBaseUrl`/`shouldWarnPublicBaseIsPrivate`, `UsersController.toProfileData`, import 별칭 `ExpressNS`
- 객체 키 레이아웃: `avatars/{userId}/{uuid}.{ext}`

## 발견사항

- **[WARNING]** `s3.publicBaseUrl` / `S3_PUBLIC_BASE_URL` 이 과거 금지된 phantom key 와 leaf 이름을 공유
  - target 신규 식별자: `s3.publicBaseUrl`(ConfigService 키) / `S3_PUBLIC_BASE_URL`(env var) — `codebase/backend/src/common/config/s3.config.ts`, `.env.example:163`, `spec/data-flow/4-file-storage.md §2.3`
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1384-1529` — webhook `callbackUrl` 조립 회귀 테스트가 **등록된 적 없는** config key `app.publicBaseUrl` / bare `publicBaseUrl` 을 코드가 fallback 으로 읽지 못하도록 명시적으로 금지한다(과거 실제 장애 — Telegram webhook 거부). 그 도메인의 canonical key 는 `app.url`(`app.config.ts`, env `APP_URL`) 이다.
  - 상세: 두 키는 네임스페이스(`s3.*` vs `app.*`)·env var 이름(`S3_PUBLIC_BASE_URL` vs `APP_URL`)·용도(S3 공개 오브젝트 URL vs webhook 콜백 URL)가 모두 달라 **실제 충돌은 아니다.** 다만 leaf 토큰 `publicBaseUrl` 이 겹쳐서, grep 한 "publicBaseUrl" 검색이나 향후 리팩터링 시 두 개념이 섞일 위험이 있다. 이미 target 아닌 인접 문서 `spec/data-flow/4-file-storage.md`(§2.3 바로 아래)에 "⚠️ 근접 명명 주의" 문단으로 자체 식별·문서화되어 있고, 코드 쪽도 회귀 테스트로 방어돼 있어 **선제 대응이 되어 있는 상태**다.
  - 제안: 이 경고 문단이 앞으로도 `s3.config.ts` 곁에 유지되도록 두고(이미 되어 있음), 후속 PR 이 `s3.publicBaseUrl` 을 다른 도메인(webhook 등)의 base URL 조립에 재사용하지 않도록 리뷰 시 이 노트를 참조점으로 삼을 것을 권장. 코드 변경은 불필요(이미 방어됨) — 문서 인지 유지 목적의 낮은 우선순위 권고.

- **[INFO]** `POST /api/users/me/avatar` — 신규 endpoint 아님, 기존 예약을 구현으로 전환
  - target 신규 식별자: `POST /api/users/me/avatar` (`spec/5-system/2-api-convention.md §9`)
  - 기존 사용처: `spec/2-navigation/9-user-profile.md §6.1` — 변경 전(origin/main)에는 `~~POST~~ ~~/api/users/me/avatar~~`(취소선, "미구현 Planned")로 이미 이 경로가 예약돼 있었다.
  - 상세: 이번 PR 은 새 경로를 만든 것이 아니라 기존에 spec 이 이미 명명해 둔 경로를 구현으로 전환한 것 — 충돌이 아니라 정합 사례. `spec/5-system/2-api-convention.md §9`(target)의 서술도 이 경로와 일치.
  - 제안: 조치 불요.

- **[INFO]** `INVALID_FILE_TYPE` — KB 문서 업로드와 아바타 업로드가 코드를 공유
  - target 신규 식별자: `spec/5-system/3-error-handling.md §1.3` 신규 등재 행의 `INVALID_FILE_TYPE`
  - 기존 사용처: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:928` (KB 문서 확장자 화이트리스트 불일치, 이미 구현되어 있던 코드) · `spec/data-flow/4-file-storage.md:52`
  - 상세: 같은 문자열 코드를 아바타 업로드가 그대로 재사용한다. target 문서 자체가 "KB 문서 업로드와 아바타 업로드가 공용"이라고 명시하고 있어 의도된 재사용이며, 두 문맥의 의미("확장자 화이트리스트 불일치")도 동일하다 — 충돌 아님.
  - 제안: 조치 불요.

- **[INFO]** `FILE_REQUIRED` — 신규 코드, 기존 사용처 없음
  - target 신규 식별자: `spec/5-system/3-error-handling.md §1.3` 신규 등재 행의 `FILE_REQUIRED`
  - 기존 사용처: 저장소 전체에서 이 PR 이전에는 사용된 적이 없음(신규 발행처는 아바타 업로드 하나뿐, `users.service.ts`).
  - 상세: 충돌 없음.
  - 제안: 조치 불요.

- 그 외 확인한 식별자(전부 충돌 없음, 기존 사용처와 문자열이 겹치지 않거나 겹치지 않는 것을 확인):
  `S3Service.getPublicUrl` · `UsersService.AVATAR_MAX_BYTES`/`AVATAR_CONTENT_TYPES`/`avatarKeyPrefix`/`LOGIN_LOCK_THRESHOLD`/`LOGIN_LOCK_MINUTES` · `resolvePublicBaseUrl`/`shouldWarnPublicBaseIsPrivate` · `UsersController.toProfileData`(private, 컨트롤러 로컬) · import 별칭 `ExpressNS`(파일 로컬, 미공개) · 객체 키 레이아웃 `avatars/{userId}/{uuid}.{ext}`(`spec/0-overview.md §2.7` 표에 KB/Form 키와 별도 행으로 등재, 접두 겹침 없음).

## 요약

target 스코프(`spec/5-system/2-api-convention.md`, `3-error-handling.md`)가 이번에 새로 등재하는 식별자 — endpoint `POST /api/users/me/avatar`, 에러 코드 `FILE_REQUIRED`/`INVALID_FILE_TYPE` — 는 모두 기존 사용처와 의미가 일치하거나(재사용 의도) 신규라 충돌이 없다. `POST /api/users/me/avatar` 는 애초에 spec 이 취소선으로 예약해 둔 경로를 구현 완료로 전환한 것이라 오히려 정합성이 높은 사례다. 유일하게 주의를 요하는 지점은 target 스코프 밖(코드·`spec/data-flow/4-file-storage.md`)에서 도입된 `s3.publicBaseUrl`/`S3_PUBLIC_BASE_URL` 이 과거 금지된 phantom key(`app.publicBaseUrl`/bare `publicBaseUrl`)와 leaf 이름이 겹치는 것인데, 네임스페이스·env var·용도가 모두 다르고 PR 스스로 "근접 명명 주의" 문단 + 기존 회귀 테스트(`triggers.service.spec.ts`)로 이미 구분·방어해 두었다. 실질적 충돌(CRITICAL)은 없다.

## 위험도
LOW
