# 테스트(Testing) 코드 리뷰

## 리뷰 범위 및 방법

`change-password` 실패 코드를 형제 흐름(`AuthService.verifyPasswordForUser`)과 정렬하는 변경
(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`, 공유 상수 `PASSWORD_VERIFY_CODES`
도입)의 3라운드째 리뷰다. 이 브랜치는 이미 2라운드(`review/code/2026/09/02/22_07_21/`,
`review/code/2026/09/03/10_45_22/`)를 거쳤고 각 라운드의 testing 관점 WARNING(클래스만
단언·가드 `throw` 가 자기 `catch` 에 걸림)은 모두 조치됐다. 이번 라운드는 그 조치가 실제로
현재 코드에 반영돼 있는지 직접 파일을 열어 재확인하고, 독립적으로 뮤테이션을 걸어 회귀
방지력을 실측했다.

검토 파일: `codebase/backend/src/common/utils/password.util.ts`,
`codebase/backend/src/modules/auth/auth.service.ts`(+`.spec.ts`),
`codebase/backend/src/modules/auth/sessions.service.ts`(+`.spec.ts`),
`codebase/backend/src/modules/users/users.service.ts`(+`.spec.ts`),
`codebase/backend/src/modules/users/users.controller.spec.ts`,
`codebase/backend/test/users-change-password.e2e-spec.ts`.

## 독립 뮤테이션 검증

이 PR 이 고치는 결함(OAuth-only 미설정과 불일치를 같은 코드로 합침)을 `users.service.ts` 에
직접 재현해 봤다 — `changePassword` 의 OAuth-only 분기(`code: PASSWORD_VERIFY_CODES.REQUIRED`)를
`PASSWORD_VERIFY_CODES.INVALID` 로 바꿔 두 분기가 같은 코드를 내도록 만든 것.

| 단계 | 결과 |
|---|---|
| 뮤턴트 적용 (`REQUIRED` → `INVALID`, 292번째 줄) | — |
| `users.service.spec.ts` 실행 | **RED 2** — `'OAuth-only 실패 코드는 형제 흐름과 같은 PASSWORD_REQUIRED 다'`, `'[대조군] 두 실패 분기가 서로 다른 코드를 낸다'` |
| 원복 (`cp` 로 scratch 백업본 복사) | `git status --short`/`git diff` 둘 다 빈 출력 — 잔여물 없음 |
| 재실행 | GREEN 14/14 |

리터럴 단언 + 대조군 테스트가 정확히 이 PR 이 고치는 결함 클래스를 잡는다는 것을 직접
확인했다. 저장소 트리에 남은 뮤테이션 잔여물 없음(revert 확인 완료, 협업 중인 다른
reviewer 오염 없음).

## 회귀 테스트 유효성 재확인 (2라운드 조치분 실사)

- `sessions.service.spec.ts:192-214` — RESOLUTION 2R 이 "가드 단언을 `catch` 밖으로 옮겼다"고
  서술한 내용을 직접 열어 대조했다. `expect(thrown).toBeInstanceOf(UnauthorizedException)` 이
  `try/catch` **블록 밖**에 위치해 있어(198~208행이 try/catch, 209행이 가드), 서비스가
  reject 하지 않는 회귀가 나도 `getResponse is not a function` 같은 오도된 메시지 없이
  정확한 실패 사유로 RED 가 난다. 서술과 실측이 일치한다.
- `auth.service.spec.ts:550-600` (`verifyPasswordForUser`) — 4개 분기(사용자 미존재·
  OAuth-only·불일치·일치) 모두 `rejects.toMatchObject({ status, response: { code } })` 로
  리터럴 코드값을 단언한다. Jest 내장 promise matcher 를 쓰므로 애초에 "가드가 자기 catch 에
  잡히는" 클래스의 결함이 발생할 수 없는 가장 안전한 패턴 — 세 소비처 중 가장 견고하다.
- `users.service.spec.ts:174-218` — 클래스 단언(`rejects.toThrow`)·코드값 단언(`codeOf`)·
  대조군(두 분기가 다른 코드) 세 계층이 분리돼 있고, 테스트 제목이 실제 단언 범위와
  일치하도록 좁혀져 있음(1R maintainability INFO 조치 확인).
- `codebase/backend/src/modules/users/users.controller.spec.ts:262-287` — 컨트롤러는
  `service.changePassword` 예외를 그대로 전파할 뿐 `code` 필드를 검사하지 않으므로,
  mock 리터럴을 `'INVALID_PASSWORD'` → `'PASSWORD_INVALID'` 로 바꾼 것은 행동에 영향이
  없는 표기 정합 변경이다 — 회귀 위험 없음.
- `users-change-password.e2e-spec.ts:96-124` — 독립 사용자(`uniqueEmail('pwchg-oauth')`)를
  등록한 뒤 `UPDATE ... WHERE id = $1` 로 그 계정만 `password_hash` 를 NULL 로 만든다.
  다른 e2e 테스트(라인 38, 126)와 사용자가 겹치지 않아 격리돼 있다. 상태(401 + 코드 리터럴 +
  불일치 코드가 아님 대조군 + 안내 문구 + 감사 미기록 4종)를 한 테스트에서 계층적으로
  검증한다.

## 발견사항

- **[INFO]** 형제 spec 파일 사이 "코드값 추출" 헬퍼가 한쪽만 함수로 분리됨
  - 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts` (`it('비밀번호 불일치 실패 코드는 PASSWORD_INVALID 다', ...)` 블록, 인라인 `try/catch`+`getResponse` 캐스트) vs `codebase/backend/src/modules/users/users.service.spec.ts` (`codeOf`/`rejectionOf` 헬퍼로 추출, 4개 테스트가 재사용)
  - 상세: 두 파일 모두 "예외 클래스만 보면 코드값 drift 를 놓친다"는 같은 문제의식으로 같은 시점에 작성됐는데, `sessions.service.spec.ts` 쪽만 인라인으로 남아 있다. 직전 라운드(`10_45_22/maintainability.md`)가 이미 같은 관찰을 INFO 로 남기고 "현재 1회성이라 조치 불요, 두 번째 테스트가 늘면 추출"로 판단했다 — 그 판단을 재확인했고 동의한다. testing 관점에서 추가할 내용: `sessions.service.ts` 의 `verifyReauth` 는 `revokeFamily`·`revokeOtherFamilies`·`reauthenticate` 세 공개 메서드가 공유하는 단일 private 메서드이고, 리터럴 코드값 테스트는 그중 `revokeFamily` 경로 하나만 커버한다. 셋이 같은 코드 경로(`verifyReauth`)를 타므로 값 drift 방지 목적은 하나로 충분히 달성되지만, 다음에 이 인라인 패턴을 복붙할 자리가 생길 가능성이 있다는 점은 여전하다.
  - 제안: 조치 불요(현재도 판단 유효). 세 번째 코드값 테스트가 이 파일에 추가되는 시점에 로컬 헬퍼로 추출 권장.

- **[INFO]** e2e 의 OAuth-only 상태가 실제 OAuth 가입 경로가 아니라 DB 직접 조작으로 합성됨
  - 위치: `codebase/backend/test/users-change-password.e2e-spec.ts:102-104` (`UPDATE "user" SET password_hash = NULL WHERE id = $1`)
  - 상세: 테스트 주석이 이 선택을 명시적으로 정당화한다("발급된 JWT 는 그대로 유효하므로 인증은 되는데 비밀번호가 없는 계정이라는 관측 상태가 OAuth-only 와 동일"). `changePassword` 로직 자체는 `passwordHash` 필드값만 보고 분기하므로 관측 가능한 상태 동등성 주장은 타당하다. 다만 실제 OAuth 가입 경로(`findByOauth`/OAuth 콜백)를 거치지 않으므로, 만약 향후 OAuth 가입 시 `password_hash` 외에 별도 플래그·다른 컬럼 조합이 추가되는 변경이 생기면 이 e2e 는 그 새 조합을 검증하지 못하고 여전히 통과한다.
  - 제안: 조치 불요(현재 로직 기준으로는 등가). 향후 OAuth 계정 판별 로직이 `password_hash IS NULL` 단일 조건 이상으로 복잡해지면, 실제 가입 경로를 쓰는 e2e helper 도입을 고려.

## 확인한 항목 (문제 없음 — 회귀 아님, 참고용)

- `password.util.ts` 의 `PASSWORD_VERIFY_CODES` 상수 자체를 pin 하는 별도 테스트는 없다(1R
  INFO #4, 판단 유지 확인). 세 소비처(`auth.service.spec.ts`·`users.service.spec.ts`·
  `sessions.service.spec.ts`)가 전부 값을 **리터럴로** 단언하므로, 상수 값이 바뀌면 세
  스위트가 동시에 RED 가 난다 — 별도 pin 테스트가 주는 한계 방어와 동일한 효과를 이미 얻고
  있어 중복이 맞다.
- `users.service.spec.ts` 의 `beforeEach` 가 매 테스트마다 `TestingModule` 을 새로 컴파일하고
  `S3Service` mock 이 호출 시 즉시 throw 하도록 구성돼 있어(§1, "조용한 no-op 대신 시끄러운
  실패"), 이 스위트가 건드리지 않는 아바타 업로드 경로가 실수로 호출되는 회귀를 침묵시키지
  않는다 — mock 적절성 양호.
- `sessions.service.spec.ts` 의 `describe('revokeFamily', ...)` 내부 `beforeEach` 가
  `usersService.findById` 에 유효한 `passwordHash`(bcrypt 해시)를 가진 사용자를 매번 새로
  세팅해, 새로 추가된 코드값 테스트를 포함한 모든 하위 테스트가 이 mock 에 의존하되 테스트
  간 상태 누수 없이 독립 실행됨을 확인했다.

## 요약

이전 2라운드가 테스트 관점 WARNING(클래스만 단언하는 사각·가드 `throw` 가 자기 `catch` 에
잡히는 결함)을 이미 식별·조치했고, 이번 라운드에서 그 조치가 실제 코드에 반영돼 있음을
직접 파일 대조로 재확인했다. 추가로 이 PR 이 고치는 정확한 결함 클래스(두 실패 분기가 같은
코드를 발행)를 `users.service.ts` 에 독립적으로 재현하는 뮤테이션을 걸어 리터럴 단언 +
대조군 테스트가 실제로 RED 를 내는 것을 실측했고(2건 실패), 원복 후 저장소 트리에 잔여물이
없음을 확인했다. 세 소비처(`auth.service`·`users.service`·`sessions.service`) 모두 코드값을
리터럴로 핀하는 회귀 테스트를 갖추게 됐고, e2e 도 자매 분기(불일치)와 대칭으로 breaking
분기(OAuth-only)를 커버해 계층 간 비대칭이 해소됐다. 남은 것은 형제 spec 파일 간 헬퍼
추출 비대칭 1건과 e2e 상태 합성 방식 1건으로, 둘 다 이미 문서화된 근거가 있고 현재 로직
기준으로는 결함이 아닌 INFO 수준의 관찰이다.

## 위험도

NONE
