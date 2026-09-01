# Code Review 통합 보고서

대상: `POST /api/users/me/avatar` 신설 (아바타 이미지 업로드 — 공개 버킷 + 공개 URL 서빙), 부수로
`PATCH /api/users/me` 에 추가된 S3 정리 side-effect. 26개 변경 파일(backend 코드/테스트, docker-compose,
k8s manifest, docs, plan, MinIO 정책) 전수 검토.

## 전체 위험도

**MEDIUM** — Critical 은 0건. 개별 reviewer 최고 위험도는 side_effect 의 **MEDIUM**(공유 메서드
`UsersService.update()` 에 조건부 S3 부작용이 붙어 15개 이상 호출부가 암묵적으로 계약에 걸림 + OAuth
재연동 경로가 "정리 불변식"을 raw QueryBuilder 로 우회). 이 두 축을 architecture/maintainability/testing
reviewer 가 각각 다른 각도(SoT 폴백 3중 구현·`??`/`||` 연산자 불일치·Content-Type 매핑값 커버리지 갭)에서
독립적으로 재확인해 WARNING 이 9건으로 수렴했다. 다만 **모든 WARNING 이 이미 코드 주석·회귀 테스트·
`plan/in-progress/spec-sync-user-profile-gaps.md` 유예 기록으로 추적되고 있거나(TOCTOU 고아 객체·OAuth
우회·구조 확장), 뮤테이션 실측으로 새로 드러난 테스트 커버리지 갭(Content-Type 매핑값·대문자 확장자·
폴백 연산자)** 이라 즉시 차단할 사안은 없다. forced reviewer 8명(dependency, documentation,
maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 정상 확보됐다 —
강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | 공유 메서드 `UsersService.update()`에 조건부 부작용(추가 SELECT + 외부 S3 삭제)이 새로 붙어, 15개 이상 비-아바타 호출부(auth/totp/webauthn)가 암묵적으로 이 계약에 걸린다. 현재는 `avatarUrl` 키를 넘기는 호출부가 없어 안전하지만, 구조적 조건("`data` 객체에 `avatarUrl` 키 존재")에 의존해 향후 spread 사용 시 조용히 트리거될 수 있다. | `codebase/backend/src/modules/users/users.service.ts:232-246` (`update()`) | 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` W8/W9로 유예 추적 중. JSDoc 강화 또는 별도 메서드 분리를 재개 신호와 함께 재검토. |
| 2 | 부작용 / 아키텍처 | OAuth 재연동 경로(`resolveUser`)가 raw `QueryBuilder`로 `avatarUrl`을 직접 갱신해, 이 PR이 세운 "avatarUrl 변경 시 옛 S3 객체 정리" 불변식을 우회한다. 오늘은 `byEmail.avatarUrl ?? profile.avatarUrl` 우선순위 덕에 값 변경이 없어 증상이 없지만, 우선순위가 바뀌면 고아 객체가 생긴다. | `codebase/backend/src/modules/auth/auth-oauth.service.ts:375-401` (특히 398행) | 이미 캐너리 테스트(`users-avatar.service.spec.ts`)+plan W8/W9로 추적 중. 새 조치 불요, 향후 정리 로직 통합 시 함께 해소. |
| 3 | 동시성 / 보안 / 데이터베이스 | 아바타 교체 시 "옛 객체 정리"가 read-then-write-then-cleanup 비원자 시퀀스라, 동시 요청(더블클릭·다중 탭)이 겹치면 "패자" 요청이 올린 S3 객체가 영구 고아로 남는다. 데이터 정합성(최종 `avatarUrl`)은 항상 유효값으로 수렴하고 cross-user 삭제 위험도 없음(자기 접두 앵커링) — 스토리지 비용/남용 벡터로만 국한. | `codebase/backend/src/modules/users/users.service.ts:113,122,137,145` (`updateAvatar`), `:232-246` (`update`) | 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` W5로 유예(per-user lock 대신 주기적 orphan-sweep, 재개 신호=오브젝트 수/사용자 수 비율). 신호를 수동 관측 대신 정기 배치 집계로 자동화 권장. |
| 4 | 보안 / API 계약 | 업로드 파일의 실제 바이트가 유효한 이미지인지 매직바이트 검증이 없다. 서버가 확장자에서 `Content-Type`을 강제하므로 stored-XSS 주 벡터는 막히지만, 임의 바이너리를 이미지 확장자로 공개 버킷에 배포하는 것까지는 막지 못한다(스토리지 낭비/평판 리스크). | `codebase/backend/src/modules/users/users.service.ts:93-111` (`updateAvatar` 확장자 판정 블록) | 필수는 아님. `sharp`/`file-type` 등으로 매직바이트 검증 추가를 고려(우선순위 낮음, XSS는 이미 차단됨). |
| 5 | 아키텍처 / 유지보수성 / 테스트 | "SoT는 config 한 곳"이라 주석에 명시된 `S3_PUBLIC_BASE_URL → S3_ENDPOINT → 기본값` 폴백 규칙이 3개 파일(`s3.config.ts`·`s3.service.ts`·`main.ts`)에 독립 구현돼 있다. `main.ts` 사본은 테스트가 없고 두 env 모두 미설정 시 SoT(`'http://localhost:9000'`)와 다른 값(`''`)을 내 이 PR이 막으려던 실패("localhost가 프로덕션에 조용히 실림")를 그 가드 자신 안에 재도입할 수 있다. 추가로 `s3.service.ts`의 "2차 방어" 폴백은 `??`(nullish)를 쓰는데 SoT는 `||`(falsy)를 써 연산자가 다르며, 뮤테이션으로 두 연산자를 서로 바꿔도 전체 테스트 스위트(`s3.service.spec.ts` 40건 포함)가 GREEN으로 남음을 실측 확인(빈 문자열 케이스 부재). | `codebase/backend/src/common/config/s3.config.ts:23-26`, `codebase/backend/src/common/services/s3.service.ts:40-41`, `codebase/backend/src/main.ts:159-161` | 순수 함수(`resolvePublicBaseUrl(env)`) 하나로 규칙을 추출해 세 곳이 공유하게 하거나, 최소한 `main.ts` 폴백값을 SoT와 동일하게 맞추고 교차 참조 주석 추가. 테스트에 `''`(빈 문자열, `undefined` 아님) 케이스를 추가해 연산자 차이를 고정. |
| 6 | 성능 | `updateAvatar` 응답 경로에서 서로 독립적인 두 I/O(갱신된 엔티티 재조회 `findOneOrFail`, 옛 아바타 S3 삭제 `deletePreviousAvatarObject`)를 불필요하게 직렬로 대기한다. 두 호출 모두 서로의 결과값을 소비하지 않는다. | `codebase/backend/src/modules/users/users.service.ts:139` (`findOneOrFail`), `:145` (`deletePreviousAvatarObject`) | `Promise.all([...])`로 병렬화. "정리는 DB 저장 성공 후"라는 순서 불변식은 두 작업 모두 `update()` 성공 이후에 시작되므로 그대로 보존된다. |
| 7 | 테스트 | `AVATAR_CONTENT_TYPES` 매핑 값 중 `png`만 실제 값이 단언된다 — `jpg`/`jpeg`/`webp`/`gif`는 매핑이 뒤바뀌어도 감지되지 않음을 뮤테이션으로 실측(`jpg: 'image/jpeg'`→`'image/jpg'`로 바꿔도 회귀 33건 GREEN). Content-Type은 공개 URL 브라우저 렌더링을 정하는 보안 경계인데 4/5 확장자가 값 검증 밖이다. | `codebase/backend/src/modules/users/users.service.ts` `AVATAR_CONTENT_TYPES`(~44행), `users-avatar.service.spec.ts` | `it.each(['png','jpg','jpeg','webp','gif'])`로 확장해 각 확장자→기대 Content-Type을 전수 대조. |
| 8 | 테스트 | 확장자 대문자(예: `ME.PNG`) 케이스가 검증되지 않는다 — `.toLowerCase()`를 제거해도 30건 전부 GREEN(뮤테이션 실측). 정상 대문자 확장자 처리에 대한 양성(positive) 테스트가 없다. | `codebase/backend/src/modules/users/users.service.ts` `updateAvatar`(`ext.toLowerCase()`) | 대문자 확장자(`ME.PNG`)가 정상 처리되는지 확인하는 양성 테스트 케이스 추가. |
| 9 | 문서화 | CHANGELOG 신규 항목이 이 PR이 함께 도입한 **production 부트 가드**(운영 환경에서 `S3_PUBLIC_BASE_URL`이 사설/loopback 주소면 경고 로그를 남기는 로직, 실제 k8s overlay patch 누락 근접사고 이력이 소스 주석에 남아 있음)를 전혀 언급하지 않는다. | `CHANGELOG.md` (신규 섹션), `codebase/backend/src/main.ts:159-172` | CHANGELOG에 한 줄 추가 — "production 부팅 시 `S3_PUBLIC_BASE_URL`이 사설/loopback 주소로 판정되면 경고 로그를 남긴다(overlay patch 누락 방지 backstop)." |

## SPEC-DRIFT

requirement reviewer 가 태깅. 코드가 spec 을 의도적으로 개선해 spec 4곳이 낡은 것으로, **코드 변경
불필요** — 전부 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 planner 트랙에
정확한 라인까지 지목되어 위임돼 있다(developer 는 CLAUDE.md "자기-반증형 소정정" 예외에 해당하지 않아
직접 고치지 않은 것도 절차상 정확).

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/2-navigation/9-user-profile.md`가 `POST /api/users/me/avatar`를 여전히 "미구현 (Planned)"으로 서술하나, 코드는 구현 완료·75/75 테스트 통과. | `spec/2-navigation/9-user-profile.md:136,334` | 코드 변경 불필요. `spec-update-avatar-upload-implemented.md`가 이미 정확한 두 라인을 planner 할 일로 등록 — 새 조치 불요. |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/0-overview.md` §2.7이 아바타 키 패턴을 `{workspaceId}/avatars/...`로, 구현 상태를 "계획 (코드 미구현)"으로 서술하나, 실제 키는 `avatars/{userId}/{uuid}.{ext}`(workspaceId 없음 — User는 워크스페이스 종속 리소스가 아니므로 의도적 설계). | `spec/0-overview.md:269,276` | 코드 변경 불필요. 같은 planner 트랙 plan 문서가 이 라인을 지목했고, "stale spec을 SoT로 버킷 정책을 설계하면 업로드는 성공, 이미지는 403" 위험까지 문서화됨. |
| 3 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/data-flow/4-file-storage.md`가 아바타 키 패턴·구현 상태를 잘못 서술(§1.2·§2.1·§2.2), §2.3 설정 매핑에 신규 `s3.publicBaseUrl` 항목 누락. | `spec/data-flow/4-file-storage.md:58,71,78` | 코드 변경 불필요. 동일 plan 문서가 세 지점을 정확히 지목. |
| 4 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/5-system/3-error-handling.md` 에러 카탈로그가 `FILE_REQUIRED`(신규)·`INVALID_FILE_TYPE`(knowledge-base와 공유하는 사전 갭)을 등재하지 않음. | `spec/5-system/3-error-handling.md` §1.8 | 코드 변경 불필요. plan 문서가 두 코드의 등재를 planner 할 일로 명시. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 공개 아바타 응답에 `X-Content-Type-Options: nosniff` 헤더 미설정 — 주 방어(서버 강제 Content-Type)가 견고해 실질 위험 낮음. | `codebase/backend/src/common/services/s3.service.ts` `upload()`(53-67행, 기존 코드) | `PutObjectCommand`에 헤더 추가 검토. |
| 2 | 보안 | `mc anonymous set-json`은 버킷 정책을 병합이 아닌 전체 교체 — 향후 다른 prefix에 별도 정책이 이 호출 뒤에 추가되면 아바타 정책이 조용히 사라질 수 있음(현재는 유일한 정책 적용이라 무해). | `docker-compose.yml:75`, `docker-compose.e2e.yml:96` | 향후 정책 추가 시 순서 주의. |
| 3 | 보안 | `S3_PUBLIC_BASE_URL` 미설정 시 프로덕션에서도 `localhost`로 폴백 가능(경고만, throw 없음) — 가용성 문제이지 인가 우회 아님, 3곳에서 반복 경고 중이라 발견 가능성 낮지 않음. | `codebase/backend/src/main.ts:159-172` | 기존 `ALLOW_PRIVATE_HOST_TARGETS` 패턴과 의도적으로 동일 — 조치 불요. |
| 4 | 아키텍처 | `UsersService`가 프로필 CRUD에 더해 S3 오케스트레이션까지 겸해 SRP가 흐려짐 — 이미 `UserAvatarService` 분리안이 plan에 재개 신호와 함께 유예됨(YAGNI, 소비자 1개뿐). | `codebase/backend/src/modules/users/users.service.ts:27,79-147,167-194` | 새 조치 불요, 두 번째 S3 소비 리소스 생기면 재검토. |
| 5 | 아키텍처 | URL 생성(`S3Service.getPublicUrl`)과 역산(`UsersService`의 `decodeURIComponent`+마커 매칭)이 다른 클래스에 나뉘어 인코딩 지식이 도메인 레이어로 누출. | `codebase/backend/src/common/services/s3.service.ts:86` ↔ `codebase/backend/src/modules/users/users.service.ts:183` | `UserAvatarService` 분리 시 `S3Service`에 대칭 `extractKeyFromPublicUrl()` 추가 검토. |
| 6 | 아키텍처 / 의존성 | `S3Service`가 `UsersModule`/`KnowledgeBaseModule`에 각각 지역 provider로 등록되어 `S3Client` 인스턴스가 2개 — 기존 관례를 따른 것. | `codebase/backend/src/modules/users/users.module.ts:22-24` | 세 번째 소비 모듈 생기면 공유 `S3Module` 승격 검토. |
| 7 | 아키텍처 | `UsersController`가 `UsersService.AVATAR_MAX_BYTES`를 static 멤버로 직접 참조 — 일반 DI 경로와 다른 컴파일타임 결합, 같은 모듈 내부라 위험 낮음. | `codebase/backend/src/modules/users/users.controller.ts:159` | 상수가 다른 계층에서도 필요해지면 독립 상수 모듈로 분리 검토. |
| 8 | 범위 | `Express`→`ExpressNS` 전역 rename이 아바타와 무관한 `changePassword`·`verifyEmailChange`의 타입 표기까지 건드림 — default import 특성상 불가피한 side effect, CHANGELOG/plan에 명시적으로 문서화됨. | `codebase/backend/src/modules/users/users.controller.ts:53,217-218,304-305` | 조치 불요. |
| 9 | 유지보수성 | `updateAvatar`의 사용자 부재 분기(`if (!user) throw ...`)만 다중행인데 중괄호 생략 — 같은 파일의 다른 다중행 분기와 스타일 불일치. | `codebase/backend/src/modules/users/users.service.ts:114` | 다른 분기와 같이 `{ }`로 감싸기. |
| 10 | 유지보수성 | `ExpressNS`라는 새 네이밍이 이 컨트롤러에만 도입되어 저장소 전체 컨벤션으로 고정되지 않음. | `codebase/backend/src/modules/users/users.controller.ts:53-57` | 두 번째 파일에서 재발하면 공용 alias 도입 검토. |
| 11 | 테스트 | `main.ts`의 신규 SSRF 경고 분기(`bootstrap()` 인라인)가 유닛 테스트 대상 밖 — 기존 형제 분기(`ALLOW_PRIVATE_HOST_TARGETS`)도 동일 상태라 이 PR이 새로 낮춘 커버리지는 아님. | `codebase/backend/src/main.ts` `bootstrap()`(149-172행대) | (우선순위 낮음) `evaluateProductionWarnings(env)` 순수 함수로 추출해 `production-guards.spec.ts`에 편입 검토. |
| 12 | 테스트 | `!file?.buffer?.length` 가드의 "파일은 있으나 0바이트" 분기가 미검증 — 현재는 `file === undefined` 케이스만 테스트. | `codebase/backend/src/modules/users/users.service.ts` `updateAvatar` | `buffer: Buffer.alloc(0)` 케이스를 `it.each`에 추가. |
| 13 | API 계약 | `FILE_REQUIRED`/`INVALID_FILE_TYPE` 에러 코드가 spec 에러 카탈로그(`3-error-handling.md`)에 미등재 — SPEC-DRIFT #4와 동일 건, 이미 planner 트랙 to-do. | `codebase/backend/src/modules/users/users.service.ts:84-91,106-111` | 새 조치 불요. |
| 14 | API 계약 | `PATCH /api/users/me`의 S3 정리 side-effect가 Swagger에는 반영됐으나, `spec-update-avatar-upload-implemented.md`의 정정 대상 목록에는 PATCH 쪽이 항목화되지 않음(신규 POST 계약만 명시). | `codebase/backend/src/modules/users/users.controller.ts:121-128` | planner 트랙 to-do에 PATCH 쪽 side-effect 한 줄 추가 검토(작은 보강, 차단 사유 아님). |
| 15 | 성능 / 데이터베이스 | `update()` + `findOneOrFail()` 2회 DB 왕복 — `UPDATE ... RETURNING`으로 1회 축소 가능. 기존 `update()` 메서드도 동일 패턴이라 이 PR의 새 회귀 아니고, 아바타 업로드는 hot path 아님. | `codebase/backend/src/modules/users/users.service.ts:137,139-141` (및 `:239-240`) | 우선순위 낮음. `RETURNING` 패턴을 서비스 전반에 도입할 때 함께 처리. |
| 16 | 문서화 | `S3_PUBLIC_BASE_URL` 신규 변수의 문서 배치 순서가 `README.md`와 `.env.example`에서 다름(내용은 일치). | `README.md:212`, `codebase/backend/.env.example:150` | 선택 사항 — 다음 편집 시 위치 통일 고려. |
| 17 | 요구사항(확인) | `deletePreviousAvatarObject`의 마커 기반 키 복원이 항상 호출자 자신의 `userId` 접두로만 앵커링돼, 크래프팅된 `avatarUrl`이 있어도 타 사용자 객체를 지울 수 없음을 확인(S3 `DeleteObject`는 idempotent). | `codebase/backend/src/modules/users/users.service.ts` `deletePreviousAvatarObject` | 조치 불요, 확인 결과로 기록. |
| 18 | 프런트엔드 통합(확인) | 프런트엔드에 이 엔드포인트를 소비하는 코드가 아직 없음(백엔드 우선 배포, PR 범위와 일치) — 새 결함 아님. | `codebase/frontend/src` (전수 grep 0건) | 후속 PR에서 프런트 통합 예정. |

### 확인 완료 — 문제 없음 (재조사 불필요)

- **데이터베이스**: lost-update 방지(컬럼 단위 `UPDATE`, `save()` 미사용) 정확히 구현. 인덱스·N+1·마이그레이션 안전성·스키마 설계·커넥션 관리·SQL 인젝션·대량 데이터 처리 전부 이슈 없음(신규 스키마 변경 없음, PK 기반 단건 쿼리만).
- **동시성**: async/await·이벤트 루프 블로킹·스레드 안전성 결함 없음. `deletePreviousAvatarObject` 호출 2곳 모두 정상 `await`.
- **의존성**: 신규 외부 패키지 추가 없음(`package.json`/`pnpm-lock.yaml` diff 0). `multer` 실행 버전은 기존 workspace override(`^2.2.0`)로 이미 고정, `pnpm audit --prod` 무취약점.
- **API 계약**: 인증(`JwtAuthGuard`)·응답 봉투(`toProfileData` 공유)·HTTP 상태 코드(200/400/401/404/413)·Swagger-상수 동기화(전용 회귀 테스트)·전역 100KB body parser와의 무간섭 전부 확인.
- **요구사항**: 파일 검증 순서, Content-Type 파생 로직, lost-update 방지, 정리 순서/실패 격리, PATCH 경로 정리 가드, NotFound 응답 형식, k8s 3-overlay 배포 선행조건, 버킷 정책 선행조건 — 전부 실측 확인. `pnpm exec jest` 75/75 통과, `tsc --noEmit` 신규 타입 에러 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 매직바이트 미검증(WARNING #4), TOCTOU 고아객체 재확인(WARNING #3), nosniff 헤더 부재(INFO) |
| performance | LOW | 독립 I/O 직렬 대기(WARNING #6), 5단계 순차 I/O(INFO) |
| architecture | LOW | publicBaseUrl 폴백 3중 구현·SoT drift(WARNING #5), UsersService SRP 확장(INFO, 유예됨) |
| requirement | LOW | SPEC-DRIFT 4건(전부 planner 트랙 위임 완료), 기능/엣지케이스 실측 검증 완료(75/75 GREEN) |
| scope | LOW | 4개 확산 지점 전부 근거 있는 필연적 확장(무관한 변경 없음) |
| side_effect | **MEDIUM** | `update()` 공유 부작용 확장(WARNING #1), OAuth 우회(WARNING #2) |
| maintainability | LOW | publicBaseUrl 폴백 3중 구현(WARNING #5 중복), 중괄호 생략 1곳(INFO) |
| testing | LOW | Content-Type 매핑값 커버리지 갭(WARNING #7), 대문자 확장자 미검증(WARNING #8), 폴백 연산자 불일치(WARNING #5 일부) — 전부 뮤테이션 실측 |
| documentation | LOW | CHANGELOG의 production 가드 누락(WARNING #9) |
| dependency | NONE | 신규 의존성 없음, `pnpm audit` 무취약점 |
| database | LOW | TOCTOU 재확인(WARNING #3 중복, 정합성은 안전), RETURNING 미사용(INFO) |
| concurrency | LOW | TOCTOU 재확인(WARNING #3 중복, 격리 위반 없음) |
| api_contract | LOW | 매직바이트 미검증(WARNING #4 중복), 에러 카탈로그 미등재(SPEC-DRIFT #4 중복) |

## 발견 없는 에이전트

없음 — 13개 reviewer 전원이 최소 INFO 이상의 발견사항을 보고했다. 다만 **dependency** 는 WARNING/CRITICAL 없이 순수 관찰(INFO)만 보고해 위험도 NONE.

## 권장 조치사항

1. `S3Service` 생성자의 2차 방어 폴백 연산자(`??`)를 SoT(`s3.config.ts`, `||`)와 통일하거나, 빈 문자열(`''`) 테스트 케이스를 추가해 두 SoT가 실제로 같은 의미론을 갖는지 고정한다(WARNING #5).
2. `main.ts`의 세 번째 `publicBaseUrl` 폴백 사본을 SoT와 동일한 최종값으로 맞추고 회귀 테스트를 추가하거나, 순수 함수로 규칙을 추출해 세 곳이 공유하게 한다(WARNING #5).
3. `AVATAR_CONTENT_TYPES` 매핑값 전수 대조 테스트(`it.each`, WARNING #7)와 대문자 확장자 양성 테스트(WARNING #8)를 추가해 뮤테이션으로 확인된 커버리지 갭을 닫는다.
4. `updateAvatar`의 `findOneOrFail`과 `deletePreviousAvatarObject`를 `Promise.all`로 병렬화한다(WARNING #6, 정합성 영향 없음).
5. CHANGELOG에 production 부트 가드(사설 호스트 경고) 한 줄을 추가한다(WARNING #9).
6. `UsersService.update()`의 공유 부작용 확장(WARNING #1)과 OAuth 우회(WARNING #2)는 이미 plan(W8/W9)에 유예·추적 중이므로 이번 PR을 막을 사유는 아니나, 다음 유지보수자가 놓치지 않도록 `UserAvatarService` 분리 시점에 함께 해소한다.
7. spec 4곳(`9-user-profile.md`·`0-overview.md`·`4-file-storage.md`·`3-error-handling.md`)은 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md`로 planner 트랙에 정확히 위임돼 있으므로 이 PR에서 추가 조치 불요 — 해당 plan 항목의 후속 처리만 확인한다.
8. 동시 업로드 TOCTOU로 인한 S3 고아 객체(WARNING #3)는 이미 유예된 결정이므로 즉시 조치는 불요하되, 재개 신호(오브젝트 수/사용자 수 비율)를 수동 관측 대신 정기 배치 집계로 자동화하는 것을 고려한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract` (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명, 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | user_guide_sync | 라우터 판단(사유 미상세, prompt 상 `skipped`로만 표기) |