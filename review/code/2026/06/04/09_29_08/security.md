# 보안(Security) 리뷰 결과

## 발견사항

### 발견사항 1

- **[WARNING]** SQL 인젝션 위험: `expiresAtSql` 문자열 리터럴 SQL 인라인 삽입
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories`, `insertMemory`, `updateMemory` 메서드
  - 상세: `expiresAtSql` 는 `"now() + INTERVAL '${ttlDays} days'"` 형태로 생성된다. `ttlDays` 는 `resolveMemoryTtlDays` 에서 `Math.floor(n)` 으로 정수화되어 `number` 타입만 통과하므로 **현재 구현에서 실제 SQL 인젝션은 발생하지 않는다**. 그러나 이 패턴은 매개변수 바인딩($N)이 아닌 문자열 보간으로 SQL 에 삽입되므로, 추후 `ttlDays` 를 넘기는 경로가 추가되거나 `resolveMemoryTtlDays` 의 반환 타입이 느슨해지면(예: `string` 수용) 인젝션 경로가 열린다. 또한 TypeScript 타입 시스템 밖의 런타임 값(BullMQ job payload `job.data.ttlDays`)이 직접 전달되는 구조라, deserialize 단계에서 검증이 충분하지 않으면 리스크가 현실화된다.
  - 제안: `expiresAtSql` 를 SQL 리터럴 인라인 대신 파라미터 바인딩으로 대체한다. 예를 들어 `expires_at = $N` + `params.push(new Date(Date.now() + ttlDays * 86400_000))` 또는 DB-side `now() + make_interval(days => $N::int)` 등의 parameterized 표현으로 변경한다. `insertMemory` 와 `updateMemory` 모두 적용 필요.

---

### 발견사항 2

- **[WARNING]** BullMQ job payload `ttlDays` 의 런타임 타입 검증 부재
  - 위치: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.ts` — `process` 메서드, `job.data.ttlDays` 구조 분해
  - 상세: BullMQ job data 는 Redis 를 통해 직렬화/역직렬화된다. TypeScript 인터페이스 `AgentMemoryExtractionJob.ttlDays?: number | null` 는 컴파일 타임 타입이며, 런타임에 악의적이거나 잘못된 Redis payload 가 이 필드에 임의 값(문자열, 객체 등)을 넣어도 `AgentMemoryService.saveMemories` 의 `ttlDays` 인자로 그대로 전달된다. `saveMemories` 내 `resolveMemoryTtlDays` 가 아닌 `insertMemory`/`updateMemory` 의 `expiresAtSql` 계산부(`ttlDays != null && ttlDays > 0`)는 `typeof` 검사 없이 숫자 비교만 하므로, 비숫자 값이 들어오면 조건이 false 로 평가되어 `NULL` 처리되어 결과적으로 피해가 제한적이다. 그러나 Redis queue 는 신뢰 경계 밖의 직렬화 저장소이며, 추후 `expiresAtSql` 가 parameterized 로 전환되지 않은 상태에서 비검증 값이 도달하면 위험해진다.
  - 제안: processor 에서 `ttlDays` 를 수신할 때 명시적 런타임 타입 검증(예: `typeof ttlDays === 'number' && Number.isFinite(ttlDays)`)을 수행하거나, `saveMemories` 진입부에서 `resolveMemoryTtlDays` 를 적용한 뒤 `expiresAtSql` 를 계산한다. 현재는 `handler.ts` 의 `resolveMemoryTtlDays` 가 enqueue 전에 정수화하지만, processor 경로에서는 이 검증을 거치지 않는다.

---

### 발견사항 3

- **[INFO]** `resolveScopeKey` 의 512자 해시 축약 — `crypto` 모듈 의존 경로 확인 필요
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `resolveScopeKey` 메서드 (테스트에서 W-1 검증)
  - 상세: 512자 초과 `memoryKey` 를 결정적 해시로 축약하는 로직이 있다. 해시 함수가 SHA-256 계열이면 적절하나, 만약 MD5 또는 기타 취약 알고리즘을 사용한다면 암호화 요구사항(§6) 위반이다. 본 diff 에서 해시 구현 내용이 노출되지 않으므로 INFO 수준으로 기록한다.
  - 제안: `resolveScopeKey` 내 해시 축약에 SHA-256 이상(Node.js `crypto.createHash('sha256')`)을 사용하는지 확인한다. 이 값은 인증 목적이 아니라 scope key 안정화 목적이므로 MD5 도 기술적으로 충분할 수 있으나, 프로젝트 보안 정책상 취약 알고리즘 사용이 감사 항목이 될 수 있다.

---

### 발견사항 4

- **[INFO]** `findSimilarFact` 에러 핸들링: 예외 메시지가 로그에 기록됨
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `findSimilarFact` catch 블록 (라인 459~463)
  - 상세: `error instanceof Error ? error.message : 'Unknown error'` 를 `logger.warn` 으로 출력한다. DB 오류 메시지에 내부 스키마 정보(테이블명, 컬럼명, 쿼리 구조)가 포함될 수 있다. 해당 로그가 외부에 노출되지 않고 내부 서버 로그에만 기록된다면 위험도는 낮다.
  - 제안: 현행 로그 수집 정책이 내부 전용인지 확인한다. DB 오류의 상세 메시지는 `debug` 레벨로, `warn` 에는 일반화된 메시지만 출력하는 방식으로 보완할 수 있다.

---

### 발견사항 5

- **[INFO]** `memoryKey` (사용자 제어 Expression 평가값)의 scope key 격리 의존성
  - 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — 전반, spec §5
  - 상세: `memoryKey` 는 사용자가 워크플로우 config 에서 Expression(`{{ $input.userId }}` 등)으로 제어한다. 스코프 격리는 `workspace_id` 를 항상 필터에 포함하는 것으로 보장한다(AGM-07). 이 설계는 사양상 올바르다. 다만 `resolveScopeKey` 에서 제어문자 제거·길이 제한이 적용되어 있으며, 모든 쿼리가 `workspace_id` 와 함께 parameterized bind 를 사용하는 것이 확인된다. 인젝션 경로 없음 — 현행 구현 충족.
  - 제안: 현행 설계 유지. 향후 `memoryKey` 처리 경로 변경 시 `workspace_id` 격리 불변식 유지를 반드시 확인한다.

---

## 요약

이번 변경은 AI Agent persistent 메모리에 TTL 만료(AGM-10), 증분 추출 watermark(AGM-08), 의미기반 dedup(AGM-09), 추출 분류(AGM-11)를 추가한다. 보안 관점에서 가장 주목할 점은 `expiresAtSql` 문자열이 파라미터 바인딩이 아닌 SQL 인라인 보간으로 삽입된다는 것이다(WARNING 1). 현재는 `resolveMemoryTtlDays` 가 정수 검증을 통과한 값만 enqueue 하므로 실질적 인젝션 가능성은 낮으나, BullMQ Redis payload 경로에서 런타임 타입 검증이 우회될 경우 미래 리스크가 된다(WARNING 2). 하드코딩된 시크릿, 인증 우회, 권한 누락, 알려진 취약 의존성 사용은 이번 diff 에서 발견되지 않았다. 모든 DB 쿼리는 `workspace_id` 격리를 유지하고 있으며 전체 위험도는 낮은 편이나, `expiresAtSql` 의 파라미터 바인딩 전환을 권장한다.

## 위험도

MEDIUM
