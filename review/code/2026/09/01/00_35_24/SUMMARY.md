# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(모두 저위험: 주석 중복 1건 + 진단용 부팅 경고의 테스트 커버리지 갭 1건). requirement reviewer 가 태깅한 SPEC-DRIFT 3건은 코드가 아니라 spec 문서가 낡은 것으로, 전부 `plan/in-progress/spec-update-avatar-upload-implemented.md` 에 대상 줄 번호와 함께 이미 planner 트랙으로 위임돼 있다. 13개 실행 reviewer(강제 8명 포함) 전원 결과 확보 — 강제 화이트리스트 미이행 없음(forced 전원 결과 확보됨, prompt 명시). 개별 reviewer 중 testing 만 MEDIUM 을 매겼는데(아래 표 참고), 근거는 "프로덕션 부팅 시 `S3_PUBLIC_BASE_URL` 사설/loopback 경고"의 실제 배선이 뮤테이션 실측상 어떤 테스트로도 커버되지 않는다는 것 — 이 경고는 warn-only 진단이라 요청 경로·보안에는 영향이 없다.

## Critical 발견사항

_없음._

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/문서화 | `ExpressNS` 리네임 근거 주석이 거의 동일한 내용으로 두 번 반복됨. 최신 커밋(`ecaa785bd`, "리뷰 5R")이 직전 라운드 WARNING(리네임 컨벤션 미문서화)에 대응하며 기존 문단을 지우지 않고 그 위에 거의 같은 내용을 다시 추가했다. scope·maintainability·documentation 3개 reviewer 가 동일 지적(중복 판정). | `codebase/backend/src/modules/users/users.controller.ts:53-61` | 두 문단을 하나로 합친다 — 근거 설명은 한 번만 남기고, 두 번째 문단의 신규 정보("다른 컨트롤러 4곳은 `Express` 그대로 — 전역 컨벤션 승격 전 `spec/conventions/` 문서화 선행 필요")만 이어 붙인다 |
| 2 | 테스트 | `main.ts` 부팅 시 `S3_PUBLIC_BASE_URL` 사설/loopback 경고의 실제 배선(`NODE_ENV==='production'` && `isPrivateHost(resolvePublicBaseUrl(...))` 조합)이 어떤 테스트로도 커버되지 않음 — 조건을 `if (false && ...)` 로 뮤테이션해도 관련 스펙 6개 85건 전부 GREEN(원복 완료, `git status --short` 로 확인). CHANGELOG 가 스스로 "같은 클래스의 근접사고가 있었다"고 적은 회귀를 지금은 아무 테스트도 못 잡는다 | `codebase/backend/src/main.ts` `bootstrap()` production 가드 블록 | `shouldWarnPublicBaseIsPrivate(env): boolean` 같은 순수 함수로 조합 판정을 추출해 유닛 테스트로 고정하거나, 최소한 이 PR 이 이미 쓴 소스-캐너리 패턴으로 배선 자체를 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `uploadAvatar` 에 `changePassword`/`requestEmailChange` 와 같은 급의 전용 throttle 이 없음(전역 기본 throttle 은 적용됨) | `users.controller.ts` `uploadAvatar` | 방어 심화 차원에서 별도 하한 throttle 검토(즉시 조치 불요) |
| 2 | 보안 | 업로드 바이트의 매직 넘버(실제 이미지 포맷) 미검증 — 확장자만으로 화이트리스트 판정, 현재 위협모델(저장형 XSS)에는 이미 충분히 대응됨 | `users.service.ts` `updateAvatar` (확장자 파싱 블록) | 향후 이미지 처리 파이프라인 추가 전에 매직 넘버 검증 고려 |
| 3 | 아키텍처 | `UsersService` 가 프로필 CRUD 외 S3 오케스트레이션(키 네이밍·정리·URL 역파싱)까지 겸임 — SRP 흐려짐, 이미 측정 가능한 재개 신호와 함께 유예 등재됨 | `users.service.ts` `updateAvatar`/`deletePreviousAvatarObject`/`avatarKeyPrefix` | 소비자가 하나 더 늘어날 때(`UserAvatarService` 분리) 재개 |
| 4 | 아키텍처 | URL **생성**(`S3Service.getPublicUrl`)과 **역산**(`UsersService.deletePreviousAvatarObject`)이 서로 다른 클래스에 비대칭으로 존재 — 이미 유예 등재됨 | `s3.service.ts` ↔ `users.service.ts` | 대칭 메서드(`extractKeyFromPublicUrl`) 도입 시 `S3Service` 로 이관 |
| 5 | 아키텍처/의존성 | `S3Service` 가 소비 모듈(`UsersModule`, `KnowledgeBaseModule`)마다 지역 provider 로 등록돼 `S3Client` 커넥션 풀이 모듈별로 중복 — 기존 KB 모듈 패턴을 그대로 따른 것이라 신규 결함 아님 | `users.module.ts` / `knowledge-base.module.ts` | 세 번째 소비 모듈 등장 시 공유 `S3Module` 승격 검토 |
| 6 | 아키텍처 | 신규 캐너리 테스트가 `auth-oauth.service.ts` 소스를 문자열로 읽어 리터럴 매칭 — 모듈 경계를 넘는 결합이나, "런타임 assertion 으로는 두 분기를 가를 수 없다(vacuous)"는 실측 근거로 의도적으로 선택된 차선책 | `users-avatar.service.spec.ts` OAuth 캐너리 | OAuth stub 이 공급자 사진 fixture 를 지원하게 되면 런타임 통합 테스트로 승격 |
| 7 | 부작용 | `UsersService.update()`(다수 호출부 공유)에 "avatarUrl 변경 시 S3 삭제" side effect 가 조건부로 심어짐 — 오늘 시점 그 조건을 만족하는 호출부는 `updateMe` 뿐이고 JSDoc/Swagger/캐너리 테스트로 방어됨 | `users.service.ts` `update()` (`'avatarUrl' in data` 분기) | 새 호출자가 `avatarUrl` 을 포함시킬 가능성 생기면 JSDoc 참조 유지 |
| 8 | 유지보수성 | `updateAvatar` 가 검증·업로드·영속화·정리를 한 메서드에서 처리 — 즉시 리팩터 필요 수준은 아님 | `users.service.ts` `updateAvatar` (79~149행) | 단계가 더 늘어나면 `resolveContentType` 등 순수 함수로 분리 검토 |
| 9 | 유지보수성 | 확장자 검증 삼항식에 `&&`/`hasOwnProperty` 조건이 밀집 | `users.service.ts` `updateAvatar` 97~105행 | 가드절(`if`) 형태로 바꾸면 가독성 소폭 개선 |
| 10 | 테스트 | 2MB 업로드 상한의 실제 413 응답을 검증하는 런타임 테스트 없음(정적 동기화 테스트만 존재) | `users.controller.ts` `uploadAvatar`(`FileInterceptor` limits) | e2e 에 413 케이스 1개 추가 검토 |
| 11 | 테스트 | `PATCH /users/me` 를 통한 아바타 정리 경로는 유닛(mock)만 있고 e2e 없음 — `POST /me/avatar` 와 비대칭(다만 PATCH 자체가 이 PR 이전부터 e2e 없음, 새 갭 아님) | `users.service.ts` `update()` | 향후 `PATCH /users/me` e2e 추가 시 "avatarUrl 생략 시 S3 호출 없음" 케이스 포함 |
| 12 | 문서화 | `S3Service.getPublicUrl` JSDoc 에 `@returns` 설명 누락(3·5라운드부터 이어진 낮은 우선순위 항목) | `s3.service.ts:69-86` | `@returns` 한 줄 추가(선택 사항) |
| 13 | 문서화 | `AVATAR_MAX_BYTES` JSDoc 문구("같은 값이어야 한다")가 실제로는 상수 직접 참조라는 사실과 표현이 어긋남 | `users.service.ts:51` | JSDoc 을 "컨트롤러가 이 값을 직접 참조" 로 정정(선택 사항) |
| 14 | 동시성/DB | `avatarUrl` 동시 갱신 TOCTOU — `updateAvatar` 끼리, 그리고 `updateAvatar`↔`update` 교차 인터리빙 시 "패자" S3 객체가 영구 고아로 남을 수 있음. DB row 정합성은 훼손되지 않음(최종 값은 항상 유효한 URL). 측정 가능한 재개 신호(`avatars/` 접두 객체 수가 사용자 수를 유의미하게 초과)와 함께 이미 유예 등재됨 | `users.service.ts` `updateAvatar`/`update` | per-user advisory lock 또는 주기적 orphan-sweep 배치(재개 신호 발생 시) |
| 15 | API 계약 | `avatarUrl` 필드에 값을 넣는 두 경로 공존 — `PATCH /users/me`(임의 외부 URL, `@IsUrl`) vs `POST /me/avatar`(서버 생성 S3 URL). CHANGELOG 에 명시적으로 disclose 된 의도된 설계 | `update-me.dto.ts` ↔ `users.controller.ts` `uploadAvatar` | 조치 불요 — 응답 스키마 동일, 계약 일관성 유지됨 |
| 16 | 문서 동기화 | 신규 `POST /me/avatar` 에 대응하는 프런트엔드 업로드 UI/유저 가이드(`07-workspace-and-team/password-and-sessions.mdx`)가 아직 없음 — 이번 PR 은 백엔드 전용(frontend 변경 0건)이라 "누락"이라기보다 "아직 미트리거"에 가까우나, 이 후속 작업을 추적하는 `plan/in-progress/` 항목이 현재 없음 | `content/docs/07-workspace-and-team/password-and-sessions.mdx` (frontmatter 가 `users.controller.ts` 를 SoT 로 명시) | 프런트엔드 업로드 UI 를 붙이는 PR 에서 가이드 동반 갱신을 명시한 `plan/in-progress/` 항목 신설 권장 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/9-user-profile.md` 가 `POST /api/users/me/avatar` 를 여전히 "미구현 (Planned)" 으로 서술 — 구현은 완료됐고 유닛+e2e 5건(익명 GET 200·목록 403·교체 후 404 실 MinIO 검증)으로 뒷받침됨 | `spec/2-navigation/9-user-profile.md:334, :136` | 코드 유지. planner 턴에서 배지 flip + §6.1 엔드포인트 계약(멀티파트 필드명·2MB 상한·허용 확장자·응답 봉투) 채움 — 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 에 등재됨 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] 스토리지 키 레이아웃이 spec 과 어긋남 — spec 은 `{workspaceId}/avatars/{userId}.{ext}`(미구현 표기), 실제는 `avatars/{userId}/{uuid}.{ext}`(User 는 워크스페이스 종속 아님 + UUID 파일명이 공개 버킷 접근 통제). 단순 서술 차이가 아니라 spec 을 SoT 삼아 버킷 정책을 설계하면 "업로드는 성공, 이미지만 403" 이 되는 **운영 위험**이 있음(실제 정책 파일은 구현 키를 정확히 따르고 있어 코드/인프라는 일치, spec 만 어긋남) | `spec/0-overview.md:265,269,276,371`, `spec/data-flow/4-file-storage.md:58,71,78` | 코드 유지. planner 턴에서 실제 키 패턴·`s3.publicBaseUrl` 설정 필드로 갱신 — `plan/in-progress/spec-update-avatar-upload-implemented.md` 에 두 문서 모두 등재됨 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] 신규 에러 코드 `FILE_REQUIRED`·아바타 컨텍스트의 `INVALID_FILE_TYPE` 이 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md` §1)에 미등재. 코드 자체는 표준 `{code,message}` 봉투를 지키고 있어 런타임 결함은 아님 | `spec/5-system/3-error-handling.md` §1 ↔ `users.service.ts:88,108` | 코드 유지. planner 턴에서 카탈로그 등재 — 같은 plan 문서에 등재됨 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | throttle 부재·매직넘버 미검증(둘 다 INFO, 즉시 조치 불요). 키 UUID·Content-Type 강제·프로토타입 오염 방어·버킷 정책·IDOR 부재 등 핵심 위협모델은 견고 |
| architecture | LOW | 레이어 분리·SoT 순수 함수 유지 확인. SRP 겸임·URL build/parse 비대칭·provider 중복은 전부 기존에 유예 등재된 부채 |
| requirement | LOW | 핵심 비즈니스 규칙 3축 전부 구현+테스트 확인, 이전 라운드 CRITICAL(lost-update) 해소 재확인. SPEC-DRIFT 3건은 코드 아닌 spec 이 낡음 |
| scope | LOW | `ExpressNS` 주석 중복(WARNING) 외 diff 전체가 단일 기능에 정확히 좁혀짐 |
| side_effect | LOW | `update()` 공유 메서드 side effect 등 전부 문서화·테스트로 방어됨. 신규 전역변수·조용한 파괴적 변경 없음 |
| maintainability | LOW | `ExpressNS` 주석 중복(WARNING, scope/documentation 과 동일 이슈) 외 함수 길이·조건식 밀도 경미한 개선 여지만 |
| testing | MEDIUM | `main.ts` 부팅 경고 배선 미검증(WARNING, 뮤테이션 실측으로 확인) — 나머지는 뮤테이션 기반 회귀 테스트가 상위권 수준 |
| documentation | LOW | `ExpressNS` 주석 중복(WARNING, 동일 이슈 재확인) 외 CHANGELOG·README·k8s·plan 문서 정합성 우수 |
| dependency | NONE | 신규 npm 패키지 없음, 기존 스택 재사용만 |
| database | NONE | 신규 마이그레이션/스키마 변경 없음, PK 기반 파라미터화 쿼리, lost-update 이미 해소 확인 |
| concurrency | LOW | avatarUrl TOCTOU(고아 객체)는 데이터 정합성 훼손 없이 이미 유예 등재. 락 순서 데드락·await 누락 없음 |
| api_contract | LOW | 응답 봉투·에러 코드·HTTP 상태 전부 형제 엔드포인트와 일관. 남은 항목은 이미 추적 중인 문서 지연뿐 |
| user_guide_sync | LOW | README/swagger 동반 갱신 충족. 프런트엔드 UI 후속 추적 plan 부재(INFO) |

## 발견 없는 에이전트

_없음 — 전 13개 reviewer 가 최소 1건 이상(WARNING 또는 INFO 또는 SPEC-DRIFT)을 보고함._

## 권장 조치사항

1. `main.ts` 부팅 시 `S3_PUBLIC_BASE_URL` 사설/loopback 경고 배선을 순수 함수로 추출해 유닛 테스트로 고정(또는 최소 소스-캐너리)한다 — CHANGELOG 가 스스로 적은 근접사고 재발을 막는 유일한 안전망이 현재 미검증 상태다.
2. `codebase/backend/src/modules/users/users.controller.ts:53-61` 의 `ExpressNS` 리네임 근거 주석 중복을 하나로 병합한다.
3. (선택) planner 턴에서 `plan/in-progress/spec-update-avatar-upload-implemented.md` 체크리스트대로 spec 4개 문서(`9-user-profile.md`·`0-overview.md`·`data-flow/4-file-storage.md`·`5-system/3-error-handling.md`)를 갱신한다 — 특히 스토리지 키 레이아웃 drift 는 향후 버킷 정책을 spec 기준으로 재설계할 경우 실제 접근 실패를 유발할 수 있는 운영 위험이다.
4. (선택, 저우선순위) 2MB 업로드 상한 413 e2e 테스트, `PATCH /users/me` 아바타 정리 경로 e2e, 매직 넘버 검증, 프런트엔드 업로드 UI 후속 plan 항목 신설을 백로그로 등재한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync` (13명)
  - **제외**: 표 (reviewer · 이유, 1명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단으로 이번 diff 범위(S3 업로드/공개 URL 기능)에서 성능 관련 스코프 낮음으로 제외 — forced whitelist 대상 아님 |