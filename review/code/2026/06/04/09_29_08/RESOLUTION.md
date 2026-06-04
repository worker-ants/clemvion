# RESOLUTION — persistent 메모리 고도화 코드 리뷰

대상: `review/code/2026/06/04/09_29_08/SUMMARY.md` (전 14 reviewer, CRITICAL 1 · WARNING 10 · INFO 20).

## 조치 항목 (fix commit `803f9d4e`)

| 리뷰 # | 발견 | 조치 |
|---|---|---|
| C1 | expires_at ttlDays SQL 리터럴 보간 | 파라미터 바인딩 `now() + ($N * INTERVAL '1 day')` (insert/update) |
| W1 | updateMemory expires_at 무조건 NULL 덮어쓰기(TTL 소실, 실버그) | ttlDays set 일 때만 SET, 미설정 시 기존 expires_at 보존 |
| W2 | saveMemories 트랜잭션 부재 | `dataSource.transaction()` 래핑(QueryRunnerLike) |
| W3 | TOCTOU 동시 job 중복 insert | enqueue `jobId=agent-memory:{ws}:{scope}` BullMQ dedup |
| W4 | processor ttlDays 런타임 미검증 | typeof number & isFinite & >0 정규화 |
| W5~W9 | dedup UPDATE·evict·resolveMemoryTtlDays·cosineSimilarity·ttlDays 경계 테스트 | 추가 |
| W10 | scheduleMemoryExtraction 반환 변경 호출지점 | watermark 영속 확인(테스트) |
| I4 | batchSeen UPDATE 분기 push 누락(재탐지, 실버그) | recordBatchSeen 헬퍼로 갱신 반영 |
| I7 | cosineSimilarity sqrt 2회 | `dot/Math.sqrt(normA*normB)` 1회 |
| I10 | MemoryKind/MEMORY_KINDS 이중 선언 | `as const` 단일 진실 |
| I13 | resolveScopeKey `'cust 42'` 기대값 | 조사 결과 NULL byte 라 구현 정합 — 변경 불요 |
| I19/I20 | findSimilarFact DB에러 graceful·watermark 신규0 skip | 테스트 추가 |

### 보류(followup-v2 백로그)
- I1 SPEC-DRIFT(AGM-04 scheduleBackgroundBody 표현 → 전용 큐) — spec 정밀화.
- I9 V079 `CREATE INDEX CONCURRENTLY` 무중단 배포 분리.
- I2(TTL 파싱 서비스 이전)·I3(옵션객체)·I5(cosine SQL 빌더)·I12(_resumeState sub-namespace) 리팩토링.
- §7.1 meta.memory 에 compactedMessages 열거(impl-done W-1).

## TEST 결과
- lint: 통과(`lint-20260604-094850`)
- unit: 통과 — backend **5989 passed** / 0 failed (cafe24 #453 로 해소).
- build: 통과(`build-20260604-095008`)
- e2e: 통과 — 168 passed(`e2e-20260604-095051`). V079 Flyway docker 검증.

## 보류·후속 항목
위 followup-v2 백로그 + 본 PR 은 #459 위 스택. #459 머지 후 rebase.
