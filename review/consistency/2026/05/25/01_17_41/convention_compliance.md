# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/5-system/)
검토 일시: 2026-05-25
대상 문서: spec/5-system/1-auth.md, spec/5-system/10-graph-rag.md, spec/5-system/11-mcp-client.md (+ 부분 노출된 cafe24 API catalog 항목)

---

## 발견사항

### [CRITICAL] 초대 에러 코드가 `snake_case` — `node-output.md` Principle 3.2 위반

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 테이블
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — "`code` 는 `UPPER_SNAKE_CASE`"
- **상세**: §1.5.4의 에러 코드가 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 처럼 모두 `lower_snake_case` 로 작성되어 있다. node-output.md Principle 3.2는 `output.error.code` 를 `UPPER_SNAKE_CASE` 로 명시한다. 같은 파일의 다른 곳(§1.4.3 WebAuthn 관련)에서는 `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `CHALLENGE_INVALID`, `RECOVERY_CODE_INVALID`, `WEBAUTHN_INVALID`, `WEBAUTHN_COUNTER_REGRESSION` 처럼 `UPPER_SNAKE_CASE` 를 일관되게 사용하고 있어 같은 파일 안에서도 표기가 불일치한다.
- **제안**: §1.5.4 테이블의 에러 코드를 다음과 같이 수정한다.
  - `invitation_not_found` → `INVITATION_NOT_FOUND`
  - `invitation_expired` → `INVITATION_EXPIRED`
  - `invitation_already_used` → `INVITATION_ALREADY_USED`
  - `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`
  - `forbidden` → `FORBIDDEN`
  - `rate_limited` → `RATE_LIMITED`

---

### [CRITICAL] `spec/5-system/1-auth.md` — `status: spec-only` 이고 `code: []` 이지만 실제 구현이 이미 존재

- **target 위치**: `spec/5-system/1-auth.md` frontmatter (`status: spec-only`, `code: []`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 라이프사이클 — "`spec-only` → `partial`: 최초 코드 머지 시점에 승격" + `spec-impl-evidence.md` §2.1 의무 필드 의미
- **상세**: 파일 본문에 `codebase/backend/src/modules/auth/webauthn/webauthn.config.ts`, `codebase/backend/migrations/README.md §1`, `codebase/backend/migrations/V058` 등 이미 구현이 존재함을 확인하는 구체적 경로가 여럿 언급된다. Rationale §1.4.G 에서는 "V058 은 이미 production에 적용됐다"고 명시하고, §1.4.H 에서는 `auth/webauthn/webauthn.service.ts`, `auth/webauthn/webauthn.module.ts` 등 실존 경로 이동 이력을 기술한다. 최소한 `status: partial` 이상이어야 하며, 인증/WebAuthn 구현이 완료된 경우 `status: implemented` 가 적절하다.
- **제안**: 구현 완료 경로를 점검한 뒤 `status: partial` 또는 `status: implemented` 로 승격하고, `code:` 필드에 `codebase/backend/src/modules/auth/**` 등 실증 경로를 채운다. 구현 미완 surface 가 있다면 해당 plan 을 `pending_plans:` 에 등록한다.

---

### [WARNING] `spec/5-system/1-auth.md` — `## Overview` 섹션 누락

- **target 위치**: `spec/5-system/1-auth.md` 전체 문서 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 — 제품 정의·요구사항은 `## Overview` 에 위치
- **상세**: `spec/5-system/1-auth.md` 는 `## Rationale` 섹션은 보유하지만 `## Overview` 섹션이 없다. `spec/5-system/10-graph-rag.md` 가 `## Overview (제품 정의)` 를 최상단에 두고 이후 본문을 구성하는 것과 대비된다. auth spec 의 경우 `## 1. 인증 (Authentication)` 이 사실상 Overview를 겸하지만 관례화된 섹션 헤딩이 아니다.
- **제안**: 문서 최상단(`---` 구분선 이후, `## 1. 인증` 이전)에 `## Overview` 섹션을 추가해 인증 시스템의 목적·범위를 간단히 기술한다. 규약상 "권장" 사항이므로 CRITICAL 은 아니나 일관성을 위해 보완을 권고한다.

---

### [WARNING] `spec/5-system/11-mcp-client.md` — `status: spec-only` 이고 `code: []` 이지만 실제 구현 경로가 본문에 언급

- **target 위치**: `spec/5-system/11-mcp-client.md` frontmatter (`status: spec-only`, `code: []`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 라이프사이클
- **상세**: §2.3 Internal Bridge 본문에서 `Cafe24McpBridge` 구현, §10 에서 `@modelcontextprotocol/sdk` 의존성, `McpClientModule` 등이 구현 완료된 것처럼 기술되어 있다. `spec-only` 는 "구현 의도가 결정됐으나 코드가 없음" 상태인데, Cafe24 Internal Bridge 가 이미 구현됐다면 `partial` 로 승격이 필요하다.
- **제안**: 실제 코드 존재 여부를 확인한 뒤 — Cafe24 MCP bridge 구현이 머지됐다면 `status: partial` 로 승격하고 `code:` 와 `pending_plans:` 를 채운다. 아직 완전 미구현이라면 `status: spec-only` 유지가 맞으나 본문의 서술 방식("구현됐다"는 현재 시제)을 미래 계획형으로 바꿀 필요가 있다.

---

### [WARNING] `spec/5-system/1-auth.md` §1.5.4 — HTTP 410 코드에 대한 응답 포맷이 `data: { message }` 래퍼 규약과 불일치 가능성

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 테이블 및 §1.1.A 응답 동일성 원칙
- **위반 규약**: `spec/conventions/swagger.md` §2-5 응답 wrapping — "모든 성공 응답을 `{ data: ... }` 로 감쌉니다"
- **상세**: §1.1.A 에서 forgot-password 의 성공 응답이 `200 { data: { message } }` 형식으로 명시되어 `TransformInterceptor` 래퍼와 정합한다. 그러나 §1.5.4 의 에러 응답 테이블은 HTTP 상태코드와 에러 코드만 나열하고 실제 응답 body 포맷(GlobalExceptionFilter 의 `ErrorResponseDto` 구조)을 명시하지 않는다. 다른 에러에서는 `code` 가 `UPPER_SNAKE_CASE` 인데 초대 에러는 그렇지 않아 GlobalExceptionFilter 와의 실제 일치 여부가 불분명하다.
- **제안**: §1.5.4 에 GlobalExceptionFilter / `ErrorResponseDto` 의 포맷 (예: `{ error: { code, message, statusCode } }`) 을 한 줄이라도 명시하거나, swagger.md §5-5 의 `ErrorResponseDto` 참조를 추가한다.

---

### [WARNING] `spec/5-system/10-graph-rag.md` — `## Overview` 와 `## 1. 개요` 이중 존재

- **target 위치**: `spec/5-system/10-graph-rag.md` 의 `## Overview (제품 정의)` (line ~613)와 `## 1. 개요` (line ~790)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 이 구조는 Overview → 본문 → Rationale 의 선형 배치를 상정한다
- **상세**: 문서에 `## Overview (제품 정의)` 가 먼저 등장한 뒤 요구사항·Phase Plan 등 본문 섹션들이 이어지고, 맨 끝에 `## Rationale` 이 있다. 그러나 본문 중간에 다시 `## 1. 개요` 섹션이 나타나며 추출 파이프라인의 기술적 개요를 반복한다. 이는 Overview / 본문 / Rationale 3섹션 원칙에서 개요가 두 곳에 분산되는 구조 중복이다.
- **제안**: `## 1. 개요` 를 `## 3. 기술 아키텍처` 또는 `## 기술 상세` 등으로 헤딩을 바꿔 Overview 와의 의미 중복을 해소하거나, `## Overview (제품 정의)` 와 통합하여 단일 개요 섹션으로 병합한다.

---

### [WARNING] `spec/5-system/11-mcp-client.md` — `## Overview` 섹션 누락

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 제품 정의는 `## Overview` 에 위치
- **상세**: MCP 클라이언트 spec 에는 `## 1. 개요` 가 있으나 관례화된 `## Overview` 헤딩이 없다. `## Rationale` 섹션도 없다. Graph RAG spec 이 `## Overview (제품 정의)` 와 `## Rationale` 를 모두 보유하는 것과 대비된다.
- **제안**: 현재 `## 1. 개요` 를 `## Overview` 로 rename 하거나 Overview 섹션으로 추출한다. 또한 §8 이후 설계 결정 근거들을 `## Rationale` 섹션 아래로 이동시켜 3섹션 구조를 완성한다.

---

### [WARNING] `spec/5-system/11-mcp-client.md` `mcpDiagnostics.skipReason` — `lower_snake_case` 사용에 대한 규약 명시 방식

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 `skipReason vocabulary`
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`
- **상세**: spec 본문은 "skipReason 값은 모두 `lower_snake_case` 다 — 에러 코드가 아닌 운영 진단용 enum 이라 node-output.md Principle 3.2의 UPPER_SNAKE_CASE 규약과 구분된다"고 명시적으로 기술하여 의도적 예외임을 밝혔다. 이 설명 자체는 올바른 방향이나, 예외 처리 방식이 spec 문서 내 인라인 주석으로만 선언되어 있어 규약 차원의 공식 예외 등록 없이 적용된다.
- **제안**: node-output.md Principle 3.2에 "운영 진단용 internal enum (`skipReason` 등)은 `Integration.status_reason` 표기와 일치시키기 위해 `lower_snake_case` 를 허용" 한 줄 추가하거나, mcp-client.md Rationale 에 이 결정 근거를 별도 항목으로 형식화한다. 현재 상태는 인라인 주석 수준이라 추후 일관성 검토에서 재발견될 가능성이 있다.

---

### [INFO] `spec/5-system/1-auth.md` §4.1 감사 로그 액션명 — 대소문자 혼용

- **target 위치**: `spec/5-system/1-auth.md` §4.1 기록 대상 액션 테이블
- **위반 규약**: 직접 명시된 규약은 없으나, node-output.md Principle 3.2 의 에러 코드 `UPPER_SNAKE_CASE` 와 비교해 표기 일관성 관점에서 검토 필요
- **상세**: 감사 로그 액션이 `password_change`, `2fa_enable/disable`, `workspace.create`, `workflow.execute` 등 `snake_case` 와 `.` 조합으로 혼용된다. 단일 표기 방식이 conventions 에 정의되지 않은 상태다.
- **제안**: 감사 로그 액션명 표기 규칙을 spec/conventions 에 추가하거나, 본 문서 내에서 `verb_noun` 또는 `noun.verb` 둘 중 하나로 통일한다. 현재 상태에서는 구현 팀마다 다르게 해석할 여지가 있다.

---

### [INFO] `spec/5-system/10-graph-rag.md` — `code:` 필드에 프론트엔드 컴포넌트 경로가 파일명 오타 위험

- **target 위치**: `spec/5-system/10-graph-rag.md` frontmatter `code:` 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 — "`code:` 글로브가 ≥1 파일 매치" 의무 (`status: implemented` 일 때)
- **상세**: `code:` 에 `codebase/frontend/src/components/knowledge-base/graph-3d-renderer.tsx`, `entity-list.tsx`, `relation-list.tsx` 가 명시 경로로 등재되어 있다. 경로가 정확히 일치해야 가드 통과인데, 파일 이동·rename 시 가드가 빌드 실패로 즉시 발견한다. 문제는 아니지만, 영역 글로브(`codebase/frontend/src/components/knowledge-base/**`) 로 표기하면 파일명 변경에도 유연하다.
- **제안**: 파일 안정성이 확보된 경우 유지해도 무방하나, 리팩터링이 예상된다면 `codebase/frontend/src/components/knowledge-base/**` 글로브로 교체를 검토한다.

---

## 요약

검토 대상 `spec/5-system/` 의 세 문서(1-auth.md, 10-graph-rag.md, 11-mcp-client.md) 전반에서 정식 규약 준수 수준은 대체로 양호하나, 두 가지 CRITICAL 위반이 발견되었다. 첫째, `1-auth.md §1.5.4` 의 초대 관련 에러 코드가 `lower_snake_case` 로 작성되어 `node-output.md` Principle 3.2 의 `UPPER_SNAKE_CASE` 의무를 어긴다(같은 파일 내 WebAuthn 에러 코드는 UPPER_SNAKE_CASE 인 것과도 불일치). 둘째, `1-auth.md` 가 `status: spec-only / code: []` 를 선언하지만 본문에서 V058 마이그레이션·WebAuthn 모듈 이동 등 이미 구현 완료된 사실을 다수 기술하여 `spec-impl-evidence.md` 의 라이프사이클 규약을 위반한다. WARNING 수준으로는 모든 대상 문서에서 `## Overview` 또는 `## Rationale` 3섹션 구조가 부분 또는 완전히 누락된 점, `11-mcp-client.md` 의 frontmatter status 가 구현 현황을 반영하지 못하는 점, `skipReason lower_snake_case` 예외가 conventions 에 공식 등록되지 않은 점이 지적된다. 전반적으로 에러 코드 표기와 frontmatter status 관리가 가장 시급한 보완 대상이다.

## 위험도

HIGH
