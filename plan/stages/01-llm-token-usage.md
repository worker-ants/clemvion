# Stage 1 · LLM 토큰 사용량 추적

## 배경

PRD `NAV-ST-06`(LLM 토큰 사용량 추적)이 미구현이다. 현재 LLM 호출은 이루어지지만 토큰 수·비용이 기록되지 않고 통계 화면에도 표시되지 않는다. 사용자가 "얼마나 썼는지 통계 메뉴에서 확인"할 수 있도록 수집·집계·표시를 구현한다.

## 설계

### 데이터 모델

신규 테이블 `llm_usage_logs`:

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID | FK → workspaces |
| `workflow_id` | UUID NULL | FK → workflows (실행 컨텍스트) |
| `execution_id` | UUID NULL | FK → executions |
| `node_execution_id` | UUID NULL | FK → node_executions |
| `llm_config_id` | UUID NULL | FK → llm_configs (설정 삭제 시 NULL) |
| `provider` | VARCHAR(50) | openai · anthropic · google · azure · local |
| `model` | VARCHAR(100) | gpt-4o-mini 등 |
| `prompt_tokens` | INT | |
| `completion_tokens` | INT | |
| `total_tokens` | INT | |
| `cost_usd` | DECIMAL(12, 6) NULL | 계산 가능 시 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

인덱스: `(workspace_id, created_at)`, `(workflow_id, created_at)`, `(provider, model, created_at)`.

### 수집 경로

LLM 클라이언트(`backend/src/modules/llm/**`)의 응답 후 `LlmUsageLogService.record()` 호출. 실행 컨텍스트(`executionId`, `nodeExecutionId`, `workflowId`, `workspaceId`, `llmConfigId`)는 AI 노드 실행 시 주입된 context에서 전달.

실패 내성: 사용량 기록 실패는 **LLM 호출 성공 여부에 영향 없음** — `.catch()` 로깅만.

### 비용 계산

`provider + model`별 가격 테이블을 상수로 정의(`backend/src/modules/llm/pricing.ts`). 가격 미정 모델은 `cost_usd = NULL`. 표에 "-" 표기.

### API

| 메서드 | 경로 | 쿼리 | 응답 |
|---|---|---|---|
| GET | `/api/v1/statistics/llm-usage/summary` | `period=1d\|7d\|30d\|90d`, `workflowId?` | `{ totalTokens, totalCostUsd, byProvider: [{provider, model, totalTokens, totalCostUsd}] }` |
| GET | `/api/v1/statistics/llm-usage/timeseries` | 동일 | `[{ date, provider, totalTokens }]` |

### 프론트엔드

`/statistics` 페이지 하단에 **LLM Token Usage** 섹션 추가:
- 요약 카드: Total Tokens · Total Cost · Top Provider
- 프로바이더×모델 테이블 (prompt / completion / total / cost)
- 시계열 차트(막대, 기존 차트 패턴 재사용)

조건: 워크스페이스에 LLM Config가 하나도 없고 집계가 0건이면 "사용 내역 없음" empty state.

### 영향받는 파일

- 신규 마이그레이션: `backend/src/db/migrations/*-create-llm-usage-logs.sql`
- 신규 엔티티: `backend/src/modules/llm/entities/llm-usage-log.entity.ts`
- 신규 서비스: `backend/src/modules/llm/llm-usage-log.service.ts`
- 수정: `backend/src/modules/llm/llm.service.ts` (응답 후 record 호출)
- 수정: `backend/src/modules/statistics/statistics.controller.ts`, `statistics.service.ts` (엔드포인트 2개 추가)
- 수정: `frontend/src/app/(main)/statistics/page.tsx` (섹션 추가)
- 수정: `prd/1-navigation.md` NAV-ST-06 → ✅
- 수정: `frontend/src/content/docs/06-faq/faq.mdx` Q6 (정확한 내용으로 다듬기)

### 테스트

- backend unit: `llm-usage-log.service.spec.ts` (record 동작), `statistics.service.spec.ts` (집계 쿼리)
- backend integration: LLM 호출 시 log 기록 확인(e2e)
- frontend unit: statistics 페이지 신규 섹션 렌더 조건

### 검증

1. `npm run lint` / `npm test` / `npm run build` 전부 통과 (backend/frontend)
2. dev에서 LLM 호출 후 `/statistics`에 사용량이 집계되는지 확인
3. 워크플로우 필터 적용 시 해당 워크플로우 기준 집계 확인
