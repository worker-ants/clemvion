# Testing Review — execution-seq-allocator-load e2e

## 발견사항

### [INFO] 두 인스턴스 공유 상태 — 테스트 1과 2가 동일 allocA/allocB 인스턴스를 재사용
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L108–L160 (테스트 1), L163–L197 (테스트 2)
- 상세: 세 테스트가 모두 `beforeAll`에서 생성된 동일 `allocA`/`allocB` 인스턴스를 공유한다. 각 테스트는 `randomUUID()`로 고유한 `executionId`를 사용하고 `releaseBoth()`로 in-memory mirror를 정리하므로, Redis 키 충돌 및 mirror 오염은 발생하지 않는다. 다만 테스트 실행 순서에 의해 Redis 연결이 이미 warmup된 상태에서 latency 테스트(테스트 3)가 수행되므로, cold-start 비용이 측정값에 포함되지 않는다는 점이 의도적으로 설계되어 있다. 이는 주석(WARMUP 상수 설명)에서도 명시되어 있으나, 테스트 순서 의존성이 latency 측정에 영향을 줄 수 있다는 점을 추가 문서화하면 명확성이 높아진다.
- 제안: 현재 설계는 의도된 것이므로 필수 변경은 아니나, 테스트 3 설명에 "테스트 1·2 실행 후 연결 warmup 상태를 전제" 임을 명시하는 주석을 추가하면 가독성이 향상된다.

### [INFO] `total`이 홀수일 때 perInstance 비정수 분할 — 방어 없음
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L95 (`allocateConcurrentlyAcrossInstances`)
- 상세: `perInstance = total / 2`에서 `total`이 홀수이면 `perInstance`가 소수점 값이 되고, `for (let i = 0; i < perInstance; i++)` 루프는 `Math.floor(perInstance)`번만 실행된다. 결과로 실제 발급 수가 `total`보다 적어지고, `expect(unique.size).toBe(N)`가 실패하게 된다. 현재 `N = 1000`으로 고정되어 있어 실제로는 문제가 없으나, 헬퍼 재사용 시 혼란을 줄 수 있다.
- 제안: `if (total % 2 !== 0) throw new Error('total must be even')` 방어 구문 추가 또는 JSDoc에 "total must be even" 명시.

### [INFO] `Math.min(...seqs)` / `Math.max(...seqs)` 스프레드 — N=1000에서 안전하나 제한 있음
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L155–L156, L178–L180
- 상세: JS의 `Math.min/max`는 스프레드 인수 개수에 제한이 있다(V8에서 통상 ~65,536 이상이면 스택 오버플로). N=1000은 안전하지만, 향후 N을 크게 늘릴 경우 문제가 된다. 대안: `seqs.reduce((a, b) => Math.min(a, b), Infinity)`.
- 제안: RESOLUTION.md에서도 "INFO 3 보류 — N 확장 시 재검토"로 인식되어 있으므로, 해당 내용을 코드 주석에도 명시하면 유지보수성이 향상된다.

### [INFO] latency 테스트의 `releaseBoth()` 호출 — `allocB`는 latency 테스트에서 사용되지 않음
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L228 (`releaseBoth`)
- 상세: 테스트 3(latency)은 `allocA.next()`만 호출하지만 `finally`에서 `releaseBoth()`를 호출해 `allocB.release()`도 실행한다. `allocB.release()`는 `fallbackCounters`에 해당 키가 없으므로 `Map.delete()`는 no-op이고, Redis DEL도 해당 키가 없어 safe이다. 다만 `allocB.release()`를 호출하는 것이 의미론적으로 미묘하게 부정확할 수 있다. lifecycle 계약 대칭성(RESOLUTION WARNING 1 조치 결과)의 취지는 이해되며, 실제 동작에는 문제가 없다.
- 제안: 테스트 3의 `finally` 블록에서 `allocA.release(executionId)`만 호출하는 방안 고려. 또는 현재 패턴 유지 시 "allocB 미사용이나 lifecycle 일관성을 위해 양쪽 release" 주석 추가.

### [INFO] beforeAll에서 `expect(pongA/pongB).toBe('PONG')` — beforeAll 실패 시 모든 테스트 skip 여부 미보장
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L116–L118
- 상세: `beforeAll` 내부의 `expect`가 실패하면 Jest는 해당 describe 블록의 모든 테스트를 실패로 처리한다(skip이 아닌 fail). 이는 CI에서 Redis가 없을 때 세 테스트가 모두 "failed" 상태로 표시되어 false alarm처럼 보일 수 있다. 코드의 의도(Redis 불가용 시 명시 실패)는 올바르나, 에러 메시지가 "PING expect 실패"로만 표시되어 원인 파악이 어려울 수 있다.
- 제안: PING 실패 시 명시적인 에러 메시지를 포함하도록 `expect(pongA).toBe('PONG') // Redis at ${REDIS_HOST}:${REDIS_PORT} must be reachable` 형태의 주석 또는 수동 throw로 개선 가능.

### [INFO] throughput assert `toBeGreaterThanOrEqual(1000)` — 환경 의존적 flakiness 잠재성
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L189
- 상세: 1000 events/s 기준은 실측 70,734 events/s 대비 ~70× 여유가 있어 현재 환경에서는 안전하다. 그러나 CI 환경에서 Redis가 동일 호스트가 아닌 별도 컨테이너에 있고 네트워크 레이턴시가 높거나, 리소스 경합이 심한 경우 flaky해질 수 있다. 허용 기준(1000/s)이 매우 보수적이어서 실질적 위험은 낮으나, 환경 변동성에 대한 명시가 있으면 좋다.
- 제안: 현재 수준은 수용 가능. 단, CI 로그에 실측값이 항상 출력되므로(`console.log`) 문제 발생 시 진단은 용이하다.

### [INFO] `execution-seq-allocator.service.spec.ts` 기존 unit 테스트와의 보완 관계 명확성
- 위치: e2e spec 파일 전체 (참조: `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-load-verify-6f5ebc/codebase/backend/src/modules/websocket/execution-seq-allocator.service.spec.ts`)
- 상세: unit spec은 fake Redis로 INCR 원자성 계약을 고정하고, 본 e2e spec은 실 Redis로 경험적 검증을 추가한다. 두 spec의 역할 분리가 적절하고, unit spec의 coverage(정상 경로, degraded fallback, 동시성 regression, release, TTL env, onModuleDestroy)도 충분하다. 신규 e2e spec이 기존 unit coverage와 중복되지 않으면서 갭을 메우는 구조가 올바르다.
- 제안: 현재 구조 유지. 추가 coverage 필요 없음.

## 요약

신규 e2e spec(`execution-seq-allocator-load.e2e-spec.ts`)은 실 Redis를 사용한 분산 monotonic 보장 경험적 검증이라는 명확한 목적을 잘 달성하고 있다. 기존 unit spec과의 역할 분리가 적절하며, `beforeAll`의 PING 강제 확인으로 degraded false-pass를 방지하는 설계가 견고하다. `releaseBoth()` 헬퍼 도입(RESOLUTION WARNING 1 조치)으로 lifecycle 계약 대칭성이 확보되었고, 세 테스트가 각각 독립된 `executionId`를 사용해 테스트 간 상태 오염이 없다. 식별된 이슈는 모두 INFO 수준으로, 홀수 `total` 방어 부재와 N 확장 시 스프레드 위험이 향후 재사용 맥락에서 주의가 필요한 수준이나 현재 고정값(N=1000)에서는 안전하다. `docker-compose.e2e.yml`의 `REDIS_HOST`/`REDIS_PORT` 명시 추가는 의존성을 명확히 하는 적절한 변경이다.

## 위험도

LOW
