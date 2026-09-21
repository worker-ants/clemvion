# 요구사항(Requirement) 리뷰 — `raceUnderHeldLock()` e2e 동시성 헬퍼 추출

## 검토 범위 요약

`codebase/backend/test/helpers/concurrency.ts` 신설 + 아홉 파일(11 블록)의 `BEGIN → 락 →
Promise.all(발사) → 1.5초 공허성 가드 → COMMIT → finally(ROLLBACK+drain)` 보일러플레이트를
`raceUnderHeldLock()` 호출로 치환하는 순수 리팩터. `codebase/backend/src/**` 변경 0,
`spec_impact: none`. 각 파일에서 실제 diff(신규 파일 import 1줄 + 블록 치환)를 원본과 대조했다.

## 발견사항

- **[INFO]** `raceUnderHeldLock()` 의 `@throws` 문서가 공허성 가드 실패 경로만 서술
  - 위치: `codebase/backend/test/helpers/concurrency.ts:28` (`@throws 공허성 가드 실패 시 …`)
  - 상세: 실제로 이 함수는 그 외에도 `fires.length < 2` 검증 실패(43-48행), `locker.query('BEGIN'/lock.sql)` 자체의 실패로도 던질 수 있다. 문서가 "의도된" 주 실패 경로만 짚고 부수 실패 경로는 암묵적으로 남겨둔 것이라 오독 위험은 낮다(테스트 전용 내부 헬퍼이고 실제 호출부 11곳 모두 정적으로 `fires.length === 2`).
  - 제안: 필요하면 `@throws` 를 "락 획득/공허성 가드/입력 검증 실패 시" 정도로 넓혀도 되지만, 이 PR 을 막을 사안은 아니다.

- **[INFO]** 관련 spec 문서 부재 (spec fidelity 회색지대)
  - 위치: `spec/` 전체 grep — `raceUnderHeldLock`·`공허성 가드`·"동시성 e2e" 매칭 0건, `spec/conventions/` 에도 e2e 테스트 구조를 규정하는 문서 없음
  - 상세: 이 변경은 테스트 인프라(헬퍼 추출)로, 사용자에게 보이는 API·비즈니스 규칙·에러 코드·상태 전이를 하나도 바꾸지 않는다. 각 e2e 파일이 보호하는 실제 비즈니스 계약(예: `trigger.deleted` 감사 유일성, `spec/2-navigation/1-workflow-list.md` §2.6 대칭 등)은 이번 diff 에서 단언 문구가 단 하나도 바뀌지 않았다 — `plan/in-progress/e2e-race-helper.md` §체크리스트가 "사라진 것은 `expect(raced).toBe('pending')` 11건뿐"이라 명시하고, 실제 unified diff 대조로도 확인된다. `spec_impact: none` 선언 및 동봉된 `--impl-prep` consistency-check(`review/consistency/2026/09/21/19_59_55/SUMMARY.md`, BLOCK:NO·Critical 0·Warning 0)와 일치한다.
  - 제안: 조치 불요 — spec 누락이 아니라 spec 이 관여할 층이 아님(테스트 하네스).

## 기능 완전성 / 엣지 케이스 / 반환값 / 에러 시나리오 점검 결과

- **1:1 동치성**: 9개 파일 각각의 원본 try/BEGIN/lock/Promise.all/race/COMMIT/finally 블록을 헬퍼 시그니처(`locker, {sql, params}, fires[]`)로 치환한 결과가 라인 단위로 대조 가능했다 — 락 SQL 문자열·params·발사 thunk·대기 1.5초·finally 의 ROLLBACK-no-op-comment 까지 전부 원본 그대로 헬퍼 내부로 이동했고, 호출부에는 정렬(`.sort()`)과 단언(`expect(...)`)만 남았다. 헬퍼 자체가 결과를 정렬하지 않는다는 계약(`@returns` 주석)도 실제 구현(`return await pending`, 정렬 없음)과 일치하며 모든 호출부가 각자 정렬을 수행한다.
- **엣지 케이스**: `fires.length < 2` 가드 신설(원본엔 없던 방어적 코드, 실행 경로엔 영향 없음 — 11개 호출부 전부 정적으로 2개). `pending` 이 `BEGIN`/lock 쿼리 실패로 `undefined` 로 남는 경우 `finally` 의 `pending?.catch(...)` 가 optional chaining 으로 안전하게 스킵 — 원본 9파일의 동일 패턴과 동일.
- **webauthn 두 번째 블록**(서로 다른 `idA`/`idB` 대상)만 유일하게 "같은 thunk 두 번"이 아니라 "서로 다른 thunk 배열"이다. 헬퍼 시그니처(`Array<() => Promise<T>>`)가 이 비대칭 케이스를 올바르게 수용하는지 실제 코드로 확인 — `[() => fireDelete(idA), () => fireDelete(idB)]`, 정상.
- **반환값**: 모든 코드 경로(정상 완료/가드 실패/쿼리 실패/입력 검증 실패)에서 `T[]` 를 반환하거나 예외를 던지며, `undefined` 를 암묵 반환하는 경로 없음.
- **회귀 방지 증거**: 동봉된 `plan/in-progress/e2e-race-helper.md` 체크리스트가 "락 쿼리를 `void lock` 으로 바꾸는 음성 대조군 뮤턴트 → 예측 11 RED / 실측 11 RED, 실패 사유까지 `Received: 'settled'`로 확인(엉뚱한 이유로 죽은 RED 아님)" 이라는 구체적 실측을 기록 — 이 리팩터가 "조용히 거짓 초록으로 약해지는" 위험을 정면으로 검증한 근거다. TEST WORKFLOW 절도 "e2e 378 PASS, 리팩터 전과 같은 수" 로 회귀 없음을 뒷받침.
- **TODO/FIXME**: 변경 파일 전체(`concurrency.ts` + 9개 spec + plan) grep 0건.
- **plan 체크리스트 정합**: `/ai-review`·`--impl-done`·트래커 이관 3항목이 미체크 상태로 정확히 남아있고(실제로 이 리뷰가 그 첫 항목을 수행 중), 완료 처리 없이 진행 중임을 정직하게 반영.

## 요약

`raceUnderHeldLock()` 추출은 9개 파일 11개 블록의 동시성 e2e 보일러플레이트를 기능적으로 동일하게(단언 문구 무변경) 옮긴 순수 리팩터다. 각 diff 를 원본과 라인 단위로 대조한 결과 락 SQL·params·발사 순서·1.5초 공허성 가드·finally 청소 로직이 모두 정확히 이전됐고, 유일한 비대칭 케이스(webauthn 서로 다른 credential 삭제)도 배열 기반 `fires` 시그니처로 올바르게 수용됐다. 코드 자체가 아니라 이 리팩터의 실질적 위험(공허성 가드가 조용히 죽는 것)을 저자가 직접 음성 대조군 뮤턴트(락 제거 → 11/11 RED, 원인까지 확인)로 검증해 뒀다는 점이 특히 신뢰도를 높인다. spec 변경이 없고(`spec_impact: none`) 이를 뒷받침하는 `--impl-prep` consistency-check 도 Critical/Warning 0 으로 수렴했다. CRITICAL/WARNING 발견 없음 — 남은 INFO 2건은 조치 불요 수준.

## 위험도
NONE
