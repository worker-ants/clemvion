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

## 코드 ground truth (실제 read 검증 완료)

`hooks.controller.ts`:
- 경로: `@Controller('hooks')` + global prefix `api` → **`/api/hooks/:endpointPath`** (정본). 주석 명시: `/api/webhooks/:path` 는 **과거 명칭, alias 라우트 아님**.
- 메서드: **POST + GET** (PUT 핸들러 없음). 둘 다 `@HttpCode(202)`.
- Throttle: **100 req/min, IP+endpointPath 조합** (주석: "트리거 단위가 아니라 IP+endpointPath 조합으로 분당 100회"). workspace(1000)·trigger(60) 아님.
- `?wait=true` 동기 모드 **미구현** (Query wait 파라미터 없음).

`hooks.service.ts`:
- 응답 `WebhookResult = { executionId, message, status?, interaction? }` — flat, **`data:` 래퍼 없음**. 12-webhook §3.1 과 일치.

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
| 5 | rate limit | 100/min (IP+endpointPath) | 12-webhook §3.3 WH-SC-05(권장), 2-api-convention §7·§11.7(1000/ws) | **100 req/min (IP+endpointPath 기준)** 으로 통일. §7 표 + §11.7 + 12-webhook WH-SC-05 정합 |
| 6 | HMAC 헤더 | AuthConfig.config.header (기본 X-Hub-Signature-256) | 2-api-convention §11.5 | 12-webhook §4.2/WH-SC-02 로 위임 (X-Webhook-Signature 고정 표기 제거) |
| 7 | 응답 shape | `{executionId, message, status?, interaction?}` | 2-api-convention §11.4 | 12-webhook §3.1 로 정합 (`data:{...,status,triggeredAt}` 래퍼 제거) |
| 8 | HTTP 메서드 | POST + GET | 12-webhook WH-EP-03, 2-api-convention §11.2 | **POST + GET** 으로 통일 (PUT 제거). 12-webhook WH-EP-03 에 GET 추가, §11.2 에서 PUT 행 삭제 |
| 9 | API Key 쿼리 | 헤더만 | 2-api-convention §11.5 | `?api_key=` 쿼리 옵션 제거 (12-webhook §4.4 헤더 전용으로 위임) |
| 10 | path 입력 필드 | §5 에 없음 | 2-api-convention §11.6 | §11.6 의 `path` 필드 제거 (12-webhook §5 로 위임) |
| 11 | Content-Type text/plain | json+form 만 | 2-api-convention §11.3 | text/plain 행 제거 (12-webhook WH-EP-04 로 위임) |
| 12 | workspaceSlug 라우팅 | 코드에 없음 (endpointPath 가 라우팅 키) | data-flow 10-triggers L180 Rationale | 모호성 해소: endpoint_path 자체가 라우팅 식별자 (UNIQUE 는 (workspace_id, endpoint_path) 이나 실제 라우트는 endpoint_path 단독 — UUID 자동생성으로 충돌 무시 가능). workspaceSlug 세그먼트 표기 제거 |

> 비고: `2-api-convention §11` 은 일반 API 규약 문서의 일부이므로, webhook 상세를 중복 기술하기보다 **핵심(URL·메서드·rate-limit)만 남기고 상세는 `12-webhook.md` 로 위임**하는 방향으로 슬림화 권장 (단일 진실 원칙).

## 갱신 파일

1. `spec/5-system/12-webhook.md` — #1 WH-EP-02 base 규약, #8 GET 메서드(WH-EP-03), #5 rate limit 100(WH-SC-05) 명시.
2. `spec/2-navigation/2-trigger-list.md` — #2 §2.4 `/api/hooks/`.
3. `spec/5-system/2-api-convention.md` §11 — #2 URL, #8 메서드(PUT 제거), #4 동기모드 제거, #7 응답shape, #6 HMAC, #9 API Key 쿼리, #10 path, #11 text/plain, #5 rate limit. §7 rate 표도 #5 반영.
4. `spec/data-flow/10-triggers.md` + `0-overview.md` — #3 `/api/hooks/`, #12 workspaceSlug 제거.

## Rationale 기록 사항 (각 spec ## Rationale)

"코드(`hooks.controller.ts`/`hooks.service.ts`) = 정본. `?wait` 동기모드·PUT·`X-Webhook-Signature` 고정헤더·`?api_key=` 쿼리·`data:` 래퍼·text/plain·1000/min(ws)·60/min·workspaceSlug 는 미배포/구설계로 제거 또는 12-webhook 위임. 2026-05-29 webhook-url-env 후속 정합화 (consistency cross_spec 10건)."

## 진행 메모

- 1차 draft 의 2개 오류를 코드 ground truth read 로 정정: (a) `/api/webhooks/` 는 alias 아닌 과거 명칭 (b) rate limit 은 workspace/1000 이 아니라 IP+endpointPath/100.
- **미수행(안정 세션 필요)**: spec/ 본문 반영 + 의무 `/consistency-check --spec` (BLOCK 게이트). 본 세션은 Bash classifier 일시 불가 + Read 일부 truncation 으로 SoT 4파일 정밀 편집·consistency 게이트 실행 불가. 본 draft 가 적용 명세서.
