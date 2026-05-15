### 발견사항

---

**[HIGH] `void publish()` — 발행 실패가 무음으로 소멸됨**
- 위치: `execution-engine.service.ts` — `continueExecution`, `cancelWaitingExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation`
- 상세: 5개 진입점 모두 `void this.continuationBus.publish(...)` 패턴을 사용한다. Redis 커넥션이 끊어지거나 네트워크 오류가 발생하면 `ioredis.publish()` 가 throw 하지만 `void` 로 폐기되어 에러 로그도, 호출자 응답도 없이 사라진다. 사용자 입력 메시지가 분산 환경 전체에서 유실되는 결과를 낳는다.
- 제안: `publish` 내부 또는 진입점에서 `try/catch` + 로깅을 추가하고, 컨트롤러가 예외를 받을 수 있도록 진입점을 `async`로 전환하거나 최소한 에러를 `logger.error`로 기록해야 한다.

```typescript
// continuation-bus.service.ts
async publish(msg: ContinuationMessage): Promise<number> {
  try {
    return await this.publisher.publish(CHANNEL, JSON.stringify(msg));
  } catch (error) {
    this.logger.error(`Bus publish failed for ${msg.executionId}: ${error}`);
    throw error; // 호출자가 처리할 수 있도록
  }
}
```

---

**[MEDIUM] 분산 lock 값으로 `process.pid` 사용 — 인스턴스 간 충돌 가능**
- 위치: `continuation-bus.service.ts:acquireLock`
- 상세: `SET NX` 의 값을 `String(process.pid)` 로 설정한다. 서로 다른 물리 호스트에서 실행 중인 인스턴스가 동일한 PID 를 가질 확률이 있고, 이 경우 lock 소유 인스턴스를 식별하는 로직이 틀린 인스턴스를 가리킨다. 현재 `releaseLock` 메서드가 없어 lock 은 TTL 만료 전까지 해제되지 않으므로, 소유자 검증이 잘못돼도 lock 해제를 시도하는 경로가 없어 당장의 data-race 는 없지만 lock 의미론적 신뢰도가 낮아진다.
- 제안: `crypto.randomUUID()` 또는 `os.hostname() + ':' + process.pid` 조합으로 전역 고유값을 생성한다. 또한 `releaseLock(key, token)` 을 추가해 Lua script 기반 소유자 검증 후 삭제하도록 한다.

---

**[WARNING] 모듈 초기화 순서 race — 구독 활성 후 핸들러 등록 전 창구 존재**
- 위치: `ContinuationBusService.onModuleInit()` vs `ExecutionEngineService.registerContinuationHandlers()`
- 상세: NestJS 는 DI 순서에 따라 `ContinuationBusService.onModuleInit()` 을 먼저 호출해 Redis 구독을 활성화한 뒤, `ExecutionEngineService.onModuleInit()` 에서 `registerContinuationHandlers()` 를 실행한다. 이 두 호출 사이의 짧은 창구에서 Redis 메시지가 수신되면 `this.handlers` 가 비어 있어 silent drop 된다. 재시작 직후의 continuation 메시지가 드물기는 하지만, 인스턴스 롤링 배포 중에는 실제로 발생할 수 있다.
- 제안: `ContinuationBusService.onModuleInit()` 에서 `subscribe` 를 즉시 호출하지 않고, `ExecutionEngineService` 가 `registerContinuationHandlers()` 호출 완료 후 `continuationBus.startSubscribing()` 을 명시적으로 트리거하도록 순서를 역전시키면 race window 를 제거할 수 있다.

---

**[WARNING] `onModuleDestroy` 이후 in-flight `void publish()` 호출 처리 미흡**
- 위치: `continuation-bus.service.ts:onModuleDestroy`
- 상세: `quit()` 이 커넥션을 닫은 이후에도 이미 시작된 `void publish()` 호출이 완료되지 않은 상태일 수 있다. ioredis 는 `quit()` 이후 발행 시도 시 에러를 throw 하지만, `void` 패턴으로 인해 에러가 무시되고 종료 시퀀스에서 in-flight 작업의 완료를 대기하지 않는다.
- 제안: graceful shutdown 을 위해 `activePublishes` 카운터 또는 `Set<Promise>` 를 유지해 `onModuleDestroy` 에서 `Promise.allSettled(activePublishes)` 후 `quit()` 을 호출한다.

---

**[INFO] `execution_node_log` INSERT 병렬 안전성 — 의도는 정확하나 인스턴스 내 병렬 브랜치 검증 없음**
- 위치: `execution-engine.service.ts:appendExecutionPath`
- 상세: `executionPathChain` mutex 제거 후 `executionNodeLogRepository.insert()` 로 교체했다. BIGSERIAL sequence 가 인스턴스 간 동시성을 보장하므로 분산 환경에서는 올바르다. 단, `ParallelExecutor` 내에서 동일 `executionId` 에 대해 여러 브랜치가 동시에 `appendExecutionPath` 를 호출할 때, INSERT 자체는 각각 원자적이고 `id` 순서가 PostgreSQL sequence 로 결정되므로 데이터 정합성은 유지된다. 다만 브랜치 간 상대 순서가 비결정적(seq 할당 순서에 의존)임은 새 모델의 의도된 trade-off 이며 스펙 §7.4 와 일치한다.

---

**[INFO] V035 마이그레이션 장기 트랜잭션 — 대형 테이블에서 lock 경합 위험**
- 위치: `V035__execution_node_log.sql`
- 상세: `executeInTransaction=true` 로 `INSERT...SELECT` (기존 배열 데이터 이행) + `ALTER TABLE DROP COLUMN` 이 단일 트랜잭션 내에서 실행된다. 대형 테이블에서 `INSERT...SELECT` 가 오래 걸리는 동안 `execution` 테이블에 AccessExclusiveLock 이 유지돼 서비스 중단을 야기할 수 있다. 파일 주석에서 V035a/V035b 분리를 언급하고 있어 인지된 위험임을 확인.
- 제안: 운영 배포 전 테이블 행 수를 기준으로 마이그레이션 소요 시간을 스테이징에서 측정하고, 임계치(예: 10초 이상) 초과 시 V035a(테이블 생성 + 이행) / V035b(컬럼 DROP) 로 분리 적용한다. `pt-online-schema-change` 또는 `pg_repack` 활용도 검토한다.

---

### 요약

이번 변경의 핵심 동시성 설계 — BIGSERIAL append-only 로그로 분산 순서 보장, Redis pub/sub fan-out + local Map 키 기반 단일 처리, SET NX 분산 lock 기반 recovery 가드 — 는 전반적으로 올바르게 설계됐다. 가장 실질적인 위험은 `void publish()` 패턴으로 인한 Redis 장애 시 continuation 메시지 무음 유실이며, 이는 분산 실행 정합성에 직접 영향을 미친다. lock 값으로 사용하는 `process.pid` 의 인스턴스 간 충돌 가능성과 모듈 초기화 순서상의 짧은 race window 는 보완이 권장된다. 나머지 사항은 운영 안전성 관련 INFO 수준이다.

### 위험도

**HIGH**