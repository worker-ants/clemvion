# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 대상 재확인

프롬프트의 `## Target 문서`는 `spec/5-system/` 전체를 번들링했지만, 실제 `git diff origin/main...HEAD`
로 확인한 변경분은 훨씬 좁다 — **NF-OB-07 메트릭 카탈로그에 `clemvion.redis.fail_open` 카운터 1건을
등재**하는 작업이다 (plan: `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`).

- `spec/5-system/_product-overview.md` — NF-OB-07 요구사항 설명 문구 갱신 + 카탈로그 표 1행 추가
- `spec/data-flow/9-observability.md` — 외부 의존 섹션의 미러 문장 갱신 + `## Rationale` 신규 소절 추가
- 코드: `codebase/backend/src/modules/metrics/business-metrics.service.ts` (`recordRedisFailOpen`,
  `RedisFailOpenComponent`/`RedisFailOpenReason` 닫힌 유니온), `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  (5개 fail-open 경로에 배선)

프롬프트의 `<git diff origin/main...HEAD -- code_areas>` 항목은 컨텍스트 예산 초과로 절단되어 있었으므로,
작업 트리를 직접 `git diff`로 재확인해 이 좁은 스코프를 확정했다(허위로 넓은 스코프를 가정하지 않기 위함).

## 발견사항

교차 검증한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 중 이번 변경이
실제로 건드리는 것은 "요구사항 ID(NF-OB-07)"와 관측성 데이터 모델(메트릭 라벨) 뿐이며, 둘 다
기존 spec/코드와 충돌 없이 정합했다.

- 라벨 값 집합 일치: spec 표의 `component (idempotency)` / `reason (get_failed/set_failed/serialize_failed/entry_corrupt/payload_corrupt)` 가
  코드의 `RedisFailOpenComponent = 'idempotency'`, `RedisFailOpenReason = 'get_failed' | 'set_failed' | 'serialize_failed' | 'entry_corrupt' | 'payload_corrupt'` 와
  값·순서 모두 1:1 일치.
- `entry_corrupt`/`payload_corrupt` 의미 매핑도 코드(`discardCorruptEntry('엔트리' | 'payload', ...)`)와 spec 서술이 부합.
- NF-OB-07 요구사항 ID는 신규 채번이 아니라 **기존 ID 재사용**이므로 다른 영역에서의 ID 충돌 가능성 자체가 없음.
- 미러 동기화: `spec/5-system/_product-overview.md`(SoT) 표와 `spec/data-flow/9-observability.md`(미러 문장) 양쪽이 같은 커밋에서 함께 갱신됨. repo 전체에서 `NF-OB-07`/`clemvion.node.duration`/`clemvion.llm.tokens`/`clemvion.queue.depth` 를 인용하는 다른 위치(`spec/5-system/4-execution-engine.md`, `spec/2-navigation/4-integration.md`)는 카탈로그를 나열 인용하지 않고 NF-OB-07을 참조만 하므로 갱신 누락(drift) 없음.
- `spec/data-flow/15-external-interaction.md` §Rationale "Fail-open 정책의 일관 표기"가 이미 "Redis 실패율 관측 수단이 필요하다"고 명시해 둔 gap을 이번 메트릭이 정확히 메움 — 상충이 아니라 이행(fulfillment) 관계.
- 계층 책임: `IdempotencyInterceptor`(external-interaction 모듈)가 `BusinessMetricsService`(metrics 모듈)를 `@Optional()` 주입으로 소비하는 패턴은 이미 `execution-engine.service.ts`·`continuation-dlq-monitor.service.ts`·`llm-usage-log.service.ts` 가 쓰는 기존 관례와 동일 — 새로운 모듈 간 의존 경계를 만들지 않음.
- RBAC·API 계약·엔티티 상태 전이: 이번 변경은 신규 endpoint·필드·상태를 추가하지 않아 해당 관점에서는 검토 대상 자체가 없음.

CRITICAL/WARNING 급 충돌은 발견되지 않았다.

## 요약

이번 diff는 이미 구현·리뷰된 사실(다섯 fail-open 경로에 대한 `clemvion.redis.fail_open` OTel 카운터)을
NF-OB-07 카탈로그 표와 그 미러 문서에 등재하는 좁은 범위의 spec 갱신이며, 라벨 값·의미·SoT/미러
동기화가 코드와 정확히 1:1로 일치한다. `spec/data-flow/15-external-interaction.md` 가 이전에 명시했던
"Redis 실패율 관측 수단 부재" 갭을 정확히 메우는 방향이라 다른 영역 spec과 상충하지 않고 오히려
정합성을 높인다. 신규 요구사항 ID·엔티티·API·상태 전이·RBAC 변경이 없어 교차 충돌 표면 자체가 작다.

## 위험도

NONE
