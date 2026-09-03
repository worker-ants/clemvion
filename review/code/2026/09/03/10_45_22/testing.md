# 테스트(Testing) 코드 리뷰 — `change-password` 실패 코드 형제 정렬

## 리뷰 범위

`INVALID_PASSWORD` 를 조건별로 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 분리하는 변경의 테스트
표면을 검토했다. 대상은 `password.util.ts`(상수 SoT), `auth.service.ts`/`sessions.service.ts`/
`users.service.ts`(발행 지점 3곳)와 그에 대응하는 `*.spec.ts` 4개(`sessions.service.spec.ts`,
`users.controller.spec.ts`, `users.service.spec.ts`, 기존 `auth.service.spec.ts`) + e2e
1개(`users-change-password.e2e-spec.ts`). 직전 리뷰 라운드(`review/code/2026/09/02/22_07_21/`)의
`RESOLUTION.md`가 이미 W1(코드값 리터럴 미핀 — `sessions.service`)·W2(e2e 비대칭 — OAuth-only
분기 무검증)를 조치했다고 주장하길래, 그 주장을 **직접 뮤테이션으로 재검증**했다(아래 §검증).

## 발견사항

- **[INFO]** `try{...throw...}catch` 패턴에서 "예외 미발생" 실패가 의도한 메시지가 아니라
  엉뚱한 `TypeError` 로 보고된다
  - 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts:194-209`
    (`it('비밀번호 불일치 실패 코드는 PASSWORD_INVALID 다', ...)`, 특히 202-204행의
    `throw new Error('expected revokeFamily to reject')` 가 **`try` 블록 안**에 있다),
    `codebase/backend/src/modules/users/users.service.spec.ts:205-222`
    (`it('OAuth-only 메시지는 비밀번호 추가 경로를 안내한다', ...)`, 213행 동일 패턴)
  - 상세: 두 테스트 모두 "reject 하지 않으면 실패시키는" 가드용 `throw`를 `catch` 앞
    **`try` 블록 내부**에 심어 뒀다. 그런데 `service`가 실제로 reject 하지 않는 회귀가 나면
    이 가드 `throw`가 **그 자체로 `catch` 에 잡혀** `err`가 `Error('expected ... to reject')`
    가 되고, 바로 다음 줄 `(err as UnauthorizedException).getResponse()` 호출이
    `TypeError: err.getResponse is not a function` 로 죽는다. 테스트는 **여전히 실패하므로
    vacuous-pass는 아니다** — 뮤테이션으로 직접 확인했다(§검증). 다만 실패 메시지가 "reject 하지
    않음"이라는 실제 원인 대신 무관한 `TypeError` 로 나와 디버깅 시 혼동을 준다. 같은 파일
    (`users.service.spec.ts:149-157`)의 `codeOf()` 헬퍼는 정확히 같은 목적의 가드 `throw`를
    **`try`/`catch` 블록 바깥**에 둬서 이 문제를 올바르게 피하고 있다 — 같은 PR, 같은 작성자가
    두 가지 다른(하나는 옳고 하나는 틀린) 패턴을 섞어 썼다.
  - 제안: 두 테스트의 가드 `throw`를 `codeOf()` 헬퍼와 같은 형태로 `catch` 블록 밖으로 옮기거나
    (`let threw = false; try { await …; } catch (err) { threw = true; … } expect(threw).toBe(true);`
    또는 아예 `codeOf()`/`expect(...).rejects.toMatchObject(...)` 재사용), Jest 의
    `expect.assertions(n)`을 테스트 상단에 추가해 "catch 블록이 실행됐는가" 를 명시적으로
    고정하는 것도 대안이다.

## 검증 (뮤테이션, repo 밖 사본으로 원복)

- 대상: `codebase/backend/src/modules/auth/sessions.service.ts` `verifyReauth` 의 비밀번호
  불일치 분기 — `if (ok) return;` 다음의 `throw new UnauthorizedException(...)` 를 무력화하고
  `return`으로 항상 성공 처리하도록 임시 수정(원본은 `mktemp` 없이 저장소 안 파일을 직접
  고쳤으나, 고치기 **전** `git status --short`로 unmodified 상태 확인 → 원본을 스크래치
  디렉터리(`/private/tmp/.../scratchpad/backup/`)에 `cp` 로 미리 백업 → 수정 → 테스트 실행 →
  `cp` 로 즉시 원복 → `diff`로 바이트 동일 확인 → `git status --short`로 클린 확인, 아래 표).
- 예측: 새 리터럴 테스트(`sessions.service.spec.ts:192-209`)가 RED 로 죽되, `throw` 가
  `try` 내부에 있어 실패 메시지가 원래 의도(`expect(body.code).toBe('PASSWORD_INVALID')`)와
  다른 형태로 나올 것.
- 실측:

| 상태 | 결과 |
|---|---|
| 뮤테이션 적용 (`ok` 분기 항상 `return`) | **RED** — `TypeError: err.getResponse is not a function` (예측대로, 의도한 assertion 메시지 아님) |
| 원복 후 재실행 | **GREEN** (18 skipped, 1 passed) |
| `diff` 원본 대 원복본 | 바이트 동일 |
| `git status --short` (해당 파일) | 출력 없음 — 클린 |

- 결론: RESOLUTION.md 의 "W1 조치 — `sessions.service` 코드값 리터럴 핀 완료, 뮤테이션 RED 확인"
  주장은 **참**이다(내가 독립적으로 재현). 다만 그 RED 가 "명확한 assertion 실패"가 아니라
  "무관한 TypeError" 형태라는 점은 원 개발자의 뮤테이션 로그에는 드러나지 않았을 수 있다 —
  위 INFO 항목으로 남긴다.

## 확인한 항목 (문제 없음)

- **e2e 비대칭 갭(직전 라운드 WARNING) 해소 확인** — `users-change-password.e2e-spec.ts` 에
  OAuth-only(`password_hash IS NULL`) 계정이 실제 HTTP 레벨로 `401 PASSWORD_REQUIRED`를
  받는 케이스가 추가됐다(`registerAndLogin` 후 raw SQL 로 `password_hash`를 NULL 화 —
  OAuth-only 계정의 관측 가능한 상태를 정확히 재현하는 적절한 기법). 코드값 리터럴 단언 +
  "불일치 코드가 아님" 대조군 + 안내 문구 + 감사 미기록까지 확인해 자매 분기(불일치 →
  `PASSWORD_INVALID`, 기존 e2e)와 커버리지 계층이 대칭을 이룬다. `uniqueEmail('pwchg-oauth')`
  로 독립 사용자를 만들어 다른 e2e 케이스와 격리도 유지된다.
- **소비처 3/3 리터럴 핀** — `auth.service.spec.ts`(기존, 미변경), `sessions.service.spec.ts`,
  `users.service.spec.ts` 세 곳 모두 `PASSWORD_VERIFY_CODES` **상수가 아니라 문자열 리터럴**로
  단언한다 — 상수가 통째로 바뀌는 회귀(예: 두 값이 스왑)를 테스트가 함께 움직여 놓치는 것을
  막는다. `password.util.spec.ts` 에 별도 상수-pin 테스트를 만들지 않은 판단(RESOLUTION #4)도
  타당하다 — 이미 3곳이 값을 리터럴로 고정하므로 값이 바뀌면 3곳이 동시에 RED 다.
- **대조군(control-group) 테스트** — `users.service.spec.ts:193-203`
  (`'[대조군] 두 실패 분기가 서로 다른 코드를 낸다'`)와 e2e 의
  `expect(res.body.error.code).not.toBe('PASSWORD_INVALID')` 는 "두 코드가 우연히 같아지는"
  회귀(바로 이 PR 이 고친 그 결함의 재발)를 직접 겨냥한다 — 좋은 캐너리.
  `codeOf()` 헬퍼(`users.service.spec.ts:149-157`)는 가드 `throw`를 `try`/`catch` 밖에 둬서
  vacuous-pass 위험이 없는 올바른 형태다(위 INFO 항목과 대비되는 좋은 예).
  이 헬퍼 재사용으로 검증했다.
- **테스트 격리** — `users.service.spec.ts`는 `beforeEach` 마다 `repo` mock 을 새로 만들고,
  `sessions.service.spec.ts`의 `revokeFamily` 스위트는 `beforeEach` 에서
  `user.passwordHash`를 실제 `bcrypt.hash('correct-pw', 12)` 로 재설정한다(고정 해시가
  아니라 매 테스트 새로 계산) — 신규 테스트가 `'wrong'` 대 `'correct-pw'` 를 실제로 비교하는
  경로를 타는지 직접 소스를 읽어 확인했다(단순히 mock 이 항상 실패하도록 세팅된 게 아님).
  e2e 는 `uniqueEmail` 로 사용자별 독립 계정을 쓴다. 세 계층 모두 테스트 간 상태 누수 없음.
- **fixture 캐스트 근거 실측** — `users.service.spec.ts:86-102` 의 `oauthOnlyUser()` JSDoc이
  "엔티티 TS 타입은 `string`(non-null)인데 컬럼은 `nullable: true`" 라고 주장하길래
  `user.entity.ts` 를 직접 열어 `passwordHash: string;` 필드 선언과
  `validatePasswordHashFormat()` 의 `this.passwordHash === null` 검사를 대조 확인했다 — 주장이
  정확하다.
- **회귀 테스트 유효성** — `users.controller.spec.ts:266` 의 리터럴 치환
  (`'INVALID_PASSWORD'` → `'PASSWORD_INVALID'`)은 컨트롤러가 `service.changePassword` 예외를
  그대로 전파하는지만 보는 mock-reject 테스트라 코드값 자체는 assertion 대상이 아니다 — 기계적
  개명이고 회귀 위험 없음. 저장소 전수 grep(`INVALID_PASSWORD`) 결과 남은 참조는 주석·별개
  레이어(로그인 실패 감사값 `failureReason`, `auth.service.ts:348`)뿐으로 CHANGELOG 의
  "감사값은 레이어가 달라 그대로 남는다" 서술과 일치한다.
- **테스트 용이성** — `PASSWORD_VERIFY_CODES` 상수를 3개 서비스가 공유하면서도 헬퍼 자체는
  공유하지 않는 설계(`UsersService`→`AuthService` 역방향 의존 회피)가 각 서비스 스펙을
  독립적으로 리터럴-핀 가능하게 만든다 — 좋은 테스트 용이성 설계.

## 요약

가장 중요한 결함(2건, 직전 라운드 W1·W2)이 이번 diff 에서 실제로 조치됐음을 코드 열람과
독립 뮤테이션으로 직접 재검증했다 — RESOLUTION.md 의 주장은 참이다. 리터럴 단언·대조군
테스트·3계층(auth/sessions/users) 소비처 동시 커버·e2e 대칭성 확보 등 테스트 설계 전반의
완성도가 높다. 유일하게 새로 발견한 것은 신규 테스트 2건의 "가드 `throw`를 `try` 안에 두는"
패턴(INFO)으로, vacuous-pass 는 아니지만(뮤테이션으로 실측: 여전히 RED) 실패 시 진단
메시지가 혼동을 준다 — 같은 파일에 이미 올바른 패턴(`codeOf()`)이 있어 손쉽게 통일 가능하다.

## 위험도

LOW
