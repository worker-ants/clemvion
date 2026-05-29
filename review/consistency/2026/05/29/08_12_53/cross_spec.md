# Cross-Spec 일관성 검토 — `spec/5-system/12-webhook.md`

검토 모드: 구현 착수 전 검토 (--impl-prep)
대상 문서: `spec/5-system/12-webhook.md`
검토 기준: 다른 `spec/**` 영역과의 충돌 분석

---

## 발견사항

### [CRITICAL] Webhook 수신 엔드포인트 URL 경로가 3개 영역에서 모두 다름

- **target 위치**: `12-webhook.md §1 아키텍처 개요`, `WH-EP-02`, `§3.1 API 명세`, `§6 구현 파일 구조`, `§7 처리 흐름`, `§8 보안 고려사항`
- **충돌 대상**:
  - `spec/5-system/2-api-convention.md §11.1` — `POST {base_url}/hooks/{endpoint_path}` (`/api` prefix 없음)
  - `spec/data-flow/10-triggers.md` 줄 14, 25, 54 — `/api/webhooks/:path`
  - `spec/data-flow/10-triggers.md` 줄 180 — `/api/webhooks/:workspaceSlug/:path` (라우팅 충돌 해결용 형태)
- **상세**: `12-webhook.md` 는 `/api/hooks/:endpointPath` 를 단일 진실로 기술한다. `2-api-convention.md §11.1` 은 `{base_url}/hooks/{endpoint_path}` (prefix `/api` 없음, 참고 note "``/hooks/*`` 경로는 ``/api/*`` 경로와 분리")로 정의한다. `data-flow/10-triggers.md` 는 `/api/webhooks/:path` 를 사용하면서 라우팅 고유성을 위해 `/api/webhooks/:workspaceSlug/:path` 라고도 기술한다. 세 형태가 실제 라우터가 어떤 path 를 listen 하는지에 대해 직접 모순된다. 구현자는 어느 경로를 선택해야 할지 알 수 없으며, 잘못된 경로로 구현하면 외부 호출자가 수신에 실패한다. 또한 `data-flow/10-triggers.md` 줄 180 은 `spec/5-system/12-webhook.md` 를 참조해 `/api/webhooks/:workspaceSlug/:path` 형태를 주장하나 `12-webhook.md` 어디에도 workspaceSlug segment 나 `/api/webhooks/` 경로가 없다.
- **제안**: `spec/5-system/12-webhook.md` 가 URL 형태의 단일 진실이어야 한다. `2-api-convention.md §11.1`, `data-flow/10-triggers.md` 를 `12-webhook.md` 의 `WH-EP-02` (`/api/hooks/{endpoint_path}`) 에 맞춰 일괄 수정한다. `workspaceSlug` routing 여부는 별도 명시적 결정이 필요하다 — endpoint_path 가 전역 UUID 기반이면 workspaceSlug 없이도 고유하지만, `(workspace_id, endpoint_path)` UNIQUE 는 다른 워크스페이스가 동일 path 를 가질 수 있음을 허용하여 라우팅 모호성이 생긴다. 이를 `12-webhook.md` §2.1 또는 §3.1 에서 명시적으로 해소해야 한다.

---

### [CRITICAL] 동기 실행 모드(`?wait=true`)가 `12-webhook.md` 에 없음

- **target 위치**: `12-webhook.md §3.1 API 명세`, `WH-RS-01`, `WH-NF-01`
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.4`
- **상세**: `2-api-convention.md §11.4` 는 `?wait=true` 쿼리 파라미터를 사용한 동기 응답 모드 (200 OK + 워크플로우 최종 출력 데이터, 최대 30초 타임아웃 + `EXECUTION_TIMEOUT` 에러) 를 정식 규약으로 정의한다. `12-webhook.md` 는 이 모드를 전혀 기술하지 않고 `WH-RS-01` 이 "즉시 202 Accepted" 만을 필수 요구사항으로 선언한다. 구현자가 `2-api-convention.md` 를 보면 동기 모드를 구현해야 한다고 판단할 수 있지만 `12-webhook.md` 에는 없는 기능이다.
- **제안**: `?wait=true` 모드를 지원할 의도가 있다면 `12-webhook.md §3.1` 에 요구사항 항목과 구현 상세를 추가한다. 지원 의도가 없다면 `2-api-convention.md §11.4` 에서 동기 모드 설명을 제거하거나 "현재 미구현" 으로 명시한다.

---

### [WARNING] Rate limiting 단위와 수치가 서로 다름

- **target 위치**: `12-webhook.md §6` ("Rate Limiting 적용: 트리거당 60req/min"), `WH-SC-05`
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.7` ("워크스페이스 기준 1000 req/min")
- **상세**: `12-webhook.md` 는 트리거 단위 60req/min 을 명시한다. `2-api-convention.md §11.7` 는 워크스페이스 단위 1000 req/min 을 정의한다. 두 단위(트리거 vs. 워크스페이스)와 수치(60 vs. 1000)가 모두 다르다.
- **제안**: `12-webhook.md §6` 이 Webhook 도메인 단일 진실이므로 트리거당 60req/min 을 채택하고, `2-api-convention.md §11.7` 을 `12-webhook.md §6` 과 일치하도록 수정하거나 "상세 규칙은 `12-webhook.md §6` 참조"로 위임한다.

---

### [WARNING] HMAC 서명 헤더명 기본값이 다름

- **target 위치**: `12-webhook.md §4.2` (default header `X-Hub-Signature-256`, `config.header` 로 변경 가능), `WH-SC-02`
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.5` (`X-Webhook-Signature` 헤더, 고정값으로 기술)
- **상세**: `12-webhook.md §4.2` 는 HMAC 서명 헤더를 `config.header` (default `X-Hub-Signature-256`) 로 정의해 사용자가 헤더명을 바꿀 수 있게 한다. `2-api-convention.md §11.5` 는 `X-Webhook-Signature` 를 고정 헤더명으로 기술한다. 기본값이 `X-Hub-Signature-256` vs. `X-Webhook-Signature` 로 불일치하며, 변경 가능 여부 설계도 다르다. `2-api-convention.md` 가 AuthConfig 도입(2026-05-28) 이전 시점의 구 설계를 반영하고 있을 가능성이 높다.
- **제안**: `2-api-convention.md §11.5` 를 `12-webhook.md §4.2` 기준(AuthConfig.type=hmac, header = config.header, default `X-Hub-Signature-256`)으로 갱신한다.

---

### [WARNING] 202 응답 본문 shape 불일치

- **target 위치**: `12-webhook.md §3.1` 성공 응답 (`{ "executionId": "uuid", "message": "..." }`)
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.4` 비동기 응답 (`{ "data": { "executionId": "...", "status": "pending", "triggeredAt": "..." } }`)
- **상세**: `12-webhook.md §3.1` 은 `{ executionId, message }` flat shape 를 정의한다. `2-api-convention.md §11.4` 는 `{ data: { executionId, status, triggeredAt } }` 래퍼 구조를 정의한다. 두 차이: (a) `data` 래퍼 유무, (b) `message` vs. `status`+`triggeredAt` 필드 집합. 외부 호출자가 응답을 파싱할 때 shape 불일치로 오류가 발생한다. 또한 `12-webhook.md §3.1` 은 `interaction.enabled=true` 시 추가 필드가 동봉된다고 명시하는데, `2-api-convention.md` 는 이 확장을 인지하지 못한다.
- **제안**: `spec/5-system/12-webhook.md §3.1` 이 Webhook 응답의 단일 진실로 확정한다. `2-api-convention.md §11.4` 를 `{ executionId, message }` 기준으로 갱신하거나, 표준 API 응답 래퍼(`data:`) 를 Webhook 수신 엔드포인트에도 적용할지 명시적으로 결정한다.

---

### [WARNING] HTTP 메서드 지원 범위 불일치

- **target 위치**: `12-webhook.md WH-EP-03` ("HTTP POST 메서드 지원"), `§2.3.1` ("httpMethod: read-only, v1 은 POST 고정")
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.2` (GET/POST/PUT 모두 지원, 미설정 메서드 405 응답)
- **상세**: `12-webhook.md` 는 v1 기준 POST 단일 메서드만 지원하고 `httpMethod` 필드를 read-only 로 잠근다. `2-api-convention.md §11.2` 는 GET/POST/PUT 세 메서드를 지원하며 Trigger 엔티티에 허용 메서드를 설정한다고 정의한다. POST 이외 메서드의 지원 여부가 정면으로 모순된다.
- **제안**: v1 범위를 POST 전용으로 확정한다면 `2-api-convention.md §11.2` 에서 GET/PUT 지원 설명을 제거하거나 "v2 예정" 으로 표시한다.

---

### [WARNING] Content-Type 지원 범위 불일치

- **target 위치**: `12-webhook.md WH-EP-04`, `§3.1` (`application/json`, `application/x-www-form-urlencoded` 만 기재)
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.3` (위 둘에 추가로 `text/plain` 지원)
- **상세**: `2-api-convention.md §11.3` 은 `text/plain` 을 "텍스트로 저장"하는 세 번째 Content-Type 으로 정의한다. `12-webhook.md` 는 이를 포함하지 않는다. `text/plain` 수신 여부, 저장 구조가 불명확하다.
- **제안**: `text/plain` 지원 여부를 `12-webhook.md` 에 명시적으로 포함하거나 제외한다. 지원 시 워크플로우 입력 구조 (`body` 필드 값이 문자열인 경우) 를 §5 에 기재한다.

---

### [WARNING] `data-flow/10-triggers.md` 가 workspaceSlug 세그먼트를 `12-webhook.md` 에서 인용했으나 해당 정의가 없음

- **target 위치**: 해당 없음 (target 문서에 없는 개념)
- **충돌 대상**: `spec/data-flow/10-triggers.md` 줄 180
- **상세**: `data-flow/10-triggers.md` 는 `spec/5-system/12-webhook.md` 를 출처로 인용하면서 `/api/webhooks/:workspaceSlug/:path` 형태의 URL 을 기술하나, `12-webhook.md` 어디에도 이 형태가 없다. `(workspace_id, endpoint_path)` UNIQUE 제약과 결합하면 다른 워크스페이스가 동일 endpoint_path 를 가질 수 있어 `/api/hooks/:endpointPath` 단독으로는 라우팅이 모호해질 수 있다. 이 모호성 해소 방안이 spec 어디에도 명시되지 않았다.
- **제안**: `12-webhook.md §2.1` 또는 §3.1 에 endpoint_path 전역 고유성 여부를 명시한다. UUID 기반 자동 생성(WH-MG-02)으로 충돌 확률이 극히 낮더라도 UNIQUE 제약이 workspace_id scope 임을 고려해 라우팅 전략을 명문화한다. `data-flow/10-triggers.md §12.2` 도 일치하게 갱신한다.

---

### [INFO] 워크플로우 입력 데이터에 `path` 필드 누락

- **target 위치**: `12-webhook.md §5` (워크플로우 입력 데이터 — `parameters`, `body`, `headers`, `query`, `method`)
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.6` (`"path": "/hooks/order-created"` 포함)
- **상세**: `2-api-convention.md §11.6` 은 워크플로우 첫 노드 입력에 `path` 필드를 포함한다. `12-webhook.md §5` 에는 없다. `$input.path` 접근 가능 여부가 불명확하다.
- **제안**: `path` 를 전달할 의도라면 `12-webhook.md §5` 에 추가한다. 의도 없다면 `2-api-convention.md §11.6` 에서 제거한다.

---

### [INFO] API Key 검증 경로 불일치 — 쿼리 파라미터 지원 여부

- **target 위치**: `12-webhook.md §4.4` (API Key — 헤더 `config.headerName` 로만 검증)
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.5` (`X-API-Key` 헤더 또는 `?api_key=` 쿼리 파라미터)
- **상세**: `2-api-convention.md §11.5` 는 API Key 를 헤더 또는 쿼리 파라미터로 전달할 수 있다고 정의한다. `12-webhook.md §4.4` 는 헤더 `config.headerName` 만 검증한다. 쿼리 파라미터 경로 지원 여부가 모순된다.
- **제안**: `12-webhook.md §4.4` 에 쿼리 파라미터 지원 여부를 명시한다. 지원하지 않는다면 `2-api-convention.md §11.5` 에서 해당 옵션을 제거한다.

---

## 요약

`spec/5-system/12-webhook.md` 는 2026-05-28 의 AuthConfig 단일 진입 리팩토링으로 내부 일관성은 높지만, 동일 도메인을 다루는 `spec/5-system/2-api-convention.md §11` 과 `spec/data-flow/10-triggers.md` 가 이 리팩토링을 반영하지 못한 채 구 설계를 유지하고 있어 충돌이 집중됐다. 가장 심각한 것은 Webhook 수신 URL 형태의 4가지 변형(`/api/hooks/:endpointPath` vs. `/hooks/:path` vs. `/api/webhooks/:path` vs. `/api/webhooks/:workspaceSlug/:path`) 으로, 구현자가 실제 라우터 경로를 결정할 수 없는 상태다. `?wait=true` 동기 모드는 `2-api-convention.md` 에만 존재해 구현 여부 자체가 모호하다. Rate Limit 단위/수치, HMAC 헤더 기본값, 202 응답 shape, HTTP 메서드/Content-Type 범위도 각각 `2-api-convention.md §11` 과 직접 충돌한다. 구현 착수 전에 `2-api-convention.md §11` 전체를 `12-webhook.md` 기준으로 갱신하고, `data-flow/10-triggers.md` 의 URL 및 workspaceSlug 관련 기술을 정정하는 것이 선결 조건이다.

---

## 위험도

CRITICAL
