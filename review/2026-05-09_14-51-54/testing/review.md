### 발견사항

---

**[WARNING]** `onApplicationBootstrap` 테스트에서 `releaseLock` 호출 미검증
- 위치: `execution-engine.service.spec.ts` — `onApplicationBootstrap 이 recovery 를 트리거한다`
- 상세: `recoverStuckExecutions` 내부의 `finally { await this.continuationBus.releaseLock(...) }` 이 실행됐는지 확인하지 않음. lock 획득 후 해제 실패가 생겨도 테스트는 통과.
- 제안:
  ```typescript
  expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock');
  ```

---

**[WARNING]** `onApplicationBootstrap` 에서 DB 오류 전파 시나리오 미테스트
- 위치: `execution-engine.service.spec.ts` — `recoverStuckExecutions` describe
- 상세: `recoverStuckExecutions` 내 `createQueryBuilder` 체인이 reject 되면 `onApplicationBootstrap` 이 throw 한다. 부팅 실패로 이어지는 경로인데 기존 테스트 3건(lock 획득/실패/onModuleInit) 어디서도 다루지 않음.
- 제안: `updateExecuted` 가 reject 될 때 `onApplicationBootstrap` 이 오류를 전파하는지, 혹은 삼켜야 한다면 그 동작을 명시하는 테스트 1건 추가.

---

**[INFO]** 가드 로그 레벨 비대칭이 테스트에서 검증되지 않음
- 위치: `continuation-bus.service.ts` — `acquireLock` (line ~175, `logger.error`) vs `releaseLock` (line ~205, `logger.warn`)
- 상세: `acquireLock` 미초기화는 `error`, `releaseLock` 미초기화는 `warn` 으로 처리하는 의도적 차이가 존재하나, 테스트 세 건 모두 반환값만 검증하고 로거 호출 여부는 확인하지 않음. 로그 레벨이 바뀌거나 로그 자체가 제거돼도 테스트는 통과.
- 제안: `logger.error` / `logger.warn` spy 를 달아 적절한 레벨로 호출됐는지 단언 추가 (regression guard 성격).

---

**[INFO]** `mockResolvedValue(true)` 중복 설정
- 위치: `execution-engine.service.spec.ts` 571줄 `mockBus.acquireLock.mockResolvedValue(true)`
- 상세: `recoverStuckExecutions` describe 의 `beforeEach` 에서 이미 `mockBus.acquireLock.mockResolvedValue(true)` 를 설정하고, `mockClear()` 는 구현을 초기화하지 않음. 따라서 해당 줄은 효과 없는 중복.
- 제안: 제거하거나 `mockClear()` → `mockReset()` 으로 변경해 의미를 명확히 할 것.

---

**[INFO]** `onModuleInit` 테스트에서 side-effect 등록 검증 없음
- 위치: `execution-engine.service.spec.ts` — `onModuleInit 은 recovery 를 트리거하지 않는다`
- 상세: `onModuleInit` 이 `registerHandlers` 와 `registerContinuationHandlers` 를 여전히 호출하는지 확인하지 않음. 외부 테스트들이 핸들러 등록에 암묵적으로 의존하므로 실질 위험은 낮지만, lifecycle 변경 의도를 명시적으로 문서화하는 테스트로서 아쉬움.
- 제안: `expect(mockBus.on).toHaveBeenCalledTimes(5)` 등으로 핸들러 등록이 유지됨을 단언.

---

**[INFO]** `subscriber` 미초기화 가드 부재 — 의도적이나 주석 없음
- 위치: `continuation-bus.service.ts`
- 상세: `publisher` 는 세 진입점 모두 가드되지만 `subscriber` 는 가드 없음. `subscriber` 는 외부에 노출된 메서드가 없어 실제 위험은 없으나, 향후 public 메서드 추가 시 누락될 수 있음. 테스트도 이 경계를 명시하지 않음.
- 제안: 가드 범위를 `publisher` 에만 한정한다는 주석을 서비스 클래스에 1줄 추가.

---

### 요약

핵심 회귀 방지 목적(NestJS 라이프사이클 race로 인한 부팅 crash)은 세 guard 케이스 모두 커버되어 있고, `onModuleInit` / `onApplicationBootstrap` 책임 분리도 두 테스트로 명확하게 검증된다. `FakeRedis` double 의 pub/sub·SET NX·Lua eval 시뮬레이션이 정밀해 mock 신뢰도는 높다. 다만 `releaseLock` 호출 미검증과 DB 오류 전파 시나리오 누락이 운영 중 lock 누수나 부팅 실패 무음 통과를 감지하지 못하는 위험을 남긴다.

### 위험도

**LOW**