# API 계약(API Contract) 리뷰

## 대상 요약

`POST /users/me/change-password` 가 서로 다른 두 실패 조건(비밀번호 미설정 OAuth-only / 현재
비밀번호 불일치)에 같은 에러 코드 `INVALID_PASSWORD` 를 발행하던 것을, 형제 흐름
(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)이 이미 쓰던
`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 정렬한 변경이다(`PASSWORD_VERIFY_CODES` 공유 상수로
3개 발행 지점을 통합). 이 changeset 은 동일 주제에 대한 **3번째 리뷰 라운드**이며, 1R
(`review/code/2026/09/02/22_07_21`) 이 지적한 CHANGELOG 누락 WARNING 과, 이후
`--spec`/`--impl-done` 게이트가 잡은 CRITICAL(plan 의 "사용자 결정" 미기록)·WARNING(1-auth.md:337
발행처 열거 누락, 순환 의존 오근거) 이 모두 이번 HEAD 시점에 실제로 해소돼 있음을 직접 대조로
확인했다.

## 발견사항

- **[INFO]** `POST /users/me/change-password` 의 wire 에러 코드 breaking change — governance 완결 확인
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `changePassword` (게이트 286~303,
    `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 분기)
  - 상세: OAuth-only 실패·불일치 실패가 종전 둘 다 `INVALID_PASSWORD` 였던 것이 각각
    `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 갈린다. 이 엔드포인트는 워크스페이스 JWT 로 호출
    가능한 내부 REST 라 저장소 밖 호출자를 원리적으로 배제할 수 없어(`error-codes.md §5` 도 동일
    이유로 등급 B 로 분류) 코드 값으로 분기하는 제3자 클라이언트가 있다면 깨질 수 있다.
    다만 `codebase/frontend/src` 전수 grep(`INVALID_PASSWORD`) 결과 0건이고, change-password
    페이지는 `axiosMessage(err, …)` 로 서버 `message` 를 그대로 노출할 뿐 `error.code` 로
    분기하지 않아 1st-party 클라이언트 영향은 없다. HTTP status(401)·에러 봉투 구조
    (`{ error: { code, message, requestId } }`)는 불변이므로 **코드 값에 한정된 breaking
    change** 다. `spec/conventions/error-codes.md §5`(등급 B, 신규 행), `spec/5-system/1-auth.md`
    (§2.3·§5 note 양쪽), `spec/5-system/3-error-handling.md`(§1.2 행 제거 + §1.2.1 두 행 갱신),
    `CHANGELOG.md`(`## Unreleased` 항목) 4곳 모두 실제로 갱신돼 있음을 직접 열어 확인했다.
    또한 `plan/in-progress/auth-change-password-oauth-only-code-split.md` 에 "사용자 결정
    2026-09-02" 가 A/B/C/D 4안 비교표 + `## 결정 기록` 절로 명시 기록돼 있다 — 앞선
    consistency 라운드(`review/consistency/2026/09/02/21_12_35/plan_coherence.md`)가 CRITICAL 로
    지적했던 "이 plan 파일 어디에도 사용자 결정이 없다" 문제가 후속 라운드에서 실제로 해소된
    것을 재확인한 것이다. 마이그레이션 grace window 나 API 버전 분기는 두지 않았지만, 이는
    이 저장소가 `INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS`(#1193)에서도 쓴 동일한 선례
    패턴이라 이 diff 만의 새로운 관행은 아니다.
  - 제안: 조치 불필요 — governance(등급 B 분류, 사용자 결정 기록, 4-스펙 동기화, CHANGELOG)를
    완전히 통과했다.

- **[INFO]** Swagger(OpenAPI) 문서가 코드 분리를 반영하지 않음 (이전 라운드부터 캐리오버, 미조치
  판단 유지)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:213-215`
    (`@ApiUnauthorizedResponse({ description: '현재 비밀번호 불일치 또는 인증 실패' })`) — 이
    파일은 이번 diff 대상이 아니라 게이트 줄 번호를 인용하지 않음, 데코레이터명으로 특정
  - 상세: 컨트롤러는 `UsersService.changePassword` 가 던지는 예외를 그대로 전파할 뿐 코드를
    검사하지 않아 기능상 문제는 없다. Swagger 설명은 여전히 단일 문구라 `PASSWORD_REQUIRED`/
    `PASSWORD_INVALID` 두 코드가 분리됐다는 사실이 OpenAPI 스펙 소비자(자동 client 생성기
    등)에게 드러나지 않는다. 직전 두 라운드(1R INFO#5, 2R INFO#1) 모두 "`swagger.md` 규약
    범위 — 이 PR 에서 넓히지 않는다"로 판단을 유지했고, 이번 diff 도 해당 파일을 건드리지
    않아 판단을 유지한다.
  - 제안: 여유가 있을 때 `@ApiUnauthorizedResponse` description 세분화. 이번 changeset 의
    필수 항목은 아니다.

- **[INFO]** `POST /users/me/change-password` 에 `@Throttle` 미적용 — 선재 상태, 이번 diff 의
  회귀 아님 (2R INFO#8 재확인)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:202-216` (`changePassword`
    핸들러에 rate-limit 데코레이터 없음)
  - 상세: 비밀번호 확인 실패를 반복 시도해 코드 값(`PASSWORD_REQUIRED` vs `PASSWORD_INVALID`)으로
    OAuth-only 여부를 탐지하는 시나리오는 이미 인증된 본인 계정에 한정돼(§인증/인가 항목 참조)
    실익이 낮지만, 인접 인증 엔드포인트 중 throttle 이 적용된 곳이 있다면 비대칭이다. 이 diff 가
    새로 만든 문제가 아니고 스코프 밖(사용자 요청 없음)이라 2R 판단을 유지한다.
  - 제안: 별도 트래킹 없이 기록만 유지. 필요시 별도 PR.

## 점검 관점별 확인 내역

1. **하위 호환성** — 위 INFO#1 참조. wire 코드 값이 바뀌는 breaking change 이나 등급 B governance
   완료, 1st-party 영향 0 실측 확인. 신규 코드는 만들지 않고 기존 형제 코드를 재사용해 근접
   명명 확산도 없다.
2. **버전 관리** — 이 API 는 URL 버저닝을 쓰지 않는 기존 컨벤션(`spec/5-system/2-api-convention.md`)
   을 그대로 따른다. 이 diff 가 새로 도입한 문제는 아니다.
3. **응답 형식** — `GlobalExceptionFilter` 봉투(`{ error: { code, message, requestId } }`) 구조
   불변. `changePassword` 성공 응답(`{ data: { accessToken } }`)도 불변.
4. **에러 응답** — HTTP status 는 모두 401 유지, 코드만 조건별로 분리돼 클라이언트가 두 실패를
   구분할 수 있게 됐다(개선). 세 발행 지점(`auth.service.ts`·`sessions.service.ts`·
   `users.service.ts`)이 문자열 리터럴 대신 `PASSWORD_VERIFY_CODES` 공유 상수를 쓰도록 구조적으로
   drift 원인을 제거했다.
5. **요청 검증** — 이번 diff 에 요청 바디/파라미터 검증 로직 변경 없음(`ChangePasswordDto` 미변경,
   `currentPassword`/`newPassword` 의 `IsString`/`MinLength`/`MaxLength` 그대로) — 에러 코드만
   변경됐다.
6. **URL/경로 설계** — 변경 없음.
7. **페이지네이션** — 해당 없음(목록 API 아님).
8. **인증/인가** — 인증/인가 로직 자체는 변경되지 않았다. `changePassword`/
   `verifyPasswordForUser`/`verifyReauth` 전 경로가 `@CurrentUser()`(JWT `sub`)로만 대상 사용자를
   특정해 body/param 으로 타인 ID 를 주입할 표면이 없다 — "OAuth-only 인지" 코드 분리가 사용자
   열거(enumeration) 등 새로운 노출 벡터를 만들지 않는다.

## 이전 라운드 대비 변경 사항 (검증)

- 1R WARNING(CHANGELOG 누락) → `CHANGELOG.md` 에 `## Unreleased` 항목 추가, 코드 쌍·영향
  엔드포인트·감사값 존속 이유·가이드 정정까지 반영됨을 확인.
- consistency `plan_coherence` CRITICAL(사용자 결정이 plan 문서에 없음, 채택안이 A/B/C 메뉴 밖) →
  `auth-change-password-oauth-only-code-split.md` 의 선택지 표가 A/B/C/**D**(형제 코드 재사용)로
  재작성되고 `## 결정 기록 (2026-09-02)` 절이 신설돼 해소됨을 직접 확인.
- consistency `cross_spec` WARNING(`1-auth.md:337` 재인증 note 가 `changePassword` 를 발행처로
  누락) → 해당 note 에 "**비밀번호 변경의 현재 비밀번호 재확인**(`UsersService.changePassword`,
  아래 note)" 문구가 추가돼 해소됨을 `git diff` 로 직접 확인.
- `--impl-done` WARNING("순환 의존이라 헬퍼 공유 불가" 오근거, 3곳에 기재) → spec note·plan·
  `PASSWORD_VERIFY_CODES` JSDoc 세 곳 모두 취소선으로 원문을 보존한 채 실측 근거(조회 2회 방지·
  `!user` 처방 차이·안내 문구 차이)로 교체됐음을 확인.

## 요약

`POST /users/me/change-password` 의 에러 코드를 형제 흐름과 정렬하는 의도적 breaking change 로,
에러 봉투 구조·HTTP status·요청 검증·URL 설계·인증 경계 모두 변경 없이 안정적으로 유지된다.
breaking 요소(코드 값 변경)는 `error-codes.md §5` 등급 B 로 정식 governance 절차(사용자 결정
기록, 1st-party 영향 실측 0건, 4개 spec 문서 동기화, CHANGELOG 등재)를 완전히 거쳤다. 앞선
라운드들이 발견한 CRITICAL(plan 결정 미기록)·WARNING(spec 발행처 열거 누락, CHANGELOG 누락,
순환 의존 오근거) 은 모두 이번 HEAD 에서 실제로 해소돼 있음을 직접 대조로 재확인했으며, 이번
라운드에서 새로 발견된 API 계약 관점의 Critical/Warning 은 없다. Swagger 설명 미세분화·
`@Throttle` 부재는 이전 라운드부터 이어지는 사소한 개선 여지(INFO)로만 남는다.

## 위험도

LOW
