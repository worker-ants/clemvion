# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. `change-password` 실패 코드를 형제 흐름(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)과 정렬하는 이번 changeset(직전 라운드 WARNING 4건 조치 커밋 `139115d34` 포함) 은 보안·API 계약·부작용·테스트 설계 전반에서 실질 결함이 없다. 유일한 WARNING 은 이 changeset 자신이 완료한 작업을 plan 체크리스트가 미체크로 남긴 문서 위생 이슈로, 기능적 위험은 없다. forced reviewer 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation (중복 발견, 통합) | plan 체크리스트 마지막 항목이 이번 changeset 자신이 완료한 developer 턴(backend 두 분기 정렬, `PASSWORD_VERIFY_CODES` 공용 상수화, 단위/e2e 테스트, 유저 가이드 ko/en 정정)을 여전히 `- [ ]` 미체크로 남김. 바로 위 5개 항목은 이번 라운드에서 `[x]` 로 갱신됐는데 이 항목만 누락 — 다음 사람이 "developer 턴이 아직 안 끝났다"고 오판하거나 `plan/complete/` 이동 시점을 놓칠 위험 | `plan/in-progress/auth-change-password-oauth-only-code-split.md:147` | `[x]` 로 전환. 남은 유일한 미완료 항목("후속(별개 PR) — `User.passwordHash` 타입")만 `[ ]` 로 남긴 뒤 `plan/complete/` 이동 여부 판단 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation / api_contract (중복 발견, 통합) | Swagger(`@ApiUnauthorizedResponse`) 설명이 여전히 단일 문구("현재 비밀번호 불일치 또는 인증 실패")라 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 코드 분리가 OpenAPI 소비자(자동 client 생성기 등)에게 드러나지 않음. 컨트롤러가 예외를 그대로 전파해 기능 문제는 없음. 직전 라운드에서 이미 지적·의도적으로 defer 된 판단 | `codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 핸들러 | 여유 있을 때 description 세분화 고려 (비차단) |
| 2 | documentation | `changePassword` 의 `@throws` JSDoc 이 `PASSWORD_INVALID` 공유처로 `AuthService` 하나만 열거 — 실제로는 `SessionsService.verifyReauth` 도 `.INVALID` 를 발행함(`.REQUIRED` 는 미발행). `password.util.ts` 의 `PASSWORD_VERIFY_CODES` JSDoc 은 세 소비처를 정확히 열거하는 것과 대비됨. 기능 영향 없음 | `codebase/backend/src/modules/users/users.service.ts:270` | `SessionsService.verifyReauth`(INVALID only) 언급 추가, 또는 `PASSWORD_VERIFY_CODES` JSDoc 참조로 단순화 |
| 3 | testing | 신규 테스트 2건이 "reject 하지 않으면 실패시키는" 가드 `throw` 를 `catch` 앞 **`try` 블록 내부**에 둠 — 서비스가 실제로 reject 하지 않는 회귀가 나면 가드 `throw` 자체가 `catch` 에 잡혀 의도한 assertion 메시지 대신 무관한 `TypeError: err.getResponse is not a function` 로 실패함. 뮤테이션으로 직접 재현: 여전히 RED 이나(vacuous-pass 아님) 진단 메시지가 혼동을 줌. 같은 파일의 `codeOf()` 헬퍼는 가드 `throw` 를 `try`/`catch` 밖에 둬 올바른 패턴 | `codebase/backend/src/modules/auth/sessions.service.spec.ts:194-209`, `codebase/backend/src/modules/users/users.service.spec.ts:205-222` | 가드 `throw` 를 `catch` 블록 밖으로 이동(`codeOf()` 패턴 재사용) 또는 `expect.assertions(n)` 으로 catch 실행 여부 명시적 고정 |
| 4 | maintainability | 동일 목적("예외 코드값 drift 검증")의 try/catch-getResponse 추출 패턴이 형제 테스트 파일 사이에서 불일치 — `users.service.spec.ts` 는 `codeOf()` 헬퍼로 추출해 4곳에서 재사용하지만 `sessions.service.spec.ts` 는 같은 로직을 인라인으로 1회 작성 | `codebase/backend/src/modules/auth/sessions.service.spec.ts:203` vs `codebase/backend/src/modules/users/users.service.spec.ts:149-157` | 현재는 1회성이라 조치 불요. 같은 패턴이 하나 더 늘면 로컬 헬퍼 추출 또는 공유 test-utils 승격 검토 |
| 5 | side_effect | 신규 e2e 테스트가 실제 HTTP 호출 전에 대상 사용자 행을 `UPDATE "user" SET password_hash = NULL` 로 직접 변형해 OAuth-only 상태를 흉내냄 — `WHERE id = $1` 로 테스트 전용 신규 계정에만 국한되어 다른 e2e 를 오염시키지 않음을 확인, 결함 아님 | `codebase/backend/test/users-change-password.e2e-spec.ts` | 조치 불요 |
| 6 | side_effect | `PASSWORD_VERIFY_CODES` 가 `Object.freeze()` 미적용(런타임 재할당 이론상 가능) — 같은 파일의 기존 `BCRYPT_ROUNDS` 도 동일 패턴이라 이 changeset 이 새로 도입한 위험 아님 | `codebase/backend/src/common/utils/password.util.ts:25-30` | 조치 불요(기존 컨벤션과 일치) |
| 7 | scope | 브랜치 전체 diff(`origin/main...HEAD`) 기준 `feat` 커밋에 change-password 와 무관한 WS 배지 트래커 plan 이동 1건이 여전히 같은 커밋에 남아 있음(코드 0줄) — 직전 라운드 WARNING(W4)으로 이미 지적됐고, 커밋 메시지에 전용 disclosure 절 추가로 합의된 최소 조치가 실제 이행됨을 재확인 | `plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md` → `plan/complete/...` (커밋 `1950e5773`) | 이미 disclosure 로 완결 처리. 추가 조치 불요 |
| 8 | security | `changePassword` 엔드포인트에 `@Throttle` rate limiting 미적용 — 이번 diff 이전부터의 기존 상태로 회귀 아님. 인접 엔드포인트엔 존재 | `codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 핸들러 | 스코프 밖. 별도 항목으로 `@Throttle` 추가 검토 권장(non-blocking) |
| 9 | api_contract | `POST /users/me/change-password` 에러 코드 wire 계약 변경은 의도된 breaking change 이나 governance(§5 등급 B 등재, CHANGELOG, 3-spec 동기화, e2e 커버리지) 전부 갖춰짐. 1st-party(`frontend`) 영향 0건 실측 확인 | `codebase/backend/src/modules/users/users.service.ts:286-303` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 인젝션/시크릿/인가우회/암호화 결함 없음. OAuth-only 신호는 self-scope 한정 확인, 열거 벡터 아님. rate limiting 부재는 기존 상태(INFO) |
| requirement | LOW | 기능·spec fidelity 전부 정확히 일치, 뮤테이션(RED2/GREEN) 검증 완료. plan 체크리스트 미체크(WARNING) 1건 |
| scope | LOW | fix 커밋은 직전 WARNING 4건에 정확히 대응. 캐리오버 WS 트래커 plan 이동은 이미 disclosure 완료 |
| side_effect | LOW | 함수 시그니처·전역상태·이벤트 불변. e2e UPDATE 는 격리됨. freeze 미적용은 기존 패턴 |
| maintainability | NONE | 가독성·복잡도·네이밍 전반 양호. 테스트 헬퍼 추출 비일관 1건(INFO) |
| testing | LOW | 직전 W1/W2 조치를 독립 뮤테이션으로 재검증(참). 가드 `throw` try-내부 배치로 인한 진단 메시지 혼동(INFO) |
| documentation | LOW | CHANGELOG/JSDoc/유저가이드 대부분 정확. plan 체크리스트 미체크(WARNING), JSDoc 소비처 과소열거·Swagger 미세분화(INFO) |
| api_contract | LOW | breaking change governance 완전. Swagger 미세분화(INFO, 기존 defer 판단 유지) |
| user_guide_sync | NONE | 매칭 trigger(`auth-session-flow-change`) 타깃(mdx ko/en + e2e) 전부 동반 갱신 확인. 발견 0건 |

## 발견 없는 에이전트

- user_guide_sync (CRITICAL 0 · WARNING 0 · INFO 0)

## 권장 조치사항

1. `plan/in-progress/auth-change-password-oauth-only-code-split.md:147` 의 developer 턴 체크박스를 `[x]` 로 전환(WARNING, 2개 reviewer 중복 발견).
2. (선택, non-blocking) `sessions.service.spec.ts`/`users.service.spec.ts` 신규 테스트 2건의 가드 `throw` 를 `try` 블록 밖으로 이동해 실패 시 진단 메시지를 명확히 함.
3. (선택, non-blocking) `users.service.ts:270` `@throws` JSDoc 에 `SessionsService.verifyReauth` 소비처 추가.
4. (선택, non-blocking) Swagger `@ApiUnauthorizedResponse` description 을 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 코드로 세분화.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 changeset(에러 코드 분기 정렬)과 무관 |
  | architecture | 라우터 판단상 이번 changeset과 무관 |
  | dependency | 이번 diff 는 package.json/lockfile 미변경 |
  | database | 이번 diff 는 스키마/쿼리 구조 변경 없음(신규 e2e 의 단발 UPDATE 는 기존 테스트 관례) |
  | concurrency | 이번 diff 는 동시성/레이스 표면 변경 없음 |