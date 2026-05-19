# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
대상 구현 범위: `BullModule.forRootAsync` Redis connection 옵션 누락 보강 + `HealthService` 동일 보강 + `.env.example` 항목 추가

---

## 발견사항

발견된 CRITICAL / WARNING 없음.

---

### 요약

본 구현(target)은 기존 spec Rationale 에서 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 내용을 포함하지 않는다.

**근거 검토 내용:**

1. **기각된 대안의 재도입 없음**

   검토 대상 spec Rationale 에서 Redis 인증 옵션(password/tls) 전달 방식과 관련해 명시적으로 기각된 대안은 없다. `redis.config.ts` 의 주석 자체가 "인증 redis 도입 시 본 구성을 사용하는 모든 Redis client 가 동일하게 password/tls 옵션을 받도록 단일 source 로 묶었다" 고 명시하며, W-72 코드 리뷰 경고 (`review/code/2026/05/17/13_24_39/`)가 정확히 이 결함을 `Cafe24InstallNonceCache` 에 대해 지적한 후속 조치로서 이번 target 은 BullMQ/HealthService 로 동일 패턴을 완성하는 것이다. 기각된 대안(예: 공유 ioredis 인스턴스 DI)을 채택하지 않고, 이미 `cafe24-install-nonce-cache.service.ts` 와 `continuation-bus.service.ts` 가 채택한 `spread + ternary` 패턴을 그대로 적용한다.

2. **합의된 원칙 위반 없음**

   spec Rationale 의 핵심 원칙들을 살펴봤을 때:
   - `redis.config.ts` 단일 source 원칙: target 은 `ConfigService.get('redis.password')` / `ConfigService.get('redis.tls')` 경로를 사용해 동일 source 를 참조한다.
   - `continuation-bus.service.ts` Rationale ("Continuation bus = Redis pub/sub", `spec/data-flow/3-execution.md §Rationale`): pub/sub vs BullMQ 선택 원칙은 본 target 이 영향을 주지 않는 레이어다.
   - `BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소` (`spec/2-navigation/4-integration.md` Rationale): BullMQ 를 Redis 기반 분산 job queue 로 사용하는 결정은 이미 확립되어 있고, target 은 그 연결 옵션만 보강한다.

3. **결정의 무근거 번복 없음**

   target 은 기존 결정을 번복하지 않는다. 오히려 `redis.config.ts` 의 설계 의도(모든 소비자가 동일 옵션을 받아야 한다)를 BullMQ 와 HealthService 소비자까지 확장 적용하여 일관성을 달성한다.

4. **암묵적 가정 충돌 없음**

   검토된 spec Rationale 에서 Redis 인증 옵션을 일부 소비자에만 제한적으로 전달해야 한다는 invariant 는 없다. `redis.config.ts` 자체가 password/tls 옵션을 전체 소비자 공유용으로 선언하고 있다.

---

## 위험도

NONE
