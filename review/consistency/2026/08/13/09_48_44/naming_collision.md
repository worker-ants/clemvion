STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 1 INFO

### 발견사항

- **[INFO]** `component`/`reason` 라벨명은 제네릭 — 기존 컨벤션과 동일 패턴이라 실질 충돌 아님
  - target 신규 식별자: `clemvion.redis.fail_open` 카운터의 라벨 `component` (값: `idempotency`), `reason` (값: `get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`)
  - 기존 사용처: `spec/conventions/user-guide-evidence.md:60` 의 `ImplAnchor.kind` enum 값 `"component"` (재사용 UI 컴포넌트 분류), `spec/5-system/9-rag-search.md:144` 및 `spec/5-system/14-external-interaction-api.md:336` 의 `reason` (재임베딩 필요 사유 / 토큰 갱신 실패 사유)
  - 상세: 완전히 다른 도메인(프론트엔드 문서 증거 분류, RAG 재임베딩 사유, 토큰 갱신 에러 사유)에서 같은 영어 단어를 쓰고 있을 뿐이다. OTel 라벨은 인스트루먼트별로 네임스페이스가 분리되므로(Prometheus 시계열 키가 `metric_name{label=value}` 로 완전히 별개) 실제 충돌은 없다. 이미 §NF-OB-07 카탈로그 자체도 `status`(execution.total) / `status`(node.duration) 처럼 같은 라벨명을 다른 메트릭에 재사용하는 기존 관례가 있어, 이번 추가는 그 관례를 그대로 따른다.
  - 제안: 대응 불필요. 참고용 기록.

target 이 실제로 새로 도입하는 식별자들을 전수 대조했다.

1. **요구사항 ID** — `NF-OB-07` 은 `spec/5-system/_product-overview.md:75,77` 에 이미 존재하는 ID다(도메인/비즈니스 커스텀 메트릭). target 은 **새 ID 를 만드는 게 아니라 기존 ID 산하의 카탈로그 표에 1행을 추가**하는 것이며, 코드(`BusinessMetricsService`)가 이미 이 ID 를 SoT 로 인용 중이므로 의미 충돌 없음(오히려 정합). `grep -rn "NF-OB-07" spec/` 전수 확인 결과 다른 곳에서 다른 의미로 쓰인 사례 없음.
2. **엔티티/타입명** — `RedisFailOpenComponent`/`RedisFailOpenReason` 는 `codebase/backend/src/modules/metrics/business-metrics.service.ts:38,41` 에 이미 코드로 존재하고(이 draft 는 이미 구현된 코드를 spec 에 등재하는 것), 저장소 전체(`grep -rn` `codebase/backend/src`)에서 이 두 이름이 다른 의미로 쓰이는 곳 없음.
3. **API endpoint** — target 은 endpoint 를 추가하지 않음. 해당 없음.
4. **이벤트/메시지명** — 메트릭명 `clemvion.redis.fail_open`(Prometheus sanitize 시 `clemvion_redis_fail_open`)은 기존 카탈로그의 5개 메트릭(`clemvion.execution.total` / `clemvion.execution.errors` / `clemvion.queue.depth` / `clemvion.llm.tokens` / `clemvion.node.duration`, `spec/5-system/_product-overview.md:81-85`)과 겹치지 않는 새 이름. 저장소 전체 grep 으로 사전 사용처 없음을 확인.
5. **환경변수·설정키** — target 이 새로 도입하는 ENV var/config key 없음.
6. **파일 경로** — target 은 새 spec 파일을 만들지 않고 기존 `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md` 를 수정한다. plan 파일 `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` 는 기존 `spec-draft-<topic>.md` 명명 컨벤션(`spec-draft-eia-r8-alignment.md` 선례)을 따르고 다른 파일과 겹치지 않음.

추가로 `plan/in-progress/` 전체를 대상으로 `NF-OB-07`/`clemvion.redis`/`RedisFailOpen` 를 grep 해 동시 진행 중인 다른 draft 가 같은 식별자를 다른 의미로 선점하고 있지 않은지 확인했고, 해당 없음을 확인했다(`cafe24-backlog-residual.md`, `backend-lint-gate-broken-on-main.md` 의 "Redis" 언급은 이 draft 의 배경 서사일 뿐 별개 식별자 도입이 아님).

### 요약

target 은 새 제품 결정이 아니라 이미 구현·리뷰된 코드(`clemvion.redis.fail_open` 카운터, `RedisFailOpenComponent`/`RedisFailOpenReason` 타입)를 기존 요구사항 ID `NF-OB-07` 산하 카탈로그 표와 그 미러 문서에 등재하는 작업이다. 요구사항 ID·엔티티/타입명·메트릭(이벤트)명·ENV·파일 경로 6개 축을 저장소 전체 대상으로 grep 대조한 결과 어느 축에서도 기존 사용처와의 의미 충돌이 없었고, 유일하게 발견된 것은 `component`/`reason` 이라는 제네릭 영어 단어가 완전히 무관한 도메인에서 재사용된 사례(정보용 INFO, 실질 충돌 아님)뿐이다.

### 위험도
NONE
