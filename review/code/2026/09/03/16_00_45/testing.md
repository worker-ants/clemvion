# 테스트(Testing) 리뷰 — entity nullable 배치 1, 4라운드째 (독립 재검증)

## 컨텍스트

이 diff(`entity-nullable-column-type-mismatch` 배치 1, `codebase/` 실질 변경 14개 파일)는 이미
3라운드 리뷰(`14_44_15` → `15_17_01` → `15_36_03`)를 거쳐 Critical 0 · Warning 0 · LOW 로
수렴했다고 기록돼 있다. 이번 라운드는 그 수렴 주장을 그대로 받아쓰지 않고, 실제 저장소 상태를
직접 열어 재검증한 결과다. 저장소 뮤테이션은 하지 않았다(읽기·테스트 실행만).

## 독립 검증 수행 내역

- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 전문을 `Read` 로
  직접 열었다(프롬프트에서는 크기 제한으로 생략됨). `withFixture`(`os.tmpdir()` 기반, `finally` 에서
  `fs.rmSync(..., { recursive: true, force: true })`)로 전환돼 있어, 1R 이 지적한 "프로덕션
  소스 파일을 `writeFileSync` 로 변형" 문제(W1)가 실제로 해소됐음을 재확인했다.
- 3R RESOLUTION 이 예고한 두 개의 소스 수정을 직접 grep/Read 로 대조했다.
  - `schedules.service.spec.ts` 의 방어 분기 테스트가 실제로 `it('[방어 분기] 다음 실행 계산이
    비면 nextRunAt 을 null 로 명시 대입한다', ...)` 로 제목이 바뀌어 있고, 도달 불가능성·mock
    이유를 설명하는 docstring 이 그 위에 붙어 있다 — 일치.
  - `auth.service.spec.ts` 의 `resetPassword` 성공 경로 테스트에
    `expect(usersService.update.mock.calls[0][0]).toBe('user-uuid');` 가 실제로 추가돼 있다 —
    일치(INFO#5 반영 확인).
- 대상 5개 spec 파일을 직접 실행했다: `npx jest
  src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts
  src/modules/auth/auth.service.spec.ts
  src/modules/schedules/schedule-runner.service.spec.ts
  src/modules/schedules/schedules.service.spec.ts
  src/modules/users/users-login-attempts.service.spec.ts` →
  **Test Suites: 5 passed, Tests: 120 passed** (신규 테스트 5건 포함, ScheduleRunnerService 의
  의도된 에러 로그 출력은 실패한 실행 경로를 검증하는 기존 테스트의 정상 산출물이다).
- `git diff --stat origin/main...HEAD -- codebase/` 로 재확인 — 코드 변경은 14개 파일, 546
  insertions / 22 deletions 로 프롬프트가 준 파일 1~14 범위와 정확히 일치한다. (참고: 세션
  워킹트리 최상단 `git status` 에는 이 브랜치와 무관한 `sessions.service.spec.ts` /
  `users-change-password.e2e-spec.ts` 미커밋 변경이 보이지만, `origin/main...HEAD` diff 에는
  포함되지 않아 이번 리뷰 대상이 아니다 — 별도 작업의 잔여물이다.)

## 발견사항

- **[INFO]** `findCastOffenders` 의 다중 offender 파일(2개 이상) 누적 경로가 여전히 직접
  단언되지 않는다 — 3라운드 연속 동일 항목, 이번 라운드가 새로 만든 갭은 아니다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` —
    `it('캐스트가 있는 파일을 offender 로 잡고, 없으면 통과한다', ...)` (파일 116행 부근)
  - 상세: 매 호출이 `findCastOffenders([file])` 로 배열 원소 1개만 넘긴다. 구현
    (`nullable-type-lie-cast-guard.ts::findCastOffenders`)은 `for (const file of files)` 로
    순회하며 `offenders.push(...)` 하는데, "두 번째 이후 파일도 배열에 정확히 누적되는지"는
    테스트로 고정돼 있지 않다. 실사용 시 `collectScanTargets()` 전체(153개 이상)를 스캔하므로
    실질 위험은 낮지만, 만약 향후 리팩터로 `offenders.push` 대신 `offenders = [...]`(덮어쓰기)
    같은 실수가 들어가도 현재 테스트 스위트로는 못 잡는다.
  - 제안: 우선순위 낮음(3라운드 전부 동일 판단). 두 개 이상의 offender 를 담은 fixture 로
    `toHaveLength(2)` 케이스 1건을 추가하면 이 사각지대가 닫힌다. 급하지 않다 — 이미 plan/
    review 이력에 반복 등재된 항목이라 조치 시점은 다음 편집 때로 미뤄도 된다.

- **[INFO]** 앞선 3라운드 리뷰가 지적·조치한 항목(W1~W5, 3R INFO#1·#5)이 실제로 소스에
  반영돼 있음을 이번 라운드에서 독립적으로 재확인했다 — 새로운 결함 없음.
  - 위치: 위 "독립 검증 수행 내역" 참조.
  - 상세: `null` → `undefined` 회귀를 잡는 5개 신규 테스트(`verifyEmail`·`resetPassword`·
    `resetLoginAttempts`·schedule-runner 무효 cron 분기·schedules.service 재계산 방어 분기)
    모두 `toBeFalsy()` 가 아니라 `toBeNull()` 을 쓰고, 그 이유를 인접 주석으로 남긴다. 이는
    TypeORM `update()` 의 "`undefined` 필드는 SET 절에서 생략" 의미론과 정확히 맞물리는
    올바른 단언 선택이며, 세 라운드에 걸쳐 뮤테이션(코드를 `undefined` 로 되돌려 RED 확인)으로
    검증됐다는 기록과 이번 라운드의 직접 테스트 실행(120/120 PASS) 결과가 모순되지 않는다.
  - 제안: 없음(확인용 기재).

## 강점 (긍정 관측, 3라운드 누적)

- `undefined` 필드 SET-절 생략이라는 실제 TypeORM 동작을 근거로 회귀 클래스를 정확히 짚고,
  `toBeFalsy()` 대신 `toBeNull()` 로 단언해 "값이 falsy 이기만 하면 통과" 하는 흔한 함정을
  피했다 — 세 라운드 모두 독립적으로 확인한 항목이다.
- `nullable-type-lie-cast.spec.ts` 는 `[전제]`(스캔 대상 비어있지 않음·자기 자신 제외) →
  `[대조군]`(술어가 실제로 무는가, positive/negative) → `[예외 경계]`(JoinColumn 컬럼명
  일치/불일치 양방향) 순으로 vacuous PASS 를 구조적으로 차단하는 패턴을 따른다.
- 테스트 격리: `withFixture` 는 매 호출마다 독립된 `mkdtempSync` 디렉터리를 만들고
  `finally` 로 정리해 테스트 간 파일 상태 의존이 없다. `collectScanTargets()` 를 `describe`
  스코프에서 한 번만 호출해 재사용하지만 순수 읽기 전용이라 실행 순서에 안전하다.
- 각 신규 테스트 docstring 이 "왜 필요한가 + 어떤 리뷰 라운드(W-번호)에서 나왔는가" 를
  남겨, 다음 사람이 테스트를 삭제하려 할 때 근거를 즉시 찾을 수 있다.

## 요약

3라운드에 걸쳐 지적된 테스트 커버리지 갭(TypeORM `undefined`-생략 회귀 5곳, 대조군의 프로덕션
파일 변형, 방어 분기 docstring 과잉 서술, id 미검증)이 실제로 소스에 반영돼 있음을 이번
라운드에서 직접 `Read`+`grep`+테스트 실행(120/120 PASS)으로 독립 재확인했다. 이번 라운드가
새로 발견한 Critical/Warning 급 결함은 없다. 유일한 잔여 갭은 `findCastOffenders` 의 다중
offender 누적 경로 미검증(INFO, 3라운드 연속 동일 판단, 실사용 위험 낮음)뿐이며, 이는 이미
plan/review 이력에 반복 등재돼 있어 급하지 않다. 이 리뷰가 다룬 diff 범위(`codebase/` 14개
파일) 밖에서 워킹트리에 다른 작업(`sessions.service.spec.ts`/`users-change-password.e2e-spec.ts`)의
미커밋 잔여물이 관측됐으나, `origin/main...HEAD` 비교 범위 밖이라 이번 등급 판정에는
반영하지 않는다.

## 위험도

LOW
