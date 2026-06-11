# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md)
검토 모드: 구현 완료 후 (--impl-done)
검토 기준: `spec/conventions/` 전체

---

## 발견사항

### 1. [WARNING] `spec/5-system/1-auth.md` — Overview 섹션 부재

- **target 위치**: `spec/5-system/1-auth.md` 전체 구조
- **위반 규약**: `CLAUDE.md` "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장. `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview` 섹션 권장
- **상세**: `spec/5-system/10-graph-rag.md` 는 `## Overview (제품 정의)` 섹션을 명시적으로 두고 있고, `spec/5-system/11-mcp-client.md` 는 `## 1. 개요` 섹션으로 대체하고 있으나, `spec/5-system/1-auth.md` 는 `## 1. 인증 (Authentication)` 으로 곧바로 본문에 진입하며 Overview / 제품 정의에 해당하는 명시적 최상위 섹션이 없다. 문서 맨 위의 cross-reference blockquote 가 Overview 역할을 암묵적으로 하고 있으나 규약 권장 형태(`## Overview`)가 아니다.
- **제안**: 문서 상단에 `## Overview` 섹션을 추가하고 인증 시스템의 제품 정의·목적·현황(status: partial) 을 한 단락으로 기술하거나, `CLAUDE.md` 규약을 "Optional — cross-reference blockquote 로 대체 가능" 으로 완화한다면 규약 자체를 갱신한다.

---

### 2. [WARNING] `spec/5-system/1-auth.md` §5 API 표 — `/auth/2fa/webauthn/availability` 응답 봉투 불일치

- **target 위치**: `spec/5-system/1-auth.md` §5 API 엔드포인트 표, `GET /api/auth/2fa/webauthn/availability` 행
- **위반 규약**: `spec/5-system/2-api-convention.md §5.1` — 모든 성공 응답은 `TransformInterceptor` 가 `{ data: ... }` 로 감싸며, Swagger 응답 스키마에도 이 구조를 반영한다. `spec/conventions/swagger.md §2-5` — 응답 wrapping
- **상세**: §1.4.3 본문에서는 동일 엔드포인트의 응답을 `{ data: { enabled: boolean } }` 으로 정확히 기술하고 있는데, §5 API 표의 같은 행에서는 `{ enabled: boolean }` 으로 `data` 봉투 없이 기술되어 내부 불일치가 있다. 이 차이는 문서 독자에게 혼란을 주고 Swagger DTO 작성 시 오류를 유발할 수 있다.
- **제안**: `spec/5-system/1-auth.md` §5 표의 해당 행을 `응답: { data: { enabled: boolean } }` 으로 수정해 §1.4.3 와 일치시킨다.

---

### 3. [WARNING] `spec/5-system/1-auth.md` §4.1 Planned 감사 액션 — `<resource>.<verb>` dot-prefix 미준수

- **target 위치**: `spec/5-system/1-auth.md` §4.1 "Planned (미구현 — 목표 커버리지)" 표, "인증 (워크스페이스 컨텍스트)" 카테고리
- **위반 규약**: `spec/5-system/1-auth.md` §4.1 자체의 "Action naming 규약" — `<resource>.<verb>` 형태로 resource dot-prefix 가 필수
- **상세**: Planned 액션 `password_change`, `2fa_enable/disable` 은 dot-prefix 없이 직접 동사 형태다 (`password_change` → 올바른 형태라면 `auth.password_change` 또는 `user.password_change`). 동일 문서에서 구현된 액션들(`auth_config.create`, `integration.created`, `workspace.transfer_ownership`)은 모두 dot-prefix를 준수하고 있어 Planned 항목만 예외가 된다. 이 액션들이 구현 시 spec에 선언된 이름 그대로 `AUDIT_ACTIONS` 에 추가된다면 규약 위반 코드가 배포된다.
- **제안**: `password_change` → `auth.password_changed` (또는 `user.password_changed`), `2fa_enable` / `2fa_disable` → `auth.2fa_enabled` / `auth.2fa_disabled` (또는 `user.2fa_enabled` / `user.2fa_disabled`) 로 spec 을 선행 수정한다. 규약이 "Planned 항목은 dot-prefix 유예" 를 허용하려면 §4.1 에 명시적 예외를 선언해야 한다.

---

### 4. [INFO] `spec/5-system/10-graph-rag.md` — `## Overview` 와 `## 1. 개요` 이중 정의

- **target 위치**: `spec/5-system/10-graph-rag.md` `## Overview (제품 정의)` 섹션과 `## 1. 개요` 섹션
- **위반 규약**: `CLAUDE.md` "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 구조
- **상세**: `## Overview (제품 정의)` 가 요구사항·범위·기술 결정·Phase Plan 까지를 포함하는 매우 큰 섹션이 되었고, 이후 `## 1. 개요` 가 다시 등장해 본문의 첫 섹션처럼 시작한다. 실질적으로 Overview 라고 부를 내용이 두 곳에 분산되어 있어 3섹션 구조(Overview / 본문 / Rationale)의 경계가 모호하다.
- **제안**: `## Overview (제품 정의)` 를 제품 수준 요약·목표·범위만 담는 간결한 섹션으로 축소하고, 기술 결정·요구사항 표·Phase Plan 은 본문(§1~§8) 으로 이동한다. 또는 현재 구조가 팀 내 합의된 패턴이라면 규약 문서를 "Overview 가 요구사항 표를 포함하는 확장 형태를 허용한다" 로 갱신한다. 기능상 문제는 없으므로 INFO 등급이다.

---

### 5. [INFO] `spec/5-system/11-mcp-client.md` §6.2 `mcpDiagnostics` — `meta` 위치 명시 vs. `node-output.md` Principle 2

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 "진단 누적 (`mcpDiagnostics`)" 및 `meta.mcpDiagnostics` 표현
- **위반 규약**: `spec/conventions/node-output.md Principle 2` — `meta` 는 실행 메트릭(duration, tokens, statusCode 등)만 담는다. `meta` 의 허용 필드는 LLM 계열 기준 `model`, `inputTokens`, `outputTokens`, `totalTokens`, `thinkingTokens?`, `toolCalls?`, `contextInjection?` 으로 열거되어 있다.
- **상세**: `mcpDiagnostics` 는 MCP 서버 연결 상태·호출 통계·에러 목록을 담는 진단 객체로, 실행 메트릭과 운영 진단의 경계선에 있다. `meta.mcpDiagnostics` 위치는 Principle 2 열거 필드 외부에 있으나, 실행 컨텍스트의 부가 정보이므로 `meta` 배치 자체는 Principle 2의 정신("실행 메타데이터")과 충돌하지 않는다. 다만 Principle 2 의 허용 필드 열거에 `mcpDiagnostics` 가 명시되지 않아 독자가 규약 위반인지 불명확하다.
- **제안**: `spec/conventions/node-output.md Principle 2` 의 LLM 계열 행에 `meta.mcpDiagnostics?` 를 추가해 허용 필드임을 명시한다. 현재 구현 현황도 "부분 구현(Planned)" 이므로 낮은 우선순위이며 기능 영향은 없다.

---

## 요약

세 문서(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`) 모두 심각한 CRITICAL 위반은 없다. 주요 관심사는 두 가지다: (1) `1-auth.md` §5 API 표에서 `/auth/2fa/webauthn/availability` 응답 봉투 표기가 `{ enabled: boolean }` 으로 되어 있어 동일 문서 §1.4.3 의 `{ data: { enabled: boolean } }` 와 불일치하며 API 규약(`api-convention §5.1`)의 `data` 래핑 원칙과도 어긋난다. (2) `1-auth.md` §4.1 의 Planned 감사 액션(`password_change`, `2fa_enable/disable`)이 동문서 자신이 선언한 `<resource>.<verb>` dot-prefix 규약을 따르지 않아, 구현 시 규약 위반 액션 이름이 그대로 코드베이스에 진입할 위험이 있다. 나머지는 Overview 섹션 부재 및 중복 정의, 진단 필드 열거 누락 등 문서 일관성 수준의 INFO/WARNING이다.

## 위험도

MEDIUM
