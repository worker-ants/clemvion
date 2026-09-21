# 테스트(Testing) 리뷰 — `raceUnderHeldLock()` 동시성 e2e 헬퍼 추출 (2차 라운드)

## 리뷰 범위

`codebase/backend/test/helpers/concurrency.ts` 신설(+9파일 11블록 전환)에 더해, 이번 라운드는
직전 리뷰(`review/code/2026/09/21/20_26_50`)의 WARNING(문서 미반영)·INFO(가드 대기시간이
주석으로만 프로덕션 상수와 연결)를 해소한 후속 커밋(`6b29435ac`)까지 포함한다. 저장소 파일을
직접 `Read`/`grep`으로 열람했고(`concurrency.ts`, `auth-config-`·`schedule-`·
`webauthn-credential-delete-concurrency.e2e-spec.ts`, `PROJECT.md`, plan 파일 전문), 저장소에는
아무것도 쓰거나 고치지 않았다(`git status --short` = 이 리뷰 세션 출력 디렉터리만 untracked).

## 검증한 것

- `PROJECT.md:335-341`에 `raceUnderHeldLock` 소개가 실제로 추가됨 — 직전 라운드 WARNING #1 해소 확인.
- `concurrency.ts:17-24`에 `if (VACUITY_GUARD_MS >= TRIGGER_DELETE_LOCK_TIMEOUT_MS) throw` 가
  모듈 로드 시점 검사로 실제 존재함 — 직전 라운드 architecture INFO #1("주석으로만 연결, 코드로는
  연결 안 됨")을 "검사"로 승격한 것을 확인.
- `_test_logs/e2e-20260921-204122.log`(이번 라운드 재실행분): `Test Suites: 70 passed, 70 total` /
  `Tests: 378 passed, 378 total`, 9개 concurrency 스위트 전부 `PASS` — 문서/가드 변경 후에도
  회귀 없음을 직접 로그로 확인(추정이 아니라 실측).
  `integration-rotate-concurrency.e2e-spec.ts`는 여전히 인라인 `BEGIN`/`Promise.race` 구조를
  유지하고 있음을 grep 으로 확인 — plan §B의 "제외" 결정과 일치.
- `auth-config-`·`webauthn-credential-`·`schedule-delete-concurrency.e2e-spec.ts` 3개 파일 전문을
  직접 열어 diff와 대조 — 도메인 단언(상태 코드, 에러 코드, 감사 카운트, CASCADE 확인 등)이
  한 글자도 바뀌지 않았고 사라진 것은 헬퍼로 이관된 `expect(raced).toBe('pending')` 뿐임을 확인.
  `webauthn` 파일의 두 번째 `it`(서로 다른 credential 2건 동시 삭제, WARNING #4 반증)도 온전히
  보존되어 있고, 두 `it` 은 서로 다른 사용자(`wadel`/`wadel2`)로 격리돼 순서 의존이 없다.

## 발견사항

- **[INFO]** 이번 라운드에서 새로 추가된 "주석 → 검사" 전환 자체(`VACUITY_GUARD_MS >=
  TRIGGER_DELETE_LOCK_TIMEOUT_MS`일 때 throw)를 직접 행사하는 테스트가 없다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts` 19-24번 줄(모듈 최상위 `if`/`throw`).
  - 상세: 이 검사는 "가드 대기 시간의 근거를 검사로 바꿨다"(커밋 `6b29435ac`)는 이번 라운드의
    핵심 수정인데, 현재 값 관계(1500 < 5000)에서는 정상 경로만 타므로 throw 분기 자체는 어떤
    테스트로도 도달하지 않는다. 값이 실제로 역전됐을 때 9개 e2e 스위트가 "모듈 로드 실패"로
    한꺼번에 죽는 것이 의도된 동작(그 자체가 방어 목적)이라 크게 위험하지는 않지만, `fires.length
    < 2` throw 분기(기존에도 미검증, 아래 참고)와 같은 성격의 "작성됐지만 관측되지 않는 방어
    코드"가 하나 더 늘었다.
  - 제안: 조치 불요(YAGNI로 보임). 필요하면 `jest.isolateModules` + 모듈 mock 으로 `Client`
    상수를 일시적으로 바꿔 throw 를 재현하는 저비용 단위 테스트를 헬퍼 전용 스펙 파일로 추가할 수
    있으나, 값이 바뀔 때마다 사람이 갱신해야 하는 하드코딩 기대값이라 실익이 크지 않다.

- **[INFO]** (직전 라운드에서도 지적됐고 이번 라운드 diff에도 그대로 남아 있음) 공유 헬퍼
  `raceUnderHeldLock` 자체에 대한 독립 단위 테스트가 여전히 없다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts` 61-101번 줄(함수 전체).
  - 상세: 9파일 11블록 전부가 정확히 `fires.length === 2`로만 호출하므로 `fires.length < 2`
    throw 분기(66-71번 줄)와 `params`가 생략된 `lock` 호출 경로(`lock.params` undefined)는 실행
    경로상 어떤 테스트로도 도달하지 않는다. 실제 `pg.Client` 트랜잭션/락 타이밍에 의존하는
    함수라 mock 기반 단위 테스트는 오히려 허위 안전감을 만들 수 있어 e2e 간접 검증(음성 대조군
    11 RED, `plan/in-progress/e2e-race-helper.md` 체크리스트)이 더 적절한 선택이라는 이전 판단에
    동의한다.
  - 제안: 조치 불요. `fires.length < 2` 케이스만은 순수 동기 가드라 mocked `Client`(query 스파이만)
    로 저비용 단위 테스트를 추가할 여지가 있으나 필수는 아니다.

- **[INFO]** `fires` 3개 이상(N≥3) 케이스와 `lock.params` 생략 케이스는 JSDoc상 지원한다고
  선언(`@param fires` "2개 이상", `params?: unknown[]`)하지만 실제 11개 호출부 전부 정확히 2개
  thunk + 명시적 `params` 배열만 사용한다.
  - 위치: `codebase/backend/test/helpers/concurrency.ts:47-48`(JSDoc), `:63`(시그니처) vs 11개
    호출부 전체.
  - 상세: `Promise.all`/정렬 계약이 N≥3에서, `locker.query(lock.sql, undefined)` 경로가
    `params` 생략 시 실제로 동작하는지는 코드 리딩상 문제없어 보이나(pg 클라이언트가 두 번째
    인자 `undefined`를 허용) 어떤 테스트로도 확인되지 않는다.
  - 제안: 조치 불요(YAGNI). 3자 이상 겹침이나 무-파라미터 락을 다루는 e2e가 추가될 때 그 자리
    에서 자연히 검증되면 충분하다.

## 확인한 강점 (참고용, 결함 아님)

- **회귀 없음이 이번 라운드에도 실측으로 재확인됐다.** 문서·가드 변경 이후 재실행된
  `_test_logs/e2e-20260921-204122.log`가 `378 passed, 378 total`을 보고하며, 직전 라운드 로그
  (`e2e-20260921-202202.log`, 동일 수치)와 시간차를 두고도 같은 결과다 — 프로덕션 코드 무변경
  전제와 정확히 일치.
- **문서 갭이 실제로 닫혔다.** 직전 라운드 documentation WARNING("다음 작성자가 손으로 복제할 때
  참고할 가이드에 헬퍼가 없다")이 `PROJECT.md`에 실제 반영되어, 이 리팩터의 존재 이유(재발 방지)가
  가이드 레벨까지 완결됐다.
- **손으로 지키던 불변식이 코드로 승격됐다.** `VACUITY_GUARD_MS`와 프로덕션
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS`의 관계가 주석에서 모듈 로드 시점 `throw`로 바뀌어, 프로덕션
  타임아웃이 역전되면 (침묵하는 오탐이 아니라) 즉시 관측 가능한 실패로 전환된다 — 테스트
  용이성/조기 실패 관점에서 명확한 개선.
- **단언 무변경이 3개 파일 전문 대조로도 재확인됐다.** `auth-config-`·`webauthn-credential-`·
  `schedule-delete-concurrency.e2e-spec.ts`를 직접 읽고 diff와 줄 단위로 비교한 결과, 상태
  코드·에러 코드·감사 로그 카운트·CASCADE 부작용 검증 등 도메인 지식이 담긴 단언은 전부 원문
  그대로이며, 두 `it` 블록 간 사용자 격리(`wadel`/`wadel2`)도 유지되어 테스트 격리가 그대로다.
- **Mock 미사용이 여전히 적절하다.** 실제 Postgres 트랜잭션/락으로 겹침을 강제하는 방식이
  이 결함 클래스(동시 삭제 시 감사 중복)를 재현하는 유일하게 신뢰할 수 있는 방법이며, 리팩터가
  이를 그대로 보존했다.

## 요약

이번 2차 라운드는 프로덕션 코드 변경 없이, 직전 라운드가 남긴 WARNING(문서 가이드 미반영)과
INFO(가드 대기시간-프로덕션 타임아웃 관계가 주석 수준)를 각각 `PROJECT.md` 반영과 모듈 로드
시점 `throw`로 실제로 해소했다. 새로 도입된 검사 자체를 직접 행사하는 테스트는 없지만 값이
정상 범위인 한 도달하지 않는 방어 코드 성격이라 낮은 우선순위다. 핵심 리스크(헬퍼가 락/가드를
빠뜨려 조용히 통과시키는 것)에 대한 판별력 있는 증거(음성 대조군 11/11 RED, `Received: "settled"`
확인)와 전체 e2e 회귀 부재(378/378, 이번 라운드 로그로 재확인)는 그대로 유효하다. 남은 갭은
전부 INFO 수준(헬퍼 자체의 독립 단위 테스트 부재, `fires.length<2`/새 `throw` 분기 미검증,
N≥3·무파라미터 락 미검증)이며 착수를 막을 사안이 아니다.

## 위험도

NONE
