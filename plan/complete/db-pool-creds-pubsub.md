---
worktree: db-pool-creds-pubsub
started: 2026-06-11
owner: developer
spec_impact:
  - spec/4-nodes/4-integration/2-database-query.md
  - spec/0-overview.md
  - spec/5-system/4-execution-engine.md
  - spec/data-flow/5-integration.md
---

# 04 m-4 — DB Pool credential rotation 멀티 인스턴스 무효화 (Redis pub/sub)

> 출처: `plan/in-progress/refactor/04-security.md` m-4 (✅ 2026-06-10 사용자 승인, 권고안 A).
> credential 회전 시 stale 자격증명의 idle 연결이 **타 인스턴스 풀에 잔존** → 침해 대응 MTTR 갭.
> 근본 해법: integration 변경 이벤트를 Redis pub/sub 으로 전 인스턴스 broadcast → 해당
> integrationId 풀 즉시 evict. pub/sub 미수신 시 기존 credsHash evict 로 안전 degrade(fail-safe).

## 현황 (조사 완료)

- `database-query.handler.ts`: `pools` Map(integrationId 키, credsHash 비교). `invalidatePool(id)`
  메서드 **이미 존재**(325-334) — 호출만 cross-instance 로 트리거하면 됨. `POOL_IDLE_TIMEOUT_MS=30s`.
- `integrations.service.ts`: `rotate`/`update`/`remove`/`reauthorize`/OAuth 토큰 갱신에서 creds 변경
  후 save — **이벤트 미발행**.
- **Redis pub/sub 부재**: `RedisConnectionProvider`(common/redis, `@Global`)는 command-only 공유
  연결. PUBLISH 는 command 라 공유 연결 가능, SUBSCRIBE 는 전용 duplicate 연결 필요.
- 핸들러 주입 seam: `NodeHandlerDependenciesProvider.build()` → `HandlerDependencies` →
  `database-query.component.ts createHandler(deps)` → 싱글톤 핸들러. 풀 캐시는 싱글톤 인스턴스 state.
- `send-email.handler.ts` 도 동일 패턴(`invalidateTransport(id)`) — 동일 갭. 본 PR 은 DB 풀만
  와이어링하고 bus 는 generic 설계 → email 은 후속 1줄(별 항목).

## 설계

신규 `IntegrationCacheBus`(common/redis):
- 채널 `integration:cache:invalidate`, payload = `integrationId` (평문 문자열).
- `register((integrationId) => void|Promise)`: 핸들러가 자기 캐시 evict 등록.
- `publish(integrationId)`: 공유 command 연결로 PUBLISH (fail-safe catch+warn).
- `onModuleInit`: 공유 연결 `duplicate()` 로 subscriber 연결 생성 → `subscribe(CHANNEL)` +
  `on('message')` → 등록 invalidator 전부 실행. `onModuleDestroy`: subscriber quit.
- fail-safe: Redis 미가용 시 pub/sub 에러를 삼키고 degrade — credsHash evict 가 여전히 보호.

와이어링:
1. `RedisModule` providers/exports 에 `IntegrationCacheBus` 추가 (@Global).
2. `HandlerDependencies` += `integrationCacheBus?`.
3. `NodeHandlerDependenciesProvider` += `@Optional() integrationCacheBus` + build().
4. `database-query.component.ts`: `createHandler: (deps) => new DatabaseQueryHandler(deps.integrationsService, deps.integrationCacheBus)`.
5. `DatabaseQueryHandler` ctor: bus 있으면 `bus.register((id) => this.invalidatePool(id))`.
6. `IntegrationsService`: `IntegrationCacheBus` 주입, rotate/update/remove/reauthorize/OAuth save 후 `bus.publish(integrationId)`.

## 체크리스트

### Spec (planner)
- [x] `2-database-query.md` §4 step 2 — 멀티 인스턴스 무효화(Redis pub/sub) 문단 추가.
- [x] §Rationale 신설 — MTTR 트레이드오프 + fail-safe degrade + 채널명.
- [x] frontmatter `code:` 에 신규 bus 파일 추가.
- [x] 채널 registry 동기화 — `0-overview §2.6` + `execution-engine §9.2` pub/sub 채널 + `data-flow/5-integration.md` rotate/remove publish 단계 (consistency INFO #1·#2·#4).
- [x] `/consistency-check --spec` BLOCK: NO (`review/consistency/2026/06/11/07_23_30/SUMMARY.md`).

> **후속(별 항목)**: Send Email transport(`send-email.handler` `invalidateTransport`)도 동일 bus 에
> register 하면 SMTP 자격증명 회전도 즉시 전파된다 — 그때 `3-send-email.md` frontmatter `code:` 에
> `integration-cache-bus.service.ts` 추가 (consistency INFO #3·#5). 본 PR scope 는 DB 풀만.

### 구현 (developer)
- [x] `/consistency-check --impl-prep spec/4-nodes/4-integration/` — `--spec`(같은 영역) BLOCK:NO 로 갈음 (동일 5 checker·동일 spec 영역).
- [x] `IntegrationCacheBus` + 단위테스트 (register/publish/subscribe/fail-safe).
- [x] HandlerDependencies/provider/component/handler 와이어링 + 핸들러 ctor 등록 단위테스트.
- [x] IntegrationsService publish 와이어링 + 단위테스트.
- [x] TEST WORKFLOW — lint ✅ · unit ✅ (backend 6473) · build ✅ · e2e ✅ (186, rotate/remove → 실 Redis 채널 수신).
- [x] `/ai-review` — LOW / Critical 0 / Warning 8 → 전부 fix 또는 근거 있는 수용. RESOLUTION: `review/code/2026/06/11/07_44_41/RESOLUTION.md`.
- [x] `/consistency-check --impl-done spec/4-nodes/4-integration/` — **BLOCK: NO** (`review/consistency/2026/06/11/07_59_22/SUMMARY.md`). WARNING 5건은 모두 본 변경과 무관한 integration 영역 기존 spec drift(INTEGRATION_NOT_FOUND·SSRF 코드표·meta.rowCount·send_email 포트) → 본 PR scope 밖. 본 변경 관련 I-1(0-overview rotate·remove 정밀화)·I-4(execution:continuation 도메인 구분) 반영.
- [x] 완료 이동 시 frontmatter 에 `spec_impact` 선언 (plan-lifecycle §5 Gate C) — 4개 spec 선언 완료.

## Rationale

옵션 A(pub/sub 전파) 확정 — 침해 대응 맥락이라 시간 기반 완화(B: idle timeout 하향)로는 SLA
보장 불가 + churn 비용이 풀 캐시 목적과 상충. pub/sub 실패 시 credsHash evict 로 degrade 되는
fail-safe 구조라 도입 리스크 낮음. 채널은 integration-generic 으로 두어 send-email transport 등
타 캐시가 동일 mechanism 에 register 가능하게 한다(본 PR 은 DB 풀만, email 후속).
