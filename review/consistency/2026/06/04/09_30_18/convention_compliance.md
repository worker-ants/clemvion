# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 대상: `spec/5-system/` — `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`
검토 일시: 2026-06-04

---

## 발견사항

### 1. `spec/5-system/1-auth.md`

- **[INFO]** Rationale 섹션 순서 — Rationale 항목이 §5 API 엔드포인트 이후 문서 끝에 배치되어 있다 (CLAUDE.md의 "Overview / 본문 / Rationale 3섹션" 구조에 부합). 위반 없음.

- **[INFO]** 에러 코드 케이스 혼합 — §1.5.4 에러 응답 표에서 코드값이 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 로 **`lower_snake_case`** 로 표기되어 있다.
  - 위반 규약: `spec/conventions/error-codes.md §Overview`, `spec/conventions/node-output.md §3.2` — 에러 코드는 `UPPER_SNAKE_CASE` 를 사용한다.
  - `spec/conventions/error-codes.md` 의 Historical-artifact 레지스트리에 이 코드들은 등재되어 있지 않으므로 예외 면제가 없다.
  - 상세: `invitation_not_found` → `INVITATION_NOT_FOUND`, `invitation_expired` → `INVITATION_EXPIRED`, `invitation_already_used` → `INVITATION_ALREADY_USED`, `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`, `forbidden` 은 이미 `FORBIDDEN` (§1.2) 로 정의된 코드와 일치해야 함, `rate_limited` → `RATE_LIMITED` (§1.1) 참조.
  - 제안: §1.5.4 표의 코드 컬럼 값 전체를 `UPPER_SNAKE_CASE` 로 갱신한다.

- **[INFO]** frontmatter `status: partial` + `pending_plans:` 정합 — 현재 `status: partial` 이고 `pending_plans:` 에 `plan/in-progress/auth-config-webhook-followups.md`, `plan/in-progress/spec-sync-auth-gaps.md` 두 파일이 등재되어 있다. `spec/conventions/spec-impl-evidence.md §3` 기준 partial 상태에서는 `pending_plans:` 의무가 있고 두 파일 모두 실존 의무를 진다. 이는 spec 규약을 충족하는 정상 상태다.

---

### 2. `spec/5-system/10-graph-rag.md`

- **[INFO]** 문서 구조 — Overview 섹션이 `## Overview (제품 정의)` 와 `## 1. 개요` 두 개가 존재한다. CLAUDE.md 의 "Overview / 본문 / Rationale" 3섹션 권장 구조 관점에서 Overview 가 두 곳으로 분리된 형태다. 기능적으로는 문제 없으나 동일 레벨 헤더로 Overview 역할이 중복 표현된다. 향후 통합 검토 권장(INFO 수준).

- **[WARNING]** WebSocket 이벤트 채널 명칭 불일치 — §6 에서 이벤트 채널을 `kb:{documentId}` 로 명시했으나, 채널 명칭에 `documentId` 를 쓰면서 채널 이름 접두를 `kb:` 로 사용하는 것이 동일 문서 참조(`spec/5-system/8-embedding-pipeline.md §8` 와 동일)임을 언급한다. 그런데 `document:graph_*` 이벤트는 문서 단위이므로 채널이 `kb:{documentId}` 인 것은 의미상 부정확할 수 있다 (KB ID가 아닌 documentId 를 채널 키로 쓰면서 접두는 `kb:` 를 사용). 이 불일치가 `8-embedding-pipeline.md §8` 의 기존 패턴에서 그대로 이어진 것이라면 규약 위반이 아니라 레거시 명칭이지만, 신규 구현자가 혼동할 수 있다.
  - 위반 규약: 직접적 명명 규약 위반이 아니라 명세 내 일관성 문제 (의미 모호성).
  - 제안: §6 채널 명칭을 `doc:{documentId}` 또는 `kb:{knowledgeBaseId}` 중 실제 라우팅 기준과 일치하는 것으로 명확화하거나, `8-embedding-pipeline.md` 와 동일 채널인 이유를 한 줄 주석으로 보강한다.

- **[INFO]** frontmatter `status: implemented` + `code:` — `code:` 에 다수의 구현 파일이 명시되어 있다. `spec/conventions/spec-impl-evidence.md §3` 의 `implemented` 상태에서 `code:` glob ≥1 매치 의무를 충족하며 `pending_plans:` 가 비어 있는 것은 정상이다.

---

### 3. `spec/5-system/11-mcp-client.md`

- **[CRITICAL]** `skipReason` vocabulary 표기 규약 위반 — §6.2 에서 `skipReason` 값을 `lower_snake_case` 로 정의하면서 해당 섹션 내 주석에 "본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 `node-output.md Principle 3.2` 의 `code` UPPER_SNAKE_CASE 규약과 구분된다" 고 명시한다. 이 선언은 **규약 갱신(예외 선언)** 이지 기존 규약의 적용 면제 근거가 아니다. `spec/conventions/error-codes.md §Overview` 는 적용 범위를 "프로젝트 전체의 에러 코드 문자열에 적용"이라고 하나, `skipReason` 은 에러 코드가 아닌 운영 메타 enum 으로 명시되어 있어 해당 규약의 **직접 적용 대상이 아님**을 spec 문서가 자체 선언하고 있다. 그러나 `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리`에 이 예외가 **등재되어 있지 않다**.
  - 위반 규약: `spec/conventions/error-codes.md §2 안정성 / rename 정책` 및 §3 레지스트리 — 의도적 예외는 레지스트리에 등재해야 한다. `node-output.md §3.2` 의 `UPPER_SNAKE_CASE` 규약에서의 이탈을 spec 본문에서만 선언하고 `conventions/error-codes.md` 를 갱신하지 않은 상태다.
  - 상세: `skipReason` 이 에러 코드가 아닌 진단 enum 이라는 결정 자체는 타당할 수 있으나, conventions 파일을 갱신하지 않으면 다른 구현자가 동일 패턴을 사용할 때 일관된 기준을 찾을 수 없다.
  - 제안 (둘 중 하나):
    a. `spec/conventions/error-codes.md §3` 레지스트리에 `skipReason` 값(`lower_snake_case` 진단 enum) 을 예외로 등재하고 사유("에러 코드가 아닌 운영 진단 메타 필드, `Integration.status_reason` 와 표기 정합성 목적")를 명시한다.
    b. 또는 `spec/conventions/` 에 "운영 진단 enum 표기 규약" 을 별도 항목으로 신설한다.

- **[WARNING]** 에러 코드 케이스 일관성 — §8.2 에러 코드 vocabulary 표에서 `MCP_CONNECT_FAILED`, `MCP_CALL_FAILED`, `MCP_TIMEOUT` 등은 `UPPER_SNAKE_CASE` 를 올바르게 사용한다. 그러나 같은 섹션에서 `tool_result.error` 에 들어가는 `'INVALID_TOOL_ARGUMENTS'`, `'MCP_RESPONSE_TOO_LARGE'` 와 같이 `UPPER_SNAKE_CASE` 로 표기된 코드들이 `spec/conventions/error-codes.md §1` 의 domain-prefix 원칙 (`<DOMAIN>_<CONDITION>`) 을 따르고 있는지 확인이 필요하다. `INVALID_TOOL_ARGUMENTS` 는 도메인 prefix 없이 범용 코드처럼 작성되어 있으나, `spec/5-system/3-error-handling.md §1.1–1.3` 의 시스템 전역 공용 코드 목록에도 등재되어 있지 않다.
  - 위반 규약: `spec/conventions/error-codes.md §1` — 도메인이 있으면 prefix 사용 권장. `3-error-handling.md §1` 카탈로그 미등재.
  - 제안: `INVALID_TOOL_ARGUMENTS` 를 `MCP_INVALID_TOOL_ARGUMENTS` 로 도메인 prefix 를 부여하거나, 전역 공용 코드로 의도된 것이라면 `spec/5-system/3-error-handling.md §1.3` 에 명시적으로 추가한다.

- **[WARNING]** `status: partial` 에서 `pending_plans:` 의무 확인 — `spec/conventions/spec-impl-evidence.md §3` 에 따르면 `status: partial` 인 spec 에는 `pending_plans:` 가 의무다. 현재 frontmatter 에 `pending_plans: [plan/in-progress/spec-sync-mcp-client-gaps.md]` 가 있어 규약을 충족한다. 단 §6.2 와 §3.3, §8.2 에서 다수의 "미구현 (Planned)" surface 가 명시되어 있어 이 plan 파일이 모든 미구현 surface 를 추적하는지 구현 착수 전에 확인을 권장한다.

- **[INFO]** Internal Bridge 표기 (§2.3) — `Internal Bridge` 용어 및 관련 규칙이 spec 본문에서 정의되고 반복 참조되나, `spec/conventions/` 에 이를 정의하는 별도 컨벤션 파일이 없다. 현재는 단일 문서(본 파일) 내 자체 정의 수준이나, 다른 first-party 통합(Makeshop 등)에서도 동일 패턴을 채택하므로 `spec/conventions/` 로 canonical 정의를 이동할 필요가 있다. 현재 `spec/11-mcp-client.md` 가 사실상 Internal Bridge 패턴의 SoT 역할을 겸하고 있다.

---

## 요약

정식 규약 준수 관점에서 세 문서 중 가장 큰 위험은 `spec/5-system/11-mcp-client.md` 의 `skipReason` 예외 미등재(CRITICAL)다. 이 예외는 spec 본문 내에서 자체 선언되어 있으나 `spec/conventions/error-codes.md §3` 레지스트리에 반영되지 않아, 다른 구현자가 같은 패턴을 적용할 때 일관성 기준이 없다. `spec/5-system/1-auth.md` 의 초대 에러 코드 `lower_snake_case` (INFO 수준) 와 `11-mcp-client.md` 의 `INVALID_TOOL_ARGUMENTS` 도메인 prefix 부재(WARNING)는 에러 코드 명명 규약의 부분적 불일치다. 세 문서 모두 `spec-impl-evidence.md` frontmatter 규약은 올바르게 따르고 있으며, 문서 구조(Overview/본문/Rationale)도 대체로 준수한다.

## 위험도

MEDIUM
