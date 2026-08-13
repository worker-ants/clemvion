# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 파일 상단 describe 색인 재정렬 시 서수가 중복 부여됐다 — "다섯 번째"가 두 블록을 가리킨다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:41`, `:48` (파일 헤더 docstring)
  - 상세: 이전 라운드(`08_36_21`)에서 신규 `describe('IdempotencyInterceptor — fail-open 관측 (metrics)', ...)` 블록을 파일 중간에 삽입하면서 파일 헤더의 describe 색인을 "네 번째 describe 는 fail-open 관측(metrics)"(41행 이전, 34행)으로 정정했고, 그 뒤를 잇는 `캐시 키 스코프` 블록(실제 코드 순서상 5번째, `describe(...)` 실제 위치는 1197행)을 "다섯 번째"(41행)로 올바르게 갱신했다. 그런데 그 다음 블록인 `readKey`/`hashBody` 경계값(실제 코드 순서상 6번째, `describe(...)` 실제 위치는 1363행)의 서수는 "여섯 번째"로 갱신되지 않고 여전히 "다섯 번째"(48행)로 남아 있다 — 두 서로 다른 describe 블록이 같은 "다섯 번째"라는 라벨을 갖게 됐다. 이 색인은 파일 구조를 훑어보는 다음 사람이 "몇 번째 블록이 무엇을 검증하는가"를 빠르게 파악하도록 두는 것이 목적인데, 중복 라벨은 그 목적을 직접 훼손한다. 특히 이 사안은 직전 리뷰 라운드에서 "신규 삽입이 기존 색인을 stale 하게 만든다"는 지적(WARNING 1·2)에 대한 수정 작업 도중 새로 생긴 회귀라는 점에서, 같은 클래스의 결함이 고치는 과정에서 재발한 사례다.
  - 제안: 48행의 "다섯 번째 describe 는 **`readKey`/`hashBody` 경계값**…"을 "여섯 번째 describe 는…"으로 정정한다.

## 요약

이번 diff(핵심: `BusinessMetricsService.recordRedisFailOpen()` 신설, `IdempotencyInterceptor` 다섯 fail-open 경로 배선, 라벨 타입을 리터럴 유니온으로 강제)는 직전 리뷰 라운드(`08_36_21`)에서 지적된 WARNING 항목들 — JSDoc·describe 인접성 붕괴, `withMetrics` 네이밍 컨벤션 이탈, `'idempotency'` 리터럴 반복, 닫힌 집합의 타입 미표현 — 을 실제로 검증 가능한 방식으로 해소했다. `METRICS_COMPONENT` 상수 도입, `withMetrics` → `makeInterceptorWithMetrics` 리네임, `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온 도입이 코드에 정확히 반영돼 있고, 스텁 잔존 참조도 없다. 신규 코드(카운터 등록·`recordRedisFailOpen` 메서드·인터셉터 4개 호출 지점)는 짧고 기존 `record*`/`@Optional()` 패턴을 그대로 따라 가독성·일관성 문제가 없다. 다만 describe 인접성 문제를 고치는 과정에서 파일 헤더 색인의 서수 하나가 다른 블록과 중복되는 새로운(작지만 실재하는) 회귀가 생겼다 — 기능에는 영향이 없으나 "리뷰가 지적한 문서-구조 정합성"이라는 바로 그 항목이 재발했다는 점에서 눈에 띈다.

## 위험도

LOW
