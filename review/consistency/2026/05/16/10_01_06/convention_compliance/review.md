# 정식 규약 준수 검토 — spec/5-system/

검토 일시: 2026-05-16  
검토 범위: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 12-webhook.md, 13-replay-rerun.md) 및 `spec/conventions/` (cafe24-api-metadata.md, conversation-thread.md, migrations.md)  
검토 모드: --impl-prep (구현 착수 전)

---

## 발견사항

### 문서 구조 규약

- **[WARNING]** `spec/5-system/1-auth.md` — Rationale 섹션 존재하나 Overview 섹션 누락
  - target 위치: `spec/5-system/1-auth.md` 전체 (파일 최상단 ~ §1)
  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" — 권장 3섹션 구성 (Overview / 본문 / Rationale). 단일 spec 파일 영역은 본문 상단에 직접 `## Overview` 섹션을 둔다
  - 상세: 파일은 제목 줄 아래 바로 `## 1. 인증 (Authentication)` 본문으로 시작하며 `## Overview` 또는 `## Overview (제품 정의)` 섹션이 없다. `## Rationale` 는 존재한다. 단일 파일 영역에서 Overview 누락은 구조 규약 위반이다.
  - 제안: 파일 상단(관련 문서 링크 아래)에 `## Overview (제품 정의)` 섹션을 추가하고, 인증 시스템의 사용자 가치·목표를 간략히 기술한다.

- **[WARNING]** `spec/5-system/11-mcp-client.md` — Overview 섹션 없이 `## 1. 개요` 로 시작
  - target 위치: `spec/5-system/11-mcp-client.md` 파일 최상단 ~ §1
  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" 권장 3섹션 구성
  - 상세: `## Overview (제품 정의)` 섹션 없이 바로 `## 1. 개요`(기술 개요)로 시작한다. `## Rationale` 섹션도 보이지 않는다. 단일 파일 영역임에도 권장 3섹션 구성이 모두 빠져있다.
  - 제안: 파일 상단에 `## Overview (제품 정의)` 섹션(사용자 가치·목표)을 추가하고, 파일 말미에 `## Rationale` 섹션을 추가한다.

- **[WARNING]** `spec/5-system/12-webhook.md` — Overview 와 본문 섹션이 혼재 (번호 충돌)
  - target 위치: `spec/5-system/12-webhook.md` §Overview 안의 "### 1. 개요" ~ 본문 "## 1. 아키텍처 개요"
  - 위반 규약: CLAUDE.md 권장 3섹션 구성 및 `## Overview (제품 정의)` 패턴
  - 상세: 파일은 `## Overview (제품 정의)` 섹션 안에 `### 1. 개요` / `### 2. 사용 시나리오` / `### 3. 요구사항` / `### 4. 비기능 요구사항` 소절을 두고, 그 뒤에 다시 `## 1. 아키텍처 개요` / `## 2. 데이터 모델` ... 로 이어진다. Overview 섹션이 PRD 내용을 모두 담아 지나치게 길어지고, `## Rationale` 섹션이 없다. 형식 자체가 혼재되어 있다.
  - 제안: Overview 섹션은 사용자 가치·목적 정도로 압축하고, 요구사항·비기능 요구사항은 본문 섹션으로 옮기거나 별도 `_product-overview.md` 로 분리를 검토한다. 파일 말미에 `## Rationale` 섹션을 추가한다.

- **[INFO]** `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 내부에 `### 1.` / `### 2.` 소절이 있고 본문 `## 1. 개요`와 번호가 중복됨
  - target 위치: `spec/5-system/10-graph-rag.md` Overview 섹션
  - 위반 규약: CLAUDE.md 권장 3섹션 구성 (형식 일관성)
  - 상세: Overview 섹션 안에서 `### 1. 목표` / `### 2. 범위` / `### 3. 요구사항` 등 상세 소절이 있고, 이후 본문이 다시 `## 1. 개요`로 시작해 번호 체계가 중복된다. 단일 파일 규모가 커진 경우 `_product-overview.md` 분리를 권장하는 패턴과 맞지 않는다. 분리 구조이긴 하지만 단일 파일 안에서 혼재되어 있다.
  - 제안: Overview 와 본문 번호 충돌을 해소하거나 (Overview 소절 번호 제거), 콘텐츠 규모가 충분히 크면 `_product-overview.md` 로 분리하는 방향을 검토한다.

### 금지 항목 — 옛 prd/ 경로 참조

- **[CRITICAL]** `spec/5-system/10-graph-rag.md` — Rationale 섹션이 `memory/` 폴더를 직접 참조
  - target 위치: `spec/5-system/10-graph-rag.md` Rationale 섹션 — "Graph RAG 도메인 모델 결정의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며..." / "_원본 메모: memory/graph-rag-decisions.md_"
  - 위반 규약: CLAUDE.md "폴더 구조" — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12)으로 모두 `spec/` 또는 `plan/complete/archive/`로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
  - 상세: Rationale 섹션 본문이 `memory/graph-rag-decisions.md` 를 원본 참조로 명시하고, 도입부에서 "memory/ 에 남아있던 작업 메모" 라고 경로를 그대로 노출한다. docs-consolidation 이후 `memory/` 경로는 더 이상 유효하지 않으며 구현자·독자가 이 경로로 접근하면 문서를 찾을 수 없다.
  - 제안: Rationale 내 `memory/` 경로 참조를 실제 이관 경로(`plan/complete/archive/from-memory/`) 로 수정하거나, 이미 inline 흡수되었다면 원본 경로 참조 문장 자체를 삭제한다.

- **[CRITICAL]** `spec/5-system/10-graph-rag.md` Rationale 내 — `prd/9-graph-rag.md` 등 옛 `prd/` 경로 참조
  - target 위치: `spec/5-system/10-graph-rag.md` Rationale §"영향 범위" 항목
  - 위반 규약: CLAUDE.md "폴더 구조" — `prd/` 폴더는 docs-consolidation 으로 `spec/` 에 흡수됨, 신규 문서를 옛 경로 컨벤션으로 만들지 않음
  - 상세: Rationale 내 "영향 범위" 표에서 `prd/9-graph-rag.md`, `prd/0-overview.md`, `prd/4-integration.md`, `prd/6-phase2-ai.md` 를 여전히 영향 범위 파일로 나열하고 있다. 이 파일들은 이미 `spec/` 으로 이관되었거나 폐기되었으므로 이 경로를 spec 문서 안에 남겨두면 구현자가 잘못된 경로로 안내된다.
  - 제안: 해당 참조를 이관 후 실제 `spec/` 경로로 갱신하거나, 역사적 메모로만 남긴다면 명시적으로 "현재 경로가 아님(역사적 기록)" 이라는 주석을 부기한다.

- **[WARNING]** `spec/5-system/12-webhook.md` — Overview 내 `prd/8-webhook.md` 출처 표기가 미완
  - target 위치: `spec/5-system/12-webhook.md` Overview 섹션 첫 번째 blockquote
  - 위반 규약: CLAUDE.md "폴더 구조" 금지 항목
  - 상세: `> 출처: prd/8-webhook.md — docs-consolidation(2026-05-12)으로 본 문서에 흡수.` 라고만 기재되어 있고 내용은 흡수되어 있는 상태다. `prd/` 참조 자체는 "흡수했다"는 이력 표기이므로 critical 은 아니나, 문서 구조 내에서 옛 경로가 그대로 노출된다. 10-graph-rag.md 의 동일 패턴과 일관성 측면에서 경고 수준으로 분류한다.
  - 제안: "출처: `prd/8-webhook.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수" 표기는 이력 정보로 허용 가능하지만, 독자가 이 경로를 실제 파일로 오해하지 않도록 "현재 해당 파일은 존재하지 않음" 문구나 별도 스타일(취소선 등)을 덧붙이는 것이 좋다.

### API 엔드포인트 명명 규약

- **[WARNING]** `spec/5-system/1-auth.md` §5 — API 엔드포인트에 `/api/v1/` prefix 없이 `/api/` 만 사용
  - target 위치: `spec/5-system/1-auth.md` §5 API 엔드포인트 표 전체
  - 위반 규약: `spec/5-system/13-replay-rerun.md` §8 및 `spec/5-system/10-graph-rag.md` §5 에서는 `/api/v1/` prefix 를 사용하는 반면, 1-auth.md 는 `/api/auth/...`, `/api/audit-logs`, `/api/invitations/:token` 형태로 버전 prefix 가 없음 — 동일 시스템 내 endpoint 명명 일관성 결여
  - 상세: `spec/5-system/13-replay-rerun.md` 는 `POST /api/v1/executions/:executionId/re-run` 형태를 사용하고, `spec/5-system/10-graph-rag.md` 도 `GET /api/knowledge-bases/...` (버전 없음)을 사용해 영역 간 일관성이 없다. 1-auth.md 는 `/api/` 직접 사용.
  - 제안: API versioning 정책을 `spec/5-system/2-api-convention.md` 에서 명확히 정의하고 모든 spec 문서가 같은 패턴을 따르도록 통일한다. 현재 일부 spec 은 `/api/v1/`, 일부는 `/api/` 를 사용하는 혼재 상태이다.

- **[WARNING]** `spec/5-system/1-auth.md` §1.5.2, §1.5.3 — 흐름 내 API 경로가 버전 prefix 불일치
  - target 위치: `spec/5-system/1-auth.md` §1.5.2 흐름 1단계: `POST /api/v1/workspaces/:id/invitations`, 3단계: `GET /api/invitations/:token`, §1.5.3 3단계: `POST /api/workspaces/invitations/accept`
  - 위반 규약: 동일 문서 내에서 `/api/v1/` 과 `/api/` 가 혼재
  - 상세: §1.5.2 1단계는 `POST /api/v1/workspaces/:id/invitations` (버전 있음), 3단계는 `GET /api/invitations/:token` (버전 없음). §1.5.3 3단계는 `POST /api/workspaces/invitations/accept` (버전 없음). 같은 문서 내에서도 버전 prefix 가 일관되지 않다.
  - 제안: 동일 문서 내 endpoint 버전 prefix 를 통일한다. API versioning 정책 확정 후 일괄 정정.

### 출력 포맷 규약

- **[INFO]** `spec/5-system/13-replay-rerun.md` §7.2 — dry-run mock 출력 객체의 필드명이 node-output conventions 와 교차 검증 필요
  - target 위치: `spec/5-system/13-replay-rerun.md` §7.2 dry-run 동작 명세
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 — NodeHandlerOutput 5필드 불변 / Principle 1 — `output` 은 비즈니스 결과물만
  - 상세: dry-run 시 mock 출력으로 `{ "_dryRun": true, "skippedReason": "...", "wouldHaveCalled": { ... } }` 를 `output` 에 담도록 명세한다. `_dryRun` 이라는 실행 메타 정보가 `output` 에 포함되어 있어 Principle 1 (output 은 비즈니스 결과물만)과 충돌 가능성이 있다. 다만 dry-run 에서 실제 외부 호출 없이 mock 을 반환하는 것이 의도이므로 완전한 위반이라 보기 어려우나, `meta.dryRun: true` 에도 동일 정보를 두고 `output` 의 `_dryRun` 은 선택적으로 취급하는 방향이 Principles 에 더 정합하다.
  - 제안: `meta.dryRun: true` 를 primary 마커로 정의하고, `output._dryRun: true` 는 UI/하위 노드에서의 self-contained 감지용 보조 마커로 명시하는 문장을 추가한다. 또는 node-output conventions 에 dry-run 모드 예외 항목을 명시한다.

- **[INFO]** `spec/5-system/12-webhook.md` §5.2 — 400 에러 응답 형태가 `spec/conventions` 또는 `spec/5-system/3-error-handling.md` 규약과 교차 검증 필요
  - target 위치: `spec/5-system/12-webhook.md` §5.2 400 응답 형식
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2 `output.error` 표준 형태 및 `spec/5-system/3-error-handling.md` (API 에러 shape)
  - 상세: §5.2 는 `{ statusCode, message, errors: [{ field, reason }] }` 형태를 정의하고 있다. 이 형태가 `spec/5-system/3-error-handling.md` 의 표준 에러 envelope 와 일치하는지 확인이 필요하다. spec 이 직접 에러 shape 를 정의한 경우 표준 규약과의 정합을 명시적으로 언급해야 한다.
  - 제안: `spec/5-system/12-webhook.md` §5.2 에 "본 응답 형태는 `spec/5-system/3-error-handling.md` §X 의 표준 에러 envelope 를 따른다" 또는 편차가 있다면 그 이유를 명시한다.

### API 문서 규약 (Swagger/DTO)

- **[INFO]** `spec/conventions/swagger.md` — DTO 명명 패턴이 target spec 문서와 직접 교차 검증 어려움 (spec 문서는 구현 파일이 아님)
  - target 위치: 해당 없음 (spec 문서 레벨에서 DTO 실제 명명은 구현 파일에 존재)
  - 위반 규약: `spec/conventions/swagger.md` §1 DTO 패턴
  - 상세: Swagger/DTO 규약은 `backend/` 구현 코드에 적용되며 spec 문서 자체에는 직접 위반이 발생하지 않는다. spec 문서 내 API 명세 표(1-auth.md §5, 13-replay-rerun.md §8.1 등)는 DTO 명을 노출하지 않아 이 규약의 점검 대상이 되지 않는다.
  - 제안: 구현 착수 시 각 API endpoint 의 Request/Response DTO 가 `spec/conventions/swagger.md` 패턴(JSDoc, `@ApiProperty`, `@ApiTags`)을 따르도록 개발자에게 명시적으로 안내한다.

---

## 요약

`spec/5-system/` 영역의 target 문서들은 전반적으로 spec 본문의 기술 명세 수준은 높으나, **정식 규약에서 명시한 권장 3섹션 구성(Overview / 본문 / Rationale)** 을 일부 파일에서 지키지 않고 있다. 가장 심각한 문제는 `spec/5-system/10-graph-rag.md` 의 Rationale 섹션이 **docs-consolidation 으로 폐기된 `memory/` 및 `prd/` 경로를 직접 참조**한다는 점으로, 이는 CLAUDE.md 금지 항목을 직접 위반한다. API endpoint 버전 prefix(`/api/v1/` vs `/api/`) 혼재 문제는 동일 문서 내에서도 관찰되어, 구현 착수 전 `spec/5-system/2-api-convention.md` 에서 versioning 정책을 명확히 결정하고 모든 관련 spec 에 반영해야 한다. `spec/conventions/` 파일들(cafe24-api-metadata, conversation-thread, migrations)은 자체 규약으로서 구조 면에서 특별한 위반이 없다.

---

## 위험도

**MEDIUM**

CRITICAL 항목 2건(옛 `memory/`·`prd/` 경로 직접 참조)이 구현 방향에는 직접 영향을 주지 않지만 구현자가 잘못된 경로로 안내될 수 있고, API 버전 prefix 혼재는 구현 시 인터페이스 불일치로 이어질 수 있다. 문서 구조 위반(Overview 누락)은 구현 가드를 깨지는 않으나 규약 drift 의 누적 위험이 있다.
