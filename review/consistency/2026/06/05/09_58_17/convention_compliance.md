# 정식 규약 준수 검토 결과

**검토 모드**: 구현 완료 후 검토 (`--impl-done`, `scope=spec/5-system/`, `diff-base=origin/main`)
**검토 대상**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
**검토 일시**: 2026-06-05

---

## 발견사항

### [INFO] `1-auth.md` — Rationale 섹션의 번호 체계가 문서 본문 번호와 불일치
- target 위치: `spec/5-system/1-auth.md` `## Rationale` 섹션
- 위반 규약: `CLAUDE.md` "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 구조 권장
- 상세: Rationale 항목 레이블이 `1.5.A`, `1.5.B`, `1.5.C`, `1.4.A`~`1.4.I` 처럼 역순으로 배치되어 있다(1.5.x 먼저, 1.4.x 나중). 문서 본문 섹션은 §1.1→§1.2→§1.3→§1.4→§1.5 순서인데, Rationale 은 §1.5 항목이 §1.4 항목보다 앞에 놓여 있어 참조 탐색이 비직관적이다.
- 제안: Rationale 항목을 문서 본문의 섹션 번호 순(1.4.x → 1.5.x)으로 재정렬하거나, 정렬 무관 참조를 의도한 경우 명시적 주석을 추가.

### [INFO] `1-auth.md` — `§1.5.4` 에러 코드가 `lower_snake_case` 사용
- target 위치: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표의 코드 컬럼
- 위반 규약: `spec/conventions/error-codes.md` §1 및 `spec/conventions/node-output.md` Principle 3.2 — 에러 코드는 `UPPER_SNAKE_CASE`
- 상세: 초대 토큰 에러 코드가 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 등 lower_snake_case 로 표기되어 있다. 프로젝트 전체 에러 코드 표기 규약은 `UPPER_SNAKE_CASE`(`VALIDATION_ERROR`, `WEBAUTHN_DISABLED` 등)이며, 같은 §5 API 엔드포인트 표에서도 `WEBAUTHN_DISABLED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID` 등 대문자 코드가 사용된다.
- 제안: 초대 에러 코드를 `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_USED`, `INVITATION_EMAIL_MISMATCH`, `FORBIDDEN`, `RATE_LIMITED` 로 변경. 이미 구현된 코드 문자열이 있다면 `error-codes.md §3` historical-artifact 예외 레지스트리에 등재 후 신규 코드부터 대문자 적용.

### [WARNING] `10-graph-rag.md` — 문서 구조가 Overview / 본문 / Rationale 3섹션 중 Overview 섹션이 본문과 혼재
- target 위치: `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 이후 `### 1. 목표`~`### 8. 미결/후속검토` 가 Overview 안에 중첩, 이후 `## 1. 개요`~`## 8. 비-목표`가 본문으로 별도 존재
- 위반 규약: `CLAUDE.md` "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: spec 구조가 `## Overview (제품 정의)` 아래에 `### 1. 목표`, `### 2. 범위`, `### 3. 요구사항`, `### 4. 기술 결정 사항`, `### 5. 비기능 요구사항`, `### 6. 단계별 도입`, `### 7. 의존성`, `### 8. 미결/후속검토` 라는 대형 섹션 트리를 중첩한 뒤, 같은 레벨에서 다시 `## 1. 개요`~`## 8. 비-목표`를 두고 있다. Overview 안의 섹션 트리(요구사항·기술 결정 등)는 사실상 spec 본문에 해당하는 내용을 Overview 아래에 묻어두어, 본문과 역할이 중첩된다. 최상위 섹션이 `Overview(제품 정의) > 본문 상당 내용 + 별도 기술 본문` 이중 구조로 가독성과 참조 일관성이 낮다.
- 제안: `## Overview` 를 실제 제품 정의/목적/범위 요약 수준으로 유지하고, 요구사항(`KB-GR-*`) 표·기술 결정·Phase Plan·의존성 섹션은 `## 1. ...` ~ `## 8. ...` 본문 영역으로 이동. 또는 현행 `## 1. 개요`~`## 8. 비-목표`를 제거하고 Overview 안 콘텐츠를 본문으로 flatten. 두 방향 모두 3섹션 구조에 부합.

### [INFO] `10-graph-rag.md` — `## Rationale` 의 계층 구조가 단일 "기획 결정" 메가 섹션으로 과밀
- target 위치: `spec/5-system/10-graph-rag.md` `## Rationale` → `### Graph RAG 기획 결정` → `#### 도메인 용어` / `#### 사용자 결정` / `#### 결정 근거 (요약)` / `#### 비-목표 (범위 밖)`
- 위반 규약: `CLAUDE.md` "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 권장 구조
- 상세: `## Rationale` 안에 도메인 용어, 사용자 결정 표, 결정 근거 요약, 비-목표가 단일 대형 서브섹션(`### Graph RAG 기획 결정`) 아래 집적되어 있다. `비-목표` 는 이미 본문 `## 8. 비-목표`에 중복 기술되어 있어 Rationale 에 또 등장한다. 다른 spec (`1-auth.md`)는 Rationale 을 결정별 독립 `###` 항목으로 운영하는 패턴.
- 제안: 비-목표 중복 제거. 도메인 용어는 본문 Glossary 또는 Overview 로 이동. Rationale 은 결정별 독립 서브섹션(`### PostgreSQL 선택 이유`, `### 자동 chained 추출 선택` 등)으로 분리.

### [WARNING] `11-mcp-client.md` — `mcpDiagnostics.skipReason` vocabulary 가 `lower_snake_case` 인데, 이를 별도 규약 근거 없이 inline 선언
- target 위치: `spec/5-system/11-mcp-client.md` §6.2 진단 누적 — `skipReason vocabulary` 표
- 위반 규약: `spec/conventions/error-codes.md` §1 (에러 코드 전체 `UPPER_SNAKE_CASE`). `node-output.md` Principle 3.2 (`code` 는 `UPPER_SNAKE_CASE`).
- 상세: spec 본문이 "명명 규칙 분리" 노트에서 "`skipReason` 값은 모두 `lower_snake_case` 다. 본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 구분된다"라고 명시적으로 해명하고 있다. 단, 이 해명은 spec 본문 인라인에만 존재하고 `spec/conventions/error-codes.md` 의 예외 레지스트리(§3)에 등재되지 않았다. `skipReason` 이 "에러 코드가 아니라 운영 진단 enum"이라는 의미 경계는 규약 파일이 아닌 spec 구현 문서 안에만 기술되어 있어, 타 개발자가 규약 파일만 참조할 때 이 구분이 보이지 않는다.
- 제안: `spec/conventions/error-codes.md` §3 historical-artifact 예외 레지스트리 또는 별도 "비-에러코드 진단 enum 명명 예외" 섹션에 `skipReason` 의 `lower_snake_case` 채택 근거와 적용 범위(mcpDiagnostics.skipReason + Integration.status_reason 의미 일치 의도)를 등재. 또는 규약 §1 에 "에러 코드(`code`)와 구별되는 운영 진단 enum 은 소속 컨텍스트에서 명시적으로 lower_snake_case 허용 선언 가능" 조항을 추가.

### [INFO] `11-mcp-client.md` — `## 1. 개요` 섹션이 Overview 섹션 역할을 하면서도 명시적 `## Overview` 가 없음
- target 위치: `spec/5-system/11-mcp-client.md` 전체 구조 — `## 1. 개요`, 이후 `## 2. Transport` ~ `## 8. 에러 처리`, `## Rationale` 부재
- 위반 규약: `CLAUDE.md` "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: `spec/5-system/11-mcp-client.md` 는 `## 1. 개요` 를 포함하지만 명시적인 `## Overview` 섹션이 없다. `_product-overview.md` 에 링크된 제품 개요 맥락에서 `## Overview`(제품 정의 섹션)가 빠져 있다. 또한 문서 끝에 `## Rationale` 섹션이 없어 설계 결정 근거(예: Streamable HTTP 선택, Internal Bridge 도입, `skipReason lower_snake_case` 예외 등)가 `stdio 미지원 사유`(§2.2) · `capabilities 캐시 (미구현 Planned)` 주석 형태로 본문에 산재해 있다.
- 제안: 문서 앞에 `## Overview` 섹션을 신설해 제품 정의 요약을 두고, 현행 §2.2 · §4 등에 산재한 설계 결정 근거들을 문서 말미 `## Rationale` 로 이동하는 것을 검토.

### [INFO] `1-auth.md` — `_product-overview.md` 링크가 본문 첫 줄에 있으나 해당 파일은 `## Overview` 섹션을 보유하지 않음
- target 위치: `spec/5-system/1-auth.md` 첫 줄 링크 `[PRD 비기능 요구사항](./_product-overview.md#2-보안)`
- 위반 규약: `CLAUDE.md` "제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
- 상세: `spec/5-system/_product-overview.md` 는 `## 1. 성능`, `## 2. 보안` 등 비기능 요구사항 표를 직접 나열하는 구조로, `## Overview` 섹션(제품 정의 요약)이 없다. CLAUDE.md 는 `_product-overview.md` 가 `## Overview` 섹션을 보유하거나 진입 문서의 `## Overview` 를 통해 제품 정의가 접근 가능해야 함을 권장한다.
- 제안: `spec/5-system/_product-overview.md` 에 `## Overview` 섹션을 추가해 5-system 영역의 제품 정의 요약을 제공. 또는 현행 구조를 유지하면서 CLAUDE.md 를 "system 비기능 요구사항은 Overview 없는 테이블 형태도 허용" 으로 명확화.

---

## 요약

`spec/5-system/` 영역의 세 문서는 frontmatter `id`/`status`/`code:`/`pending_plans:` 규약(`spec-impl-evidence.md`)을 정확하게 준수하고 있으며, 에러 코드 상당수는 `UPPER_SNAKE_CASE` 를 따른다. 가장 주목할 위반은 두 가지다. 첫째, `1-auth.md` §1.5.4 초대 에러 코드들이 `lower_snake_case` 로 표기되어 `error-codes.md` 와 `node-output.md` Principle 3.2 의 `UPPER_SNAKE_CASE` 에러 코드 표기 규약을 직접 위반한다(WARNING 수준). 둘째, `11-mcp-client.md` 의 `skipReason lower_snake_case` 예외가 spec 본문 인라인에만 해명되고 `spec/conventions/error-codes.md` 예외 레지스트리에 미등재되어 있어 규약과의 거리감이 있다(WARNING 수준). `10-graph-rag.md` 는 Overview/본문/Rationale 3섹션 구조 권장을 부분적으로 따르지 않아 문서 내부 이중 구조가 발생했고(WARNING), `11-mcp-client.md` 는 `## Rationale` 섹션 자체가 없다(INFO). 전체적으로 규약의 핵심 invariant(frontmatter, 주요 에러 코드 표기, API 응답 봉투)는 잘 준수되고 있으나, 에러 코드 표기 일관성과 예외 레지스트리 미등재 항목이 실질적 위험으로 식별된다.

## 위험도

MEDIUM

---

_SoT 참조: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/conventions/error-codes.md`, `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/conventions/node-output.md`, `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/conventions/spec-impl-evidence.md`, `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/conventions/swagger.md`_
