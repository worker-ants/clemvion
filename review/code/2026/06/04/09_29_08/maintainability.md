# 유지보수성(Maintainability) 리뷰

## 발견사항

### **[INFO]** `expiresAtSql` 문자열 보간이 파라미터가 아닌 SQL 리터럴 직접 삽입
- **위치**: `agent-memory.service.ts` — `saveMemories` 내 `expiresAtSql` 구성 및 `insertMemory` / `updateMemory` 사용 지점
- **상세**: `expiresAtSql`은 `"now() + INTERVAL '${ttlDays} days'"` 형태로 SQL 문자열 보간을 사용한다. `ttlDays`는 `resolveMemoryTtlDays`를 통해 `Number.isFinite(n) && n > 0`을 통과한 양의 정수로 보장되므로 SQL Injection 위험은 없다. 그러나 이 방식은 바라보는 이에게 직관적으로 안전하다고 느껴지지 않는다. 후속 수정자가 `resolveMemoryTtlDays` 보호막을 제거하거나 다른 경로에서 `ttlDays`를 직접 받는 새 오버로드를 추가할 때 위험 패턴을 무비판적으로 복사할 수 있다.
- **제안**: `ttlDays`를 SQL 파라미터로 바인딩하는 방식(`now() + INTERVAL '1 day' * $N`)으로 변경하면 보안 패턴 일관성이 높아지고, "리터럴을 직접 삽입한 이유"를 설명하는 주석 부담을 없앨 수 있다. 단, PostgreSQL에서 `INTERVAL '$N days'` 형태의 파라미터 바인딩이 드라이버별로 제한적일 수 있으므로 `now() + make_interval(days => $N::int)` 패턴을 사용하는 것이 안전하다.

---

### **[INFO]** `findSimilarFact` SQL이 `findSimilarInBatch`와 `recall` 코드와 중복 유사
- **위치**: `agent-memory.service.ts` — `findSimilarFact` 메서드 (약 460-467행 구간)
- **상세**: `findSimilarFact`의 SQL 본문은 `recall`의 SQL과 `ORDER BY`, `LIMIT`, 반환 컬럼만 다르다. 두 쿼리 모두 `workspace_id / scope_key / dim / embedding IS NOT NULL / expires_at 필터 / cosine 거리` 패턴을 반복한다. 현재 두 개라 관리 가능하지만, 만료 필터 조건이나 캐스트 표현식을 수정할 때 두 곳을 모두 찾아야 한다는 점이 유지보수 부담이다.
- **제안**: 장기적으로 두 쿼리의 공통 WHERE 절 빌더 함수(예: `buildMemoryCosineWhereClause(dim, castExpr)`)를 추출하면 만료 필터 조건의 단일 수정 지점이 확보된다. 현 변경 범위 내에서 즉시 리팩터링하기 어렵다면 두 메서드에 "동형 쿼리 참조" 주석을 추가하는 수준만으로도 인지 부담을 줄일 수 있다.

---

### **[INFO]** `batchSeen` 배열의 선형 탐색이 배치 크기에 비례
- **위치**: `agent-memory.service.ts` — `findSimilarInBatch` 메서드 및 호출 루프
- **상세**: `batchSeen`은 배열이고 `findSimilarInBatch`는 모든 이전 항목을 순회한다. 배치 크기(한 추출 응답에 포함되는 fact 수)는 일반적으로 수~십 개 수준이라 현 구현이 실질 성능 문제를 일으키지는 않는다. 그러나 배열이 아닌 Map 구조로 표현하거나, 이 점을 코드 레벨 주석으로 명시하면 미래 수정자가 불필요한 최적화를 시도하거나 역으로 대형 배치를 추가할 때 주의를 기울일 수 있다.
- **제안**: 현 구현에 `// 배치 크기(보통 < 20)에서 선형 탐색으로 충분` 수준의 주석 추가로 충분하다. 현 규모에서 구조 변경은 불필요하다.

---

### **[INFO]** `scheduleMemoryExtraction` 반환 타입이 `Promise<number | undefined>`로 확장되었으나 호출부 타입 체크가 암묵적
- **위치**: `ai-agent.handler.ts` — `scheduleMemoryExtraction` 반환값 수신 및 `_resumeState` 스프레드 지점
- **상세**: `nextExtractionSeq`가 `undefined`인 경우 `...(nextExtractionSeq !== undefined ? { lastExtractionTurnSeq: nextExtractionSeq } : {})` 스프레드로 키를 삽입하지 않는 패턴은 의도적이나, 이 패턴이 기존 코드베이스의 `_resumeState` 구성 방식과 일관되게 사용되고 있는지 확인이 필요하다. `pendingFormBlock`과 동일한 패턴을 썼으므로 일관성은 있다. 다만 `lastExtractionTurnSeq`를 읽는 측(`prevExtractionSeq` 추출 로직)에서 `typeof state.lastExtractionTurnSeq === 'number'` 가드를 두는 것과 쓰는 측에서 `undefined`면 키를 아예 두지 않는 것이 혼재하는 점이 미묘하다. 두 패턴을 타입 수준에서 명시적으로 정렬하면 가독성이 개선된다.
- **제안**: `_resumeState` 타입 정의에 `lastExtractionTurnSeq?: number`를 명시적으로 추가하고, 읽기 측에서 optional chaining으로 단순화(`state.lastExtractionTurnSeq ?? undefined`)하면 `typeof` 가드 없이 타입 안전하게 처리할 수 있다.

---

### **[INFO]** `resolveMemoryTtlDays` 내 삼항 중첩이 약간 읽기 어렵다
- **위치**: `ai-agent.handler.ts` — `resolveMemoryTtlDays` 메서드
- **상세**: `typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN` 패턴은 기능적으로 정확하나 중첩 삼항이라 한눈에 파악하기 어렵다. 메서드가 짧고 목적이 명확해 전반적인 유지보수성에 큰 영향은 없으나, 표준 유틸 패턴을 쓰면 더 읽기 쉽다.
- **제안**: `Number(raw)` 단독 호출은 `null`, `undefined`, `boolean`, `object`에 대해 각각 `0`, `NaN`, `0/1`, `NaN`을 반환한다. 범용적으로 `const n = Number(raw); if (!Number.isFinite(n) || n <= 0) return undefined;`로 단순화할 수 있다(단, `Number(null) === 0`이 `n > 0` 조건에서 걸러지므로 동일하게 동작).

---

### **[INFO]** `MEMORY_KINDS` Set이 `MemoryKind` 타입과 분리 유지되어 동기화 부담 존재
- **위치**: `agent-memory-extraction.queue.ts` — `MemoryKind` 타입 및 `MEMORY_KINDS` Set 선언
- **상세**: `MemoryKind = 'fact' | 'preference' | 'entity'` 타입과 `MEMORY_KINDS = new Set(['fact', 'preference', 'entity'])` Set이 각각 별도로 선언되어 있다. 새로운 kind 추가 시 두 곳을 모두 수정해야 하며 타입스크립트가 Set과 유니언 타입의 동기화를 강제하지 않는다.
- **제안**: `const MEMORY_KINDS = ['fact', 'preference', 'entity'] as const; type MemoryKind = typeof MEMORY_KINDS[number];` 패턴으로 단일 진실 원칙을 적용하면 kind 추가 시 한 곳만 수정하면 된다. Set이 필요하면 `new Set<string>(MEMORY_KINDS)`로 파생한다.

---

### **[INFO]** 테스트에서 `as never` 캐스트가 과도하게 사용됨
- **위치**: `agent-memory.service.spec.ts` — `new AgentMemoryService(mockDataSource as never, mockLlmService as never)` 등
- **상세**: `as never`는 타입스크립트의 안전망을 전적으로 우회한다. 서비스 생성자가 받는 실제 타입을 mock이 충족하는지 컴파일 시점에 전혀 검증되지 않아, 생성자 시그니처가 변경되어도 테스트가 계속 통과하여 런타임에야 실패를 발견하는 상황이 발생할 수 있다.
- **제안**: `as jest.Mocked<DataSource>` 또는 최소한 `as unknown as DataSource` 패턴을 사용하면 타입 체계를 부분적으로 보존하면서도 mock 목적을 달성할 수 있다. 프로젝트 전반에 `as never` 패턴이 이미 사용되고 있다면 기존 컨벤션에 맞추는 것이 일관성상 낫다.

---

## 요약

이번 변경(AGM-08 증분 추출 watermark, AGM-09 의미기반 dedup, AGM-10 TTL 만료, AGM-11 추출 분류)은 전반적으로 유지보수성이 양호하다. SQL 마이그레이션 파일에는 명확한 설명과 DOWN 스크립트가 포함되어 있으며, 새로운 비공개 메서드(`findSimilarFact`, `findSimilarInBatch`, `insertMemory`, `updateMemory`, `evictExpiredAndOldest`)는 단일 책임으로 잘 분리되었다. `parseExtractionResponse`의 하위호환 처리와 `resolveMemoryTtlDays`의 방어 코드는 명확하다. 주요 개선 여지는 `MemoryKind` 타입과 `MEMORY_KINDS` Set의 이중 선언 동기화 리스크, `expiresAtSql` 리터럴 보간 패턴의 일관성, `findSimilarFact`/`recall` SQL 조각의 중복, 테스트에서의 `as never` 캐스트 정도이며 모두 경미한 수준이다.

## 위험도

LOW
