# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — 애플리케이션 코드 자체(서비스/컨트롤러 로직)는 CRITICAL 이 없고 검증도 탄탄하지만, `side_effect` 리뷰어가 지목한 **k8s prod/staging 배포 설정 결함**(`S3_PUBLIC_BASE_URL` 미교정)이 CRITICAL 로 확정됐다 — 이 PR 을 그대로 배포하면 프로덕션/스테이징에서 아바타 이미지가 조용히 깨진다(업로드는 200 성공, 표시만 `http://localhost:9000` 을 가리켜 실패). `requirement` 리뷰어도 동일 결함을 독립적으로 발견(WARNING 등급이었으나 side_effect 의 CRITICAL 판정이 우선). 두 리뷰어가 서로 다른 각도에서 같은 근본 원인을 지목했으므로 신뢰도가 높다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / requirement | k8s `prod`/`staging` overlay 가 신규 env `S3_PUBLIC_BASE_URL` 을 patch 하지 않는다. base ConfigMap 의 `http://localhost:9000` 기본값이 그대로 프로덕션에 실려 배포되면, 업로드는 200 으로 성공하지만 `avatarUrl` 응답이 브라우저가 도달 불가능한 `localhost:9000` 을 가리켜 이미지가 전혀 뜨지 않는다. `S3_ENDPOINT`·`DB_HOST` 등 다른 env 는 두 overlay 모두 `REPLACE_ME`/실 값으로 patch 됐으나 이 신규 var 만 누락됐다. | `k8s/base/configmap.yaml:28` (신규 도입, `S3_PUBLIC_BASE_URL: "http://localhost:9000"`) — 대조: `k8s/overlays/prod/kustomization.yaml:34`, `k8s/overlays/staging/kustomization.yaml:37` (둘 다 이 PR 에서 미수정) | `prod`/`staging` kustomization.yaml 의 `backend-config` patch 목록에 `S3_PUBLIC_BASE_URL` replace 항목 추가(CDN/공개 도메인 값 또는 최소 `REPLACE_ME` sentinel). 배포 전 반드시 해소. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | concurrency | 동시(중복) 아바타 업로드 시 `previousUrl` 이 요청 시작 시점 스냅샷이라, 더블클릭/다중 탭으로 두 업로드가 경합하면 패자(loser)가 방금 올린 S3 객체가 영구 고아로 남을 수 있다(스토리지 누수, 데이터 손실/보안 이슈는 아님). CHANGELOG 의 "경쟁 자체를 없앴다" 서술은 다른 컬럼 lost-update 범위에만 해당하고 `avatarUrl` 컬럼 자체의 동시 교체 경합은 별개로 남아 있다. 테스트는 순차 `await` 만 사용해 이 경합을 재현하지 않는다. | `codebase/backend/src/modules/users/users.service.ts:79-147`(`updateAvatar`), 특히 `:122`(`previousUrl` 스냅샷), `:145`(`deletePreviousAvatarObject`) | 조건부 UPDATE(낙관적 동시성) 또는 per-user advisory lock 으로 직렬화 검토. 최소한 CHANGELOG/JSDoc 서술 범위를 "다른 컬럼 lost update 만 해소"로 좁혀 과신 방지. |
| 3 | testing | `deletePreviousAvatarObject` 의 쿼리스트링/프래그먼트 제거 분기(`key.split(/[?#]/)[0]`)가 회귀 테스트로 커버되지 않는다 — 뮤테이션 실측(전부 GREEN 으로 생존, 27/27). `PATCH /users/me` 로 사용자가 쿼리·프래그먼트 포함 URL 을 넣고 재-PATCH 하면 정리가 조용히 실패해 고아 객체가 남을 수 있다. | `codebase/backend/src/modules/users/users.service.ts:185` | `users-avatar.service.spec.ts` 에 `previousUrl`이 `avatars/{userId}/old.png?x=1#frag` 형태일 때 `s3.delete` 가 스트립된 키로 호출되는지 확인하는 케이스 1건 추가. |
| 4 | testing | `S3Service` 생성자의 `?? endpoint` 2차 방어 폴백이 뮤테이션 실측 결과 0% 커버리지(81/81 GREEN 으로 생존). 주석은 "설정 모듈 미로드 조립에서 undefined 방지"라고 주장하나 이를 검증하는 테스트가 없다. | `codebase/backend/src/common/services/s3.service.ts:40-41` | `createService({ 's3.publicBaseUrl': undefined })` 케이스로 `getPublicUrl()` 이 `endpoint` 로 폴백하는지 검증 추가. 또는 죽은 코드라면 주석에 "테스트되지 않음(의도)" 명시. |
| 5 | maintainability | `UsersService.updateAvatar` 가 검증·조회·업로드·UPDATE·재조회·정리 위임까지 한 함수에서 순차 orchestration — SRP 관점 개선 여지. | `codebase/backend/src/modules/users/users.service.ts:79-147` | 파일/확장자 검증(83-111줄)을 `resolveAvatarUpload()` 같은 private 헬퍼로 분리. |
| 6 | maintainability | `users-avatar.service.spec.ts` 에서 `S3Service` mock + `Test.createTestingModule` 보일러플레이트가 6개 `describe` 블록에서 거의 동일하게 반복(`setup`/`build` 이름도 불일치). | `codebase/backend/src/modules/users/users-avatar.service.spec.ts` (6곳) | `createModule(repoOverrides?, s3Overrides?)` 단일 팩토리로 통합. |
| 7 | architecture | `avatarUrl` 컬럼이 캐노니컬 식별자(S3 key)가 아니라 파생된 공개 URL 전체를 저장 — 서빙 전략(base URL) 변경 시 마이그레이션 필요, `deletePreviousAvatarObject` 의 URL→key 역산 워크어라운드를 유발. | `codebase/backend/src/modules/users/users.service.ts:122-124, 136-137, 149-194` | key 를 저장하고 읽기 시점에 `getPublicUrl(key)` 로 파생시키는 편이 더 강건. 현 구조 유지 시 URL 역산 로직을 `S3Service` 로 이동해 build/parse 대칭 확보. |
| 8 | architecture | `UsersService.update()`(범용, 호출부 17곳)가 `avatarUrl` 필드 하나만을 위한 도메인 특화 부수효과(S3 정리)를 내장 — OCP 위반 소지. 실제로 OAuth `resolveUser()` 가 raw QueryBuilder 로 이 메서드를 우회하는 사례가 이미 존재(캐너리 테스트로 드리프트 감지 중). | `codebase/backend/src/modules/users/users.service.ts:232-246` | "avatarUrl 변경 시 정리" 불변식을 리포지토리 계층 또는 도메인 이벤트 구독자로 분리해 모든 쓰기 경로가 같은 지점을 통과하도록 강제하는 것을 고려. |
| 9 | architecture | `UsersService` 책임이 계속 커진다 — 이번 PR 이 S3 오케스트레이션(업로드·키 생성·URL 조립·정리)까지 얹어 무관한 기존 테스트(`users.service.spec.ts`)도 `S3Service` mock 을 강제로 지게 됨. | `codebase/backend/src/modules/users/users.service.ts:43-194` | 아바타 관련 검증·키 관리·정리 로직을 `UserAvatarService` 로 추출해 위임하는 것을 고려. |
| 10 | performance | best-effort S3 정리(delete)를 응답 임계 경로에서 `await` 해 불필요하게 지연 — 이 저장소의 fire-and-forget 관례(`execution-seq-allocator.service.ts`, `execution-engine.service.ts`)에서 벗어남. 아바타 교체마다 S3 DELETE 왕복 1회만큼 응답이 늦어짐(실패해도 응답에 영향 없음에도). | `codebase/backend/src/modules/users/users.service.ts:145`, `:242-244` | `void this.deletePreviousAvatarObject(...)` 로 전환. 관련 유닛테스트(동기적 단언)도 함께 조정 필요. |
| 11 | requirement | `spec/2-navigation/9-user-profile.md` §5.1/§6.1, `spec/0-overview.md` §2.7, `spec/data-flow/4-file-storage.md` §2.1-2.3 이 실제 구현(엔드포인트 존재, 키 레이아웃 `avatars/{userId}/{uuid}.{ext}`, `S3_PUBLIC_BASE_URL`)과 다른 내용(미구현/다른 키 레이아웃)을 서술 — developer 가 자기 권한 밖임을 인지하고 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 planner 트랙에 정확히 위임함(처리 경로 정상). | `spec/2-navigation/9-user-profile.md:136,334`, `spec/0-overview.md:265-276`, `spec/data-flow/4-file-storage.md:58,71,78,84-87` | [SPEC-DRIFT] planner 턴 착수 시 세 문서 함께 갱신(이미 plan 에 명시, 별도 조치 불요 — 상태 추적용 등재). |
| 12 | documentation | `s3.config.ts` 의 `publicBaseUrl` JSDoc 이 가리키는 SoT(`9-user-profile.md §6.1`)가 아직 "미구현"으로 남아 있어 오도 가능. | `codebase/backend/src/common/config/s3.config.ts:17` | spec 배지 flip PR 머지 전까지 JSDoc 에 "spec 갱신 대기 중" 한 줄 추가 고려. |
| 13 | documentation | plan 문서 두 곳(`spec-sync-user-profile-gaps.md:41`, `spec-update-avatar-upload-implemented.md:89`)이 회귀 테스트 건수를 "13건"으로 인용하나 실제 `users-avatar.service.spec.ts` 는 27건(실측: 단독 `it` 17개 + `it.each` 3+7개) — 같은 커밋 안에서 자기모순, 커버리지 규모 과소평가 유발. | `plan/in-progress/spec-sync-user-profile-gaps.md:41`, `plan/in-progress/spec-update-avatar-upload-implemented.md:89` | "27건(§6.1 핵심 3축 13건 + 리뷰 1·2라운드 대응 14건)"으로 정정하거나 각주 추가. |
| 14 | api_contract | `PATCH /api/users/me` 의 Swagger 문서가 `avatarUrl` 변경 시 생기는 새 부작용(이전 S3 아바타 객체 삭제)을 반영하지 않는다. | `codebase/backend/src/modules/users/users.controller.ts:120-129` (부작용 실체는 `users.service.ts:232`) | `@ApiOperation.description` 에 "이전 아바타 객체가 있으면 교체 시 정리됨(best-effort)" 한 줄 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 15 | security | 업로드 파일의 매직 넘버(실제 바이트 시그니처) 미검증, 확장자만으로 Content-Type 결정 — 폴리글랏 파일이 공개 버킷에 저장될 여지(낮은 위험, 클라이언트 mimetype 은 신뢰하지 않는 설계는 타당). | `codebase/backend/src/modules/users/users.service.ts:93-111` | defense-in-depth 로 매직 넘버 검증(예: `file-type` 라이브러리) 고려, 필수 아님. |
| 16 | security | 공개 버킷의 유일한 접근 통제(익명 GetObject-only, ListBucket 차단) 버킷 정책을 검증하는 CI 회귀 테스트가 없다 — 이미 plan 에 유예 항목으로 기록됨. | `scripts/minio/avatars-public-read.json`, `docker-compose.yml:71-77` | 부팅 시 익명 `?list-type=2` 요청이 403 인지 확인하는 경량 스모크 체크를 다음 이터레이션에서 고려. |
| 17 | performance | `UPDATE` 뒤 별도 `findOneOrFail` 재조회 — `updateReturningRows` 컨벤션 적용 여지 있으나 현재 트래픽 규모에서는 우선순위 낮음. | `codebase/backend/src/modules/users/users.service.ts:137-141, 239-240` | 고빈도가 되면 `updateReturningRows` 적용 검토(현재는 조치 불요). |
| 18 | performance | 아바타 파일 전체가 요청당 메모리에 버퍼링(2MB 상한과 정합, 현재 문제없음). | `codebase/backend/src/modules/users/users.controller.ts` (`FileInterceptor` limits) | 동시성 커지면 스트리밍 업로드 고려. |
| 19 | architecture | URL 조립(`S3Service.getPublicUrl`)과 URL→key 역산(`UsersService.deletePreviousAvatarObject`)의 책임이 서로 다른 클래스에 분산. | `common/services/s3.service.ts:86-95` vs `users/users.service.ts:149-194` | `S3Service` 에 `extractKeyFromPublicUrl()` 대칭 메서드 추가 고려. |
| 20 | architecture | `S3Service` 가 공유 모듈 대신 `UsersModule` 지역 provider 로 재선언(기존 KB 모듈 패턴 답습, 회귀 아님). | `codebase/backend/src/modules/users/users.module.ts:22-24` | 소비 모듈 3개 이상 늘면 공유 `StorageModule` 검토. |
| 21 | architecture | 아바타 상수(`AVATAR_CONTENT_TYPES`, `AVATAR_MAX_BYTES`)가 `UsersService` public static 멤버로 노출되어 DI 우회 정적 참조 발생. | `users.service.ts:43-52`, `users.controller.ts`, `users-avatar-swagger-sync.spec.ts` | `avatar.constants.ts` 로 추출 고려, 우선순위 낮음. |
| 22 | architecture | `UsersService` 가 `S3Service` 구체 클래스에 직접 의존(포트/인터페이스 없음) — 저장소 전반 관례와 일관되므로 YAGNI. | `users.service.ts:27` | 서빙 전략이 실제로 바뀌는 시점에 재고. |
| 23 | requirement | 이번 diff 에 `codebase/frontend/**` 변경이 없어 업로드 UI 가 아직 없음 — 기능이 최종 사용자에게 도달 불가능(스코프 판단, 결함 아님). plan 트래커 항목에 FE 범위 구분 표기가 없음. | `codebase/frontend/src/lib/api/users.ts` | 트래커 항목에 "backend + 배포 인프라만, FE 는 별도" 한 줄 명시. |
| 24 | requirement | `updateAvatar` 의 "빈 파일 거부"가 `file === undefined` 케이스만 회귀 테스트로 고정, `Buffer.alloc(0)` 케이스는 별도 미단언(구현 자체는 `?.length` 로 두 케이스 동일 처리해 위험 낮음). | `users-avatar.service.spec.ts:124-130` | `it.each` 에 `buffer: Buffer.alloc(0)` 케이스 추가 고려, 필수 아님. |
| 25 | maintainability | 확장자→Content-Type 판정이 `&&`/삼항이 겹친 밀집 표현식. | `users.service.ts:98-105` | `resolveContentType()` 헬퍼로 추출 고려. |
| 26 | maintainability | `S3Service` 생성자의 `publicBaseUrl` 폴백이 `s3.config.ts` 3단 폴백과 형태상 중복(의도는 주석으로 명확). | `common/services/s3.service.ts:32-41` | `s3.config.ts` 쪽에 역참조 주석 추가 고려. |
| 27 | maintainability | swagger 동기화 테스트의 정규식 두 개가 진입장벽(문서화는 충분). | `users-avatar-swagger-sync.spec.ts` | 정규식 옆 한계 주석 추가 고려. |
| 28 | testing | `PATCH` 로 아바타를 `null` 로 명시 제거하는 경로가 이름 붙은 케이스로 없음(코드 경로는 뚫려 있음). | `users-avatar.service.spec.ts` (~235행) | `build(null)` 케이스 추가 고려. |
| 29 | testing | 대문자/혼합 대소문자 확장자, 파일명에 점 여러 개인 경우 명시 테스트 없음(구현은 `.toLowerCase()` 로 안전). | `users.service.ts:97` | `it.each` 로 `'me.PNG'`, `'a.b.PNG'` 케이스 추가 고려. |
| 30 | testing | `UsersController.uploadAvatar` 단위 테스트에 서비스 예외 전파 케이스 없음(순수 위임이라 위험 낮음). | `users.controller.spec.ts` | 우선순위 낮음. |
| 31 | documentation | README.md 의 `S3_PUBLIC_BASE_URL` 주석이 다른 문서 대비 버킷 정책 선행조건 누락. | `README.md:212` | `scripts/minio/README.md` 참조 한 줄 추가. |
| 32 | documentation | `AVATAR_MAX_BYTES` JSDoc 과 컨트롤러 주석이 같은 관계("~해야 한다" vs "~할 수 없다")를 다르게 서술. | `users.service.ts:51` vs `users.controller.ts` | 프레이밍 통일. |
| 33 | documentation | `S3Service.getPublicUrl` JSDoc 에 `@returns` 설명 없음. | `common/services/s3.service.ts:84,86` | `@returns` 한 줄 추가. |
| 34 | api_contract | `UserProfileDto.avatarUrl` 필드 자체 Swagger 문서에 "공개 URL(access-control 없음)" 의미 미반영. | `users/dto/responses/user-response.dto.ts:15-16` | description 보강 고려. |
| 35 | api_contract | 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 중앙 에러 카탈로그에 아직 미등재(이미 planner 후속 작업으로 추적 중). | `users.service.ts:88,108` | 별도 조치 불요(추적 중). |
| 36 | api_contract | `FileInterceptor` 에 `fileFilter` 없어 타입 검증이 버퍼링 이후(서비스 레이어)에 일어남(계약 위반 아님). | `users.controller.ts:143-157` | 필요 시 `fileFilter` 로 조기 차단 가능, 필수 아님. |
| 37 | user_guide_sync | 신규 API 의 user-guide target(b) 미충족처럼 보이나 FE 진입점이 0건이라 시기상조로 판단(WARNING 아님). plan 체크박스가 FE 후속 여부를 명시하지 않아 추적 공백. | `plan/in-progress/spec-sync-user-profile-gaps.md` | FE 업로드 UI 착수 plan 신설 시 user-guide 문서화 + `<ImplAnchor kind="ui-entry">` 를 그 plan 할 일에 명시. |
| 38 | scope | `Express`→`ExpressNS` 리네임이 무관한 두 메서드(`changePassword`, `verifyEmailChange`)의 타입 표기까지 함께 변경(필요성·범위 축소 근거 문서화됨, 조치 불요). | `users.controller.ts:57, 214-215, 301-302` | 조치 불요. |
| 39 | scope | `UsersService.update()` 에 아바타 정리 로직이 추가돼 기존 `PATCH /users/me` 의 부수효과가 넓어짐(의도적 확장, 조건부 가드로 최소화됨). | `users.service.ts:232-246` | 조치 불요, 참고 표시. |
| 40 | scope | `toProfileData()` 헬퍼 추출이 기존 `getMe`/`updateMe` 응답 조립 코드도 함께 리팩터(순수 추출, 회귀 위험 낮음). | `users.controller.ts:84-93, 113, 140` | 조치 불요. |
| 41 | dependency | 신규 외부 패키지 추가 없음(전부 기존 의존성 재사용, UUID 는 stdlib `randomUUID` 사용). | 전역 | 조치 불요. |
| 42 | concurrency | `update()`/`updateAvatar()` 의 UPDATE 후 별도 재조회 사이 다른 동시 쓰기가 끼어들면 응답 페이로드가 자신이 쓴 값이 아닐 수 있음(같은 사용자 소유 데이터라 정보 유출 아님, 기존 설계). | `users.service.ts:137-141, 239-240` | 클라이언트가 응답을 신뢰해 상태를 덮어쓰는 UX 라면 `UPDATE...RETURNING` 전환 고려. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 매직 넘버 미검증(INFO), 버킷 정책 CI 검증 부재(WARNING, 이미 유예됨), IDOR 방어 확인(INFO) |
| performance | LOW | best-effort S3 delete 를 응답 경로에서 await(WARNING), 재조회/버퍼링은 INFO |
| architecture | MEDIUM | URL 영속화로 인한 key/URL 결합(WARNING), 범용 update() 의 OCP 위반(WARNING), UsersService 책임 확대(WARNING) |
| requirement | MEDIUM | k8s S3_PUBLIC_BASE_URL 미교정(WARNING, side_effect 가 CRITICAL 로 확정), SPEC-DRIFT 3건(정상 위임), FE 미착수(INFO) |
| scope | LOW | 3건의 "정당화된 collateral" 변경, 전부 근거 문서화됨 |
| side_effect | **CRITICAL** | k8s prod/staging S3_PUBLIC_BASE_URL 미패치로 배포 시 아바타 URL 이 localhost 를 가리킴 |
| maintainability | LOW | updateAvatar 다중 책임(WARNING), 테스트 mock 보일러플레이트 반복(WARNING) |
| testing | LOW | 뮤테이션 실측으로 커버리지 갭 2건 확인(WARNING) — 쿼리스트링 스트립, `?? endpoint` 폴백 |
| documentation | LOW | spec SoT 참조가 아직 미구현 상태(WARNING), plan 테스트 건수 불일치 13 vs 27(WARNING) |
| dependency | NONE | 신규 의존성 없음, 기존 컨벤션과 일관 |
| concurrency | LOW | 동시 업로드 시 패자 객체 영구 고아 가능(WARNING), 재조회 사이 응답 오염 가능성(INFO) |
| api_contract | LOW | PATCH 부작용 미문서화(WARNING), DTO 필드 공개 URL 의미 미반영(INFO) |
| user_guide_sync | LOW | FE 진입점 부재로 user-guide 갱신 시기상조(INFO), env var/spec-defect 는 정합 확인 |

## 발견 없는 에이전트

없음 — 전 13개 reviewer 모두 최소 1건 이상의 발견사항(CRITICAL/WARNING/INFO) 보고.

## 권장 조치사항

1. **(배포 차단급)** `k8s/overlays/prod/kustomization.yaml`, `k8s/overlays/staging/kustomization.yaml` 에 `S3_PUBLIC_BASE_URL` patch 항목을 추가한다(CDN/공개 도메인 값 또는 최소 `REPLACE_ME` sentinel) — 이 PR 을 prod/staging 에 배포하기 전 반드시 해소.
2. 동시 업로드 경합으로 인한 S3 객체 영구 고아 가능성(#2)을 문서 범위 축소 또는 낙관적 락/advisory lock 으로 완화한다.
3. 뮤테이션 실측으로 확인된 두 테스트 커버리지 갭(#3 쿼리스트링/프래그먼트 스트립, #4 `?? endpoint` 폴백)에 대한 테스트 케이스를 추가한다.
4. best-effort S3 삭제(`deletePreviousAvatarObject`)를 응답 경로에서 `void` 로 전환해 불필요한 지연을 제거한다(#10).
5. plan 문서의 회귀 테스트 건수 "13건"을 실제 27건으로 정정한다(#13).
6. `PATCH /users/me` Swagger 설명에 아바타 정리 부작용을 명시한다(#14).
7. [SPEC-DRIFT] planner 턴이 착수될 때 `9-user-profile.md`·`0-overview.md §2.7`·`data-flow/4-file-storage.md` 세 spec 문서를 실제 구현에 맞춰 갱신한다(이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 에 추적 중).
8. (낮은 우선순위) 아키텍처 부채 3건(#7 URL 대신 key 영속화, #8 OCP 우회 방지, #9 UsersService 책임 분리)은 다음 유사 기능(파일 업로드 확장) 착수 전에 재고할 것.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, concurrency, api_contract, user_guide_sync (13명)
  - **제외**: database (1명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | database | router 가 이번 changeset 에 DB 스키마/쿼리 관련 실질 변경이 없다고 판단(마이그레이션 파일 변경 없음, 컬럼 단위 UPDATE 사용은 기존 패턴). |