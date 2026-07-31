# 성능(Performance) 리뷰 — retry_last_turn 원자 claim (2026-07-30 12:56 라운드)

## 리뷰 범위 확인

프롬프트에 제공된 두 파일(`retry-turn.service.ts` 전체, `retry-turn.service.spec.ts` 전체)을
검토했다. 이 브랜치(`main` 대비 `b351731f0` / `414550a1d` / `7a05c6ec8` / `886ca9395` 4개
커밋)의 실질 diff 를 `git diff`로 직접 대조한 결과, **직전 성능 리뷰 라운드
(`review/code/2026/07/30/11_41_20/performance.md`, LOW) 이후 이번 라운드에서 새로 추가된
변경분은 프로덕션 로직에 대한 수정이 전혀 없다**:

- `7a05c6ec8`: `retry-turn.service.ts` 에 대한 변경은 **JSDoc/주석 3건 정정뿐**이다
  (`claimSpawnedRetryRow` 백스톱 서술의 자기모순 해소, `runAiConversationLoop` stale 참조를
  `processAiResumeTurn`/`PARK_RELEASED` 로 정정, `NODE_STARTED` emit payload 의도 명시). 실행
  경로·쿼리·분기 조건·자료구조 어느 것도 바뀌지 않았다.
- `886ca9395`: `retry-turn.service.spec.ts` 에 신규 유닛 테스트 2건만 추가됐다(둘 다 기존
  mock 하니스 재사용, 실제 I/O 없음) — 이미 존재하던 방어 분기(claim 성공+`_retryState` 부재)와
  `NODE_STARTED` payload 형태를 잠그는 behavior-lock 테스트로, 프로덕션 성능과 무관하다.

원자 claim 메커니즘 자체(`claimSpawnedRetryRow` 도입, `applyRetryLastTurn` 삽입 위치)는 이미
`review/code/2026/07/28/20_32_57/performance.md`(위험도 LOW)와
`review/code/2026/07/30/11_41_20/performance.md`(위험도 NONE)에서 상세히 분석·정당화됐다. 아래는
그 결론이 이번 파일 상태에서도 여전히 유효한지 재확인한 결과이며, 신규 발견사항이 아니다.

## 발견사항

- **[INFO]** (재확인, 신규 아님) `claimSpawnedRetryRow` 도입으로 `applyRetryLastTurn` 호출당 DB 왕복 1회 순증 — 여전히 유효하나 이미 검토·정당화됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:538-552` (`claimSpawnedRetryRow` 구현), 호출부 `:371`
  - 상세: `applyRetryLastTurn` 은 spawned row 조회(SELECT, `:292`) → fast-path 상태 체크(in-memory) → 원자 claim(UPDATE, `:371`) → execution/node 병렬 조회(`Promise.all`, `:373-376`) 순으로 최소 3회의 순차 DB 왕복을 거친다. claim 은 `WHERE id = :id`(PK 등치) 조건이 선행돼 단일 행 인덱스 히트이고, `retry_last_turn` 은 사용자가 명시적으로 트리거하는 저빈도 AI 재시도 경로(반복문 내부 호출이 아님)이므로 N+1 패턴은 아니다. 이 결론은 두 차례 이전 성능 리뷰에서 이미 확정됐고, 이번 라운드 diff 는 이 경로를 전혀 건드리지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** (재확인, 신규 아님) `finalizeGuarded` 의 매 종결 호출 시 Execution 재조회(SELECT + UPDATE 2왕복)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:573-678` (`finalizeGuarded`), 특히 `:579`(`findOneBy` 재조회)
  - 상세: `completeRetryExecution`/`failRetryExecution` 종결 경로마다 정본을 다시 읽은 뒤 조건부 UPDATE 를 수행한다. 이 역시 이번 diff 범위(`main` 대비 4개 커밋) 밖의 기존 코드(2026-07-27, `771801e3e`)이며, 루프 내 반복 호출이 아니라 종결 시점 1회 호출이라 N+1 은 아니다. lost-update 방지를 위한 의도된 트레이드오프로 이미 여러 라운드의 concurrency/performance 리뷰를 거쳐 정당화됐다.
  - 제안: 조치 불필요.

- **[INFO]** `resumeGraphAfterRetry` 의 그래프 순회는 그래프 크기에 선형 비례, 이번 diff 대상 아님
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:801-899` (`resumeGraphAfterRetry`)
  - 상세: back-edge 활성화 시 `for (let i = activated.targetIndex; i <= completedPointer; i++) { reachable.delete(...) }` (`:831-833`)는 O(그래프 노드 수)이며 이차 반복은 없다. `loadAndBuildGraph` 로 워크플로 전체 그래프를 매 재진입마다 다시 로드하는 것도 `runExecution`/`resumeFromCheckpoint` 와 동일한 기존 패턴이며 이번 브랜치의 변경 대상이 아니다.
  - 제안: 조치 불필요 — 참고용 확인.

## 카테고리별 점검 (이번 라운드 diff 기준)

1. 알고리즘 복잡도 — 신규 코드 없음(JSDoc/테스트뿐). 영향 없음.
2. N+1 쿼리/호출 — 신규 호출 없음. 기존 `Promise.all` 병렬화(`:373-376`) 그대로 유지.
3. 메모리 할당 — 신규 객체 할당 없음.
4. 캐싱 — 해당 없음.
5. 블로킹 I/O — 해당 없음(신규 코드 없음).
6. 불필요한 연산 — 해당 없음.
7. 데이터 구조 — 해당 없음.
8. 지연 로딩 — 해당 없음.

## 요약

이번 라운드(`review/code/2026/07/30/12_56_04`)에서 프롬프트에 주어진 두 파일에 대해 `main` 대비
실질 diff 를 직접 대조한 결과, 성능에 영향을 줄 수 있는 프로덕션 로직 변경은 **없다** — 이번
브랜치 최신 2개 커밋(`7a05c6ec8`, `886ca9395`)은 각각 JSDoc 정정과 mock 기반 유닛 테스트 추가일
뿐이다. 원자 claim 메커니즘 자체(`claimSpawnedRetryRow`, `applyRetryLastTurn` 삽입 순서)가
호출당 DB 왕복 1회를 순증시킨다는 사실은 여전히 유효하지만, 이는 저빈도·단일 행 인덱스 히트
경로에 대한 의도된 동시성 정합성 트레이드오프로 이미 두 차례(LOW→NONE) 검토·정당화됐고 이번
diff 로 인해 성격이 바뀌지 않았다. 새로 조치가 필요한 성능 발견사항은 없다.

## 위험도
NONE
