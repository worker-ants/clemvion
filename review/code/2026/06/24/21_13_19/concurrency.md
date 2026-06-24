### 발견사항

**[INFO] Redis INCR 의 단일 인스턴스 단조성 — 클러스터 환경에서의 주의 사항**
- 위치: `continuation-bus.service.ts` `nextSeq()` 메서드 (라인 632-648)
- 상세: Redis 단일 인스턴스에서 INCR 는 원자적이고 단조 증가를 보장한다. 그러나 Redis Cluster 또는 Sentinel 페일오버 상황에서 INCR 카운터가 초기화될 경우 동일 executionId 에 대해 중복 seq 가 발생할 수 있다. 이 경우 BullMQ 의 jobId 중복 거부(idempotency 가드)가 실제 의도한 두 번째 continuation 메시지를 삭제해버리는 false dedup 이 발생할 수 있다. 현재 코드는 이 시나리오를 명시적으로 다루지 않는다.
- 제안: 현재 아키텍처 범위에서는 단일 Redis 인스턴스 가정이 합리적이며 즉각적인 수정 필요는 없다. spec §9.2 의 seq 단조성 계약에 클러스터 페일오버 예외를 문서화하는 수준으로 충분하다.

**[INFO] `nextSeq` 에서 INCR 성공 후 EXPIRE 실패 시의 미묘한 비원자성**
- 위치: `continuation-bus.service.ts` 라인 635-646
- 상세: INCR 와 EXPIRE 가 별개의 커맨드로 실행되므로 INCR 성공 → EXPIRE 실패 시 seq 키는 TTL 없이 영구 잔류할 수 있다. 코드는 이를 의도적으로 swallow 처리하고 있으며("일시적 누수") 다음 publish 가 EXPIRE 를 재시도한다는 설계다. 이는 §9.2 의 sliding-window 의도와 일치한다. EXPIRE 실패가 연속으로 발생하는 장애 상황에서는 키가 영구 잔류할 수 있으나, 실제로 Redis 가 살아있어서 INCR 는 성공하지만 EXPIRE 만 반복 실패하는 시나리오는 매우 드물다.
- 제안: SET key value EX ttl 또는 Lua script 로 INCR+EXPIRE 를 원자적으로 묶는 패턴을 고려할 수 있으나, 현재 설계의 tradeoff 가 명확히 문서화되어 있으므로 즉각 수정은 선택 사항이다.

**[INFO] `publish` 메서드의 async 에러 전파 구조 — 올바른 단일 catch 패턴**
- 위치: `continuation-bus.service.ts` 라인 585-615
- 상세: M-7 변경 후 `nextSeq` 는 INCR 실패 시 throw 를 전파하고, `publish` 의 outer try-catch 가 이를 잡아 null 을 반환한다. 이 패턴은 올바르며 에러 유실 없이 단일 경로로 수렴한다. 이전 코드의 이중 catch (nextSeq 내부 catch + publish outer catch) 구조가 제거되어 오히려 명확해졌다.
- 제안: 현재 패턴 유지. 개선 없음.

**[INFO] `cancelWaitingExecution` 의 `void publish` → `async` 전환 (C-1) — fire-and-forget 제거**
- 위치: `execution-engine.service.ts` 라인 840-848
- 상세: 기존 `void this.continuationBus.publish(...)` 는 Promise rejection 을 완전히 삼켜 에러 로깅조차 되지 않았다. C-1 변경은 이를 `await` + `ContinuationPublishResult` 반환으로 전환해 caller 가 실패를 동기적으로 감지할 수 있게 했다. 동시성 관점에서 이는 올바른 방향이다. 다만 cancel 이 BullMQ 를 통해 비동기 처리되므로, `cancelWaitingExecution` 성공(queued=true) 이후에도 실제 취소 완료까지 시간이 걸린다는 점은 기존과 동일하다.
- 제안: 현재 패턴 유지. 코드 주석에 이미 "호스팅 인스턴스가 reject 핸들러를 비동기 수행하므로 즉시 re-fetch 결과는 아직 PENDING/RUNNING 일 수 있다"고 명시되어 있어 적절하다.

**[INFO] 분산 lock (acquireLock/releaseLock) 의 Lua script 기반 원자성**
- 위치: `continuation-bus.service.ts` 라인 658-702
- 상세: `acquireLock` 은 `SET key value EX ttl NX` 원자 커맨드를 사용하고, `releaseLock` 은 GET+DEL 을 Lua script 로 묶어 원자성을 보장한다. 두 연산 모두 동시성 관점에서 올바르게 구현되어 있다. 분산 lock 의 owner token 은 `hostname:UUID` 조합으로 컨테이너 재시작 후에도 고유성이 유지된다.
- 제안: 현재 패턴 유지.

### 요약

이번 변경(C-1 + M-7)은 동시성 관점에서 전반적으로 개선 방향이다. M-7 의 Math.random 기반 seq fallback 제거는 동시 publish 상황에서 jobId 충돌로 인한 silent dedup 오류(동일 executionId 의 두 번째 continuation 이 거부되는 문제)를 근본적으로 없앴으며, Redis INCR 의 서버 측 원자성에만 의존하는 단순하고 정확한 설계로 수렴했다. C-1 의 void publish → async 전환은 fire-and-forget 에 의한 에러 유실 패턴을 제거했으며, 에러 전파 경로가 단일 outer catch 로 통합되어 추론이 명확해졌다. 분산 lock 구현은 Lua 기반 원자 GET+DEL 을 유지하고 있어 race condition 위험이 없다. INCR+EXPIRE 비원자성 및 Redis 클러스터 페일오버 시나리오는 잠재적 INFO 수준 주의 사항이나 현재 아키텍처 전제 내에서는 문서화된 tradeoff 로 수용 가능하다.

### 위험도

LOW
