---
worktree: webhook-url-env-5de041
started: 2026-05-29
owner: project-planner
status: draft
source: webhook-url-env P0 / review/consistency/2026/05/29/08_12_53/cross_spec.md
---

# spec-draft: webhook spec 정합화 (webhook-url-env 후속 P0)

## 목적

webhook 도메인 spec 간 불일치(consistency cross_spec CRITICAL/WARNING 10건)를 정합화한다.
**정본 우선순위**: 배포된 코드(`hooks.controller.ts` / `hooks.service.ts`) = ground truth
→ `spec/5-system/12-webhook.md` = webhook 도메인 SoT → 타 spec 은 12-webhook 으로 정합 또는 위임.

## 코드 ground truth (실제 read 검증 완료 — 2차 정정)

`hooks.controller.ts`:
- 경로: `@Controller('hooks')` + global prefix `api` → **`/api/hooks/:endpointPath`** (정본). `/api/webhooks/:path` 라우트는 **코드에 존재하지 않음** (과거 명칭일 뿐, alias 도 없음).
- 메서드: **POST 전용** (`@Post(':endpointPath')` 1개, `@Get` 0개, PUT 없음). `@HttpCode(202)`.
- 응답: handler 는 `{ executionId, message, status?, interaction? }` 반환하나, **global `TransformInterceptor` 가 모든 응답을 `{ data: ... }` 로 래핑** → wire 응답 = `{ data: { executionId, message, ... } }`. (단 Slack `{challenge}` / Discord `{type:1}` handshake 는 `res.json` 직접 전송으로 래핑 우회 + 200.)
- `?wait=true` 동기 모드 **미구현** (Query 에 wait 없음).

`app.module.ts` ThrottlerModule:
- named throttler **`webhook`: limit 100 / ttl 60000** → webhook 수신 **100 req/min** (60·1000 아님).

`hooks.service.ts`:
- `handleWebhook` 반환 타입: `{ executionId, status?: 'pending', interaction?: {...} }`. controller 가 `message` 추가. content-type 분기·text/plain 처리 **없음** (parameter schema 기반 body 파싱만).

> **1차 draft 정정**: (a) GET 미지원 (POST 전용) (b) 응답은 flat 아님 — TransformInterceptor 로 `{data:...}` 래핑되므로 **api-convention §11.4 의 `data:` 래퍼가 오히려 정확**, 12-webhook §3.1 의 flat 표기에 래퍼 주석 필요 (c) `/api/webhooks` alias 없음 (d) rate limit 100/min (named 'webhook' throttler).

`12-webhook.md` (SoT) 본문:
- §3.1: `/api/hooks/:endpointPath`, Content-Type **json + x-www-form-urlencoded** (text/plain 없음), 응답 `{executionId, message}`(+interaction), 202.
- §4.2 HMAC: `config.header` 기본 `X-Hub-Signature-256`. §4.4 API Key: `config.headerName` 기본 `X-API-Key` (**헤더만**, 쿼리 미지원). §5 입력: parameters/body/headers/query/method (**path 없음**).

## 결정 테이블

| # | 항목 | 코드 정본 | 정정 대상 | 결정 |
|---|---|---|---|---|
| 1 | 프론트 base URL | `lib/utils/webhook-url.ts` | 12-webhook WH-EP-02 | base 결정 규약 명문화: NEXT_PUBLIC_WEBHOOK_BASE_URL → NEXT_PUBLIC_API_URL(`/api` 제거) → window.location.origin |
| 2 | URL `/api` prefix | `/api/hooks/` | 2-trigger-list §2.4, 2-api-convention §11.1 | `{base_url}/hooks/` → `{base_url}/api/hooks/`. §11.1 의 "`/hooks/*` 는 `/api/*` 와 분리" note 삭제 (사실과 반대) |
| 3 | `/api/webhooks/` 표기 | 과거 명칭, alias 없음 | data-flow 10-triggers(L14,25,54), 0-overview(L60) | `/api/hooks/:endpointPath` 로 일괄 정정 |
| 4 | 동기 `?wait=true` | 미구현 | 2-api-convention §11.4 | **제거** (구 설계 잔재) — 비동기 202 만 |
| 5 | rate limit | named 'webhook' throttler: **100 req/min** | 12-webhook WH-SC-05(권장 "분당 최대"), 2-api-convention §7·§11.7(1000/ws) | **100 req/min** 으로 통일. §7 표(1000→100) + §11.7 + 12-webhook WH-SC-05 정합. ⚠️ 60(권장 목표) vs 100(현재 코드) 은 제품 결정 — 코드 현행 100 채택, 다른 값 원하면 사용자 확인 |
| 6 | HMAC 헤더 | AuthConfig.config.header (기본 X-Hub-Signature-256) | 2-api-convention §11.5 | 12-webhook §4.2/WH-SC-02 로 위임 (X-Webhook-Signature 고정 표기 제거) |
| 7 | 응답 shape | wire = `{ data: { executionId, message, status?, interaction? } }` (TransformInterceptor) | 12-webhook §3.1 vs 2-api-convention §11.4 | **`data:` 래퍼 유지가 정본** (전역 인터셉터). 12-webhook §3.1 의 flat `{executionId,message}` 에 "전역 TransformInterceptor 가 `{data:...}` 로 래핑" 주석 추가. §11.4 의 `status:"pending"`·`triggeredAt` 는 실제 필드와 다르므로 `{ data: { executionId, message } }` 기준으로 정정 |
| 8 | HTTP 메서드 | **POST 전용** | 12-webhook WH-EP-03, 2-api-convention §11.2 | **POST 전용** 으로 통일. §11.2 에서 GET·PUT 행 삭제. (WH-EP-03 은 이미 POST — 유지) |
| 9 | API Key 쿼리 | 헤더만 (`config.headerName`) | 2-api-convention §11.5 | `?api_key=` 쿼리 옵션 제거 (12-webhook §4.4 헤더 전용으로 위임) |
| 10 | path 입력 필드 | §5 에 없음 (parameters/body/headers/query/method) | 2-api-convention §11.6 | §11.6 의 `path` 필드 제거 (12-webhook §5 로 위임) |
| 11 | Content-Type text/plain | json+form (parameter 추출), text/plain 처리 없음 | 2-api-convention §11.3 | text/plain 행 제거 (12-webhook §3.1 Content-Type 으로 위임) |
| 12 | workspaceSlug 라우팅 | 코드에 없음 — `endpointPath` 단독이 라우팅 키 (`findOne({endpointPath, type:'webhook'})`, workspace 필터 없음) | data-flow 10-triggers L180 Rationale | 모호성 해소: 라우트는 endpoint_path 단독. UNIQUE 제약은 `(workspace_id, endpoint_path)` 이나 endpoint_path 는 UUID 자동생성으로 사실상 전역 고유 → workspaceSlug 세그먼트 표기 제거 |

> 비고: `2-api-convention §11` 은 일반 API 규약 문서의 일부이므로, webhook 상세를 중복 기술하기보다 **핵심(URL·메서드·rate-limit)만 남기고 상세는 `12-webhook.md` 로 위임**하는 방향으로 슬림화 권장 (단일 진실 원칙).

## 갱신 파일

1. `spec/5-system/12-webhook.md` — #1 WH-EP-02 base 규약, #8 GET 메서드(WH-EP-03), #5 rate limit 100(WH-SC-05) 명시.
2. `spec/2-navigation/2-trigger-list.md` — #2 §2.4 `/api/hooks/`.
3. `spec/5-system/2-api-convention.md` §11 — #2 URL, #8 메서드(PUT 제거), #4 동기모드 제거, #7 응답shape, #6 HMAC, #9 API Key 쿼리, #10 path, #11 text/plain, #5 rate limit. §7 rate 표도 #5 반영.
4. `spec/data-flow/10-triggers.md` + `0-overview.md` — #3 `/api/hooks/`, #12 workspaceSlug 제거.

## Rationale 기록 사항 (각 spec ## Rationale)

"코드(`hooks.controller.ts`/`hooks.service.ts`) = 정본. `?wait` 동기모드·PUT·`X-Webhook-Signature` 고정헤더·`?api_key=` 쿼리·`data:` 래퍼·text/plain·1000/min(ws)·60/min·workspaceSlug 는 미배포/구설계로 제거 또는 12-webhook 위임. 2026-05-29 webhook-url-env 후속 정합화 (consistency cross_spec 10건)."

## 진행 메모

- draft 를 코드 ground truth read 로 2회 정정 (각 정정 사유는 위 ground truth 섹션·결정 테이블에 기록).
- **SoT 본문 미반영 — 의도적 보류**. 이유:
  1. 본 세션 도구 출력 채널이 간헐적으로 파일 내용을 interleave/truncate (app.module.ts read 가 spec markdown 과 섞여 반환되는 등) → SoT(제품 단일 진실) 4파일 정밀 편집 시 오염 위험.
  2. `spec/` 쓰기는 프로젝트 규약상 의무 `/consistency-check --spec` BLOCK 게이트 필요 — 5 checker sub-agent 안정 호출 필요.
  3. 더 읽을수록 가정이 뒤집힘(GET 미지원·응답 data 래핑) → 안정 세션에서 본 검증된 결정 테이블 기준으로 적용하는 것이 안전.
- **적용 절차(안정 세션)**: 본 draft 결정 테이블대로 4파일 Edit → `/consistency-check --spec plan/in-progress/spec-draft-webhook-consistency.md` → BLOCK:NO 시 commit + plan P0 체크.
- **사용자 확인 필요 1건**: rate limit 60(12-webhook 권장 목표) vs 100(코드 현행) — 코드 현행 100 채택 제안.
