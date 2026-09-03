# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 코드 정합성·spec·문서 자체는 전 reviewer 가 정합성을 실측으로 확인했으나(9명 중 6명 NONE/LOW), `testing` reviewer 가 이 PR 이 스스로 명시한 drift 재발 방지 원칙(코드값을 리터럴로 직접 pin)이 세 번째 소비처(`sessions.service.spec.ts`)에는 아직 적용되지 않았고, 이번 변경의 핵심 wire 계약 변경(OAuth-only → `PASSWORD_REQUIRED`)에 대한 e2e(HTTP) 커버리지가 비어 있다고 지적(MEDIUM) — 두 WARNING 모두 코드 수정이 아니라 테스트 추가로 해소 가능한 국지적 갭이다. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `sessions.service.ts` 의 `verifyReauth` 가 리터럴 대신 공유 상수 `PASSWORD_VERIFY_CODES.INVALID` 를 쓰도록 바뀌었는데, 이를 검증하는 유일한 테스트(`rejects with 401 on wrong password`)는 `UnauthorizedException` 클래스만 단언하고 응답 `code` 필드는 검증하지 않는다. 이 PR 이 `users.service.spec.ts` 에 새로 추가한 주석이 정확히 이 패턴("클래스만 단언하면 코드값 drift 를 놓친다")을 지목하는데, `sessions.service.spec.ts` 만 그 원칙이 아직 미적용 — 3개 소비처(`auth.service`/`users.service`/`sessions.service`) 중 이 파일만 코드값 회귀에 무방비. | `codebase/backend/src/modules/auth/sessions.service.ts:270`(발행) / `codebase/backend/src/modules/auth/sessions.service.spec.ts:170`(미검증 테스트) | `err.getResponse()` 로 `{ code: 'PASSWORD_INVALID' }` 를 **리터럴로** 단언하는 줄 추가(상수 재참조 금지, 이 PR 자신의 원칙) |
| 2 | testing, user_guide_sync | 이번 PR 의 핵심 wire 계약 변경(OAuth-only 계정 → `PASSWORD_REQUIRED`, 구 `INVALID_PASSWORD`)이 unit 레벨(`users.service.spec.ts`)에서는 잘 커버되지만 HTTP e2e 레벨 커버리지가 없다. 자매 분기("wrong password → `PASSWORD_INVALID`")는 e2e 로 있는데 이 분기만 없어 커버리지 계층이 비대칭이다. `plan/in-progress/auth-change-password-oauth-only-code-split.md` 체크리스트도 이 항목을 아직 `- [ ]` 미체크로 self-tracked 중. | `codebase/backend/test/users-change-password.e2e-spec.ts` (신규 `it()` 없음, 주석 1곳만 언급) | OAuth-only 사용자(`passwordHash IS NULL`, `test/auth-oauth-callback.e2e-spec.ts` 헬퍼 패턴 재사용 가능)로 호출 → `401` + `error.code === 'PASSWORD_REQUIRED'` 단언하는 e2e 케이스 추가 |
| 3 | documentation | `POST /users/me/change-password` 의 wire 에러 코드가 바뀌는(§5 등급 B, "저장소 밖 호출자 배제 불가"로 스스로 명시한) breaking-가능 변경인데도 저장소가 실제로 유지하는 `CHANGELOG.md` 에 항목이 없다. 직전 커밋(`d73eff860`, WS 관련)은 같은 세션에서 항목을 추가한 선례가 있어 비대칭적이다. | 저장소 루트 `CHANGELOG.md` (이 diff 에 미포함) | `## Unreleased` 에 바뀐 코드 쌍(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`)과 영향받는 엔드포인트(`POST /users/me/change-password`) 명시 |
| 4 | scope | 이미 별개 PR(`#1267`)에서 spec 본문까지 전량 반영이 끝난 WebSocket `auth.token_expired` 배지 플립 트래커의 plan 파일 정리(rename `in-progress`→`complete`)가, 완전히 무관한 이번 `change-password` 코드 정렬 커밋에 편입됐다. 커밋 메시지 전문 어디에도 이를 설명하는 문장이 없다. 기능 위험은 없으나(코드 0줄) `git blame`/`git log -S` 이력을 오염시키고 리뷰어에게 "이 커밋이 WS 도 건드렸나" 오판 여지를 만든다. | `plan/complete/spec-draft-ws-badge-flip-tracker-close.md` (rename, 신설) / `plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md` (삭제) | 별도의 작은 정리 커밋으로 분리하거나, 최소한 커밋 메시지에 "겸사겸사 무관한 WS 트래커 정리 포함" 을 한 줄로 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `PASSWORD_VERIFY_CODES` JSDoc 이 "`AuthService.verifyPasswordForUser`/`UsersService.changePassword` 가 같은 값을 발행" 이라고만 적어, 실제 세 번째 소비처인 `SessionsService.verifyReauth`(`.INVALID` only)가 주석 열거에서 빠져 있다. spec(`1-auth.md §2.3`)은 3곳을 정확히 나열해 정합적이나 코드 쪽 JSDoc 만 소폭 좁다. | `codebase/backend/src/common/utils/password.util.ts:13-14` | 주석에 `SessionsService.verifyReauth`(`.INVALID` only)를 세 번째 소비자로 추가 |
| 2 | requirement | 리뷰 중 워킹트리에서 이 리뷰 대상 커밋(`93146d2f2`)에는 없는 **비커밋 변경**이 관측됨(`## 검증 — 뮤테이션` 절, 뮤턴트 M1~M4 표) — 동일 세션의 다른 병렬 리뷰어가 만든 것으로 추정. 내용 자체는 무해하고 이 커밋의 diff 판단에는 영향 없음. | `plan/in-progress/auth-change-password-oauth-only-code-split.md` (working tree, uncommitted) | 최종 커밋 전 이 변경을 의도적으로 반영할지 확인 필요 — 다른 세션/에이전트 산출물과 충돌 여부 점검 |
| 3 | maintainability | 테스트 제목("OAuth-only 계정은 PASSWORD_REQUIRED 를 낸다")이 실제로는 예외 클래스와 `repo.update` 미호출만 단언하고 코드값은 검증하지 않는다 — 코드값 검증은 인접한 별도 테스트가 수행. 제목만 보면 커버리지를 오인하기 쉽다(유사 쌍 2곳 더 존재). | `codebase/backend/src/modules/users/users.service.spec.ts:159`(및 `:176`/`:184`) | 제목을 실제 단언 범위(클래스만)에 맞추거나, `codeOf` 로 코드값 단언을 합쳐 제목·본문 일치 |
| 4 | testing | `PASSWORD_VERIFY_CODES` 상수 정의 자체(SoT)를 리터럴로 pin 하는 단위 테스트가 `password.util.spec.ts` 에 없다 — 현재는 소비처 2곳(`auth.service.spec.ts`/`users.service.spec.ts`)이 간접적으로 pin. WARNING #1 이 해소되면 3/3 소비처가 코드값을 핀 하게 되어 이 갭의 실효성은 더 낮아진다. | `codebase/backend/src/common/utils/password.util.spec.ts` | 선택적 — `PASSWORD_VERIFY_CODES.REQUIRED === 'PASSWORD_REQUIRED'` 등 정의 자체를 pin 하는 짧은 테스트 추가 검토 |
| 5 | api_contract | Swagger(`@ApiUnauthorizedResponse`) 설명이 여전히 "현재 비밀번호 불일치 또는 인증 실패" 단일 문구라, `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 코드로 분리됐다는 사실이 OpenAPI 스펙 소비자(자동 client 생성기 등)에게 드러나지 않는다. | `codebase/backend/src/modules/users/users.controller.ts` (`changePassword` 핸들러 데코레이터) | 여유가 있을 때 description 을 두 코드로 세분화(필수 아님) |
| 6 | side_effect | `scripts/backend-typecheck-baseline.json` 의 `total: 199→198` 변경이 실제로 `--update` 재생성 스크립트를 통해 만들어졌는지, 수기 편집인지 diff 만으로는 구분 불가(방향은 오류 감소로 타당, 대응하는 `oauthOnlyUser()` 캐스트 통합과 정합). | `scripts/backend-typecheck-baseline.json:2` | 병합 전 `check-backend-typecheck-ratchet.py` 비-update 모드로 1회 재확인 권장(non-blocking) |
| 7 | security | 실패 사유 문구 차등화("비밀번호 미설정" vs "불일치")로 계정 상태 신호가 명시화되지만, 모든 발행 지점이 `@CurrentUser()`(JWT 본인)로만 스코프돼 있어 계정 열거(enumeration) 벡터로 이어지지 않음을 호출부 전수 추적으로 확인. | `codebase/backend/src/modules/users/users.service.ts:286-303` 등 | 조치 불필요 — 향후 미인증/타인-대상 엔드포인트로 재사용 시 재검토 |
| 8 | maintainability | 동일 arrange 블록(`repo.findOne.mockResolvedValue`)이 `changePassword` describe 블록 내 4~5개 테스트에 반복 — 의도적 세분화(과거 "클래스만 봐서 drift 를 놓쳤다" 교훈 반영)로 근거가 명확해 심각도 낮음. | `codebase/backend/src/modules/users/users.service.spec.ts` (`:160,168,194,201` 등) | 조치 불요, 분기가 더 늘면 `it.each` 통합 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인가우회·시크릿 노출 없음. self-scope 라 계정 열거 불가. 신규 회귀 테스트가 drift 재발 방지 설계로 확인됨 |
| requirement | NONE | 기능·spec fidelity(4개 spec 문서) 전수 일치, typecheck baseline·unit 테스트 재실행 실측 확인. JSDoc 소비자 열거 소폭 누락(INFO) |
| scope | LOW | 커밋 목적과 diff 거의 정확히 부합. 무관한 WS 배지 플립 트래커 plan 정리가 편입(WARNING) |
| side_effect | LOW | 핵심 부작용은 의도된 API breaking change 1건뿐, governance 통과 확인. baseline 재생성 방식만 미확인(INFO) |
| maintainability | NONE | 상수 설계·주석·복잡도 양호. 테스트 제목이 단언 범위보다 넓게 약속(INFO) |
| testing | MEDIUM | `sessions.service.spec.ts` 코드값 미검증 + OAuth-only 분기 e2e 부재 — 이 PR 이 스스로 문서화한 drift 패턴이 세 번째 소비처에 미적용 |
| documentation | LOW | JSDoc·spec 교차참조 정확. CHANGELOG.md 미기재(WARNING) |
| api_contract | LOW | breaking change 는 governance(§5 등급 B) 완전 통과, 1st-party 영향 0 실측. Swagger 세분화 여지(INFO) |
| user_guide_sync | LOW | doc-sync-matrix 매칭 1건(`auth-session-flow-change`), mdx ko/en 동반 갱신 확인. e2e 타깃 절반 미이행(WARNING, testing 과 동일 이슈) |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 INFO 이상 발견사항을 보고함(단, security/requirement/maintainability 는 위험도 NONE).

## 권장 조치사항

1. `sessions.service.spec.ts` 의 `PASSWORD_INVALID` 분기 테스트에 `err.getResponse().code` 리터럴 단언 추가 (WARNING #1).
2. `users-change-password.e2e-spec.ts` 에 OAuth-only(`PASSWORD_REQUIRED`) HTTP e2e 케이스 추가 (WARNING #2).
3. `CHANGELOG.md` 에 이번 wire 에러코드 breaking change 항목 추가 (WARNING #3).
4. WS 배지 플립 트래커 plan 파일 rename 을 별도 커밋으로 분리하거나 커밋 메시지에 명시 (WARNING #4).
5. (선택) `password.util.ts` JSDoc 에 `SessionsService.verifyReauth` 소비처 추가, Swagger description 세분화, `password.util.spec.ts` 에 상수 자체 pin 테스트 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경과 무관(순수 에러 코드 분기, 성능 영향 표면 없음) |
  | architecture | router 판단상 이번 변경과 무관(아키텍처 구조 변경 없음, 상수 도입 수준) |
  | dependency | router 판단상 이번 변경과 무관(의존성 추가/변경 없음) |
  | database | router 판단상 이번 변경과 무관(스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 변경과 무관(동시성 로직 변경 없음) |