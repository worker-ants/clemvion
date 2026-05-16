# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `integrationLocks` Map — 모듈 수명 동안 누적되는 전역 Map
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `integrationLocks` 모듈-레벨 선언 및 `withIntegrationLock`
  - 상세: `integrationLocks` 는 모듈 스코프의 `Map<string, Promise<unknown>>` 으로 선언되어 있고, 잠금이 끝나면 `finally` 에서 항목을 지우도록 설계되어 있다. cleanup 로직은 `integrationLocks.get(integrationId) === tracked` 조건이 맞을 때만 삭제하므로 대부분의 경우 정상적으로 회수된다. 그러나 프로세스가 오래 살고 동일 `integrationId` 에 대해 잠금이 중첩 체인으로 쌓이는 과정에서 `tracked` 참조 비교가 경쟁 조건으로 빗나가면(예: 빠른 연속 호출에서 `next` 와 `tracked` 의 resolve 순서가 꼬이는 엣지) 해당 항목이 Map 에 잔류할 가능성이 낮지만 존재한다. 운영 수준의 메모리 누수 위험은 낮으나, NestJS 단일 인스턴스가 수천 개의 서로 다른 Integration ID 를 처리할 때 Map 크기가 증가할 수 있다.
  - 제안: 현재 설계는 충분히 안전하며 즉각적인 수정 필요성은 없다. 모니터링 측면에서 주기적으로 `integrationLocks.size` 를 로깅하거나 메트릭으로 노출하면 누수 여부를 조기에 감지할 수 있다.

- **[INFO]** `refreshViaQueue` 내에서 `integrationRepository.findOne` 이 최대 2회 호출될 수 있음
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `refreshViaQueue` 메서드
  - 상세: `waitUntilFinished` 가 타임아웃으로 실패할 경우 catch 블록에서 `integrationRepository.findOne` 을 한 번 호출하고(`fresh` 획득), 이후 try-catch 외부에서 다시 `findOne` 을 한 번 더 호출한다. 즉 타임아웃이 발생한 정상 경로에서 DB를 2번 읽는다. 이 경로는 드문 Redis 히컵 상황에서만 발생하므로 정상 운영 중에는 문제가 없지만, 해당 분기에서는 첫 번째 조회 결과를 재사용하면 불필요한 쿼리 1회를 줄일 수 있다.
  - 제안: catch 블록 내에서 `auth_failed` / token-fresh 판단을 마치고 "성공으로 처리" 케이스라면 이미 획득한 `fresh` 를 리턴하거나 outer scope 로 올려 두 번째 `findOne` 을 생략한다. 빈도가 낮아 긴급 수정 사항은 아니다.

- **[INFO]** `recordNetworkFailure` / `resetNetworkFailures` — 매 API 호출마다 DB UPDATE 발생
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `recordNetworkFailure`, `resetNetworkFailures`, `executeWithRateLimit`
  - 상세: `executeWithRateLimit` 의 응답 성공 경로에서 항상 `resetNetworkFailures` 를 호출한다. `resetNetworkFailures` 는 `consecutiveNetworkFailures === 0` 이면 조기 반환하므로 카운터가 0인 일반 호출에는 DB 쿼리가 발생하지 않는다. 이 설계는 올바르다. 다만 카운터가 1 또는 2인 상태에서 성공 호출이 들어오면 UPDATE 가 발생하며, 이는 의도된 동작이다. 현재 구현에서 성능 문제는 없고 설계가 적절하다.
  - 제안: 현재 구현으로 충분. 별도 조치 불필요.

- **[INFO]** `integration-expiry-scanner.service.ts` — `enqueueCafe24BackgroundRefresh` 의 전체 결과를 메모리에 로드
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` — `enqueueCafe24BackgroundRefresh` 내 `integrationRepository.find(...)`
  - 상세: `serviceType='cafe24' AND status='connected' AND lastRotatedAt < cutoff OR IS NULL` 조건으로 전체 대상 행을 `select: ['id', 'lastRotatedAt']` 로 한 번에 메모리에 로드한 뒤 반복하며 BullMQ 에 enqueue 한다. 현재는 select 컬럼을 `id`, `lastRotatedAt` 두 컬럼으로 최소화하고 V050 마이그레이션에서 해당 쿼리를 위한 부분 인덱스(`idx_integration_cafe24_connected_rotated`)를 추가하여 DB 조회 성능은 최적화되어 있다. 그러나 Cafe24 연동 수가 수만 건으로 늘어날 경우 결과 집합이 메모리에 한 번에 올라오는 문제는 잠재적으로 남아 있다.
  - 제안: 단기적으로는 현재 규모에서 문제없다. 연동 수가 크게 늘어날 것으로 예상되면 커서/페이지네이션 기반 배치 처리(`find({ skip, take })` + 반복 루프)로 전환하는 것을 고려한다.

- **[INFO]** V050 — `CREATE INDEX CONCURRENTLY` 는 `executeInTransaction=false` 설정 필요 (이미 반영됨)
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf`, `V050__integration_cafe24_connected_rotated_idx.sql`
  - 상세: `CONCURRENTLY` 옵션을 사용하면 트랜잭션 블록 안에서 실행할 수 없다. `.conf` 파일에 `executeInTransaction=false` 가 명시되어 있어 Flyway 가 이를 트랜잭션 외부에서 실행하도록 설정되어 있다. 인덱스도 부분 인덱스(`WHERE service_type = 'cafe24' AND status = 'connected'`)로 선언하여 크기가 최소화되어 있으며, `IF NOT EXISTS` 로 멱등성도 보장된다. 성능 관점에서 올바른 구현이다.
  - 제안: 이미 최적 구현. 추가 조치 불필요.

- **[INFO]** 대량 스키마 메시지 문자열 교체 — 런타임 성능에 영향 없음
  - 위치: 파일 20~80 전반 — `*.schema.ts` 의 `warningRules[].message` 영문 전환
  - 상세: 이번 변경의 대부분은 노드 스키마 파일에서 Korean 경고 메시지를 English 로 교체하는 작업이다. 메시지는 정적 문자열 상수이므로 런타임 성능에 전혀 영향이 없다.
  - 제안: 해당 없음.

- **[INFO]** `make e2e-*` — `--build` 플래그로 매 실행 시 Docker 이미지 재빌드
  - 위치: `Makefile` — `e2e-up`, `e2e-test`, `e2e-test-full` 타겟
  - 상세: `--build` 추가로 매 실행 시 Docker 이미지를 재빌드한다. 코멘트에서 "BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 부담은 작다"고 설명하고 있으며, 실제로 코드 변경이 없을 때 레이어 캐시 히트율이 높아 추가 오버헤드는 적다. 그러나 `e2e-test` 가 `e2e-up` 을 내부적으로 호출하면서 `--build` 를 두 번 트리거하는 것이 아닌지 확인이 필요하다. 현재 Makefile 구조상 `e2e-test` 는 `$(COMPOSE_E2E) up -d --wait --build backend-e2e` 를 직접 호출하고, `$(MAKE) e2e-down` 을 명시적으로 연결하므로 이중 빌드는 발생하지 않는다. CI 환경에서 Docker 레이어 캐시가 없는 경우 매번 전체 빌드가 발생하여 `e2e-test` 수행 시간이 늘어날 수 있다.
  - 제안: CI 에서 Docker BuildKit 레이어 캐시를 `cache-from`/`cache-to` 옵션으로 명시적으로 마운트하면 `--build` 의 오버헤드를 최소화할 수 있다. 현재는 개발 환경 최적화로 충분하다.

---

## 요약

이번 변경에서 성능 관점의 주요 신규 코드는 (1) `Cafe24ApiClient` 의 연속 네트워크 실패 카운터(`consecutiveNetworkFailures`) 관련 DB UPDATE 경로, (2) `IntegrationExpiryScannerService.enqueueCafe24BackgroundRefresh` 의 OR 조건 확장 및 V050 부분 인덱스 추가, (3) `refreshViaQueue` 의 타임아웃 복구 경로에서의 이중 `findOne` 이다. 카운터 UPDATE 는 `consecutiveNetworkFailures === 0` 일 때 조기 반환하여 정상 경로에서의 불필요한 쿼리를 방지하고 있으며, 부분 인덱스는 쿼리 성능을 적절히 보호한다. 이중 `findOne` 은 드문 경로(Redis 타임아웃)에서만 발생하므로 실질적 영향은 미미하다. `integrationLocks` Map 의 best-effort cleanup 은 누수 리스크가 낮게 관리되고 있다. 나머지 대부분의 변경은 경고 메시지 문자열 교체로 런타임 성능과 무관하다. 전반적으로 이번 변경의 성능 위험도는 낮다.

---

## 위험도

LOW
