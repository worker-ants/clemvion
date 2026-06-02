# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] TOCTOU — isLockedOut → recordFailure 사이 원자성 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/third-party-oauth.controller.ts` — `cafe24Install` 핸들러, lockout 체크 이후 실패 기록 경로
- 상세: `isLockedOut(clientIp)` (GET) → 비즈니스 로직 → `recordFailure(clientIp)` (Lua INCR) 순서가 단일 Redis 트랜잭션으로 묶이지 않는다. 즉, 두 호출 사이에 다른 요청이 카운터를 임계치까지 올릴 수 있고, 현재 요청은 이미 lockout 체크를 통과했으므로 거절되지 않는다. 이는 rate limiting 목적의 **의도적인** fixed-window 설계이며, 공격자가 동시 요청으로 "마지막 몇 건"을 모두 통과시킬 수 있는 경미한 경쟁이 존재한다.
- 제안: 보안 요구사항이 엄격하지 않은 "강화 layer" 용도(Layer 1 위에 얹는 Layer 2)이므로 현재 설계가 허용 범위 안에 있다. 더 강화하려면 `isLockedOut` + `recordFailure` 를 하나의 Lua 스크립트로 통합해 INCR 후 반환값으로 lockout 여부를 판단하는 방식으로 단일 RTT 원자화가 가능하다. 현재 설계의 fail-open 정책과 Layer 1 의 `@Throttle` 병행을 감안하면 즉각 수정 우선순위는 낮다.

### [INFO] Lua 스크립트 — INCR+EXPIRE 원자성 올바름
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-install-ratelimit-2891d1/codebase/backend/src/modules/integrations/cafe24-install-rate-limit.service.ts` 라인 307–309 (`INCR_EXPIRE_LUA`)
- 상세: `INCR` 직후 카운터가 1일 때만 `EXPIRE` 를 설정하는 Lua 스크립트는 Redis 단일 스레드 실행 모델에서 원자적으로 실행된다. INCR 직후 크래시로 TTL 이 누락되는 race(영구 키)를 정확히 차단한다. 구현이 올바르다.
- 제안: 없음.

### [INFO] Redis 연결 생성 — 생성자 내 동기적 초기화, lazyConnect 사용
- 위치: `cafe24-install-rate-limit.service.ts` 생성자 (라인 334–347)
- 상세: `new Redis({ lazyConnect: true })` 로 생성해 NestJS DI 초기화 시 실제 TCP 연결을 즉시 점유하지 않는다. `isLockedOut` / `recordFailure` 호출 시점에 ioredis 가 자동으로 연결을 맺는다. 연결 실패 시 catch + warn 으로 fail-open 처리되므로 서버 시작이 Redis 가용성에 의존하지 않는다. 스레드 안전성 문제 없음 (Node.js 단일 스레드 이벤트 루프).
- 제안: 없음.

### [INFO] async/await — 모든 Redis 호출에 await 적용됨
- 위치: `cafe24-install-rate-limit.service.ts` 전체, `third-party-oauth.controller.ts` 핸들러
- 상세: `isLockedOut`, `recordFailure`, `close` 모두 `await` 가 누락 없이 적용되어 있다. 컨트롤러에서도 `await this.installRateLimit.isLockedOut(...)` 와 `await this.installRateLimit.recordFailure(...)` 가 정확히 await 된다. Promise 미처리(unhandled rejection) 위험 없음.
- 제안: 없음.

### [INFO] onModuleDestroy — Redis 연결 누수 방지 구현됨
- 위치: `cafe24-install-rate-limit.service.ts` 라인 409–411
- 상세: NestJS `OnModuleDestroy` 훅으로 `this.redis.quit()` 를 await 해 graceful shutdown 시 연결이 정리된다. `quit` 실패도 catch-ignore 처리해 shutdown 자체가 블로킹되지 않는다.
- 제안: 없음.

### [INFO] 인-메모리 공유 상태 없음
- 위치: `cafe24-install-rate-limit.service.ts` 전체
- 상세: 서비스 내 인스턴스 변수는 `logger`(읽기 전용)와 `redis`(초기화 후 불변 참조)뿐이다. 카운터 상태는 전적으로 Redis 에 위임되므로 Node.js 프로세스 내부의 경쟁 조건·스레드 안전성 문제는 발생 구조가 없다.
- 제안: 없음.

---

## 요약

변경된 코드는 Redis Lua 스크립트를 사용해 INCR+EXPIRE 원자성을 올바르게 구현하고 있으며, Node.js 단일 스레드 이벤트 루프 모델에서 인-메모리 경쟁 조건은 없다. 유일한 동시성 주의사항은 컨트롤러의 `isLockedOut` → `recordFailure` 가 별도 Redis 왕복으로 분리되어 있는 TOCTOU 성격의 경쟁인데, 이는 Layer 1 `@Throttle` 위에 얹는 보강 Layer 2 의 의도적 설계 범위 안이고 fail-open 정책과 결합해 정상 사용자에 영향을 주지 않으므로 즉각 수정 우선순위는 없다. 전반적으로 async/await, 연결 lifecycle, 원자적 카운팅 모두 올바르게 구현되어 있다.

## 위험도

LOW

STATUS=success ISSUES=0
