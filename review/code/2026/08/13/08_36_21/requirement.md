# 요구사항(Requirement) 리뷰 — `clemvion.redis.fail_open` 카운터

## 발견사항

- **[SPEC-DRIFT][WARNING]** NF-OB-07 메트릭 카탈로그 테이블에 신규 카운터 `clemvion.redis.fail_open` 행이 누락됐다.
  - 위치: `spec/5-system/_product-overview.md:81-87` (NF-OB-07 메트릭 카탈로그 표, `클레몬.execution.total`~`clemvion.node.duration` 5행만 존재)
  - 상세: `BusinessMetricsService` 는 이 spec 문서의 NF-OB-07 요구사항("도메인/비즈니스 커스텀 메트릭")이 "아래 카탈로그" 로 지목하는 바로 그 표를 구현체의 단일 진실로 삼는다. 이번 변경은 `codebase/backend/src/modules/metrics/business-metrics.service.ts:69`(`meter.createCounter('clemvion.redis.fail_open', ...)`)와 `:113-115`(`recordRedisFailOpen`)로 이 서비스에 여섯 번째 instrument 를 추가했지만, 카탈로그 표(`spec/5-system/_product-overview.md:81-87`)는 다섯 행 그대로다. 코드 쪽은 의도적이고(뮤테이션 5/5 사살까지 거친) 합리적인 확장이므로 이 자체는 버그가 아니다 — 다만 이 표는 "카탈로그" 로서 존재하는 열거형 spec 본문이라 신규 instrument 가 생기면 동반 갱신돼야 하는데 이번 PR 은 코드 5개 파일만 다루고 `spec/`은 건드리지 않았다.
  - 제안: 코드는 그대로 두고, `project-planner` 경로로 `spec/5-system/_product-overview.md` §5 NF-OB-07 카탈로그 표에 `| \`clemvion.redis.fail_open\` | Counter | \`component\`, \`reason\` | Redis 의존 기능이 fail-open 으로 강등된 사건. \`reason\` ∈ {get_failed, set_failed, serialize_failed, entry_corrupt, payload_corrupt} |` 행을 추가한다.

- **[WARNING]** `BusinessMetricsService.recordRedisFailOpen()` 자체를 직접 검증하는 단위 테스트가 이 변경분에 없다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:113-115` (구현) / `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` (테스트 파일 — 이번 diff 대상 밖, 즉 안 건드림)
  - 상세: `business-metrics.service.spec.ts` 는 `recordExecutionTerminal`·`recordExecutionError`·`recordLlmTokens`·`recordNodeDuration`·queue gauge 등 이 서비스의 **다른 모든 public 기록 메서드**에 대해 mock meter 로 `add`/`record` 호출 인자(카운터 이름·라벨 키·값)를 직접 단언하는 테스트를 갖고 있다. 신규 `recordRedisFailOpen` 만 이 패턴에서 빠졌다. `idempotency.interceptor.spec.ts` 의 새 `describe('IdempotencyInterceptor — fail-open 관측 (metrics)')` 블록(`codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1057-1177`)은 `{ recordRedisFailOpen: jest.fn() }` 로 **메서드 자체를 mock** 하므로, 인터셉터가 이 메서드를 올바른 인자로 호출하는지는 검증하지만 `recordRedisFailOpen` 내부의 `this.redisFailOpen.add(1, { component, reason })`(카운터 인스턴스 이름 `clemvion.redis.fail_open`, 라벨 키 순서 `component`/`reason`)이 실제로 맞는지는 어디에서도 검증되지 않는다. 예를 들어 `meter.createCounter('clemvion.redis.fail_open', …)` 의 이름 오타나 `.add(1, { reason, component })` 로 라벨 키 순서가 뒤바뀌는 회귀는 두 테스트 파일 어느 쪽도 잡지 못한다.
  - 제안: `business-metrics.service.spec.ts` 에 다른 메서드들과 동형으로 `service.recordRedisFailOpen('idempotency', 'get_failed')` → `mock.counters['clemvion.redis.fail_open'].add` 가 `(1, { component: 'idempotency', reason: 'get_failed' })` 로 불렸는지 단언하는 케이스를 추가.

- **[INFO]** 신규 `describe('IdempotencyInterceptor — fail-open 관측 (metrics)')` 블록이, "캐시 키 스코프" describe 블록을 설명하는 기존 JSDoc 주석과 그 대상 `describe` 사이에 삽입되어 문서 블록이 자신이 설명하는 코드에서 130줄 이상 떨어지게 됐다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1033-1047`(`[Spec EIA §R8 "캐시 키 스코프"]` JSDoc, "조회(GET)와 적재(SET)를 **둘 다** 단언한다" 로 끝남) 바로 뒤 `:1048-1056`(신규 "fail-open 관측" JSDoc) → `:1057-1177`(신규 describe) → 그 뒤에야 `:1179`(원래 JSDoc 이 설명하려던 `describe('IdempotencyInterceptor — 캐시 키 스코프 (Spec EIA §R8)')`).
  - 상세: 기능적 결함은 아니다(테스트는 정상 동작). 다만 diff 를 `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', …)` 블록의 닫는 `});` 바로 뒤, 기존 "캐시 키 스코프" 문서-블록과 그 `describe` 사이에 끼워 넣어, 원 문서-코드 인접성이 깨졌다.
  - 제안: 신규 블록을 "캐시 키 스코프" describe 전체가 끝난 뒤(파일 최하단)로 옮기거나, "캐시 키 스코프" 문서-블록보다 앞(`Redis 런타임 장애 fail-open` describe 뒤·`캐시 키 스코프` 문서 앞)으로 옮겨 문서-코드 인접성을 복원.

## 기타 확인 사항 (문제 없음)

- 다섯 fail-open 경로(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`) 모두 `this.metrics?.recordRedisFailOpen(...)` 로 배선됨을 소스 레벨로 확인(`idempotency.interceptor.ts:149,245-248,332,341`). `discardCorruptEntry` 의 `what === '엔트리' ? 'entry_corrupt' : 'payload_corrupt'` 분기가 두 호출부(`엔트리` JSON 파싱 실패/형태 불일치, `payload` 안쪽 JSON 파싱 실패)와 정확히 대응한다.
- `metrics` 생성자 파라미터가 `@Optional()` 이고 `MetricsModule` 이 `@Global`(`metrics.module.ts`)이라 DI 미주입 환경에서도 `?.` 로 안전하게 무동작 — 관련 테스트(`metrics 미주입이어도 fail-open 경로가 죽지 않는다`)로 고정됨.
- 기존 로직(warn 로그, `catchError` 위치, 캐시 판정 순서 등)에는 변경이 없고 각 실패 경로에 `metrics?.recordRedisFailOpen(...)` 호출만 추가돼 회귀 위험이 낮다.
- "정상 경로에서는 카운터가 오르지 않는다" 테스트로 거짓-양성(항상 기록) 회귀를 방지하고, 라벨별 `it.each` + 직렬화 실패 단독 케이스로 다섯 `reason` 이 서로 다른 값으로 갈리는 것도 고정됨 — CHANGELOG.md 의 서술("경로별로 reason 이 갈리는 것이 요점")과 실제 구현·테스트가 일치.
- CHANGELOG.md 신규 항목의 서술(다섯 경로 이름, `OTEL_ENABLED` 미설정 시 no-op meter 동작)은 코드·기존 docstring(NF-OB-07 클래스 주석)과 line-level 로 일치.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크리스트 갱신은 이 PR 의 실제 작업(카운터 추가·5경로 배선·뮤테이션 5/5)과 부합.

## 요약

기능적으로는 완결돼 있다 — `IdempotencyInterceptor` 의 다섯 fail-open 경로 전부에 `clemvion.redis.fail_open{component,reason}` OTel 카운터가 정확한 `reason` 라벨로 배선되고, 정상 경로 비-기록·라벨 분기·optional DI 안전성까지 인터셉터 레벨 테스트로 고정돼 있다. 다만 (1) NF-OB-07 메트릭 카탈로그 spec 표가 신규 instrument 를 반영하지 않은 SPEC-DRIFT, (2) `BusinessMetricsService.recordRedisFailOpen()` 자체(카운터 이름·라벨 키)를 직접 검증하는 단위 테스트가 이 서비스의 다른 모든 메서드와 달리 빠져 있는 커버리지 갭이 남아 있다. 둘 다 코드 동작 자체를 위협하지는 않지만 전자는 spec 이 카탈로그로서의 신뢰성을 잃고, 후자는 인터셉터의 mock 뒤에 숨어 서비스 자체의 회귀(오타·라벨 순서)를 잡을 안전망이 없다.

## 위험도

LOW
