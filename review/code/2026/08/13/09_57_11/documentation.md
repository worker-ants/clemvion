# 문서화(Documentation) 리뷰 — `clemvion.redis.fail_open` 관측 메트릭 (fix-round, 세션 `08_36_21` 후속)

## 배경 확인

이번 diff 는 대부분 이전 리뷰 세션(`08_36_21`)의 WARNING 5건에 대한 **조치 결과물**이다
(`review/code/2026/08/13/08_36_21/RESOLUTION.md`). 코드·spec 의 실제 현재 상태를 직접 열어
대조한 결과는 다음과 같다.

- **WARNING 1·2 (신규 `describe` 삽입이 남의 JSDoc 을 가로챔)** — 해결 확인.
  `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 를 직접
  읽어 확인: `fail-open 관측 (metrics)` JSDoc+describe(1040~1169줄)가 `Redis 런타임 장애
  fail-open` describe(840줄) 직후로 이동했고, `[Spec EIA §R8 "캐시 키 스코프"]` JSDoc(1171줄)은
  다시 자신의 describe(1187줄) 바로 위에 붙어 있다. 파일 헤더 docstring(1~47줄)도 "네 번째
  describe 는 fail-open 관측(metrics)…", "다섯 번째 describe 는 캐시 키 스코프…" 로 정정되어
  실제 구조와 일치한다.
- **WARNING 3 ([SPEC-DRIFT] NF-OB-07 카탈로그 미갱신)** — 해결 확인. `spec/5-system/_product-overview.md`
  §NF-OB-07 표에 `clemvion.redis.fail_open` 행이 추가됐고(커밋 `56fac52c3`), `spec/data-flow/9-observability.md`
  미러 문장과 `## Rationale`(`component` 스코프를 지금 `idempotency` 하나로 두는 이유, 실측
  grep 근거 포함)도 함께 갱신됐다. `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` 는
  후속 항목("다른 Redis fail-open 소비자 배선")이 의도적으로 미체크 상태라 `plan/in-progress/`
  에 남아 있는 것이 라이프사이클 규칙과 정합한다(전부 완료된 것으로 착각해 `plan/complete/`
  이동을 요구할 사안 아님).
- **WARNING 4 (`recordRedisFailOpen()` 자체 단위 테스트 부재)** — 해결 확인.
  `business-metrics.service.spec.ts` 에 2건 추가돼 있고(62~88줄), 이 파일 전체를 대상으로
  `npx jest` 를 직접 실행해 **57/57 통과**(3 suites: `idempotency.interceptor.spec.ts` +
  `business-metrics.service.spec.ts` + `metrics.module.spec.ts`)를 확인했다 — `RESOLUTION.md`
  의 "jest 동 범위: 3 suites / 57 passed" 주장과 정확히 일치한다.
- **WARNING 5 ("닫힌 집합" 주장 vs `string` 시그니처)** — 해결 확인. `business-metrics.service.ts`
  에 `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온이 export 되고
  `recordRedisFailOpen(component, reason)` 시그니처가 이를 사용한다. docstring 도 "그 닫힌
  집합을 타입으로 강제한다" 로 갱신되어 실제 구현과 일치한다.
- `eslint`(4개 대상 파일)를 직접 실행해 **0 warning / 0 error** 확인 — `RESOLUTION.md` 검증
  섹션의 주장과 일치.

즉 이전 라운드에서 지적된 5건은 전부 실제로 반영됐고, 결과물(코드·spec·CHANGELOG·plan)
사이의 서술도 서로 어긋나지 않는다.

## 발견사항

(신규 CRITICAL/WARNING 없음)

- **[INFO]** `IdempotencyInterceptor` 클래스 docstring 의 "다섯 fail-open 경로" 표에 `reason`
  라벨이 열거되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` —
    클래스 상단 docstring 의 `| # | 경로 | 처리 | warn |` 표(71~77번째 줄 부근)
  - 상세: 이 표는 그 자체로 "개수를 세어 두는 것이 요점이다 — 종전에는 경로 수가 실제와
    어긋난 적이 있다" 고 스스로 경고한다(82~84번째 줄). 이번 변경으로 이 다섯 경로 각각에
    `reason` 라벨(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`)
    이 1:1 로 붙었는데, 그 매핑이 이 표에는 나타나지 않고 `business-metrics.service.ts` 의
    `RedisFailOpenReason` docstring 과 `discardCorruptEntry()` 의 삼항식에만 흩어져 있다. 표
    자체가 "경로 목록의 단일 진실" 을 자임하는 자리라, 다음에 경로가 추가/변경될 때 이 표만
    보고 `reason` 라벨 갱신을 빠뜨릴 여지가 있다(정확히 이 표가 과거에 놓쳤던 것과 같은
    종류의 drift).
  - 제안: 표에 `reason` 컬럼을 추가하거나(예: 경로 5 행에 `entry_corrupt`/`payload_corrupt`
    두 값을 병기), 최소한 "다섯 경로가 `clemvion.redis.fail_open{reason}` 에도 1:1 대응한다"
    는 한 줄을 표 아래에 덧붙여 두 문서(이 표 vs `RedisFailOpenReason` 유니온)가 갈라지지
    않게 고정. 선택 사항 — 기능·정합성에 영향 없음.

## 요약

이번 diff 는 새 코드보다 **직전 리뷰(`08_36_21`)에서 지적된 문서화 WARNING 5건의 조치
결과**가 대부분이다. 소스(`idempotency.interceptor.spec.ts` JSDoc-describe 인접성, 파일 헤더
서수, `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 + `spec/data-flow/9-observability.md`
미러 + Rationale, `business-metrics.service.spec.ts` 신규 테스트, `RedisFailOpenComponent`/
`RedisFailOpenReason` 타입)를 직접 열어 대조한 결과 다섯 건 모두 실제로 반영됐고, `CHANGELOG.md`
신규 항목·`RESOLUTION.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md` 의 서술도
현재 코드·테스트 결과(eslint 0/0, jest 3 suites/57 passed 실측 재확인)와 어긋나지 않는다.
남은 것은 `IdempotencyInterceptor` 클래스 docstring 의 fail-open 경로 표에 `reason` 라벨
매핑을 보태면 좋겠다는 선택적 INFO 하나뿐이다.

## 위험도

NONE
