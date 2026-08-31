# 신규 식별자 충돌 검토 — 아바타 업로드 공개 URL (spec/5-system/, impl-done)

## 전제

- 이번 검토는 `--impl-done`(scope=`spec/5-system/`, diff-base=`origin/main`)이며, `spec/5-system/` 자체의 diff 는 **0개 파일**이다(정상 — 이 브랜치는 코드 전용 변경).
- 구현 diff 는 15개 파일 / 약 1977줄로, 아바타 이미지 업로드(`POST /api/users/me/avatar`)와 S3 공개 URL 서빙(`S3_PUBLIC_BASE_URL`)을 신설한다.
- "새 식별자"의 검증 대상은 diff(`+` 라인)와 워킹트리 절대경로(`git -C <worktree> grep`)로 직접 실측했다 — CWD 캐시나 프롬프트 요약에 의존하지 않았다.
- 아래 발견사항 중 다수는 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md`(planner 트랙)에 추적 중이다. 중복 지적이 아니라 **naming-collision 관점에서 재확인**한 결과이며, 해당 문서에 없는 새 관찰은 별도로 표시했다.

---

## 발견사항

### [WARNING] `s3.publicBaseUrl` / `S3_PUBLIC_BASE_URL` 이 "존재하면 안 되는 이름"으로 취급되던 leaf 이름을 재사용

- target 신규 식별자: config key `s3.publicBaseUrl` (env `S3_PUBLIC_BASE_URL`) — `codebase/backend/src/common/config/s3.config.ts:57`, `.env.example:705`
- 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1379-1397` — webhook `callbackUrl` 조립 회귀 방지 테스트. 과거 실제 장애(Telegram `setWebhook` 거부)를 낸 원인이 `app.publicBaseUrl` / 접두 없는 `publicBaseUrl` 이라는 **미등록 config key** 를 실수로 참조한 것이었고, 그 테스트는 지금도 `publicBaseUrl` 이라는 leaf 이름이 나오면 "쓰면 안 되는 값" 임을 canary 로 고정하고 있다(canonical 은 `app.url`).
- 상세: 이번 PR 이 신설한 `s3.publicBaseUrl` 은 네임스페이스(`s3.*`)가 달라 기능적으로 충돌하지 않는다(`ConfigService.get('s3.publicBaseUrl')` vs `get('app.url')`). 그러나 의미가 전혀 다른 두 개념 — "웹훅 콜백에 쓰는 API 서버의 공개 URL"(`app.url`, `publicBaseUrl` 이름은 오히려 **금지 대상**)과 "S3 오브젝트를 브라우저가 가져갈 공개 URL"(`s3.publicBaseUrl`, 이번에 신설) — 이 같은 leaf 이름 `publicBaseUrl` 을 공유하게 됐다. grep 만으로는 두 의미를 구분할 수 없고, "publicBaseUrl 이면 안 된다"는 과거 교훈을 아는 사람이 새 `s3.publicBaseUrl` 을 보고 오히려 의심하거나, 반대로 새 이름에 익숙해진 사람이 나중에 `app.publicBaseUrl` 류의 별칭을 다시 만들 위험이 있다.
- 제안: 이 자체를 rename 할 필요는 없다(네임스페이스로 이미 구분됨) — 다만 `s3.config.ts` 의 JSDoc 이나 `triggers.service.spec.ts` 의 canary 주석에 상호 참조 한 줄("이 `publicBaseUrl` 은 S3 전용이며 `app.url` 과 무관"/"이 canary 의 `publicBaseUrl` 은 `s3.publicBaseUrl` 과 무관한 webhook 콜백 URL")을 남겨 두면 향후 grep 기반 조사에서의 혼동을 막을 수 있다.

### [WARNING] 신규 S3 키 포맷이 spec 에 이미 문서화된 "계획" 포맷과 다름 (교차 확인 — 이미 plan 추적 중)

- target 신규 식별자: S3 오브젝트 키 포맷 `avatars/{userId}/{uuid}.{ext}` (`codebase/backend/src/modules/users/users.service.ts` `avatarKeyPrefix`/`updateAvatar`)
- 기존 사용처: `spec/0-overview.md:257-276` §2.7 버킷 구조 — `{workspaceId}/avatars/{userId}.{ext}` 를 "계획(코드 미구현)"으로 명시. `spec/data-flow/4-file-storage.md:56-60` §1.2 도 동일 포맷을 참조하며 "Form 노드와 Avatar 기능이 도입될 때 본 문서를 갱신한다"고 예고.
- 상세: 실제 구현 키는 spec 이 예고한 포맷과 **세 군데**가 다르다 — (1) `{workspaceId}/` 접두 부재(코드 주석: "User 는 워크스페이스 종속 리소스가 아니다"), (2) `avatars/` 가 `kb/` 처럼 최상위 세그먼트로 승격(spec 은 `{workspaceId}/avatars/`), (3) 파일명이 `{userId}.{ext}` 가 아니라 `{userId}/{uuid}.{ext}`(접근 통제를 위한 UUID 추가). `spec/0-overview.md §2.7` 을 SoT 삼아 버킷 정책을 `{workspaceId}/avatars/` 접두로 설계하면 실제 객체(`avatars/...`)에는 정책이 걸리지 않아 "업로드는 성공, 이미지는 403" 이 재현된다 — 이는 CHANGELOG 에서도 반복 경고하는 바로 그 실패 모드다.
- 이미 추적됨: `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 이 정확한 갭(`0-overview.md §2.7` + `data-flow/4-file-storage.md` §1.1/§1.2/§2.1/§2.2/§2.3)을 planner 할 일로 명시하고 "왜 Critical 인가"까지 적어 두었다. developer 가 spec 을 직접 고칠 권한이 없어(제품 정의 서술이라 자기-반증형 소정정 예외에도 미해당) planner 턴으로 위임된 상태다.
- 제안: 새로운 조치는 불필요 — 위 plan 항목이 머지되기 전까지는 `spec/0-overview.md §2.7`·`spec/data-flow/4-file-storage.md` 를 avatar 키 설계의 SoT 로 오인하지 않도록 코드 리뷰/운영 배포 체크리스트에서 재확인만 권장.

### [INFO] `INVALID_FILE_TYPE`·`FILE_REQUIRED` 가 `spec/5-system/3-error-handling.md` 카탈로그에 미등재 (교차 확인 — 이미 plan 추적 중)

- target 신규 식별자: 에러 코드 `INVALID_FILE_TYPE`(`users.service.ts:115`) · `FILE_REQUIRED`(`users.service.ts:95`)
- 기존 사용처: `INVALID_FILE_TYPE` 은 이미 `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:928` 가 KB 문서 확장자 화이트리스트 불일치(400)에 쓰고 있고, `spec/data-flow/4-file-storage.md:52` 에도 문서화돼 있다. 두 발행처의 의미는 "허용되지 않는 파일 확장자"로 동일해 **다른 의미로 충돌하는 것은 아니다** — 그러나 어느 쪽도 `spec/5-system/3-error-handling.md` §1.3(유효성 검증 에러 카탈로그)에는 등재돼 있지 않다(§1.3 표를 전량 확인함). `FILE_REQUIRED` 는 이번 PR 이 처음 도입하는 완전히 새 코드로, 카탈로그에 당연히 없다.
- 상세: 카탈로그 미등재 자체는 이번 리뷰 관점(신규 식별자 "충돌")의 핵심은 아니지만, `INVALID_FILE_TYPE` 이 두 모듈에서 공용되는 사실이 문서 어디에도 "공용 코드" 로 명시되지 않은 상태라 다음에 세 번째 발행처가 생기면 의미가 갈릴 위험(예: 다른 곳에서 이 코드를 "MIME 불일치" 같은 다른 의미로 재사용)이 있다.
- 이미 추적됨: `plan/in-progress/spec-update-avatar-upload-implemented.md` 할 일 목록이 "`spec/5-system/3-error-handling.md` §1 에러 카탈로그에 `FILE_REQUIRED`(파일 누락)과 `INVALID_FILE_TYPE`(확장자 불허, knowledge-base 와 공용) 등재"를 명시적으로 포함한다.
- 제안: 위 plan 항목 처리 시 §1.3 등재 문구에 "KB 문서 업로드와 공용 코드"임을 명시해, 향후 세 번째 발행처가 의미를 갈라 쓰지 않도록 고정할 것을 권장.

### [INFO] `Express` → `ExpressNS` import alias 변경 — 이 컨트롤러 한정, 컨벤션 비대칭

- target 신규 식별자: `users.controller.ts` 의 default import 별칭 `ExpressNS`(`import ExpressNS from 'express'`)
- 기존 사용처: 같은 파일의 `changePassword`·`verifyEmailChange` 가 종전에 쓰던 `Express.Request`/`Express.Response` 표기, 그리고 다른 컨트롤러 4곳(코드 주석이 스스로 명시)이 여전히 쓰는 `import Express from 'express'` 관례.
- 상세: `@types/multer` 가 전역 `Express` 네임스페이스에 `Express.Multer.File` 을 augment 하는데, 로컬 `import Express from 'express'` (default import) 가 그 전역 이름을 가려 `Express.Multer.File` 타입을 쓸 수 없게 되는 실제 네임스페이스 충돌을 해결하기 위한 조치다. 코드 주석이 원인과 범위를 정확히 설명하고 있고("다른 컨트롤러 4곳은 Multer 타입을 쓰지 않아 `Express` 그대로다 — 전역 컨벤션으로 승격하려면 `spec/conventions/` 문서화가 선행돼야 한다"), 이번 PR 은 그 승격을 하지 않았으므로 **의도적으로 로컬 스코프에 한정**돼 있다. 새로운 문제라기보다는, "파일 업로드 컨트롤러를 늘릴 때 같은 충돌이 재발한다"는 사실을 알리는 차원의 기록.
- 제안: 조치 불요(주석이 이미 범위와 후속 조건을 명시). 향후 Multer 를 쓰는 두 번째 컨트롤러가 생기면 이 시점에 `spec/conventions/`(예: import 별칭 규약) 문서화를 검토할 것을 권장.

---

## 확인했으나 충돌 없음 (참고)

- **API endpoint**: `POST /api/users/me/avatar` — 코드베이스 전체에서 이 라우트를 등록하는 곳은 `users.controller.ts` 한 곳뿐이며, `spec/2-navigation/9-user-profile.md:334` 가 이미 이 정확한 method+path 를 "미구현(Planned)"으로 예약해 둔 것과 정확히 일치한다(strikethrough 예정 표기). 충돌 아님 — 예고된 자리를 채운 것.
- **새 static 상수** `UsersService.AVATAR_MAX_BYTES`·`AVATAR_CONTENT_TYPES`·`LOGIN_LOCK_THRESHOLD`·`LOGIN_LOCK_MINUTES`: 전부 `UsersService` 스코프에 최초 도입, 동명 상수가 frontend/backend 어디에도 없음.
- **새 함수** `S3Service.getPublicUrl`·`resolvePublicBaseUrl`·`shouldWarnPublicBaseIsPrivate`: 코드베이스 전수 검색 결과 이번 PR 이 도입한 정의 외 다른 정의·다른 의미의 동명 함수 없음.
- **환경변수** `S3_PUBLIC_BASE_URL`: `.env.example`·`docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/overlays/{prod,staging,local}`·`README.md`·`CHANGELOG.md` 에 일관되게 이 PR 의 의미로만 등장. 기존 다른 의미의 동명 변수 없음.
- **큐/이벤트/웹훅 이름**: 이번 diff 는 신규 큐·WS 이벤트·webhook 이벤트명을 도입하지 않는다(BullMQ·SSE·webhook 표면 무변경).
- **파일 경로(spec 문서 자체)**: `spec/5-system/` 에 신규 `.md` 파일 추가 없음(diff 0). 코드 신규 파일(`s3.config.spec.ts`·`users-avatar.service.spec.ts`·`users-avatar-swagger-sync.spec.ts`·`users-login-attempts.service.spec.ts`·`users-avatar-upload.e2e-spec.ts`)은 모두 기존 명명 컨벤션(`<module>.spec.ts`/`<module>.e2e-spec.ts`)을 따르고, 동명 기존 파일과 겹치지 않는다.

---

## 요약

이번 PR 이 실제 코드에 도입한 신규 식별자(엔드포인트 `POST /api/users/me/avatar`, 에러 코드 `FILE_REQUIRED`/`INVALID_FILE_TYPE`, 함수 `getPublicUrl`/`resolvePublicBaseUrl`/`shouldWarnPublicBaseIsPrivate`, 상수 `AVATAR_MAX_BYTES` 등, 환경변수 `S3_PUBLIC_BASE_URL`)는 코드베이스 전수 검색 기준으로 **"동일 식별자가 다른 의미로 이미 사용 중"인 진짜 CRITICAL 충돌은 없다**. 다만 (1) 신설 config key `s3.publicBaseUrl` 이 과거 실제 장애를 낸 "쓰면 안 되는 이름" `app.publicBaseUrl`/bare `publicBaseUrl` 과 leaf 이름을 공유해 향후 grep 기반 조사 시 혼동 소지가 있고, (2) 신설 S3 키 포맷이 `spec/0-overview.md §2.7`·`spec/data-flow/4-file-storage.md` 에 문서화된 "계획" 포맷과 다르며(이미 별도 planner 트랙 plan 에 Critical 로 추적 중), (3) `INVALID_FILE_TYPE` 코드가 KB 모듈과 미문서화 상태로 공용되고 있다(역시 같은 plan 에 등재 예정). 전부 새로운 차단 사유는 아니며, (2)·(3)은 기존에 이미 정확히 인지·추적되고 있는 항목의 재확인이다.

## 위험도

LOW
