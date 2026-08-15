# Performance Review — `16_19_26`

## 대상 요약

핵심 변경은 `finalizeStalledExhausted`(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3340`)의 Execution UPDATE + NodeExecution cascade UPDATE 두 문장을 `dataSource.transaction`으로 묶은 것. 자매 함수 `cancelParkedExecution`/`markWebChatIdleTimeout`과 동형 패턴 재사용이며, 나머지 diff(CHANGELOG/plan/spec/이전 리뷰 산출물)는 문서·테스트 파일로 성능 표면이 없다.

## 발견사항

없음. CRITICAL/WARNING 없음.

### INFO — 트랜잭션 도입으로 커넥션 보유 구간이 소폭 늘어남 (구조적, 새 리스크 아님)

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3354` (`await this.dataSource.transaction(async (manager) => { ... })`)
- 상세: 종전엔 Execution UPDATE·NodeExecution UPDATE 가 각각 독립 autocommit 문장이라 커넥션 풀에서 짧게 잡았다 놓았다. 이제는 `BEGIN`부터 `COMMIT`까지 같은 커넥션을 두 `await` 구간(순차 실행) 동안 붙들고 있는다. 라운드트립 수는 이전 "쿼리 2개 + implicit commit 2회" 대비 "BEGIN + 쿼리 2개 + COMMIT"으로 커밋 횟수가 오히려 2→1로 줄어 순수 처리량 관점에서는 중립~약간 개선이다. 다만 고동시성 상황에서 커넥션을 (짧게나마) 더 오래 점유하는 트레이드오프는 존재한다. 자매 두 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)가 이미 같은 패턴이고, `finalizeStalledExhausted` 자체가 BullMQ stalled 소진(운영 크래시)이라는 저빈도 이벤트 경로라 실질 영향은 무시할 만하다.
- 제안: 조치 불요. 원자성이 이 트레이드오프를 정당화한다. 참고로 NodeExecution cascade UPDATE의 WHERE 절(`execution_id`, `status`)은 database 리뷰어가 이미 `V095__node_execution_exec_status_active_index.sql` composite partial index 커버리지를 확인했다(직전 라운드 `16_04_38` SUMMARY.md INFO #6).

### 확인한 항목 (문제 없음)

- **N+1 없음**: `finalizeStalledExhausted`는 BullMQ `onFailed` 훅에서 execution 당 1회 호출되며(`execution-run.processor.ts:88`), 루프 내부에서 호출되지 않는다. NodeExecution cascade는 단일 UPDATE 문(WHERE `execution_id`)으로 자식 전체를 일괄 처리 — row별 순회 UPDATE 아님.
- **알고리즘 복잡도**: 변경 전/후 모두 O(1) 쿼리 2개. 복잡도 변화 없음.
- **메모리 할당**: `stalledError`, `stalledDurationMs`, `finalized` 등 스칼라/소형 객체만 추가 — 무시할 수준.
- **블로킹 I/O**: 기존과 동일하게 전부 `await` 비동기. 신규 동기 I/O 없음.
- **캐싱**: 해당 없음 — 상태 전이 쓰기 경로라 캐싱 대상이 아니다.
- **문자열 연결/불필요 연산**: 없음.
- **데이터 구조**: 변경 없음.
- **지연 로딩**: 해당 없음(엔티티를 로드하지 않고 SQL 계산 컬럼 `RETURNING`으로 값을 받는 기존 최적화 패턴 그대로 유지).

## 요약

이번 diff 의 실질 코드 변경은 두 UPDATE 문을 단일 트랜잭션으로 묶은 원자성 버그 수정이며, 성능 표면은 거의 없다. 쿼리 개수·인덱스 사용·호출 빈도(저빈도 크래시 복구 경로) 모두 변경 전과 동일하거나 커밋 횟수가 줄어 오히려 미세하게 유리하다. 나머지 파일은 문서/테스트/plan 산출물로 성능 리뷰 대상이 아니다. CRITICAL/WARNING 없음.

## 위험도
NONE
