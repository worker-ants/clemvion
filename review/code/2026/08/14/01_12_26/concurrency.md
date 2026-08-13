# 동시성(Concurrency) 리뷰 결과

## 사전 확인

이 diff(`origin/main...HEAD`)의 핵심은 `UPDATE`/`DELETE ... RETURNING` 이 TypeORM 0.3.31 + pg 조합에서
`[rows, rowCount]` **튜플**을 돌려주는데, 8개 소비 지점이 이를 행 배열로 오인해 처리하던 결함을
`updateReturningRows` 헬퍼(`codebase/backend/src/common/utils/update-returning-rows.ts`)로 일원화해
고친 것이다. 이 8곳 중 다수가 **동시성 제어 메커니즘 자체**(admission cap gate, CAS 락, 동시 cancel
가드, OAuth state 1회 소비)였기 때문에 동시성 리뷰 관점에서 직접 대상이 된다. 아래는 각 지점을 코드
레벨에서 직접 확인한 결과다.

## 발견사항

없음(CRITICAL/WARNING). 아래 2건은 INFO로, 이미 plan에 추적 중인 잔여 관측 항목이다.

- **[INFO]** 동시성 제어 지점(admission cap 게이트, KB CAS 락, terminal guarded UPDATE)의 수정이
  전부 **mock 기반 unit test + mutation 사살**로만 검증됐고, 실제 두 트랜잭션을 동시에 발사해 하나가
  거절당하는지 확인하는 진짜 concurrent-transaction 레벨 검증은 아직 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`admitExecutionOrDefer`, 함수 시작 L2877 / advisory lock L2915 / 튜플 언랩 L2942-2947;
    `updateExecutionStatus` 의 guarded UPDATE, 튜플 언랩 L8545-8549) ·
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
    (`reExtractAll` CAS 언랩 L345-348, `reEmbedAll` CAS 언랩 L720-729·L739-755)
  - 상세: `admitExecutionOrDefer`는 `pg_advisory_xact_lock` + 조건부 UPDATE 로 TOCTOU 를 이미 닫아둔
    설계이고, KB CAS 락·guarded UPDATE 도 단일 UPDATE 문의 행 잠금만으로 원자성이 보장되는 패턴이라
    로직 자체는 건전하다. 다만 이번 fix 가 실제로 "거절 분기를 살려냈다"는 주장은 지금까지 mock 이
    반환하는 고정 shape(`[[{id}],1]` / `[[],0]`)로만 검증됐지, 두 요청이 실제 Postgres 커넥션 풀에서
    동시에 같은 행을 갱신 시도했을 때 한쪽이 실제로 0행을 받는지는 확인된 적이 없다. `plan/in-progress/retry-turn-terminal-guard.md`(L50-58, "통합 레벨 관측")와
    `plan/in-progress/update-returning-tuple-shape.md` 의 §후속에 이미 배포 후 관측 항목으로
    등재돼 있어 새로 발견한 결함은 아니며, 별도 조치를 요구하지 않는다(관측 완료 전 `complete/` 이동
    보류로 이미 게이팅됨).
  - 제안: 이미 plan 에 등재된 대로 배포 후 로그/메트릭으로 `persisted=false`·`KB_REEMBED_IN_PROGRESS`
    409·admission 거절이 실제로 발동하는지 1회 관측하면 닫힌다. 코드 변경은 불필요.

- **[INFO]** OAuth state 소비 e2e(`codebase/backend/test/auth-oauth-callback.e2e-spec.ts`)의
  "같은 state 재사용 → 거절" 테스트가 **순차 재사용**만 검증하고, 코드 주석이 말하는 "동시 콜백 중
  하나만 승리"를 실제 동시 요청(`Promise.all`)으로는 검증하지 않는다.
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` (`같은 state 재사용 → 거절` 테스트,
    `first`/`second` 를 순차 `await` — 파일 내 `first`/`second` 검색으로 확인 가능) /
    `codebase/backend/src/modules/auth/auth-oauth.service.ts:L163-164`
    (`// Atomically consume the state row — only one concurrent callback wins.`)
  - 상세: `DELETE ... RETURNING` 단일 문장이 Postgres 행 잠금으로 원자성을 제공하므로 순차 재사용
    테스트로도 "1회만 소비된다"는 결과 자체는 충분히 검증된다. 다만 주석이 명시한 "concurrent" 라는
    표현과 테스트가 실제로 재현하는 시나리오(순차) 사이에 간극이 있어, 나중에 이 테스트만 보고
    "동시 레이스가 실측됐다"고 오인할 여지가 있다.
  - 제안: 필수는 아님 — 원한다면 두 콜백을 `Promise.all` 로 동시에 쏘아 "정확히 하나만 성공"을
    단언하는 테스트를 추가하면 주석과 테스트 범위가 정확히 일치한다.

## 요약

이번 diff는 동시성 제어 코드(advisory-lock 기반 admission 게이트, KB CAS 락, 동시 cancel 가드,
OAuth state 원자적 소비)를 **새로 도입한 것이 아니라, 이미 존재하던 원자적 UPDATE/DELETE 패턴이
드라이버의 실제 반환 shape(`[rows, rowCount]` 튜플)을 잘못 해석해 거절 분기가 전부 사문화돼 있던
결함을 고친 것**이다. 언랩 헬퍼(`updateReturningRows`)의 shape 판별 로직(`Array.isArray(result[0])`)을
직접 추적한 결과 튜플/비-튜플 두 경우 모두 정확히 구분되며, 각 소비 지점(advisory lock 트랜잭션 내부
throw→rollback, 트랜잭션 밖 UPDATE 의 관측 가능한 실패 전환)의 예외 처리도 기존 설계 의도와 일치한다.
새로 도입된 데드락·레이스·이중 락·await 누락은 발견되지 않았다. 남은 것은 이미 plan 에 등재된 "실제
동시 트랜잭션으로 재검증" 관측 항목뿐이며 이는 이번 코드 변경의 결함이 아니라 배포 후 확인 절차다.

## 위험도

LOW
