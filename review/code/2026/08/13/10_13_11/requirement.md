# 요구사항(Requirement) 리뷰 — `clemvion.redis.fail_open` 관측 메트릭 (세션 `10_13_11`)

## 검토 방법

이번 changeset 은 브랜치 `eia-r8-cache-scope-4ae434` 전체(커밋 `451974407`~`0705e19b5`)를
포괄하며, 실질 코드 변경(fail-open 다섯 경로에 OTel 카운터 배선)은 이미 두 차례 리뷰
(`08_36_21`, `09_57_11`)를 거쳐 지적된 WARNING 이 전부 조치된 상태다. 프롬프트 diff 만으로는
"이전 라운드 지적이 실제로 반영됐는지" 확정할 수 없어, 핵심 소스 4개
(`idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`, `business-metrics.service.ts`,
`business-metrics.service.spec.ts`)와 spec 2개(`spec/5-system/_product-overview.md`,
`spec/data-flow/9-observability.md`)를 `Read`/`Bash grep` 으로 직접 열어 diff 주장과 대조했다.

## 발견사항

(CRITICAL/WARNING 없음)

- **[INFO]** `IdempotencyInterceptor` 클래스 docstring 의 "다섯 fail-open 경로" 표(파일 상단,
  `| # | 경로 | 처리 | warn |`)에 신규 `reason` 라벨 매핑이 여전히 반영되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스
    docstring 표(71-77번째 줄), 특히 5번째 행(`캐시 엔트리·payload 손상`)이 실제로는
    `entry_corrupt`/`payload_corrupt` 두 개 별개 `reason` 으로 갈리는데 표에는 한 행으로만
    남아 있다.
  - 상세: 직전 라운드(`09_57_11` documentation reviewer)가 이미 동일 지점을 INFO 로 지적했고
    선택 사항으로 분류했다. 이번 diff 를 다시 확인해도 이 표는 변경되지 않았다 — developer 가
    "조치하지 않은 INFO" 로 명시 처분한 것은 아니고, `09_57_11` 라운드 이후 별도 조치 없이
    그대로 남은 상태다. 이 표 자체가 "개수를 세어 두는 것이 요점"(82-84번째 줄)이라고 스스로
    강조하는 자리라, `reason` 매핑까지 표에 없으면 다음 사람이 `RedisFailOpenReason` 유니온과
    이 표 사이의 대응을 코드 두 곳(`business-metrics.service.ts` 의 유니온 정의 +
    `discardCorruptEntry()` 의 삼항식)을 따로 읽어야 재구성할 수 있다. 기능·spec 정합성에는
    영향 없다.
  - 제안: 표에 `reason` 컬럼을 추가하거나 표 아래에 "다섯 경로가 `clemvion.redis.fail_open{reason}`
    에도 1:1 대응한다" 한 줄을 부기. 우선순위 낮음, 즉시 조치 불요.

## 점검 관점별 확인

1. **기능 완전성**: `IdempotencyInterceptor` 의 다섯 fail-open 경로(GET 실패·SET 실패·직렬화
   실패·엔트리 손상·payload 손상) 전부에 `this.metrics?.recordRedisFailOpen(METRICS_COMPONENT, reason)`
   이 배선됐음을 소스에서 직접 확인(`idempotency.interceptor.ts:154,250-253,337,346`). 다섯 번째
   경로는 `discardCorruptEntry()` 한 곳에서 삼항식으로 `entry_corrupt`/`payload_corrupt` 두 값을
   가른다 — 두 값 모두 `business-metrics.service.spec.ts:106-119` 와
   `idempotency.interceptor.spec.ts` 신규 `it.each` 양쪽에서 각각 단언되어 뭉개짐 회귀가 잡힌다.
   CHANGELOG·spec 이 주장하는 "다섯 경로 전부" 는 실제 구현과 정확히 일치한다.
2. **엣지 케이스**: 정상 경로에서는 카운터가 오르지 않음을 별도 테스트로 고정
   (`idempotency.interceptor.spec.ts:1140-1150`, "항상 올리는 회귀 방지"). `metrics` 미주입
   (`@Optional()`) 시 `this.metrics?.` optional chaining 으로 fail-open 경로 자체가 죽지 않음을
   전용 테스트로 확인(`:1152-1168`). 두 라벨 축(component/reason) 모두 리터럴 유니온으로 닫혀
   있어 빈 문자열·미정의 값이 컴파일 타임에 차단된다.
3. **TODO/FIXME**: 변경된 4개 소스 파일 전체를 grep 했으나 `TODO`/`FIXME`/`HACK`/`XXX` 없음.
4. **의도와 구현 간 괴리**: 없음. `recordRedisFailOpen` 메서드명·docstring("fail-open 으로
   강등된 사건을 집계")과 실제 구현(`this.redisFailOpen.add(1, { component, reason })`)이
   정확히 일치. `METRICS_COMPONENT` 상수명·용도(클래스 전체 강등을 한 이름으로 묶음)도 주석과
   일치.
5. **에러 시나리오**: 다섯 fail-open 지점 모두 `this.metrics?.recordRedisFailOpen(...)` 호출이
   기존 `logger.warn(...)` 바로 뒤에 붙어, 로그·카운터가 항상 짝으로 남는다. OTel
   `Counter.add()` 는 던지지 않는 API 라 이 삽입이 새 예외 경로를 열지 않는다는 점은 선행
   라운드(side_effect reviewer)가 실측 없이도 설계상 근거를 남겼고, 이번 라운드에서 별도로
   반증할 근거는 찾지 못했다(관측 가능한 결함 아님, INFO 수준의 잠재 리스크로 이미 처분됨).
6. **데이터 유효성**: `component`/`reason` 파라미터가 `RedisFailOpenComponent`/
   `RedisFailOpenReason` 리터럴 유니온으로 좁혀져 임의 문자열이 타입 레벨에서 거부된다
   (`business-metrics.service.ts:38-46,134-137`). `business-metrics.service.spec.ts:93-104` 의
   `@ts-expect-error` 캐너리 두 건이 이 시그니처가 다시 `string` 으로 넓어지는 회귀를
   `tsc --noEmit`(spec 포함) 진단 수 ratchet 으로 고정한다는 근거가 RESOLUTION.md 에 남아 있고,
   실제 코드 시그니처도 그 주장과 일치한다.
7. **비즈니스 로직**: "fail-open 은 요청을 살리는 것과 장애를 보이게 하는 것이 한 쌍" 이라는
   요구가 다섯 경로 전부에 카운터로 반영됐고, 경로별 `reason` 이 갈려 "무엇이 고장났는지"를
   알람이 구분할 수 있다는 CHANGELOG·docstring 의 핵심 주장이 실제 구현·테스트 양쪽에서
   확인된다.
8. **반환값**: `recordRedisFailOpen(): void` — 모든 경로에서 부작용(카운터 증가)만 수행하고
   반환값을 소비하는 호출부가 없어 문제 없음.
9. **spec fidelity**: `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 표에
   `clemvion.redis.fail_open` 행이 추가됐고(Counter / `component`(idempotency) /
   `reason`(get_failed/set_failed/serialize_failed/entry_corrupt/payload_corrupt)), 코드의
   `RedisFailOpenComponent`/`RedisFailOpenReason` 유니온 멤버와 정확히 1:1 일치한다.
   `spec/data-flow/9-observability.md` 의 커스텀 메트릭 열거 문장에도 `clemvion.redis.fail_open`
   이 추가됐고, 새 `## Rationale` 소절이 `component` 를 지금 `idempotency` 하나로 유지하는
   근거(실측 grep, "spec 이 구현보다 넓어지면 안 된다")를 남겨 두 문서가 서로 어긋나지 않는다.
   이전 라운드(`08_36_21`)가 `[SPEC-DRIFT]` WARNING 3 으로 지적했던 "SoT 인용 vs 미갱신 카탈로그"
   갭은 이번 diff 로 실제 코드 상태와 spec 표가 line-level 로 일치하도록 닫혔다 — 재발 없음.

## 요약

핵심 변경(`BusinessMetricsService.recordRedisFailOpen()` 신설 + `IdempotencyInterceptor` 다섯
fail-open 경로 배선)은 의도한 기능(경로별로 구분되는 알람 가능 카운터)을 완전히 구현하고
있으며, 정상 경로 미증가·optional DI 안전성·타입 닫힌 집합 강제까지 엣지 케이스가 테스트로
고정돼 있다. 직전 두 라운드가 지적한 WARNING 5건(JSDoc-describe 인접성 붕괴 2건, spec 카탈로그
미갱신 1건, 단위 테스트 부재 1건, 문자열 시그니처 1건)을 소스를 직접 열어 전부 재확인했고,
모두 실제로 반영돼 있다. spec(`_product-overview.md` §NF-OB-07, `data-flow/9-observability.md`)도
코드와 line-level 로 일치해 이전 SPEC-DRIFT 는 해소됐다. 유일한 잔여 관찰은 클래스 docstring 표에
`reason` 라벨 매핑이 없다는 선택적 INFO 하나로, 두 라운드 연속 동일 지적이지만 기능·정합성에는
영향이 없어 즉시 조치가 필요한 결함은 아니다.

## 위험도

NONE
