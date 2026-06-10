# 신규 식별자 충돌 Check — 결과

**검토 대상**: `plan/in-progress/db-pool-creds-pubsub.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-11

---

## 발견사항

충돌로 분류할 항목이 없다. 아래는 각 점검 관점별 상세 확인 결과다.

### 1. 요구사항 ID 충돌

target plan 은 요구사항 ID(예: `ND-*`, `NAV-*` 형식)를 새로 부여하지 않는다. 기존 `spec/4-nodes/4-integration/_product-overview.md` 의 기존 ID 와 독립적인 구현 plan 이다. 충돌 없음.

### 2. 엔티티/타입명 충돌

**신규 식별자**: `IntegrationCacheBus` (서비스 클래스), `integrationCacheBus` (HandlerDependencies 필드)

확인 결과:
- `IntegrationCacheBus` 는 `codebase/backend/src/common/redis/integration-cache-bus.service.ts` 에 이미 구현됐고, `codebase/backend/src/common/redis/redis.module.ts` 의 `@Global()` providers/exports 에 등록됐다.
- `integrationCacheBus?` 는 `codebase/backend/src/nodes/core/node-component.interface.ts` `HandlerDependencies` 인터페이스에 이미 추가됐다.
- 기존 코드베이스 어디에도 동일 이름이 다른 의미로 쓰이지 않는다.

충돌 없음.

### 3. API endpoint 충돌

target plan 은 신규 API endpoint 를 정의하지 않는다. 내부 Redis pub/sub 채널 기반 서비스-간 통신만 도입한다. 충돌 없음.

### 4. 이벤트/메시지명 충돌

**신규 식별자**: Redis pub/sub 채널 `integration:cache:invalidate` (상수명 `INTEGRATION_CACHE_INVALIDATE_CHANNEL`)

기존 사용처 전수 확인:
- `spec/5-system/4-execution-engine.md §9.2` 에 열거된 기존 Redis 키/채널: `exec:*` 패턴 키 + `exec:recover:lock`. 폐기된 구 채널 `execution:continuation` (BullMQ 큐로 교체됨, 동일 문서 §9.3).
- `spec/0-overview.md §2.6` 의 Redis 용도 열거: `execution-run` / `execution-continuation` / `background-execution` (BullMQ 큐), `exec:recover:lock` (lock), "KB 채널 등"(비명시).
- 기존 코드베이스 전체(`common/redis/`, `modules/`, `nodes/`)에서 `integration:cache:invalidate` 채널명 사용처는 `integration-cache-bus.service.ts` 단 한 곳이다.

`integration:` prefix 는 현재 기존 키/채널 어디에도 사용된 적 없다. `exec:*` / `bull:*` / `core:*` / `ws:*` prefix 와 namespace 가 명확히 분리된다. 충돌 없음.

### 5. 환경변수·설정키 충돌

target plan 은 신규 ENV var 를 도입하지 않는다(`POOL_IDLE_TIMEOUT_MS`, `POOL_MAX_CONNECTIONS` 는 기존). 충돌 없음.

### 6. 파일 경로 충돌

**신규 파일**: `codebase/backend/src/common/redis/integration-cache-bus.service.ts`

`spec/4-nodes/4-integration/2-database-query.md` frontmatter `code:` 에 이미 등재됐다. `common/redis/` 디렉토리에는 기존 `redis-connection.provider.ts`, `redis.module.ts` 가 있고, `integration-cache-bus.service.ts` 는 이미 존재한다. 파일명은 `{service}-{concept}.service.ts` 컨벤션에 맞으며 기존 파일과 겹치지 않는다. 충돌 없음.

---

## 요약

target 문서(`plan/in-progress/db-pool-creds-pubsub.md`)가 도입하는 신규 식별자(`IntegrationCacheBus`, `integrationCacheBus`, Redis 채널 `integration:cache:invalidate`, 파일 경로 `integration-cache-bus.service.ts`)는 모두 이미 해당 worktree 에서 구현 완료된 상태이며, 기존 spec·코드베이스의 어떤 식별자와도 의미 충돌이 없다. `integration:` Redis namespace 는 기존 `exec:*` / `bull:*` / `core:*` / `ws:*` 와 명확히 분리되고, 타입명 `IntegrationCacheBus` 는 코드베이스 전체에서 유일하다.

## 위험도

NONE
