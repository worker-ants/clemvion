# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] M-7 INCR 실패 테스트 — 초기화 publish 의존이 테스트 의도를 흐림
- 위치: `continuation-bus.service.spec.ts` 라인 238-257 (INCR 실패 테스트)
- 상세: 테스트가 INCR 실패를 주입하기 위해 사전 정상 `bus.publish()`를 먼저 호출해 lazy init을 완료한 뒤 `fakeRedisInstances[0].incr`을 override한다. 초기화 publish의 side effect(seq 카운터 1 소진, queueAdd 1회 호출)가 검증 범위와 섞이나 `expect(queueAdd)` 검증을 별도로 하지 않아 부작용 혼입을 인지하기 어렵다. 현재 동작은 정확하지만 lazy init 이전 최초 INCR 실패(init 단계 실패) 케이스는 별도로 테스트되지 않는다.
- 제안: 초기화 publish 목적을 `// 목적: lazy init 트리거` 주석으로 명시하고, 가능하면 lazy init 이전 첫 INCR 실패 케이스를 별도 테스트로 보충한다.

### [INFO] INCR 실패 시 queueAdd 미호출 여부 미검증
- 위치: `continuation-bus.service.spec.ts` 라인 238-257
- 상세: M-7 테스트는 `jobId === null`만 단언하고, INCR 실패 후 `queueAdd`가 실제로 호출되지 않았음을 검증하지 않는다. "INCR 실패 → enqueue 생략" 경로는 M-7의 핵심 불변이나 묵시적으로만 보장된다.
- 제안: `expect(queueAdd).toHaveBeenCalledTimes(1)` (초기화 1회만, 실패 호출 없음)을 추가해 enqueue 생략 경로를 명시적으로 검증한다.

### [INFO] cancelWaitingExecution — queued=false 단위 케이스 누락
- 위치: `execution-engine.service.spec.ts` 라인 761-768
- 상세: C-1 변경으로 `cancelWaitingExecution`이 `ContinuationPublishResult`를 반환하게 됐다. 성공 케이스(`queued:true`)는 검증되지만, `bus.publish`가 `null`을 반환하는 실패 케이스에서 `{ queued: false, jobId: null }`을 반환하는 경로는 단위 테스트가 없다. 이 경로는 `executions.service`의 503 표면과 직접 연결되어 중요하다.
- 제안: `mockBus.publish.mockResolvedValueOnce(null)` 주입 후 `result.queued === false`임을 확인하는 테스트를 보충한다.

### [INFO] stop WAITING 분기 — cancel 후 findOne null 폴백 경로 미테스트
- 위치: `executions.service.spec.ts` 라인 920-937
- 상세: cancel 성공 후 re-fetch(`findOne`)가 `null`을 반환하는 경우(`return updated ?? execution` 폴백)가 테스트되지 않는다. 이 폴백은 실제 운영에서 race condition 시 발생 가능한 경로다.
- 제안: `executionRepo.findOne.mockResolvedValueOnce(waiting).mockResolvedValueOnce(null)` 케이스를 추가해 폴백으로 원본 `execution`이 반환됨을 검증한다.

### [INFO] websocket.gateway.spec.ts — cancelWaitingExecution queued=false 응답 처리 미검증
- 위치: `websocket.gateway.spec.ts` 라인 471-474
- 상세: mock이 `mockResolvedValue({ queued: true })` 기본값으로만 설정되어 있다. WebSocket Gateway에서 `cancelWaitingExecution`의 `queued=false` 응답을 어떻게 처리하는지(에러 전파 vs 무시 여부)를 검증하는 테스트가 없다. Gateway에 해당 분기 처리가 있다면 커버리지 갭이다.
- 제안: Gateway의 cancel 경로에서 `queued=false` 처리 정책을 확인하고, 의미 있는 분기가 있으면 실패 케이스 테스트를 추가한다.

### [INFO] acquireLock — Redis 장애 시 false 반환(fail-closed) 테스트 없음
- 위치: `continuation-bus.service.spec.ts` 분산 lock 섹션 (라인 319-351)
- 상세: `acquireLock`의 fail-closed 정책(Redis 장애 시 `false` 반환)은 코드에 명시되어 있으나 `set`이 throw하는 케이스에 대한 단위 테스트가 없다. `releaseLock` 장애 케이스(이미 삭제된 키)는 검증되나 `acquireLock` 장애는 누락이다.
- 제안: `fakeRedisInstances[0].set.mockRejectedValueOnce(new Error('Redis down'))` 주입 후 `acquireLock` 결과가 `false`임을 검증하는 케이스를 추가한다.

### [INFO] releaseLock — owner 불일치 시 Lua 분기(return 0) 단위 테스트 불가
- 위치: `continuation-bus.service.spec.ts` 라인 340-351
- 상세: 테스트 코드 주석 자체가 "별도 인스턴스 시뮬 불가"라고 인정한다. Lua 스크립트의 `ARGV[1]` 불일치 분기가 in-memory stub 구조상 단위 레벨에서 검증되지 않는다. 향후 real Redis 기반 통합 테스트에서 보완이 필요한 갭이다.
- 제안: `fakeRedis.eval` mock을 다른 token으로 조작하는 방식으로 단위 테스트 내 보완을 검토하거나, 통합 테스트 추가 시 이 케이스를 커버 대상으로 명시한다.

## 요약

C-1(cancelWaitingExecution async 전환)과 M-7(INCR 실패 fail-fast)에 대한 핵심 경로 테스트는 모두 존재하며 정확하다. `continuation-bus.service.spec.ts`의 fakeRedis 격리 구조(W-7), TTL sliding window 검증, lock lifecycle 검증은 품질이 높고, `executions.service.spec.ts`의 신규 C-1 테스트(queued=true 성공·queued=false 503)도 핵심 분기를 잘 커버한다. 기존 테스트도 변경 후 일관되게 갱신되어 회귀 위험이 없다. 다만 INCR 실패 시 queueAdd 미호출 명시 부재, cancelWaitingExecution queued=false 단위 케이스 누락, cancel 후 findOne null 폴백 미검증, acquireLock Redis 장애 케이스 누락, releaseLock owner 불일치 Lua 분기 미검증 등 경계값·보조 경로의 INFO 수준 커버리지 갭이 존재한다.

## 위험도

LOW
