# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건, WARNING 3건(신규 시계 비대칭 1건 미disclose · S3 업로드 실패 테스트 갭 1건 · 기존 유예된 동시 업로드 TOCTOU 1건 재확인). forced(router_safety) 화이트리스트 8명 전원 결과 확보됨 — 강제 포함 미이행 없음.

## Critical 발견사항

없음 — 8라운드에 걸친 리뷰-수정 사이클을 통해 이전 라운드가 지적한 CRITICAL(`incrementLoginAttempts`의 read-modify-write `save(user)`가 `updateAvatar`의 컬럼 단위 정리를 반대 방향에서 무효화하던 lost-update)이 원자적 `UPDATE ... RETURNING`으로 해소되었고, 이번 라운드 13개 reviewer 전원이 이를 소스 직접 확인으로 재검증했다. 신규 CRITICAL은 발견되지 않았다.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/보안 | 로그인 잠금 판정에 쓰기 클록(DB `NOW()`)과 읽기 클록(앱 서버 `new Date()`) 비대칭이 새로 생겼다 — `incrementLoginAttempts`는 이번 PR에서 DB 시계로 `locked_until`을 계산하도록 바뀌었지만, 그 값을 읽어 비교하는 `isLocked()`는 여전히 앱 서버 시계를 쓴다. 두 시계가 드리프트하면 실제 잠금 지속시간이 미묘하게 달라지며, CHANGELOG/plan 어디에도 disclose되어 있지 않다. | `codebase/backend/src/modules/users/users.service.ts` (`incrementLoginAttempts`, `isLocked`) | `isLocked()`도 DB 시계 기준으로 판정하거나(예: `SELECT NOW() > locked_until`), 최소한 이 비대칭을 주석/CHANGELOG에 명시 |
| 2 | 테스트 | `S3Service.upload()` 실패(외부 S3/MinIO 장애) 경로가 어떤 테스트에도 없다 — 이 스위트는 다른 축(삭제 실패, DB 갱신 실패)은 촘촘히 잠갔는데 업로드 자체 실패만 비어 있다. | `codebase/backend/src/modules/users/users.service.ts:131`, `users-avatar.service.spec.ts` | `upload.mockRejectedValue(...)` 케이스 추가 — 예외 전파(`rejects.toThrow`)와 `repo.update`/`s3.delete` 미호출을 단언 |
| 3 | 동시성 | `updateAvatar`/`update()` 자기 자신끼리의 `avatarUrl` 경합(더블클릭·다중 탭) — "패자"가 올린 S3 객체가 추적 불가능한 영구 고아로 남을 수 있다. DB 정합성 훼손은 없고 순수 스토리지 누수. **기존 발견 재확인** — `plan/in-progress/spec-sync-user-profile-gaps.md`에 측정 가능한 재개 신호(`avatars/` 접두 객체 수가 사용자 수를 유의미하게 웃돌 때)와 함께 명시적으로 유예 등재되어 있음. | `codebase/backend/src/modules/users/users.service.ts` (`updateAvatar`, `deletePreviousAvatarObject`, `update()`) | 현행 유예 유지는 근거 있음(우선순위 낮음). 필요시 `avatarUrl` 조건부 UPDATE 또는 `pg_advisory_xact_lock`으로 직렬화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/2-navigation/9-user-profile.md`가 `POST /api/users/me/avatar`를 여전히 "미구현 (Planned)"로 서술 — 구현은 완료되고 유닛+e2e로 뒷받침됨. developer 권한 밖이라 정상적으로 planner 트랙에 위임됨. | `spec/2-navigation/9-user-profile.md:334,136` | planner 턴에서 배지 flip + §6.1 계약 채우기 (`plan/in-progress/spec-update-avatar-upload-implemented.md` 참고) |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` 스토리지 키 레이아웃이 spec(`{workspaceId}/avatars/<userId>.<ext>`)과 실제 구현(`avatars/{userId}/{uuid}.{ext}`)이 어긋남 — `workspaceId` 접두 유무·파일명 형태 둘 다 다름. 실제 버킷 정책은 구현 키를 따라 일치하지만 spec만 stale해 운영자가 spec 기준으로 정책을 설계하면 403 위험. | `spec/0-overview.md`, `spec/data-flow/4-file-storage.md` §2.1/§2.3 | planner 턴에서 실제 키 패턴·`s3.publicBaseUrl` 설정 필드로 갱신 |
| 3 | SPEC-DRIFT | `[SPEC-DRIFT]` 신규 에러 코드 `FILE_REQUIRED`·아바타 컨텍스트 `INVALID_FILE_TYPE`이 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md` §1)에 미등재. 코드 자체는 표준 `{code,message}` 봉투를 지킴. | `spec/5-system/3-error-handling.md` §1 ↔ `users.service.ts` throw 지점 | planner 턴에서 카탈로그 등재 |
| 4 | 검증(동시성/DB) | 이전 라운드 CRITICAL(`incrementLoginAttempts`의 전체 엔티티 `save()`가 아바타 정리를 반대 방향에서 무효화)이 원자적 `UPDATE ... RETURNING`으로 해소, `users-login-attempts.service.spec.ts` 6건으로 회귀 고정됨 — security/architecture/requirement/database/concurrency 5개 reviewer가 공통 재확인 | `users.service.ts` (`incrementLoginAttempts`) | 조치 불필요(확인용 기록) |
| 5 | 보안 | 공개 버킷의 유일한 접근 통제(추측 불가능 UUID 키 + `GetObject`-only 정책, `ListBucket` 미허용)가 코드·인프라·e2e 3층에서 뒷받침됨 | `users.service.ts:130`, `scripts/minio/avatars-public-read.json`, `users-avatar-upload.e2e-spec.ts` | 조치 불필요 |
| 6 | 보안 | 인증/인가 경계 정확 — 컨트롤러 레벨 `JwtAuthGuard`, `payload.sub` 기반 self-scope, 응답 봉투 민감 필드(passwordHash 등) 미노출 | `users.controller.ts:65,194-199` | 조치 불필요 |
| 7 | 보안 | Content-Type 저장형 XSS 방어 — 확장자 화이트리스트 + 서버 강제 Content-Type + `hasOwnProperty` 프로토타입 오염 가드, SVG 의도적 제외 | `users.service.ts:100-118` | 조치 불필요 |
| 8 | 보안(유예) | 업로드 바이트 매직 넘버(파일 시그니처) 검증 없음 — 확장자만 검사. `plan/in-progress/spec-sync-user-profile-gaps.md`에 재개 신호와 함께 이미 유예 등재됨 | `users.service.ts` (`updateAvatar`) | 조치 불필요(서버측 이미지 처리 도입 시 재개) |
| 9 | 보안 | 아바타 업로드 전용 rate-limit 없음(전역 100회/분에만 의존) — 다른 민감 엔드포인트(email-change)는 `@Throttle` 명시, 이 엔드포인트는 없음 | `users.controller.ts` (`uploadAvatar`) | 낮은 우선순위, 필요시 `@Throttle` 추가 검토 |
| 10 | 아키텍처(기존 재확인) | `UsersService`가 CRUD+S3 오케스트레이션을 겸해 SRP가 흐려짐 — `UserAvatarService` 분리안이 plan에 측정 가능한 재개 신호와 함께 등재됨 | `users.service.ts` (`updateAvatar`, `deletePreviousAvatarObject` 등) | 조치 불필요(소비자 2개 될 때 분리) |
| 11 | 아키텍처(기존 재확인) | URL 생성(`S3Service.getPublicUrl`)과 역산(`UsersService.deletePreviousAvatarObject`)이 서로 다른 클래스에 비대칭으로 남아 인코딩 규칙 지식이 분산됨 | `s3.service.ts` ↔ `users.service.ts` | `UserAvatarService` 분리 시 함께 정리 |
| 12 | 아키텍처/의존성(기존 재확인) | `S3Service`가 소비 모듈(`UsersModule`,`KnowledgeBaseModule`)마다 지역 provider로 중복 등록 — 공유 `S3Module` 부재 | `users.module.ts` | 3번째 소비 모듈 생기면 공유 모듈 승격 검토 |
| 13 | 유지보수성/범위 | `Express`→`ExpressNS` 리네임이 `users.controller.ts` 한 곳에만 적용되어, 같은 패턴이 남은 4개 컨트롤러와 import 이름이 갈림(런타임 무영향, CHANGELOG/plan에 disclose됨) | `users.controller.ts:60` | 다음 Multer 사용 컨트롤러 추가 시 5곳 일괄 통일 검토 |
| 14 | 범위 | `incrementLoginAttempts` 전면 재작성이 "아바타 업로드" 이름표 밖 인증 로직을 건드리지만, 이 PR 자신이 만든 CRITICAL을 이 PR 범위 안에서 닫는 수정으로 plan에 반증 이력과 함께 투명하게 disclose됨(scope creep 아님) | `users.service.ts` (`incrementLoginAttempts`) | 조치 불필요 |
| 15 | 부작용 | 범용 `UsersService.update()`(호출부 17곳)가 조건부로 S3 삭제 네트워크 호출을 냄 — 현재 `avatarUrl`을 넘기는 호출부는 `PATCH /users/me` 1곳뿐이지만, 시그니처만으로는 S3 호출 가능성이 드러나지 않아 향후 새 호출부가 무심코 `avatarUrl`을 포함시키면 예상 못한 부작용을 겪을 수 있음(JSDoc으로 이미 disclose됨) | `users.service.ts` (`update()`) | 조치 불필요, 새 호출부 추가 시 리뷰 체크리스트에 반영 권장 |
| 16 | 유지보수성 | `updateAvatar` 한 메서드가 검증(2종)+I/O 오케스트레이션(업로드·DB 갱신·병렬 재조회/정리) 6단계를 전부 담당해 책임 범위가 넓음 | `users.service.ts:86-156` | 필요시 검증 부분(`resolveAvatarContentType`)을 헬퍼로 분리, 현재는 강제 리팩터 불필요 |
| 17 | 유지보수성 | `users-avatar.service.spec.ts` 안에서 동일한 `S3Service` mock 객체 리터럴이 6회 이상 반복 정의됨(상단 `setup()` 헬퍼 있음에도) | `users-avatar.service.spec.ts:58-64,252-256,298-302,356-360,432-436,470-476` | 공용 `makeS3Mock()` 팩토리로 통합 검토(필수 아님) |
| 18 | 테스트 | 파일 크기 상한 "정확히 경계값(2MB)"에서 성공하는 케이스가 없음 — 초과 거부만 e2e로 검증됨 | `users-avatar-upload.e2e-spec.ts:118-133` | 필요시 `Buffer.alloc(AVATAR_MAX_BYTES)` 200 기대 케이스 추가, 우선순위 낮음(multer 내부 로직) |
| 19 | 테스트 | `main.ts` 부팅 경고 **호출부** 배선 자체는 어떤 테스트도 실행하지 않음(판정 로직 `shouldWarnPublicBaseIsPrivate`는 8케이스로 촘촘히 고정됨) — 저장소 전반의 기존 한계, 이 PR이 새로 만든 결함 아님 | `main.ts` (부팅 경고 블록) | 필수 아님. 관련 주석에 "호출부 배선은 미검증"이라는 한 줄 부기 권장 |
| 20 | 동시성 | `auth-oauth.service.ts`의 `resolveUser()`가 raw QueryBuilder로 `avatarUrl`을 직접 써 이 PR이 신설한 정리 불변식을 우회 — 오늘은 값 우선순위 때문에 비활성(dormant), 소스 캐너리 테스트+plan(W8/W9)로 추적됨 | `auth-oauth.service.ts` (`resolveUser`, 약 390-401행) | 조치 불필요, `avatarUrl` 컬럼 writer 3곳(users.service.ts 2 + auth-oauth.service.ts 1) 인지 필요 |
| 21 | 데이터베이스 | `avatar_url` 컬럼 폭(500자)이 신규 URL 조합을 수용하기에 충분한 여유가 있음(실측 예시 ~150자) | `user.entity.ts:27` | 조치 불필요 |
| 22 | API 계약 | `USER_NOT_FOUND` 응답이 형제 엔드포인트와 `{code,message}` 형태로 일치함(과거 message 누락 지적이 해소된 상태 재확인) | `users.service.ts:122-127` | 조치 불필요 |
| 23 | API 계약 | 413/400/200 세 경로 모두 실제 HTTP 응답까지 e2e로 검증됨 | `users-avatar-upload.e2e-spec.ts:101-133` | 조치 불필요 |
| 24 | 의존성 | `package.json`/`pnpm-lock.yaml` 변경 없음 — 신규 외부 패키지 추가 없이 기존 의존성(`@aws-sdk/client-s3` 등)만 재사용, UUID는 `node:crypto randomUUID`(stdlib) 사용 | N/A (diff 없음) | 조치 불필요 |
| 25 | 유저가이드 동기화 | `backend-api-change` 매트릭스의 user-guide target(`password-and-sessions.mdx`)이 이번 changeset에는 없지만, FE 소비 UI가 아직 없어 지금 쓰면 `<ImplAnchor>` 실존 컨벤션 위반. plan에 정확한 대상 파일과 함께 선제 추적됨(누락 아님) | `plan/in-progress/spec-sync-user-profile-gaps.md:149-157` | FE 아바타 업로드 UI PR에서 `password-and-sessions.mdx` 동반 갱신 필수화 |
| 26 | 유저가이드 동기화 | `env-runtime-change` 매트릭스 target(README.md)은 동일 changeset 내에서 충족됨, `k8s/README.md`까지 추가 커버 | `README.md`, `k8s/README.md` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 Critical/Warning 없음. 접근 통제·인증·XSS 방어 검증됨. 매직넘버·TOCTOU·rate-limit은 기존 유예 |
| architecture | LOW | CRITICAL 수정이 쓰기 패턴 일관성도 개선. SRP·URL 비대칭·provider 중복은 기존 유예 재확인 |
| requirement | LOW | 코드 요구사항 완전 구현·CRITICAL 해소 재확인. SPEC-DRIFT 3건(엔드포인트 배지, 키 레이아웃, 에러 카탈로그) |
| scope | LOW | 143개 변경 파일 전부 단일 기능으로 수렴. Express 리네임·incrementLoginAttempts 재작성은 disclose된 정당한 collateral |
| side_effect | **MEDIUM** | 로그인 잠금 시계 비대칭(WARNING, 신규·미disclose). 그 외 update() 조건부 S3 호출은 이미 disclose |
| maintainability | LOW | Express 리네임 부분적용, updateAvatar 책임 범위, 테스트 mock 반복 — 전부 INFO |
| testing | LOW | S3 upload 실패 경로 테스트 갭(WARNING). 115건 회귀 스위트 전부 GREEN 실측 |
| documentation | NONE | CHANGELOG/README/k8s manifest/JSDoc 전반 이례적으로 높은 완성도. 에러 카탈로그 미등재만 INFO |
| dependency | NONE | package.json/lockfile 변경 없음, 신규 의존성 없음 |
| database | LOW | CRITICAL 해소 재확인, lost-update 컬럼 단위 갱신 일관됨. 남은 TOCTOU는 DB 정합성 훼손 없음 |
| concurrency | LOW | TOCTOU 고아 객체(WARNING, 기존 유예), auth-oauth dormant bypass(INFO, 캐너리+plan 추적) |
| api_contract | LOW | 응답/에러 봉투 형제 엔드포인트와 일치, 400/401/404/413 전부 e2e 검증. 에러 카탈로그 미등재만 INFO |
| user_guide_sync | LOW | 매칭 trigger 2개(backend-api-change, env-runtime-change) 모두 정상 처리·추적됨. 실제 누락 0건 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO(검증/참고) 항목을 보고했다. (문제 발견 0건이라는 의미의 "clean" 에이전트는 documentation·dependency 이며, 둘 다 위 참고 표에 확인 항목이 기재되어 있다.)

## 권장 조치사항

1. (WARNING #1) `isLocked()`를 DB 시계 기준으로 맞추거나(예: DB 측 `NOW() > locked_until` 판정), 최소한 이번에 생긴 DB/앱 서버 시계 비대칭을 주석·CHANGELOG에 명시한다 — 계정 잠금이라는 보안에 민감한 경로에서 disclose 없이 남은 유일한 신규 갭이다.
2. (WARNING #2) `S3Service.upload()` reject 케이스를 `users-avatar.service.spec.ts`에 추가해 예외 전파와 `repo.update`/`s3.delete` 미호출을 단언한다 — 이 스위트가 다른 실패 축은 촘촘히 잠갔는데 가장 흔한 실제 장애 모드(S3 다운)만 비어 있다.
3. (WARNING #3, 낮은 우선순위) 동시 업로드 TOCTOU는 현재 유예 근거가 유효하므로 즉시 조치 불필요 — 재개 신호(`avatars/` 접두 객체 수가 사용자 수를 유의미하게 웃돌 때) 도달 시 조건부 UPDATE 또는 advisory lock 검토.
4. (SPEC-DRIFT 3건) planner 턴에서 `spec/2-navigation/9-user-profile.md`(엔드포인트 배지), `spec/0-overview.md`+`spec/data-flow/4-file-storage.md`(스토리지 키 레이아웃), `spec/5-system/3-error-handling.md`(에러 카탈로그)를 구현 기준으로 갱신 — 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md`에 대상 줄 번호까지 정확히 위임되어 있다.
5. (INFO, 선택) 나머지 항목(SRP 분리, URL build/parse 대칭화, S3Service 공유 모듈 승격, mock 팩토리 통합 등)은 각각 plan에 측정 가능한 재개 신호와 함께 이미 유예 등재되어 있어 이번 라운드에서 추가 조치가 필요하지 않다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync` (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — **전원 결과 확보됨**, 강제 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단으로 이번 changeset에서 제외 (prompt에 구체 사유 텍스트 미제공). 다른 reviewer들(architecture, dependency, concurrency)이 S3Service 지역 provider 중복 등 성능 인접 관찰을 INFO로 커버함 |