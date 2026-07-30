# 성능(Performance) 리뷰 — retry_last_turn 재진입 원자 claim (commit b351731f0)

## 변경 범위 요약

실제 diff(`git show b351731f0`)는 매우 좁다:

- `continuation-execution.processor.ts`: 주석만 변경 (기능/성능 영향 없음).
- `retry-turn.service.ts`: `applyRetryLastTurn` 에 조건부 UPDATE 기반 원자 claim 블록 신규 추가 (약 30줄).
- `retry-turn.service.spec.ts`: 신규 유닛 테스트 3건 추가 (프로덕션 성능과 무관, mock 기반이라 실제 I/O 없음).

성능 리뷰는 신규 추가된 원자 claim 쿼리를 중심으로 하되, `applyRetryLastTurn` 전체 흐름(파일에 제공된 전체 컨텍스트)도 함께 점검했다.

## 발견사항

- **[INFO]** 원자 claim UPDATE 추가로 `applyRetryLastTurn` 호출당 DB round-trip 1회가 순증
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:323-339` (`applyRetryLastTurn` 내 `ATOMIC CLAIM` 블록)
  - 상세: 기존에는 `findOneBy`(spawnedRow 조회, :272) → fast-path 상태 체크(in-memory) → `Promise.all`(execution+node 조회, :343) 순으로 순차 round-trip 2회였다. 이번 diff 는 그 사이에 조건부 `UPDATE ... WHERE id=:id AND status='running' AND jsonb_exists(...)` 1회를 추가해 총 3회(순차 2 + 병렬 1그룹)로 늘렸다. 다만 이 메서드는 BullMQ `retry_last_turn` continuation job 당(즉 사용자가 트리거하는 AI 에이전트 재시도 1건당) 정확히 1회만 실행되는 저빈도 경로이고, UPDATE 자체도 PK(`id`) 등치 조건이 선행돼 단일 행 인덱스 히트다. LLM 턴 처리 자체가 수백ms~수초 단위인 것과 비교하면 이 추가 round-trip(수 ms대)의 상대적 비중은 무시할 만하다. 이번 변경의 목적(동시 배달 시 중복 LLM 과금/도구 실행 차단)을 감안하면 정당한 트레이드오프다.
  - 제안: 조치 불필요. 다만 향후 `CONTINUATION_WORKER_CONCURRENCY` 대폭 상향이나 재시도 폭주 시나리오가 실측되면 이 경로의 누적 지연을 재확인할 것.

- **[INFO]** SELECT(`findOneBy`) 후 별도 UPDATE(claim) 이라는 2-round-trip 형태 — claim-first 패턴과 대비
  - 위치: `retry-turn.service.ts:272-274`(선행 `findOneBy`) 및 `:323-332`(claim UPDATE)
  - 상세: 자매 메서드 `claimResumeEntry`(`execution-engine.service.ts:1174`)는 사전 SELECT 없이 조건부 UPDATE 를 곧바로 시도하는 "claim-first" 패턴인 반면, 본 메서드는 SELECT 로 행을 읽고 fast-path 로그를 남긴 뒤 별도 UPDATE 로 claim 한다. 이 구조 자체는 "`_retryState` 가 애초에 없음"(로직 결함 → FAILED 마킹, :295-308)과 "동시 claim 경쟁으로 이미 소비됨"(정상 레이스 → 조용히 discard, :333-339)을 서로 다른 로그·분기로 구분하기 위해 필요해 보인다 — 단일 `UPDATE ... RETURNING` 하나로는 이 두 케이스를 원인 구분 없이 뭉뚱그리게 된다. 저빈도 경로라 실질 영향은 미미하다.
  - 제안: 현행 유지 가능. 두 케이스 구분이 굳이 필요 없다면 단일 `RETURNING` 절 UPDATE 로 round-trip 1회를 더 줄일 수 있으나 우선순위는 낮다.

- **[INFO]** (긍정적 관찰) claim 실패 시 이후 조회를 건너뛰는 순서 배치가 적절함
  - 위치: `retry-turn.service.ts:333-346`
  - 상세: 신규 claim 블록이 `execution`/`node` 를 병렬 조회하는 `Promise.all`(:343-346) **이전**에 배치돼, claim 이 실패(레이스 패배)하면 즉시 반환해 불필요한 쿼리 2건을 회피한다. 신규 코드가 기존 대비 오히려 조기 반환 경로의 쿼리 수를 줄이는 방향으로 잘 배치됐다 — 별도 조치 불필요.

## 카테고리별 점검 결과 (해당 diff 범위)

1. 알고리즘 복잡도 — 신규 코드는 PK 등치 조건의 단일 행 UPDATE, O(1). 그래프 순회(`resumeGraphAfterRetry`) 등 기존 로직은 이번 diff 의 변경 대상이 아니며 복잡도 변화 없음.
2. N+1 쿼리/호출 — 신규 claim 은 job 1건당 1회 호출이며 반복문 내부에 있지 않음. N+1 패턴 없음.
3. 메모리 할당 — 신규 코드에 추가 객체 할당 없음(정적 raw SQL 문자열 1개, 파라미터 객체 소규모).
4. 캐싱 — 해당 없음(캐싱 대상 반복 계산 없음). 기존 `clearLlmDefaultConfigCache` 호출(:489, out of diff)은 이번 변경과 무관.
5. 블로킹 I/O — 신규 쿼리도 `await` 기반 비동기 처리, 동기 블로킹 없음.
6. 불필요한 연산 — 문자열은 로그 템플릿·정적 SQL 조각뿐, O(n²) 누적 패턴 없음.
7. 데이터 구조 — QueryBuilder 사용 적절, 자료구조 오용 없음.
8. 지연 로딩 — claim 을 execution/node 조회보다 먼저 수행해 실패 시 후속 조회를 지연(생략)시키는 형태로, 오히려 바람직한 순서.

`continuation-execution.processor.ts` 는 주석만 바뀌었으므로 성능 관점에서 점검할 대상이 없다. `retry-turn.service.spec.ts` 는 전부 mock 기반 유닛 테스트로 실제 I/O 가 없어 프로덕션 성능에 영향 없음.

## 요약

이번 커밋의 실질 변경분은 `applyRetryLastTurn` 재진입 claim 을 read-then-branch 에서 조건부 UPDATE(compare-and-swap) 로 교체한 것이 전부이며, 성능 영향은 "저빈도 경로에 인덱스 PK 조건의 단일 행 UPDATE 1회 순증" 으로 매우 작고 명확히 국한된다. 이 추가 비용은 동시 배달로 인한 중복 LLM 과금·도구 실행이라는 훨씬 심각한 문제를 닫기 위한 의도된 트레이드오프이며, 호출 빈도(사용자 트리거 AI 재시도 1건당 1회)와 쿼리 형태(PK 등치, 단일 행) 모두 우려할 수준이 아니다. 알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O·데이터 구조·지연 로딩 어느 카테고리에서도 실질적 회귀는 발견되지 않았고, 오히려 claim 실패 시 후속 조회를 생략하는 순서 배치는 긍정적이다.

## 위험도

LOW
