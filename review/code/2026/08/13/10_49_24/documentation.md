# 문서화(Documentation) 리뷰 — `clemvion.redis.fail_open` OTel 카운터 (4차 라운드, 세션 `10_49_24`)

## 검토 방법

이번 프롬프트는 81개 파일을 번들링하지만, 실질 코드/문서 변경은 좁다 — 나머지 다수는 앞선
세 차례 리뷰 라운드(`08_36_21`·`09_57_11`·`10_13_11`·`10_29_50`)와 세 차례 consistency-check
라운드(`09_36_31`·`09_48_44`·`10_20_59`)의 산출물(`review/code/**`, `review/consistency/**`)이
그 자체로 diff 에 신규 파일로 실려 있는 것이다. 핵심 대상은 다음으로 수렴한다:

- `CHANGELOG.md`, `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md`,
  `plan/in-progress/backend-lint-gate-broken-on-main.md`
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` / `.spec.ts`
- `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`

프롬프트의 diff 는 이 파일들 상당수를 컨텍스트 예산 초과로 절단했으므로, 위 핵심 6개 소스/문서
파일을 `Read`/`grep` 으로 워크트리에서 직접 열어 **현재 실제 상태**를 확인했다(이전 라운드가
지적·수정을 반복한 항목이 실제로 반영됐는지가 이번 라운드의 실질 검토 지점이다).

## 이전 라운드 대비 확인된 상태 (재검증 — 문제 없음)

- **JSDoc-describe 인접성**: `idempotency.interceptor.spec.ts` 의 6개 top-level `describe`
  (185/263/840/1049/1187 → 현재 200/278/855/1064/1202/1368행)가 각자의 JSDoc 설명 문단
  바로 아래에 위치함을 확인. `08_36_21` WARNING 1·2 가 지적한 "신규 삽입이 기존 JSDoc 을
  가로챔" 문제는 재발하지 않았다.
- **헤더 색인 방식 전환**: `10_29_50` RESOLUTION 이 설명한 대로, 파일 헤더 docstring(1-58행)이
  서수("N번째 describe")를 버리고 `describe` 이름을 백틱으로 직접 인용하는 방식으로 바뀌어
  있음을 확인. 5개 인용(`(캐시 히트 · 응답 형태 방어)`, `(Redis 런타임 장애 fail-open)`,
  `— fail-open 관측 (metrics)`, `— 캐시 키 스코프 (Spec EIA §R8)`, `— readKey / hashBody 경계값`)이
  실제 `describe(...)` 호출 문자열(200/278/855/1064/1202/1368행)과 정확히 일치함을
  `grep -n "^describe("` 로 대조. `10_29_50` maintainability WARNING(서수 중복 "다섯 번째"가
  두 블록)은 서수 자체를 없애는 방식으로 해소돼 재발 여지가 구조적으로 제거됐다. 잔존 서수
  참조("번째")도 grep 0건(파일 상단의 설계 배경 서술 2곳 제외 — 실제 색인이 아니라 "왜 이
  방식으로 바꿨는지"를 설명하는 산문).
- **"닫힌 집합" 주장의 타입 강제**: `business-metrics.service.ts:38-46`
  (`RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온)과
  `recordRedisFailOpen(component: RedisFailOpenComponent, reason: RedisFailOpenReason)`(134-139행)를
  확인. 메서드 docstring(118-133행)이 "종전에는 이 문단이 닫혔다고 주장만 하고 시그니처는
  평범한 `string`" 이라고 스스로의 과거 결함을 명시하며, 그 결함이 지금 시그니처로 실제
  해소됐음이 코드와 일치한다.
- **네이밍/리터럴 정리**: `withMetrics` → `makeInterceptorWithMetrics` 리네임(파일 전역
  `make*` 팩토리 관례 정합, grep 으로 `withMetrics` 잔존 0건), `'idempotency'` 리터럴 4곳 →
  `METRICS_COMPONENT` 상수(`idempotency.interceptor.ts:32`) 1곳 정의 확인.
- **plan 라이프사이클**: `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 만 존재하고
  `plan/in-progress/` 쪽 동명 파일은 없음(`find plan -iname "*redis-fail-open*"` → 1건). 이
  문서의 `## 후속`이 미해결 체크박스 대신 살아 있는 백로그(`backend-lint-gate-broken-on-main.md`)
  링크로 대체돼 있고, 그 링크 대상 파일·해당 항목(536행 "Redis 실패율 지표 — 완료")이 실제로
  존재함을 확인 — dangling 참조 없음.
- **CHANGELOG**: 신규 Unreleased 항목이 다섯 fail-open 경로·`reason` 라벨 5종·알람 쿼리 예시·
  `OTEL_ENABLED` no-op 동작을 코드와 1:1 일치하게 서술한다.
- **spec 카탈로그 등재**: `_product-overview.md` §NF-OB-07 표의 신규 1행과
  `data-flow/9-observability.md` 미러 문장·`## Rationale` 신규 소절이 코드의 라벨 값(순서
  포함)과 정확히 일치하며, Rationale 섹션이 기존 3-섹션 구성(`## Rationale` 헤딩 하위 소절)
  관례를 그대로 따른다.

## 발견사항

- **[INFO]** 클래스 레벨 fail-open 5경로 표(`idempotency.interceptor.ts` 클래스 docstring,
  74-80행)에 `warn` 컬럼은 있지만 이번에 추가된 `metrics`(어느 `reason` 라벨로 잡히는지) 컬럼이
  없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스
    docstring 내 `| # | 경로 | 처리 | warn |` 표(72-81행 부근)
  - 상세: 바로 이 표 아래(85-87행)에 "이 목록은 개수를 세어 두는 것이 요점이다 … 경로를 늘릴
    때 이 표를 함께 갱신하지 않으면 다음 사람이 방어의 범위를 실제보다 좁게 읽는다" 라고
    스스로 경고하는데, 이번 diff 가 그 다섯 경로 전부에 `metrics` 계측을 추가하면서도 표
    자체는 `warn` 열만 유지한다. 다만 이 관찰은 신규가 아니다 — `10_29_50` RESOLUTION 의
    "조치하지 않은 INFO" 목록(4번, "docstring 표 `reason` 열")에서 이미 3라운드 연속 같은
    지점을 검토했고 "다음에 fail-open 경로가 추가될 때 그 표를 고치는 것이 자연스럽다" 는
    근거로 의도적으로 유예했다. 새 라운드에서 다시 여는 대신 그 결정을 확인만 한다.
  - 제안: 조치 불요 — 기존 3라운드 판정 유지. 이 표에 대한 재지적은 이번을 마지막으로 하고,
    실제로 6번째 fail-open 경로가 추가되는 시점에 `metrics` 열을 함께 넣는 편이 실질적이다.

## 요약

이번 라운드의 실질 코드/문서 변경분(`recordRedisFailOpen` 신설, `IdempotencyInterceptor` 다섯
경로 계측 배선, CHANGELOG, spec 카탈로그 등재)은 4차례 코드 리뷰·3차례 consistency-check 를
거치며 지적된 문서화 결함(JSDoc-describe 분리, describe 색인 stale, "닫힌 집합" 주석-구현 갭,
네이밍 불일치, 완료 plan 의 미해결 체크박스)이 전부 실제 소스에 반영돼 있음을 이번 라운드에서
직접 `Read`/`grep` 으로 재확인했다. CHANGELOG·클래스/메서드 JSDoc·테스트 파일 헤더 docstring·
spec 카탈로그(SoT+미러)·plan 문서 링크 사이에 새로운 불일치나 오래된 주석은 발견되지 않았다.
유일한 관찰은 클래스 docstring 표에 `metrics` 열이 없다는 INFO 하나이며, 이는 이미 3라운드
연속 검토·유예된 항목이라 이번에도 조치 불요로 판정한다.

## 위험도

NONE
