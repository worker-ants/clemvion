# 신규 식별자 충돌 검토 — spec-draft-mail-send-status

검토 대상: `plan/in-progress/spec-draft-mail-send-status.md`
검토 일시: 2026-05-29

---

## 발견사항

### [CRITICAL] `SMTP_SEND_FAILED` vs `EMAIL_SEND_FAILED` — target 이 수정하려는 기존 오기재 확인

- **target 신규 식별자**: 변경 2 에서 `SMTP_SEND_FAILED → EMAIL_SEND_FAILED` 정정을 제안한다.
- **기존 사용처**:
  - `spec/2-navigation/4-integration.md` line 1000 — 에러 코드 vocabulary 표에 `SMTP_SEND_FAILED` 가 남아 있음 (target 이 지적한 stale 표기).
  - `spec/4-nodes/4-integration/3-send-email.md` lines 81, 214, 227, 271, 280 — `EMAIL_SEND_FAILED` 로 정확하게 사용 중.
  - `spec/5-system/3-error-handling.md` lines 67, 208 — `EMAIL_SEND_FAILED` 로 정확하게 사용 중.
  - `codebase/backend/src/nodes/core/error-codes.ts` line 25 — `EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED'` 로 구현됨.
  - `spec/conventions/chat-channel-adapter.md` line 332 — `EMAIL_SEND_FAILED` 로 사용 중.
- **상세**: target 의 분석은 정확하다. `spec/2-navigation/4-integration.md` §991 에러 코드 vocabulary 표만 `SMTP_SEND_FAILED` 를 잔존 초안 표기로 사용 중이며 모든 다른 위치는 이미 `EMAIL_SEND_FAILED` 를 쓰고 있다. `SMTP_SEND_FAILED` 는 어떤 코드 파일에도 존재하지 않는다. 이 식별자를 수정하지 않고 방치하면 spec 의 어휘집이 실제 런타임 코드와 불일치하는 상태가 유지된다.
- **제안**: target 변경 2 의 정정 방향이 올바르다. `spec/2-navigation/4-integration.md` line 1000 의 `SMTP_SEND_FAILED` 행을 `EMAIL_SEND_FAILED` 로 교체한다. 신규 식별자 도입이 아니라 기존 stale 값 수정이므로 충돌 우려보다 반드시 해소해야 할 불일치다.

---

### [WARNING] `IntegrationTestResult.code` namespace 재사용 — `MCP_*` 전용에서 `EMAIL_*` 공용으로 확장

- **target 신규 식별자**: `EMAIL_CONNECT_FAILED`, `EMAIL_HOST_BLOCKED` 를 `IntegrationTestResult.code` 필드에 도입.
- **기존 사용처**:
  - `codebase/backend/src/modules/integrations/integrations.service.ts` line 66 JSDoc: `/** Failure code in the \`MCP_*\` vocabulary; absent on success. */` — `code?` 필드가 현재 `MCP_*` 전용으로 설계됐음을 JSDoc 이 명시.
  - `spec/2-navigation/4-integration.md` line 722 — `IntegrationTestResult` shape 을 언급하지만 code 필드 어휘를 MCP 계열로 묵시적 설정.
  - `spec/5-system/11-mcp-client.md` line 431 — `MCP_CONNECT_FAILED` 어휘가 동일 인터페이스에서 사용됨.
- **상세**: `IntegrationTestResult` 의 `code?` 필드는 코드상 JSDoc 이 `MCP_*` namespace 전용이라고 문서화하고 있다. target 이 `EMAIL_CONNECT_FAILED` 와 `EMAIL_HOST_BLOCKED` 를 같은 필드에 넣으면 JSDoc 이 outdated 가 되고, 타입 정의(`code?: string`) 가 사실상 `MCP_* | EMAIL_*` 혼합 namespace 가 된다. target draft 자체는 "별개 namespace, `MCP_CONNECT_FAILED` 와 동일 계열" 이라고 명시하고 있어 의도적 확장임을 인식하고 있으나, 코드의 JSDoc 과 spec 의 해당 인터페이스 설명이 함께 갱신되지 않으면 후속 구현 시 혼선이 생긴다.
- **제안**: 변경 1·2 에 서술한 대로 `IntegrationTestResult.code` 가 service-type 중립적 failure code 를 담는다는 것을 spec 에서 명확히 정의하고, `integrations.service.ts` JSDoc 을 `/** Failure code (e.g. \`MCP_*\`, \`EMAIL_*\` vocabulary); absent on success. */` 로 갱신하도록 변경 항목에 명시적으로 추가한다. 현재 draft 에는 JSDoc 갱신이 언급되어 있지 않다.

---

### [WARNING] `EMAIL_CONNECT_FAILED` — `ErrorCode` enum(`output.error.code`) 과의 namespace 혼동 가능성

- **target 신규 식별자**: `EMAIL_CONNECT_FAILED`.
- **기존 사용처**:
  - `codebase/backend/src/nodes/core/error-codes.ts` `ErrorCode` enum — `EMAIL_SEND_FAILED` 만 존재하고 `EMAIL_CONNECT_FAILED` 는 없다.
  - `spec/5-system/3-error-handling.md` §1.4 — `EMAIL_SEND_FAILED` 가 노드 런타임 에러 코드로 등재. `EMAIL_CONNECT_FAILED` 는 미등재.
  - `spec/4-nodes/4-integration/3-send-email.md` §5.3 — `output.error.code` enum에 `EMAIL_SEND_FAILED` 존재. `EMAIL_CONNECT_FAILED` 없음.
- **상세**: target 은 `EMAIL_CONNECT_FAILED` 가 `IntegrationTestResult.code` namespace 이며 노드 런타임 `output.error.code` (node-output §3.2) 와 별개임을 변경 1·2 에서 명시하고 있다. 동시에 target 변경 3 은 `EMAIL_HOST_BLOCKED` 는 §1.4 노드 런타임 표에 추가하면서 `EMAIL_CONNECT_FAILED` 는 추가하지 않는다고 명시한다. 이 구분이 spec 에 문자로 충분히 명시된다면 충돌은 없다. 그러나 두 코드(`EMAIL_CONNECT_FAILED` / `EMAIL_SEND_FAILED`) 가 이름 패턴(`EMAIL_*`)이 동일하고 한 쪽은 `IntegrationTestResult.code`, 다른 쪽은 `ErrorCode` enum 이라는 사실이 개발자에게 혼동될 위험이 있다. 특히 향후 누군가 `EMAIL_CONNECT_FAILED` 를 `ErrorCode` enum 에 추가하려 할 때 의도 착오가 생길 수 있다.
- **제안**: target 이 변경 1·2 에서 이미 namespace 분리 설명을 붙이고 있으므로 방향은 옳다. 추가로 `codebase/backend/src/nodes/core/error-codes.ts` 에 `// NOTE: EMAIL_CONNECT_FAILED is NOT in this enum — it belongs to IntegrationTestResult.code (connection test only)` 형태의 주석을 달도록 side-effect 항목에 명시하는 것을 권장한다.

---

### [WARNING] `EMAIL_HOST_BLOCKED` — `HTTP_BLOCKED` 와 명명 패턴 불일치

- **target 신규 식별자**: `EMAIL_HOST_BLOCKED`.
- **기존 사용처**:
  - `spec/4-nodes/4-integration/1-http-request.md` lines 92, 118, 313, 317, 328 — HTTP 노드의 SSRF 차단 코드는 `HTTP_BLOCKED` (도메인 prefix + `_BLOCKED`).
  - `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` lines 306, 315 — `HTTP_BLOCKED` 사용.
  - `codebase/backend/src/nodes/core/error-codes.ts` — `HTTP_BLOCKED` 는 enum 에 없음 (inline string literal 로 사용 중).
  - 데이터베이스 노드: `DB_CONNECTION_ERROR` (연결 실패), `DB_*` 패턴.
- **상세**: HTTP 노드는 SSRF 차단 코드를 `HTTP_BLOCKED` (동사형 없이 도메인 + `_BLOCKED`)로 표기하는데, target 은 Email 에 `EMAIL_HOST_BLOCKED` (`_HOST_` 삽입) 를 새로 도입한다. 두 코드의 의미가 같음에도 명명 패턴이 다르다. 동일 메커니즘을 공유하는 guard 이므로(`ALLOW_PRIVATE_HOST_TARGETS` 공용 플래그) 패턴 불일치가 혼동을 만든다. 단, target 이 `EMAIL_HOST_BLOCKED` 를 쓰는 이유는 `HTTP_BLOCKED` 가 이미 HTTP 노드 전용으로 사용 중이어서 이름이 겹치면 의미 불명확이 생기기 때문일 것이다. 결국 "패턴 일관성"과 "도메인 명확성"이 상충하는 상황이다.
- **제안**: 두 방향 중 하나를 선택하도록 명시한다. (a) `EMAIL_HOST_BLOCKED` 유지 + Rationale 에 "HTTP_BLOCKED 와 동일 메커니즘이지만 노드 도메인을 명시하기 위해 구분된 표기" 를 추가. (b) 패턴 통일을 위해 `EMAIL_BLOCKED` 로 단축. 현재 `EMAIL_HOST_BLOCKED` 는 코드에 아직 존재하지 않으므로 변경 가능하다. 어느 쪽이든 선택 후 변경 3·4 에 일관 적용해야 한다.

---

### [WARNING] `ALLOW_PRIVATE_HOST_TARGETS` — spec 최초 명시, 기존 코드·env 와의 의미 정합 검증 필요

- **target 신규 식별자**: `ALLOW_PRIVATE_HOST_TARGETS` 를 spec 에 처음으로 명시 (변경 5).
- **기존 사용처**:
  - `codebase/backend/.env.example` line 201 — `ALLOW_PRIVATE_HOST_TARGETS=false`.
  - `codebase/backend/src/nodes/integration/http-request/http-safety.ts` lines 17, 81 — HTTP Request 노드의 SSRF opt-out 플래그로 사용.
  - `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` line 153 — Database Query 노드의 SSRF opt-out 에도 동일 플래그 사용.
  - `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts` lines 55, 107 — 테스트에서 사용.
  - spec 어디에도 이 ENV var 가 아직 정의되어 있지 않다.
- **상세**: target 은 이 ENV var 가 "HTTP / Database Query / Send Email(SMTP) 통합 노드 전반의 SSRF 가드를 공통 제어한다" 고 설명한다. 코드를 확인하면 HTTP 노드와 DB 노드 양쪽에서 동일 플래그가 이미 사용되고 있어 설명이 실제와 일치한다. 다만 spec 에 최초 명시하므로, 향후 spec을 SoT 로 쓰는 일관성 검토에서 ENV var 정의 위치(어느 spec 파일이 정식 명세 위치인가)와 범위 서술이 완전한지 검토가 필요하다. 현재는 `spec/4-nodes/4-integration/1-http-request.md §8` 에 한 줄 추가하는 형태(변경 5)인데, cross-cutting 환경변수이므로 `spec/5-system/` 또는 별도 env-reference 규약 문서에 두는 것이 더 적절하다는 의견도 가능하다.
- **제안**: 변경 5 에서 `spec/4-nodes/4-integration/1-http-request.md §8` 에 추가하는 것 외에, `spec/0-overview.md §2.6` (Data Layer/Worker 환경 설정 영역) 또는 `spec/5-system/` 에 ENV var 의 정식 위치 단일 진실을 두고 `1-http-request.md`, `3-send-email.md` 는 그곳을 참조하는 구조를 고려한다. 단, 본 draft 범위에서 즉시 변경이 필요한 것은 아니며 명시적 cross-reference 만 있어도 족하다.

---

### [INFO] `spec-draft-mail-send-status.md` — plan 파일 경로 컨벤션 준수

- **target 신규 식별자**: 파일 경로 `plan/in-progress/spec-draft-mail-send-status.md`.
- **기존 사용처**: `plan/in-progress/` 내 다른 파일들의 명명 패턴 — `auth-config-webhook-wiring.md`, `replay-rerun.md`, `parallel-p2.md` 등 모두 `kebab-case` 사용.
- **상세**: `spec-draft-mail-send-status.md` 는 `spec-draft-` prefix 를 사용하는데, 기존 in-progress plan 파일은 이 prefix 를 사용하지 않는다. 동일 디렉토리에 `spec-draft-*` 로 시작하는 다른 파일이 없다. 제목과 목적이 명확히 구분되므로 충돌은 없으나 컨벤션 차이가 있다.
- **제안**: plan 파일명은 담당자 판단에 따라 `mail-send-status-spec-sync.md` 등 기존 패턴에 맞는 이름으로 변경을 검토할 수 있으나 현재 상태에서 다른 파일과 충돌하지는 않으므로 차단 사유는 아니다.

---

### [INFO] `MCP_CONNECT_FAILED` 와 `EMAIL_CONNECT_FAILED` — 계열 동일 언급 정합성

- **target 신규 식별자**: `EMAIL_CONNECT_FAILED`.
- **기존 사용처**: `spec/5-system/11-mcp-client.md` line 431 — `MCP_CONNECT_FAILED`.
- **상세**: target 은 `EMAIL_CONNECT_FAILED` 가 "`MCP_CONNECT_FAILED` 와 동일 계열" 이라고 명시한다. 두 코드 모두 `IntegrationTestResult.code` namespace 에 속하고 UPPER_SNAKE_CASE 형식을 공유하며, 의미도 "연결 테스트 전용 결과 코드" 로 같다. 충돌은 없고 계열 언급이 올바르다.
- **제안**: `spec/2-navigation/4-integration.md` §9.2 의 `IntegrationTestResult` 응답 shape 설명에 `code` 필드가 담을 수 있는 어휘(`MCP_*`, `EMAIL_*`)를 명시적으로 나열하면 이후 검토자가 파악하기 쉽다.

---

## 요약

target 이 도입하는 식별자(`EMAIL_CONNECT_FAILED`, `EMAIL_HOST_BLOCKED`, `ALLOW_PRIVATE_HOST_TARGETS` 명시, `SMTP_SEND_FAILED → EMAIL_SEND_FAILED` 정정) 중 실질적 충돌은 없다. 다만 세 가지 WARNING 이 해소되어야 한다. 첫째, `IntegrationTestResult.code` 의 JSDoc 이 `MCP_*` 전용으로 못을 박고 있어 `EMAIL_*` 코드를 같은 필드에 넣으면 코드 주석이 stale 가 된다. 둘째, `EMAIL_CONNECT_FAILED` 가 `ErrorCode` enum 과 `IntegrationTestResult.code` 를 혼동하지 않도록 구현 시 명확한 격리가 필요하다. 셋째, `EMAIL_HOST_BLOCKED` vs `HTTP_BLOCKED` 의 명명 패턴 차이가 의도적인지 spec 에 명시가 필요하다. CRITICAL 로 분류된 항목은 target 이 직접 제안하는 `SMTP_SEND_FAILED → EMAIL_SEND_FAILED` 정정으로, 이는 실제 코드와 다른 spec 어휘집의 오기재를 수정하는 것이며 방향이 올바르다.

---

## 위험도

MEDIUM
