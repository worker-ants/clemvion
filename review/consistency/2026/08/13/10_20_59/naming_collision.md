# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 검토 범위 확정

`git diff origin/main...HEAD` 로 실제 변경분을 절대경로 워크트리 기준 확인:

- `spec/5-system/_product-overview.md` — NF-OB-07 카탈로그 표에 1행 추가 (기존 ID, 신규 ID 아님)
- `spec/data-flow/9-observability.md` — 동일 메트릭을 가리키는 미러 문장 + Rationale 절 추가
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `RedisFailOpenComponent`/`RedisFailOpenReason` 타입, `redisFailOpen` Counter 필드, `recordRedisFailOpen()` 메서드 신규
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `METRICS_COMPONENT` 상수, optional DI `metrics` 필드, 5개 fail-open 경로에 `recordRedisFailOpen` 배선
- 대응 `.spec.ts` 2건(테스트만, 신규 프로덕션 식별자 없음)

target 이 실제로 도입하는 신규 식별자는 다음 5종류로 수렴한다: 메트릭명 `clemvion.redis.fail_open`, 타입명 `RedisFailOpenComponent`/`RedisFailOpenReason`, 메서드명 `recordRedisFailOpen`, 라벨 키 `component`/`reason`(+그 리터럴 값 5개). 신규 요구사항 ID, 신규 API endpoint, 신규 ENV var, 신규 spec 파일은 이번 변경에 없음.

## 발견사항

- **[INFO]** 라벨 키 `reason` 이 다른 spec 문서에서 이미 범용어로 사용 중
  - target 신규 식별자: `clemvion.redis.fail_open` Counter 의 라벨 키 `reason` (값: `get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`)
  - 기존 사용처: `spec/5-system/9-rag-search.md:144` (`reason`: `reembedding_in_progress`/`reembedding_required`, 재임베딩 상태 필드) · `spec/5-system/14-external-interaction-api.md:336` (`message` 에 동봉되는 토큰 갱신 실패 `reason`)
  - 상세: 두 기존 사용처 모두 OTel 메트릭 라벨이 아니라 API 응답/에러 페이로드의 필드명이며, 값 도메인도 완전히 다르다(재임베딩 상태 vs. 토큰 갱신 사유 vs. Redis fail-open 원인). 네임스페이스가 겹치지 않아(하나는 Prometheus 라벨, 나머지는 JSON 필드) 실제 혼선 가능성은 낮다. `component` 라벨 키도 동일하게 저장소 전체에서 다른 의미로 쓰인 사례가 없음(discord 파서의 `component_type`/`components` 는 Discord API 자체 필드로 무관한 도메인).
  - 제안: 조치 불요 — 범용 영어 단어의 자연스러운 재사용. 다만 향후 새 OTel instrument 를 추가할 때 라벨 키 네이밍이 기존 API 필드명과 겹치면 대시보드 쿼리 문서에서 "이 `reason` 은 어느 메트릭/API 것인가" 를 메트릭명으로 항상 함께 표기하는 관례를 유지할 것(현재 카탈로그 표는 이미 `clemvion.redis.fail_open` 앞에 명시하고 있어 정합).

- **[INFO]** 요구사항 ID `NF-OB-07` 은 재사용(확장)이며 재정의 아님
  - target 신규 식별자: 없음(카탈로그 표 행만 추가, ID 자체는 기존 `NF-OB-07`)
  - 기존 사용처: `spec/5-system/_product-overview.md` §5 (원본 정의), `spec/data-flow/9-observability.md` (SoT 링크로 참조)
  - 상세: target 은 `NF-OB-07` 의 서술 문구("워크플로 실행·큐·LLM·노드 지연" → "...·Redis fail-open 강등")를 확장하고 카탈로그 표에 6번째 메트릭 행을 추가했을 뿐, ID 자체를 재부여하지 않았다. 요구사항 ID 축에서 충돌 없음.
  - 제안: 조치 불요(정보용 확인).

## 검증한 항목 (충돌 없음 확인)

1. **요구사항 ID** — 신규 ID 없음. `git grep -n "NF-OB-07"` 결과 정의처 1곳(§5)·참조처만 확인, 의미 재정의 없음.
2. **엔티티/타입명** — `RedisFailOpenComponent`, `RedisFailOpenReason` 을 저장소 전체(`git grep`)로 확인. `business-metrics.service.ts`(정의처)와 `idempotency.interceptor.ts`(소비처), 그리고 이번 changeset 산출물인 `plan/`·`review/` 문서에서만 등장. 다른 의미의 기존 정의 없음.
3. **API endpoint** — 신규 endpoint 없음(diff 에 controller/route 변경 없음).
4. **이벤트/메시지명** — 메트릭 instrument 이름 `clemvion.redis.fail_open` 이 `business-metrics.service.ts` 의 기존 5개 instrument(`clemvion.execution.total`, `clemvion.execution.errors`, `clemvion.llm.tokens`, `clemvion.node.duration`, `clemvion.queue.depth`)와 겹치지 않음을 소스 직접 대조로 확인. Prometheus sanitize 후 이름(`clemvion_redis_fail_open`)도 기존 이름들과 충돌하지 않음.
5. **환경변수·설정키** — 신규 ENV var 없음(diff 에 `process.env` 참조 추가 없음).
6. **파일 경로** — 신규 spec 파일 없음. 기존 `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md` 를 편집했을 뿐 파일명·경로 신설/충돌 없음.

## 요약

target 이 실제로 도입하는 신규 식별자(`clemvion.redis.fail_open` 메트릭, `RedisFailOpenComponent`/`RedisFailOpenReason` 타입, `recordRedisFailOpen` 메서드, `component`/`reason` 라벨)는 절대경로 워크트리와 저장소 전체 grep 대조 결과 기존 사용처와 의미가 겹치는 CRITICAL/WARNING 급 충돌이 없다. 유일한 관찰은 `reason`/`component` 라는 범용 라벨 키가 완전히 무관한 도메인(RAG 재임베딩 상태, EIA 토큰 갱신 에러)의 API 필드명과 이름만 같을 뿐 네임스페이스(Prometheus 라벨 vs JSON 필드)와 값 도메인이 갈려 실질 혼선 위험이 낮은 INFO 수준이다. 요구사항 ID·API endpoint·ENV var·spec 파일 경로 축에서는 신규 도입 자체가 없어 충돌 여지가 없다.

## 위험도

NONE
