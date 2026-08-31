# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 이미 성공한 아바타 교체가 클라이언트에는 500 실패로 보이는 에러 처리 결함(CRITICAL)과, 실제 구현된 S3 키 패턴이 두 SoT spec 문서(§2.7·file-storage)에 반영되지 않아 운영자가 이 PR 이 스스로 경고하는 "버킷 정책 불일치 → 이미지만 403" 실패를 재현할 수 있는 SoT drift(CRITICAL, SPEC-DRIFT)가 있다. forced whitelist(7명) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 에러 처리 | `deletePreviousAvatarObject` 의 `decodeURIComponent` 호출이 try/catch **밖**에 있어, malformed percent-encoding 을 담은 옛 `avatarUrl`(사용자가 기존 `PATCH /users/me` 로 직접 설정 가능 — `@IsUrl({require_tld:false})` 는 percent-encoding 유효성 미검사)을 가진 사용자가 새 아바타를 올리면 새 파일 업로드+DB 저장은 **이미 성공**했는데 `URIError` 가 전파돼 클라이언트는 **500** 을 받는다. `node -e` 로 직접 실측 재현됨(requirement/side_effect 공통 실측). "정리 실패는 삼킨다"는 JSDoc 보장과 어긋난다. | `codebase/backend/src/modules/users/users.service.ts:125`(try 블록은 `:128`부터 시작, `decodeURIComponent` 는 그 밖) | `decodeURIComponent`(및 `key.split(/[?#]/)[0]`)를 try 블록 안으로 옮기거나 함수 전체를 try/catch 로 감싸 파싱 실패도 warn 로깅 후 삼키게 한다. malformed `%` 시퀀스를 포함한 `previousUrl` 회귀 테스트 추가 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] 실제 구현된 아바타 S3 키(`avatars/{userId}/{uuid}.{ext}` — UUID 파일명으로 공개 버킷 접근 통제, workspaceId 미포함은 User 가 workspace-비종속 리소스라 자연스러운 설계)가 `spec/0-overview.md §2.7`·`spec/data-flow/4-file-storage.md`(§1.1~§2.3)의 "계획/미구현" 서술 및 `{workspaceId}/avatars/{userId}.{ext}` 키 패턴과 어긋난다. 코드는 의도적이고 합리적이나, developer 가 만든 `plan/in-progress/spec-update-avatar-upload-implemented.md` 는 `spec/2-navigation/9-user-profile.md` 만 planner 스코프로 위임하고 이 두 문서를 빠뜨렸다. `4-file-storage.md` §1.2 는 스스로 "기능 도입 시 갱신하라"는 자기-참조 TODO 를 남겨 뒀고, §2.3 은 신규 `s3.publicBaseUrl` 설정 행이 누락돼 있다. 운영자가 이 stale spec 을 SoT 삼아 버킷 정책을 `{workspaceId}/avatars/` 접두로 설계하면, 이 PR 의 CHANGELOG 가 반복 경고하는 "접두 불일치 → 업로드는 성공, 이미지만 403" 실패를 스스로 재현한다. | `spec/0-overview.md:269,276`; `spec/data-flow/4-file-storage.md:55,71,78`(§1.1 제목·§1.2·§2.1 표·§2.2 avatar_url·§2.3 설정 매핑); vs `codebase/backend/src/modules/users/users.service.ts:92`; 위임 누락: `plan/in-progress/spec-update-avatar-upload-implemented.md` | 코드는 유지. `spec-update-avatar-upload-implemented.md` 의 "## 할 일"에 `spec/0-overview.md §2.7`과 `spec/data-flow/4-file-storage.md`(§1.1 제목·§1.2·§2.1 키 패턴·§2.2 avatar_url·§2.3 `s3.publicBaseUrl` 행)를 planner 반영 대상으로 추가 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 배포/문서 | 신규 필수 env `S3_PUBLIC_BASE_URL` 이 `.env.example` 에는 문서화됐지만 `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/base/configmap.yaml`/`k8s/overlays/local/configmap-patch.yaml`/`k8s/README.md` 배포 체크리스트/루트 `README.md` env 목록에 전파되지 않았다 — 미설정 시 내부 `S3_ENDPOINT`(예: `http://minio:9000`)로 조용히 폴백해 브라우저가 도달 불가능한 아바타 URL 을 생성한다. | `codebase/backend/.env.example:147-157` vs `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/**`/`README.md`(모두 diff 밖) | `S3_PUBLIC_BASE_URL` 을 docker-compose*.yml backend 블록, k8s configmap, `k8s/README.md` 체크리스트, 루트 `README.md` S3 섹션에 추가 |
| 2 | API 계약 | `POST /users/me/avatar` 에 `@HttpCode(HttpStatus.OK)` 가 없다 — 이 컨트롤러의 다른 모든 `POST` 핸들러(`changePassword`, `requestEmailChange` 등 5개)는 명시 200 을 강제하는데 이 엔드포인트만 NestJS 기본값인 **201** 이 응답되어, `@ApiOkWrappedResponse`(Swagger 200 문서)와 실제 런타임이 어긋난다. | `codebase/backend/src/modules/users/users.controller.ts:140`(uploadAvatar) vs `:195-196,250-251,283-284,327-328,346-347`(자매 엔드포인트) | `@Post('me/avatar')` 다음 줄에 `@HttpCode(HttpStatus.OK)` 추가 |
| 3 | API 계약 | `INVALID_FILE_TYPE` 에러 코드가 "파일 누락"과 "허용되지 않는 확장자"라는 서로 다른 실패 사유에 재사용돼, 클라이언트가 코드만으로 두 케이스를 분기할 수 없다(저장소 규약은 메시지 문자열 파싱 금지). 신규 코드가 `spec/5-system/3-error-handling.md` 카탈로그에도 미등재. | `codebase/backend/src/modules/users/users.service.ts` 약 `:70-75`(파일 누락), `:81-86`(확장자 불허) | `FILE_REQUIRED`(또는 유사) 로 분리하거나 결합이 의도적이면 spec 카탈로그에 명시. `INVALID_FILE_TYPE` 을 `3-error-handling.md §1` 에 등재 |
| 4 | API 계약 / 부작용 | `PATCH /users/me`(`avatarUrl` 필드 교체)는 `POST /users/me/avatar` 와 달리 옛 S3 객체 정리(`deletePreviousAvatarObject`)를 호출하지 않아, PATCH 로 avatarUrl 을 바꾸면 직전 업로드된 S3 객체가 영구 고아로 남는다(스토리지 누수). | `codebase/backend/src/modules/users/users.service.ts:161-164`(`update()`) vs `:66-102`(`updateAvatar()`) | `update()` 경로에서도 `deletePreviousAvatarObject` 호출 통합, 또는 알려진 갭으로 plan/spec 에 명시 등재 |
| 5 | 유지보수성 | 프로필 응답 DTO 매핑 리터럴(`{id,email,name,avatarUrl,locale,theme,...}`)이 `getMe`/`updateMe`/`uploadAvatar`(이번 PR 이 3번째 사본 추가) 세 메서드에 동일하게 복제돼 있다. | `codebase/backend/src/modules/users/users.controller.ts:94-105,129-138,183-192` | `private toProfileResponseData(user)` 헬퍼로 추출, `getMe` 는 스프레드로 `pendingEmail` 만 추가 |
| 6 | 유지보수성 | `Express`→`ExpressModule` 리네임(전역 네임스페이스 가림 회피)이 `users.controller.ts` 에만 적용돼, 동일 패턴(`import Express from 'express'`)이 `auth.controller.ts`/`sessions.controller.ts`/`webauthn.controller.ts`/`workflow-assistant.controller.ts` 4곳에 그대로 남아 명명 관례가 갈라졌다. `ExpressModule` 이름 자체가 NestJS `@Module()` 클래스와 표기가 겹쳐 오독 소지. (기능과 무관한 기존 두 메서드 `changePassword`/`verifyEmailChange` 파라미터 타입도 동반 변경됐으나 CHANGELOG·plan 에 명시적으로 disclose 돼 우려 사항은 아님) | `codebase/backend/src/modules/users/users.controller.ts:52-56,213-214,300-301` vs 4개 타 컨트롤러 | 리네임을 전역 컨벤션으로 승격하거나, 이 파일만 필요한 최소 범위(named import)로 좁히고 `ExpressModule` 대신 `ExpressNS` 등으로 개명 |
| 7 | 테스트 | 신설 `S3Service.getPublicUrl` 의 실제 구현(트레일링 슬래시 제거·세그먼트별 `encodeURIComponent`·경로 조합)이 어떤 테스트에서도 실행되지 않는다 — `s3.service.spec.ts` 미수정, 소비 테스트는 `S3Service` 전체를 단순 mock 으로 대체. `s3.config.ts` 의 3단 폴백(`S3_PUBLIC_BASE_URL || S3_ENDPOINT || localhost`)도 전용 config 테스트 없음. | `codebase/backend/src/common/services/s3.service.ts:80-89` / `s3.service.spec.ts`(미수정) | `getPublicUrl` 전용 단위 테스트(슬래시 제거·폴백·세그먼트 인코딩) 추가, `getPublicUrl`→`deletePreviousAvatarObject` 왕복(encode→decode) 테스트 권장 |
| 8 | 문서/테스트 | `AVATAR_MAX_BYTES` 관련 컨트롤러 주석이 "회귀 테스트가 두 값의 동일성을 고정한다"고 주장하나 그런 테스트는 존재하지 않고(직접 상수 참조라 애초에 갈릴 수 없음), 실제 드리프트 가능 지점인 Swagger 리터럴 3곳("최대 2MB" 등)은 상수에서 파생되지 않으며 동기화 테스트도 없다. | `codebase/backend/src/modules/users/users.controller.ts:143-146`(주석), `:152,:165,:175`(Swagger 리터럴) | 주석 정정(허위 보호 주장 제거), Swagger 리터럴과 `AVATAR_MAX_BYTES`/`AVATAR_CONTENT_TYPES` 동기화를 검증하는 테스트 추가 |
| 9 | 테스트 | 기존 `users.controller.spec.ts`(다른 6개 엔드포인트 전부 커버)가 신규 `uploadAvatar` 핸들러를 전혀 다루지 않는다 — `payload.sub`/`file` 위임, 응답 매핑 검증 부재. (KB 모듈의 `FileInterceptor` 경로도 동일한 기존 갭이라 이 PR 고유 패턴은 아님) | `codebase/backend/src/modules/users/users.controller.ts:178-193` / `users.controller.spec.ts`(미수정) | `uploadAvatar` 컨트롤러 레벨 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/배포 | `S3_PUBLIC_BASE_URL` 미설정 시 내부 `S3_ENDPOINT` 로 폴백해, 설정 누락 상태에서는 `avatarUrl` 응답 필드로 내부 호스트/토폴로지가 노출될 수 있다(WARNING #1 과 원인 공유, 배포 가드 관점) | `codebase/backend/src/common/config/s3.config.ts:19-22` | production 에서 `S3_PUBLIC_BASE_URL` 미설정+`S3_ENDPOINT` 가 사설 대역이면 boot 경고/가드 고려 |
| 2 | 보안 | 이미지 콘텐츠 매직바이트 검증 없이 확장자 화이트리스트+강제 `Content-Type` 에만 의존(저장형 XSS 는 잘 차단됨) | `codebase/backend/src/modules/users/users.service.ts:41-47,77-86` | 필요 시 매직바이트 검증을 2차 방어로 추가 고려 |
| 3 | 보안 | 공개 버킷 접근 통제가 "버킷 정책이 `ListBucket` 을 막는다"는 코드 밖 전제에 전적으로 의존, 문서에 그 구체 조건이 명시돼 있지 않음 | `codebase/backend/src/common/services/s3.service.ts:63-89`, `.env.example:155-156` | 배포 선행 조건 문서에 "ListBucket 은 허용하지 않는다" 명시 추가 |
| 4 | 보안 | `POST /users/me/avatar` 에 엔드포인트 전용 `@Throttle` 없음(전역 100req/60s 만 적용) | `codebase/backend/src/modules/users/users.controller.ts:140-148` | 필요 시 더 낮은 전용 throttle 고려 |
| 5 | 성능 | multer 기본 `MemoryStorage` 로 업로드 파일 전체가 인메모리 버퍼로 처리됨(2MB 상한+전역 throttle 로 현재 규모에서 위험 낮음) | `codebase/backend/src/modules/users/users.controller.ts:142-147` | 아바타보다 큰 업로드로 재사용 계획이 있을 때만 `diskStorage`/스트리밍 검토 |
| 6 | 성능 | `S3Service` 가 `UsersModule` 에도 로컬 provider 로 등록돼 KB 모듈과 별개의 `S3Client` 커넥션 풀이 하나 더 생성됨(기존 KB 모듈 컨벤션을 그대로 따른 것, 조치 불요) | `codebase/backend/src/modules/users/users.module.ts:24` | S3 소비 모듈이 더 늘면 `S3Service` 를 `@Global` 승격 검토 |
| 7 | 코드 정합 | `S3Service` 생성자의 `?? endpoint` 폴백이 "폴백 규칙은 한 곳에만 둔다"는 인접 주석과 모순되는 죽은 분기(정상 부팅 경로에서는 도달 불가) | `codebase/backend/src/common/services/s3.service.ts:32-35` | `?? endpoint` 제거 또는 방어적 코드임을 명시하도록 주석 정정 |
| 8 | 테스트 | `updateAvatar` 의 `NotFoundException`(`USER_NOT_FOUND`) 분기, `s3.upload` 실패 시 정리 로직 미실행을 고정하는 캐너리, 확장자/빈파일 거부 테스트의 `code` 값 검증이 각각 누락 | `codebase/backend/src/modules/users/users.service.ts:89,93` / `users-avatar.service.spec.ts:105-119` | 해당 케이스들에 대한 테스트 보강 |
| 9 | 테스트 | avatar 관련 e2e 스펙 부재(multipart 파싱·413 등 파이프라인 배선 미검증, KB 모듈도 동일한 기존 패턴) | `codebase/backend/test/` | 필요시 e2e 스펙 추가 검토 |
| 10 | 문서 | 신규 REST 엔드포인트가 `codebase/frontend/src/content/docs/` 유저 가이드 MDX 에 미반영 — 그러나 이 PR 에 소비 UI(frontend) 자체가 없어 지금 문서화하면 오히려 오서술이 되는 회색지대(확정 gap 아님) | `codebase/frontend/src/content/docs/07-workspace-and-team/` (변경 없음) | 후속 아바타 업로드 UI PR 착수 시 유저가이드 절 신설을 그 PR 체크리스트에 명시 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | HIGH | spec 2건(0-overview §2.7, data-flow) 미갱신 SoT drift(CRITICAL), env 배포 전파 누락 |
| requirement | MEDIUM | decodeURIComponent CRITICAL, getPublicUrl 무테스트, SPEC-DRIFT 태깅 |
| side_effect | MEDIUM | decodeURIComponent 부작용(성공한 갱신이 500 으로 보고) |
| testing | MEDIUM | getPublicUrl/uploadAvatar 컨트롤러/AVATAR_MAX_BYTES 주석 무테스트 |
| api_contract | MEDIUM | 201 vs 200 불일치, 에러코드 재사용, PATCH cleanup 비대칭 |
| security | LOW | decodeURIComponent try/catch 밖(WARNING), 배포설정·심층방어 INFO 다수 |
| performance | LOW | 메모리 버퍼 업로드·S3Client 중복, 둘 다 현재 규모에서 위험 낮음 |
| scope | LOW | ExpressModule 리네임 부수효과가 disclose 되어 우려 아님 |
| maintainability | LOW | 응답 매핑 3중 복제, ExpressModule 리네임 범위 불일치 |
| user_guide_sync | LOW | README env 목록 누락, MDX 미반영은 회색지대(UI 부재) |

## 발견 없는 에이전트

없음 — 실행된 10개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고했다.

## 권장 조치사항

1. `deletePreviousAvatarObject` 의 `decodeURIComponent` 를 try 블록 안으로 이동(또는 함수 전체 try/catch) — 성공한 업로드가 500 으로 오응답되는 CRITICAL 결함 수정, malformed `%` 시퀀스 회귀 테스트 추가
2. `plan/in-progress/spec-update-avatar-upload-implemented.md` 스코프에 `spec/0-overview.md §2.7`와 `spec/data-flow/4-file-storage.md`(§1.1~§2.3)를 추가해 planner 턴으로 실제 키 패턴(`avatars/{userId}/{uuid}.{ext}`) + `s3.publicBaseUrl` 설정 매핑 반영 — [SPEC-DRIFT], 코드 revert 아님
3. `S3_PUBLIC_BASE_URL` 을 `docker-compose*.yml`/k8s configmap/`k8s/README.md`/루트 `README.md` 에 전파
4. `POST /users/me/avatar` 에 `@HttpCode(HttpStatus.OK)` 추가해 Swagger·자매 엔드포인트와 정합
5. `INVALID_FILE_TYPE` 에러 코드 분리(파일 누락 vs 확장자 불허) + `3-error-handling.md` 카탈로그 등재
6. `PATCH /users/me` 의 `avatarUrl` 교체 시에도 옛 S3 객체 정리 호출 통합(스토리지 고아 방지), 또는 알려진 갭으로 명시 등재
7. 프로필 응답 매핑 공용 헬퍼(`toProfileResponseData`)로 추출해 3중 복제 제거
8. `Express`→`ExpressModule` 리네임을 전역 일관화하거나 범위를 좁히고 개명
9. `S3Service.getPublicUrl` + `s3.config.ts` 폴백에 대한 단위 테스트 추가
10. `AVATAR_MAX_BYTES` 주석 정정 + Swagger 리터럴 동기화 테스트, `uploadAvatar` 컨트롤러 레벨 테스트 보강

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 표 참조 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단 — 이번 diff 범위(단일 리소스 아바타 CRUD)에서 관련성 낮음 |
  | dependency | 라우터 판단 — 신규 외부 의존성 추가 없음 |
  | database | 라우터 판단 — 스키마/마이그레이션 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 민감 구조 변경 없음 |