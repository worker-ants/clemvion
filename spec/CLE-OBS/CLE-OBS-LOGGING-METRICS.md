---
id: "CLE-OBS-LOGGING-METRICS"
title: "로깅과 헬스 체크 — 메트릭과 트레이싱"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-OBS-LOGGING"
ancestors: ["CLE-VISION", "CLE-OBS", "CLE-OBS-LOGGING"]
area: "CLE-OBS"
content_hash: "a82aa250501cdf28d865100c2b02e10490acad3ceff5effcb578f2a72d27ea77"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/3-error-handling.md", "spec/5-system/_product-overview.md", "spec/data-flow/9-observability.md"]
mirror_sha256: "603c17da8737ae447cf2b587f2d6ae62dc8eaea442ba64347969fab15c796240"
etag: "sha256-24d4447927c2d01292113344bd13c976d0b23d140840f17f126c071cf239d3da"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/3-error-handling.md`, `spec/data-flow/9-observability.md`, `spec/5-system/_product-overview.md` (§5 관측성) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [로깅과 헬스 체크](CLE-OBS-LOGGING.md) 의 하위 문서로 OTel 메트릭 · 트레이싱 수집, 비즈니스 메트릭(`clemvion.*`) 카탈로그와 라벨 규칙, `clemvion.redis.fail_open` 의 (component, reason) 쌍을 정한다. 부수 기록 실패를 흡수하는 방식은 부모 문서의 「부수 기록 실패 흡수」가 정한다.

## 수집

- `OTEL_ENABLED=true` 일 때 켜진다.
- OTel MeterProvider 와 `@opentelemetry/exporter-prometheus`(`instrumentation.ts`)가 Prometheus 수집 서버의 `/metrics` 로 내보낸다. 주소는 `OTEL_PROMETHEUS_HOST`·`OTEL_PROMETHEUS_PORT` 이고 기본값은 `127.0.0.1:9464` 다. 수집 주소와 아래 트레이스 엔드포인트의 기본값은 이 문서가 기준이다. [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 은 요구사항만 정한다.
- 자동 수집: auto-instrumentation 의 HTTP 서버 메트릭과 `instrumentation-runtime-node` 의 런타임 메트릭(event loop, GC, heap).
- 도메인·비즈니스 메트릭은 아래 카탈로그다.

## 트레이싱

`OTEL_ENABLED=true` 일 때 분산 트레이싱이 켜진다. OTLP HTTP exporter 의 기본 엔드포인트는 `/v1/traces` 다.

## 비즈니스 메트릭 카탈로그

`OTEL_ENABLED=true` 일 때 `BusinessMetricsService` 가 `metrics.getMeter('clemvion.business')` 로 계측한다(`business-metrics.service.ts`). OTel instrument 이름은 점 표기(`clemvion.*`)이고 Prometheus exporter 가 `clemvion_*` 로 바꾼다. 모든 라벨은 값의 가짓수가 제한돼야 한다(enum, 등록된 모델 수, 노드 타입, 표준 에러 코드).

라벨을 닫는 방법은 둘이다.

1. 소스에 코드 리터럴 유니온이 있으면 그 유니온으로 **타입에서** 닫는다(`clemvion.redis.fail_open` 의 `component` 와 component 별 `reason`).
2. 소스 시그니처가 이미 `string` 이라 컴파일러가 닫힘을 증명하지 못하는 라벨(`error_code`, `resource_type`)은 값 길이를 64자로 **잘라** 방어한다. 증명되지 않은 닫힘을 타입으로 주장하지 않는다.

| 메트릭 | 종류 | 라벨 | 뜻 |
| --- | --- | --- | --- |
| `clemvion.execution.total` | Counter | `status`(`completed`·`failed`·`cancelled`) | 워크플로우 실행이 종료 상태로 바뀐 수. 에러율 = `rate(...{status="failed"}) / rate(...)` |
| `clemvion.execution.errors` | Counter | `error_code` | 실패 종료를 에러 코드별로 나눈다. `status` 라벨만으로는 원인을 나눌 수 없어서 둔다 |
| `clemvion.queue.depth` | ObservableGauge | `queue`, `state`(`waiting`·`active`·`delayed`·`failed`) | BullMQ 큐 깊이. 주기적인 observable callback 이 `getJobCounts` 로 관측한다. BullMQ 6 부터 일시 정지된 큐의 대기 job 도 `state=waiting` 으로 센다. 시스템 상태 API 와 달리 `paused` 를 합성하지 않는다([시스템 상태](CLE-OBS-STATUS.md#bullmq-6-에서-paused-를-합성한다)) |
| `clemvion.llm.tokens` | Counter | `model`, `type`(`input`·`output`·`thinking`) | LLM 토큰 사용량. 모든 `LlmService.chat`·`chatStream` 이 거치는 `LlmUsageLogService.record` 한 곳에서 계측한다([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)) |
| `clemvion.node.duration` | Histogram(ms) | `node_type`, `status` | 노드 실행 지연. 실행이 끝날 때 그 실행의 `node_execution.duration_ms` 로 기록한다 |
| `clemvion.redis.fail_open` | Counter | `component`, `reason`(쌍은 [Redis fail-open 라벨](#redis-fail-open-라벨)) | Redis 에 기대는 기능이 fail-open 으로 물러난 횟수. fail-open 은 "요청을 살린다" 와 "장애를 보이게 한다" 가 한 쌍인데 경고 로그만으로는 비율·추세로 경보를 걸 수 없어 둔다. 경보 예: `rate(clemvion_redis_fail_open[5m]) > 0` |
| `clemvion.audit.write_failed` | Counter | `resource_type`(감사 대상 리소스 종류. 코드가 정하는 값이고 실측으로 서로 다른 값 10종: `user`·`trigger`·`workflow`·`schedule`·`member`·`workspace`·`integration`·`model_config`·`auth_config`·`execution`. 감사 기록 위치 파일 수 12 와 다른 수치다. 소스 시그니처가 `string` 이라 64자로 잘라 방어한다) | 감사 로그 적재가 실패해 흡수된 횟수. `AuditLogsService.record()` 는 감사 실패가 본 요청(교체·삭제 같은 특권 작업)을 깨지 않도록 예외를 흡수한다. 경고 로그만으로는 "작업은 200 으로 성공했는데 감사 행만 조용히 비어 있음" 이 보이지 않는다. 감사 로그가 지탱하는 "계정 탈취 뒤 조용한 시크릿 교체를 재구성한다" 는 신뢰는 적재가 실제로 됐을 때만 성립한다. 경보 예: `rate(clemvion_audit_write_failed[5m]) > 0` |

### Redis fail-open 라벨

`clemvion.redis.fail_open` 은 Redis 명령이 실패해 그 기능이 Redis 없이 진행한 경우를 센다. 동작 하나가 물러날 때 한 번 센다. 한 요청 안에서 명령 여러 개가 실패해도 한 번이다. Redis 가 설정되지 않아 기능이 처음부터 꺼진 경우(클라이언트 없음)와 연결 초기화 실패는 장애가 아니라 구성 상태라서 세지 않는다. Redis 와 무관한 실패(저장된 값의 JSON 파싱 실패, 이벤트 핸들러 오류, 연결 종료 실패)도 세지 않는다. 캐시 내용의 손상을 전용 reason 으로 세는 것은 EIA 멱등 캐시뿐이다.

| `component` | 기능 | `reason` |
| --- | --- | --- |
| `idempotency` | EIA 멱등 캐시 | `get_failed` · `set_failed` · `serialize_failed` · `entry_corrupt` · `payload_corrupt` |
| `chat_conversation` | 채팅 채널 대화 상태와 폼 제출 잠금 | `get_failed` · `set_failed` · `del_failed` · `cas_failed` · `lock_failed` · `unlock_failed` |
| `chat_dedup` | 채팅 채널 update 중복 억제 | `set_failed` · `del_failed` |
| `chat_rate_limit` | 채팅 채널 대화별 rate limit | `incr_failed` |
| `chat_listener_bus` | 채팅 채널 리스너 등록을 인스턴스 사이에 알리는 pub/sub | `publish_failed` · `subscribe_failed` |
| `interaction_rate_limit` | EIA 인터랙션 rate limit | `incr_failed` |
| `token_blacklist` | EIA 인터랙션 토큰 blacklist | `get_failed` · `set_failed` |
| `outbound_rate_limit` | EIA 외부 알림 발송 rate limit | `incr_failed` |
| `sse_fanout` | EIA SSE 이벤트 버퍼와 인스턴스 사이 전달 | `write_failed` · `read_failed` · `slot_failed` · `publish_failed` · `subscribe_failed` |
| `public_webhook_quota` | 공개 웹훅 quota | `incr_failed` |
| `cafe24_install_lockout` | Cafe24 앱 설치 실패 잠금 | `get_failed` · `incr_failed` |
| `cafe24_install_nonce` | Cafe24 앱 설치 nonce | `set_failed` |
| `execution_seq` | WebSocket 실행 이벤트 순번 할당 | `incr_failed` · `del_failed` |
| `integration_cache_bus` | 통합 캐시 무효화를 인스턴스 사이에 알리는 pub/sub | `publish_failed` · `subscribe_failed` |

`reason` 은 실패한 Redis 동작이고 component 사이에 같은 이름을 쓴다.

- `get_failed` · `set_failed` · `del_failed`: 값 조회 · 저장 · 삭제
- `incr_failed`: 고정 창 카운터 증가. 창 TTL 설정과 조회도 포함한다. 증가는 됐고 TTL 설정만 실패한 경우는 기능이 Redis 없이 진행한 것이 아니라서 세지 않는다
- `cas_failed`: 비교 후 교체
- `lock_failed` · `unlock_failed`: 잠금 획득 · 해제
- `publish_failed` · `subscribe_failed`: pub/sub 발행 · 구독. 구독 연결 오류, 재구독 실패, 구독 해제 실패도 `subscribe_failed` 다
- `write_failed` · `read_failed` · `slot_failed`: SSE 버퍼 쓰기(TTL 설정 포함), 버퍼와 순번 읽기, 연결 상한 슬롯의 획득 · 갱신 · 해제. 버퍼 쓰기와 함께 보내는 live 발행이 실패하면 `publish_failed` 다
- `serialize_failed` · `entry_corrupt` · `payload_corrupt`: EIA 멱등 캐시에만 있다. 응답 직렬화 실패, 캐시 엔트리 손상, 캐시 payload 손상이다

- component 마다 낼 수 있는 `reason` 이 정해져 있다. 표에 없는 쌍은 나오지 않는다.
- SSE fanout 은 같은 동작의 경고 로그를 복구될 때까지 한 번만 남긴다. 카운터는 실패마다 센다.
- 구독 연결의 오류는 오류 이벤트마다 센다. ioredis 는 재연결을 시도할 때마다 오류를 내고, 같은 장애로 SUBSCRIBE 가 거부되면 그것도 센다. 그래서 장애 한 번이 여러 번 세질 수 있다. `subscribe_failed` 는 건수보다 증가율로 본다.
- 보안 판단이 함께 물러나는 쌍이 있다. `token_blacklist`/`get_failed` 이면 취소한 인터랙션 토큰이 통과하고, `cafe24_install_lockout`/`get_failed` 이면 설치 실패 잠금이 풀린다. 이 둘은 component 를 지정한 경보를 따로 두는 편이 낫다. 경보 예: `rate(clemvion_redis_fail_open{component="token_blacklist"}[5m]) > 0`

## 통계 API 와 역할을 나눈다

실행 수와 LLM 사용량은 DB 집계 기반 [통계](CLE-OBS-STATS.md) API 에서도 볼 수 있다. 둘은 서로 보완하고 역할이 다르다.

- OTel·Prometheus 는 실시간 운영 감시와 경보(Grafana 대시보드, Prometheus 경보 규칙)에 쓰는 rate·gauge 지표다.
- 통계 API 는 제품 분석과 과거 추세의 기준이다. 워크스페이스 단위 정확 집계, 기간 필터, 차트를 준다.

OTel 메트릭은 운영 관측을 돕는 보조 노출이며 제품 데이터의 기준이 아니다.

## 구현 위치

모두 `codebase/backend/src/` 아래다.

- `instrumentation.ts` (OTel 메트릭 · 트레이스 수집)
- `modules/metrics/business-metrics.service.ts` (비즈니스 메트릭 카탈로그, `RedisFailOpenReasonMap`)
- Redis fail-open 기록 호출부(`recordRedisFailOpen`):
  - `modules/external-interaction/`: `idempotency.interceptor.ts` · `interaction-rate-limiter.service.ts` · `interaction-token.service.ts` · `outbound-notification-rate-limiter.service.ts` · `sse-fanout.service.ts`
  - `modules/chat-channel/`: `channel-conversation.service.ts` · `chat-channel-dedup.service.ts` · `chat-channel-rate-limiter.service.ts` · `channel-listener.bus.ts`
  - `modules/hooks/public-webhook-quota.service.ts`
  - `modules/integrations/`: `cafe24-install-rate-limit.service.ts` · `cafe24-install-nonce-cache.service.ts`
  - `modules/websocket/execution-seq-allocator.service.ts`
  - `common/redis/integration-cache-bus.service.ts`

## Rationale

### `clemvion.redis.fail_open` 의 `component` 는 실제로 연결한 값만 둔다

연결하지 않은 소비자를 라벨에 미리 적으면 문서가 구현보다 넓어진다. 경보를 거는 사람이 영원히 오르지 않는 시계열을 감시하게 되고 "이 값이 0 이다" 가 정상인지 계측이 없는 것인지 구분되지 않는다.

그래서 라벨 값 집합은 코드의 선언(`RedisFailOpenReasonMap`, component 별 reason)이 정하는 닫힌 집합과 1:1 로 맞춘다. 새 소비자를 연결할 때는 선언과 [Redis fail-open 라벨](#redis-fail-open-라벨) 표를 **함께** 넓힌다. 이 "함께" 는 기계가 확인하지 않는다. 코드 가드(`redis-fail-open-catalog.spec.ts`)는 선언한 (component, reason) 쌍마다 호출부가 있는지만 보고 이 표를 읽지 않는다. 표와 코드의 정합은 구현을 마친 뒤의 일관성 검토가 보며 강제하지는 않는다. 라벨을 `string` 으로 열어 두지 않는 이유도 같다. 외부 문자열이 라벨에 실리면 Prometheus 시계열 가짓수가 폭발한다.

이 원칙은 코드 유니온이 있는 라벨에 적용한다. 소스 시그니처가 이미 `string` 인 라벨(`clemvion.execution.errors` 의 `error_code`, `clemvion.audit.write_failed` 의 `resource_type`)은 유니온을 주장하지 않고 값 길이를 64자로 잘라 가짓수를 방어한다. 증명되지 않은 닫힘을 타입으로 적으면 다음 사람이 그것을 믿고 길이 제한을 지운다.

### Redis fail-open 을 13곳 더 연결하고 reason 을 동작 이름으로 정했다 (2026-11-12)

대상은 Redis 명령이 실패하면 잡고 계속 진행하는 서비스다. 처음에는 EIA 멱등 캐시 하나만 연결돼 있었다. 직접 fail-open 하는 서비스를 찾아 13곳을 연결했고 범위는 사람이 정했다(전부 이번에 연결, NERV Task `CLE-T-7ER0Y0`).

- **세는 기준.** Redis 명령의 런타임 실패만 센다. Redis 미설정으로 기능이 꺼진 상태는 배포마다 고정이라 비율 경보의 대상이 아니다. 그 상태까지 세면 설정하지 않은 환경에서 카운터가 요청마다 올라 장애 신호와 섞인다.
- **reason 은 실패한 동작 이름이다.** component 마다 고유한 이름을 붙이면 "조회가 실패한 곳 전부" 처럼 동작으로 묶는 질의를 쓸 수 없다. EIA 멱등 캐시의 `serialize_failed` · `entry_corrupt` · `payload_corrupt` 는 Redis 동작이 아니라 캐시 내용의 문제라 그대로 둔다.
- **reason 집합은 component 마다 따로 닫는다.** 한 유니온에 모든 reason 을 두면 rate limiter 가 `lock_failed` 를 내도 타입이 막지 못해 "호출부가 없는 라벨" 이 다시 생길 수 있다.
- **가드는 (component, reason) 쌍 단위로 본다.** component 단위로만 보면 reason 하나를 빠뜨린 배선이 통과한다.
- **가드는 이 표를 읽지 않는다.** 가드가 이 문서 미러의 표를 읽게 되살리는 안을 기각했다. 사람 결정이다(NERV Task `CLE-T-DM3AXQ` 항목 14, 2026-11-12). 미러는 구현 PR 이 받은 스냅샷이라 승인 시점과 코드 머지 시점을 맞춰야 하고 표기도 사람이 쓰는 문서 형식에 묶인다.
- **구독 오류는 장애 건수가 아니라 이벤트 수로 센다.** 장애 건수를 세려면 구독 연결의 상태를 따로 추적해야 한다. 경보는 증가율로 걸므로 이벤트 수로 충분하다.
- **기각: 서비스마다 카운터를 따로 둔다.** 경보 규칙이 서비스 수만큼 늘고 새 서비스를 연결할 때마다 경보를 새로 걸어야 한다. 카운터 하나에 `component` 라벨을 두면 `rate(clemvion_redis_fail_open[5m]) > 0` 하나로 전부를 본다.
