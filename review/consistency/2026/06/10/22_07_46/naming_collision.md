## 발견사항

### 1. 요구사항 ID 충돌 없음

target 문서가 사용하는 변경 ID (`C-1` ~ `C-4`) 는 plan 내부 로컬 레이블이다. spec 의 공식 요구사항 ID 체계 (`NAV-*`, `NF-*`, `ND-*`, `ND-AG-*` 등) 와 다른 namespace 를 사용하고 있으며, 동일 plan 파일 안에서만 참조되므로 글로벌 충돌은 없다.

단, `/Volumes/project/private/clemvion/.claude/worktrees/health-probe-status-d9a184/plan/in-progress/spec-sync-structural-followups.md` 에서 이미 `C-1` ~ `C-19` 레이블이 사용 중이다. 두 plan 이 동시에 `in-progress` 상태를 유지하는 동안 리뷰어나 독자가 "C-1" 이라는 레이블이 어느 plan 의 항목인지 컨텍스트 없이 혼동할 수 있다.

- **[INFO]** plan 내부 변경 ID (`C-1`~`C-4`) 가 다른 진행 중 plan 과 레이블 중복
  - target 신규 식별자: `C-1`, `C-2`, `C-3`, `C-4` (plan 로컬 레이블)
  - 기존 사용처: `plan/in-progress/spec-sync-structural-followups.md` — 동일 레이블로 전혀 다른 항목 19건 열거
  - 상세: 두 plan 파일이 동시에 `in-progress` 인 기간 동안 C-1/C-2/C-3/C-4 가 각각 다른 의미를 갖는다. 리뷰 대화 중 "C-2 확인해줘" 처럼 참조하면 어느 plan 의 항목인지 명확하지 않다.
  - 제안: plan 내부 변경 ID 에 파일명 prefix 를 붙이는 관행 도입 (예: `HP-C-1`), 또는 현재 spec-sync-structural-followups 가 완료(complete 이동) 된 후 본 plan 을 활성화하면 자연 해소.

---

### 2. API Endpoint 충돌 없음

- `GET /api/health` — 기존에 이미 존재하는 endpoint 이며, target 은 이를 신규 생성하지 않고 동작을 변경(status code 의미 명문화)한다. 신규 endpoint 는 `/api/health/live` 뿐이다.
- `GET /api/health/live` — spec 전체 및 코드베이스 검색 결과 기존 정의 없음. 충돌 없음.

---

### 3. 환경변수 충돌 없음

- `HEALTH_CHECK_LOG` — `codebase/backend/.env.example` 및 spec 전체에 동일 키가 없음. 기존 ENV var 네임스페이스(예: `SYSTEM_STATUS_*`, `EXECUTION_MAX_*`, `CONTINUATION_WORKER_*` 등)와 겹치지 않는다. 충돌 없음.

---

### 4. 엔티티/타입명 충돌 없음

target 이 도입하는 신규 코드 엔티티·DTO는 없다. `/api/health/live` 응답 body `{ status: 'ok' }` 는 신규 타입이지만, 기존 `HealthCheckDto` / `HealthCheckItemDto` 와 이름 공간이 다르며 독립 endpoint 용 inline shape 이므로 충돌 없음.

---

### 5. 기존 spec 서술과의 의미 충돌

- **[WARNING]** `spec/5-system/3-error-handling.md §7 헬스 체크` — `/api/health` 를 "liveness probe 용 binary 판정" 으로 설명
  - target 신규 의미: C-1 에서 `/api/health` 를 **readiness** probe 전용으로 재정의
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/health-probe-status-d9a184/spec/5-system/3-error-handling.md` 라인 380 — "liveness probe 용 binary 판정(`unhealthy`)을 쓴다"
  - 상세: target 은 `/api/health` 를 readiness probe 로, `/api/health/live` 를 liveness probe 로 분리한다. 그러나 기존 `3-error-handling.md §7` 은 `/api/health` 를 "liveness probe 용" 으로 명시하고 있다. target 은 `spec/5-system/16-system-status-api.md` 만 `target_specs` 에 열거하고 `3-error-handling.md` 는 미포함이다.
  - 제안: target 이 `spec/data-flow/9-observability.md` 를 갱신할 때, `spec/5-system/3-error-handling.md §7` 의 해당 주석도 함께 수정 대상으로 `target_specs` 에 추가하거나 별도 후속 plan 으로 추적해야 한다. "liveness probe 용" 표현을 "readiness probe 용" 으로 정정하고 `/api/health/live` 를 liveness probe 용으로 추가 언급해야 한다.

---

### 6. 파일 경로 충돌 없음

target 은 기존 파일 `spec/data-flow/9-observability.md` 와 `spec/5-system/16-system-status-api.md` 를 수정 대상으로 지정하며 신규 spec 파일을 생성하지 않는다. 파일 경로 충돌 없음.

---

### 7. 이벤트/메시지명 충돌 없음

target 은 webhook·queue·SSE 이벤트를 신규 도입하지 않는다. `LoggingInterceptor` 로그 경로 필터링은 런타임 분기이며 이벤트 이름 namespace 를 사용하지 않는다.

---

## 요약

target 문서(`spec-draft-health-probe-status.md`)가 도입하는 신규 식별자(`HEALTH_CHECK_LOG` ENV var, `/api/health/live` endpoint, plan 로컬 레이블 `C-1`~`C-4`)는 기존 코드·spec·환경변수 네임스페이스와 실질적 충돌이 없다. 단 두 가지 주의 사항이 있다: (1) `spec/5-system/3-error-handling.md §7` 이 `/api/health` 를 "liveness probe 용" 으로 기술하고 있어 target 의 readiness 재정의 후 해당 문서 갱신이 누락되면 독자에게 혼선을 줄 수 있다(WARNING). (2) plan 내부 레이블 C-1~C-4 가 동시 진행 중인 다른 plan 과 겹치는 것은 사소한 혼동 가능성(INFO) 수준이다.

## 위험도

LOW
