# 요구사항(Requirement) Review

## 발견사항

### 기능 완전성

- **[INFO]** 변경 범위가 순수 리팩터링(헬퍼 추출)으로 한정되어 있으며, 세 TTL 분기 테스트(`양수 정수 env → 채택`, `NaN/음수/0 env → default 86400`, `미설정 → default 86400`)는 변경 전후 완전히 동일하게 검증된다. 기능 누락 없음.

### 엣지 케이스

- **[INFO]** `makeAllocatorForTtl()`는 `makeRedisConn()` (client=null)을 사용한다. `makeRedisConn(null)`의 `getClient`는 throw, `getClientOrNull`은 null을 반환하도록 구현되어 있다. TTL 테스트는 생성자에서 `process.env` 파싱만 수행하고 Redis를 호출하지 않으므로 이 stub이 충분하다. 경계값 케이스(`'0'`, `'-5'`, `'abc'`, 미설정)가 `NaN/음수/0` 테스트에 포함되어 있음.
- **[INFO]** `'0'`은 `Number.isFinite(parsed) && parsed > 0` 조건에서 `parsed > 0` 실패로 default 86400으로 처리되며, 테스트는 이를 정확히 검증한다.
- **[INFO]** 부동소수점 값(예: `'3600.7'`)에 대한 엣지 케이스 테스트는 없으나, 이는 기존 테스트에서도 없었던 항목으로 헬퍼 추출 범위에 포함되지 않는다.

### TODO/FIXME

- **[INFO]** 변경 diff 내 `TODO`, `FIXME`, `HACK`, `XXX` 주석 없음. 추가된 `// ttl 분기 검증용 allocator — 연결 없이 env 만 읽으므로 redis stub 은 불필요.` 주석은 설계 의도를 명확히 기술하고 있다.

### 의도와 구현 간 괴리

- **[INFO]** `makeAllocatorForTtl()` 함수명은 "TTL 분기 검증용 allocator 생성"을 표현하며, 실제로 TTL 테스트 3건에서만 사용된다. 주석과 구현이 일치한다.
- **[INFO]** 헬퍼가 블록 내부(`describe('seqKeyTtlSeconds...') {}` 범위)에 정의되어 있어 TTL 검증 외의 테스트 케이스에서 의도치 않게 재사용되지 않는다. 스코프 제한이 올바르다.

### 에러 시나리오

- **[INFO]** `makeAllocatorForTtl()`는 Redis 연결 없이 생성자만 실행하므로 에러 경로는 `process.env` 파싱 실패(NaN/음수/0/undefined) 뿐이며, 이 모두 `DEFAULT_SEQ_KEY_TTL_SECONDS` 분기로 처리된다. 별도 에러 처리가 필요한 시나리오 없음.

### 데이터 유효성

- **[INFO]** `process.env[ENV]` 에 `undefined`, `'abc'`, `'-5'`, `'0'`, `'3600'` 값이 주입되어 `Number()` 파싱 → `Number.isFinite` + `> 0` 조합의 방어 로직을 검증한다. 구현체의 `Math.floor(parsed)` 경로(정수 변환)는 명시 테스트가 없으나, 이는 헬퍼 추출 이전부터 동일했던 상황이다.

### 비즈니스 로직

- **[INFO]** spec(`5-system/4-execution-engine.md §9.2`)은 `EXECUTION_SEQ_TTL_SECONDS` env의 기본값을 `86400(24시간)`으로 명시한다. 구현체 `DEFAULT_SEQ_KEY_TTL_SECONDS = 86_400`과 테스트의 `.toBe(86_400)`이 정확히 일치한다.
- **[INFO]** spec(`5-system/6-websocket-protocol.md §2.2`)의 env override 정책(양수 정수만 채택)이 구현체 `Number.isFinite(parsed) && parsed > 0` 로직으로 충족되며, 테스트가 이를 검증한다.

### 반환값

- **[INFO]** 헬퍼 `makeAllocatorForTtl()`는 `ExecutionSeqAllocator` 인스턴스를 반환하며, 반환 타입 선언(`): ExecutionSeqAllocator`)이 명시되어 있다. 모든 경로에서 인스턴스를 반환한다(생성자 예외 없음).

### 관련 spec 본문 일치 여부 (spec fidelity)

- **[INFO]** 관련 spec 문서:
  - `spec/5-system/4-execution-engine.md §9.2` — `exec:seq:<executionId>` 키, `EXECUTION_SEQ_TTL_SECONDS` env, 기본값 86400, sliding-window TTL 정의.
  - `spec/5-system/6-websocket-protocol.md §2.2` — `seqKeyTtlSeconds` env override 정책(양수 정수만 채택).
  - `spec/5-system/14-external-interaction-api.md EIA-NF-06/07` — 분산 seq monotonic NFR.
  
  테스트 변경은 spec이 정의하는 어떤 요구사항 ID·행위 명세·필드 정의와도 충돌하지 않는다. 기능 검증 범위와 기대값이 spec과 완전히 일치한다.

---

## 요약

변경 대상은 `execution-seq-allocator.service.spec.ts`의 `seqKeyTtlSeconds` 테스트 블록에서 반복되던 `new ExecutionSeqAllocator(makeRedisConn() as unknown as RedisConnectionProvider)` 패턴을 `makeAllocatorForTtl()` 헬퍼로 추출한 순수 리팩터링이다. 세 TTL 분기 테스트(`양수 정수 채택`, `NaN/음수/0 → default 86400`, `미설정 → default 86400`)는 변경 전후 동일하게 동작하며, spec(`§9.2 exec:seq 키 TTL`, `env EXECUTION_SEQ_TTL_SECONDS` 기본값 86400)과 완전히 일치한다. 기능 누락, 엣지 케이스 누락, TODO/FIXME, 의도-구현 괴리, spec 불일치가 없다.

## 위험도

NONE
