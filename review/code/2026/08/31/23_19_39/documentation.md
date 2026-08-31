# 문서화(Documentation) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `s3.config.ts`의 `publicBaseUrl` JSDoc이 가리키는 SoT가 아직 "미구현"으로 남아 있다
  - 위치: `codebase/backend/src/common/config/s3.config.ts:17`
  - 상세: `SoT: spec/2-navigation/9-user-profile.md §6.1 아바타 업로드.` 라고 적혀 있는데, 실제로 `spec/2-navigation/9-user-profile.md:334`는 이 PR이 구현한 기능을 여전히 `~~POST~~ ~~/api/users/me/avatar~~ | 아바타 이미지 파일 업로드 — 미구현 (Planned)` 로 서술한다(직접 확인). 지금 이 JSDoc을 따라 "SoT"를 열어 보는 사람은 코드와 정반대되는 정보(미구현)를 보게 된다. 이 자체는 developer 가 `spec/` 쓰기 권한 밖이라 planner 트랙(`plan/in-progress/spec-update-avatar-upload-implemented.md`)으로 올바르게 위임되어 있어 "실수"는 아니지만, 그 배지 flip 이 착지하기 전까지는 코드 JSDoc의 "SoT" 라는 표현이 오도한다.
  - 제안: 급하지 않으나, spec 배지 flip PR이 머지될 때까지는 JSDoc에 "spec 갱신 대기 중(plan/in-progress/spec-update-avatar-upload-implemented.md)" 같은 한 줄을 덧붙이거나, 최소한 이 상태를 알고 있는 채로 리뷰를 통과시킨다.

- **[WARNING]** plan 문서 두 곳의 회귀 테스트 건수가 실제 파일과 다르다 — 같은 커밋 안에서 자기모순
  - 위치: `plan/in-progress/spec-sync-user-profile-gaps.md:41` (`**회귀 테스트 13건 · 뮤테이션 6축 (예측 / 실측 — 전부 RED)**:`), `plan/in-progress/spec-update-avatar-upload-implemented.md:89` (`- 회귀: \`codebase/backend/src/modules/users/users-avatar.service.spec.ts\` (13건, 3축)`)
  - 상세: `codebase/backend/src/modules/users/users-avatar.service.spec.ts`의 실제 테스트 케이스 수를 세면(단독 `it(` 17개 + `it.each` 두 블록의 케이스 3개+7개) **27건**이다(실측: `grep`/`node` 스크립트로 카운트). "13건"은 그중 첫 `describe('UsersService.updateAvatar (§6.1 — 공개 URL 서빙)')` 블록(축1·2·3, 2+5+6=13개)만을 가리키는 숫자로 보이는데, 두 plan 문서 모두 이 숫자를 파일 전체의 "회귀" 규모로 인용한다. 더 결정적으로, `spec-sync-user-profile-gaps.md`의 같은 diff 안에 "리뷰 2라운드에서 유예한 두 건"과 함께 리뷰 라운드가 추가한 CRITICAL/WARNING 대응 테스트(정리 실패 시 500 방지·PATCH 경로 정리·lost-update·prototype-chain·404 메시지·OAuth 캐너리 — 이들이 나머지 14건을 구성)를 스스로 서술하면서도, 바로 위 "13건" 문구는 갱신하지 않았다. 다음에 이 plan을 읽고 커버리지 규모를 판단하는 사람이 실제보다 절반 이하로 과소평가하게 된다.
  - 제안: "13건, 3축"을 "27건(§6.1 핵심 3축 13건 + 리뷰 1·2라운드 대응 14건)"처럼 정정하거나, 최소한 "이 숫자는 최초 설계분만 포함한다"는 각주를 단다.

- **[INFO]** README.md의 `S3_PUBLIC_BASE_URL` 주석이 다른 문서 대비 배포 선행조건(버킷 정책)을 누락
  - 위치: `README.md:212`
  - 상세: `# 아바타 공개 URL 의 base — 브라우저가 도달하는 주소. 미설정 시 S3_ENDPOINT 로 폴백한다.` 한 줄뿐이다. 같은 값을 설명하는 `.env.example:150-163`, `k8s/README.md:183`, `CHANGELOG.md`는 모두 "`avatars/` 접두에 익명 GetObject만 허용하고 ListBucket은 막는 버킷 정책이 없으면 업로드는 성공하고 이미지만 403"이라는, 이 기능이 동작하려면 반드시 필요한 배포 선행조건을 명시한다. README.md는 로컬 개발 진입점으로 자주 먼저 열리는 문서인데(docker-compose가 정책을 자동 적용하므로 로컬에서는 문제되지 않지만) 이 경고가 빠져 있어, README만 보고 수동 배포/셋업하는 사람은 그 전제를 놓칠 수 있다.
  - 제안: `.env.example` 또는 `scripts/minio/README.md`를 가리키는 한 줄(`(버킷 정책 필요 — scripts/minio/README.md)`)만 추가해도 충분하다.

- **[INFO]** `AVATAR_MAX_BYTES` JSDoc과 `FileInterceptor` 옆 주석이 같은 관계를 다르게 서술
  - 위치: `codebase/backend/src/modules/users/users.service.ts:51` vs `codebase/backend/src/modules/users/users.controller.ts` (`limits: { fileSize: UsersService.AVATAR_MAX_BYTES }` 옆 주석)
  - 상세: `users.service.ts`의 `AVATAR_MAX_BYTES` JSDoc은 "컨트롤러의 multer 한도와 **같은 값이어야** 한다"라고 적어 마치 두 값이 독립적으로 유지보수돼야 하는 것처럼 읽힌다. 그런데 컨트롤러 쪽 주석은 정반대로 "상수를 **직접 참조**하므로 서비스와 갈릴 수 없다"고 명시한다(실제로도 `limits: { fileSize: UsersService.AVATAR_MAX_BYTES }`로 직접 참조). 같은 사실(값이 갈릴 수 없음을 참조로 보장)을 두 곳이 다른 프레이밍("~해야 한다" vs "~할 수 없다")으로 설명해 다음 사람이 "수동 동기화가 필요한 두 상수"로 오독할 여지가 있다.
  - 제안: `AVATAR_MAX_BYTES` JSDoc을 "컨트롤러의 multer `limits.fileSize`가 이 값을 직접 참조한다(리터럴 중복 아님)"로 바꿔 컨트롤러 쪽 주석과 프레이밍을 맞춘다.

- **[INFO]** `S3Service.getPublicUrl`의 JSDoc이 파라미터만 문서화하고 반환값 설명이 없음
  - 위치: `codebase/backend/src/common/services/s3.service.ts:84` (`@param key`) 부근, 메서드 시작 `:86`
  - 상세: 같은 파일의 `deleteMany` JSDoc은 반환 형태(`errored`)를 프로세스와 함께 설명하는데, `getPublicUrl`은 `@param`만 있고 반환값(조합된 URL의 형태·인코딩 규칙 등은 본문에 있지만 `@returns` 태그나 명시적 반환 설명은 없음)에 대한 짧은 언급이 빠져 있다.
  - 제안: 사소하지만 `@returns 공개 GET URL (base/bucket/encoded-key)` 한 줄을 추가하면 일관성이 좋아진다.

## 요약

전반적으로 이 PR의 문서화 수준은 이례적으로 높다 — CHANGELOG, README, `.env.example`, `k8s/README.md`/`configmap.yaml`, `scripts/minio/README.md`(신규), 그리고 `s3.config.ts`/`s3.service.ts`/`users.service.ts`의 JSDoc이 모두 "공개 버킷 + 공개 URL"이라는 제품 결정과 그 위험(키 추측 가능성·Content-Type 신뢰·lost update·정리 순서)을 일관되게, 그리고 실측(버킷 정책 `ListBucket` 노출 실증 등)을 곁들여 설명한다. spec 갱신은 developer 권한 밖이라 planner 트랙(`plan/in-progress/spec-update-avatar-upload-implemented.md`)으로 올바르게 위임된 점도 규약을 잘 따랐다. 다만 (1) 코드 JSDoc이 가리키는 spec SoT가 아직 "미구현"으로 남아 일시적으로 오도할 수 있고, (2) 두 plan 문서가 인용하는 회귀 테스트 "13건"이라는 숫자가 같은 커밋에서 서술하는 리뷰 2라운드 대응 테스트들을 반영하지 못해 실제(27건)보다 축소돼 있다는 점은 정정할 가치가 있다. 나머지는 표현 일관성 수준의 사소한 지적이다.

## 위험도
LOW
