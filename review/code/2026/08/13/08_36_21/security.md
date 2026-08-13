# Security Review — clemvion.redis.fail_open 관측 추가 (2026-08-13)

## 리뷰 범위

- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/metrics/business-metrics.service.ts`
- `plan/in-progress/backend-lint-gate-broken-on-main.md`

이번 diff 는 `IdempotencyInterceptor` 의 다섯 fail-open 경로(GET 실패·SET 실패·직렬화
실패·엔트리 손상·payload 손상)에 OTel 카운터 `clemvion.redis.fail_open`
관측을 배선하는 순수 observability 추가다. 캐시 키 스코프(execution+route) 보안 수정
자체는 선행 커밋(`8a2d13031` 등)에서 이미 반영됐고 본 diff 의 대상이 아니다.

### 발견사항

- **[INFO]** `recordRedisFailOpen` 은 자매 메서드 `recordExecutionError` 와 달리 라벨 값을
  클램핑하지 않는다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:113-115`
  - 상세: 같은 클래스의 `recordExecutionError(errorCode: string)` (95-99행)는 "외부 유래
    `errorCode` 는 최대 64자로 클램핑해 Prometheus 라벨 cardinality 폭발을 방지" 한다는
    주석과 함께 `errorCode.substring(0, 64)` 로 실제 방어를 건다. 반면 신설
    `recordRedisFailOpen(component: string, reason: string)` 는 시그니처상 임의 문자열을
    받지만 클램핑이 없다. docstring(101-112행)은 "둘 다 코드가 정하는 닫힌 집합이라
    cardinality 가 늘지 않는다 — 외부 문자열을 그대로 라벨에 넣으면 Prometheus 가 터진다
    (`recordExecutionError` 가 클램핑하는 이유와 같다)" 고 스스로 그 위험을 명시하면서도
    구현에는 그 방어를 넣지 않았다. 현재 4개 호출부
    (`idempotency.interceptor.ts:149,245-248,332,341`)는 전부 하드코딩된 닫힌 집합
    문자열(`'get_failed'`·`'set_failed'`·`'serialize_failed'`·`'entry_corrupt'`·
    `'payload_corrupt'`)만 넘기므로 **현재는 실제 악용 경로가 없다** — 사용자 입력이
    이 메서드에 도달하지 않는다. 다만 시그니처가 `string` 이라 향후 호출부가 외부 유래
    문자열(예: 에러 메시지, 헤더 값 등)을 잘못 넘기면 Prometheus 라벨 cardinality
    폭발(가용성 저하, DoS 성격)로 이어질 수 있는 방어 누락이다.
  - 제안: 타입을 닫힌 union(`type RedisFailOpenReason = 'get_failed' | 'set_failed' | ...`)
    으로 좁혀 컴파일 타임에 닫힌 집합을 강제하거나, `recordExecutionError` 와 동일하게
    방어적 클램핑/화이트리스트 검증을 추가해 시그니처와 실제 보장을 일치시킨다.

- **[INFO]** 캐시 payload 비노출 원칙이 신규 관측 경로에서도 유지됨 (참고용, 문제 없음)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
    (`describeShape` 함수, `discardCorruptEntry` 호출부)
  - 상세: `metrics?.recordRedisFailOpen('idempotency', 'entry_corrupt'|'payload_corrupt')`
    호출은 캐시 엔트리의 실제 값이나 사용자 body 를 라벨에 싣지 않고, 사전에 정의된
    `reason` 상수만 전달한다. 기존 `describeShape()` 가 "값 자체를 찍지 않는다(캐시
    payload 가 로그로 새지 않도록)" 원칙을 지키는 것과 일관되며, 새 메트릭 경로도
    그 원칙을 깨지 않는다. 별도 조치 불필요.

- **[INFO]** DI 시그니처 변경(`@Optional() metrics?: BusinessMetricsService`)은 인증/인가
  경로에 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:98`
  - 상세: 생성자 4번째 인자로 `BusinessMetricsService` 를 optional DI 로 추가했다. 기존
    파라미터 순서(`_configService`·`injectedRedis`·`redisConn`)는 하위 호환을 위해
    그대로 유지되고, `metrics` 미주입 시 `this.metrics?.` optional chaining 으로
    안전하게 무동작한다(스펙 테스트 `metrics 미주입이어도 fail-open 경로가 죽지 않는다`
    로 고정됨). 인증·인가·캐시 키 스코프 로직에는 변경이 없다.

- **[INFO]** 캐시 키 스코프(execution+route) — 본 diff 범위 밖이지만 문맥상 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:114-135`
  - 상세: 이 파일의 전체 컨텍스트에 포함된 캐시 키 스코프 로직(`executionId`+`route`+
    `rawKey` 3-세그먼트)은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의
    이력에 따르면 선행 커밋(`eia-r8-cache-scope`, `#1157`)에서 이미 완료·리뷰된 항목이며
    본 diff(`unified diff` 섹션)는 그 로직을 건드리지 않는다. `executionId` 는
    `InteractionGuard` 가 토큰 검증 후 합성한 신뢰 가능한 값이고 클라이언트가 직접
    조작할 수 없다는 설계가 유지된다. 재확인 결과 이번 변경으로 인한 회귀 없음.

## 요약

이번 diff 는 기존 fail-open 경로에 OTel 카운터 관측을 추가하는 순수 observability
변경으로, 새로운 인젝션·인증/인가·시크릿 노출·암호화 관련 취약점은 발견되지 않았다.
메트릭 라벨에는 캐시 payload 나 사용자 입력이 아니라 코드가 정한 닫힌 집합 문자열만
실려 정보 노출 위험이 없다. 유일한 지적은 `recordRedisFailOpen` 의 시그니처가
`string` 으로 열려 있어 자매 메서드(`recordExecutionError`)가 갖춘 클램핑 방어를
갖추지 않았다는 점인데, 현재 호출부는 전부 하드코딩 상수만 사용하므로 즉시 악용
가능한 경로는 없다 — 향후 재사용 시의 방어 누락으로 INFO 등급이 적절하다.

## 위험도

NONE
