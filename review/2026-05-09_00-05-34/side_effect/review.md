## 발견사항

---

### [WARNING] Redis publish 실패 시 continuation 이벤트 소실

- **위치**: `execution-engine.service.ts` — `continueExecution`, `cancelWaitingExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`
- **상세**: 5개 진입점 모두 `void this.continuationBus.publish(...)` 패턴으로 변경됨. Redis 다운 등으로 `publish` Promise가 reject되면 에러가 완전히 삼켜지고, 해당 execution은 WAITING_FOR_INPUT 상태에 영구 잔류함. 이전 코드는 단일 인스턴스 내에서 동기적으로 resolve를 완료했기 때문에 인프라 장애 시 더 빠른 실패가 가능했음.
- **제안**: `void` 대신 에러만 catch해서 로깅하는 래퍼 사용.
  ```typescript
  this.continuationBus.publish({ ... }).catch((err) =>
    this.logger.error(`bus.publish failed for ${executionId}: ${err.message}`)
  );
  ```

---

### [WARNING] 목록 API의 `executionPath` 침묵 파괴 (Silent Breaking Change)

- **위치**: `executions.service.ts:265` — `toExecutionDto`
- **상세**: `executionPath: execution.executionPath ?? []` → `executionPath: []`로 변경. 기존에 목록 응답(`GET /executions`)의 `executionPath` 필드를 소비하던 프론트엔드/외부 클라이언트는 항상 빈 배열을 받게 됨. 단건 조회(`findById`)만 실제 데이터를 반환함. API 스펙에 문서화되어 있으나, 스키마 타입은 동일(`string[]`)하므로 런타임 오류 없이 조용히 버그가 생길 수 있음.
- **제안**: 프론트엔드 코드에서 목록 응답의 `executionPath`를 참조하는 곳이 있는지 확인 필요. 또는 목록 DTO에서 해당 필드 자체를 제거하거나 `undefined`로 명시해 의미 차이를 타입 레벨에서 강제.

---

### [WARNING] Recovery lock TTL과 실행 시간 불일치

- **위치**: `execution-engine.service.ts` — `RECOVERY_LOCK_TTL_SECONDS = 60`
- **상세**: 분산 lock TTL이 60초로 고정됨. 운영 DB에서 `recoverStuckExecutions`의 UPDATE가 60초를 초과하면 lock이 만료되어 다른 인스턴스가 동시에 recovery를 시작할 수 있음. `staleThreshold(30분)`이 2차 가드 역할을 하므로 데이터 오손은 없지만, 동일 row를 두 인스턴스가 동시에 UPDATE하는 불필요한 부하가 발생함.
- **제안**: TTL을 충분히 크게 (예: 300초) 설정하거나, recovery 완료 후 명시적으로 lock을 해제하는 패턴(`DEL`) 추가 검토.

---

### [WARNING] `FakeRedis`에 `set()` 메서드 누락

- **위치**: `continuation-bus.service.spec.ts` — `class FakeRedis`
- **상세**: `ContinuationBusService.acquireLock`은 `this.publisher.set(key, ..., 'NX')`를 호출하지만 `FakeRedis`에 `set()` 구현이 없음. 현재 spec 파일은 `acquireLock`을 직접 테스트하지 않으므로 실패하지 않으나, 향후 테스트 추가 시 `TypeError: this.publisher.set is not a function` 으로 예기치 않게 실패함.
- **제안**: `FakeRedis`에 최소 구현 추가:
  ```typescript
  private store = new Map<string, string>();
  async set(key: string, value: string, ...args: unknown[]): Promise<string | null> {
    const nx = args.includes('NX');
    if (nx && this.store.has(key)) return null;
    this.store.set(key, value);
    return 'OK';
  }
  ```

---

### [WARNING] `select + order` 조합에서 TypeORM 버전별 동작 차이 가능성

- **위치**: `executions.service.ts:110-113`
- **상세**: `executionNodeLogRepository.find({ select: { nodeId: true }, order: { id: 'ASC' } })`에서 `id`가 `select`에 포함되지 않고 `order`에만 사용됨. PostgreSQL은 비선택 컬럼으로 ORDER BY를 허용하지만, TypeORM의 일부 버전은 `select` 옵션과 `order` 옵션이 충돌할 때 `id`를 암묵적으로 SELECT 목록에 추가하거나 쿼리를 잘못 생성할 수 있음.
- **제안**: `select: { nodeId: true, id: true }`로 명시하거나, `select`를 사용하지 않고 이후에 `map(r => r.nodeId)` 처리 유지.

---

### [INFO] `acquireLock`의 lock value로 `process.pid` 사용

- **위치**: `continuation-bus.service.ts:103` — `acquireLock`
- **상세**: `String(process.pid)`를 lock value로 사용. 컨테이너 환경에서는 모든 인스턴스가 PID 1로 실행될 수 있어 lock 보유자 식별에 의미가 없음 (NX 의미 자체는 정상 동작). 잠금 보유 인스턴스를 디버깅할 수 없게 됨.
- **제안**: `${process.pid}-${Date.now()}` 또는 모듈 초기화 시 생성한 UUID 사용.

---

### [INFO] V035 마이그레이션: 대형 테이블에서 단일 트랜잭션 잠금 위험

- **위치**: `V035__execution_node_log.sql` — `INSERT INTO execution_node_log ... FROM execution ...`
- **상세**: `executeInTransaction=true`로 인해 INSERT, DROP이 하나의 트랜잭션으로 묶임. `execution` 테이블이 수백만 건 이상일 경우 장시간 table lock이 발생할 수 있음. 코드 주석과 spec에서 이미 분리 검토를 권장하고 있음.
- **제안**: 운영 배포 전 실제 데이터 볼륨으로 실행 시간을 측정하여 V035a/V035b 분리 여부 결정.

---

### [INFO] `bus.on()` 핸들러 중복 등록 시 무음 덮어쓰기

- **위치**: `continuation-bus.service.ts:88-92` — `on()` 메서드
- **상세**: 동일 타입에 `on()`을 두 번 호출하면 이전 핸들러가 로그 없이 교체됨. 현재는 `onModuleInit`에서 1회만 호출하므로 안전하나, 향후 다른 서비스가 `ContinuationBusService`를 재사용할 경우 디버깅이 어려운 버그가 생길 수 있음.
- **제안**: 현재 사용 패턴 유지 시 문제 없음. 단, 덮어쓰기 시 `warn` 로그 추가 고려.

---

## 요약

이번 변경의 핵심 부작용은 **세 가지**다. (1) 모든 continuation 진입점이 `void publish()`로 전환되어 Redis 장애 시 continuation 이벤트가 소리 없이 소실된다. (2) 목록 API의 `executionPath`가 항상 빈 배열로 반환되므로, 이 필드를 소비하는 클라이언트가 타입 에러 없이 조용히 깨질 수 있다. (3) `FakeRedis` stub의 `set()` 누락과 `select+order` TypeORM 조합이 잠재적 테스트/런타임 취약점을 만든다. DB 스키마 변경 (`execution_path` 컬럼 drop, `execution_node_log` 신설)은 마이그레이션 트랜잭션으로 원자적으로 처리되어 안전하며, append-only 모델로의 전환과 분산 lock 도입은 설계 의도와 일치한다.

## 위험도

**MEDIUM**