# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/5-system/` 전체 (payload 에 포함된 파일 기준 — `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)

---

## 발견사항

### [WARNING] `1-auth.md` — 에러 코드 케이싱 혼재 (§1.5.4)
- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`
- **상세**: 초대 토큰 에러 코드(`invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `rate_limited`, `forbidden`)가 모두 `lower_snake_case` 로 작성되어 있다. `spec/5-system/3-error-handling.md` 의 인증/인가 에러 코드 규약(`AUTH_REQUIRED`, `TOKEN_EXPIRED`, `FORBIDDEN`, `LOGIN_FAILED` 등) 및 node-output Principle 3.2 는 에러 코드를 `UPPER_SNAKE_CASE` 로 정의한다.
- **제안**: 에러 코드를 `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_EMAIL_MISMATCH`, `RATE_LIMITED`, `FORBIDDEN` 으로 변경. 단, `spec/5-system/3-error-handling.md` 에 이 에러 코드들을 공식 등록하거나, `1-auth.md` 내부 사용 한정임을 명시해야 한다. 만약 이 코드들이 의도적으로 HTTP 클라이언트에 그대로 노출되는 API 에러 코드라면 `3-error-handling.md` 의 카탈로그를 먼저 갱신하고 `UPPER_SNAKE_CASE` 로 정렬해야 한다.

---

### [WARNING] `1-auth.md` — `spec-only` frontmatter 에 `code: []` 이지만 구현 경로 가 본문 내 직접 기술됨
- **target 위치**: `spec/5-system/1-auth.md` frontmatter (`status: spec-only`, `code: []`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 라이프사이클 — `spec-only` 는 `code:` 가 비어도 OK 이지만 TTL 90일 초과 시 build fail. 또한 §2.1: `status` 가 `spec-only` 임에도 본문에 `codebase/backend/src/common/config/webauthn.config.ts`, `codebase/backend/src/modules/auth/webauthn/` 등 구체 구현 경로가 명시되어 있어 실질적으로 구현이 완료됐음을 시사한다.
- **상세**: Rationale §1.4.H 에 `auth/webauthn/webauthn.service.ts`, `auth/webauthn/webauthn.module.ts`, `auth/webauthn/webauthn.controller.ts` 등 구체 파일 경로가 명기되어 있고, §1.4.G 에는 "V058 는 이미 production 에 적용됐다"는 표현이 있다. 이는 `status: spec-only` 가 아닌 `status: partial` 또는 `implemented` 에 해당한다.
- **제안**: `status` 를 실제 구현 상태에 맞게 `partial` 또는 `implemented` 로 변경하고, `code:` 에 구현된 경로(`codebase/backend/src/modules/auth/**` 등)를 채운다. `partial` 일 경우 `pending_plans:` 도 함께 등록해야 한다 (§3 의 `partial` 의무 항목).

---

### [WARNING] `10-graph-rag.md` — 문서 구조 3섹션 규약 미준수 (Overview 위치)
- **target 위치**: `spec/5-system/10-graph-rag.md` 전반 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)". `spec/conventions/spec-impl-evidence.md` §1 제외 목록에 따르면 `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` 에 제품 정의·요구사항을 두도록 권고
- **상세**: `10-graph-rag.md` 는 파일 최상단에 `## Overview (제품 정의)` 섹션이 있고, 그 아래 `## 1. 개요`, `## 2. 데이터 모델` ... `## Rationale` 로 이어지는 구조다. Overview 와 본문이 정상 배치되어 있어 규약에 부합하지만, Overview 섹션이 `---` 구분자 없이 frontmatter → 문서 링크 `>` 인용구 → `---` → `## Overview (제품 정의)` 순서인 반면 `1-auth.md` 는 `---` 구분자 후 바로 `## 1. 인증 (Authentication)` 으로 Overview 섹션 자체가 없다. `1-auth.md` 에는 제품 정의 섹션이 별도로 존재하지 않아 3섹션 권장 구조(Overview / 본문 / Rationale)가 불완전하다.
- **제안**: `1-auth.md` 에 `## Overview` 섹션을 추가해 인증 시스템의 제품 정의·범위를 요약하거나, `_product-overview.md` 를 참조한다는 설명을 명시한다.

---

### [WARNING] `11-mcp-client.md` — `skipReason` vocabulary 케이싱 혼재 표기가 있으나 의도적 예외인지 모호
- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 진단 누적 (`mcpDiagnostics`) `skipReason` vocabulary 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`
- **상세**: `skipReason` 값들(`expired_install_timeout`, `expired_refresh_failed`, `expired_no_refresh_token`, `error`, `pending_install`, `lookup_failed`, `not_capable`)이 `lower_snake_case` 로 정의된다. 명세 내에 "본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 구분된다"는 명시적 예외 근거가 기술되어 있다. 단, 이 예외가 spec 어디에도 공식 컨벤션으로 등록되지 않아 추후 혼란을 유발할 수 있다.
- **제안**: 11-mcp-client.md §6.2 의 인라인 예외 근거는 이미 상세하게 서술되어 있어 WARNING 수준으로 분류한다. 향후 `spec/conventions/node-output.md` Principle 3.2 에 "진단용 enum(예: `skipReason`)은 `lower_snake_case` 허용, 단 `code` 필드와 혼용 금지" 한 줄을 추가하면 컨벤션 자체가 명확해진다.

---

### [WARNING] `1-auth.md` — API 엔드포인트 표의 응답 포맷 규약 부분 미준수
- **target 위치**: `spec/5-system/1-auth.md` §5 API 엔드포인트 표, 특히 `GET /api/auth/2fa/webauthn/availability` 응답 `{ data: { enabled: boolean } }` vs `{ enabled: boolean }`
- **위반 규약**: `spec/conventions/swagger.md` §2-5 응답 wrapping — 프로젝트는 `TransformInterceptor` 로 모든 성공 응답을 `{ data: ... }` 로 감싼다. `spec/5-system/2-api-convention.md` 의 동일 규약.
- **상세**: `GET /api/auth/2fa/webauthn/availability` 응답이 `{ data: { enabled: boolean } }` 으로 올바르게 기술되어 있으나, 동일 절의 §1.4.3 에서는 `{ data: { enabled: boolean } }` 로 일관된다. 그러나 나머지 엔드포인트 응답은 wrapping 없이 기술(`{ requires2fa, methods, challengeToken }`, `{ accessToken }`, `[{id, deviceName, ...}]`)되어 있어 일관성이 부족하다. spec 이 응답 shape 을 기술할 때 `{ data: ... }` wrapper 유무가 혼재한다.
- **제안**: 모든 엔드포인트 응답 표기에서 `{ data: ... }` wrapper 를 일관되게 적용하거나, spec 내 표기는 "data 내부 shape" 만 기술하고 wrapper 는 `TransformInterceptor` 글로벌 적용이라는 한 줄 주석으로 처리하는 방향으로 통일한다.

---

### [INFO] `10-graph-rag.md` — `status: implemented` 이나 `code:` glob 이 `codebase/backend/migrations/V025__graph_rag.sql` 등 구체 파일 기준
- **target 위치**: `spec/5-system/10-graph-rag.md` frontmatter `code:` 배열
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2 Frontmatter 스키마 — `code:` 는 glob 허용, 파일 경로 열거도 가능
- **상세**: `code:` 에 `codebase/backend/migrations/V025__graph_rag.sql` ~ `V027__relation_head_tail_index.sql` 등 개별 파일과 `codebase/backend/src/modules/knowledge-base/graph/**`, `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` 등이 혼재한다. 기능 자체는 규약 위반이 아니나, `graph/**` glob 이 구현된 frontend 컴포넌트 경로(`graph-3d-renderer.tsx`, `entity-list.tsx`, `relation-list.tsx`)와 함께 enumeration 되어 있어 `spec-code-paths.test.ts` 의 glob 매치가 모두 통과하는지 실제 파일 존재 여부 확인이 필요하다.
- **제안**: `code:` 의 frontend 경로가 `codebase/frontend/src/components/knowledge-base/graph-3d-renderer.tsx` 처럼 정확한 경로로 기재되어 있으므로 build-time 가드가 동작하면 자동 검증된다. 별도 수정 불필요. 단, migration 파일(`V025`, `V026`, `V027`)은 spec-code-paths 가드가 glob 기반으로 동작하므로 파일명이 변경되면 stale glob 위험이 있음을 주의한다.

---

### [INFO] `11-mcp-client.md` — `status: spec-only` + `code: []` 이나 본문에 구현 경로 명기
- **target 위치**: `spec/5-system/11-mcp-client.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 — `spec-only` 는 TTL 90일 관리 대상
- **상세**: frontmatter `status: spec-only`, `code: []` 이나 §2.3 에 `Cafe24McpBridge`, §6 에 `McpToolProvider`, §6.2 에 `meta.mcpDiagnostics` 등 구체 구현체 이름이 기술되어 있다. 일부 기능이 이미 Cafe24 통합(최근 PR #314, #310) 으로 구현됐을 가능성이 있다. TTL 90일을 초과하면 build-time 가드가 fail 하므로, 구현이 머지됐다면 `status` 를 `partial` 로 승격하고 `code:` 를 채워야 한다.
- **제안**: Cafe24 MCP Bridge 구현이 완료됐는지 확인 후 `status` 를 적절히 갱신. 완료됐다면 `partial` + `code: [codebase/backend/src/modules/cafe24/**]` + `pending_plans: [...]` 로 변경한다.

---

### [INFO] `1-auth.md` — `status: spec-only` TTL 카운트 시작 시점 불명확
- **target 위치**: `spec/5-system/1-auth.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 — `spec-only` TTL 90일
- **상세**: Rationale §1.4.I 에 "2fa-webauthn 본 PR (2026-05-18)" 언급이 있어 비교적 최근 작성이나, 본문에 V058 migration 이 "이미 production 에 적용됐다"는 기술과 함께 구현 코드 경로가 명시되어 있다. `spec-only` 상태 부여가 실제 상태와 괴리되며, 이 상태로 90일을 넘기면 build fail 이 발생한다.
- **제안**: WARNING §2 (`status` 갱신) 와 동일 조치로 해소된다.

---

### [INFO] `10-graph-rag.md` — `## Overview` 내부 구현 완료 현황 배지가 Overview 목적을 초과
- **target 위치**: `spec/5-system/10-graph-rag.md` `## Overview (제품 정의)` 섹션 내 `> **구현 상태**: ...` 블록
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: Overview 섹션 안에 구현 완료 상태 (`✅ P0~P2 구현 완료`, 검증 일자, 구현 범위 설명)가 블록 인용 형태로 삽입되어 있다. 이 내용은 Rationale 또는 구현 Evidence 영역(`code:` frontmatter)에 있어야 하며, Overview 는 제품 정의·목표 기술에 집중해야 한다.
- **제안**: 구현 완료 현황 블록을 `## Rationale` 또는 frontmatter `code:` 로 이동하거나, Overview 내에 두되 별도 `## 구현 현황` 섹션으로 분리한다. 단, 현재 관행으로 허용되고 있다면 INFO 수준의 형식 개선 권고다.

---

## 요약

`spec/5-system/` 대상 정식 규약 준수 검토 결과, CRITICAL 위반은 없다. 가장 중요한 발견은 두 가지다. 첫째, `1-auth.md` 의 frontmatter `status: spec-only` 가 실제 구현 상태(V058 migration 운영 적용, WebAuthn 모듈 구현 경로 기술)와 일치하지 않아 `spec-impl-evidence.md` 규약의 `status` 라이프사이클을 위반한다. 둘째, `§1.5.4` 의 초대 토큰 에러 코드가 `lower_snake_case` 로 기술되어 `3-error-handling.md` 및 `node-output.md` Principle 3.2 의 `UPPER_SNAKE_CASE` 에러 코드 규약과 불일치한다. `11-mcp-client.md` 의 `skipReason` 케이싱 예외는 본문 내 예외 근거가 명시되어 있어 WARNING 으로 분류되나, 향후 `node-output.md` 에 공식 예외 조항으로 등록할 것을 권고한다. API 응답 표기에서 `{ data: ... }` wrapper 유무의 혼재도 구현 착수 전 정리가 필요하다.

---

## 위험도

MEDIUM
