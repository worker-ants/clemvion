### 발견사항

- **[INFO]** 동일 캐시 키 조립 로직에 두 개의 다른 헬퍼 이름(`scopedKey` / `idempotencyCacheKey`)
  - target 신규 식별자: `scopedKey(executionId, rawKey, route?)` — `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:81-89` (신규, unit)
  - 기존 사용처: `idempotencyCacheKey(executionId, rawKey, route?)` — `codebase/backend/test/external-interaction.e2e-spec.ts:129-136` (같은 PR 에서 함께 신규 도입, e2e)
  - 상세: 두 함수는 정확히 같은 포맷 문자열(`interaction:idempotency:${executionId}:${route}:${rawKey}`)을 조립하는 동일 개념의 헬퍼인데 이름이 다르다. 이름 충돌(같은 이름이 다른 의미)은 아니고 오히려 "같은 의미, 다른 이름" 이라 §식별자 충돌 기준의 CRITICAL/WARNING 요건(동일/유사 식별자가 다른 의미로 쓰임)에는 해당하지 않는다. 다만 향후 세 번째 자리(예: FE mock, 운영 스크립트)에서 또 다른 이름의 헬퍼가 생기면 "이름은 다른데 포맷 문자열은 손으로 복제" 패턴이 반복돼, 포맷이 바뀔 때 세 곳 중 하나만 갱신되는 사일런트 drift 위험이 생긴다. unit 쪽 docstring(L77-82)이 이미 "인자 순서가 e2e 의 `idempotencyCacheKey` 와 같다" 고 교차 참조해 두어 현재는 실질적 혼선이 없음을 확인했다.
  - 제안: 지금 당장 병합할 필요는 없음(WARNING 아님). 세 번째 소비처가 생기는 시점에 공용 test-util 로 승격하거나, 최소한 두 docstring 모두에 "포맷 변경 시 반대편도 갱신" 주석을 유지할 것.

- **[정보 확인 — 신규 발견 아님]** 이전 라운드(`review/consistency/2026/08/12/19_56_51/naming_collision.md`) WARNING 해소 확인
  - 이전 WARNING: spec draft 가 제안한 Redis 키 세그먼트 이름 `<endpoint>` 가 기존 확립 용어 `endpointPath`(webhook 트리거 URL 경로, `spec/1-data-model.md`/`spec/5-system/12-webhook.md`)와 혼동될 수 있다는 지적.
  - 확인 결과: 실제 구현·spec 최종본은 `<endpoint>` 가 아니라 `<route>` 를 채택했다 — `spec/data-flow/15-external-interaction.md:258`, `spec/5-system/14-external-interaction-api.md:1061-1064`, 코드 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:121`(`route = context.getHandler().name`)이 모두 `route` 로 일관. `endpointPath` 와 문자열이 겹치지 않아 해당 WARNING 은 해소됐다.
  - `route` 자체가 기존 `ExecutionRoutingContext`/`routingContext`(WS 아웃바운드 채널 라우팅, `codebase/backend/src/modules/websocket/websocket.service.ts:48` 등, 완전히 다른 도메인)와 어근이 겹치는지 추가 확인했으나, 식별자 텍스트(`route` vs `routingContext`)와 스코프(로컬 변수/파라미터 vs export 타입)가 달라 실질적 혼동 가능성은 낮다고 판단해 별도 항목으로 등재하지 않았다.

### 요약

이번 diff(`idempotency.interceptor.ts`/`.spec.ts`, `test/external-interaction.e2e-spec.ts`)는 spec 파일을 전혀 건드리지 않고, 이미 선행 planner 턴(`eia-idempotency-key-scope`)에서 spec 에 반영된 [Spec EIA §R8] "캐시 키 스코프"(`interaction:idempotency:<executionId>:<route>:<key>`)를 그대로 구현·테스트한 것이다. 새로 도입되는 요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, webhook/queue/SSE 이벤트명, 환경변수·설정키, spec 파일 경로는 하나도 없다(`RequestWithInteraction` 은 기존 타입 재사용, `REDIS_KEY_PREFIX`/`IDEMPOTENCY_HEADER` 는 기존 상수). 유일하게 새로 도입된 이름은 테스트 전용 로컬 헬퍼 `scopedKey`/`idempotencyCacheKey` 뿐이며 저장소 전체를 검색해도 동명·유사명 충돌은 없다. 직전 검토 라운드가 지적했던 `<endpoint>` vs `endpointPath` 혼동은 최종 구현이 `<route>` 를 채택하면서 해소됐다. 신규 식별자 충돌 관점에서 CRITICAL/WARNING 급 발견은 없다.

### 위험도

NONE
