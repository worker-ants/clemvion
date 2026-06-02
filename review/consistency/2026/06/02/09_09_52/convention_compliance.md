# 정식 규약 준수 검토 결과

검토 범위: `spec/2-navigation/` 전체 (구현 착수 전 검토 — `--impl-prep`)
검토 기준: `spec/conventions/**`

---

## 발견사항

### **[WARNING]** `14-execution-history.md` — 문서 구조 이중 섹션 헤딩

- **target 위치**: `spec/2-navigation/14-execution-history.md`, 14행 이후
- **위반 규약**: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
- **상세**: 파일 내에 `## Overview (제품 정의)` 섹션이 먼저 등장하고 (14행), 그 안에 § 1~3 요구사항이 포함된다. 그런데 `## 1. 개요` 헤딩이 파일 아래 (`## 1. 개요`, 1337행)에 **다시 등장**한다 (동일 레벨 반복). 이는 Overview가 본문 앞에 별도 섹션으로 위치하지 않고 본문과 혼재된 구조다. 다른 파일들 (`0-dashboard.md`, `10-auth-flow.md` 등)은 `## 1. 개요` 하나로 시작하는 단일 구조인데, 이 파일만 PRD 요구사항 블록(`## Overview` + 내부 §1~3)과 spec 본문(`## 1. 개요` 이하)이 이중으로 쌓여 있다.
- **제안**: Overview 섹션을 본문의 `## 1. 개요` 앞에 합치거나, PRD 블록 내용을 `_product-overview.md`로 이동하고 본문만 남긴다. 현재 파일은 두 가지 다른 구조가 병존하는 상태다.

---

### **[WARNING]** `14-execution-history.md` — `code:` 경로 backend 누락 (spec-impl-evidence 규약)

- **target 위치**: `spec/2-navigation/14-execution-history.md`, frontmatter `code:` 필드
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2 Frontmatter 스키마` — `status: implemented` 일 때 `code:` 에 ≥1 매치 의무. 특히 본문 §5 "모든 API는 이미 구현되어 있으며, 추가 백엔드 작업은 불필요하다"라고 명시하면서 `GET /api/executions/workflow/:workflowId`, `GET /api/executions/:id`, `POST /api/executions/:executionId/re-run`, `GET /api/executions/:executionId/chain` 등 백엔드 API endpoint 를 서술한다.
- **상세**: `code:` 에는 `codebase/frontend/src/app/(main)/workflows/[id]/executions/**` 만 있고 대응하는 백엔드 실행 모듈 경로(`codebase/backend/src/modules/executions/**` 등)가 없다. `status: implemented` + backend API surface 약속이 있으면 백엔드 구현 경로도 `code:` 에 포함해야 `spec-code-paths.test.ts` 가드의 취지에 부합한다.
- **제안**: `code:` 에 `codebase/backend/src/modules/executions/**` (또는 실제 경로) 추가.

---

### **[WARNING]** `0-dashboard.md` — `code:` 경로 backend 누락 (spec-impl-evidence 규약)

- **target 위치**: `spec/2-navigation/0-dashboard.md`, frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — `status: implemented` 시 `code:` 에 구현 surface 명시
- **상세**: frontmatter `code:` 에 `codebase/frontend/src/app/(main)/dashboard/page.tsx` 만 있고, 본문 §7에서 정의한 `GET /api/dashboard/summary`, `GET /api/dashboard/recent-workflows`, `GET /api/dashboard/recent-executions` 에 대응하는 백엔드 경로가 없다. API 응답 예시까지 spec 에 포함된 구현 약속이므로 백엔드 경로도 evidence 로 포함해야 한다.
- **제안**: `code:` 에 대응 backend 경로 추가 (예: `codebase/backend/src/modules/dashboard/**`).

---

### **[WARNING]** `10-auth-flow.md` — `code:` 경로 backend 누락 (spec-impl-evidence 규약)

- **target 위치**: `spec/2-navigation/10-auth-flow.md`, frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2`
- **상세**: `code:` 에 frontend auth 경로만 있고, 본문 §8에서 정의하는 14개 backend API 엔드포인트(`POST /api/auth/register`, `POST /api/auth/login`, 등)에 대응하는 backend 구현 경로가 없다. `status: implemented`이므로 backend 증거 경로가 `code:`에 포함되어야 한다.
- **제안**: `code:` 에 `codebase/backend/src/modules/auth/**` 또는 동등 경로 추가.

---

### **[INFO]** `14-execution-history.md` — 응답 예시에 `pagination` 키 이름 규약 정합 확인

- **target 위치**: `spec/2-navigation/14-execution-history.md`, §5 목록 API 응답 형식
- **위반 규약**: `spec/5-system/2-api-convention.md §5.2 목록 응답`
- **상세**: 응답 예시의 `pagination` 오브젝트가 `{ page, limit, totalItems, totalPages }` 구조로, `spec/5-system/2-api-convention.md §5.2`의 동일 구조(`page, limit, totalItems, totalPages`)와 일치한다. 이 부분은 정상이나, `swagger.md §5-2` 의 `ApiOkPaginatedResponse` 헬퍼가 내부적으로 `PaginatedResponseDto` 구조 (`{ data: { data: Dto[], pagination: {...} } }`)를 사용함을 확인할 것. spec 예시에서는 외부 `data` 래핑 없이 `{ data: [...], pagination: {...} }` 로 표현되어 있는데, `TransformInterceptor` 가 한 번 더 `{ data: ... }` 로 감싸는 경우 실제 응답은 `{ data: { data: [...], pagination: {...} } }` 가 된다. 이는 INFO 수준이며 구현 시 `swagger.md §2-5` 응답 wrapping 패턴과 정합 여부를 확인해야 한다.
- **제안**: spec 응답 예시가 `TransformInterceptor` 래핑을 고려한 실제 응답 형태인지 명시적으로 주석 추가 또는 기존 spec 예시 포맷과 일치시킨다.

---

### **[INFO]** `11-error-empty-states.md` — backend `code:` 경로 제한적

- **target 위치**: `spec/2-navigation/11-error-empty-states.md`, frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` 참고 (INFO 수준)
- **상세**: `code:` 에 frontend 컴포넌트 경로만 포함. 이 spec 은 순수 UI spec (에러 페이지·빈 상태)으로 백엔드 API 약속이 없으므로 frontend 경로만으로 충분하다. 문제 없음.
- **제안**: 해당 없음.

---

### **[INFO]** `14-execution-history.md` — 섹션 번호 §2.4 내 `Trigger 출처 분류` 헤딩이 소절 레벨로 삽입

- **target 위치**: `spec/2-navigation/14-execution-history.md`, §2.4 테이블 직후 `#### Trigger 출처 분류` 헤딩
- **위반 규약**: 규약 직접 위반은 아님. 문서 구조 일관성 관점
- **상세**: `#### Trigger 출처 분류` (H4) 가 `### 2.4 테이블` (H3) 의 소절로 삽입되어 있으나, 다른 파일들의 동급 항목은 대부분 H3 또는 별도 번호 절로 분리된다. `0-dashboard.md` §5 에서 "Trigger 출처 분류 규칙·보조 라벨 정책은 [실행 내역 spec §2.4 Trigger 출처 분류]"로 cross-reference 되므로 anchor 명확성이 중요하다. 현재 anchor slug 는 `trigger-출처-분류`로 생성되어 cross-link는 동작한다.
- **제안**: 현 구조 유지 가능. 다만 중요도가 높은 분류 정책이므로 `### 2.5 Trigger 출처 분류`로 독립 절 승격도 고려 가능.

---

## 요약

`spec/2-navigation/` 의 spec 문서들은 전반적으로 정식 규약의 기본 구조(파일명 `<N>-<slug>.md`, frontmatter `id`/`status`/`code:`, Rationale 섹션, API endpoint 명명 `kebab-case`)를 잘 준수하고 있다. 주요 이슈는 두 가지다. 첫째, `14-execution-history.md` 에서 PRD 요구사항 블록(`## Overview (제품 정의)`)과 spec 본문 (`## 1. 개요`) 이 이중으로 겹치는 구조 혼재 문제가 있다. 둘째, `0-dashboard.md`, `10-auth-flow.md`, `14-execution-history.md` 모두 `status: implemented` 임에도 frontmatter `code:` 경로에 backend 구현 경로가 누락되어 `spec-impl-evidence.md`의 evidence 규약을 완전히 충족하지 못한다. 이 두 WARNING은 구현 착수 전 보정이 권장되나, build-time 가드(`spec-code-paths.test.ts`)의 glob 매칭이 frontend 경로만으로도 ≥1 매치를 충족할 수 있어 테스트를 직접 차단하지는 않을 수 있다. API endpoint 명명과 응답 포맷(`data`/`pagination` 구조)은 `spec/5-system/2-api-convention.md §5.2` 와 일치한다.

---

## 위험도

**LOW**

STATUS: SUCCESS
