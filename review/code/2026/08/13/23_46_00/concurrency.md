# 동시성(Concurrency) 리뷰 결과

## 개요

이번 변경의 실질 코드 표면은 TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해
행 배열이 아니라 `[rows, rowCount]` **튜플**을 돌려준다는 실측 사실을 반영해, 그 결과를 직접
소비하던 8개 지점(execution-engine 2곳, knowledge-base 5곳, auth-oauth 1곳)을
`updateReturningRows()` 공유 헬퍼로 정정한 것이다. 대상 지점은 CAS(compare-and-swap) 락,
advisory-lock 기반 admission 직렬화, 동시 cancel 선점 가드, OAuth state 단일 소비 보장 등
동시성 리뷰의 핵심 표면과 정확히 겹친다.

이 코드(`update-returning-rows.ts`, `auth-oauth.service.ts`, `execution-engine.service.ts`,
`knowledge-base.service.ts`)는 이번 세션의 4번째 ai-review 라운드(`20_36_35`→`22_45_24`→
`23_07_11`→`23_27_48`)를 이미 거쳤고, 직전 concurrency 리뷰(`review/code/2026/08/13/23_27_48/concurrency.md`)
가 동일 소스를 직접 열어 검증해 위험도 LOW 로 판정했다. `git log --name-only` 로 그 라운드
이후 커밋(`443dd91a6`·`f56334c10`·`76203ad63`·`739272702`·`d8ac4cb07`)이 이 4개 소스 파일을
다시 건드렸는지 확인한 결과, 남은 수정은 **stale 주석 제거·EXPECTED 타입 주석 정정·plan
문서 정정**뿐이고 잠금 범위·트랜잭션 경계·SQL·판정 로직은 `23_27_48` 검증 시점과 동일하다
(`739272702` 의 유일한 코드 diff는 `execution-engine.service.ts` 의 stale 주석 4줄 삭제).
따라서 아래는 그 결론을 실측으로 재확인하고, 이번 라운드에 새로 추가된 plan 문서(소급 정정
배너)가 동시성 주장의 신뢰 범위를 부풀리지 않는지에 집중한다.

## 발견사항

- **[INFO]** CAS 락·admission 직렬화·cancel 선점 가드 4곳 모두 판정 로직이 정확히 복원됐다 — 소스 직접 대조로 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer`(현재 소스 기준 2877~2976행, advisory lock + 조건부 UPDATE), `updateExecutionStatus`(현재 소스 기준 8399~8556행, guarded UPDATE `WHERE status IN (...)`); `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `reExtractAll`(트랜잭션 내부 CAS UPDATE)·`reEmbedAll`(714~795행, CAS UPDATE + reset UPDATE); `codebase/backend/src/modules/auth/auth-oauth.service.ts:146-165`(`DELETE ... RETURNING` 단일 소비).
  - 상세: `admitExecutionOrDefer` 는 `pg_advisory_xact_lock(hashtext($1))` 로 workspace 단위 admission 을 이미 직렬화한 상태에서 조건부 UPDATE 결과를 `updateReturningRows(...).length === 1` 로 판정한다(수정 전엔 튜플이라 항상 거짓 → 매번 `deferred` 오판). `updateExecutionStatus` 는 `WHERE status IN (비-terminal)` 가드 UPDATE 결과를 `persisted` 로 반환해 "동시 cancel/완료 레이스에서 진 쪽"을 판별하는데, 수정 전엔 `updated.length > 0` 이 튜플이라 항상 참이라 그 판별 분기가 사문화돼 있었다(다만 `WHERE` 절 자체가 DB 쓰기를 지켜 왔으므로 데이터 유실은 없었다 — 앱이 "자기가 적용했는지 아는 것"만 틀렸다). KB CAS 락 2곳(`reextract_status='idle'`/`reembed_status='idle'`)도 동일 패턴으로 거절 분기가 살아났다. `auth-oauth` 의 `DELETE ... RETURNING` 은 단일 SQL 문이라 그 자체로 원자적이며, 헬퍼는 반환 shape 해석만 정정한다. 네 지점 모두 **SQL·락 범위·트랜잭션 경계는 이번 diff 로 바뀌지 않았고 판정 해석만 바로잡혔다** — 새 락 순서·중첩이 도입되지 않아 데드락 위험이 늘지 않는다.
  - 제안: 없음(정상 동작 복원, correctness 개선).

- **[INFO]** `updateReturningRows` 자체는 부수효과 없는 동기 순수 함수라 새 비동기 경계·경쟁 지점을 만들지 않는다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:36-57`
  - 상세: `Array.isArray(result[0])` 하나로 튜플(`[rows, rowCount]`)과 행 배열을 가른다. I/O·전역 상태·클로저 캡처가 없어 여러 호출부가 동시에 호출해도 상호 간섭이 없다. `detail` 인자가 필수로 강제돼 있어(옵셔널이 아님) 8개 호출부 전부가 실제로 문맥 문자열을 전달하는지도 grep 으로 재확인했다 — 누락 없음.
  - 제안: 없음.

- **[WARNING]** (직전 라운드부터 이어지는 항목, 계속 유효) `updateExecutionStatus` 의 `persisted=false` 동시-cancel 선점 분기가 실제 Postgres 동시 요청으로는 아직 한 번도 관측되지 않았다 — 단, plan 에 이미 정확한 서술로 등재돼 있어 새로 발견된 결함은 아니다.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md` `## 소급 재검증 (2026-08-13 등재)` 블록(`- [ ] **통합 레벨 관측**`, 미완료 체크박스), `plan/in-progress/update-returning-tuple-shape.md` `## 후속` 의 "배포 후 관측" 체크박스 (b)·(c). 코드 근거는 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `updateExecutionStatus`(8545-8549행 `persisted` 계산)와 `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:928,944,966`(`mockDriver.updateExecutionStatus.mockResolvedValueOnce(false)`, 인터페이스 경계 mock).
  - 상세: `retry-turn.service.spec.ts` 는 complete·fail·cancel 세 경로 모두에서 `updateExecutionStatus` 가 `false` 를 반환할 때 `RetryTurnService` 가 emit 을 건너뛰는지 대조군까지 갖춰 검증한다 — 이 부분은 이번 세션 초반에 "mock 안쪽만 검증됐다"는 서술이 두 리뷰어(consistency `23_07_12`, ai-review `23_27_48`)에 의해 잘못 확산됐던 것을, 이번 diff 의 plan 배너(`retry-turn-terminal-guard.md` "소급 정정" 블록)가 grep 실측으로 바로잡아 "단위 커버리지는 처음부터 온전했다"로 정정했다 — 이 정정 자체는 타당하다(직접 grep 확인). 다만 그 정정이 닫는 것은 **`RetryTurnService` 쪽 계약 테스트**뿐이고, 남는 진짜 갭은 그대로다: `updateExecutionStatus` 의 guarded UPDATE 가 **실제 동시 두 트랜잭션**(예: 사용자 Stop 요청과 턴 완료 콜백이 같은 execution row 를 거의 동시에 갱신)에 대해 정말로 한쪽만 `persisted=true` 를 받는지는 unit-mock 도, 지금까지의 e2e 재실행(admission cap 지연 소멸만 실측됨)도 검증하지 않았다. `8332d9a20` 이전에는 이 값이 상수 `true` 였으므로 프로덕션에서 이 분기가 사문화돼 있었다는 사실 자체가, "SQL 의 `WHERE status IN (...)` 가 표준 CAS 패턴이라 이론상 안전하다"는 것과 "실제로 그렇게 동작하는 것이 관측됐다"는 것 사이의 간극을 남긴다. plan 은 이를 정확히 "통합 레벨 관측" 미완료 항목(체크박스 `- [ ]`)으로 등재해 뒀고, `complete/` 이동 전 필수로 표시해 뒀다 — 은폐되지 않았고 회귀도 아니지만, 동시성 정합성 주장의 신뢰 범위가 아직 "코드가 옳아 보인다"에 머물러 있다는 사실은 동시성 리뷰 관점에서 계속 남겨 둘 값어치가 있다.
  - 제안: `plan/complete/` 이동 전, 실제 동시 요청(2개 트랜잭션을 인위적으로 겹치게 하는 통합/e2e 테스트, 또는 배포 후 로그 기반 관측)으로 `persisted=false` 분기가 최소 1회 실제로 타는 것을 확인할 것 — plan 의 "배포 후 관측 (b)/(c)" 항목을 그대로 수행하면 된다. 코드 변경은 불필요.

- **[INFO]** `async`/`await` 누락, 이벤트 루프 블로킹, 콜백 지옥 없음 — 확인.
  - 위치: 리뷰 대상 소비 지점 전체(`update-returning-rows.ts`; `auth-oauth.service.ts:146-152`; `execution-engine.service.ts` `admitExecutionOrDefer`/`updateExecutionStatus`; `knowledge-base.service.ts` CAS 락·재큐·reset 지점).
  - 상세: 모든 `.query()` 호출은 `await` 로 소비된 뒤 결과(`unknown`)가 `updateReturningRows` 로 전달되는 단순 동기 호출이라 새 Promise 체인이나 블로킹 구간이 없다. 스레드/커넥션 풀 크기 설정은 이번 diff 범위 밖이며 변경되지 않았다.
  - 제안: 없음.

## 요약

이번 diff(누적 기준)는 CAS 락·advisory-lock admission 직렬화·동시 cancel 선점 가드·OAuth
state 단일 소비라는 동시성 핵심 표면 4곳에서 실제로 작동하지 않던 판정 로직(튜플을 행
배열로 오인해 상시 고정값을 내던 버그)을 정확히 복원한다. 잠금 범위·트랜잭션 경계·SQL 은
바뀌지 않고 JS 쪽 반환값 해석만 정정됐으며, 새 락 순서나 중첩이 없어 데드락 위험이 늘지
않는다. 직전 라운드(`23_27_48`)의 concurrency 리뷰 이후 이 네 소스 파일에는 주석 정리 외의
실질 변경이 없어 그 결론(LOW, CRITICAL 없음)이 그대로 유효하다. 유일하게 남는 항목은
새 결함이 아니라 **plan 이 스스로 정확하게 등재한 미완료 항목**이다 — `updateExecutionStatus`
의 `persisted=false` 동시-cancel 분기가 실제 동시 요청으로는 아직 관측된 적이 없다는 점으로,
`retry-turn-terminal-guard.md`/`update-returning-tuple-shape.md` 양쪽에 `complete/` 이동 전
필수 항목으로 이미 걸려 있다.

## 위험도

LOW
