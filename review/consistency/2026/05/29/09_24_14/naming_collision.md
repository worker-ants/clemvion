# 신규 식별자 충돌 검토 — spec-draft-webhook-consistency

> 검토 대상: `plan/in-progress/spec-draft-webhook-consistency.md`
> 검토 모드: spec draft (--spec)
> 검토 일시: 2026-05-29

---

## 발견사항

### 1. **[CRITICAL]** `NEXT_PUBLIC_WEBHOOK_BASE_URL` — 기존 ENV var 체계와 충돌

- **target 신규 식별자**: `NEXT_PUBLIC_WEBHOOK_BASE_URL` (결정 #1 — WH-EP-02 base URL 규약)
- **기존 사용처**:
  - `codebase/frontend/.env.example:27` — `NEXT_PUBLIC_API_URL="http://localhost:3011/api"` 가 이미 프론트엔드 API base 로 사용 중
  - `codebase/frontend/src/lib/api/client.ts:4` — `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL`
  - `codebase/frontend/src/app/(main)/triggers/page.tsx:363-368` 및 `src/components/triggers/trigger-detail-drawer.tsx:167-172` — 실제 코드는 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 을 **전혀 참조하지 않으며** `window.location.origin` 직접 사용 (`window.location.origin.replace(/:\d+$/, ":3011")` 패턴)
- **상세**: target 문서는 `NEXT_PUBLIC_WEBHOOK_BASE_URL → NEXT_PUBLIC_API_URL(/api 제거) → window.location.origin` 우선순위 규약을 WH-EP-02 에 명문화하자고 제안하지만, 코드에는 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 이 존재하지 않는다. `NEXT_PUBLIC_API_URL` 은 이미 `/api` 를 포함한 API base (`http://localhost:3011/api`) 로 정의되어 있어 webhook URL 구성 시 재사용하려면 `/api` 제거 로직이 추가로 필요하다. 새 ENV var 이름이 기존 체계(`NEXT_PUBLIC_API_URL`)와 목적이 겹치며 혼동을 야기할 수 있다.
- **제안**: `NEXT_PUBLIC_WEBHOOK_BASE_URL` 신규 도입 대신, 코드 실제 동작(window.location.origin 기반)을 WH-EP-02 의 정본으로 명문화하고, ENV var 우선순위 테이블을 문서에만 제한한다. 또는 `NEXT_PUBLIC_API_URL` 에서 `/api` suffix 를 제거해 webhook base 계산에 재사용하는 헬퍼를 스펙에 기술하되 별도 ENV var 이름은 부여하지 않는 방안을 검토한다.

---

### 2. **[CRITICAL]** `{base_url}/hooks/{endpoint_path}` vs `{base_url}/api/hooks/` — URL 경로 식별자 충돌

- **target 신규 식별자**: 모든 spec 에서 URL 을 `{base_url}/api/hooks/:endpointPath` 로 통일 (결정 #2, #3)
- **기존 사용처**:
  - `spec/5-system/2-api-convention.md:253` — `POST {base_url}/hooks/{endpoint_path}` (`/api` 없음)
  - `spec/5-system/2-api-convention.md:260` — `> **참고**: \`/hooks/*\` 경로는 \`/api/*\` 경로와 분리된다. API Gateway에서 별도 라우팅.` (명시적으로 분리 선언)
  - `spec/data-flow/10-triggers.md:14` — `POST /api/webhooks/:path` (경로 자체도 다름 — `/webhooks/` 표기)
  - `spec/data-flow/10-triggers.md:25` — 코드 진입점 주석 `codebase/backend/src/modules/hooks/hooks.controller.ts — /api/webhooks/:path 진입`
- **상세**: 기존 spec 에 `/hooks/*` 는 `/api/*` 와 분리된다는 note 가 명시되어 있고, data-flow 는 `/api/webhooks/:path` 라는 또 다른 경로를 사용 중이다. target 은 이 세 가지 표기를 `/api/hooks/:endpointPath` 로 통일하려 하지만, 기존 문서들이 서로 다른 경로(hooks vs webhooks, /api 포함 vs 미포함)를 "사실"로 기술하고 있어 충돌 범위가 넓다. 2-api-convention §11.1 의 "분리" note 는 삭제 대상이지만 그 note 를 참조하는 인프라/라우팅 판단이 존재할 수 있다.
- **제안**: target 결정 #2, #3 방향은 코드 정본(hooks.controller.ts)과 일치하므로 타당하다. 단, 2-api-convention §11.1 의 `/hooks/*` 와 `/api/*` 분리 note 삭제 시 이를 근거로 한 별도 라우팅 설정(nginx proxy_pass, API Gateway 규칙 등)에 주석 또는 연계 변경이 필요한지 확인 후 반영 권장.

---

### 3. **[CRITICAL]** `X-Webhook-Signature` vs `X-Hub-Signature-256` — HMAC 헤더 이름 충돌

- **target 신규 식별자**: HMAC 헤더 표기를 `X-Hub-Signature-256` (AuthConfig.config.header 기본값) 으로 위임하고 `X-Webhook-Signature` 고정 표기 제거 (결정 #6)
- **기존 사용처**:
  - `spec/5-system/2-api-convention.md:331` — `| HMAC Signature | \`X-Webhook-Signature\` 헤더. \`HMAC-SHA256(secret, body)\` 검증 |` 으로 고정 표기
  - `spec/5-system/12-webhook.md:60,213` — `config.header` (default `X-Hub-Signature-256`) 으로 정의 (12-webhook 은 이미 올바른 상태)
  - `spec/1-data-model.md:541` — `"X-Hub-Signature-256"` 을 기본값으로 정의
  - `spec/2-navigation/6-config.md:74` — `Header | 서명을 담는 헤더명 (default \`X-Hub-Signature-256\`)` 으로 정의
- **상세**: `X-Webhook-Signature` (api-convention §11.5) 와 `X-Hub-Signature-256` (12-webhook, 1-data-model, 6-config) 는 동일 개념에 다른 이름을 부여하고 있다. 이미 충돌 상태이며 target 이 api-convention §11.5 의 표기를 12-webhook 으로 위임해 삭제하면 충돌이 해소된다. 그러나 api-convention §11.5 에서 삭제된 후에도 다른 spec 문서가 `X-Webhook-Signature` 를 남기고 있으면 잔류 충돌이 된다.
- **제안**: target 의 결정 #6 적용 후 전체 spec/ 에서 `X-Webhook-Signature` 잔존 여부를 grep 확인하고 남은 항목은 모두 제거 또는 위임 처리할 것.

---

### 4. **[WARNING]** `status: "pending"` / `triggeredAt` 응답 필드 — 제거 대상 식별자의 충돌

- **target 신규 식별자**: 응답 shape 에서 `status: "pending"` 과 `triggeredAt` 필드를 제거하고 `{ data: { executionId, message } }` 기준으로 정정 (결정 #7)
- **기존 사용처**:
  - `spec/5-system/2-api-convention.md:302-308` — 비동기 응답 예시에 `"status": "pending"`, `"triggeredAt": "2026-03-29T14:00:00Z"` 포함
  - `spec/5-system/2-api-convention.md:342-347` — 동기 응답 예시에도 `"triggeredAt"` 포함
  - `spec/5-system/12-webhook.md:185` — `interaction.enabled=true` + `per_execution` 시 `status: "pending"` 을 동봉한다고 이미 기술 (EIA 연계)
- **상세**: `status: "pending"` 은 두 가지 의미로 쓰이고 있다. (a) api-convention §11.4 의 비동기 응답 필드 (`data.status = "pending"`) — target 이 제거 대상으로 지정. (b) 12-webhook §3.1 의 EIA `interaction.enabled=true` 시 동봉되는 필드 — 이는 서로 다른 의미(실행 상태 vs. interaction token 포함 응답 표시)다. target 이 (a) 를 제거할 때 (b) 가 영향받지 않는지 명시 필요. 현재 target 은 이 구분 없이 `status: "pending"` 제거를 선언하고 있어 혼선이 있다.
- **제안**: target 결정 #7 에서 "제거 대상은 api-convention §11.4 의 `data.status = 'pending'` / `triggeredAt` 이며, 12-webhook §3.1 + EIA §4.1 의 `interaction.token` 동봉 시 `status: 'pending'` 은 별도 문맥으로 유지" 라는 범위 한정 문구를 추가할 것.

---

### 5. **[WARNING]** `?wait=true` 동기 모드 — 제거 대상 식별자의 외부 참조 잔류

- **target 신규 식별자**: `?wait=true` 쿼리 파라미터를 제거 (결정 #4)
- **기존 사용처**:
  - `spec/5-system/2-api-convention.md:298` — `| **동기** | 워크플로우 실행 완료 후 응답 (쿼리: \`?wait=true\`, 최대 대기 30초) | \`200 OK\` + 워크플로우 최종 출력 데이터 |`
  - `spec/5-system/2-api-convention.md:311-319` — `EXECUTION_TIMEOUT` 동기 응답 예시
- **상세**: target 은 api-convention §11.4 에서 `?wait=true` 행을 삭제하겠다고 하지만, 삭제 후 동기 응답 형식(`200 OK` + 최종 출력, `EXECUTION_TIMEOUT` 에러 코드) 예시도 함께 제거되어야 한다. `EXECUTION_TIMEOUT` 에러 코드가 spec/conventions/error-handling 에 독립 정의되어 있다면 그쪽은 대상이 아니지만, api-convention 의 인라인 예시는 완전 제거가 필요하다.
- **제안**: target 갱신 범위(파일 목록 #3)에 §11.4 의 동기 응답 예시 블록(`311-319`)도 명시적 삭제 대상으로 추가할 것.

---

### 6. **[WARNING]** `{base_url}/api/hooks/:endpointPath` vs `window.location.origin` — 코드-spec 간 base URL 도출 방식 불일치

- **target 신규 식별자**: WH-EP-02 base URL 규약으로 `NEXT_PUBLIC_WEBHOOK_BASE_URL → NEXT_PUBLIC_API_URL(/api 제거) → window.location.origin` 우선순위 명문화 (결정 #1)
- **기존 사용처**:
  - `codebase/frontend/src/app/(main)/triggers/page.tsx:363-368` — `window.location.origin.replace(/:\d+$/, ":3011")` 하드코딩 (포트 3011 고정)
  - `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx:167-172` — 동일 패턴
- **상세**: 코드에서 webhook base URL 은 `window.location.origin` 에서 포트만 3011 로 교체하는 dev 전용 패치가 적용된 형태다. target 이 제안하는 ENV var 우선순위 규약이 코드에 구현되지 않은 상태이며, `NEXT_PUBLIC_API_URL` 에서 `/api` 를 제거하는 로직도 코드에 없다. spec 에 명문화된 규약이 구현과 즉시 불일치 상태가 된다.
- **제안**: WH-EP-02 명문화 범위를 "spec 정책 선언"으로 한정하고, 실제 구현(`getWebhookUrl` 함수 개선)은 별도 구현 plan 에서 처리함을 target 의 "적용 절차" 섹션에 명시할 것. 또는 현행 코드 동작(`window.location.origin` 기반)을 spec 의 fallback 정본으로 먼저 선언 후 ENV var 지원을 점진적으로 추가하는 방안 검토.

---

### 7. **[WARNING]** `workspaceSlug` 라우팅 표기 제거 — Rationale 참조 무결성

- **target 신규 식별자**: `workspaceSlug` 세그먼트 표기 제거 (결정 #12)
- **기존 사용처**:
  - `spec/data-flow/10-triggers.md:180` — `공개 URL 은 \`/api/webhooks/:workspaceSlug/:path\` 형태로 라우팅되어 충돌이 없다 (\`spec/5-system/12-webhook.md\`)` — Rationale 절에서 workspaceSlug 라우팅을 endpoint_path UNIQUE 범위 정당화 근거로 인용
- **상세**: workspaceSlug 제거 후 해당 Rationale 의 논거가 무너진다. `(workspace_id, endpoint_path)` UNIQUE + `endpoint_path` 는 UUID 자동생성이므로 사실상 전역 유일 — 이 대체 근거가 10-triggers.md Rationale 에 명시되어야 한다. 그렇지 않으면 "왜 workspaceSlug 없이도 충돌이 없는가"를 나중에 읽는 사람이 이해할 수 없다.
- **제안**: target 갱신 파일 목록 #4 (data-flow/10-triggers.md) 에서 Rationale "Webhook `endpoint_path` 의 UNIQUE 범위" 절을 함께 재작성할 것 — workspaceSlug 삭제 + UUID 전역 고유성 근거로 대체.

---

### 8. **[INFO]** `?api_key=` 쿼리 파라미터 — api-convention §11.5 에서 삭제 후 HTTP Request 노드 스펙과 혼동 가능

- **target 신규 식별자**: `?api_key=` 쿼리 옵션 제거 (결정 #9)
- **기존 사용처**:
  - `spec/5-system/2-api-convention.md:328` — `| API Key | \`X-API-Key\` 헤더 또는 \`?api_key=\` 쿼리 파라미터 |`
  - `spec/4-nodes/4-integration/1-http-request.md:89,106` — HTTP Request 노드 자체 인증에서 `api_key + location=query` 패턴을 지원 (별개 도메인)
- **상세**: webhook 수신 엔드포인트에서 `?api_key=` 를 제거하는 것과, HTTP Request 노드 아웃바운드 요청에서 `api_key + location=query` 를 지원하는 것은 별개 도메인이다. target 의 제거는 webhook 수신 측에만 적용되므로 충돌은 아니지만, 두 문서가 동일 파라미터 이름(`api_key`)을 다른 방향(inbound vs outbound)으로 사용하는 점을 명확히 주석 추가 권장.
- **제안**: 갱신된 2-api-convention §11.5 에 "아웃바운드 HTTP Request 노드의 `api_key` 쿼리 추가는 별개 — [4-nodes HTTP Request spec](../4-nodes/4-integration/1-http-request.md) 참조" 주석 추가.

---

### 9. **[INFO]** `path` 입력 필드 — 제거 후 spec 내 `triggeredAt` 과 혼합된 예시 잔류

- **target 신규 식별자**: api-convention §11.6 에서 `path` 필드 제거 (결정 #10)
- **기존 사용처**:
  - `spec/5-system/2-api-convention.md:344` — `"path": "/hooks/order-created"` 가 §11.6 입력 데이터 구조 예시에 포함
  - `spec/5-system/2-api-convention.md:345` — `"triggeredAt": "2026-03-29T14:00:00Z"` 도 동일 예시 블록에 포함 (결정 #7 의 제거 대상)
- **상세**: target 이 `path` 와 `triggeredAt` 을 각각 결정 #10 과 #7 에서 제거하는데, 이 둘이 같은 JSON 예시 블록(`§11.6` 예시)에 있다. 갱신 시 해당 블록을 원자적으로 재작성하지 않으면 한 필드만 제거되고 다른 하나가 남는 중간 상태가 발생할 수 있다.
- **제안**: target 갱신 범위 #3 에 "§11.6 의 JSON 예시 블록 전체 재작성 (path + triggeredAt 동시 제거)" 을 명시할 것.

---

## 요약

target 문서(`spec-draft-webhook-consistency.md`)는 webhook 도메인 spec 정합화를 위해 URL 경로, rate limit, 응답 shape, HMAC 헤더, API Key 쿼리, 동기 모드, workspaceSlug 등 총 12건의 식별자를 정정·제거하는 결정 테이블을 담고 있다. CRITICAL 3건은 기존 spec 에서 다른 의미나 다른 표기로 이미 사용 중인 식별자와의 직접 충돌이다: `NEXT_PUBLIC_WEBHOOK_BASE_URL`은 코드에 존재하지 않는 미구현 ENV var 이름, `/api/hooks/` vs `/hooks/` vs `/api/webhooks/` 경로 3중 충돌, `X-Webhook-Signature` vs `X-Hub-Signature-256` HMAC 헤더 이름 충돌이 해당된다. WARNING 4건은 식별자 제거 시 참조 무결성(Rationale 절, 응답 예시 블록, 동기 모드 오류 코드)이 부분 잔류하는 리스크다. 전반적으로 target 의 결정 방향은 코드 정본과 부합하나, 갱신 범위 명세가 일부 불완전하여 적용 시 누락이 발생할 가능성이 있다.

---

## 위험도

**HIGH**
