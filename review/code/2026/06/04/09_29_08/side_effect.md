# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `saveMemories` 시그니처에 선택적 파라미터 추가 — 기존 호출자 확인 필요
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`, `saveMemories` 메서드 (diff line ~340)
- 상세: `saveMemories(workspaceId, scopeKey, items, embedCfgSource, ttlDays?)` 로 5번째 파라미터가 추가됐다. TypeScript optional 이므로 기존 4인자 호출자는 컴파일 에러 없이 통과하지만, `processor.ts` 외의 다른 호출 지점이 있다면 `ttlDays=undefined` (= 무만료) 로 묵시 처리된다. 의도된 동작이라면 무해하나, 미래에 해당 호출자들이 TTL 을 써야 하는 시점에 버그로 이어질 수 있다.
- 제안: 모노레포 내 `saveMemories` 의 모든 호출 지점을 grep 해 의도적 무만료 여부가 명시돼 있는지 확인.

### [WARNING] `scheduleMemoryExtraction` 반환 타입이 `void → number | undefined` 로 변경
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`, `scheduleMemoryExtraction` 메서드 (diff line ~1455)
- 상세: 기존에는 `Promise<void>` 였으나 이번 변경으로 `Promise<number | undefined>` 를 반환한다. 내부 private 메서드이므로 외부 API 파괴는 없으나, 동일 클래스 내 다른 위치에서 `await this.scheduleMemoryExtraction(...)` 를 `void` 기대로 호출하는 경우(예: 반환값을 버리는 단일턴 경로 이외의 호출 지점) 가 있다면 watermark 영속이 누락된다.
- 제안: `scheduleMemoryExtraction` 의 모든 호출 위치(핸들러 파일 전체)를 확인해 반환값 처리 일관성 검증.

### [WARNING] `updateMemory` 에서 `expires_at` 을 항상 덮어씀 — 기존 만료 날짜 소실 가능
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`, `updateMemory` private 메서드 (diff line ~519)
- 상세: dedup 갱신 시 `expires_at = ${expiresAtSql ?? 'NULL'}` 로 하드셋한다. 만약 기존 row 에 만료일이 세팅돼 있던 상황에서 새 batch 의 `ttlDays` 가 미설정이면 기존 만료일이 `NULL` (무만료)로 리셋된다. 반대로 이전에 무만료였던 row 가 `ttlDays=14` batch 에서 갱신되면 갑자기 만료일이 붙는다. 두 경우 모두 의도치 않은 만료 상태 변경이다.
- 제안: `expiresAtSql` 이 `null` 일 때 `expires_at = COALESCE(${expiresAtSql}, expires_at)` 처럼 기존 값을 보존하거나, 스펙에서 "갱신 시 TTL 항상 덮어씀" 을 명시적으로 결정해 주석에 남길 것.

### [INFO] `evictOldest` → `evictExpiredAndOldest` 이름 변경 — 호출부 미치는 영향 없음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (diff line ~544)
- 상세: private 메서드 이름 변경이므로 외부 인터페이스에 영향 없다. 단, 기존 `evictOldest` 를 mocking 하던 테스트가 있다면 spy 이름이 깨질 수 있다. 현재 spec 파일에서는 해당 메서드를 직접 spy 하지 않으므로 문제 없어 보인다.
- 제안: 확인 완료.

### [INFO] `parseExtractionResponse` 반환 타입이 `string[] → ExtractedItem[]` 로 변경
- 위치: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` (diff line ~1199)
- 상세: 공개 export 함수의 반환 타입이 변경됐다. 현재 유일한 소비처는 `agent-memory-extraction.processor.ts` 이고 해당 파일도 함께 업데이트됐다. 다른 모듈에서 이 함수를 import 해 `string[]` 로 사용하는 곳이 있다면 타입 오류 발생.
- 제안: 모노레포에서 `parseExtractionResponse` import 지점 grep 으로 누락 업데이트 없는지 확인.

### [INFO] SQL 인젝션 위험 — `expiresAtSql` 이 사용자 입력 경유 없음이므로 안전
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`, `insertMemory` / `updateMemory` (diff lines ~494, 525)
- 상세: `expiresAtSql = "now() + INTERVAL '${ttlDays} days'"` 이 SQL 문자열 인터폴레이션으로 삽입된다. `ttlDays` 는 `resolveMemoryTtlDays` 를 통해 `Math.floor(n)` 양의 정수로 정제되므로 실질적 인젝션 경로는 없다. 그러나 미래에 이 패턴을 복사하는 개발자가 정제 과정을 빠뜨릴 수 있다.
- 제안: `INTERVAL` 파라미터 바인딩(`$N::interval`) 으로 전환하거나 현재 코드에 "정수 강제 보장됨" 주석 보강 권장.

### [INFO] `EXTRACTION_SYSTEM_PROMPT` 상수 변경 — 기존 LLM 호출에 즉시 영향
- 위치: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` (diff line ~1162)
- 상세: 모듈 로드 시점에 상수가 결정되고 이후 런타임에서 변경 불가이므로 글로벌 상태 변경은 아니다. 단, 배포 즉시 모든 신규 추출 job 에 새 프롬프트가 적용된다. 기존 큐에 쌓인 미처리 job 들은 구 프롬프트 없이 새 프롬프트로 실행될 수 있으나, `parseExtractionResponse` 가 구 shape(문자열 배열)에 대한 하위호환 처리를 포함하므로 데이터 무결성은 보존된다.
- 제안: 현재 처리대로 무해.

### [INFO] `batchSeen` 배열 — 함수 로컬 변수로 외부 상태 오염 없음
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts`, `saveMemories` 내부 (diff line ~361)
- 상세: `const batchSeen: { id: string; embedding: number[] }[] = []` 는 `saveMemories` 호출마다 새로 생성되는 로컬 변수다. 전역/인스턴스 상태를 오염시키지 않는다.
- 제안: 이상 없음.

### [INFO] `lastExtractionTurnSeq` 키가 `_resumeState` 에 조건부 추가 — 기존 상태 구조와 병립
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (diff line ~2568)
- 상세: `...(nextExtractionSeq !== undefined ? { lastExtractionTurnSeq: nextExtractionSeq } : {})` 패턴으로 `_resumeState` 스프레드에 조건부 키를 추가한다. `nextExtractionSeq` 가 `undefined` 이면 키가 없는 상태가 유지돼 "전체 추출" 경로로 fallback 된다. 의도된 동작이며 기존 상태 필드에 간섭하지 않는다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 전체적으로 부작용 격리가 잘 설계된 편이다. SQL 마이그레이션은 append-only nullable 컬럼 추가로 기존 row 에 영향이 없고, 주요 로직 변경은 private 메서드 분리와 로컬 변수(`batchSeen`) 를 통해 서비스 인스턴스 공유 상태를 오염시키지 않는다. 다만 두 가지 중간 우선순위 위험이 있다: `saveMemories` 의 5번째 파라미터 추가로 기존 호출자가 의도치 않게 무만료로 동작할 수 있고, `updateMemory` 가 `expires_at` 을 항상 덮어써 기존 row 의 만료일을 소실시키거나 새로 주입할 수 있다. 두 건 모두 즉각적 데이터 손상은 아니지만 만료 정책의 예측 가능성을 낮추므로 스펙 명시 또는 로직 보완이 권장된다.

---

## 위험도

LOW
