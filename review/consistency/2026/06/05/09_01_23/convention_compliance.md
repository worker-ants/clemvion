# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
**검토 일시**: 2026-06-05
**대상**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`, `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/conventions/cafe24-api-catalog/application.md`, `spec/conventions/cafe24-api-catalog/application/apps.md`, `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`

---

## 발견사항

### [INFO] `spec/5-system/10-graph-rag.md` — 3섹션 구조 순서 불일치
- **target 위치**: `spec/5-system/10-graph-rag.md` 전체 구조. `## Overview (제품 정의)` → `### 1~8` 본문 섹션들 → `## Rationale` 순이나, `## 1. 개요` 본문이 `Overview` 와 이중 정의.
- **위반 규약**: `CLAUDE.md` "정보 저장 위치" — "Overview / 본문 / Rationale 3섹션 권장", `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` 형태.
- **상세**: 동일 문서 안에 `## Overview (제품 정의)` 와 `## 1. 개요` 두 개의 개요 섹션이 공존한다. 내용이 중복·일부 겹치며, `## Overview` 는 numbered section 바깥에 floating 위치한다. 이는 "Overview / 본문 / Rationale" 3섹션 규칙에서 본문 섹션(`## 1. 개요`)을 Overview 아래 위치시켜야 한다는 의도와 구조적으로 충돌한다.
- **제안**: `## Overview (제품 정의)` 의 "구현 상태" 배너를 `## 1. 개요` 상단으로 통합하거나, 3섹션 규칙대로 `## Overview` 뒤 `## 1. 개요` 를 제거하고 내용을 Overview 본문에 흡수. 또는 현재 패턴을 이 파일의 의도된 형식으로 유지한다면 다른 `5-system` 파일과 구조를 통일.

---

### [INFO] `spec/5-system/1-auth.md` — Rationale 섹션 내 sub-section 번호 체계 비일관
- **target 위치**: `spec/5-system/1-auth.md` `## Rationale` 아래 — `### 1.5.A`, `### 1.5.B`, `### 1.5.C`, `### 1.4.A` ~ `### 1.4.I` 순서로 기술.
- **위반 규약**: 특정 convention 위반이라기보다 CLAUDE.md 의 "Rationale 3섹션" 안에서의 내부 일관성 문제. `1.4.G` ~ `1.4.I` 는 `1.5.A~C` 뒤에 등장해 섹션 번호 순서(`1.5.x` 다음 `1.4.x`)가 역순.
- **상세**: Rationale 내 subsection 이 `§1.5.A → §1.5.B → §1.5.C → §1.4.A → ... → §1.4.I` 순서로 나열되어 숫자 순서가 뒤집혔다. 문서 탐색 시 혼동 유발 가능.
- **제안**: Rationale 내 항목을 `1.4.x` 계열을 먼저, `1.5.x` 계열을 나중에 배치해 본문 섹션 번호 순서와 일치시킨다.

---

### [INFO] `spec/5-system/1-auth.md` — 에러 코드 표기 혼용 (일부 lowercase)
- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명), `spec/conventions/node-output.md Principle 3.2` (`code` 는 `UPPER_SNAKE_CASE`)
- **상세**: §1.5.4 표에서 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 가 모두 `lower_snake_case` 로 표기됨. 프로젝트 전체 에러 코드 표기 기준인 `UPPER_SNAKE_CASE` 와 불일치. 이 코드들은 API 응답에서 클라이언트가 분기하는 계약 값이므로 형식 통일이 중요하다.
- **제안**: `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_EMAIL_MISMATCH`, `FORBIDDEN`, `RATE_LIMITED` 로 변경. 구현 코드(`codebase/backend/`)와 동시에 일치시켜야 한다. 만약 코드베이스에 이미 lowercase 로 정착됐다면 `error-codes.md §3` 의 historical-artifact 레지스트리에 등재.

---

### [WARNING] `spec/5-system/11-mcp-client.md` — `mcpDiagnostics.skipReason` 의 `lower_snake_case` 를 spec 본문에서 에러 코드와 혼동 가능하게 배치
- **target 위치**: `spec/5-system/11-mcp-client.md §6.2` — `skipReason` vocabulary 표 및 명명 규칙 설명
- **위반 규약**: `spec/conventions/error-codes.md §1` 의 의미 기반 명명 / `node-output.md Principle 3.2` 의 `UPPER_SNAKE_CASE`
- **상세**: spec 문서는 `skipReason` 이 "에러 코드가 아닌 운영 진단용 enum" 이라 `lower_snake_case` 를 사용한다고 명시 설명한다. 이는 규약을 의도적으로 예외 처리한 것이나, 이 예외가 `error-codes.md §3` 의 historical-artifact 레지스트리에 등재되지 않았다. 또한 동일 §6.2 에서 `errors[].code` 는 `MCP_*` 형식 `UPPER_SNAKE_CASE` 로, `skipReason` 은 `lower_snake_case` 로 섞여 있어, 두 필드의 표기 기준 차이가 spec 을 처음 읽는 사람에게 혼동을 준다.
- **제안**: `error-codes.md §3` 의 historical-artifact 레지스트리에 `skipReason` 값들의 `lower_snake_case` 예외를 명시적으로 등재하거나, 해당 spec 섹션 주석에 규약 예외 근거를 더 명확히 기재. 현재 §6.2 에 있는 "명명 규칙 분리" 설명 자체는 충분하나, conventions 문서와 cross-reference 가 없어 규약 위반 여부를 공식 레지스트리 없이는 판단할 수 없는 상태.

---

### [INFO] `spec/5-system/11-mcp-client.md` — `## 1. 개요` 와 `## 2. Transport` 사이에 Overview 섹션 없음
- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조
- **위반 규약**: CLAUDE.md "문서 구조 규약" — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: `spec/5-system/11-mcp-client.md` 는 `## 1. 개요` 로 바로 시작하고 `## Overview` 섹션이 없다. `spec/5-system/10-graph-rag.md` 는 `## Overview (제품 정의)` 를 갖는 반면, `11-mcp-client.md` 는 이를 생략했다. `1-auth.md` 도 별도 Overview 섹션 없이 `## 1. 인증 (Authentication)` 으로 시작한다. 3파일 간 구조가 불균일하다.
- **제안**: 권장 3섹션(`## Overview`, 본문, `## Rationale`)을 일관 적용. 실용적으로는 최소한 각 spec 파일 내에서 동일 영역 파일들 간 구조를 통일하는 방향이 적절. 구현 착수 전 수정 필요도는 낮으나 영역 내 일관성을 위해 INFO 로 기록.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — 응답 파라미터 표의 `order` wrapper 설명 오류
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `POST /api/v2/admin/appstore/orders` 응답(Response) 표의 첫 행
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`"
- **상세**: `POST` 응답 표의 `order` 행 설명이 `"(응답 객체)"` 가 아닌 `"정렬 순서 asc : 순차정렬 · desc : 역순 정렬"` 로 되어 있다. 이는 다른 pagination 관련 파라미터(`order` = 정렬 순서)의 설명이 잘못 복사된 것으로 보인다.
- **제안**: `order` wrapper 행의 설명을 `(응답 객체)` 로 수정. `GET` 응답 표의 `order` 행은 설명 없이 올바르게 처리됨 — `POST` 응답 표만 수정 필요.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application.md` — `applications_list` / `webhooks_list` docs 링크 잠정성 미표기
- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` 표 내 `applications_list`, `webhooks_list` 행
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §2` — `docs` 컬럼은 "Cafe24 공식 docs anchor URL" 의무
- **상세**: 해당 두 row 의 문서화 부재는 `application.md` 하단의 주석(⚠ warning)으로 이미 설명됐다. 그러나 표 자체의 `docs` 컬럼 링크가 `https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-app-information` / `https://developers.cafe24.com/docs/ko/api/admin/#retrieve-webhook-settings` 로 채워져 있는데 공식 docs 에 해당 endpoint 가 미노출된다고 문서 내에서 자인하고 있다. 규약 §2 의 `docs` 컬럼 = "공식 docs anchor URL" 요건에 대해 잠정 링크를 사용하는 것이므로, 공식 docs 에 실제로 없는 잠정 링크는 `?` 또는 별도 마커가 더 명확하다.
- **제안**: `docs` 컬럼을 `?` 또는 `(미문서화)` 로 표시하거나, 기존 ⚠ 주석을 보완하는 방식으로 명확히 표기. 현재 구현 상 `planned` 미해당 row 에 대한 가이드가 catalog 규약에 없으므로 규약 갱신도 병행 검토.

---

### [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` — `_overview.md` 파일의 `id` frontmatter 없음
- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` 제외 목록 — `spec/<영역>/_*.md` (밑줄 prefix) 는 frontmatter 의무 면제
- **상세**: `_overview.md` 는 `_` prefix 파일이므로 `spec-frontmatter.test.ts` 가드에서 면제된다. 위반이 아님. 기록은 참고 목적.
- **제안**: 없음 (규약대로 면제 정상 처리).

---

## 요약

`spec/5-system/` 문서들은 전반적으로 frontmatter(`id`/`status`/`code`/`pending_plans`) 구성, Rationale 섹션 배치, 에러 코드 UPPER_SNAKE_CASE 규약 등 핵심 정식 규약을 대체로 준수하고 있다. 발견된 사항은 CRITICAL/WARNING 수준의 구조적 계약 파괴는 없으며, 주요 이슈는 두 가지다: (1) `spec/5-system/1-auth.md §1.5.4` 의 에러 코드가 `lower_snake_case` 로 표기된 점 — `UPPER_SNAKE_CASE` 규약 위반으로 구현 시 클라이언트 계약 불일치 위험(INFO 수준이나 코드가 API 계약이므로 구현 착수 전 수정 권장), (2) `spec/5-system/11-mcp-client.md §6.2` 의 `skipReason` `lower_snake_case` 예외가 `error-codes.md §3` 레지스트리에 미등재된 점(WARNING). `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 에서 POST 응답 표의 wrapper 설명 복사 오류가 발견됐으나 카탈로그 레퍼런스 범주(생성기 산출물 계열)라 영향 범위가 제한적이다. 구현 착수 전 필수 차단 수준의 발견은 없다.

---

## 위험도

LOW
