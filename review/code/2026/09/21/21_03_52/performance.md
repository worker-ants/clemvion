# 성능(Performance) 코드 리뷰

## 범위

이번 diff 는 `codebase/backend/src/**` 변경이 0인 순수 테스트 리팩터다. 아홉 개 e2e 동시성 spec
파일(11 블록)에 손으로 복제돼 있던 `BEGIN → 락 쿼리 → 두 요청 발사 → Promise.race 공허성 가드
(1.5초) → COMMIT → 결과 반환, finally: ROLLBACK + pending 흡수` 블록을
`codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock()` 하나로 추출했다.
호출부 diff 는 인라인 코드를 헬퍼 호출로 치환할 뿐이며, 락 SQL·발사 thunk 개수(항상 2개)·정렬
로직·단언은 그대로 유지된다. `PROJECT.md`(가이드 갱신)·`plan/in-progress/e2e-race-helper.md`
(작업 plan)도 diff 에 포함되어 있으나 코드가 아니므로 성능 관점 분석 대상이 아니다.

`review/code/**`, `review/consistency/**` 하위의 이전 라운드 산출물(`SUMMARY.md`, `meta.json`,
`_retry_state.json` 등)도 프롬프트에 diff 로 실려 있으나, 이번 세션이 만든 리뷰 보고서 자체이지
프로덕션/테스트 코드가 아니므로 성능 리뷰 대상에서 제외했다. `git diff origin/main` 으로
`webauthn-credential-delete-concurrency.e2e-spec.ts`(프롬프트에서 diff 가 생략된 파일)와
`codebase/backend/test/helpers/concurrency.ts` 전체 내용을 직접 열어 확인했다 — 저장소 파일은
쓰지 않았다(`git status --short` 에 이번 리뷰로 인한 변경 없음).

## 발견사항

- **[INFO]** 공허성 가드의 `setTimeout` 타이머가 "settled" 분기가 이겨도 정리(clearTimeout)되지 않는다
  - 위치: `codebase/backend/test/helpers/concurrency.ts` (`raceUnderHeldLock` 함수 본문,
    `Promise.race([...])` 블록 — 원본 파일 99~104번째 줄. 리팩터 전에는 9개 spec 파일 각각에
    동일한 형태로 11회 복제돼 있던 패턴으로, `git diff origin/main` 상 삭제된 인라인 블록에서도
    같은 미정리 `setTimeout` 을 확인했다(예: 이 프롬프트의 파일 2 diff `-setTimeout(() => resolve('pending'), 1_500)`)
  - 상세: `Promise.race([pending.then(...), new Promise((resolve) => setTimeout(resolve, VACUITY_GUARD_MS))])`
    에서 `pending` 이 먼저 끝나(가드 실패 경로) `'settled'` 이 이기더라도, 아직 살아있는
    `setTimeout` 타이머 참조를 저장하지 않으므로 `clearTimeout` 을 호출할 수 없다. 실제로는
    가드가 **실패해야만** 이 분기를 타고, 가드 실패는 `expect(raced).toBe('pending')` 에서 즉시
    테스트를 RED 로 만들기 때문에 실무 영향은 거의 없다(그 테스트는 어차피 실패해 종료 절차로
    넘어간다). 다만 가드가 정상 통과(`raced === 'pending'`)하는 다수의 정상 경로에서도, 뒤이어
    `pending` 이 실제로 `settled` 될 때까지는 타이머가 이미 발화(1.5초 시점)해 종료돼 있으므로
    누적되는 리소스는 아니다 — 즉 이 자체는 반복 실행돼도 누적 누수로 이어지지 않는, 단일 호출당
    최대 1.5초짜리 미정리 타이머 하나에 그친다. 이번 리팩터가 이 패턴을 **새로 만든 것이 아니라
    9개 파일에서 그대로 옮겼을 뿐**이라 회귀는 아니다.
  - 제안: 필수는 아니다. 원한다면 `setTimeout` 의 핸들을 변수에 저장해 두고 `race` 이후
    `pending` 이 이겼을 때(`raced === 'settled'`) `clearTimeout` 을 호출해 두면, 가드 실패로
    조기 종료되는 케이스에서 불필요하게 살아있는 타이머 하나를 줄일 수 있다. 우선순위는 낮다.

## 확인했으나 결함 아닌 것 (근거만 기록)

- **N+1 없음**: `fires.map((fire) => fire())` 는 여전히 정확히 2개(대부분) 또는 명시적으로
  전달된 개수만큼만 동시에 발사한다 — 반복문 안에서 DB/API 를 추가로 호출하는 패턴이 아니다.
  원본 인라인 코드의 `Promise.all([fireDelete(), fireDelete()])` 와 동일한 동시성 형태다.
- **알고리즘 복잡도**: 헬퍼 전체가 상수 시간 오케스트레이션(고정 쿼리 1회 + 고정 개수 발사 +
  1회 race)이라 입력 크기에 의존하는 복잡도가 없다. 모듈 최상단의
  `for (const [name, timeoutMs] of KNOWN_LOCK_TIMEOUTS_MS)` 검증 루프도 원소 1개(현재)로,
  모듈 로드 시 1회만 실행되는 상수 비용이다.
  (`codebase/backend/test/helpers/concurrency.ts:12-14`, `:29-36`)
- **불필요한 객체 생성 없음**: 정렬(`.sort(...)`)은 호출부에 그대로 남아 결과 배열 하나만
  in-place 정렬한다. 헬퍼가 결과를 복사·재가공하지 않는다(`@returns` 명시: "정렬하지 않는다").
- **블로킹 I/O**: 모든 DB 쿼리(`BEGIN`/락 쿼리/`COMMIT`/`ROLLBACK`)는 `await` 로 비동기 처리되며,
  이는 리팩터 전후 동일하다 — e2e 테스트 특성상 동기 블로킹 호출이 아니다.
  프로덕션 요청 경로(hot path) 코드 변경이 없으므로 실제 서비스 성능에 영향 없음.
  Jest 전체 실행 시간 관점에서도 락 유지 구간의 타이밍(1.5초 가드 대기 등)이 그대로 보존돼
  스위트 실행 시간이 늘거나 줄지 않는다.
  - 요청/응답 흐름을 살펴보면 각 delete-concurrency 스위트는 여전히 스위트당 순차적으로
    한 번씩만 헬퍼를 호출한다(11개 호출부 각 1회). 스위트 간 병렬화 여부는 Jest 설정에
    달려 있고 이번 diff 로 변경되지 않았다.

## 요약

프로덕션 코드 변경이 없는 순수 테스트 헬퍼 추출로, 성능에 영향을 주는 알고리즘·N+1·캐싱·블로킹
I/O·자료구조 변경이 전혀 없다. 유일하게 언급할 만한 점은 공허성 가드의 `setTimeout` 이 승자
분기가 정해져도 명시적으로 clear 되지 않는다는 것인데, 이는 리팩터 전 9개 파일에 이미 있던
패턴을 그대로 옮긴 것이고 누적 누수로 이어지지 않아 영향이 미미하다. 종합적으로 성능 관점에서
실질적 위험은 없다.

## 위험도

NONE
