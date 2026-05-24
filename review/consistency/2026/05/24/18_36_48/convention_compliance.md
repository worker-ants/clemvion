# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전, scope=spec/5-system)
검토 일시: 2026-05-24
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

---

### [WARNING] 1-auth.md §1.5.4 에러 코드가 `snake_case` — `UPPER_SNAKE_CASE` 규약 불일치

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 (초대 토큰 에러)
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 (`code` 는 `UPPER_SNAKE_CASE`), `spec/5-system/3-error-handling.md` §2.1 기본 형식 (`code: "VALIDATION_ERROR"` 예시)
- **상세**: 1.5.4 표의 에러 코드가 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 등 모두 `lower_snake_case` 로 작성되어 있다. 프로젝트 전반의 에러 코드 표기는 `UPPER_SNAKE_CASE` 를 정식 규약으로 사용한다 (`VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED`, `INTERNAL_ERROR` 등). 동일 문서 §1.4.3 의 `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`, `WEBAUTHN_COUNTER_REGRESSION` 은 모두 올바른 `UPPER_SNAKE_CASE` 를 사용하고 있어, 동일 파일 안에서도 일관성이 깨진다.
- **제안**: 에러 코드를 대문자로 통일한다. 예: `invitation_not_found` → `INVITATION_NOT_FOUND`, `invitation_expired` → `INVITATION_EXPIRED`, `invitation_already_used` → `INVITATION_ALREADY_USED`, `invitation_email_mismatch` → `INVITATION_EMAIL_MISMATCH`, `forbidden` → `FORBIDDEN`, `rate_limited` → `RATE_LIMITED`.

---

### [WARNING] 10-graph-rag.md 문서 구조가 Overview / 본문 / Rationale 3섹션 권장 순서에서 이탈

- **target 위치**: `spec/5-system/10-graph-rag.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 패턴
- **상세**: 본 문서는 `## Overview (제품 정의)` 이후 `### 2. 범위`, `### 3. 요구사항` 등 세부 요구사항 섹션이 먼저 나오고, 그 뒤에 `## 1. 개요`, `## 2. 데이터 모델` 등 기술 명세 본문이 반복 등장한다. 즉 개요 수준의 항목이 두 군데(Overview 섹션과 `## 1. 개요`)로 분산되어 있으며, `## Overview (제품 정의)` 아래에 `### 3. 요구사항`, `### 4. 기술 결정 사항` 등 본문 성격의 내용이 섞여 있다. 다른 spec 파일(1-auth.md, 11-mcp-client.md)은 Overview 없이 곧바로 본문으로 진입하는 반면, 이 파일만 PRD 혼합 구조가 중복 존재한다. 심각한 기능 위반은 아니지만 다른 파일과 구조적 일관성이 떨어진다.
- **제안**: `## Overview (제품 정의)` 와 그 아래 `### 1. 목표`, `### 2. 범위`, `### 3. 요구사항`, `### 4. 기술 결정 사항`, `### 5. 비기능 요구사항`, `### 6. 단계별 도입`, `### 7. 의존성`, `### 8. 미결/후속 검토` 를 별도 PRD 파일(`spec/5-system/_product-overview.md` 등) 로 분리하거나, 아니면 `## 1. 개요` 로 통합해 중복을 제거하는 방향으로 정리한다. 규약 자체를 갱신할 필요는 없다.

---

### [INFO] 1-auth.md `status: spec-only` 이고 `code: []` — TTL 90일 가드 대상

- **target 위치**: `spec/5-system/1-auth.md` frontmatter (`status: spec-only`, `code: []`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 `spec-only` TTL 90일 규칙
- **상세**: `spec-impl-evidence.md` §3 에 따르면 `status: spec-only` 는 **TTL 90일** 내에 구현 plan 이 생성·등록되어야 하며, 초과 시 build fail 또는 `backlog` 격하 처리된다. 1-auth.md 는 비밀번호 해시 포맷 가드 등 구현 진행 중인 spec 을 담고 있으므로 `spec-only` 상태가 의도적인지 확인이 필요하다. 현 브랜치(`password-hash-format-guard-60f7f2`) 가 해당 spec 구현 plan 의 일부라면, 머지 후 `partial` 로 승격하고 `code:` 필드에 구현 경로를 등록해야 한다.
- **제안**: 구현 착수가 결정된 상태이므로 머지 시점 혹은 직후 `status: partial` + `code:` + `pending_plans:` 로 전환을 계획에 포함한다. 이는 강제 차단이 아닌 TTL 도달 시점의 리스크 항목이다.

---

### [INFO] 10-graph-rag.md `status: spec-only` 이고 `code: []` — 하지만 Overview 섹션에 구현 완료 표기 존재

- **target 위치**: `spec/5-system/10-graph-rag.md` frontmatter + `## Overview (제품 정의)` 첫 줄
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 라이프사이클 전이 규칙 (`spec-only` → `partial`/`implemented` 승격)
- **상세**: frontmatter 는 `status: spec-only`, `code: []` 인데, Overview 에는 "P0~P2 구현 완료 (검증 일자: 2026-05-11)" 라고 명시되어 있다. `spec-impl-evidence.md` §3.1 전이 규칙에 따르면 최초 코드 머지 시점에 `spec-only` → `partial` 로 승격되어야 하며, 모든 약속이 구현 완료면 `implemented` 로 전환해야 한다. 구현이 완료된 것으로 기술되어 있는데 frontmatter 가 `spec-only` 로 남아 있는 것은 규약과 불일치한다.
- **제안**: 구현이 완료된 P0~P2 범위에 해당하는 코드 경로를 `code:` 에 등록하고, P2+ (미구현) 이 있으면 `partial` + `pending_plans:`, 없으면 `implemented` 로 status 를 갱신한다.

---

### [INFO] 11-mcp-client.md `status: spec-only` 이고 `code: []` — TTL 가드 대상

- **target 위치**: `spec/5-system/11-mcp-client.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 TTL 90일 규칙
- **상세**: 10-graph-rag.md 와 마찬가지로 `spec-only`, `code: []` 상태다. 11-mcp-client.md 는 구현 진행 여부가 본 payload 로는 불분명하지만, TTL 도래 전에 구현 상태와 frontmatter 를 동기화해야 한다.
- **제안**: 현재 구현 진행 상황에 따라 `partial` 또는 `implemented` 로 승격하거나, 아직 구현 의향이 없으면 `backlog` 로 격하한다.

---

## 요약

`spec/5-system` 의 세 대상 문서에서 정식 규약 대비 1건의 WARNING 급 에러 코드 표기 문제(1-auth.md §1.5.4 의 `lower_snake_case` 에러 코드)와 1건의 WARNING 급 문서 구조 이탈(10-graph-rag.md 의 Overview/본문 혼합 구조), 그리고 3건의 INFO 급 frontmatter 상태 미갱신이 발견되었다. 가장 즉각적으로 수정이 필요한 항목은 1-auth.md 의 에러 코드 명명이며, 동일 파일 내 다른 에러 코드는 이미 `UPPER_SNAKE_CASE` 를 사용하고 있어 §1.5.4 만 예외가 된다. CRITICAL 수준의 정식 규약 위반 — 다른 시스템의 invariant 를 깨는 수준 — 은 발견되지 않았다.

## 위험도

LOW
