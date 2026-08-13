# 신규 식별자 충돌 검토 — spec-draft-nf-ob-07-redis-fail-open.md

## 검토 방법

target 이 새로 도입한다고 주장하는 식별자들을 실제 저장소(`spec/`, `plan/`, `codebase/`) 전체에서
grep 하여 (a) 이미 다른 의미로 쓰이고 있는지, (b) 기존 명명 컨벤션과 충돌하는지 확인했다.

대상 식별자:
- 메트릭 이름 `clemvion.redis.fail_open`
- 라벨 `component` / `reason` (해당 메트릭 스코프)
- 라벨 값 닫힌 집합: `idempotency` / `get_failed`·`set_failed`·`serialize_failed`·`entry_corrupt`·`payload_corrupt`
- 타입명 `RedisFailOpenComponent` / `RedisFailOpenReason`
- 요구사항 ID: 신규 ID 없음 (기존 `NF-OB-07` 표에 행 추가)
- 파일 경로: 신규 spec 파일 없음 (기존 2개 파일 수정)

## 발견사항

이번 target 은 **신규 제품 결정이 아니라 이미 구현된 코드(`BusinessMetricsService`,
`RedisFailOpenComponent`/`RedisFailOpenReason`, `IdempotencyInterceptor`)를 spec SoT
(`_product-overview.md` §NF-OB-07 카탈로그 표 + `data-flow/9-observability.md` 미러)에
사후 등재하는 문서 작업이다. 즉 target 이 "새로" 정의하는 식별자 문자열은 이미
`codebase/backend/src/modules/metrics/business-metrics.service.ts`,
`business-metrics.service.spec.ts`, `idempotency.interceptor.ts`,
`idempotency.interceptor.spec.ts` 에 동일한 철자로 존재하며, target 은 그 기존 정의를
그대로 인용할 뿐 새 의미를 부여하지 않는다. 충돌 여부는 이 문자열이 spec 내 **다른** 곳에서
**다른 의미**로 이미 쓰이고 있는지가 관건인데, 아래와 같이 전수 확인한 결과 충돌이 없다.

- `clemvion.redis.fail_open` — `spec/5-system/_product-overview.md` §NF-OB-07 기존 카탈로그
  5행(`clemvion.execution.total` · `clemvion.execution.errors` · `clemvion.queue.depth` ·
  `clemvion.llm.tokens` · `clemvion.node.duration`) 중 동일 이름 없음. `spec/` 전체에서도
  `clemvion.redis.*` prefix 사용처 없음(target 자신 제외). 코드베이스와도 100% 일치
  (`business-metrics.service.ts:86` `meter.createCounter('clemvion.redis.fail_open', ...)`).
- `RedisFailOpenComponent` / `RedisFailOpenReason` — `spec/`·`plan/` 어디에도 다른 정의 없음.
  코드의 타입 alias(`business-metrics.service.ts:38,41`)와 target 의 인용이 정확히 일치.
- 라벨 값 `idempotency` — 컴포넌트 라벨 값으로서 `IdempotencyInterceptor`(기존
  `EIA-IN-11`, `spec/5-system/14-external-interaction-api.md:890`)를 가리키는 용도로 이미
  코드 주석(`idempotency.interceptor.ts:28-29`)이 정의한 것과 동일 — 새 의미 충돌 없음.
- `get_failed`·`set_failed`·`serialize_failed`·`entry_corrupt`·`payload_corrupt` — `spec/`
  전체에서 다른 용도로 쓰인 사례 없음(target 최초 등재).
- 요구사항 ID — target 은 새 ID 를 발급하지 않는다. 기존 `NF-OB-07` 표에 행을 추가할 뿐이므로
  ID 충돌 관점에서 해당 없음.
- API endpoint / webhook·queue·SSE 이벤트명 / ENV var·config key — target 범위에 해당 항목 없음
  (순수 관측 카운터 카탈로그 등재이며 endpoint·이벤트·환경변수 신설이 없다).
- 파일 경로 — target 은 신규 spec 파일을 만들지 않고 기존 `spec/5-system/_product-overview.md`,
  `spec/data-flow/9-observability.md` 를 수정한다. `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`
  파일명 자체도 동일 디렉터리의 기존 관례(`spec-draft-<slug>.md`, 예:
  `spec-draft-eia-r8-alignment.md`)와 일치하며 기존 파일과 겹치지 않는다.

라벨 이름 `component`/`reason` 은 OTel/Prometheus 관례상 메트릭 이름에 스코프되는 라벨이라
다른 `clemvion.*` 메트릭이 같은 라벨명을 재사용해도 값 집합이 다르면 문제 없다(Prometheus 는
`<metric>_bucket{component=...}` 형태로 메트릭별 독립 시계열을 갖는다). 현재 카탈로그의 다른
5개 메트릭 중 `component`/`reason` 라벨을 쓰는 곳이 없어 즉각적 혼동도 없다 — 참고 수준의
INFO 조차 아니다.

## 요약

target 이 도입한다고 서술하는 모든 식별자(메트릭명·타입명·라벨·라벨 값)를 `spec/`·`plan/`·
`codebase/` 전체에서 grep 대조한 결과, 기존 사용처와 이름이 겹치거나 의미가 충돌하는 사례는
없었다. 이는 신규 제품 결정이 아니라 이미 구현·리뷰된 코드의 식별자를 spec SoT 에 사후 등재하는
문서 동기화 작업이라는 target 자신의 성격과 부합한다 — 코드가 이미 이 이름들의 유일한 정의처이고
target 은 그 정의를 그대로 반영할 뿐이다. 신규 요구사항 ID·엔드포인트·이벤트·환경변수·신규 파일도
발급/생성하지 않으므로 해당 축의 충돌 가능성도 구조적으로 없다.

## 위험도

NONE
