# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
검토 기준: `spec/conventions/` 전체

---

## 발견사항

### 에러 코드 / 출력 포맷 규약

- **[INFO]** `spec/5-system/1-auth.md §1.5.4` — invitation 에러 코드 `lower_snake_case` 유지
  - target 위치: `1-auth.md §1.5.4` 에러 응답 표 및 §1.5.4 명명 주석
  - 위반 규약: `spec/conventions/error-codes.md §1` (UPPER_SNAKE_CASE 원칙)
  - 상세: `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 가 `lower_snake_case`. 단, 1-auth.md §1.5.4 자체에 명시적 주석("명명 — historical-artifact 예외")이 있고 `error-codes.md §3` 레지스트리에 이미 등재된 known exception이다.
  - 제안: 신규 구현 시 이 코드들을 선례 삼아 lowercase 코드를 추가하지 말 것. 현 문서 상태는 규약 준수 — 추가 조치 불필요.

- **[INFO]** `spec/5-system/11-mcp-client.md §6.2` — `skipReason` 값이 `lower_snake_case`
  - target 위치: `11-mcp-client.md §6.2` skipReason vocabulary 표 및 명명 규칙 분리 주석
  - 위반 규약: `spec/conventions/node-output.md §3.2` (`code` 필드는 UPPER_SNAKE_CASE)
  - 상세: `skipReason` 은 `code` 필드가 아닌 운영 진단용 enum으로 명시적으로 `lower_snake_case` 를 채택했으며, 이를 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 구분한다는 설명이 문서 안에 포함되어 있다 (`Integration.status_reason` 과 의도적 표기 일치). 이 설명이 명확히 기술되어 있으므로 위반이 아닌 의도된 예외다.
  - 제안: 현 문서 상태는 적절히 설명됨. 단, `error-codes.md §3` historical-artifact 레지스트리에 `skipReason` 의 lower_snake_case 예외를 명시적으로 등재하는 것을 고려할 수 있다(현재 미등재) — 향후 혼동 방지 목적.

---

### 문서 구조 규약

- **[INFO]** `spec/5-system/10-graph-rag.md` — Overview 섹션이 `## Overview (제품 정의)` 라는 표제를 사용하며 본문 앞 배너(구현 상태) 포함
  - target 위치: `10-graph-rag.md §Overview` 및 이후 본문 `## 1. 개요`
  - 위반 규약: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
  - 상세: CLAUDE.md 는 "Overview / 본문 / Rationale 3섹션 권장" 을 권고하며, 10-graph-rag.md 는 `## Overview (제품 정의)` 다음에 다시 `## 1. 개요` 라는 중복 구조를 가진다. 두 섹션이 각각 다른 내용(PRD 성격 vs 기술 구현 개요)을 담고 있어 의도적인 구분으로 해석 가능하나, 표준 3섹션 구조에서는 Overview 하나로 통합하는 것이 권장된다.
  - 제안: WARNING 으로 올릴 정도는 아니지만, 구현 착수 시 `## 1. 개요` 를 Overview 안으로 통합하거나 본문 소절 번호를 재정렬하는 것을 고려. 현재 기능적으로는 문제없음.

- **[INFO]** `spec/5-system/11-mcp-client.md` — `## 1. 개요` 섹션이 Overview 라벨 없이 시작
  - target 위치: `11-mcp-client.md §1. 개요`
  - 위반 규약: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션
  - 상세: 1-auth.md 와 11-mcp-client.md 모두 명시적 `## Overview` 섹션 없이 본문 섹션(`## 1. 인증`, `## 1. 개요`)으로 바로 시작한다. 관련 문서 링크 블록이 Overview 역할을 대신한다. CLAUDE.md 는 "권장" 사항이므로 CRITICAL/WARNING 수준은 아니다.
  - 제안: 현 구조가 기능적으로 충분하며 기존 패턴과도 일치함. 조치 불필요.

---

### 출력 포맷 규약

- **[WARNING]** `spec/5-system/11-mcp-client.md §6.2` — `mcpDiagnostics` 대부분 필드가 미구현(Planned)이지만 spec에 정규 형태로 기술됨
  - target 위치: `11-mcp-client.md §6.2` (mcpDiagnostics 예시 JSON, 필드 표)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 시 `pending_plans:` 의무
  - 상세: `11-mcp-client.md` frontmatter 는 `status: partial` 에 `pending_plans: [plan/in-progress/spec-sync-mcp-client-gaps.md]` 를 올바르게 포함한다. 단 §6.2 내부에서 "미구현 (Planned)" 으로 명시된 필드들(`attempted`, `serverCount`, `toolCalls`, `resourceReads`, `promptGets`, `errors[]`)이 spec 본문에 정규 JSON 예시로 기술되어 있어, 구현자가 이를 모두 구현해야 할 완성 스펙으로 오해할 수 있다. 미구현임이 명시된 점은 규약을 따르지만, 구현 체크리스트 측면에서 주의가 필요하다.
  - 제안: §6.2 서두에 미구현 필드 목록을 bullet으로 명시적으로 분리하는 것을 고려. 현재 산문 안에 "미구현" 언급이 있지만 구현 착수 전 빠르게 확인하기 어렵다. 규약 위반은 아니나 명확성 향상 권고.

---

### API 문서 규약 (Swagger / DTO 패턴)

- **[INFO]** `spec/5-system/1-auth.md §5` API 엔드포인트 표 — 일부 엔드포인트 설명에 HTTP 응답 코드 직접 언급
  - target 위치: `1-auth.md §5` 표, 특히 WebAuthn 엔드포인트 행들
  - 위반 규약: `spec/conventions/swagger.md §2-4` (상태 코드 응답 규칙은 `@ApiXxxResponse` 데코레이터로 컨트롤러에서 처리)
  - 상세: spec 문서에서 HTTP 응답 코드를 직접 기술하는 것(예: "실패: 400 `WEBAUTHN_VERIFY_FAILED`", "201 Created" 등)은 Swagger 데코레이터 규약과 중복이 아니라 spec 수준의 계약 명세이므로, 이는 swagger.md 위반이 아니다. Swagger 규약은 코드베이스의 컨트롤러 파일에 적용된다. 오해 방지 목적으로 기록.
  - 제안: 조치 불필요.

---

### 명명 규약

- **[INFO]** `spec/5-system/10-graph-rag.md §5.1` — API 경로 `re-extract` 사용 (kebab-case)
  - target 위치: `10-graph-rag.md §5.1` 및 §3.4
  - 위반 규약: 해당 경로 명명 규약은 `spec/conventions/` 에 명시적 API path 케이스 규칙이 별도로 없음 (node-output.md 는 출력 변수 규약, error-codes.md 는 에러 코드 규약)
  - 상세: `POST /api/knowledge-bases/:id/documents/:docId/re-extract` 에서 `re-extract` 가 kebab-case 이다. 기존 API 컨벤션(`spec/5-system/2-api-convention.md`)을 별도 검토해야 하나, 해당 파일은 이번 검토 범위에 포함되지 않았다. 일반적으로 REST API path segment 는 kebab-case 가 관용적이므로 문제가 없을 가능성이 높다.
  - 제안: `spec/5-system/2-api-convention.md` 의 경로 명명 규칙을 구현 착수 전 확인 권장.

- **[INFO]** `spec/5-system/11-mcp-client.md §5.2` — 도구 이름 `mcp_<sid>__<toolName>` double-underscore 구분자
  - target 위치: `11-mcp-client.md §5.2` 도구 이름 규칙
  - 위반 규약: `spec/conventions/node-output.md §6` (동적 포트 ID 네이밍 — `<prefix>_<index>` 형식)
  - 상세: MCP 도구 이름의 `__` (double underscore) 는 server-tool 구분 목적으로 명시적으로 채택된 것이며, §6의 동적 포트 ID 네이밍(`<prefix>_<index>`)과 충돌하지 않는다. MCP 도구 이름은 LLM API 에 전달되는 외부 계약 식별자이지 내부 포트 ID가 아니다. 설계 근거가 문서에 명확히 기술되어 있다.
  - 제안: 조치 불필요.

---

### 금지 항목 확인

- **[INFO]** `spec/5-system/10-graph-rag.md` — Overview 섹션 내 "구현 상태" 배너 포함
  - target 위치: `10-graph-rag.md §Overview` 첫 블록인용
  - 위반 규약: 명시적 금지 항목 없음. CLAUDE.md "문서 구조 규약"은 3섹션 "권장"
  - 상세: `> **구현 상태**: ✅ **P0~P2 구현 완료**...` 형식의 블록 인용이 Overview 안에 포함되어 있다. 이는 관용적으로 허용되는 패턴이며 spec-impl-evidence.md 의 `status: implemented` frontmatter 와 정합한다.
  - 제안: 조치 불필요.

---

## 요약

`spec/5-system/` 의 세 대상 문서(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)는 `spec/conventions/` 정식 규약을 전반적으로 잘 준수하고 있다. 에러 코드 명명(`invitation_*` lower_snake_case)과 `skipReason` lower_snake_case는 모두 문서 안에 명시적 근거와 함께 의도된 예외로 처리되어 있어 신규 구현이 이를 선례 삼아 확산시키지 않으면 문제없다. Frontmatter (`id`, `status`, `code`, `pending_plans`)는 spec-impl-evidence.md 규칙에 따라 올바르게 기술되어 있으며, 특히 partial 상태 문서들의 pending_plans 참조도 적절하다. 문서 구조(Overview/본문/Rationale 3섹션)는 권장 수준이며 기능적으로는 현재 형태가 충분하다. CRITICAL 또는 blocking WARNING 은 없다.

## 위험도

LOW
