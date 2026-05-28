# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/spec-draft-mail-send-status.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 1. [WARNING] `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정 시 기존 용어 표에 표기 stale 여부

- **target 신규 식별자**: 변경 2에서 `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 로 "정정" 처리
- **기존 사용처**:
  - `spec/2-navigation/4-integration.md:1000` — 에러 코드 vocabulary 표에 `SMTP_SEND_FAILED` 가 현재 등재되어 있음
  - `spec/4-nodes/4-integration/3-send-email.md:214`, `271`, `280` — `EMAIL_SEND_FAILED` 가 이미 정식 코드로 사용 중
  - `spec/5-system/3-error-handling.md:67`, `208` — Email 행에 `EMAIL_SEND_FAILED` 등재
  - `codebase/backend/src/nodes/core/error-codes.ts:25` — `EMAIL_SEND_FAILED` 만 enum 에 존재; `SMTP_SEND_FAILED` 는 codebase 에 없음
  - `spec/conventions/chat-channel-adapter.md:332` — `EMAIL_SEND_FAILED` 분류
- **상세**: `SMTP_SEND_FAILED` 는 `spec/2-navigation/4-integration.md` 의 §14 vocabulary 표에만 남아 있는 stale 표기이고, 실제 구현과 다른 spec 문서들은 모두 `EMAIL_SEND_FAILED` 를 사용하고 있다. target 은 이를 "정정"으로 기술하고 있어 이것은 충돌이라기보다 기존 stale 표기를 제거하는 것이다. 명명 충돌은 없으나, target 이 올바른 표기임을 확인하는 차원에서 WARNING 으로 등재한다.
- **제안**: target 이 기술한 대로 `spec/2-navigation/4-integration.md` vocabulary 표의 `SMTP_SEND_FAILED` 행을 `EMAIL_SEND_FAILED` 로 교체하는 것이 올바른 방향이다. 충돌 아님, stale 정리.

---

### 2. [INFO] `EMAIL_CONNECT_FAILED` — 신규 코드, 기존 사용처 없음

- **target 신규 식별자**: `IntegrationTestResult.code = EMAIL_CONNECT_FAILED` (변경 1의 Email SMTP 테스트 결과 코드)
- **기존 사용처**: codebase 및 spec 전체 검색 결과 `EMAIL_CONNECT_FAILED` 는 target(`plan/in-progress/spec-draft-mail-send-status.md` 및 동일 브랜치의 `plan/in-progress/fix-mail-send-status.md`) 에만 등장함. 기존 사용처 없음.
- **유사 코드**: `MCP_CONNECT_FAILED` (`spec/5-system/11-mcp-client.md:431`) 가 동일 패턴의 선례로 존재 — `IntegrationTestResult` 레벨 코드로 TCP/TLS/DNS 연결 실패를 표현. 네이밍 패턴(`<PREFIX>_CONNECT_FAILED`)이 일치하므로 일관성 있음.
- **상세**: 신규 코드 도입이며 기존 코드와 의미 충돌 없음. `error-codes.ts` 의 `ErrorCode` enum (`EMAIL_SEND_FAILED` 등 노드 런타임 에러 코드)과는 용도 계층이 다름 — `EMAIL_CONNECT_FAILED` 는 `IntegrationTestResult.code` (연결 테스트 결과 코드)이며, 노드 실행 시 `output.error.code` 로 라우팅되는 `ErrorCode` enum 과는 별개 namespace. 이 점이 spec 에서 명시될 필요가 있다.
- **제안**: 변경 1 본문에 "`IntegrationTestResult.code` — 연결 테스트 전용, 노드 런타임 `output.error.code` 와 별개 namespace" 라는 주석을 추가하면 혼동을 방지할 수 있다. 필수는 아님.

---

### 3. [INFO] `EMAIL_HOST_BLOCKED` — 신규 코드, 기존 사용처 없음

- **target 신규 식별자**: `EMAIL_HOST_BLOCKED` (변경 1의 SSRF 가드 차단 코드, 변경 2의 vocabulary 표 신규 행, 변경 3의 error-handling.md §1.4 추가)
- **기존 사용처**: codebase 및 spec 전체 검색 결과 `EMAIL_HOST_BLOCKED` 는 target 에만 등장함.
- **유사 코드**: `HTTP_BLOCKED` (`spec/4-nodes/4-integration/1-http-request.md`) 가 동일 목적(SSRF 차단)의 선례로 존재. HTTP 노드는 `HTTP_BLOCKED` 를 노드 런타임 에러(`output.error.code`)로 사용하고, target 은 `EMAIL_HOST_BLOCKED` 를 send_email 노드의 `output.error.code` 이면서 연결 테스트의 `result.code` 양쪽에 사용한다.
- **상세**: `HTTP_BLOCKED` 와 `EMAIL_HOST_BLOCKED` 는 같은 SSRF 차단 시맨틱이지만 prefix 가 다르다(`HTTP_` vs `EMAIL_`). HTTP 노드가 `HTTP_BLOCKED` 를 단독으로 쓰는 반면, target 은 `EMAIL_HOST_BLOCKED` 를 도입한다. 이는 다른 SSRF 차단 코드와 명명 패턴이 엇갈려 일관성에 약간 의문이 생기나, HTTP 는 모든 transport 실패를 `HTTP_*` prefix 로 통일하는 반면 Email 은 `EMAIL_*` prefix 계통을 따르고 있어 내부 일관성은 있다. 실제 충돌(동일 식별자가 다른 의미)은 없음.
- **제안**: 변경 3(`error-handling.md §1.4`)에 `EMAIL_HOST_BLOCKED` 를 추가할 때, chat-channel-adapter 분류표 검토 의무(`spec/5-system/3-error-handling.md:74` 의 주석)에 따라 `spec/conventions/chat-channel-adapter.md §3.1` 분류표에 `EMAIL_HOST_BLOCKED` 행 추가 여부를 명시적으로 결론 내릴 필요가 있다. target 의 side-effect 점검 결과(§76~83)에서 "행 추가 없음" 으로 이미 결론이 나 있으나, 그 근거(`ERROR_PORT_FALLBACK` 으로 격상 후 `executionFailedInternal` 로 분류)가 spec 변경 본문에도 inline 으로 표기되면 검토자가 재확인하기 편하다.

---

### 4. [INFO] `ALLOW_PRIVATE_HOST_TARGETS` — 기존 env var 재사용, 충돌 없음

- **target 신규 식별자**: SMTP SSRF 가드의 opt-out 플래그로 `ALLOW_PRIVATE_HOST_TARGETS` 를 재사용
- **기존 사용처**:
  - `codebase/backend/.env.example:201` — `ALLOW_PRIVATE_HOST_TARGETS=false` 정의
  - `codebase/backend/src/nodes/integration/http-request/http-safety.ts:81` — HTTP Request 노드 SSRF 가드에서 참조
  - `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:153` — Database Query 노드에서 참조
- **상세**: target 은 SMTP SSRF 가드에 기존 `ALLOW_PRIVATE_HOST_TARGETS` 를 새로 적용(신규 env var 생성이 아님)하고, 이것이 "HTTP Request / Database Query 노드와 동일한 SSRF 정책" 이라고 명시한다. 신규 식별자 도입이 아니므로 충돌 없음. 오히려 기존 플래그 재사용을 통한 통일이다.
- **제안**: 없음. 재사용 방향 올바름.

---

### 5. [INFO] spec 파일 경로 — 기존 컨벤션 적합

- **target 신규 식별자**: 변경 대상 파일 경로 `spec/2-navigation/4-integration.md`, `spec/5-system/3-error-handling.md`
- **기존 사용처**: 두 파일 모두 이미 존재하는 파일에 대한 변경이므로 신규 파일 생성 없음.
- **상세**: 파일 경로 충돌 없음.

---

## 요약

target spec draft 가 도입하는 신규 식별자는 `EMAIL_CONNECT_FAILED`, `EMAIL_HOST_BLOCKED` 두 에러 코드다. 두 코드 모두 기존 spec 및 codebase 에 동일 이름으로 정의된 선례가 없어 엄밀한 의미의 충돌은 없다. `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 변경은 기존 stale 표기 정정이며 다른 문서·구현 모두 이미 `EMAIL_SEND_FAILED` 를 사용하고 있어 정합하다. `ALLOW_PRIVATE_HOST_TARGETS` 는 신규 env var 가 아닌 기존 플래그 재사용이다. 주의 사항으로는 (1) `EMAIL_CONNECT_FAILED` 가 `IntegrationTestResult.code` namespace 에 속하며 `ErrorCode` enum(노드 런타임 에러) 과 별개임을 spec 내에서 명확히 해야 한다는 점, (2) `EMAIL_HOST_BLOCKED` 추가 시 chat-channel-adapter 분류표 재검토 결론을 변경 본문에 인라인으로 명시하면 향후 검토자 혼선이 줄어든다는 점이 있다. 전체적으로 식별자 충돌 위험은 낮다.

## 위험도

LOW
