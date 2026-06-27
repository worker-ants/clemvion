# 요구사항(Requirement) 리뷰 결과

## 발견사항

### **[WARNING]** `allocB.release(executionId)` 누락 — 세 테스트 모두
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 100, 134, 169 (각 `finally` 블록)
- 상세: 세 테스트 모두 `finally { allocA.release(executionId); }` 만 호출하고 `allocB.release(executionId)` 는 호출하지 않는다. `allocB` 는 `allocA` 와 동일한 `executionId` 에 대해 `next()` 를 같은 수만큼 호출하므로, `allocB.fallbackCounters` 에 해당 executionId 항목이 남는다 (in-memory mirror 누수). 또한 `allocB.release()` 가 호출돼야 수행되는 Redis `DEL exec:seq:<executionId>` 도 시도되지 않는다 (Redis 측에서는 TTL 로 결국 회수되지만, 테스트 정리가 불완전하다). 프로덕션 코드의 `release()` 는 terminal event 발송 후 호출자가 반드시 호출하도록 명시된 lifecycle 계약(서비스 주석 참조)이다. 이 테스트 자체의 정확성에는 영향을 주지 않지만(각 테스트가 UUID 기반 고유 executionId 를 사용하므로 cross-test 오염 없음), 의도한 정리 절차가 `allocB` 에는 수행되지 않는다는 점에서 불완전하다.
- 제안: 각 테스트의 `finally` 블록을 `allocA.release(executionId); allocB.release(executionId);` 로 수정.

### **[INFO]** throughput 테스트에서 `Math.min(...seqs)` 검증 생략
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 173–175 (throughput 테스트)
- 상세: 첫 번째 테스트(cross-instance 유일성)에서는 `expect(Math.min(...seqs)).toBe(1)` 와 `expect(Math.max(...seqs)).toBe(N)` 를 모두 검증해 gap 없이 `1..N` 임을 확인한다. throughput 테스트에서는 `expect(Math.max(...seqs)).toBe(N)` 만 있고 `Math.min(...seqs).toBe(1)` 가 없다. 기능 완전성에 실질적 영향은 없다 — 두 인스턴스가 동일 executionId 로 발급하고 Set 크기가 N 이면 1..N 임이 수학적으로 보장되기 때문이다. 그러나 첫 번째 테스트와 검증 수준이 비대칭이다.
- 제안: throughput 테스트에도 `expect(Math.min(...seqs)).toBe(1)` 추가 권장 (테스트 보강, 강제 아님).

### **[INFO]** plan 파일 `/ai-review` 항목 미체크
- 위치: `plan/in-progress/eia-distributed-seq-load-verify.md` 라인 46 (`[ ] /ai-review (Critical/Warning 0)`)
- 상세: 현재 리뷰가 진행 중이므로 예상된 상태. 리뷰 완료 후 체크박스 갱신 및 plan complete 이동이 필요하다.
- 제안: 리뷰 통과 후 plan 체크박스 갱신.

### **[INFO]** spec fidelity — §R7 / §2.2 와의 일치
- 위치: 파일 전체
- 상세: 테스트가 검증하는 내용(`INCR exec:seq:<id>` 원자성으로 cross-instance monotonic 발급 보장)은 spec/5-system/14-external-interaction-api.md §R7("execution 별 atomic INCR (Redis `INCR exec:seq:<id>`)") 및 spec/5-system/6-websocket-protocol.md §2.2(`seq` = "execution 내 monotonic counter") 가 명시한 구현 전제와 정확히 일치한다. 테스트 파일이 두 spec 위치를 주석으로 명시하고 있으며, 검증 내용(유일성·단조성·throughput·latency 기준)은 `plan/complete/eia-distributed-seq-counter.md` 의 수용 기준(latency < 5ms, union = 1..N) 과도 부합한다. spec 불일치 없음.

### **[INFO]** `makeProvider` 의 `as never` 타입 캐스트
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 라인 68–69
- 상세: `makeProvider(redisA) as never` 는 `ExecutionSeqAllocator` 생성자가 기대하는 `RedisConnectionProvider` 클래스 타입과 최소 어댑터 객체 리터럴 사이의 타입 불일치를 우회하는 테스트 전용 패턴이다. 의도적 회피이며 주석으로 설명돼 있다. 런타임에서는 `getClient`/`getClientOrNull` 두 메서드만 실제로 사용되므로 안전하다. TODO/FIXME 가 아니고 테스트 격리를 위한 표준 패턴.

---

## 요약

변경된 코드는 plan에서 요구한 세 가지 검증 항목(cross-instance 동시 발급 유일성, throughput 보장, single-instance latency 회귀 확인)을 모두 구현하고 있으며, spec §R7(atomic INCR 전제) 및 §2.2(seq monotonic 보장)와 기능적으로 일치한다. 핵심 발견사항은 세 테스트 모두에서 `allocB.release(executionId)` 가 호출되지 않는 WARNING 하나다. 이는 테스트 결과의 정확성(각 테스트가 UUID 고유 executionId 사용)에는 영향이 없으나, 서비스가 문서화한 lifecycle 계약을 테스트가 절반만 이행하는 불완전한 정리 패턴이다. 나머지 발견사항은 모두 INFO 수준(throughput 검증 비대칭, plan 체크박스 갱신 대기, 타입 캐스트 설명)이며 기능 완전성에 영향을 주지 않는다.

## 위험도

LOW
