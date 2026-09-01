# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 이전 4라운드(2026-08-31)에서 CRITICAL 로 지적된 lost-update(전체 엔티티 `save()`)는 컬럼 단위 `update()` 로 이미 해소되었고 그 사실을 이번 라운드에서 소스·테스트 양쪽으로 재검증했다. 남은 위험은 (1) 아바타 정리 불변식을 우회하는 미검증 경로(`AuthOAuthService.resolveUser()`), (2) 핵심 보안 통제(MinIO 공개 버킷 정책)의 자동화 테스트 부재, (3) "빈 파일" 테스트가 실제로는 다른 조건을 검증하는 뮤테이션 생존 갭 — 이 세 WARNING 이 MEDIUM 판정의 근거다. 라우터 강제(forced) 화이트리스트 8개 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side-Effect | `UsersService.update()`(17개 호출부 공유 진입점)에 새로 심어진 "avatarUrl 변경 시 옛 S3 객체 정리" 불변식을, diff 밖의 기존 코드 `AuthOAuthService.resolveUser()` 가 raw `QueryBuilder.update()` 로 `avatarUrl` 컬럼을 직접 써 우회한다. 오늘은 `byEmail.avatarUrl ?? profile.avatarUrl ?? undefined` 우선순위 때문에 트리거되지 않지만, 그 우선순위가 바뀌면 신규 회귀 테스트(전부 `UsersService.update()`/`updateAvatar()` 경유만 검증) 중 어느 것도 orphan 생성을 잡지 못한다. 이 우회를 지키는 캐너리 테스트는 실제로 존재하지 않는다(grep 0건) — plan 문서의 "캐너리로 감지 중" 서술은 자동 가드가 아니라 서술적 표현이다. | `codebase/backend/src/modules/users/users.service.ts` `update()`(약 234~248행) ↔ `codebase/backend/src/modules/auth/auth-oauth.service.ts` `resolveUser()`(약 390~401행) | 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` 에 재개 신호와 함께 유예된 트레이드오프이나, 최소한 `resolveUser()` 근처에 "avatarUrl 을 직접 쓰는 다른 경로가 생기면 정리 불변식이 깨진다"는 경고 주석 또는 우선순위 반전에도 orphan 이 안 생기는지 확인하는 캐너리 테스트 추가를 권장 |
| 2 | Testing | MinIO 공개 버킷 정책(`avatars-public-read.json`)의 실제 동작(익명 GET 200 / ListBucket 403)을 검증하는 자동화 테스트가 없다 — 수동 curl 재현 명령만 `scripts/minio/README.md` 에 문서화되어 있다. 이 기능이 스스로 규정한 3대 핵심 위험 중 "키 추측 불가능성(접근 통제)" 을 실제로 강제하는 인프라 설정에 회귀 보호가 전혀 없어, 정책 파일이나 compose 커맨드가 실수로 되돌아가도 유닛 테스트(S3Service 전량 mock)는 GREEN 을 유지한다. | `scripts/minio/avatars-public-read.json`, `docker-compose.yml:59-76`, `docker-compose.e2e.yml:87-96` — 자동 테스트 파일 부재(`find codebase/backend/test -iname '*avatar*'` 0건) | e2e 스위트에 최소 1개 스펙 추가: 업로드 후 응답 `avatarUrl` 을 익명 fetch로 GET(200 기대), 같은 버킷을 `?list-type=2&prefix=avatars` 로 익명 GET(403 기대) |
| 3 | Testing | "빈 파일을 거부한다" 테스트가 이름과 달리 **파일 부재**(`file===undefined`)만 검증하고, 코드가 실제로 막는 "파일은 있으나 buffer.length===0" 분기를 가르지 못한다. `!file?.buffer?.length` 를 `!file` 로 뮤테이션해도(빈 버퍼 방어를 완전히 제거해도) 이 테스트는 여전히 GREEN — 뮤테이션 생존 가능한 갭이다. 이 PR 의 다른 테스트들은 정확히 이런 "분기를 못 가르는 fixture" 문제를 실측 주석으로 방지해 왔는데 이 가드에는 동일 기준이 적용되지 않았다. | `codebase/backend/src/modules/users/users-avatar.service.spec.ts:145-151` ↔ 대상 가드 `codebase/backend/src/modules/users/users.service.ts:83`(`if (!file?.buffer?.length)`) | `{ originalname: 'me.png', buffer: Buffer.alloc(0), mimetype: 'image/png' }` 형태의 실제 "파일은 있는데 빈 버퍼" 케이스 추가 |
| 4 | 동시성/보안(병합) | `avatarUrl` 컬럼 자체에 대한 TOCTOU 레이스가 `updateAvatar()`·`update()` 두 진입점 모두에 남아있다 — 동시 업로드/동시 PATCH 시 last-writer-wins 로 승자가 임의 결정되고, 패자가 새로 올린 S3 객체는 어떤 정리 로직도 대상으로 잡지 못해 영구 고아로 남는다. 독립 재구성 결과 DB row 정합성 파괴(깨진 참조)는 없음을 확인했으나, 스토리지 비용/남용 벡터로는 유효하다. | `codebase/backend/src/modules/users/users.service.ts:79-149`(`updateAvatar`), `:234-248`(`update`) | 이미 `plan/in-progress/spec-sync-user-profile-gaps.md`(§동시 업로드 TOCTOU)에 재개 신호(고아 객체 수가 사용자 수를 유의미하게 초과)와 함께 유예됨 — 그 항목에 "`update()`(PATCH) 와의 교차 인터리빙도 같은 클래스"임을 명시적으로 보강 권장. 재개 신호를 수동 관측 대신 정기 배치 집계로 자동화하면 더 좋음 |
| 5 | Maintainability | `import ExpressNS from 'express'` 리네임이 코드베이스 전역 컨벤션과 어긋난다 — 같은 저장소의 4개 파일(`auth.controller.ts`, `sessions.controller.ts`, `webauthn.controller.ts`, `workflow-assistant.controller.ts`)은 여전히 `Express` 로 default import 한다. 리네임 근거(`@types/multer` 의 `Express.Multer.File` 이 로컬 `Express` 바인딩에 가려짐) 자체는 타당하지만 `spec/conventions/` 에 이 규칙이 문서화되어 있지 않다. | `codebase/backend/src/modules/users/users.controller.ts:57` | 급하지 않음. 다음 리팩터 시 "Multer 파일 파라미터가 있는 컨트롤러는 `ExpressNS` 를 쓴다" 같은 규칙을 convention 문서 또는 최소 import 주석에 명시 |
| 6 | Documentation | plan 문서 두 곳이 인용하는 회귀 테스트 건수 "30건"이 실측(`jest --silent users-avatar.service.spec.ts` → 35 passed)과 어긋난다 — 3라운드에서 13건→30건으로 한 번 정정됐던 것이, 4라운드가 테스트 5건(확장자 `it.each` 전수화 +4, 대문자 확장자 양성 +1)을 추가하면서 다시 stale 해졌고 그 사이 문서화 리뷰가 재검증 없이 통과시켰다. | `plan/in-progress/spec-sync-user-profile-gaps.md:41`, `plan/in-progress/spec-update-avatar-upload-implemented.md:89-90` | "30건" → "35건"으로 실측치 정정, 또는 반복적으로 stale 해지지 않도록 하드코딩 숫자를 빼고 "정확한 건수는 `jest --silent <file>` 로 확인" 문구만 남기는 방식 권장 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `POST /api/users/me/avatar` 가 완전히 구현되고(회귀 테스트 35건 통과) Swagger 계약까지 갖췄음에도 spec 이 여전히 "미구현 (Planned)" 으로 서술한다. | `spec/2-navigation/9-user-profile.md` §2.1(아바타 행, 약136행), §6.1 표(약334행) | 코드 유지. `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 두 지점을 이미 planner 트랙 할 일로 등록 — planner 턴에서 갱신 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] 스토리지 레이아웃이 아바타 키를 `{workspaceId}/avatars/{userId}.{ext}` 로 서술하지만 실제 구현 키는 `avatars/{userId}/{uuid}.{ext}` — `workspaceId` 없음, 파일명이 UUID. 이 drift 는 버킷 정책 설계를 오도할 실질 위험이 있다(spec 을 SoT 삼아 정책을 만들면 실제 객체가 그 정책 밖이 됨). 실측: `scripts/minio/avatars-public-read.json` 은 구현 키를 따르고 있어 코드/인프라는 일치, spec 만 어긋남. | `spec/0-overview.md` 스토리지 레이아웃 트리 및 "Form 노드 업로드/Avatar" 표(약269, 276행) | 코드 유지. 동일 plan 문서에 위임됨 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] 아바타를 "spec 정의, 미구현"으로, 키 패턴을 `<workspaceId>/avatars/<userId>.<ext>` 로, `avatar_url` 컬럼을 "외부 URL 또는 빈 값"으로 서술 — 셋 다 구현과 어긋남(자체 업로드 공개 URL 도 이제 담김). `s3.publicBaseUrl` 신규 설정 필드도 §2.3 매핑 표에 없음. | `spec/data-flow/4-file-storage.md:55-59,71,78` | 코드 유지. 동일 plan 문서에 위임됨 |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] 신규 `FILE_REQUIRED` 와 아바타 컨텍스트의 `INVALID_FILE_TYPE` 발행처가 중앙 에러 카탈로그에 등재되어 있지 않다(`INVALID_FILE_TYPE` 자체는 KB 문맥으로만 등재됨). 413 처리는 기존 전역 `PAYLOAD_TOO_LARGE` 매핑을 그대로 재사용해 Rationale 과 일치 — 별도 코드 불필요. | `spec/5-system/3-error-handling.md` §1 에러 카탈로그 ↔ `codebase/backend/src/modules/users/users.service.ts` `updateAvatar` throw 지점 | 코드 유지. 동일 plan 문서에 등재됨 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 업로드 바이트가 실제 유효한 이미지인지 매직바이트 검증 없음(확장자+서버강제 Content-Type 조합이 stored-XSS 는 막지만 임의 바이너리 배포 남용은 못 막음) | `users.service.ts` `updateAvatar()` 확장자 판정 블록(97~111행) | 이미 유예됨(서버측 이미지 처리 도입 시 재개). `sharp`/`file-type` 매직바이트 검증 추가 고려 |
| 2 | Performance | multer 기본 `MemoryStorage` 로 요청마다 파일 전체가 힙 버퍼에 적재 — 2MB 상한+전역 스로틀로 위험 낮음 | `users.controller.ts:150-160`(`FileInterceptor`) | 조치 불요. 더 큰 파일 재사용 계획 시 diskStorage/스트리밍 검토 |
| 3 | Performance/Architecture/Dependency | `S3Service` 가 `UsersModule`·`KnowledgeBaseModule` 에 각각 로컬 provider 로 등록돼 `S3Client` 커넥션 풀이 중복 생성됨(싱글톤이라 요청 경로엔 영향 없음, 기존 KB 모듈 컨벤션 재사용) | `users.module.ts:19-25` | 조치 불요. 3번째 소비 모듈 등장 시 공유 `S3Module` export 승격 검토 |
| 4 | Security | 공개 아바타 응답에 `X-Content-Type-Options: nosniff` 미설정(주 방어가 견고해 실질 위험 낮음) | `s3.service.ts` `upload()`(53~67행) | 방어 심화로 고려 가능, 급하지 않음 |
| 5 | Architecture/Maintainability/Side-Effect | `S3Service` 생성자의 `publicBaseUrl` 2차 폴백(`?? endpoint`)이 "SoT 는 config 한 곳" 주석과 실제로는 어긋남 — 정상 부팅 경로에선 도달 불가하나 `ConfigService` 부분 mock 조립에서는 조용히 내부 SDK 주소(`endpoint`)로 대체되는 실제 분기 | `s3.service.ts` 생성자(약40~41행) | 주석을 "1차 config / 2차 생성자 방어"로 정정하거나 `?? endpoint` 제거해 단일 SoT 강제 |
| 6 | Security | `S3_PUBLIC_BASE_URL` 미설정 시 production 에서도 `localhost` 까지 폴백 가능 — throw 아닌 warn(기존 `ALLOW_PRIVATE_HOST_TARGETS` 패턴과 동일 의도적 설계) | `main.ts:160-172` | CHANGELOG·k8s overlay·`.env.example` 세 곳에 이미 경고 문서화됨, 조치 불요 |
| 7 | Architecture | `UsersService` 가 프로필 CRUD 외에 S3 오케스트레이션(키 생성, 정리, URL 역파싱)까지 겸해 SRP 가 흐려지는 추세 | `users.service.ts` `updateAvatar()`/`deletePreviousAvatarObject()`/`avatarKeyPrefix()` | `UserAvatarService` 분리안이 이미 재개 신호와 함께 plan 에 유예 등재됨. 두 번째 S3 소비 사용자-리소스 등장 시 분리 |
| 8 | Scope | `Express`→`ExpressNS` 리네임이 무관한 기존 엔드포인트 2곳(`changePassword`,`verifyEmailChange`)까지 diff 에 포함시킴(기술적으로 불가피, CHANGELOG·plan 에 disclose됨) | `users.controller.ts:57,217-218,304-305` | 조치 불요. 커밋 메시지에 한 줄 언급 권장 |
| 9 | Maintainability | Swagger 설명 문자열에 "최대 2MB" 매직 리터럴이 3곳 하드코딩(회귀 테스트가 전수 매칭으로 방어 중이라 급하지 않음) | `users.controller.ts` `uploadAvatar` 의 `@ApiOperation`/`@ApiBody`/`@ApiPayloadTooLargeResponse` | 템플릿 리터럴로 상수 참조하면 동기화 테스트 자체가 불필요해짐(선택) |
| 10 | Testing | `UsersService.update()` 의 아바타 정리 조건이 "다른 URL로 교체" 케이스만 테스트되고 "avatarUrl 을 null 로 제거" 케이스는 테스트되지 않음(값 비교만 다르므로 실패 위험 낮음) | `users-avatar.service.spec.ts:270-325` | `it('avatarUrl 을 null 로 지워도 옛 객체를 정리한다', ...)` 케이스 1개 추가(우선순위 낮음) |
| 11 | Documentation | `S3Service.getPublicUrl` JSDoc 에 `@returns` 설명 누락(3라운드부터 낮은 우선순위로 미조치 유지) | `s3.service.ts:69-86` | 선택 사항 |
| 12 | User Guide Sync | 프런트엔드에 아바타 업로드를 소비하는 UI/코드가 아직 없어 user-guide MDX 갱신은 회색지대(확정 gap 아님) | `codebase/frontend/src/content/docs/**`(매칭 0건) | 소비 UI 등장 시 재평가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 인증/IDOR/키 열거/lost-update/경로이탈 방어 전부 확인됨. 매직바이트 검증 부재·TOCTOU 고아객체는 이미 유예된 잔여 항목 |
| performance | LOW | N+1/O(n²) 없음, DB 쓰기 컬럼단위로 최소화됨. multer 메모리 스토리지·S3Client 중복 생성은 저위험 INFO |
| architecture | LOW | 이전 라운드 WARNING(폴백 SoT drift)이 `resolvePublicBaseUrl` 추출로 실제 해소됨을 재검증. 남은 항목은 전부 유예 등재된 것 |
| requirement | LOW | 핵심 비즈니스 규칙 3축(UUID 키/서버강제 Content-Type/저장후정리) 전부 테스트로 고정. 4건 SPEC-DRIFT 는 코드 아닌 spec 이 낡은 것 |
| scope | LOW | 핵심 변경이 의도된 범위에 정확히 부합. 부수 변경(Express 리네임 등) 전부 disclose·최소화됨 |
| side_effect | **MEDIUM** | lost-update 는 해소됨. `AuthOAuthService.resolveUser()` 가 avatarUrl 정리 불변식을 캐너리 테스트 없이 우회하는 경로가 유효한 잔여 위험 |
| maintainability | LOW | 전반적으로 양호. `ExpressNS` 컨벤션 불일치가 유일한 WARNING |
| testing | **MEDIUM** | 서비스 로직 테스트는 촘촘하나, (1) 버킷 정책 자동화 테스트 부재, (2) "빈 파일" 테스트가 실제 조건을 가르지 못하는 뮤테이션 생존 갭 발견 |
| documentation | LOW | 문서화 밀도 높음. plan 의 회귀 테스트 "30건"이 실측 35건과 어긋나는 재발성 drift 발견 |
| dependency | NONE | 신규 패키지 0건, 모든 신규 기능이 기존 의존성으로 구현됨. `multer` 는 override 로 이미 고정 |
| database | NONE | 신규 마이그레이션/스키마 변경 없음, N+1 없음, lost-update 해소 재확인. TOCTOU 는 별도 트래커에 이미 등재 |
| concurrency | LOW | 컬럼단위 update·저장후정리 순서로 핵심 경쟁 제거됨. avatarUrl 자체 TOCTOU 는 이미 유예된 항목(재확인만) |
| api_contract | LOW | 응답 봉투/상태코드/에러코드 구조가 형제 엔드포인트와 일관. 에러 카탈로그 미등재·spec "Planned" 배지는 이미 추적 중 |
| user_guide_sync | NONE | README.md·CHANGELOG.md 갱신을 실측 확인(이전 라운드 WARNING 해소). 확정 gap 없음 |

## 발견 없는 에이전트

- dependency — 실질적 결함 없음(전부 확인/긍정 서술)
- user_guide_sync — 확정 gap 없음(회색지대 1건은 소비 UI 부재로 인한 정상 보류)

## 권장 조치사항

1. (WARNING #2, testing) MinIO 공개 버킷 정책의 실제 동작(익명 GET 200 / ListBucket 403)을 검증하는 e2e 테스트 최소 1개 추가 — 이 기능의 핵심 보안 통제가 지금은 수동 curl 재현에만 의존한다.
2. (WARNING #1, side_effect) `AuthOAuthService.resolveUser()` 의 raw `QueryBuilder` 쓰기가 아바타 정리 불변식을 우회하는 지점에 경고 주석 추가 또는 캐너리 테스트 신설 — 우선순위 반전 시 조용한 orphan 경로가 된다.
3. (WARNING #3, testing) "빈 파일을 거부한다" 테스트에 실제 "파일은 있으나 buffer.length===0" 케이스 추가 — 현재 뮤테이션 생존 가능.
4. (WARNING #6, documentation) plan 문서의 회귀 테스트 건수 "30건"을 실측 "35건"으로 정정하거나 하드코딩 숫자 대신 검증 명령만 남기는 형태로 변경.
5. (WARNING #5, maintainability) `ExpressNS` 리네임 규칙을 convention 문서 또는 import 주석에 명시.
6. (WARNING #4, concurrency/security) `plan/in-progress/spec-sync-user-profile-gaps.md` 의 TOCTOU 유예 항목에 "`update()`(PATCH) 와의 교차 인터리빙도 같은 클래스"임을 보강 기재.
7. (SPEC-DRIFT 4건) `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 이미 올바르게 추적 중 — planner 턴에서 `spec/2-navigation/9-user-profile.md`·`spec/0-overview.md`·`spec/data-flow/4-file-storage.md`·`spec/5-system/3-error-handling.md` 4개 문서를 실제 구현(키 패턴·에러 카탈로그 포함)에 맞춰 갱신.
8. (INFO 다수) 급하지 않음 — nosniff 헤더, `S3Service` 이중 폴백 주석 정정, `S3Client` 모듈 중복 등은 재개 신호 발생 시 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync` (14명, 전원)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — forced 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | 제외된 reviewer 없음 |