# Testing Review

## 발견사항

### **[WARNING]** `saveMemories` TTL 경로 — `expiresAtSql` SQL 인젝션 가능성 테스트 없음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` `insertMemory` / `updateMemory`
- 상세: `expiresAtSql`은 `${ttlDays} days` 형태로 SQL 문자열에 직접 보간된다. `resolveMemoryTtlDays`가 `Math.floor`·`isFinite`·`> 0` 검증으로 숫자를 보호하긴 하나, service 계층에서 `ttlDays`가 직접 전달될 경우(단위 테스트·향후 호출부) 검증 없이 보간된다. 현재 `agent-memory.service.spec.ts`에 `ttlDays`가 음수·0·소수·NaN·문자열로 주어졌을 때 `expiresAtSql`이 null 로 처리되는지 검증하는 케이스가 없다.
- 제안: `saveMemories` 테스트에 `ttlDays = 0`, `ttlDays = -1`, `ttlDays = 0.5` 케이스를 추가해 `expiresAtSql`이 null 이 됨을 검증. 중장기적으로 `insertMemory`/`updateMemory` 내부에서도 `ttlDays > 0 && Number.isInteger(ttlDays)` 재검증 후 보간하는 방어 로직 권장.

### **[WARNING]** `resolveMemoryTtlDays` 전용 단위 테스트 부재
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `resolveMemoryTtlDays`
- 상세: `resolveMemoryTtlDays`는 private 메서드이나 AGM-10 의 핵심 경계 로직(숫자 변환·소수 floor·0 이하 undefined 처리·NaN 처리·문자열 입력)이다. `ai-agent.memory.spec.ts`에 추가된 두 AGM-10 케이스는 `memoryTtlDays: 30` (정상)과 미설정만 검증하고, `memoryTtlDays: 0`, `memoryTtlDays: -5`, `memoryTtlDays: "30"`, `memoryTtlDays: 1.7`(floor → 1), `memoryTtlDays: NaN` 같은 경계값을 커버하지 않는다.
- 제안: `ai-agent.memory.spec.ts`에 위 경계값 케이스를 추가하거나, `resolveMemoryTtlDays`를 모듈 내 순수 함수로 분리해 직접 단위 테스트 추가.

### **[WARNING]** `cosineSimilarity` 순수 함수 전용 단위 테스트 없음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `cosineSimilarity`
- 상세: `cosineSimilarity`는 길이 불일치 → 0, 0-norm → 0, 정상 계산 세 분기를 가진다. `agent-memory.service.spec.ts`에서 이 함수는 `saveMemories` 경로를 통해 간접적으로만 실행된다(mock DB 로 인해 실질 DB path는 실행되지 않음). 특히 `findSimilarInBatch` + `cosineSimilarity` 연동이 올바르게 동작하는지 직접 검증이 없다.
- 제안: `cosineSimilarity` 및 `findSimilarInBatch`를 exports 하거나, `describe('cosineSimilarity')` 블록을 spec 파일에 추가해 길이 불일치·0-norm·동일 벡터(score=1)·직교 벡터(score=0) 케이스를 검증.

### **[WARNING]** `saveMemories` dedup UPDATE 경로 테스트 불완전 — `batchSeen` 경로 미검증
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts`
- 상세: `agent-memory.service.spec.ts`의 기존 테스트는 spec 파일이 binary diff 로 제공되어 전체 내용 확인이 제한적이나, 변경 diff 에서 확인 가능한 신규 테스트는 AGM-09 batch 내 dedup (`batchSeen` + `findSimilarInBatch`) 경로를 직접 커버하지 않는다. DB-side `findSimilarFact`가 row 를 반환했을 때 `updateMemory`가 호출되고 `insertMemory`가 호출되지 않는 경로, 그리고 같은 batch 내 두 번째 항목이 첫 번째와 유사해 batch UPDATE 경로를 타는 케이스가 보이지 않는다.
- 제안: (1) `findSimilarFact` mock 이 id 반환 → `updateMemory` 호출 확인, `insertMemory` 미호출 확인 케이스. (2) 두 항목이 cosine ≥ 0.85 로 유사한 batch 에서 두 번째 항목이 `updateMemory`(첫 row 재갱신)를 타는 케이스.

### **[WARNING]** `evictExpiredAndOldest` 두 단계 삭제 순서 검증 테스트 없음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `evictExpiredAndOldest`
- 상세: `evictExpiredAndOldest`는 (1) TTL 만료 DELETE → (2) FIFO 초과 DELETE 순서가 스펙의 핵심 불변식이다. 현재 테스트에서 두 `dataSource.query` 호출이 올바른 순서로 이루어지는지, 첫 번째가 `expires_at IS NOT NULL AND expires_at < now()` 절을 포함하는지 검증하는 케이스가 없다.
- 제안: `dataSource.query` mock 의 `mock.calls[N]` 로 SQL 문자열을 확인해 두 단계 삭제가 순서대로 실행됨을 검증하는 테스트 추가.

### **[INFO]** `findSimilarFact` 에러 graceful fallback 테스트 부재
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `findSimilarFact`
- 상세: `findSimilarFact`는 DB 에러 시 `null` 을 반환해 INSERT 경로로 진행하는 graceful 처리를 갖는다. 이 경로의 단위 테스트가 없다.
- 제안: `dataSource.query` mock 이 throw 할 때 `saveMemories` 가 정상적으로 INSERT 경로를 타는지 검증 케이스 추가.

### **[INFO]** `AGM-08` 증분 추출 테스트 — `fresh.length === 0` skip 경로 미검증
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts` — AGM-08 테스트
- 상세: AGM-08 테스트는 두 번째 turn 에 새로운 turn 이 있는 정상 경로만 검증한다. watermark 가 설정된 상태에서 신규 turn 이 없을 때(`fresh.length === 0`) `scheduleExtraction`이 호출되지 않고 watermark 가 불변으로 유지되는 경로를 검증하지 않는다.
- 제안: 두 번째 turn 에서 thread 에 신규 turn 이 추가되지 않는 시나리오(또는 watermark 이후 seq 가 없는 상황)에 대한 케이스 추가.

### **[INFO]** `makeJob` 헬퍼에 `ttlDays` 필드 미포함 — 테스트 일관성 경미한 갭
- 위치: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.spec.ts` — `makeJob`
- 상세: `makeJob` 헬퍼는 `AgentMemoryExtractionJob`의 신규 `ttlDays` 필드를 `Partial` 경유로 지원하나, 타입 명시 없이 `job.data.ttlDays = 14` 로 직접 주입하는 방식으로 테스트한다. 헬퍼에 `ttlDays` 파라미터를 포함하면 타입 안전성이 개선된다.
- 제안: `makeJob` 시그니처에 `ttlDays?: number | null` 포함.

### **[INFO]** SQL migration 에 대한 integration 테스트 없음 (기존 정책 범위 내)
- 위치: `codebase/backend/migrations/V079__agent_memory_expires_at.sql`
- 상세: `expires_at IS NULL OR expires_at > now()` recall 필터, `expires_at IS NOT NULL AND expires_at < now()` evict 필터, partial 인덱스 실제 사용 여부는 unit 테스트 레벨에서 mock 으로만 검증된다. 실제 PostgreSQL 에서 마이그레이션 적용 후 동작을 검증하는 integration 테스트가 없다. 이는 본 PR 범위를 넘는 기존 정책 수준이므로 INFO 로 기록.
- 제안: 향후 integration 테스트 환경에서 `expires_at` 필터와 partial index 활용을 검증하는 케이스 고려.

---

## 요약

전체적으로 테스트 커버리지는 주요 happy-path 및 graceful 경로를 잘 커버한다. `parseExtractionResponse` 하위호환(문자열 fallback, kind 결손, dedup), `recall` 격리 파라미터, `resolveScopeKey` 경계값, AGM-10/AGM-11 processor 전달 경로는 충실히 검증된다. 그러나 신규 핵심 로직인 (1) `expiresAtSql` SQL 인젝션 방어 경계값 테스트, (2) `resolveMemoryTtlDays` 경계값 직접 검증, (3) `cosineSimilarity`/`findSimilarInBatch` 순수 함수 단위 테스트, (4) `saveMemories` dedup UPDATE + batch dedup 경로 직접 검증, (5) `evictExpiredAndOldest` 두 단계 순서 검증이 부재하거나 불충분하다. 이 중 SQL 보간 검증과 dedup UPDATE 경로 미검증이 가장 중요도가 높다.

## 위험도

MEDIUM
