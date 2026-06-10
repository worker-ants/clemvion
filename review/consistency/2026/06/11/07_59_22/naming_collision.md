# 신규 식별자 충돌 검토 결과

검토 대상: `spec/4-nodes/4-integration/` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

- **[INFO]** `POOL_MAX_CONNECTIONS` / `POOL_IDLE_TIMEOUT_MS` — 코드 내부 상수, ENV var 아님
  - target 신규 식별자: `spec/4-nodes/4-integration/2-database-query.md` §4 에서 `POOL_MAX_CONNECTIONS=5`, `POOL_IDLE_TIMEOUT_MS=30000` 표기로 등장
  - 기존 사용처: 두 상수는 `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:64-65` 에서 module-scope `const` 로만 정의되며, `.env.example` 및 어떤 다른 spec 문서에도 동명의 환경변수나 설정 키가 존재하지 않음
  - 상세: spec 표기 형식(`POOL_MAX_CONNECTIONS=5`)이 환경변수 선언 형식과 동일해 외부에서 설정 가능한 ENV var로 오해할 여지가 있음. 현재는 하드코딩 상수로, 운영자가 `POOL_MAX_CONNECTIONS=10` 등으로 재정의하려 해도 반영되지 않는다. 기존 ENV var(`MCP_MAX_CONCURRENT_CONNECTIONS`, `EXECUTION_MAX_ACTIVE_RUNNING_MS` 등)와 동명 충돌은 없음.
  - 제안: spec 표기를 `POOL_MAX_CONNECTIONS(=5, 하드코딩)` 또는 "pool 크기 5, idle timeout 30s (현재 코드 상수)" 처럼 ENV var가 아님을 명확히 구분. 또는 향후 환경변수로 승격을 고려한다면 `.env.example` 에 추가해 일관성 확보.

- **[INFO]** `id: system-status-api` — 기존 `id: system-status` 와의 유사명 주의
  - target 신규 식별자: `spec/5-system/16-system-status-api.md` frontmatter `id: system-status-api`
  - 기존 사용처: `spec/2-navigation/15-system-status.md:2` — `id: system-status` (화면 spec)
  - 상세: 두 ID 는 서로 다른 문서(시스템 상태 화면 vs 시스템 상태 API 스펙)를 가리키며 실질적 충돌은 없음. 다만 `system-status` 와 `system-status-api` 가 유사해 tooling 또는 cross-reference 검색 시 혼동 가능성이 있음. `16-system-status-api.md` 는 origin/main 에 이미 존재하는 파일이며 이번 브랜치에서 신규 생성된 것이 아님 — 충돌 위험 없음.
  - 제안: 현재 수준에서 조치 불필요.

---

이번 target 에서 도입하는 핵심 신규 식별자는 다음 셋이다.

1. **Redis pub/sub 채널 `integration:cache:invalidate`** — `codebase/backend/src/common/redis/integration-cache-bus.service.ts` 의 `INTEGRATION_CACHE_INVALIDATE_CHANNEL` 상수로 정의. spec 에서 `spec/4-nodes/4-integration/2-database-query.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/5-integration.md`, `spec/0-overview.md` 네 문서에 일관되게 기재. 기존 Redis 채널 목록(`execution-run`, `execution-continuation`, `background-execution`, `exec:recover:lock`, `exec:cont:seq:*`, `chat-channel:*`, `cafe24:install:nonce:*`)에 동명 충돌 없음. 폐기된 `execution:continuation` 과도 명칭 구분 명확.

2. **클래스 `IntegrationCacheBus`** — `codebase/backend/src/common/redis/integration-cache-bus.service.ts` 신규 파일. origin/main 의 `codebase/backend/src/common/redis/` 에는 `redis-connection.provider.ts` / `redis.module.ts` 만 있었으므로 파일·클래스명 충돌 없음. `NodeHandlerDependencies` 인터페이스에 `integrationCacheBus?` 필드 추가 — origin/main 에 해당 필드 미존재 확인.

3. **타입 `IntegrationCacheInvalidator`** — 동일 파일 내 콜백 타입. 기존 codebase 에 동명 타입 없음.

---

## 요약

이번 target(`spec/4-nodes/4-integration/` 구현 완료 반영)이 도입하는 신규 식별자 — Redis pub/sub 채널 `integration:cache:invalidate`, 클래스 `IntegrationCacheBus`, 타입 `IntegrationCacheInvalidator`, 상수 `INTEGRATION_CACHE_INVALIDATE_CHANNEL` — 는 기존 spec·codebase 의 어떤 식별자와도 이름이 겹치지 않는다. `POOL_MAX_CONNECTIONS` / `POOL_IDLE_TIMEOUT_MS` 가 ENV var 처럼 보이는 표기 형식으로 spec 에 등장하지만 실제로는 코드 내부 상수여서 환경변수 혼동 가능성만 INFO 수준으로 지적한다. `id: system-status-api` 와 기존 `id: system-status` 의 유사명도 기능·위치가 달라 실질 충돌은 없다. 전체적으로 식별자 충돌 위험은 없다.

## 위험도

NONE
