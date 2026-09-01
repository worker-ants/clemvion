# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `incrementLoginAttempts` 의 전체-엔티티 `save()` 가 이 PR 이 "제거했다"고 주장하는 lost-update 를 **반대 방향**으로 재현한다: 아바타 업로드가 커밋·구 S3 객체 삭제까지 마친 직후 동시 로그인 실패가 옛 스냅샷을 그대로 `save()` 하면, DB 의 `avatarUrl` 이 **이미 삭제된 객체를 가리키는 상태**로 되돌아갈 수 있다. `forced(router_safety)` 8개 reviewer 전원 결과는 정상 확보됐고 누락은 없다 — 위험도는 순수 신규 발견(concurrency CRITICAL 1건)에 기인한다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency | `incrementLoginAttempts` 가 `findOneOrFail` 로 읽은 전체 엔티티를 `userRepository.save(user)` 로 되쓴다. `updateAvatar` 가 `update(userId, {avatarUrl})` 커밋 + 구 S3 객체 삭제(`deletePreviousAvatarObject`)를 마친 직후 이 `save()` 가 커밋되면, `avatarUrl` 이 **이미 지워진 S3 객체를 가리키는 옛 값**으로 되돌아간다 — 이 PR 자신이 "고아 객체보다 나쁘다"고 명시한 상태가 반대 방향 경쟁으로 재현됨. `User` 엔티티에 `@VersionColumn`/낙관적 잠금 없음. | `codebase/backend/src/modules/users/users.service.ts:317-325`(`incrementLoginAttempts`, 특히 323행 `save(user)`) ↔ `:79-149`(`updateAvatar`) | `incrementLoginAttempts` 도 컬럼 단위 갱신으로 전환 — `increment()` 또는 raw `UPDATE ... SET login_attempts = login_attempts + 1` 등 원자 연산 사용. `plan/in-progress/spec-sync-user-profile-gaps.md` 의 "동시 업로드 TOCTOU — 데이터 정합성은 깨지지 않는다" 유예 근거도 이 반례를 반영해 갱신 필요 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/9-user-profile.md` 가 `POST /api/users/me/avatar` 를 여전히 "미구현 (Planned)" 으로 서술 — 구현은 완료돼 유닛+e2e 회귀로 뒷받침됨 | `spec/2-navigation/9-user-profile.md:334`(엔드포인트 표, 취소선), `:136`(아바타 토글 행) | 코드 유지. `plan/in-progress/spec-update-avatar-upload-implemented.md` 에 정확한 대상 줄 번호와 함께 planner 트랙 등재됨 — planner 턴에서 배지 flip + §6.1 계약 채움 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] 스토리지 키 레이아웃이 spec 과 실제 구현에서 어긋남 — `workspaceId` 접두 유무·파일명 형태 둘 다 다름. 실제 정책(`avatars-public-read.json`)은 구현 키를 정확히 따르는데 spec 대로 `{workspaceId}/avatars/` 로 정책을 재설계하면 업로드는 성공하고 이미지가 403 되는 **운영 위험**으로 이어질 수 있음 | `spec/0-overview.md`(스토리지 트리 "계획, 코드 미구현" 표기), `spec/data-flow/4-file-storage.md` §2.1~2.3(키 패턴·`avatar_url` 서술·`s3.publicBaseUrl` 미등재) ↔ 실제: `users.service.ts` `avatarKeyPrefix`(`avatars/{userId}/{uuid}.{ext}`) | 코드 유지. 같은 plan 문서 "같은 사실을 말하는 다른 SoT 문서" 섹션에 두 문서 모두 등재 — planner 턴에서 실제 키 패턴·설정 필드로 갱신 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE`(아바타 컨텍스트)가 중앙 에러 카탈로그에 미등재 | `spec/5-system/3-error-handling.md` §1 (grep 0건) ↔ `users.service.ts` `updateAvatar` throw 지점 | 코드 유지(응답 봉투는 표준 준수). 같은 plan 문서에 등재됨 — planner 턴에서 카탈로그 등재 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | 이 PR 이 신설한 "avatarUrl 변경 → S3 정리" 불변식이 `UsersService.update()` 단일 진입점에만 있고, `AuthOAuthService.resolveUser()` 의 raw `QueryBuilder` 직접 쓰기가 이를 완전히 우회한다. 오늘은 `byEmail.avatarUrl ?? profile.avatarUrl` 우선순위 덕에 무해하지만, 우선순위가 바뀌거나 경로가 확장되면 방금 업로드된 S3 객체가 정리 없이 영구 고아가 될 수 있음(이미 소스 캐너리 테스트로 disclose 됨) | `codebase/backend/src/modules/auth/auth-oauth.service.ts:390-401`(`resolveUser`) ↔ `codebase/backend/src/modules/users/users.service.ts:234`(정상 경로 `update()`) | `avatarUrl` 쓰기 경로를 단일화(예: `UsersService.setAvatarUrl(id, url)`)하거나, 최소한 이 우회 존재를 `spec-sync-user-profile-gaps.md` 트래커에도 명시 |
| 2 | Testing | 업로드 파일 크기 상한(2MB, `FileInterceptor` `limits.fileSize`)이 어떤 테스트에서도 실제로 초과 전송돼 413 을 검증받지 않는다 — Swagger-sync 테스트는 "2MB" **문서 텍스트**만 대조하고, enforcement(멀터 `limits`) 자체를 거는 메타데이터 테스트도, e2e 의 413 케이스도 없음. `AVATAR_MAX_BYTES` 참조가 깨져도 어떤 테스트도 RED 로 알리지 않음(단, `knowledge-base` 모듈도 동일 패턴이라 이 PR 신규 결함은 아님) | `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar` 의 `FileInterceptor('file', {limits:{fileSize: UsersService.AVATAR_MAX_BYTES}})` | `users.controller.spec.ts` 에 `Reflect.getMetadata` 로 `limits.fileSize` 메타데이터 고정 또는 `users-avatar-upload.e2e-spec.ts` 에 2MB+1바이트 파일 전송 → 413 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency | (검증 결과, 결함 아님) `updateAvatar`↔`updateAvatar`/`update()` 의 avatarUrl 자체 경쟁(패자의 S3 객체가 고아로 남을 수 있음)은 이미 정확히 진단·측정 가능한 재개 신호와 함께 유예됨 — 단, 위 CRITICAL 항목이 그 유예 노트의 "정합성은 깨지지 않는다" 문장의 반례이므로 문서 갱신 필요 | `users.service.ts:79-149,169-196,234-248` / `plan/in-progress/spec-sync-user-profile-gaps.md:83-98` | 위 CRITICAL 수정과 함께 유예 노트 갱신 |
| 2 | Security | `POST /api/users/me/avatar` 에 전용 throttle 없음(전역 100req/60s 만 적용) — 파일 버퍼링 + S3 PutObject/DeleteObject 로 비용이 다른 GET/PATCH 보다 큼 | `users.controller.ts` `uploadAvatar` | 방어 심화 차원의 하한 throttle 고려 가능(즉시 조치 불요, 직전 라운드도 동일 결론) |
| 3 | Security | 업로드 파일의 실제 바이트(매직 넘버) 미검증, 확장자만으로 화이트리스트 판정 — Content-Type 은 서버가 확장자 기반으로 강제해 저장형 XSS 핵심 위협은 이미 차단됨 | `users.service.ts` `updateAvatar` ext/contentType 판정 블록 | 향후 이미지 처리 파이프라인 도입 전 매직 넘버 검증 고려(이미 plan 유예 등재) |
| 4 | Scope | `ExpressNS` 리네임이 무관한 두 기존 메서드(`changePassword`,`verifyEmailChange`)의 파라미터 타입 표기까지 함께 바꿈 — Multer 타입 컴파일 차단 해소를 위한 기계적 불가피 변경, 런타임 영향 없음 | `users.controller.ts` | 조치 불요 |
| 5 | Scope | `UsersService.update()`(범용 PATCH)에 아바타 정리 로직 추가로 부수효과 확장, `toProfileData()` 헬퍼 추출로 기존 `getMe`/`updateMe` 응답 조립도 리팩터 | `users.service.ts` `update()`, `users.controller.ts` | 둘 다 근거·범위 제한 문서화됨, 조치 불요 |
| 6 | Maintainability | `updateAvatar` 가 검증~S3 업로드~정리 위임을 한 메서드에서 순차 orchestration(25~30줄) — 3라운드부터 반복 지적·의도적 유예 | `users.service.ts:79-149` | 파일 업로드 기능이 하나 더 생기는 시점을 재개 신호로 유지 |
| 7 | Maintainability | `users-avatar.service.spec.ts` 의 `S3Service` mock + `TestingModule.compile()` 부트스트랩이 6곳 반복, 헬퍼 네이밍도 `setup`/`build` 로 갈림 | `users-avatar.service.spec.ts` | 다음 describe 확장 시 `createModule(...)` 팩토리 통합 고려 |
| 8 | Maintainability | 확장자→Content-Type 판정이 `&&`+삼항이 겹친 밀집 표현식 | `users.service.ts:98-105` | 우선순위 낮음, 헬퍼 추출 고려 가능 |
| 9 | Maintainability | `S3Service` 생성자의 `?? endpoint` 2차 방어가 `s3.config.ts` 3단 폴백과 개념적으로 중복 | `s3.service.ts:32-41` | 주석+테스트로 충분, 조치 불요 |
| 10 | Documentation | `S3Service.getPublicUrl` JSDoc 에 `@returns` 없음(3·5·6·7라운드 반복 지적, 매번 조치 유예) | `s3.service.ts:69-86` | 선택 사항, `@returns` 한 줄 추가 |
| 11 | Documentation | `AVATAR_MAX_BYTES` JSDoc 표현("같은 값이어야 한다")이 실제 구현(직접 참조)과 어긋남 | `users.service.ts:51` vs `users.controller.ts:154-162` | 선택 사항, 문구를 "직접 참조" 로 정정 |
| 12 | Dependency | 새 외부 npm 패키지 추가 없음 — 전부 기존 의존성(`@aws-sdk/client-s3`,`@nestjs/platform-express`,`node:crypto`) 재사용 | `package.json`(무변경) | 없음(양호) |
| 13 | API Contract | `PATCH /users/me` 의 임의 외부 URL 입력 경로와 `POST /avatar` 의 서버 생성 URL 경로가 같은 `avatarUrl` 필드를 공유 — 의도된 설계, CHANGELOG 에 disclose | `update-me.dto.ts` vs `users.controller.ts uploadAvatar` | 조치 불요 |
| 14 | User Guide Sync | `backend-api-change` 트리거 매칭되나 FE 소비 UI 자체가 아직 없어 user-guide 페이지(`password-and-sessions.mdx`) 갱신은 선제적으로 후속 PR 로 지연·추적됨(지금 쓰면 오히려 `<ImplAnchor>` 실존 컨벤션 위반) | `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` / `plan/in-progress/spec-sync-user-profile-gaps.md` | FE 아바타 업로드 UI PR 에서 필수 동반 갱신으로 요구 |
| 15 | Testing | Swagger 동기화 가드의 "MB 리터럴 전수 카운트"가 코드 주석 문구에도 우연히 결합돼, 향후 주석만 다듬어도(값 불변) false positive 로 깨질 수 있음 | `users-avatar-swagger-sync.spec.ts` | docstring 에 "코드 주석까지 카운트" 한 줄 추가 권장 |
| 16 | Side Effect | `docker-compose*.yml` 의 `mc anonymous set-json` 은 정책을 통째로 교체 — 향후 두 번째 공개 정책 추가 시 이번 avatars 정책을 실수로 덮어쓸 위험 | `docker-compose.yml:75`, `docker-compose.e2e.yml:96` | 향후 정책 추가 시 Statement 배열 병합 권장 코멘트 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | INFO 2건(전용 throttle 부재, 매직넘버 미검증) — 나머지 전 항목(IDOR·XSS·경로조작·버킷정책·SSRF·동시성·시크릿) 문제 없음 확인 |
| requirement | LOW | SPEC-DRIFT 3건(전부 plan 문서에 이미 추적) — 코드 측 핵심 비즈니스 규칙 3축 전부 구현·테스트로 뒷받침, lost-update(정방향) 해소 재확인 |
| scope | LOW | 신규 delta(6R)는 WARNING 2건 대응으로 한정, scope creep 없음. 정당화된 collateral 3건 INFO |
| side_effect | MEDIUM | WARNING 1건(OAuth 경로가 avatarUrl 정리 불변식 우회) + INFO 3건 |
| maintainability | LOW | INFO 5건, 전부 3라운드부터 반복·의도적 유예, 신규 구조적 결함 없음 |
| testing | LOW | WARNING 1건(2MB 상한 413 미검증) + INFO 1건, 96/96 유닛 GREEN 직접 실행 확인 |
| documentation | LOW | INFO 2건(3~4라운드 반복 지적, 저위험), 나머지 문서 5계층 정확도 높음 |
| dependency | NONE | 신규 npm 의존성 0건, 전부 기존 의존성 재사용 |
| concurrency | **CRITICAL** | CRITICAL 1건(`incrementLoginAttempts` save() 가 avatarUrl 을 삭제된 객체로 되돌림) — 이번 라운드 신규 발견 |
| api_contract | LOW | INFO 3건(에러 카탈로그 미등재, spec 배지 미반영, avatarUrl 이중 쓰기 경로) 전부 추적됨/의도된 설계 |
| user_guide_sync | LOW | INFO 1건(FE UI 부재로 user-guide 갱신 선제 지연, 이미 추적됨) — 실제 누락 0건 |

## 발견 없는 에이전트

(해당 없음 — 11개 reviewer 전원이 최소 1건 이상의 발견사항 또는 명시적 확인 항목을 보고함)

## 권장 조치사항

1. **[CRITICAL, 최우선]** `incrementLoginAttempts` 를 컬럼 단위 원자 갱신(`increment()` 또는 raw `UPDATE ... SET login_attempts = login_attempts + 1`)으로 전환해 반대 방향 lost-update(avatarUrl 이 삭제된 S3 객체를 다시 가리키는 상태)를 차단한다. `spec-sync-user-profile-gaps.md` 의 "정합성은 깨지지 않는다" 유예 근거도 함께 갱신한다.
2. **[WARNING]** 업로드 크기 상한(2MB→413)에 대한 실제 enforcement 테스트(메타데이터 검사 또는 e2e 413 케이스)를 추가한다.
3. **[WARNING]** `AuthOAuthService.resolveUser()` 의 raw QueryBuilder 가 avatarUrl 정리 불변식을 우회하는 문제를 단일 쓰기 API 로 통합하거나, 최소한 트래커에 명시적으로 등재한다.
4. **[SPEC-DRIFT, planner 트랙]** `9-user-profile.md`·`0-overview.md`·`data-flow/4-file-storage.md`·`5-system/3-error-handling.md` 4개 spec 문서를 구현 상태(엔드포인트 구현 완료, 실제 키 레이아웃, 에러 카탈로그)에 맞게 갱신한다 — 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 에 정확한 대상 줄 번호와 함께 등재돼 있어 planner 턴에서 그대로 집행 가능하다.
5. 나머지 INFO 항목(전용 throttle, 매직넘버 검증, JSDoc 표현 정정, 테스트 보일러플레이트 통합 등)은 이미 다회 라운드에 걸쳐 검토·의도적 유예된 저위험 항목으로, 명시된 재개 신호(다음 확장 시점) 도달 전까지 즉시 조치 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, dependency, concurrency, api_contract, user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 changeset 과 낮은 관련도로 제외 |
  | architecture | router 판단상 이번 changeset 과 낮은 관련도로 제외 |
  | database | router 판단상 이번 changeset 과 낮은 관련도로 제외 |