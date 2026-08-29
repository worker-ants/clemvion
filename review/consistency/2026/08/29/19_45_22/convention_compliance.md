# 정식 규약 준수 검토 — `spec/data-flow/`

## 검토 범위 확인 (선행 사실)

`git diff origin/main...HEAD --stat -- spec/data-flow/` 는 **빈 결과**다 — 이 브랜치는
`spec/data-flow/` 를 **전혀 건드리지 않는다**. 실제 변경분은:

- `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (`cause` 비노출 불변식 계측 추가)
- `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` / `redis-fail-open-catalog.spec.ts` (신규 — 코드 union·spec 카탈로그·실배선 3자 정합 가드)
- `secret-resolver.service.ts` / `code.handler.spec.ts` / `expression-resolver.service.spec.ts` / `error-shape.spec.ts` 소폭 수정
- `plan/in-progress/*.md` 2건, `review/code/2026/08/29/19_17_28/**` (직전 코드 리뷰 산출물)

즉 이번 변경은 **spec 을 새로 쓰지 않고, 이미 존재하는 spec 서술(예: `spec/data-flow/9-observability.md`
Rationale "`clemvion.redis.fail_open` 의 `component` 를 실제 배선된 값만 열거하는 이유")이 코드와
계속 정합하도록 강제하는 CI 가드를 추가**하는 작업이다. 따라서 아래 검토는 (a) 신규 가드가 `spec/data-flow/`
가 이미 선언한 불변식과 실제로 일치하는지, (b) `spec/data-flow/` 번들 전체가 `spec/conventions/**` 를
준수하는 기존 상태인지 두 갈래로 진행했다.

## 발견사항

- **[INFO]** `clemvion.redis.fail_open` 3자 정합 가드가 target spec 의 기존 불변식과 일치함 (참고 확인, 위반 아님)
  - target 위치: `spec/data-flow/9-observability.md` Rationale "`clemvion.redis.fail_open` 의 `component` 를 실제 배선된 값만 열거하는 이유" (target 문서 §Rationale 말단)
  - 관련 규약: `spec/conventions/redis-keys.md` 는 아니지만 동일한 "코드가 곧 규약" 원칙(§Rationale "왜 규칙을 코드에 맞췄나")과 궤를 같이함
  - 상세: target 문서는 "이 카운터에 실제로 배선된 것은 EIA 멱등 캐시(`idempotency`) 하나뿐" 이라고 명시한다.
    신규 가드(`redis-fail-open-catalog-guard.ts`)는 `business-metrics.service.ts` 의 `RedisFailOpenComponent`
    유니온을 AST 로 읽는데, 실측하면 `export type RedisFailOpenComponent = 'idempotency';` 로 target 문서의
    서술과 정확히 일치한다. 가드는 이 유니온 · `spec/5-system/_product-overview.md` NF-OB-07 카탈로그 행 ·
    `recordRedisFailOpen(...)` 실호출부 세 지점을 서로 대조해, 앞으로 이 셋이 갈라지면 즉시 실패하도록 만든다.
  - 제안: 없음 — target 문서를 코드가 뒷받침하는 방향으로 가드가 정합성을 강화한 사례. 다만 이 가드가 대조하는
    `spec/5-system/_product-overview.md` 카탈로그 행은 `spec/data-flow/` scope 밖이라 본 리뷰에서 직접 판정하지
    않았다.

- **[INFO]** `15-external-interaction.md §4` 의 "EIA 계열 키 미등재" 각주가 `redis-keys.md` 대비 오독 소지
  - target 위치: `spec/data-flow/15-external-interaction.md` §4 외부 의존 표, Redis 행 — "키 **형태**는
    [실행 엔진 §9.1](../5-system/4-execution-engine.md#91-키-패턴) 참고 — 다만 EIA 계열 키는 그 표에 아직
    미등재다(별도 항목)"
  - 위반 규약: `spec/conventions/redis-keys.md` §3 전역 인벤토리
  - 상세: `redis-keys.md` §3 인벤토리에는 이미 `iext:blacklist:<jti>` · `interaction:idempotency:<executionId>:<route>:<key>`
    가 "소유 모듈 `modules/external-interaction`, 상세 SoT `data-flow/15 §2.2`" 로 **등재되어 있다**(§3 표 3번째 행).
    `4-execution-engine.md §9.1` 자체도 2026-08-13 정정으로 이미 `redis-keys.md` 를 SoT 로 가리키도록
    고쳐졌고, `§9.2` (실행 엔진 소유 키 전용 표)에 EIA 키가 없는 것은 의도된 범위 밖이지 "미등재" 가 아니다.
    즉 이 각주의 "아직 미등재" 라는 표현은 (i) `§9.2` 실행-엔진-전용 표 기준으로는 맞지만 (ii) 저장소 전역
    SoT 인 `redis-keys.md §3` 기준으로는 이미 사실이 아니다 — 같은 문서 §2.2 상단이 "키 형태 규칙과 저장소
    전역 인벤토리는 `conventions/redis-keys.md` 가 SoT" 라고 정확히 적어 둔 것과 대비된다. 한 문서 안에서
    "SoT 는 redis-keys.md"(§2.2) 와 "그 표에 아직 미등재"(§4, 실은 다른 표를 가리킴)가 나란히 있어 독자가
    §4 만 보면 EIA 키가 어디에도 정식 등재되지 않은 것으로 오독할 수 있다.
  - 제안: §4 각주를 "실행 엔진 §9.2(엔진 소유 키 전용 표)에는 없다 — EIA 키의 정식 등재는
    [`conventions/redis-keys.md §3`](../conventions/redis-keys.md) 인벤토리(§2.2 참조)" 로 명확화하거나,
    이미 §2.2 에 동일 취지 문장이 있으므로 §4 각주를 아예 제거하고 §2.2 참조로 통합. CRITICAL/WARNING 은
    아님 — 이 브랜치의 diff 범위 밖(pre-existing)이고 실질 오류(끊긴 링크·잘못된 SoT 지목)는 아니라 표현
    모호성 수준.

## 준수 확인 (위반 없음, 근거만 기록)

- **네이밍** — `9-observability.md` 의 헬스체크 경로(`/api/health`, `/api/health/live`), 큐 이름
  (`alerts-evaluator`), 메트릭 이름(`clemvion.redis.fail_open` 등 dot-namespaced)은 각각 대응하는
  코드 상수·현행 배선과 정확히 일치했다(직접 grep 확인: `RedisFailOpenComponent = 'idempotency'`).
- **BullMQ 큐 카탈로그 정합** — `0-overview.md §4` 는 18개 큐(카탈로그 SoT, `agent-memory-extraction`
  포함)를, `9-observability.md §1.4` 는 "17개" (System Status 가 실제로 모니터링하는 부분집합)를
  언급한다. `codebase/.../system-status.constants.ts` 의 `MONITORED_QUEUES` 를 직접 세어보면 정확히
  17개(= `agent-memory-extraction` 제외)로, 두 숫자는 서로 다른 대상(전체 카탈로그 vs 모니터링
  서브셋)을 가리키며 실제로 상충하지 않는다 — 오탐 후보였으나 실측으로 기각.
- **`redis-keys.md` §1 키 형태 규칙** — `15-external-interaction.md §2.2` 표의 `iext:blacklist:<jti>`,
  `interaction:idempotency:<executionId>:<route>:<key>`, `exec:seq:<executionId>` 는 모두
  `{도메인}:{용도}[:{식별자}...]` 형태를 따른다.
- **`node-cancellation.md` 교차 참조** — `data-flow/3-execution.md`·`7-llm-usage.md` 가 가리키는
  `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` ·
  `node-cancellation-residual-signal-propagation.md` 는 실제로 존재해 dangling 참조가 아니다.
- **문서 구조** — 검토한 `spec/data-flow/*.md` (9-observability, 14-chat-channel, 15-external-interaction,
  0-overview, 1-audit, 2-auth, 3-execution) 전부 Overview → 본문(Source→Sink/Schema/상태 전이/외부
  의존) → Rationale 3섹션 구성을 지킨다. `0-` prefix 도 `0-overview.md` 하나로 CLAUDE.md 컨벤션과 일치.

## 요약

이번 브랜치는 `spec/data-flow/` 를 전혀 변경하지 않으며, 순수 코드 영역에 `clemvion.redis.fail_open`
3자(코드 union·spec 카탈로그·실배선) 정합 가드와 `cause` 비노출 계측을 추가하는 작업이다. 신규 가드는
`spec/data-flow/9-observability.md` 가 이미 선언한 "component 는 실제 배선된 값만 열거한다" 는 불변식과
실측상 정확히 맞아떨어져 오히려 그 규약 준수를 자동화로 강화한다. `spec/data-flow/` 번들 전체를 훑어도
`spec/conventions/**` 위반은 발견되지 않았고, 유일한 소득은 `15-external-interaction.md §4` 의 Redis 키
등재 각주가 `redis-keys.md §3` 인벤토리 갱신(이미 등재됨)을 반영하지 못해 표현이 모호해진 pre-existing
INFO 항목 하나다. CRITICAL/WARNING 급 정식 규약 위반은 없다.

## 위험도

LOW
