# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-webhook-consistency.md`
검토 일시: 2026-05-29
검토자: Cross-Spec 일관성 checker (sub-agent)

---

## 발견사항

### [CRITICAL] `2-api-convention §11.1` URL 이 `/api` prefix 누락 — 정정 방향은 옳으나 동반 note 삭제 필수

- **target 위치**: 결정 테이블 #2 — "`{base_url}/hooks/` → `{base_url}/api/hooks/`. §11.1 의 '`/hooks/*` 는 `/api/*` 와 분리' note 삭제 (사실과 반대)"
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.1` 현행 본문
  ```
  POST {base_url}/hooks/{endpoint_path}
  > 참고: `/hooks/*` 경로는 `/api/*` 경로와 분리된다. API Gateway에서 별도 라우팅.
  ```
- **상세**: 현행 `2-api-convention §11.1` 에는 (a) URL 이 `{base_url}/hooks/{endpoint_path}` (no `/api`) 로 기술되고, (b) "`/hooks/*` 는 `/api/*` 와 분리된다" 라는 note 까지 추가되어 있다. 코드 ground truth (`hooks.controller.ts` → global prefix `api` + `@Controller('hooks')`) 상 실제 경로는 `/api/hooks/:endpointPath` 이므로 두 기술 모두 사실과 반대다. draft 가 URL 을 `{base_url}/api/hooks/` 로 정정하고 note 를 삭제하겠다는 결정은 옳다. 그러나 `§11.1` 만 수정하면 같은 파일의 `§11.3` 처리 플로우 (`URL에서 endpoint_path 추출`) 는 여전히 `/api` 없는 URL 을 전제하므로 함께 검토해야 한다. 또한 `2-trigger-list.md §2.4` 도 현재 `{base_url}/hooks/{endpoint_path}` (no `/api`) 를 정의하고 있어 동기화 대상이다.
- **제안**: `spec/5-system/2-api-convention.md §11.1` URL + note 수정, `§11.3` 처리 플로우 prefix 정합, `spec/2-navigation/2-trigger-list.md §2.4` 를 `{base_url}/api/hooks/{endpoint_path}` 로 일괄 변경.

---

### [CRITICAL] `data-flow/10-triggers.md` Webhook URL 이 `/api/webhooks/:workspaceSlug/:path` 로 기술 — 코드와 전면 불일치

- **target 위치**: 결정 테이블 #3 ("`/api/webhooks/` 표기 제거") + #12 (`workspaceSlug` 라우팅 제거)
- **충돌 대상**: `spec/data-flow/10-triggers.md` — 복수 위치
  - Overview §1.2 코드 진입점: "`codebase/backend/src/modules/hooks/hooks.controller.ts` — `/api/webhooks/:path` 진입"
  - §1.2 시퀀스 다이어그램: `Ext->>Hk: POST /api/webhooks/:path (headers, body)` + `Hk->>PG: SELECT trigger WHERE endpoint_path=:path AND type='webhook' AND is_active`
  - Rationale "Webhook `endpoint_path` 의 UNIQUE 범위": "공개 URL 은 `/api/webhooks/:workspaceSlug/:path` 형태로 라우팅되어 충돌이 없다 (`spec/5-system/12-webhook.md`)"
- **상세**: `data-flow/10-triggers.md` 는 세 곳에서 서로 다른 URL 을 쓴다. (a) 코드 진입점 주석은 `/api/webhooks/:path`, (b) 시퀀스 다이어그램은 `POST /api/webhooks/:path`, (c) Rationale 은 `/api/webhooks/:workspaceSlug/:path`. 실제 코드 라우트는 `/api/hooks/:endpointPath` (단일 경로, workspaceSlug 세그먼트 없음) 이므로 (a)(b)(c) 모두 틀리다. draft 결정 #3 과 #12 가 이 불일치를 명시적으로 인지하고 있다. 특히 Rationale 의 `workspaceSlug` 이중 세그먼트 언급은 `12-webhook.md §8` 로 참조 출처를 달고 있지만, `12-webhook.md` 본문에는 `/api/hooks/:endpointPath` 만 있고 `workspaceSlug` 세그먼트는 정의되지 않는다 — 즉 `data-flow` 의 Rationale 이 없는 spec 을 cross-link 하고 있는 것이다. 그대로 두면 두 spec 이 다른 라우트를 정본으로 가리키게 된다.
- **제안**: `spec/data-flow/10-triggers.md` 의 Overview 코드 진입점, §1.2 시퀀스 다이어그램, Rationale 세 위치를 모두 `POST /api/hooks/:endpointPath` 로 정정하고, `workspaceSlug` 세그먼트 언급을 제거. draft 갱신 파일 목록 #4 에 이미 포함되어 있으며 정정 방향이 올바르다.

---

### [CRITICAL] `2-api-convention §11.2` 에서 GET·PUT 지원 기술 — POST 전용 코드와 모순

- **target 위치**: 결정 테이블 #8 — "§11.2 에서 GET·PUT 행 삭제"
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.2` 현행 본문
  ```
  | GET | ✓ | 간단한 트리거 (쿼리 파라미터) |
  | PUT | ✓ | 일부 외부 서비스 호환용 |
  ```
  이 기술과 함께: "Trigger 엔티티에 허용 메서드를 설정한다. 설정되지 않은 메서드로 요청 시 `405 Method Not Allowed`."
- **상세**: 코드 (`hooks.controller.ts`) 는 `@Post(':endpointPath')` 하나만 존재한다. GET·PUT 핸들러가 없으므로 `12-webhook.md §3.1` (POST 전용) 과 코드 모두 GET·PUT 을 지원하지 않는다. `2-api-convention §11.2` 가 GET·PUT 을 "지원" 으로 표기하는 것은 직접 모순이다. 또한 "허용 메서드를 Trigger 엔티티에 설정" 이라는 기술 자체가 `1-data-model.md §2.8 Trigger` 의 `config` JSONB 에도 정의되지 않은 메서드 설정 필드를 전제하고 있어 데이터 모델과도 충돌한다.
- **제안**: `§11.2` 표에서 GET·PUT 행 삭제, POST 만 `✓` 로 남기고 "Trigger 엔티티에 허용 메서드 설정" 문구 제거.

---

### [CRITICAL] `2-api-convention §11.4` 동기 모드 (`?wait=true`) — 미구현인데 spec 에 존재

- **target 위치**: 결정 테이블 #4 — "§11.4 동기모드 제거 (구 설계 잔재)"
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.4` 현행 본문
  ```
  | 동기 | 워크플로우 실행 완료 후 응답 (쿼리: `?wait=true`, 최대 대기 30초) | `200 OK` + 워크플로우 최종 출력 데이터 |
  ```
  동기 응답 예시 JSON (`status: "pending"`, `triggeredAt`, `200 OK` 동기 경로 등)
- **상세**: 코드 (`hooks.controller.ts`) 에는 `@Query('wait')` 파라미터가 존재하지 않는다. 비동기 202 응답만 구현된 상태이며 동기 모드는 설계 잔재다. `2-api-convention §11.4` 는 동기 모드와 타임아웃 에러 응답까지 상세히 기술하고 있어, 미구현 기능이 spec 에 있는 상태다. 또한 §11.4 의 비동기 응답 shape 이 `{ data: { executionId, status: "pending", triggeredAt } }` 인데, 코드의 실제 wire 응답 (`TransformInterceptor` 래핑 후) 은 `{ data: { executionId, message } }` 이어서 `status`, `triggeredAt` 두 필드가 없고 `message` 필드가 있어 응답 shape 도 불일치한다.
- **제안**: `§11.4` 동기 모드 행 및 동기 응답 예시 삭제. 비동기 응답 shape 을 `{ data: { executionId, message } }` 로 정정하고, TransformInterceptor `data:` 래퍼가 전역 인터셉터에 의한 것임을 주석으로 명시 (draft #7 결정 반영).

---

### [CRITICAL] `2-api-convention §7` Rate Limit 표 — Webhook 1000 req/min 기술이 코드 (100/min) 와 충돌

- **target 위치**: 결정 테이블 #5 — "§7 표(1000→100) + §11.7 + 12-webhook WH-SC-05 정합"
- **충돌 대상**:
  - `spec/5-system/2-api-convention.md §7` 표: `Webhook 수신 | 1000 req/min (워크스페이스 기준)`
  - `spec/5-system/2-api-convention.md §11.7`: "Webhook 수신은 워크스페이스 기준 **1000 req/min** 제한 (§7 참조)"
  - `spec/5-system/12-webhook.md §6` 본문: "Rate Limiting 적용: 트리거당 60req/min"
  - `spec/5-system/12-webhook.md §8` 보안 표: "Throttler 적용 (60req/min/trigger)"
  - `app.module.ts` (코드 ground truth): named throttler `webhook`: limit 100, ttl 60000 → **100 req/min**
- **상세**: 세 문서가 세 가지 다른 값을 쓰고 있다: `2-api-convention` 은 1000/min, `12-webhook` 은 60/min, 코드는 100/min. `12-webhook §6` 과 §8 도 서로 같은 값(60)이지만 코드(100)와 다르다. rate-limit 단위도 혼재: `2-api-convention` 은 "워크스페이스 기준", `12-webhook` 은 "트리거당". 코드 (`ThrottlerModule` named throttler `webhook`) 는 request-level throttle 이므로 "트리거당" 에 가까우나 spec 에서 단위가 명확하지 않다. 이 중 `2-api-convention §7` 의 1000/min 은 코드(100)와 10배 차이가 나므로 CRITICAL 수준이다.
- **제안**: 코드 ground truth 100 req/min 으로 통일. `2-api-convention §7` 표, `§11.7`, `12-webhook §6`·`§8` 모두 `100 req/min` 으로 정합. 단위는 draft 결정 #5 에서 사용자 확인이 보류된 항목이므로, **본 검토에서도 60(권장 목표) vs 100(코드 현행) 선택을 사용자에게 재확인한 후 적용 권장**.

---

### [WARNING] `2-api-convention §11.5` HMAC 헤더 고정 표기 (`X-Webhook-Signature`) — `12-webhook` AuthConfig 위임과 불일치

- **target 위치**: 결정 테이블 #6 — "`2-api-convention §11.5` 의 `X-Webhook-Signature` 고정 표기 제거 → 12-webhook §4.2/WH-SC-02 위임"
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.5` 인증 방식 표
  ```
  | HMAC Signature | X-Webhook-Signature 헤더. HMAC-SHA256(secret, body) 검증 |
  ```
- **상세**: `12-webhook §4.2` 는 HMAC 헤더가 `config.header` (default `X-Hub-Signature-256`) 이라고 정의한다 (`1-data-model.md §2.17.1` AuthConfig `hmac` config 스키마도 동일: `header: string = "X-Hub-Signature-256"`). `2-api-convention §11.5` 가 `X-Webhook-Signature` 로 하드코딩하는 것은 `12-webhook` 과 데이터 모델 양쪽 정의 모두와 어긋난다. 또한 `§11.5` 는 API Key 인증을 `X-API-Key` 헤더 또는 `?api_key=` 쿼리 파라미터 라고 기술하는데, `12-webhook §4.4` 와 `1-data-model.md §2.17.1` 은 헤더 전용 (`config.headerName`, default `X-API-Key`) 이라고 정의해 쿼리 파라미터 옵션이 없다.
- **제안**: `§11.5` 의 HMAC 행을 `12-webhook §4.2` 로 위임 ("헤더명은 AuthConfig.config.header — 상세는 12-webhook §4.2 참조"), API Key 행에서 `?api_key=` 쿼리 옵션 제거 (draft #9 반영).

---

### [WARNING] `2-api-convention §11.3` text/plain 지원 기술 — `12-webhook §3.1` 및 코드와 불일치

- **target 위치**: 결정 테이블 #11 — "§11.3 text/plain 행 제거"
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.3` 처리 플로우 step 4
  ```
  - Content-Type: text/plain → 텍스트로 저장
  ```
- **상세**: `12-webhook §3.1` Content-Type 은 `application/json`, `application/x-www-form-urlencoded` 만 정의한다. 코드 (`hooks.service.ts`) 도 parameter schema 기반 body 파싱만 수행하며 text/plain 분기가 없다. `§11.3` 의 text/plain 지원 기술은 `12-webhook` 과 코드 양쪽과 모순이다.
- **제안**: `§11.3` step 4 의 `text/plain → 텍스트로 저장` 행 삭제, "기타 → 400 Bad Request" 로 처리 (draft #11 반영).

---

### [WARNING] `2-api-convention §11.6` 워크플로우 입력 데이터에 `path` 필드 포함 — `12-webhook §5` 와 불일치

- **target 위치**: 결정 테이블 #10 — "§11.6 의 `path` 필드 제거 → 12-webhook §5 위임"
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.6` 입력 데이터 구조
  ```json
  {
    "path": "/hooks/order-created",
    "triggeredAt": "2026-03-29T14:00:00Z"
  }
  ```
- **상세**: `12-webhook §5` 워크플로우 입력 데이터 구조에는 `path` 필드가 없다 (parameters / body / headers / query / method 5개만). 코드 (`hooks.service.ts`) 도 `path` 를 전달하지 않는다. 또한 `§11.6` 의 `triggeredAt` 도 `12-webhook §5` 에 없어 동일 문제다.
- **제안**: `§11.6` 에서 `path` 와 `triggeredAt` 를 제거하고 `12-webhook §5` 로 위임 (draft #10 반영).

---

### [WARNING] `2-trigger-list.md §2.4` 및 `data-flow/10-triggers.md` Overview URL 이 `{base_url}/hooks/` (no `/api`) — 정정 필요

- **target 위치**: 결정 테이블 #2, #3
- **충돌 대상**:
  - `spec/2-navigation/2-trigger-list.md §2.4`: `{base_url}/hooks/{endpoint_path}` (no `/api`)
  - `spec/data-flow/10-triggers.md` Overview 코드 진입점: "`/api/webhooks/:path` 진입"
- **상세**: `2-trigger-list.md §2.4` 는 `/api` 없는 URL 을 정의하며, draft 결정 #2 의 갱신 대상에 포함 (`spec/2-navigation/2-trigger-list.md — #2 §2.4 /api/hooks/`). `data-flow/10-triggers.md` 의 Overview 코드 진입점 라인은 `/api/webhooks/:path` 로 (a) `/api/hooks/` 가 아니라 `/api/webhooks/` 라는 구 명칭 오류, (b) 모듈 경로도 `hooks.controller.ts` 가 아닌 다른 것처럼 기술되어 세 가지 오류가 중첩된다 (경로·컨트롤러명·URL). draft 결정 #4 갱신 범위에 포함되어 있다.
- **제안**: draft 갱신 파일 목록 #4 에 따라 함께 정정 (이미 반영됨). 단, `2-trigger-list.md §2.4` 가 draft #4 목록에서 `data-flow/10-triggers.md + 0-overview.md` 만 언급하고 `2-trigger-list.md` 를 별도 항목으로 지정하지 않아 누락될 위험이 있으므로 명시적으로 포함 확인 필요.

---

### [WARNING] `2-api-convention §11.4` 비동기 응답 shape 에 `data:` 래퍼 — `12-webhook §3.1` flat 표기와 불일치 (draft #7)

- **target 위치**: 결정 테이블 #7 — "12-webhook §3.1 의 flat `{executionId,message}` 에 래퍼 주석 추가, §11.4 도 정정"
- **충돌 대상**: `spec/5-system/2-api-convention.md §11.4` 비동기 응답과 `spec/5-system/12-webhook.md §3.1` 성공 응답
  - `§11.4` 비동기 응답: `{ "data": { "executionId": "...", "status": "pending", "triggeredAt": "..." } }` — `data:` 래퍼 있음
  - `12-webhook §3.1` 성공 응답: `{ "executionId": "uuid", "message": "..." }` — flat (래퍼 없음)
- **상세**: 코드상 `TransformInterceptor` 가 모든 응답을 `{ data: ... }` 로 래핑하므로 wire 응답은 `{ data: { executionId, message } }` 가 정본이다. `2-api-convention §11.4` 의 `data:` 래퍼는 형식상 맞지만 필드 (`status: "pending"`, `triggeredAt`) 는 틀리다. `12-webhook §3.1` 의 flat 표기는 래퍼가 없어 wire 응답과 다르다. 두 문서가 같은 응답을 다르게 기술하고 있다.
- **제안**: `12-webhook §3.1` 에 "전역 TransformInterceptor 가 `{ data: ... }` 로 래핑" 주석 추가 (draft #7). `2-api-convention §11.4` 비동기 응답 필드를 `{ data: { executionId, message } }` 로 정정하고 `status: "pending"`, `triggeredAt` 제거.

---

### [INFO] `0-overview.md §6.1` 구현 완료 항목 — Webhook 수신 언급이 미미하며 URL 명세 없음

- **target 위치**: 결정 테이블 #3 갱신 대상 중 `0-overview.md`
- **충돌 대상**: `spec/0-overview.md §6.1` 구현 완료 표 — Webhook 수신 행: "Webhook 수신, 실행 이력"
- **상세**: `0-overview.md §6.1` 의 시스템 열에서 Webhook 수신을 한 줄로 언급하지만 URL 이나 경로를 기술하지는 않는다. 따라서 `/api/webhooks/:path` 구 명칭 오류는 해당 파일에 없다. draft 결정 #3 이 `0-overview.md` 를 갱신 대상에 포함하나, 실제로 `0-overview.md` 에서 수정이 필요한 webhook URL 문자열은 보이지 않는다. 갱신 범위를 재확인하는 것이 좋다.
- **제안**: `0-overview.md` 에서 webhook 관련 변경이 실제로 필요한지 재검토. 필요 없다면 갱신 파일 목록 #4 에서 `0-overview.md` 를 제외하거나, 범위를 명확히 주석으로 기록.

---

### [INFO] `data-flow/10-triggers.md` Rationale "endpoint_path UNIQUE 범위" — `workspaceSlug` 언급 및 `12-webhook.md` cross-link 가 잘못됨

- **target 위치**: 결정 테이블 #12
- **충돌 대상**: `spec/data-flow/10-triggers.md` Rationale
  ```
  공개 URL 은 `/api/webhooks/:workspaceSlug/:path` 형태로 라우팅되어 충돌이 없다 (`spec/5-system/12-webhook.md`).
  ```
- **상세**: `12-webhook.md` 에는 `workspaceSlug` 세그먼트가 정의되지 않는다. Rationale 이 존재하지 않는 spec 내용을 cross-link 하고 있다. UNIQUE 범위 `(workspace_id, endpoint_path)` 가 유지되면서도 코드에서 `findOne({endpointPath, type:'webhook'})` 가 workspace 필터 없이 조회한다는 점 (endpoint_path 가 UUID 자동생성으로 사실상 전역 고유) 도 Rationale 과 충돌 가능성이 있다.
- **제안**: Rationale 에서 `workspaceSlug` 세그먼트 언급 제거, `/api/hooks/:endpointPath` 단일 경로로 정정. UNIQUE 범위와 조회 로직의 관계를 명확히 서술.

---

### [INFO] `12-webhook.md §6` 및 §8 rate limit 값이 내부에서도 불일치 (60 req/min 두 곳)

- **target 위치**: 결정 테이블 #5
- **충돌 대상**: `spec/5-system/12-webhook.md §6` ("Rate Limiting 적용: 트리거당 60req/min") 과 `§8` 보안 표 ("Throttler 적용 (60req/min/trigger)")
- **상세**: `12-webhook.md` 내에서는 두 곳 모두 60 이어서 내부 일관성은 유지되나, 코드 ground truth (100) 및 draft 결정 (#5, 100으로 채택) 과 모두 다르다. draft 가 100 으로 통일하기로 결정했으므로 `12-webhook §6` 과 `§8` 도 100 으로 변경해야 한다. WH-SC-05 ("분당 최대") 도 100 으로 구체화 필요.
- **제안**: draft #5 결정에 따라 `12-webhook §6`, `§8`, `WH-SC-05` 를 100 req/min 으로 일괄 변경. 단, 사용자 확인 보류 항목이므로 최종 확정 후 적용.

---

## 요약

target draft (`spec-draft-webhook-consistency.md`) 는 webhook 도메인의 ground truth (`hooks.controller.ts`) 를 기준으로 4개 spec 파일의 충돌 10건 이상을 정합하는 결정 테이블을 제시하고 있으며, 정정 방향 자체는 전반적으로 올바르다. Cross-Spec 관점에서 CRITICAL 발견은 5건이다: (1) `2-api-convention §11.1` URL `/api` prefix + note 상충, (2) `data-flow/10-triggers.md` 전 영역 `/api/webhooks/:workspaceSlug/:path` 오기, (3) `2-api-convention §11.2` GET·PUT 지원 기술, (4) `§11.4` 동기 모드 잔존 및 응답 shape 불일치, (5) `§7`/`§11.7` rate limit 1000/min 대 코드 100/min 10배 오차. 이 5건은 draft 결정 테이블이 모두 인지하고 있으며, 적용 시 해소된다. WARNING 건은 `§11.5` HMAC 헤더 고정 표기, `§11.3` text/plain, `§11.6` path 필드, rate-limit 단위·값 혼재, 응답 shape 래퍼 불일치 등으로 draft 결정에 포함되어 있다. 주요 리스크는 draft 가 "4파일 Edit → 안정 세션에서 적용" 을 의도적으로 보류한 상태이므로, 실제 편집 시 draft 결정 테이블 외의 인접 섹션(`§11.3`, `§11.3 처리 플로우 step 4`, `data-flow §1.2 시퀀스 다이어그램`, `data-flow Rationale` 등) 을 함께 정정해야 하며, `2-trigger-list.md §2.4` 가 갱신 파일 목록 #4 에서 명시적으로 누락될 수 있으므로 주의가 필요하다. rate limit 60 vs 100 은 사용자 확인 후 적용이 선행 조건이다.

---

## 위험도

**HIGH**

> CRITICAL 발견 5건이 모두 현재 배포된 코드의 동작과 spec 기술 사이의 직접 모순이다. 그러나 draft 자체가 이 모순들을 인지하고 명시적 결정 테이블을 수립했으므로, draft 를 그대로 적용하면 각 CRITICAL 이 해소되는 구조다. 위험도가 CRITICAL 이 아닌 HIGH 인 이유는 draft 적용 이전(현재 상태)의 spec 위험도가 HIGH 이며, draft 적용 후에는 LOW 이하로 수렴할 것으로 예상되기 때문이다.

---

STATUS: OK
