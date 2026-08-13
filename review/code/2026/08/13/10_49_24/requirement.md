# 요구사항(Requirement) 리뷰 — `clemvion.redis.fail_open` 관측 메트릭 (세션 `10_49_24`)

## 검토 방법

프롬프트 diff 는 `08_36_21`·`09_57_11` 등 이전 리뷰 라운드의 산출물(`review/**`)까지 포함해 81개
파일 규모지만, 요구사항(기능 충족) 관점에서 실질적으로 검증할 대상은 핵심 소스 4개
(`idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`, `business-metrics.service.ts`,
`business-metrics.service.spec.ts`) + spec 2개(`spec/5-system/_product-overview.md`,
`spec/data-flow/9-observability.md`) + 관련 plan/CHANGELOG 문서다. `review/**` 하위 산출물은 이전
라운드의 기록물이라 그 자체가 기능 요구사항의 대상이 아니므로, "그 기록이 현재 코드 상태와
사실 정합한가" 만 대조했다. 4개 핵심 소스는 `Read` 로 현재 HEAD 상태를 직접 열어 diff 게이트
번호가 아니라 실제 라인 번호로 확인했다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

직접 대조 결과, 이전 라운드(`08_36_21`)가 지적한 WARNING 5건(JSDoc-describe 인접성 붕괴 2건,
[SPEC-DRIFT] NF-OB-07 카탈로그 미갱신, `recordRedisFailOpen` 단위 테스트 부재, "닫힌 집합" 주장과
`string` 시그니처 불일치)이 모두 코드에 실제로 반영돼 있다:

- `spec/5-system/_product-overview.md:88` — NF-OB-07 카탈로그 표에 `clemvion.redis.fail_open` 행이
  실제로 추가돼 있고 라벨 값(`component`=idempotency, `reason`=get_failed/set_failed/
  serialize_failed/entry_corrupt/payload_corrupt)이 코드의 리터럴 유니온과 1:1 일치.
- `spec/data-flow/9-observability.md:202-207` 미러 문장 + `:261-271` Rationale 이 함께 갱신됨(코드가
  옳고 spec 도 이미 동기화된 상태 — SPEC-DRIFT 아님).
- `business-metrics.service.ts:38-46,134-138` — `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴
  유니온이 시그니처에 실제로 적용됨. `recordExecutionError`(`:112-116`)의 `.substring(0,64)` 클램핑과
  대칭적인 방어 수준.
- `idempotency.interceptor.ts:161,257-260,344,353` — 클래스 docstring 표(`:72-94`)가 선언한 5경로 중
  4경로(path 1 "기동 시 미주입"은 장애가 아니므로 계측 제외가 의도)에 `recordRedisFailOpen` 이 각각
  다른 `reason` 값으로 정확히 배선됨(`get_failed`/`set_failed`/`serialize_failed`/
  `entry_corrupt`/`payload_corrupt` 5개 reason 모두 최소 한 호출부에서 도달).
- `business-metrics.service.spec.ts:67-119` — `recordRedisFailOpen` 자체를 실행하는 3개 테스트(정상
  호출/타입 캐너리/reason별 분기) 추가. 인터셉터 spec(`:1064-1184`)은 `it.each` 4갈래 + 직렬화 실패 +
  정상 경로 무증가 + `metrics` 미주입(optional DI) 5개 테스트로 구성돼 함수명·주석·구현이 일치.
- `idempotency.interceptor.spec.ts:1-58` 헤더 docstring 의 describe 색인이 서수 대신 이름 참조로
  바뀌어 실제 5개 `describe` (`:200,278,855,1064,1202` + `:1368`)와 정합, `— fail-open 관측 (metrics)`
  블록(`:1064`)이 `(Redis 런타임 장애 fail-open)` describe(`:855-1053`) 직후·`— 캐시 키 스코프`
  JSDoc(`:1186`) 앞에 위치해 이전 라운드가 지적한 JSDoc-대상 분리 문제가 해소됨.
- `codebase/backend/src/modules/metrics/metrics.module.ts:8` `@Global()` + `app.module.ts:163`
  등록 확인 — 프로덕션 경로에서 `IdempotencyInterceptor` 생성자의 `metrics?: BusinessMetricsService`
  가 항상 주입되며, `@Optional()` + 파라미터 끝 추가로 기존 호출자와 하위 호환.
- `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 체크리스트 5건 전부 `[x]`, frontmatter
  필수 필드(`status`/`worktree`/`started`/`owner`/`spec_impact`) 모두 존재 — plan-lifecycle 완료 조건
  충족.
- `plan/in-progress/backend-lint-gate-broken-on-main.md:536` — "Redis 실패율 지표" 항목이 `[x]` 완료로
  갱신됐고, 그 부모 항목(`:532` "idempotency fail-open 구간의 관측·중복 억제")은 형제 항목(다른
  소비자 배선 `:553`, GET→SET 비원자 구조 검토 `:565`)이 아직 미완이라 `[ ]` 로 정확히 남아 있음 —
  부모/자식 체크박스 상태가 실제 완료 범위와 일치.

CHANGELOG 신규 항목(`CHANGELOG.md:3-19`)의 서술("다섯 경로에 배선")과 실제 배선 지점(코드 4개
호출부가 5개 reason 값을 커버)이 일치하고, `OTEL_ENABLED` 미설정 시 no-op meter 로 무동작이라는
서술도 `business-metrics.service.ts:52-54` docstring 및 `metrics.getMeter` 동작과 부합한다.

기능 완전성·엣지 케이스·에러 시나리오·반환값 관점에서 새로 발견된 미흡점은 없다. `metrics.add()`
호출이 fail-open 복구 경로 내부에서 별도 try/catch 없이 실행되는 점(OTel SDK 회귀 시 fail-open이
fail-closed로 뒤집힐 이론적 표면)은 이전 라운드(`08_36_21/side_effect.md`)가 이미 INFO로 평가하고
"현재 설계상 던지지 않음 + 인접 `logger.warn` 도 동일 수준"이라는 근거로 조치 불요 처분했으며, 이번
재검토에서도 그 판단을 뒤집을 새 근거는 없어 동일하게 INFO로 유지한다(비CRITICAL/WARNING).

## 요약

`clemvion.redis.fail_open` OTel 카운터 추가와 `IdempotencyInterceptor` 5개 fail-open 경로(4개
호출부) 배선은 의도한 기능(장애 유형별 알람 가능한 관측)을 완전히 구현했다. spec 카탈로그
(`_product-overview.md` §NF-OB-07)와 미러 문서(`9-observability.md`)가 코드와 line-level 로
일치하고, "닫힌 집합" 이라는 문서 주장이 리터럴 유니온 타입으로 실제 강제되며, 이전 리뷰 라운드가
지적한 WARNING 5건이 모두 코드·spec·plan에 반영된 것을 직접 파일을 열어 확인했다. 신규
CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
