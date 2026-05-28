---
worktree: integration-activity-api-label-ed0a6e
started: 2026-05-28
owner: developer
---

# 통합 활동 로그에 API 식별 정보 추가

## 배경

통합 상세 페이지 §4.6 "Recent activity" 탭이 시간·상태·소요·오류만 보여주고 **어떤 API 가 호출됐는지** 표시하지 못한다. 카페24처럼 한 통합이 수십 종의 endpoint 를 호출하는 서비스에서 실패 행을 보고도 어느 API 가 문제인지 식별 불가.

사용자 합의 (2-round 대화, 2026-05-28):
- 표시: 라벨 + endpoint subtext (2줄)
- 저장: `api_label` / `api_method` / `api_path` 3컬럼
- 범위: cafe24 + http-request + database-query + send-email

## 변경 범위

### Spec (project-planner 위임)

- `spec/2-navigation/4-integration.md §4.6 Recent activity 탭` — 컬럼 정의에 `API` 추가 (현 spec 의 At/Workflow/Node/✓·✗/ms 표가 실제 UI 와 drift 있음 → 함께 정리)
- `spec/2-navigation/4-integration.md §9.3 사용처·활동` — (a) `GET /api/integrations/:id/activity` 응답의 `items[]` shape 명시에 `apiLabel? / apiMethod? / apiPath?` 필드 추가, (b) **`GET /api/integrations/services/:type/catalog`** 신규 endpoint 등록
- `spec/4-nodes/4-integration/0-common.md` — 통합 핸들러 공통 책임에 "logUsage 호출 시 `api` 식별 정보 동반" 명시
- `spec/4-nodes/4-integration/{1-http-request,2-database-query,3-send-email,4-cafe24}.md` — 각 핸들러별 `api_label/method/path` 채우기 정책 한 문단씩
- `spec/conventions/cafe24-api-metadata.md` — catalog key 형식 (`cafe24.<resource>.<operation>`) + Frontend 가 받아 i18n lookup 한다는 책임 분리 명시

### Backend (developer 본인)

- `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts` — `apiLabel`/`apiMethod`/`apiPath` 컬럼 추가
- `codebase/backend/migrations/V064__integration_usage_log_api_columns.sql` — 3컬럼 ALTER (모두 nullable, default NULL, backfill·인덱스 없음)
- `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:17` — `IntegrationUsageParams` 에 `api?: { label?, method?, path? }` 추가 + 백엔드에서 길이 truncate (`clampMessage` 패턴)
- `codebase/backend/src/modules/integrations/integrations.service.ts:701` — `logUsage()` 가 `api` 받아 entity 매핑, 활동 응답 빌더 (`integrations.service.ts:583~`) 가 새 필드 surface
- 4개 핸들러 logUsage 호출에 `api` 채우기:
  - `cafe24.handler.ts` — `api: { label: \`cafe24.\${resource}.\${operationId}\`, method: operation.method, path: operation.path }`
  - `http-request/http-request.handler.ts` — `api: { method: methodUpperCase, path: extractHostPath(url) }` (query string 제거, baseUrl 없는 상대 URL 은 path-only fallback)
  - `database-query/database-query.handler.ts` — `api: { method: extractSqlVerb(query), path: driver }`
  - `send-email/send-email.handler.ts` — `api: { method: 'SEND', path: credentials.host ?? null }`
- 신규 catalog endpoint:
  - `codebase/backend/src/modules/integrations/integrations.controller.ts` — `@Get('services/:type/catalog')` 추가
  - `codebase/backend/src/modules/integrations/integrations.service.ts` — `getServiceCatalog(type)` 메서드. cafe24 metadata 의 `findAllCafe24Operations()` 결과를 `{ operations: [{ key, method, path, labelKey, descriptionKey }] }` 로 변환
  - swagger jsdoc 동반

### Frontend (developer 본인)

- `codebase/frontend/src/lib/api/integrations.ts:153` — `ActivityItem` 에 `apiLabel?: string | null`, `apiMethod?: string | null`, `apiPath?: string | null` 추가
- `codebase/frontend/src/lib/api/integrations.ts` — `integrationsApi.catalog(type)` 추가
- `codebase/frontend/src/lib/i18n/dict/{ko,en}/cafe24-catalog.ts` — 신규 dict 섹션 (catalog key → 라벨)
- `codebase/frontend/src/lib/i18n/dict/{ko,en}/index.ts` — 신규 섹션 composite export
- `codebase/frontend/src/lib/i18n/dict/{ko,en}/integrations.ts` — `activityApi`, `activityApiUnknown` 추가
- `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx:670~712` (`ActivityTab`) — 두 번째 컬럼 `API` 추가, 라벨+endpoint subtext 렌더, catalog 데이터 fetch (TanStack Query staleTime: 1h)

### 테스트

- Unit (backend): `integration-handler-base.spec.ts` `IntegrationUsageParams.api` 매핑, 각 핸들러 spec 의 logUsage 호출 인자 검증, catalog endpoint spec
- Unit (frontend): `ActivityTab` 렌더 — 라벨 있음/없음/둘 다 NULL fallback, catalog hook
- e2e (backend): `/integrations/services/cafe24/catalog` 응답 shape, 활동 응답에 신 필드 포함

## Phase

- [ ] **Phase 0** — plan 작성, spec 갱신 위임 준비 (본 turn)
- [ ] **Phase 1** — spec 갱신 (project-planner 위임)
- [ ] **Phase 2** — consistency-check --impl-prep 통과
- [ ] **Phase 3** — backend TDD: entity + migration + IntegrationUsageParams + logUsage 매핑
- [ ] **Phase 4** — backend TDD: 4개 핸들러 logUsage api 채우기
- [ ] **Phase 5** — backend TDD: catalog endpoint
- [ ] **Phase 6** — frontend: DTO + i18n + ActivityTab + catalog hook
- [ ] **Phase 7** — TEST WORKFLOW (lint → unit → build → e2e)
- [ ] **Phase 8** — REVIEW WORKFLOW (/ai-review + RESOLUTION + 재테스트)
- [ ] **Phase 9** — partial-implementation 점검 (남은 surface 없음 확인 — followup 불필요)
- [ ] **Phase 10** — plan complete 이동

## 확정된 설계 결정

표·세부 정책은 본 plan 첫머리 "사용자 합의" 참조. 전체 상세는 main Claude 대화 전문 (2 round) 에 보존.

### 통합별 채우기 정책

| 통합 | api_label | api_method | api_path |
|------|-----------|------------|----------|
| cafe24 | catalog key (`cafe24.<resource>.<operation>`) | `operation.method` | `operation.path` (placeholder 템플릿 그대로) |
| http-request | NULL | HTTP method | `host + path` (query string 제거. baseUrl 없으면 path-only) |
| database-query | NULL | SQL 동사 | `postgres` 또는 `mysql` |
| send-email | NULL | `SEND` | SMTP host or NULL |

### 컬럼 길이

- `api_label varchar(128) NULL`
- `api_method varchar(8) NULL`
- `api_path varchar(256) NULL`
- 초과 시 백엔드에서 자르고 끝에 `…` (`clampMessage` 패턴)

### 표시 (활동 탭)

- 라벨 있음: 굵게 라벨 + 작게 endpoint (2줄)
- 라벨 NULL + endpoint 있음: endpoint 한 줄
- 둘 다 NULL: `—`

## 사용자 입력 필요 (escalate 후보)

- 신규 sub-plan 필요 시: 사용자에게 확인 후 follow-up plan 분기
- spec 변경 결과 project-planner 가 본 설계와 다른 결론을 내릴 경우: 본 plan 갱신 + 재검토

## 참고

- 사용자 합의: 2 round 대화 (2026-05-28)
- 설계 결정 SoT: 본 plan + plan 헤더 frontmatter
