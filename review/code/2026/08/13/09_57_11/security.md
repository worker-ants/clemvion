# 보안(Security) 리뷰 — `clemvion.redis.fail_open` 관측 메트릭 + spec 카탈로그 등재 (후속 라운드)

## 발견사항

- **[INFO]** 새 라벨 파라미터가 리터럴 유니온으로 닫혀 있어 Prometheus label-cardinality 공격면이 이번 라운드에서 오히려 좁아졌다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `RedisFailOpenComponent`(38행)/`RedisFailOpenReason`(41-46행) 타입 선언, `recordRedisFailOpen(component: RedisFailOpenComponent, reason: RedisFailOpenReason)`(134-139행)
  - 상세: 직전 라운드(`08_36_21`)에서 security 리뷰어가 INFO 로 지적했던 "`recordRedisFailOpen(component: string, reason: string)` 이 docstring 상 '닫힌 집합' 이라 주장하면서 타입은 평범한 `string`" 문제가 이번 diff 에서 리터럴 유니온으로 좁혀져 실제로 해소됐다. `tsc --noEmit` 프로브(`RESOLUTION.md` WARNING 5)로 임의 문자열 전달이 컴파일 타임에 거부됨을 확인했고, 프로브 파일은 제거되어 `git status codebase/` clean 함을 직접 확인했다. 호출부(`idempotency.interceptor.ts`)도 전부 상수(`METRICS_COMPONENT`)와 하드코딩 리터럴만 사용해 외부 입력이 라벨에 흘러들 경로가 없다.
  - 제안: 조치 불요. 향후 다른 모듈이 이 카운터를 재사용할 때도 반드시 유니온 확장(코드 리뷰 지점)을 거치도록 유지할 것 — `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` 의 "후속" 항목이 이미 그 규칙을 명시했다.

- **[INFO]** 캐시 payload/사용자 body 는 새 관측 경로에서도 로그·라벨에 노출되지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `discardCorruptEntry()`(242-255행), `describeShape()`(394-399행), `storeEntry()`(319-348행) 의 `this.metrics?.recordRedisFailOpen(...)` 호출부
  - 상세: `recordRedisFailOpen` 에 실리는 값은 고정 문자열(`'idempotency'`, `'get_failed'` 등)뿐이며, 캐시 엔트리 내용이나 요청 body 는 여전히 `describeShape()` 로 타입 이름만 로그에 남긴다(원문 미노출 정책 유지). `logger.warn` 에 실리는 `err.message`(Redis 클라이언트 에러 메시지)도 이번 diff 가 새로 만든 표면이 아니라 기존 fail-open 경로의 기존 동작이며, ioredis 에러 메시지에 자격증명이 포함되는 경로는 없다.
  - 제안: 조치 불요.

- **[INFO]** DI 시그니처 확장(`@Optional() metrics?: BusinessMetricsService`)이 인증/인가·캐시 키 스코프 로직에 개입하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:103`
  - 상세: `intercept()` 의 캐시 키 스코프(`executionId:route:key`) 계산·`ConflictException`/`HttpException` 재현 로직은 이번 diff 로 변경되지 않았다. `metrics` 는 다섯 fail-open 지점에만 부가적으로 배선되고, `@Optional()`이라 `MetricsModule` 미주입 환경에서도 인터셉터 동작에 영향이 없다(`metrics 미주입이어도 fail-open 경로가 죽지 않는다` 테스트로 회귀 고정됨).
  - 제안: 조치 불요.

- **[INFO]** 리뷰/plan 산출물(CHANGELOG, plan 문서, 이전 라운드 review 아티팩트, spec 문서)에 하드코딩된 시크릿·자격증명·인젝션 벡터 없음
  - 위치: `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`, `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`, `review/code/2026/08/13/08_36_21/*`, `review/consistency/2026/08/13/{09_36_31,09_48_44}/*`, `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`
  - 상세: 전 diff 를 `api[_-]?key|secret|password|token|bearer|authorization|private[_-]?key|BEGIN ... PRIVATE` 패턴으로 훑었고, 매치는 전부 `clemvion.llm.tokens` 같은 메트릭 이름/식별자였다. 실제 자격증명·API 키·비밀번호 문자열은 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 순수 observability 추가(OTel 카운터 `clemvion.redis.fail_open` 신설 + `IdempotencyInterceptor` 다섯 fail-open 경로 배선)의 후속 라운드로, 코드 변경 범위는 이전 라운드(`08_36_21`) security 리뷰가 이미 NONE 으로 판정한 것과 동일한 표면이다. 이번 라운드의 실질 변화는 (1) `recordRedisFailOpen` 파라미터를 `string` → 리터럴 유니온으로 좁혀 이전 라운드가 INFO 로 지적한 "닫힌 집합" 문서-구현 갭을 실제로 닫았고 `tsc --noEmit` 프로브로 강제력을 검증했다는 점, (2) spec 카탈로그(`_product-overview.md` §NF-OB-07, `data-flow/9-observability.md`)에 신규 instrument 를 등재해 SoT 인용 정합성을 회복했다는 점이다. 인젝션 벡터, 하드코딩 시크릿, 인증/인가 우회, 입력 검증 누락, 안전하지 않은 암호화, 에러 메시지의 민감정보 노출, 취약 의존성 추가 등 실질 보안 결함은 발견되지 않았다.

## 위험도
NONE
