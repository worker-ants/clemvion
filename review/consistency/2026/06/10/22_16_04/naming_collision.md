### 발견사항

- **[CRITICAL]** `/api/health` 의 probe 역할 재정의 — 기존 "liveness probe 용" 진술과 직접 충돌
  - target 신규 식별자: `/api/health` = readiness probe 전용 (HP-C-1)
  - 기존 사용처: `spec/5-system/3-error-handling.md:380` — `> **참고**: \`/api/health\` 는 liveness probe 용 binary 판정(\`unhealthy\`)을 쓴다.`
  - 상세: target 은 `/api/health` 를 readiness probe 전용으로 재정의하고, liveness 는 `/api/health/live` 로 분리한다. 기존 3-error-handling.md §7.2 의 참고 문장은 `/api/health` 를 명시적으로 "liveness probe 용" 으로 규정하고 있어 의미 충돌이 발생한다. target plan 자체도 이를 "Critical #2 — 정정 필수" 로 인식해 §영향받는 문서에 명기하고 있다. 즉, 이 충돌은 알려진 것으로 plan 범위 내에서 정정될 예정이나, spec 실제 작성 전까지는 충돌 상태가 존재한다.
  - 제안: target spec 이식(3-error-handling.md §7.2 참고 Note 교체) 이 완료되기 전에 구현이 선행되어서는 안 된다.

- **[WARNING]** `SERVICE_UNAVAILABLE` 에러 코드 와 HTTP 503 의 의미 중첩
  - target 신규 식별자: `/api/health` 가 unhealthy 시 HTTP 503 반환 (HP-C-1)
  - 기존 사용처: `spec/5-system/3-error-handling.md:26` — `SERVICE_UNAVAILABLE` 에러 코드가 "의존 서비스 접근 불가" 의미로 정의, `spec/5-system/4-execution-engine.md:1148` — `SERVER_SHUTTING_DOWN` 이 503 사용
  - 상세: 기존 503 사용처는 (a) `SERVER_SHUTTING_DOWN` (SIGTERM 수신 후 새 실행 거부) 및 (b) `WEBAUTHN_DISABLED` (WebAuthn 비활성 시)이다. target 이 추가하는 503 은 /api/health readiness 실패용으로 의미적으로 구분되나, HP-C-1 의 503 은 body 를 보존(GlobalExceptionFilter 우회)하고 기존 503 사용처는 GlobalExceptionFilter 가 생성하는 `{error:{...}}` shape 를 사용한다. 이 차이가 spec 에 명시되지 않으면 독자 혼동이 있을 수 있다.
  - 제안: 9-observability.md §1.1 에 "unhealthy 시 503 응답은 `{status, version, uptime, checks}` body 를 유지하며 `GlobalExceptionFilter` 의 `{error:{...}}` shape 로 변형되지 않는다" 한 줄을 추가해 3-error-handling.md §1.1 의 `SERVICE_UNAVAILABLE` 에러 코드와의 의미 분리를 명확히 한다.

- **[WARNING]** `외부 (k8s liveness / 사용자)` mermaid 액터 라벨이 신규 분기 구조를 반영하지 못함
  - target 신규 식별자: `/api/health/live` (HP-C-2) — liveness probe 전용 신규 엔드포인트
  - 기존 사용처: `spec/data-flow/9-observability.md:37` — `participant K as 외부 (k8s liveness / 사용자)` 가 GET `/api/health` 단일 흐름만 표시
  - 상세: target 이 `/api/health/live` 를 추가하면 mermaid sequence 상 액터 K 가 두 endpoint 로 분기해야 하나 현재 다이어그램은 단일 흐름만 표시한다. target plan §영향받는 문서 WARNING #1 에서도 인식하고 있다.
  - 제안: 9-observability.md §1.1 mermaid 시퀀스를 두 참여자(readiness probe → `/api/health`, liveness probe → `/api/health/live`)로 분기해 갱신한다.

- **[WARNING]** R-4 대조 진술의 "binary `healthy | unhealthy`" 표현이 부분적으로 부정확해짐
  - target 신규 식별자: `/api/health` HTTP 200(healthy) / 503(unhealthy) — HTTP status code 가 의미를 가짐
  - 기존 사용처: `spec/5-system/16-system-status-api.md:116` — `기존 \`/health\` 엔드포인트는 binary \`healthy | unhealthy\` 다`
  - 상세: 이 진술은 body 의 status 어휘(healthy|unhealthy)를 지칭하는 것으로 target 변경 후에도 body status 는 binary 로 유지되나, 이제 HTTP status code 도 의미를 가지므로 "binary" 가 body status 기준임을 명확히 해야 독자 혼동이 없다. target plan §영향받는 문서에서도 cross-ref 1줄 추가를 계획하고 있다.
  - 제안: 16-system-status-api.md R-4 에 "binary 는 응답 body 의 status 어휘 기준이며, HTTP status code 는 200/503 으로 readiness 신호를 추가로 전달한다" 문장을 삽입한다.

- **[INFO]** `HEALTH_CHECK_LOG` 환경변수 — 기존 코드베이스 및 spec 에 미존재, 신규 도입
  - target 신규 식별자: `HEALTH_CHECK_LOG` (boolean ENV var, default `false`, HP-C-4)
  - 기존 사용처: `codebase/backend/.env.example` 및 `spec/` 전체에 해당 식별자 없음 (전수 검색 결과 0건)
  - 상세: 충돌 없음. 기존 `SYSTEM_STATUS_*` 계열 env var 네이밍과 prefix 체계가 달라 혼동 여지 낮다. `.env.example` 추가 시 다른 env var 의 `#` 주석 패턴(한국어 설명 + 기본값 표기)을 따른다.
  - 제안: 별도 조치 불필요.

- **[INFO]** 요구사항 ID `HP-C-1`~`HP-C-4` — 기존 사용처 없음
  - target 신규 식별자: `HP-C-1`, `HP-C-2`, `HP-C-3`, `HP-C-4`
  - 기존 사용처: `spec/` 및 `plan/` 전체에 `HP-C-` prefix 사용 없음 (전수 검색 결과 0건)
  - 상세: 충돌 없음. 기존 요구사항 ID 체계(NAV-WF-*, ND-AG-* 등)와 구분되는 신규 prefix 이다. 다만 spec 이식 후에는 `_product-overview.md` 에 등재하는 프로젝트 규약을 따라야 한다.
  - 제안: 구현 완료 후 `spec/5-system/_product-overview.md` 에 HP-C 시리즈 ID 를 등재하거나 기존 observability 관련 요구사항 번호 체계에 통합한다.

---

### 요약

target 이 도입하는 신규 식별자 중 즉각적인 hard 충돌은 `/api/health` 의 probe 역할 재정의(`spec/5-system/3-error-handling.md §7.2` 기존 "liveness probe 용" 진술과의 의미 역전) 한 건이다. 이는 target plan 자체가 "Critical #2 — 정정 필수" 로 인식하고 있으며 spec 이식이 구현보다 선행되어야 한다. 나머지 WARNING 2건은 기존 mermaid 다이어그램(`9-observability.md:37`) 및 16-system-status-api.md R-4 의 부분적 부정확 문장으로, 구현 착수 전 spec 갱신 체크리스트에 포함되어 있다. `HEALTH_CHECK_LOG` ENV var 및 `HP-C-*` 요구사항 ID 는 기존 사용처가 없어 충돌이 없다.

### 위험도

MEDIUM
