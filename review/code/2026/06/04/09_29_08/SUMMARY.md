# Code Review (persistent 고도화, 전 14 reviewer) 통합 보고서

**RISK: MEDIUM · CRITICAL 1 · WARNING 10 · INFO 20**. routing=skipped(전수). 코드 직접 검토.

## CRITICAL/WARNING → 조치
| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| C1 | Database | `expiresAtSql` ttlDays SQL 리터럴 보간 | **파라미터 바인딩 `now() + ($N * INTERVAL '1 day')`** |
| W1 | Side Effect | `updateMemory` expires_at 무조건 NULL 덮어씀(기존 TTL 소실) | **COALESCE/조건부 — ttlDays 없으면 expires_at 미수정** |
| W2 | Database | saveMemories 트랜잭션 부재 | **DataSource.transaction() 래핑** |
| W3 | Concurrency | findSimilarFact→insert TOCTOU(concurrency=2 중복 insert) | **BullMQ jobId dedup(`workspace:scope`)** |
| W4 | Security | processor ttlDays 런타임 타입 미검증 | **typeof number & isFinite 검증** |
| W5~W9 | Testing | dedup UPDATE·evict 순서·resolveMemoryTtlDays·cosineSimilarity·ttlDays 경계 | **테스트 추가** |
| W10 | Requirement | scheduleMemoryExtraction 반환 변경 호출지점 검증 | watermark 영속 확인 |
| I4 | Architecture | batchSeen UPDATE 분기 push 누락(재탐지) | **fix** |
| I7 | Performance | cosineSimilarity sqrt 2회 | sqrt(normA*normB) 1회 |
| I10 | Maintainability | MemoryKind/MEMORY_KINDS 이중 선언 | as const 단일진실 |
| I13 | Testing | resolveScopeKey 공백제거 기대값 | 구현 확인·정합 |

## INFO 보류(followup)
I1 SPEC-DRIFT(AGM-04 scheduleBackgroundBody 표현→전용 큐), I9(V079 CONCURRENTLY 무중단), I2/I3/I5/I12 리팩토링 → followup 백로그.

## 결정
CRITICAL 1 + WARNING(C1/W1/W2/W3/W4 robustness + W5~W9 tests) + I4/I7/I10/I13 fix. SPEC-DRIFT·대형 리팩토링은 followup. fix 후 RESOLUTION + 재테스트.
