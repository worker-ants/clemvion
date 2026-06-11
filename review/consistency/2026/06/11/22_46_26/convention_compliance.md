# Convention Compliance Review — spec/5-system

검토 모드: 구현 완료 후 (--impl-done, scope=spec/5-system, diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

### [INFO] 1-auth.md §4.1 Planned 액션 테이블의 auth 카테고리 명명이 `<resource>.<verb>` 패턴 미충족

- **target 위치**: `spec/5-system/1-auth.md` §4.1 "Planned (미구현)" 테이블, `인증 (워크스페이스 컨텍스트)` 카테고리 행
- **위반 규약**: `spec/5-system/1-auth.md §4.1` 자체 정의 — "Action naming 규약: `<resource>.<verb>` — resource dot-prefix 가 필수"
- **상세**: Planned 액션 `password_change`, `2fa_enable/disable` 은 `<resource>.<verb>` 형식을 갖추지 않고 resource prefix 가 없다. 동일 표에 있는 구현된 액션 (`workspace.transfer_ownership`, `execution.re_run`, `auth_config.create` 등) 및 planned 중 `workspace.create` / `member.invite` 등은 패턴을 따른다. `password_change`/`2fa_enable`/`2fa_disable` 만 예외다.
- **제안**: `auth.password_change`, `auth.2fa_enable`, `auth.2fa_disable` (또는 `user.password_change` / `user.2fa_enable` / `user.2fa_disable`) 로 명시하거나, 혹은 `<resource>` 가 워크스페이스 컨텍스트 외부라는 점을 주석으로 명시해 의도적 예외임을 선언한다. 신규 코드 추가 시 `AUDIT_ACTIONS` 상수에 dot-prefix 형태로 추가해야 하므로 spec 도 선행 통일이 적절하다.

---

### [WARNING] 1-auth.md §4.1 Planned 테이블 내 `model_config.*` 표기가 일부 불일치

- **target 위치**: `spec/5-system/1-auth.md` §4.1 Planned 테이블 — `설정` 카테고리 행 `model_config.* (create/update/delete/set-default; reveal 미제공 …)` 과 그 아래 블록 인용
- **위반 규약**: `spec/5-system/1-auth.md §4.1` 자체 Action naming 규약 — "구현 action 의 단일 SoT 는 `audit-action.const.ts` 의 `AUDIT_ACTIONS` union". 같은 절의 구현된 `auth_config` 액션은 `auth_config.create` / `auth_config.update` / `auth_config.delete` 등 `<resource>.<verb>` (snake_case resource, dot, snake_case verb) 형식을 쓴다. 블록 인용 내 통합 이전 `llm_config.*`/`rerank_config.*` 표기는 과거 artifact 임을 설명하나, planned 테이블의 `model_config.*` 표기는 와일드카드 그대로 남아있어 SoT 에 구체 동사가 실존하는지 불명확하다.
- **상세**: `model_config.*` 식으로 표기된 Planned 액션은 실제 `AUDIT_ACTIONS` 에 아직 미등재 상태이며, 구현 시 `model_config.create` / `model_config.update` / `model_config.delete` / `model_config.set_default` 네 개의 구체 문자열이 SoT 에 추가돼야 한다. `*` 와일드카드 표기만으로는 최종 형태가 명확하지 않아 구현자가 잘못된 이름을 선택할 수 있다.
- **제안**: Planned 테이블 해당 셀을 `model_config.create`, `model_config.update`, `model_config.delete`, `model_config.set_default` 네 개로 명시하거나, 현행 형식을 유지하되 "구현 시 위 4개 구체 이름으로 `AUDIT_ACTIONS` 에 추가" 를 명확히 주석으로 기재한다.

---

### [INFO] 1-auth.md §1.5.4 에러 코드 표 historical-artifact 주석 — `forbidden` / `rate_limited` 이중 등재 여부 확인 필요

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 하단 블록 인용 (> **명명 — historical-artifact 예외**)
- **위반 규약**: `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 SoT
- **상세**: `1-auth.md §1.5.4` 블록 인용에서 `forbidden`/`rate_limited` (lowercase) 가 초대 흐름 전용 artifact 로 등재됐다고 기술하고 있으며, `error-codes.md §3` 레지스트리에도 동일 코드가 등재돼 있다. 양쪽 모두 SoT 를 주장하는 모양새이지만, `error-codes.md §3` 표 내 `근거` 컬럼이 `1-auth.md §1.5.4` 를 역참조하므로 순환은 없다. 그러나 `1-auth.md` 의 블록 인용이 레지스트리 행의 내용을 직접 선언하는 것처럼 쓰여 있어 SoT 위치가 모호해 보인다.
- **제안**: `1-auth.md §1.5.4` 의 블록 인용 문구를 "이 코드들은 `error-codes.md §3` historical-artifact 레지스트리에 등재돼 있다 — 근거 참조" 형식으로 축약해 SoT 가 `error-codes.md §3` 임을 명확히 하고 중복 선언을 제거한다.

---

### [INFO] 10-graph-rag.md 문서 구조 — Overview 섹션 위치가 CLAUDE.md 3섹션 권장 패턴과 일부 다름

- **target 위치**: `spec/5-system/10-graph-rag.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: `10-graph-rag.md` 는 `## Overview (제품 정의)` 섹션을 헤딩 레벨 2 (`##`) 로 두되, 그 안에 `### 1. 목표`, `### 2. 범위`, `### 3. 요구사항` 등 번호 붙은 하위 섹션이 묶여 있다. 이어서 `## 1. 개요`, `## 2. 데이터 모델` 등 별도 번호 시스템이 최상위 섹션(`##`)으로 반복된다. 즉 `## Overview` 안의 `### 1`~`### 8` 과 파일 본문의 `## 1`~`## 8` 이 혼재해 헤딩 계층이 이중화됐다. 이는 위반 보다는 불일치에 가깝지만 다른 spec 파일들의 구조와 다르다.
- **제안**: `## Overview` 안에 있는 `### 1. 목표` ~ `### 8. 미결` 은 제품 정의(PRD) 층이고, `## 1. 개요` ~ `## 8. 비-목표` 는 기술 명세 층이다. 이 이중 구조는 현재 기능적으로 쓸 수 있으나, 향후 편집 시 `## Overview (제품 정의)` 를 독립 블록으로 분리하거나 본문 섹션 번호 체계를 정리해 혼동을 줄이는 것이 권장된다. 기존 링크 앵커가 있다면 변경은 `spec-link-integrity.test.ts` 가드 통과 후 진행한다.

---

### [INFO] 10-graph-rag.md §6 WebSocket 이벤트 — `document:graph_error` dead-declared 코드 정리 권장

- **target 위치**: `spec/5-system/10-graph-rag.md` §6 WebSocket 이벤트 테이블 하단 블록 인용
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 (출력 계약의 명확성) — 직접 위반은 아니나 dead 선언된 이벤트 타입이 spec 에 공개 표면으로 기재된 상태
- **상세**: `document:graph_error` 가 `websocket.service.ts` 이벤트 타입 union 에 선언돼 있으나 실제로 emit 되지 않는다고 spec 이 명시하고 있다 (블록 인용 내). 이 상태를 spec 에서 그대로 두면 외부 구독자가 해당 이벤트를 기다리는 실수를 할 수 있다.
- **제안**: spec 에서 `document:graph_error` 를 이벤트 표에서 제거하거나 "선언만 존재, emit 없음 (dead)" 임을 테이블 행에 명시하고, 코드 측 union 에서도 해당 타입을 정리하는 후속 plan 을 등록한다.

---

### [INFO] 11-mcp-client.md §3.2 에러 코드 `MCP_HTTPS_REQUIRED` — `error-codes.md §3` 레지스트리 미등재 확인 필요

- **target 위치**: `spec/5-system/11-mcp-client.md` §3.2 URL 검증 / SSRF 정책 블록 인용 내 `MCP_HTTPS_REQUIRED`
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명), §2 (안정성), §3 (historical-artifact 예외 레지스트리)
- **상세**: `MCP_HTTPS_REQUIRED` 는 `UPPER_SNAKE_CASE` 를 따르고 의미 기반 명명도 충족한다 — 규약 준수. 단, 이 코드가 `error-codes.md §3` 레지스트리 밖에 있는 일반 코드이므로 별도 이슈는 없다. 다만 같은 블록 내 "loopback / RFC 1918 / cloud metadata 호스트명" 차단 에러도 `MCP_HTTPS_REQUIRED` 와 **동일 코드**로 반환된다고 기술돼 있어, 에러 코드 이름이 실제로는 "SSRF 차단"과 "HTTPS 미충족" 두 조건을 하나의 코드로 처리함을 내포한다. 이는 `error-codes.md §1` "조건의 의미를 기술" 원칙과 미세하게 거리가 있다.
- **제안**: SSRF 차단을 별도 코드 `MCP_SSRF_BLOCKED` 로 분리하거나, 현재 코드가 "연결 불가 URL" 이라는 상위 의미를 커버한다면 `MCP_INSECURE_URL` 같은 포괄적 이름으로 rename (신규 코드라면 rename = no breaking change) 을 검토한다. 단 코드가 이미 클라이언트에서 분기에 사용되고 있다면 `error-codes.md §2` 에 따라 rename 대신 신규 코드 신설이 적절하다.

---

### [INFO] 11-mcp-client.md §6.2 `mcpDiagnostics` — `meta.*` 필드 위치가 node-output Principle 2 에서 예상하는 형식과 부합하는지 확인

- **target 위치**: `spec/5-system/11-mcp-client.md` §6.2 진단 누적 (`mcpDiagnostics`) 예시 JSON
- **위반 규약**: `spec/conventions/node-output.md` Principle 2 (`meta` 는 실행 메트릭만 담음)
- **상세**: `mcpDiagnostics` 는 `meta.mcpDiagnostics` 아래에 위치하도록 설계됐다(spec 본문 "AI Agent 의 `meta.mcpDiagnostics` 에 호출 통계를 누적하는 것이 목표 모델"). `meta` 아래에 실행 통계성 진단을 두는 것은 node-output Principle 2 의 "실행 메트릭" 분류와 부합한다. 단, 현재 구현은 `serverSummaries[]` 의 일부만 emit 하고 나머지는 미구현(Planned)이라는 상태가 spec 에 명시돼 있어 spec-impl 갭이 존재한다. 이 자체는 규약 위반이 아니고 `pending_plans` 추적 대상이다.
- **제안**: 현재 미구현 필드(`attempted`/`serverCount`/`toolCalls` 등)에 대한 `pending_plans` 가 `plan/in-progress/spec-sync-mcp-client-gaps.md` 로 등재돼 있는지 확인하고, 해당 plan 이 `pending_plans:` frontmatter 에 기재돼 있으면 정합 상태다. (`spec-pending-plan-existence.test.ts` 가드 통과 전제)

---

## 요약

`spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md 검토 대상) 의 정식 규약 준수 상태는 전반적으로 양호하다. CRITICAL 위반은 발견되지 않았다. 가장 주목할 항목은 `1-auth.md §4.1` Planned 액션 테이블 내 `password_change` / `2fa_enable` / `2fa_disable` 이 자기 문서가 선언한 `<resource>.<verb>` Action naming 규약을 따르지 않는 것으로, 구현 시 `AUDIT_ACTIONS` 상수에 잘못된 형태로 등록될 위험이 있어 INFO 수준으로 분류한다. `model_config.*` 와일드카드 표기 불명확성(WARNING)은 향후 구현자가 구체 이름을 추정해야 하는 상황을 만들 수 있다. 나머지 항목(10-graph-rag 문서 이중 헤딩 계층, dead-declared WebSocket 이벤트, MCP 에러 코드 의미 범위)은 순수 형식 제안 수준이다.

---

## 위험도

LOW
