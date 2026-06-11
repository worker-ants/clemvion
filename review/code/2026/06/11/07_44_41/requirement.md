# Requirement Review — Integration Cache Bus (refactor 04 m-4)

## 발견사항

---

### [SPEC-DRIFT] [WARNING] `spec/4-nodes/4-integration/2-database-query.md §4.2` 가 broadcast 트리거 목록을 과하게 열거

- **위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 본문 (멀티 인스턴스 무효화 단락)
- **상세**: spec §4.2 본문은 broadcast 트리거로 `rotate/update/remove/reauthorize/OAuth 토큰 갱신` 전부를 열거한다. 그러나:
  - `update` 는 `UpdateIntegrationDto`가 `name` 필드만 허용하도록 설계돼 있어 자격증명이 바뀌지 않는다. 코드의 `broadcastCredentialChange` JSDoc 은 이를 명시적으로 설명하며 `update` 를 제외한다.
  - `reauthorize` / `OAuth 토큰 갱신` 은 OAuth 자격증명을 갱신하는데, DB/Email 같은 풀-캐시 소비자는 OAuth 자격증명을 쓰지 않아 구독자 부재 — broadcast 해도 아무 효과가 없다. 코드는 이 경우도 broadcast 하지 않는다.
  - `spec/data-flow/5-integration.md §1.1` 본문(line 69–74)은 `rotate` 와 `remove` 만 broadcast 트리거로 정확히 명시해 코드와 일치한다.
  - 결론: `database-query.md §4.2` 의 트리거 목록이 `data-flow/5-integration.md` 및 코드 구현보다 과하게 포괄적으로 기술돼 있다. 코드가 합리적이고 의도적인 정제이며, 되돌리는 것이 오답이다.
- **제안**: 코드 유지. `spec/4-nodes/4-integration/2-database-query.md §4` 멀티 인스턴스 무효화 단락의 트리거 목록을 `rotate(회전)` 와 `remove(삭제)` 만으로 축소하고, `update`(name 변경 전용) · `reauthorize` / OAuth 토큰 갱신(풀-캐시 소비자 비해당)이 제외되는 이유를 명시하도록 project-planner 에게 spec 반영 위임.

---

### [INFO] e2e 테스트 — `received` 배열 미초기화로 테스트 간 오염 가능성 이론적 존재

- **위치**: `codebase/backend/test/integration-cache-invalidate.e2e-spec.ts` — `const received: string[] = []` (describe 스코프)
- **상세**: `received` 배열이 describe 스코프에서 한 번 선언되고 `beforeEach` 로 초기화되지 않는다. 테스트 A 가 broadcast 한 `integrationId` 가 배열에 남은 상태로 테스트 B 가 실행된다. 다만 각 테스트가 `uniqueName` 으로 고유한 `integrationId` 를 생성해 교차 오염이 실제 false-positive 로 이어질 가능성은 없다. 명시적 `beforeEach(() => received.length = 0)` 추가는 이론적 방어 코드.
- **제안**: 현재 동작에는 문제없음. 테스트 격리를 명확히 하려면 `beforeEach` 또는 `afterEach` 에서 `received.length = 0` 추가. 선택 사항.

---

### [INFO] 단위 테스트 — `onModuleInit` 의 subscribe reject 분기 테스트 부재

- **위치**: `codebase/backend/src/common/redis/integration-cache-bus.service.spec.ts`
- **상세**: `subscribe` 자체가 거부(reject)되는 경우(Redis 연결 가능하지만 subscribe 명령 실패)는 직접 테스트되지 않는다. 프로덕션 코드는 `.catch(...)` 로 처리하므로 동작상 문제는 없으나 해당 경고 로그 경로가 테스트에서 확인되지 않는다.
- **제안**: 선택 사항. 현 커버리지(Redis unavailable 분기 + register/dispatch 흐름)는 충분. 보완이 필요하다면 `sub.subscribe.mockRejectedValueOnce(new Error('sub fail'))` 케이스 추가.

---

### [INFO] `IntegrationCacheBus` 가 `IntegrationsService` 생성자에 required로 주입됨

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts:385` — `private readonly integrationCacheBus: IntegrationCacheBus` (non-optional)
- **상세**: `@Optional()` 없이 required dependency 로 선언됐다. `IntegrationCacheBus` 는 `@Global()` `RedisModule` 이 export 하므로 프로덕션 DI 에서는 항상 주입된다. `IntegrationsModule` 에 `RedisModule` 을 명시 import 하지 않아도 `@Global` 덕분에 해결된다. 기존 단위 테스트 픽스처는 mock 을 생성자에 전달해야 하는데, 이번 PR 의 `integrations.service.spec.ts` 는 이를 정확히 처리하고 있다.
- **제안**: 현재 구조에 문제 없음. 다만 신규 단위 테스트 작성 시 `integrationCacheBus` mock 필수 제공 주의.

---

## 요약

이번 변경은 `IntegrationCacheBus` 를 통한 멀티 인스턴스 자격증명 캐시 무효화 기능을 완전하게 구현한다. `publish` fail-safe·subscribe 분리(duplicate 연결)·invalidator 격리(sync throw + async reject 모두 삼킴)·onModuleDestroy cleanup 모두 의도에 부합한다. `IntegrationsService.rotate` 와 `remove` 의 broadcast 호출 위치, `DatabaseQueryHandler` 의 등록 로직, NestJS 모듈 배선, 단위·e2e 테스트 커버리지가 일관적으로 구현됐다. 가장 주목할 발견은 `spec/4-nodes/4-integration/2-database-query.md §4.2` 의 broadcast 트리거 목록이 실제 코드 범위보다 과하게 열거돼 있는 SPEC-DRIFT 로, 코드는 옳고 spec 본문이 갱신돼야 한다. `data-flow/5-integration.md` 는 이미 코드와 일치하므로 영역 spec 1건만 수정 필요.

## 위험도

LOW
