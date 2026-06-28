# 신규 식별자 충돌 검토 결과

대상 문서: `spec/5-system/16-system-status-api.md` (id: `system-status-api`)

---

## 발견사항

### 발견 없음

아래 6개 관점을 전수 검토했으며 실질적 충돌은 발견되지 않았다.

---

### 1. 요구사항 ID 충돌

target 문서는 독립 요구사항 ID를 새로 부여하지 않는다. 참조하는 ID는 `NF-OB-06`(spec/5-system/_product-overview.md §5 관측성), `NAV-SS-01~08`(spec/2-navigation/_product-overview.md) 등이며 이미 해당 파일에 정의된 기존 ID다. 신규 ID 도입 없음.

---

### 2. 엔티티/타입명 충돌

- **INFO** — `health` 어휘의 다중 도메인 병존 (정의적 중복 없음)
  - target 신규 식별자: `QueueStatusDto.health: "healthy" | "degraded" | "down"`, `SystemStatusOverviewDto.overall: "healthy" | "degraded" | "down"`
  - 기존 사용처:
    - `spec/1-data-model.md` §2.8 Trigger: `notification_health: unknown | healthy | degraded`, `chat_channel_health: unknown | healthy | degraded`
    - `spec/data-flow/9-observability.md` §1.1: `/api/health` body `status: "healthy" | "unhealthy"` (binary)
  - 상세: 세 도메인이 모두 `healthy`/`degraded`/`down`(또는 유사 변형) 어휘를 사용하지만 각각 명확히 다른 네임스페이스(DB 컬럼 enum vs DTO 필드 vs health endpoint body)에 위치한다. target 의 `QueueStatusDto.health` 값은 `down`을 포함하는 3단계인 반면, Trigger의 `notification_health`/`chat_channel_health`는 `unknown`을 포함하되 `down`이 없는 3단계로 집합이 다르다. 이 차이는 `spec/5-system/16-system-status-api.md` Rationale R-4에서 의도적으로 설명되어 있다.
  - 제안: 현재 각 spec이 어휘 차이를 명시하고 있어 혼동 위험이 낮다. 향후 새 health 어휘를 추가할 경우 cross-ref 확보가 권장된다.

- `SystemStatusOverviewDto`, `QueueStatusDto`, `QueueRegistry` — spec/data-flow/9-observability.md에서 동일 명칭으로 참조하고 있으나 동일 의미로 일관되게 사용 중이며 충돌 없음.

---

### 3. API endpoint 충돌

- `GET /api/system-status/overview` — spec/5-system/2-api-convention.md §2.4 워크스페이스 스코핑 예외 목록에 이미 등재(line 70), spec/data-flow/9-observability.md에도 동일 경로가 동일 의미로 등재되어 있다. 신규 endpoint 정의가 아니라 기존 endpoint의 spec 상세화이며 충돌 없음.
- `/api/health`, `/api/health/live` — target이 참조만 하며(R-4 Rationale), 별도 정의하지 않는다. 충돌 없음.

---

### 4. 이벤트/메시지명 충돌

target 문서는 webhook, SSE, queue 이벤트 이름을 새로 도입하지 않는다. 큐 이름(`execution-run`, `background-execution` 등 16개)은 data-flow/0-overview.md §4 BullMQ 큐 카탈로그를 SoT로 명시하고 summary 역할임을 선언하고 있어 충돌 없음.

---

### 5. 환경변수·설정키 충돌

target 도입 ENV var:
- `SYSTEM_STATUS_FAILED_THRESHOLD` — 기존: spec/data-flow/9-observability.md에서 동일 키로 이미 참조됨. 동일 의미(degraded 판정 임계). 충돌 없음.
- `SYSTEM_STATUS_DELAYED_THRESHOLD` — 동상.
- `SYSTEM_STATUS_FAILED_WINDOW_MINUTES` — 동상.
- `SYSTEM_STATUS_FAILED_SCAN_CAP` — 동상.
- `EXECUTION_RUN_WORKER_CONCURRENCY` — spec/5-system/4-execution-engine.md §11에서 동일 키·동일 의미로 이미 정의됨. 충돌 없음.
- `CONTINUATION_WORKER_CONCURRENCY` — 동상.

deprecated 상수 `FAILED_DEGRADED_THRESHOLD`/`DELAYED_DEGRADED_THRESHOLD`는 target에서 폐기 선언만 하며 다른 spec 파일에는 이 이름으로 참조되는 곳이 없다. 충돌 없음.

---

### 6. 파일 경로 충돌

- target 파일 경로: `spec/5-system/16-system-status-api.md` — 이미 실제로 존재하는 파일이며 신규 도입 파일이 아님. spec/5-system/ 내 `N-name.md` 컨벤션(숫자 prefix + kebab-case)을 준수한다.
- spec ID `system-status-api`는 `spec/2-navigation/15-system-status.md`의 ID `system-status`와 다르다. 접미어 `-api` 로 명확히 구분되며 충돌 없음.

---

## 요약

`spec/5-system/16-system-status-api.md`(id: `system-status-api`)가 도입하거나 재선언하는 식별자 전 범주(요구사항 ID, 엔티티/DTO명, API endpoint, ENV var, 파일 경로)를 검토한 결과, 기존 사용처와 의미가 다른 충돌 식별자는 발견되지 않았다. `health` 어휘가 Trigger 컬럼, `/api/health` body, 큐 DTO 세 곳에 병존하나 각각 네임스페이스가 분리되어 있고 spec 내에서 명시적으로 설명되어 있다. ENV var 6종은 모두 동일 의미로 기존 spec에서 이미 참조 중이며 신규 키가 없다.

---

## 위험도

NONE
