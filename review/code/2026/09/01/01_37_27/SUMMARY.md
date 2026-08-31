# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 6건(그중 3건은 `[SPEC-DRIFT]` — 구현이 옳고 spec 문서가 아직 반영 전인 상태로, 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 를 통해 planner 트랙으로 정상 위임되어 있음). forced(router_safety) 8개 reviewer 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음. 이 changeset 은 8~9라운드의 review-fix 루프를 거친 상태이며, 과거 라운드가 지적한 CRITICAL(로그인 카운터 read-modify-write 가 아바타 정리를 반대 방향에서 되돌리던 lost-update)은 모든 reviewer 가 코드 직접 확인으로 해소를 재검증했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/2-navigation/9-user-profile.md` 가 `POST /api/users/me/avatar` 를 여전히 "미구현 (Planned)" 으로 서술 — 실제로는 unit+e2e 로 완전히 구현·테스트됨. 코드가 옳고 spec 이 낡음 | `spec/2-navigation/9-user-profile.md:334`, `:136` | planner 턴에서 `plan/in-progress/spec-update-avatar-upload-implemented.md` 대로 취소선 해제 + §6.1 계약 기재. 코드 변경 불요 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` 스토리지 키 레이아웃이 spec(`{workspaceId}/avatars/<userId>.<ext>`, 고정 파일명)과 실제 구현(`avatars/{userId}/{uuid}.{ext}`, workspaceId 없음, UUID 파일명)이 서로 다름. 코드가 옳음(User 는 workspace 비종속, UUID 는 공개 버킷 접근통제 필수) | `spec/0-overview.md:276`, `spec/data-flow/4-file-storage.md:57-59,71,78` ↔ `codebase/backend/src/modules/users/users.service.ts:130` | planner 턴에서 세 문서 키 패턴 갱신. 코드 변경 불요 |
| 3 | SPEC-DRIFT | `[SPEC-DRIFT]` 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 중앙 에러 카탈로그에 미등재 | `spec/5-system/3-error-handling.md` §1 ↔ `codebase/backend/src/modules/users/users.service.ts:95,115` | planner 턴에서 카탈로그에 등재. 코드 변경 불요 |
| 4 | Concurrency | 아바타 교체 경로 TOCTOU — `previousUrl` 을 비원자적 사전 SELECT 로 캡처해, 동시 업로드/PATCH 교차 시 "패자"가 올린 S3 오브젝트가 영구 고아로 남을 수 있음(데이터 정합성 훼손은 없음, 저장공간 낭비만). CHANGELOG·plan 에 재개 신호와 함께 이미 disclose·유예됨 | `codebase/backend/src/modules/users/users.service.ts:129-154`(`updateAvatar`), `:241-253`(`update`) | 신규 조치 불요 — 유예 유지, `avatars/` 접두 객체 수 모니터링만 추적 |
| 5 | Testing | `uploadAvatar` 컨트롤러 테스트에 형제 엔드포인트(`getMe`/`changePassword` 등)와 달리 서비스 예외 전파(`rejects.toThrow`) 테스트가 없음 | `codebase/backend/src/modules/users/users.controller.spec.ts:390-450` | 서비스가 던진 예외(`BadRequestException`/`NotFoundException`)가 컨트롤러에서 삼켜지지 않음을 확인하는 케이스 1건 추가 |
| 6 | Documentation | CHANGELOG 가 이 PR 이 함께 들여온 `incrementLoginAttempts`/`isLocked` 의 보안 관련 동작 변경(원자적 `UPDATE...RETURNING` 재작성 + 신규 쓰기/읽기 시계 비대칭)을 언급하지 않음. 같은 섹션이 사소한 `ExpressNS` 리네임은 한 문단으로 disclose하면서 이 변경은 누락 | `CHANGELOG.md:1-66` ↔ `codebase/backend/src/modules/users/users.service.ts` `incrementLoginAttempts`(325-373), `isLocked`(382-404) | CHANGELOG 에 collateral 변경(원자 재작성 + 시계 비대칭) 한 문단 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 업로드 파일 매직바이트(실콘텐츠) 미검증 — 확장자 화이트리스트만 판정. 서버 강제 Content-Type + SVG 제외가 1차 방어라 실위험 낮음. plan 에 재개 신호와 함께 유예됨 | `users.service.ts:104-118` | 서버측 이미지 파싱 기능 도입 시 매직바이트 검증 전제조건으로 재검토 |
| 2 | Security | 공개 아바타 응답에 `X-Content-Type-Options: nosniff` 헤더 부재 | `common/services/s3.service.ts:53-67` | 필수 아님. CDN 앞단 도입 시 헤더 정책으로 보완 고려 |
| 3 | Security | 아바타 업로드 전용 rate limit 없음 — 전역 스로틀만 적용(기존 컨벤션과 동일) | `users.controller.ts:149-200` | 필수 아님. 스토리지 남용 관측 시 `@Throttle` 검토 |
| 4 | Performance | multer 기본 `MemoryStorage` 로 업로드 파일 전체가 요청마다 인메모리 버퍼로 적재(2MB 상한 + 전역 스로틀로 완화) | `users.controller.ts` `uploadAvatar` FileInterceptor | 현재 범위 조치 불요. 더 큰 업로드로 재사용 시 스트리밍/디스크 스풀 검토 |
| 5 | Performance / Dependency | `S3Service` 가 `UsersModule`/`KnowledgeBaseModule` 각각 지역 provider 라 `S3Client`(커넥션 풀)가 모듈별 중복 생성(부팅 1회, 기존 컨벤션) | `users.module.ts` | 3번째 소비 모듈 추가 시 `@Global` 승격 검토 |
| 6 | Performance | `updateAvatar` 가 DB 왕복 3회(find→update→findOneOrFail). 병렬화(Promise.all)는 이미 적용됨 | `users.service.ts` `updateAvatar` | hot path 아님, 우선순위 낮음. 필요 시 `UPDATE...RETURNING` 패턴 재사용 |
| 7 | Requirement / Testing | 파일 크기 상한(2MB) 경계값 성공 케이스 테스트 없음(초과 거부만 e2e 검증) | `test/users-avatar-upload.e2e-spec.ts:118-133` | 우선순위 낮음. 정확히 상한 크기에서 200 을 기대하는 케이스 추가 |
| 8 | Scope | `import Express` → `ExpressNS` 리네임이 기능과 무관한 기존 2개 엔드포인트(`changePassword`, `verifyEmailChange`) 타입 표기까지 함께 변경(런타임 영향 없음, 불가피한 side effect, CHANGELOG disclose됨) | `users.controller.ts` | 조치 불요 |
| 9 | Scope | `UsersService.update()`(호출부 17곳)가 avatar 정리 로직을 새로 얻어 공용 PATCH 경로에 관측 가능한 부작용(S3 삭제) 추가 — 같은 기능 정합성을 위한 의도된 확장, 범위 최소화(조건부 SELECT) 근거 있음 | `users.service.ts` `update()` | 조치 불요 |
| 10 | Maintainability | `updateAvatar` 가 검증+업로드+DB갱신+정리 오케스트레이션을 한 메서드(~70줄)에서 처리. plan 에 "지금은 분리 불필요"로 유예됨 | `users.service.ts:86-156` | 검증 규칙 추가 시점을 재개 신호로 |
| 11 | Maintainability | `USER_NOT_FOUND` `NotFoundException` 리터럴이 컨트롤러/서비스 5곳에 반복 | `users.controller.ts:110,140`, `users.service.ts:125,277,368` | 급하지 않음. 재발 시 팩토리 헬퍼 검토 |
| 12 | Maintainability | `update()` 의 `previousUrl` 계산이 `await` 포함 중첩 삼항이라 가독성 낮음 | `users.service.ts:241-246` | 급하지 않음. `if`/변수 할당 형태로 정리 검토 |
| 13 | Maintainability | `updateAvatar` 의 `if (!user) throw ...` 다중행 분기만 파일 내 다른 다중행 분기와 달리 중괄호 생략 | `users.service.ts:121-127` | 중괄호 추가 권장(사소) |
| 14 | Testing | 동시 업로드 TOCTOU(WARNING #4) 에 대응하는 소스 캐너리(`it.todo` 등)가 없어, 이미 확립된 "유예는 캐너리로 고정" 관례에서 이 축만 예외 | `users-avatar.service.spec.ts:170-256` | `it.todo(...)` 한 줄로 "놓친 것"과 "의도적 유예"를 구분 권장 |
| 15 | Testing | 확장자 파싱 경계값(더블 확장자 `me.tar.gz`, 트레일링 점 `me.`)이 명시 테스트 없음(기존 부정 케이스와 동일 분기라 실위험 낮음) | `users.service.ts:104-118` | 우선순위 낮음. `it.each` 에 2건 추가 검토 |
| 16 | Documentation | `k8s/README.md` 표 행이 한 셀에 4개 사실을 담아 밀도 높음(직전 라운드부터 조치 불요로 판단됨, 내용 정확성은 재확인됨) | `k8s/README.md:183` | 조치 불요 |
| 17 | Database / Security | `isLocked()` 쓰기(DB `NOW()`)/읽기(앱 서버 시계) 클럭 비대칭 — 코드 JSDoc·plan 에 근거·재개조건과 함께 disclose됨(단, CHANGELOG 는 WARNING #6 대로 누락) | `users.service.ts:346-373`(쓰기), `:382-404`(`isLocked`) | 다중 인스턴스 NTP 드리프트 관측 시 DB 기준 판정 전환 검토 |
| 18 | api_contract | 신규 에러 코드 `FILE_REQUIRED` 카탈로그 미등재(WARNING #3 과 동일 사실, api_contract reviewer 는 INFO 로 평가) | `spec/5-system/3-error-handling.md` §1 | WARNING #3 처리 시 함께 해소 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 과거 CRITICAL(lost-update) 해소 재확인. 매직바이트 미검증·nosniff 부재는 INFO, 유예 타당 |
| performance | LOW | N+1/O(n²) 없음. 메모리 버퍼링·S3Client 중복 생성·DB 3왕복은 INFO |
| requirement | LOW | 기능 완전성 확인. spec 3곳 SPEC-DRIFT(코드가 옳음), planner 위임 정상 |
| scope | LOW | 4개 collateral 변경 전부 정당화됨(리네임, update() 확장, 헬퍼 추출, 로그인카운터 원자화) |
| side_effect | LOW | 이번 라운드 실변경은 JSDoc+테스트뿐. 직전 WARNING(클럭 비대칭 미기재) 이번 커밋에서 disclose로 해소 |
| maintainability | LOW | 함수 길이·리터럴 반복·중첩 삼항 등 스타일 수준 INFO 5건, 이전 WARNING 2건은 해소 확인 |
| testing | LOW | 촘촘한 뮤테이션 검증 이력. 컨트롤러 예외전파 테스트 누락(WARNING), TOCTOU 캐너리 부재(INFO) |
| documentation | LOW | CHANGELOG 가 로그인카운터 원자화+클럭비대칭 collateral 변경 미언급(WARNING) |
| dependency | NONE | 신규 패키지 없음. `S3Service` 지역 provider 패턴은 기존 컨벤션 |
| database | LOW | 이번 라운드 DB 동작 변경 없음(JSDoc+테스트뿐). 트랜잭션 없이도 정합성 성립 구조 확인 |
| concurrency | LOW | 과거 CRITICAL(lost-update) 해소 확인. `avatarUrl` 자체 TOCTOU 는 WARNING(기유예) |
| api_contract | LOW | 응답 봉투·에러코드·인증 일관성 확인. `FILE_REQUIRED` 미등재만 INFO |

## 발견 없는 에이전트

없음 — 12개 reviewer 전원이 최소 1건 이상의 발견사항(대부분 INFO, 일부 WARNING)을 보고했다. Critical 은 전원 0건.

## 권장 조치사항

1. (WARNING #6) CHANGELOG 에 `incrementLoginAttempts`/`isLocked` 원자적 재작성 + 시계 비대칭 collateral 변경을 한 문단으로 disclose한다 — 보안 관련 동작 변경이 CHANGELOG 에서 완전히 빠져 있는 것이 가장 실질적인 갭이다.
2. (WARNING #5) `uploadAvatar` 컨트롤러 테스트에 서비스 예외 전파(`rejects.toThrow`) 케이스 1건을 추가해 형제 엔드포인트 패턴과 정렬한다.
3. (WARNING #1~#3, SPEC-DRIFT) `plan/in-progress/spec-update-avatar-upload-implemented.md` 를 근거로 planner 턴에서 `spec/2-navigation/9-user-profile.md`(구현 배지) · `spec/0-overview.md` + `spec/data-flow/4-file-storage.md`(키 레이아웃) · `spec/5-system/3-error-handling.md`(에러 카탈로그) 3문서를 갱신한다. 코드 변경은 불요.
4. (WARNING #4) 동시 업로드 TOCTOU 유예는 그대로 유지하되, `avatars/` 접두 객체 수 모니터링이 실제로 설정돼 재개 신호를 놓치지 않도록 후속 확인한다.
5. (INFO, 선택) 테스트 캐너리(`it.todo`) 로 TOCTOU 유예를 소스에 고정해 "테스트가 놓친 것"과 "의도적 유예"를 구분한다.
6. 그 외 INFO 항목(매직바이트 검증, nosniff 헤더, 함수 길이, 리터럴 중복 등)은 각 리뷰어가 명시한 재개 신호가 발생하기 전까지 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract` (12명)
  - **제외**: 표 참고 (2명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단(이번 diff 는 KB 모듈과 동일한 기존 아키텍처 패턴 재사용이라 별도 아키텍처 리뷰 불요로 판단된 것으로 추정 — manifest 에 세부 사유 미제공) |
  | user_guide_sync | router 판단(backend 전용 변경이라 사용자 가이드 동기화 대상 아님으로 판단된 것으로 추정 — manifest 에 세부 사유 미제공) |