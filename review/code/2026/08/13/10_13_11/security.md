# Security Review — `clemvion.redis.fail_open` 관측 메트릭 (3차 라운드)

## 리뷰 범위 및 방법

- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` / `.spec.ts`
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` / `.spec.ts`
- `plan/in-progress/backend-lint-gate-broken-on-main.md`
- `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` (신규)
- `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`
- `review/code/2026/08/13/{08_36_21,09_57_11}/**`, `review/consistency/2026/08/13/{09_36_31,09_48_44}/**` — 이전 리뷰/consistency-check 라운드의 산출물(메타 문서, 소스 코드 아님)

프롬프트 diff 가 잘려 있어 `idempotency.interceptor.ts`, `business-metrics.service.ts` 는 `Read` 로 워크트리 원본을 전체 열어 대조했다. 이번 changeset 은 이전 리뷰 세션(`08_36_21` → `09_57_11`)이 지적한 WARNING/INFO 에 대한 조치 결과물이 대부분이며, 신규 실질 코드는 `IdempotencyInterceptor` 의 다섯 fail-open 경로에 OTel 카운터(`clemvion.redis.fail_open`)를 배선하는 순수 observability 추가다.

## 발견사항

- **[INFO]** (해소 확인) `recordRedisFailOpen` 라벨 파라미터가 이제 리터럴 유니온으로 닫혀 있다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38`(`RedisFailOpenComponent`), `:41-46`(`RedisFailOpenReason`), `:134-139`(`recordRedisFailOpen` 시그니처)
  - 상세: 이전 라운드(`08_36_21`)에서 이 리뷰어를 포함해 다수 reviewer 가 "`docstring` 은 '닫힌 집합' 이라 주장하는데 시그니처는 평범한 `string`" 이라고 지적했다(INFO/WARNING). 현재 소스를 직접 열어 확인한 결과, `component: RedisFailOpenComponent`(`'idempotency'` 단일 리터럴) / `reason: RedisFailOpenReason`(5개 리터럴 유니온) 로 시그니처가 좁혀져 있고, 호출부(`idempotency.interceptor.ts:29,154,250-253,337,346`)는 전부 `METRICS_COMPONENT` 상수 또는 하드코딩 리터럴만 사용한다. 사용자 입력·에러 메시지가 라벨에 흘러들 경로는 없다 — Prometheus label-cardinality 폭발(가용성 저하) 표면이 타입 레벨에서 닫혔다. `recordExecutionError`(같은 파일 `:112-116`)의 런타임 `.substring(0,64)` 클램핑과 대비되던 방어 비대칭도 이번 변경으로 해소됐다.
  - 제안: 조치 불요. 향후 다른 `component` 를 추가할 때 유니온 확장이 자연스러운 코드 리뷰 지점이 되도록 유지할 것(`plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` 후속 항목이 이미 명시).

- **[INFO]** 캐시 payload·요청 body·Redis 인증정보가 새 관측 경로에 실리지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `discardCorruptEntry()`(:242-255), `storeEntry()`(:319-348) catch 블록의 `this.metrics?.recordRedisFailOpen(...)` 호출부
  - 상세: 다섯 호출 모두 고정 문자열(`'idempotency'`, `'get_failed'` 등)만 인자로 넘긴다. 캐시 엔트리 값은 여전히 `describeShape()`(:394-399, 타입 이름만 문자열화)로만 로그에 남고, `logger.warn` 의 `err.message`(ioredis 에러 메시지)도 이번 diff 가 새로 연 표면이 아니라 기존 fail-open 경로의 기존 동작이다.
  - 제안: 조치 불요.

- **[INFO]** DI 시그니처 확장(`@Optional() metrics?: BusinessMetricsService`)이 인증/인가·캐시 키 스코프 로직에 개입하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:103`
  - 상세: `intercept()` 의 `executionId`+`route`+`rawKey` 캐시 키 스코프 계산(:110-140), `ConflictException`/`HttpException` 재현 로직(:190-224)은 이번 diff 로 변경되지 않았다. `metrics` 는 기존 파라미터 순서(하위 호환) 뒤에 trailing `@Optional()` 로만 추가됐고, 미주입 시 `this.metrics?.` optional chaining 으로 안전하게 무동작한다(회귀 테스트로 고정).
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음 (전 대상 파일 확인)
  - 위치: `CHANGELOG.md`, `plan/in-progress/*.md`(신규 spec draft 포함), `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`, `idempotency.interceptor.{ts,spec.ts}`, `business-metrics.service.{ts,spec.ts}`, `review/code/**`·`review/consistency/**` 신규 산출물
  - 상세: `api[_-]?key|secret|password|token|bearer|authorization|BEGIN ... PRIVATE KEY` 패턴으로 전 대상 grep — 매치는 전부 `clemvion.llm.tokens`/`inputTokens`/`tokenFamily` 같은 메트릭·필드 식별자였고 실제 자격증명 문자열은 없었다.
  - 제안: 조치 불요.

- **[정보성 확인 — 문제 없음]** `review/**`, `spec/**`, `plan/**` 하위 신규/변경 파일은 이번 changeset 이 규약상 생성해야 하는 산출물(구현 완료 후 상시 강제 `/ai-review` + resolution, SPEC-DRIFT planner 인계)이며 별도 보안 표면을 열지 않는다 — 전부 markdown/JSON 메타 문서다.

## 요약

이번 changeset 은 `IdempotencyInterceptor` 의 다섯 fail-open 경로에 OTel 카운터(`clemvion.redis.fail_open`)를 배선하는 순수 observability 추가이며, 코드 변경 범위는 이전 두 라운드(`08_36_21`, `09_57_11`)의 security 리뷰가 이미 NONE 으로 판정한 표면과 동일하다. 원본 파일을 직접 열어 재확인한 결과, 이전 라운드가 지적했던 유일한 보안 관련 관찰 — `recordRedisFailOpen` 의 라벨 파라미터가 "닫힌 집합" 이라 문서화됐음에도 타입이 평범한 `string` 이었던 점 — 은 리터럴 유니온(`RedisFailOpenComponent`/`RedisFailOpenReason`)으로 시그니처가 좁혀지고 `tsc` 프로브로 강제력까지 확인되어 실제로 해소되었다. 인젝션 벡터(SQL/XSS/커맨드/경로 탐색), 하드코딩 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지 않은 암호화, 에러 메시지의 민감정보 노출, 취약 의존성 추가 등 신규 실질 보안 결함은 발견되지 않았다.

## 위험도

NONE
