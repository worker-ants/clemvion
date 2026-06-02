# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**검토 범위**: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 12-webhook.md)
**검토 기준**: `spec/conventions/` 전체 + CLAUDE.md 문서 구조 규약

---

## 발견사항

### [WARNING] `spec/5-system/1-auth.md` — 에러 코드 일부가 `lower_snake_case` 표기

- **target 위치**: `1-auth.md §1.5.4 에러 응답` 표
- **위반 규약**: `spec/conventions/error-codes.md §1` 및 `spec/conventions/node-output.md Principle 3.2` — 에러 코드는 `UPPER_SNAKE_CASE`
- **상세**: 초대 관련 에러 코드가 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 처럼 `lower_snake_case` 로 표기되어 있다. 동일 spec 의 다른 에러 코드들(`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID` 등)은 `UPPER_SNAKE_CASE` 를 따르고 있어 동일 문서 내 불일치가 존재한다.
- **제안**: `invitation_not_found` → `INVITATION_NOT_FOUND`, `invitation_expired` → `INVITATION_EXPIRED`, `invitation_already_used` → `INVITATION_ALREADY_USED`, `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`, `forbidden` → `FORBIDDEN` (이미 `spec/5-system/3-error-handling.md §1.2` 에 존재), `rate_limited` → `RATE_LIMITED` (`3-error-handling.md §1.1` 의 `RATE_LIMITED` 와 일치) 로 표기 수정.

---

### [WARNING] `spec/5-system/10-graph-rag.md` — 문서 구조: Overview 섹션이 본문 흐름과 혼재

- **target 위치**: `10-graph-rag.md` — `## Overview (제품 정의)` 섹션 이후 `### 1. 목표`, `### 2. 범위` 등이 Overview 하위에 위치하고, 이후 `## 1. 개요`, `## 2. 데이터 모델` 등 본문 섹션이 다시 시작됨
- **위반 규약**: CLAUDE.md "문서 구조 규약" — spec 문서 3섹션 권장 구성 (Overview / 본문 / Rationale)
- **상세**: `## Overview` 아래 전체 PRD 목표/범위/요구사항/단계별 계획이 포함되어 있고, 그 아래 동일 계층에서 기술 명세 본문(`## 1. 개요`)이 다시 시작되는 구조다. 이 때문에 `## Overview` 와 본문의 `## 1. 개요` 가 내용적으로 중복 진입점이 된다. 구현자가 spec 의 기술적 의무 경계를 오독할 위험이 있다.
- **제안**: Overview 섹션은 제품 가치·목표·범위 요약만 담고, `## 1. 개요` 이하를 본문 시작으로 명확히 구분. 또는 Overview 하위의 요구사항 표(§3 전체)를 본문으로 이동하여 Overview 를 간결하게 유지.

---

### [WARNING] `spec/5-system/10-graph-rag.md` — `## Rationale` 내 도메인 용어 정의·비목표 중복 기술

- **target 위치**: `10-graph-rag.md §Rationale` — `Graph RAG 기획 결정` 하위의 `도메인 용어`, `비-목표 (범위 밖)` 항목
- **위반 규약**: CLAUDE.md "정보 저장 위치" — 결정의 배경·근거는 `## Rationale` 에 기록. 제품 정의·범위·도메인 용어는 Overview 또는 본문에 위치해야 한다.
- **상세**: Rationale 섹션 안에 도메인 용어 정의(`Graph RAG`, `Entity`, `Relation`, `ChunkEntity`, `KB.rag_mode` 등)가 기술되어 있어 Rationale 의 "결정 근거" 목적과 맞지 않는다. 또한 `비-목표` 가 이미 `§8. 비-목표` 본문에 있는데 Rationale 에도 중복 기술되어 있다.
- **제안**: 도메인 용어는 본문 §1 또는 §2 앞으로 이동. `비-목표` 의 Rationale 내 중복 항목 제거. Rationale 에는 `결정 근거 (요약)` 만 유지.

---

### [INFO] `spec/5-system/1-auth.md` — 문서 최상단 `## Overview` 섹션 없음

- **target 위치**: `1-auth.md` 전체 구조
- **위반 규약**: CLAUDE.md "문서 구조 규약" — spec 문서 3섹션 구성 권장 (Overview / 본문 / Rationale)
- **상세**: `1-auth.md` 는 `## 1. 인증`, `## 2. 세션 관리`, ... `## Rationale` 의 구조로, 명시적인 `## Overview` 섹션이 없다. 상단에 관련 문서 cross-link 주석은 있으나 3섹션 권장 구조를 따르지 않는다.
- **제안**: `## Overview` 섹션을 문서 상단에 추가해 인증/인가 시스템의 제품 정의를 간략히 기술하는 것이 바람직하나, 기존 spec 문서 다수가 동일 패턴이므로 INFO 등급. 구현 착수 차단은 아님.

---

### [INFO] `spec/5-system/11-mcp-client.md` — `skipReason` `lower_snake_case` 예외가 `spec/conventions/error-codes.md` 에 미등재

- **target 위치**: `11-mcp-client.md §6.2` — "명명 규칙 분리: `skipReason` 값은 모두 `lower_snake_case` 다"
- **위반 규약**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` — 원칙을 따르지 않는 코드/값은 명시적으로 등록해야 한다
- **상세**: `skipReason` 은 "에러 코드가 아닌 운영 진단용 enum" 이라고 본문에 인라인 선언되어 있으나, 이 예외(진단 필드는 `lower_snake_case` 허용)가 `spec/conventions/error-codes.md` 에 등재되지 않았다. 다른 개발자가 유사 패턴 도입 시 이 예외를 발견하지 못할 수 있다.
- **제안**: `spec/conventions/error-codes.md` 에 "에러 코드 vs 운영 진단 enum 의 표기 분리" 기준을 명시하거나, 해당 문서 내에 cross-reference 를 추가.

---

### [INFO] `spec/5-system/12-webhook.md` — 자기 참조 관련 문서 링크

- **target 위치**: `12-webhook.md` 관련 문서 링크 `[PRD Webhook](./12-webhook.md)`
- **위반 규약**: 문서 구조 규약 — 관련 문서 링크는 외부 spec 문서를 가리켜야 하며 자기 자신을 PRD 로 참조하는 것은 비정상
- **상세**: `> 관련 문서: [PRD Webhook](./12-webhook.md) · ...` 에서 `./12-webhook.md` 가 본 문서 자신을 가리키고 있다.
- **제안**: `[PRD Webhook](./_product-overview.md)` 또는 적절한 상위 PRD 문서로 링크 수정.

---

## 요약

`spec/5-system/` 의 검토 대상 문서들은 전반적으로 API endpoint 명명(복수형·케밥케이스), 응답 envelope (`{ data: ... }`), HTTP 상태 코드 선택, Swagger 데코레이터 패턴 등 핵심 규약을 잘 준수하고 있다. 가장 주의할 사항은 `1-auth.md §1.5.4` 의 초대 관련 에러 코드 6개가 `lower_snake_case` 로 표기된 점으로, 동일 문서 내 WebAuthn 에러 코드들이 `UPPER_SNAKE_CASE` 를 따르는 것과 불일치하며 구현 시 클라이언트 분기 코드에서 혼선을 유발할 수 있다. `10-graph-rag.md` 는 Overview/본문 경계가 모호하고 Rationale 에 도메인 용어·비목표가 중복 기술된 구조적 문제가 있어 구현자가 spec 진입 지점을 오독할 위험이 있다. CRITICAL 위반(invariant 파괴, 시스템 간 계약 붕괴)은 없다.

## 위험도

MEDIUM
