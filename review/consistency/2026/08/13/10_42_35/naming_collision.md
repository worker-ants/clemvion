# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확정

`_prompts/naming_collision.md` 는 `spec/5-system/` 전체(및 관련 data-flow/plan 문서)를 컨텍스트로
번들링했지만, `origin/main..HEAD` 실측 diff 기준으로 이번 턴에서 실제로 신규·변경된 부분은 다음
뿐이다 (나머지 번들 내용은 이미 병합된 선행 작업의 컨텍스트):

- `spec/5-system/_product-overview.md` — NF-OB-07 메트릭 카탈로그에 `clemvion.redis.fail_open` 행 추가
- `spec/data-flow/9-observability.md` — 같은 메트릭 언급 + Rationale 절 추가
- `codebase/backend/src/modules/metrics/business-metrics.service.ts`(+`.spec.ts`) — `RedisFailOpenComponent`/`RedisFailOpenReason` 타입, `recordRedisFailOpen()` 메서드, `redisFailOpen` 카운터 필드 신설
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`(+`.spec.ts`) — `METRICS_COMPONENT` 상수 + 5개 fail-open 경로에 `recordRedisFailOpen` 배선

신규로 도입되는 식별자: 메트릭명 `clemvion.redis.fail_open`, 타입 `RedisFailOpenComponent`/`RedisFailOpenReason`, 메서드 `recordRedisFailOpen`, 상수 `METRICS_COMPONENT`, 라벨 값 `component=idempotency` / `reason∈{get_failed,set_failed,serialize_failed,entry_corrupt,payload_corrupt}`.

## 점검 결과

`git grep`(codebase + spec 전체)로 위 식별자 전부를 조회한 결과, 이번 diff 가 만든 자리 이외에는
어디에도 나타나지 않는다 — 동일 이름이 다른 의미로 선점돼 있는 사례가 없다.

- **요구사항 ID**: `NF-OB-07` 은 기존 ID 재사용(신규 발급 아님, 카탈로그 행 추가일 뿐)이라 충돌 대상이 아니다. 신규 요구사항 ID 발급 없음.
- **엔티티/타입명**: `RedisFailOpenComponent`/`RedisFailOpenReason` — 저장소 전체에서 이 두 이름의 다른 선언 없음(`FailOpen` 계열 타입 자체가 이번 신설이 유일). `BusinessMetricsService` 의 `redisFailOpen` 필드명도 형제 필드(`executionTotal`·`llmTokens`·`nodeDuration`)와 명명 패턴 일치, 충돌 없음.
- **API endpoint**: 이번 diff 에 신규 endpoint 없음(메트릭/타입 전용 변경).
- **이벤트/메시지명**: OTel 메트릭명 `clemvion.redis.fail_open` 은 기존 5개 메트릭(`clemvion.execution.total`·`clemvion.execution.errors`·`clemvion.queue.depth`·`clemvion.llm.tokens`·`clemvion.node.duration`)과 이름이 겹치지 않고, `<domain>.<metric>` 명명 패턴도 일치한다. Prometheus sanitize 형 `clemvion_redis_fail_open` 도 마찬가지로 유일하다. webhook/queue/sse 이벤트명 신설 없음.
- **환경변수·설정키**: 신규 ENV/config key 없음(기존 `OTEL_ENABLED` 게이트 재사용).
- **파일 경로**: 신규 spec 파일 없음(기존 두 문서에 절 추가). 코드 파일도 기존 파일 수정뿐, 신규 파일 없음.

## 약한 동명 (참고, WARNING 미승격)

- **[INFO]** 라벨 키 `component`
  - target 신규 식별자: `clemvion.redis.fail_open` 메트릭의 라벨 키 `component` (값: `idempotency`)
  - 기존 사용처: `spec/conventions/user-guide-evidence.md:60` — evidence 분류 표의 컬럼명 `component` (재사용 UI 컴포넌트, 값 예: `ChatChannelCard`, `DynamicForm`)
  - 상세: 같은 영어 단어 `component` 를 쓰지만 도메인이 완전히 분리돼 있다 — 하나는 OTel Counter 라벨(백엔드 관측), 다른 하나는 프론트엔드 user-guide 증거 분류 축이다. 두 표가 같은 문서/섹션에서 인접 참조될 일이 없고, 각 라벨/컬럼은 자기 스키마 내에서만 닫힌 값 집합을 가지므로 실제 혼선 가능성은 낮다.
  - 제안: 조치 불요. 굳이 구분하려면 라벨 키를 `fail_open_component` 로 특정할 수 있으나, 기존 카탈로그의 다른 라벨(`status`·`queue`·`state`·`model`·`type`·`node_type`)도 모두 범용 단어를 그대로 쓰는 관례이므로 이 메트릭만 예외적으로 넓힐 이유가 약하다.

## 요약

이번 턴(`eia-r8-cache-scope` 세션의 실제 diff, `origin/main..HEAD`)이 도입하는 신규 식별자는
메트릭명 `clemvion.redis.fail_open`, 타입 `RedisFailOpenComponent`/`RedisFailOpenReason`, 메서드
`recordRedisFailOpen`, 상수 `METRICS_COMPONENT`, 라벨 값 5종(fail-open reason)이며, 저장소 전체
`git grep` 대조 결과 기존 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로
어느 축에서도 실질 충돌이 없다. 명명 패턴(`clemvion.<domain>.<metric>`, `record*` 메서드,
형제 카운터 필드명)도 기존 5개 메트릭과 일관되게 확장됐다. 유일하게 언급할 만한 것은 라벨 키
`component` 가 다른 문서(`user-guide-evidence.md`)의 표 컬럼명과 문자열이 같다는 점인데, 도메인이
완전히 분리돼 있어 INFO 수준의 참고 사항일 뿐 조치를 요하지 않는다.

## 위험도

NONE
