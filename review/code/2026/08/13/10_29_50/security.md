# 보안(Security) 리뷰 — `clemvion.redis.fail_open` 메트릭 추가

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** 라벨 값을 리터럴 유니온으로 닫은 것은 보안 관점에서도 유효한 방어
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:38-46, 134-139`
  - 상세: `recordRedisFailOpen(component: RedisFailOpenComponent, reason: RedisFailOpenReason)` 이 두 라벨을 각각 `'idempotency'` 단일값과 5개 리터럴(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`)로 컴파일 타임에 제한한다. 호출부(`idempotency.interceptor.ts:161,257-259,344,353`)도 전부 리터럴 상수만 넘기며, 사용자 입력이나 예외 메시지(`err.message`)는 라벨로 흘러가지 않는다 — `Counter.add(1, { component, reason })` 어디에도 요청 바디·헤더·Redis 응답 원문이 들어가지 않는다. 이는 Prometheus/OTel 라벨 cardinality 폭주(비제한 라벨 값을 넣으면 시계열이 무한 증식해 메트릭 백엔드가 다운되는 형태의 서비스 거부)를 원천 차단하는 설계로, `recordExecutionError`가 같은 위험을 런타임 `substring(0, 64)` 클램핑으로 막는 것과 대비해 이쪽은 타입 강제로 더 강하게 막는다.
  - 제안: 없음 — 이미 올바른 패턴. 후속 소비자(`InteractionRateLimiterService` 등)를 이 카운터에 배선할 때도 동일하게 라벨 값을 코드가 정한 닫힌 유니온으로 유지할 것(계획 문서에 이미 명시됨).
- **[INFO]** 손상 캐시 payload 비노출 유지 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:419-424` (`describeShape`)
  - 상세: 손상된 캐시 엔트리를 로그로 남길 때 값 자체가 아니라 `typeof`/`'array'`/`'null'` 같은 형태 문자열만 사용해, 캐시된 응답 payload(사용자 데이터를 포함할 수 있음)가 로그로 새지 않도록 이미 방어되어 있다. 이번 diff 는 이 함수를 변경하지 않았고 새 메트릭 호출도 상태 상수만 기록하므로 이 보장이 유지된다.
  - 제안: 없음.
- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 상세: 전 diff(코드·CHANGELOG·plan·review 문서 포함)를 `api[_-]?key|password|secret|token|bearer|-----BEGIN|private[_-]?key` 패턴으로 훑었다. 매치된 것은 전부 `clemvion.llm.tokens` 같은 메트릭/지표 이름이며 실제 자격증명 문자열은 없다.
  - 제안: 없음.

## 요약

이번 변경은 `IdempotencyInterceptor` 의 다섯 fail-open 경로에 OTel 카운터(`clemvion.redis.fail_open{component,reason}`) 배선을 추가하는 순수 관측성(observability) 기능이며, 새로운 입력 처리 경로·인증/인가 변경·암호화 로직 변경이 없다. 메트릭 라벨은 호출부 어디서도 사용자 입력이나 예외 원문을 받지 않고 코드가 정한 리터럴 유니온(`RedisFailOpenComponent`/`RedisFailOpenReason`)으로 타입 강제되어 있어, 라벨 인젝션·cardinality 폭주로 이어질 수 있는 통상적 관측성 기능의 취약점 클래스를 설계 단계에서 차단했다. `metrics` 의존성은 `@Optional()` 로 주입돼 미가용 시 조용히 no-op 이 되므로 가용성(fail-open 원칙)도 훼손하지 않는다. 그 외 파일(CHANGELOG, plan 문서, 이전 리뷰 세션 산출물, spec 문서)은 문서 변경뿐이며 시크릿·민감정보 노출이 없음을 grep 으로 확인했다.

## 위험도

NONE
