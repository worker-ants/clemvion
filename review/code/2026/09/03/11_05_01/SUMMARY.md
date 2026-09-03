# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 1건(두 reviewer가 동일 지점을 독립 발견) — `spec/5-system/1-auth.md`의 자기반증형 소정정이 CLAUDE.md 조건 4(원문 취소선 보존)를 놓쳤다. 코드 실행에는 영향 없음(비차단). forced 화이트리스트 7명(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서(SoT 절차) | "자기반증형 소정정" 5조건 중 조건4(원문 취소선 보존)를 `spec/5-system/1-auth.md`에서 미충족 — 같은 커밋(`5232a5540`)이 같은 취지의 정정을 `plan/in-progress/auth-change-password-oauth-only-code-split.md`(`:108-110`)에서는 `~~...~~ — 이 근거는 틀렸다` 형태로 정확히 처리했으나, spec 파일(`:521`)에서는 "헬퍼는 다르지만(순환 의존으로 재사용 불가) 코드는 공유한다" 문장을 취소선 없이 통째로 새 문장으로 대체함(`grep '~~' spec/5-system/1-auth.md` 결과 0건). 내용 자체는 정확(측정 근거 3종 열거, 커밋 메시지에 실측 기록)하지만, spec 만 보고는 이 문장이 처음부터 옳게 쓰였는지 검증 없이 나중에 조용히 고쳐졌는지 구분할 수 없어 감사(audit) 트레일이 끊긴다. (scope·side_effect 2개 reviewer가 독립적으로 동일 지점 발견 — 중복 제거하여 1건으로 통합) | `spec/5-system/1-auth.md:521` | `~~헬퍼는 다르지만(순환 의존으로 재사용 불가) 코드는 공유한다.~~ — 이 근거는 틀렸다(`--impl-done` WARNING, 2026-09-03). ...` 형태로 원문을 취소선으로 보존하고 정정 사유를 이어 붙일 것. Blocking 아님 — 다음 `--impl-done`/`consistency-check` 라운드에서 정리 가능. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/유지보수 | 코드값 추출 헬퍼(`codeOf`/`rejectionOf`)가 `users.service.spec.ts`에만 함수로 분리되고 형제 파일 `sessions.service.spec.ts`는 동일 통찰(가드 단언을 catch 밖으로)을 인라인 `try/catch`로 재구현. 저장소에 이미 `__test-utils__` 공유 컨벤션이 있음에도 미사용 (requirement·maintainability·testing 3개 reviewer 공통 지적, 통합) | `sessions.service.spec.ts:192-214` vs `users.service.spec.ts:149-172` | 조치 불요(현재 1회성 중복). 3번째 코드값 테스트 소비처가 생기면 공유 `__test-utils__`로 추출 권장. |
| 2 | API 계약/문서 | Swagger(`@ApiUnauthorizedResponse`) 설명이 `'현재 비밀번호 불일치 또는 인증 실패'` 단일 문구로 남아 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 코드 분리가 OpenAPI 소비자에게 드러나지 않음. 1R·2R·3R 세 라운드 연속 동일 판단(`swagger.md` 규약 범위, 이 PR에서 미확장) 유지 (documentation·api_contract 공통 지적, 통합) | `users.controller.ts` `changePassword` 핸들러 데코레이터 | 조치 불요(스코프 밖 유예 유지). 여유 시 두 코드로 설명 세분화 권장. |
| 3 | 보안 | 실패 사유 문구 차등화(OAuth-only vs 불일치)로 "비밀번호 설정 여부" 신호가 생기나, 전 호출부(`changePassword`/`verifyPasswordForUser`/`verifyReauth`)가 JWT self-scope 전용이라 계정 열거(enumeration) 벡터로 이어지지 않음 | `users.service.ts:286-303`, `auth.service.ts:73-78`, `sessions.service.ts` | 조치 불요. 향후 미인증·타인-대상 엔드포인트로 재사용 시 재검토. |
| 4 | 보안 | OAuth-only 분기가 bcrypt 비교 이전에 조기 반환 — 잠재적 타이밍 차이(선재 동작, 이번 diff로 신설되지 않음, self-scope라 실질 위험 없음) | `users.service.ts:287-294`, `auth.service.ts`, `sessions.service.ts` | 조치 불요(스코프 밖). |
| 5 | 보안 | `INVALID_PASSWORD` wire 코드는 전량 은퇴됐으나 `login_history.failure_reason`(감사 레이어)의 동명 값은 의도적으로 잔존 — `error-codes.md §5`에 명시, 정보 노출 표면 축소 효과 | `auth.service.ts` `login_history.failure_reason` | 없음. |
| 6 | 유지보수 | `PASSWORD_VERIFY_CODES` 상수가 `Object.freeze()` 없이 `as const`만 적용 — 같은 파일 `BCRYPT_ROUNDS`도 동일 패턴이라 이 changeset이 새로 도입한 리스크 아님 | `password.util.ts:30` | 조치 불요. |
| 7 | 유지보수 | `codeOf`/`rejectionOf` 두 헬퍼가 서로 재사용하지 않고 각자 `try/catch/getResponse` 독립 구현 — 향후 한쪽만 수정 시 drift 가능 | `users.service.spec.ts:149-172` | `codeOf`를 `rejectionOf` 위에 얹는 리팩터 권장(사소, 필수 아님). |
| 8 | 유지보수 | 같은 `describe('changePassword ...')` 블록 안에서 신규 테스트(한국어 제목)와 기존 테스트(영어 제목 2건, diff 밖)가 언어 혼재 | `users.service.spec.ts:133`, `:174-228`, `:231` | 이 PR 스코프 아님. 다음에 블록을 건드릴 기회에 통일 권장. |
| 9 | 테스트 | e2e의 OAuth-only 상태가 실제 OAuth 가입 경로가 아니라 `UPDATE "user" SET password_hash = NULL` DB 직접 조작으로 합성 — 현재 로직(`passwordHash` 단일 조건 분기) 기준 관측 동등성은 타당 | `users-change-password.e2e-spec.ts:102-104` | 조치 불요(현재 기준 등가). OAuth 판별 로직이 복잡해지면 실제 가입 경로 e2e helper 도입 고려. |
| 10 | 문서/plan 위생 | `plan/in-progress/auth-change-password-oauth-only-code-split.md`·`plan/in-progress/spec-draft-change-password-code-alignment.md` 두 plan이 사실상 전 항목 완료(남은 것은 명시적으로 별개 PR로 분리된 후속 1건뿐)인데 `in-progress/`에 남아 있음 | `plan/in-progress/auth-change-password-oauth-only-code-split.md`, `plan/in-progress/spec-draft-change-password-code-alignment.md` | 이번 라운드 통과 후 마무리 커밋에서 `plan/complete/`로 이동 권장. Blocking 아님. |
| 11 | API 계약 | `POST /users/me/change-password`에 `@Throttle` 미적용 — 선재 상태, 이번 diff의 회귀 아님. self-scope라 실익 낮음 | `users.controller.ts:202-216` | 스코프 밖, 트래킹만 유지. |
| 12 | API 계약 | wire 에러 코드 breaking change(`INVALID_PASSWORD`→`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)는 등급 B governance(사용자 결정 기록·4개 spec 동기화·CHANGELOG·1st-party 영향 0 실측) 완전 이행 확인 | `users.service.ts:286-303`, `spec/conventions/error-codes.md §5` | 없음(확인 완료). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | self-scope 확인, enumeration/타이밍 위험 없음, 신규 인젝션·시크릿·인가 우회 없음 |
| requirement | NONE | spec 4개 문서 line-level 대조 완료, CRITICAL급 spec-code 불일치 없음 |
| scope | LOW | 3R diff가 2R WARNING/INFO에 정확히 대응, `1-auth.md` 취소선 보존 누락 WARNING 1건 |
| side_effect | LOW | wire 계약 변경은 governance 완료된 의도적 breaking change, 동일 취소선 보존 WARNING 1건 독립 발견 |
| maintainability | NONE | 함수 길이·중첩·복잡도 양호, 테스트 헬퍼 중복은 INFO 수준 |
| testing | NONE | 뮤테이션 검증(REQUIRED→INVALID 치환)으로 회귀 테스트가 결함 클래스를 실제로 잡음을 실측(RED 2건 확인 후 원복) |
| documentation | NONE | 1R·2R 지적 문서화 결함 전수 해소 확인, 신규 결함 없음 |
| api_contract | LOW | breaking change governance 완결 확인(INFO 3건만, WARNING 없음 — 종합 판정만 LOW) |
| user_guide_sync | NONE | 매칭 trigger(`auth-session-flow-change`) 1건의 동반 갱신(mdx ko/en + e2e) 이미 완료 확인 |

## 발견 없는 에이전트

user_guide_sync — 발견사항 0건(매칭 target 전량 동반 갱신 확인).

## 권장 조치사항

1. `spec/5-system/1-auth.md:521`의 자기반증형 소정정을 취소선 보존 형태로 재정정 — `~~원문~~ — 이 근거는 틀렸다(...)` 패턴으로 plan 파일과 동일하게 맞출 것(WARNING, non-blocking).
2. 마무리 커밋에서 `plan/in-progress/auth-change-password-oauth-only-code-split.md`·`plan/in-progress/spec-draft-change-password-code-alignment.md`를 `plan/complete/`로 이동(INFO, 완료 상태 확인됨).
3. (선택) `sessions.service.spec.ts`의 인라인 코드값 추출 로직을 `users.service.spec.ts`의 `codeOf`/`rejectionOf`와 공유하는 `__test-utils__` 헬퍼로 통합 — 3번째 소비처 생길 때 착수해도 무방.
4. (선택) Swagger `@ApiUnauthorizedResponse` 설명을 코드별로 세분화 — 3라운드 연속 유예된 스코프 밖 항목, 여유 있을 때 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(이 changeset 범위에 해당 없음 — 순수 에러 코드 상수 정렬, 성능 경로 변경 없음) |
  | architecture | 라우터 판단(구조 변경 없음 — 기존 발행 지점 3곳을 공유 상수로 통합하는 리팩터) |
  | dependency | 라우터 판단(신규/버전 변경 의존성 없음) |
  | database | 라우터 판단(스키마·마이그레이션 변경 없음, e2e의 DB 직접 UPDATE는 테스트 전용 격리 시나리오) |
  | concurrency | 라우터 판단(동시성 관련 로직 변경 없음) |