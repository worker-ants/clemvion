# 테스트(Testing) 리뷰 — `raceUnderHeldLock()` 동시성 e2e 헬퍼 추출 (3차 라운드)

## 리뷰 범위 및 검증 방법

`codebase/backend/test/helpers/concurrency.ts` 신설 + 9개 파일 11개 블록
(`auth-config-` · `integration-` · `member-remove-`(2) · `model-config-` · `schedule-` ·
`trigger-` · `webauthn-credential-`(2) · `workflow-` · `workspace-delete-concurrency.e2e-spec.ts`)의
인라인 `BEGIN → 락 → 발사 → 공허성 가드(`Promise.race`) → COMMIT → finally` 블록을
`raceUnderHeldLock()` 호출로 치환하는 순수 테스트 리팩터. 이번 라운드는 직전 두 라운드
(`review/code/2026/09/21/20_26_50`, `20_45_43`)의 지적을 반영한 후속 커밋(`6b29435ac`,
`905e1f696` — `KNOWN_LOCK_TIMEOUTS_MS` 목록화, `@throws`/`@example` 보강)까지 포함한다.

- `codebase/backend/test/helpers/concurrency.ts` 전체를 `Read` 로 직접 열람.
- `git diff origin/main HEAD -- <path>` 로 프롬프트에서 생략된
  `webauthn-credential-delete-concurrency.e2e-spec.ts` diff 를 직접 조회.
- 11개 호출부 전부에서 `.sort(...)` 비교자를 `grep` 으로 대조 — 전부 숫자 비교자
  (`(a, b) => a - b` 또는 `(a, b) => a.status - b.status`)를 쓰고 있어, JSDoc `@example` 이
  경고하는 "기본 사전식 `.sort()`" 함정에 걸린 호출부는 없음을 확인.
- `codebase/backend/test/helpers/` 디렉터리에 `concurrency.ts` 전용 단위 테스트 파일이
  없음을 `find`/`grep -rl raceUnderHeldLock` 로 확인(다른 헬퍼 `auth.ts`/`db.ts`/`webauthn.ts`
  도 동일하게 전용 단위 테스트가 없어 기존 컨벤션과 일관됨).
- `_test_logs/e2e-20260921-205918.log` (이번 라운드 반영 커밋 이후 재실행분)를 직접 열어
  `Test Suites: 70 passed, 70 total` / `Tests: 378 passed, 378 total` 및 10개
  concurrency 스위트(`raceUnderHeldLock` 사용 9개 + 제외된 `integration-rotate-` 1개) 전부
  `PASS` 를 확인 — plan 체크리스트의 "e2e 378 PASS" 서술과 실측이 일치.
- 저장소 파일은 어떤 것도 쓰거나 고치지 않았다(`git status --short` 상 이 리뷰 세션의
  출력 디렉터리만 untracked).

## 발견사항

- **[INFO]** (직전 두 라운드에서도 지적됐고 이번 라운드에도 그대로 유효) 공유 헬퍼
  `raceUnderHeldLock()` 자체를 겨냥한 독립 단위 테스트가 없다 — 특히 **입력 검증**과
  **모듈 로드시 불변식 검사**라는 두 개의 순수 동기 분기는 실제 Postgres 타이밍과 무관한데도
  여전히 어떤 테스트에서도 도달하지 않는다
  - 위치: `codebase/backend/test/helpers/concurrency.ts` — `fires.length < 2` 가드
    (`export async function raceUnderHeldLock` 본문 시작부, `if (fires.length < 2) { throw ... }`)와
    `KNOWN_LOCK_TIMEOUTS_MS` 순회 `throw` (같은 파일, 함수 선언 이전의 모듈 최상위 `for` 루프)
  - 상세: 11개 호출부 전부가 정적으로 `fires.length === 2`, `VACUITY_GUARD_MS(1_500) < TRIGGER_DELETE_LOCK_TIMEOUT_MS(5_000)` 조건을 만족하므로 두 `throw` 분기는 e2e 스위트 어디에서도
    실행되지 않는다. 이 두 분기는 실제 DB 락·트랜잭션 타이밍에 의존하지 않는 **순수 동기 로직**이라,
    직전 라운드들이 "mock 기반 단위 테스트는 허위 안전감을 만든다"며 전체를 유예한 근거가
    이 두 분기에는 적용되지 않는다 — `Client` 를 흉내 낼 필요 없이 (1) `raceUnderHeldLock(fakeClient, lock, [oneFire])` 가 `BEGIN` 호출 전에 즉시 reject 하는지, (2) `jest.resetModules()` 로 모듈을
    재평가하며 `VACUITY_GUARD_MS >= timeoutMs` 가 되도록 만든 뒤 import 자체가 던지는지는 순수
    동기/모듈-로드 테스트로 저비용 검증 가능하다. 특히 (2)는 이번 라운드에 새로 승격된
    "주석 → 코드 검사" 방어(커밋 `6b29435ac`)의 유일한 자기 검증 지점인데, 그 검사 자체가
    한 번도 실제로 던지는 것을 관측한 적이 없다 — 향후 `KNOWN_LOCK_TIMEOUTS_MS` 항목 추가/삭제
    리팩터를 누군가 실수로 깨뜨려도(예: 배열 대신 객체로 바꾸며 순회 로직이 조용히 no-op 이 되는 등)
    잡아낼 회귀 테스트가 없다.
  - 제안: 이 리팩터를 막을 사안은 아니다(직전 두 라운드와 동일하게 INFO). 다만 다음에 이 파일을
    다시 손댈 때는, "실제 락 타이밍"에 의존하는 나머지 로직(BEGIN/COMMIT/공허성 가드)은 계속
    e2e 로 간접 검증하되, 위 두 개의 순수 동기 분기만이라도 `concurrency.spec.ts` (Jest unit,
    DB 불필요)로 분리해 직접 행사하는 것을 고려할 만하다. 특히 (2)는 이 PR 이 방금 "주석보다
    코드가 낫다"며 승격한 방어인데 그 방어 자체가 미검증이라는 점에서, 다른 INFO 두 건보다
    우선순위가 약간 높다.

- **[INFO]** (직전 두 라운드에서 이미 지적, YAGNI 로 유예 유지) `fires` 3개 이상(N≥3) 케이스와
  `lock.params` 생략 케이스는 JSDoc·시그니처상 지원한다고 선언하지만 11개 호출부 전부
  정확히 2개 thunk + 명시적 `params` 배열만 사용해 어떤 테스트로도 실행되지 않는다
  - 위치: `codebase/backend/test/helpers/concurrency.ts` (`@param fires` JSDoc, 함수 시그니처
    `fires: Array<() => Promise<T>>`) vs 11개 호출부 전체(`[fireDelete, fireDelete]` 류)
  - 상세: 직전 라운드 판단(조치 불요, 새 호출부가 실제로 필요해질 때 그 자리에서 검증)에 변화
    없음. 이번 라운드 diff 도 N=2 이외의 사용례를 추가하지 않았다.
  - 제안: 조치 불요.

## 회귀 테스트 확인 (변경 후에도 유효)

- **단언(assertion) 전수 보존**: 11개 호출부 diff 를 원본과 대조한 결과, 상태 코드
  (`200`/`204`/`403`/`404`)·에러 코드(`RESOURCE_NOT_FOUND`/`MODEL_CONFIG_NOT_FOUND`/
  `MEMBER_NOT_FOUND`/`NOT_A_MEMBER`/`WEBAUTHN_CREDENTIAL_NOT_FOUND`/`WORKSPACE_NOT_FOUND`)·
  감사 로그 카운트 단언이 리터럴 그대로 남아 있다. 사라진 것은 헬퍼로 이관된
  `expect(raced).toBe('pending')` 11건뿐이다.
- **정렬 비교자 안전성**: 11개 호출부 전부 숫자 비교자를 명시적으로 넘겨, JSDoc `@example`
  이 경고하는 "기본 `.sort()` 는 사전식이라 다른 값으로 복제하면 조용히 깨진다" 함정에
  걸린 곳이 없다(위 검증 방법 참고).
  - 참고: `webauthn-credential-delete-concurrency.e2e-spec.ts` 의 두 번째 블록(서로 다른
    credential 2건 동시 삭제, 결과가 `[204, 204]`)은 값이 같아 비교자 버그가 있어도 우연히
    통과할 수 있는 유일한 케이스이지만, 나머지 10개 블록은 좌우 값이 다른(`[204,404]`,
    `[200,403]` 등) 판별력 있는 fixture라 비교자 방향이 뒤집히면 실제로 RED 가 난다.
- **회귀 실측**: `_test_logs/e2e-20260921-205918.log` 로 이번 라운드 반영 커밋 이후에도
  378/378 PASS, 9개 concurrency 스위트 전부 PASS 를 직접 확인(추정이 아니라 로그 대조).
- **판별력 있는 음성 대조군**: `plan/in-progress/e2e-race-helper.md` §체크리스트가 기록한
  "헬퍼의 락 쿼리를 제거하는 뮤턴트 → 예측 11 RED / 실측 11 RED, 실패 사유까지
  `Received: \"settled\"` 로 확인(엉뚱한 이유로 죽은 RED 아님), 원복은 `cp`" 는 "전부 GREEN"
  만으로는 얻을 수 없는 증거이며, 이 리팩터가 스스로 겨냥한 위험(가드가 조용히 죽는 것)을
  직접 검증했다. 다만 이 실험은 **1회성 수동 뮤테이션이고 plan 문서에 서술로만 남아 있다** —
  향후 누군가 헬퍼의 `Promise.race`/`settled`↔`pending` 라벨링을 실수로 바꿔도, 그 실수를
  잡아낼 **영구적** 회귀 테스트는 저장소에 없다(이 역시 위 첫 INFO 항목과 같은 성격이지만,
  가드 로직 자체는 실제 Postgres 타이밍에 결합돼 있어 순수 단위 테스트로 옮기기 어렵다는
  점에서 이미 두 차례의 리뷰가 이 트레이드오프를 수용했고, 이번 라운드도 그 판단에 동의한다).

## 테스트 격리·용이성·Mock 적절성 확인 (문제 없음)

- **격리**: 헬퍼 자체는 모듈 스코프 가변 상태 없이(`VACUITY_GUARD_MS`/`KNOWN_LOCK_TIMEOUTS_MS`
  는 둘 다 불변), 각 e2e 스위트는 독립된 `db`/`locker` 커넥션과 `uniqueEmail`/`uniqueName`
  격리를 그대로 사용한다. 헬퍼 도입이 스위트 간 새로운 의존성을 만들지 않았다.
- **의존성 주입 구조**: `locker: Client` 를 파라미터로 받는 설계 자체가 테스트 용이성 관점에서
  적절하다 — 실제 커넥션 대신 fake/stub `Client` 를 주입해 위 순수 동기 분기(`fires.length < 2`)
  를 단위 테스트하는 것이 구조적으로 어렵지 않다(위 INFO 의 근거).
- **Mock 미사용이 적절함**: 겹침(레이스) 자체를 검증하는 핵심 로직은 실제 Postgres
  트랜잭션/락 타이밍에 의존하며, 이 결함 클래스(동시 삭제 시 감사 중복)를 mock 으로
  재현하는 것은 신뢰할 수 없다는 이전 판단(round1/2)에 동의한다. 리팩터가 이 구조를
  그대로 보존했다.

## 요약

3차 라운드 diff 는 프로덕션 코드 변경 없이 9파일 11블록의 동시성 e2e 보일러플레이트를
`raceUnderHeldLock()` 로 추출한 순수 테스트 리팩터이며, 직전 두 라운드의 지적(문서 가이드
누락 · 가드-프로덕션 상수 관계가 주석 수준)이 각각 `PROJECT.md` 반영과 `KNOWN_LOCK_TIMEOUTS_MS`
검사로 실제 커밋에 반영되어 있음을 코드로 직접 확인했다. 도메인 단언은 11블록 전부 원문 그대로
보존되고, 정렬 비교자는 전부 숫자형이며, 378/378 e2e 회귀 없음을 최신 로그로 재확인했다. 남은
갭은 전부 INFO 수준이다 — 그중 눈에 띄는 것은, 이번 라운드에 새로 승격된 "주석 → 코드 검사"
방어(`KNOWN_LOCK_TIMEOUTS_MS` 순회 `throw`)와 `fires.length < 2` 가드가 실제 Postgres 타이밍과
무관한 순수 동기 로직인데도 여전히 어떤 테스트로도 실행되지 않는다는 점이다. 다른 두 INFO
(N≥3 미검증, 헬퍼 전체 단위 테스트 부재)는 직전 라운드 판단을 그대로 따르되, 이 항목만은
"방금 승격한 방어 자체가 미검증"이라는 점에서 후속 작업 시 우선 고려 대상으로 남긴다.
CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
