# 보안(Security) 리뷰 — `clemvion.redis.fail_open` OTel 카운터 배선 (4차 라운드, rebase 후)

## 검토 방법

`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`,
`codebase/backend/src/modules/metrics/business-metrics.service.ts` 를 `Read` 로 전체 직접 열어
현재(rebase 후) 상태를 확인했다. 이 changeset 은 이전 세 라운드(`08_36_21`→`09_57_11`→`10_13_11`→
`10_29_50`)가 이미 검토·조치·재확인을 거친 동일 기능(Redis fail-open 관측 카운터)의 rebase 후
최신 스냅샷이며, 실질 코드 변경분(파일 1~7)은 순수 observability 배선(OTel Counter 추가 +
다섯 fail-open 경로에 1줄씩 계측 호출)이다. 나머지(파일 8~79)는 `review/**`·`spec/**` 산출물로
소스 코드가 아니다.

## 발견사항

- **[INFO]** `recordRedisFailOpen` 라벨은 리터럴 유니온으로 닫혀 있어 label-cardinality 공격면이 없다
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `RedisFailOpenComponent`(38행)/`RedisFailOpenReason`(41-46행), `recordRedisFailOpen(component, reason)`(134-139행)
  - 상세: `component`/`reason` 은 `string` 이 아니라 코드가 열거한 닫힌 리터럴 유니온이다. 호출부(`idempotency.interceptor.ts`)의 4개 호출은 전부 모듈 상수 `METRICS_COMPONENT`(32행)와 리터럴 문자열만 사용하며, 사용자 입력·에러 메시지·요청 body 등 외부 유래 값이 라벨 인자로 흘러드는 경로가 없다. `recordExecutionError` 가 외부 `errorCode` 를 `.substring(0, 64)` 로 클램핑하는 것과 달리 이쪽은 애초에 외부 입력을 받지 않으므로 클램핑이 불필요하다. Prometheus label cardinality 폭발(DoS 벡터) 위험은 이 경로에서 발생하지 않는다.
  - 제안: 조치 불요. 향후 다른 소비자가 이 카운터를 재사용할 때도 리터럴 유니온 확장(코드 리뷰 지점)을 거치도록 유지할 것.

- **[INFO]** 캐시 payload·요청 body 원문은 새 계측 경로에서도 로그/라벨에 노출되지 않는다
  - 위치: `idempotency.interceptor.ts` — `discardCorruptEntry()`(249-262행), `describeShape()`(420-424행), `storeEntry()`(326-355행)
  - 상세: `recordRedisFailOpen` 인자는 고정 문자열뿐이다. `describeShape()` 는 값의 타입 이름만 로그에 남기고(419행 주석 "값 자체를 찍지 않는다"), `logger.warn` 에 실리는 `err.message` 는 이 diff 가 새로 만든 표면이 아니라 기존 fail-open 경로의 기존 동작이며 서버 로그에만 남고 클라이언트 응답에는 노출되지 않는다. ioredis 에러 메시지에 접속 자격증명이 포함되는 경로는 없다.
  - 제안: 조치 불요.

- **[INFO]** metrics 호출이 fail-open 복구 경로 내부에서 try/catch 로 격리돼 있지 않다 (기존에도 의도적으로 무조치된 사항)
  - 위치: `idempotency.interceptor.ts:161`(GET catchError), `:257-260`(discardCorruptEntry), `:344`(직렬화 실패), `:353`(SET 실패)
  - 상세: 이 클래스의 존재 이유는 "Redis 가 죽어도 요청은 반드시 산다"(fail-open, 96-95행 클래스 docstring)는 보장이다. `this.metrics?.recordRedisFailOpen(...)` 은 이 네 복구 지점에 무방비로 얹혀 있어, 만약 향후 OTel SDK 쪽에서 `Counter.add()` 가 예외를 내는 회귀가 생기면 그 예외가 `catchError`/`discardCorruptEntry` 콜백 안에서 그대로 전파돼 **fail-open 자체가 fail-closed 로 뒤집힐** 이론적 표면이 있다. 다만 동일 자리의 `this.logger.warn(...)` 도 기존부터 동일하게 무방비이므로 이번 diff 가 새로 만든 위험 등급이 아니고, `RESOLUTION.md`(`10_29_50`)에서 "하나만 감싸면 방어가 불균일해진다"는 근거로 명시적으로 무조치 처리됐다.
  - 제안: 당장 조치 불요(라운드 4회 연속 동일 판정). 향후 fail-open 경로에 부수 호출이 더 늘면 그 시점에 일괄 방어를 검토.

## 확인 항목 (문제 없음)

- 인젝션(SQL/XSS/커맨드/경로탐색): 대상 아님 — 이번 diff 는 DB 쿼리·HTML 렌더링·셸 실행·파일 경로를 다루지 않는다.
- 하드코딩된 시크릿: `api[_-]?key|secret|password|token|bearer|authorization|BEGIN ... PRIVATE` 패턴 검색 결과 매치는 전부 `clemvion.llm.tokens` 등 메트릭/식별자 이름이며 실제 자격증명은 없다.
- 인증/인가: `IdempotencyInterceptor.intercept()` 의 캐시 키 스코프(`executionId:route:key`) 계산, `ConflictException`/`HttpException` 재현 로직은 이번 diff 로 변경되지 않았다. `metrics` DI 는 `@Optional()`이며 인증/인가 판단에 개입하지 않는다.
- 입력 검증: `recordRedisFailOpen` 의 두 인자 모두 타입 레벨에서 닫힌 집합으로 강제되고(`tsc --noEmit` 프로브로 RESOLUTION.md 가 실측 검증), 런타임에도 호출부 4곳이 전부 상수/리터럴만 사용.
- 암호화: `hashBody()` 의 SHA-256(15행 import, 기존 코드, 이번 diff 로 변경 없음)은 idempotency 캐시 키 파생용이지 자격증명/비밀번호 해시가 아니므로 알고리즘 선택이 부적절하지 않다.
- 에러 처리: `logger.warn` 에 담기는 `err.message` 는 서버 로그 전용이며 클라이언트 응답 경로로 흘러가지 않는다(기존 동작, 이번 diff 로 신규 노출 없음).
- 의존성 보안: 신규 라이브러리·버전 변경 없음. 기존 `@opentelemetry/api` Counter API 만 재사용.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 다섯 fail-open 경로에 OTel 카운터(`clemvion.redis.fail_open`)를 배선하는 순수 관측성(observability) 추가이며, 앞선 세 리뷰 라운드가 이미 NONE 으로 판정한 것과 동일한 코드 표면의 rebase 후 스냅샷이다. 라벨 값(`component`/`reason`)은 리터럴 유니온으로 닫혀 있어 Prometheus label-cardinality 공격면이 없고, 모든 호출부가 상수/리터럴만 전달해 외부 입력이 계측 경로로 유입되지 않는다. 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 노출·취약 의존성 등 실질 보안 결함은 발견되지 않았다. metrics 호출이 fail-open 경로 내부에서 별도 격리 없이 실행되는 점(이론적으로 계측 SDK 회귀 시 fail-open→fail-closed 반전 가능)은 INFO 수준이며, 기존 `logger.warn` 호출도 동일하게 무방비였고 팀이 이미 의도적으로 무조치 처리한 사항이라 이번 라운드에서 등급을 올릴 근거가 없다.

## 위험도

NONE
