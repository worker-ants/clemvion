### 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 확인 과정에서 남길 만한 INFO 성 관찰 1건뿐이다.

- **[INFO]** `clemvion.queue.depth` 는 NF-OB-07 카탈로그 외에 세 번째 참조 지점이 있다 (충돌 아님)
  - target 위치: `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 표 (1행 추가 대상)
  - 충돌 대상: `spec/5-system/4-execution-engine.md:1197`, `:1664` (`clemvion.queue.depth` 를 NF-OB-07 참조와 함께 언급)
  - 상세: `grep -rl "clemvion\.execution\.total\|clemvion\.queue\.depth\|clemvion\.llm\.tokens\|clemvion\.node\.duration" spec/` 결과 `_product-overview.md`(SoT)·`data-flow/9-observability.md`(미러) 외에 `5-system/4-execution-engine.md` 도 걸린다. 다만 이 파일은 카탈로그 전체를 나열하지 않고 DLQ 모니터링 맥락에서 `queue.depth` 단일 지표만 인용하므로, `clemvion.redis.fail_open` 을 추가한다고 해서 이 파일이 stale 해지지는 않는다 — 실제 충돌 없음, 참고용으로만 기록.
  - 제안: 조치 불필요. 향후 다른 Redis fail-open 소비자를 배선할 때도 이 파일은 갱신 대상이 아님(범위 밖 유지).

### 교차 검증 상세 (참고)

- **요구사항 ID**: `grep -rn "NF-OB-07" spec/` → `5-system/_product-overview.md`(정의+카탈로그), `data-flow/9-observability.md`(미러), `2-navigation/4-integration.md`(단순 인용) 3곳뿐이며 전부 "도메인/비즈니스 커스텀 메트릭"이라는 동일 의미로 쓰인다. 다른 영역이 `NF-OB-07` 을 다른 의미로 재사용하는 사례 없음.
- **데이터 모델/라벨 충돌**: `RedisFailOpenComponent`(`'idempotency'` 단일값)·`RedisFailOpenReason`(5값)이 `codebase/backend/src/modules/metrics/business-metrics.service.ts` 와 `idempotency.interceptor.ts` 의 실제 호출부(`get_failed`/`entry_corrupt`/`payload_corrupt`/`serialize_failed`/`set_failed` 전부 사용됨)와 draft 표 값이 1:1 일치. `component`/`reason` 이라는 라벨 이름을 다른 메트릭이 이미 다른 의미로 쓰는 사례 없음(`spec/5-system/`, `spec/data-flow/` 전체 grep 0건).
- **EIA(External Interaction) idempotency 스펙과의 정합**: `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/15-external-interaction.md` 는 idempotency 캐시의 fail-open 동작을 "warn 로그" 로만 서술하고 별도 메트릭 유무를 단언하지 않는다 — 즉 이번 draft 가 "메트릭이 존재하지 않는다"는 기존 서술을 반증(모순)하는 상황이 아니다. 두 문서 모두 draft 의 `spec_impact` 범위 밖(EIA 캐시 동작 자체는 이미 별도로 SoT 화돼 있고, 이번 draft 는 관측성 카탈로그만 다룸)이라 갱신 불요.
- **RBAC/권한**: 신규 endpoint·권한 표면 없음(메트릭은 Prometheus scrape 로만 노출, 기존 `NF-OB-02` 인프라 재사용) — RBAC 모델과 무관.
- **계층 책임**: `BusinessMetricsService`(계측)와 `IdempotencyInterceptor`(호출부)의 책임 분리는 기존 `NF-OB-07` 카탈로그의 다른 4개 메트릭과 동일한 패턴(단일 계측 서비스 + 도메인 호출부) — 기존 아키텍처 결정과 정합.
- **범위 판단(`component: idempotency` 단일값)**: draft 는 다른 17개 fail-open 서비스 중 `recordRedisFailOpen` 을 실제로 호출하는 곳이 `IdempotencyInterceptor` 뿐임을 grep 으로 확인한 뒤 유니온을 `'idempotency'` 하나로 제한했다. "문서가 구현보다 넓어지면 안 된다"는 이 저장소의 기존 관행과 일치하며, 후속 배선 항목도 plan 에 별도 등재돼 있어 향후 확장 시 유니온·표 동시 갱신 지점이 명확하다.

### 요약

이 draft 는 새 엔티티·API·상태 머신·RBAC 규칙을 도입하지 않고, 이미 구현·배포된 `clemvion.redis.fail_open` OTel 카운터를 `NF-OB-07` 메트릭 카탈로그(SoT)와 그 미러 문장에 등재하는 순수 문서 동기화다. `NF-OB-07` ID 재사용, 라벨 이름(`component`/`reason`) 충돌, EIA idempotency 스펙과의 서술 모순, 계층 책임 재배치 등 cross-spec 관점의 실질 충돌은 발견되지 않았고, 표에 적을 라벨 값·유니온은 실제 코드 호출부와 정확히 1:1 대응한다. 유일하게 기록할 점은 `clemvion.queue.depth` 를 부분 인용하는 세 번째 파일(`5-system/4-execution-engine.md`)이 존재한다는 것인데, 이는 카탈로그 전체를 나열하지 않으므로 이번 변경으로 stale 해지지 않는다.

### 위험도
NONE
