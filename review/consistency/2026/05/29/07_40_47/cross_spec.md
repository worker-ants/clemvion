# Cross-Spec 일관성 검토 결과

- target: `plan/in-progress/spec-draft-mail-send-status.md`
- 검토 일시: 2026-05-29
- 검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] `preview-test` 의 서비스별 외부호출 정책 — 서술 위치 명시 필요
- **target 위치**: 변경 1 (§5.5 Email SMTP 테스트 설명), "저장 전 사전 검증(`POST /api/integrations/preview-test`)… 동일하게 실제 SMTP `verify()` 를 수행한다"
- **충돌 대상**: `spec/2-navigation/4-integration.md` §5.8 (Cafe24) 내부 — "**사전 검증(`POST /api/integrations/preview-test`)**: 저장 전 자격 증명의 구조적 유효성만 검증하며, 외부 네트워크 호출은 수행하지 않는다 (§9.2 controller 의 throttle 20/min — 막 발급된 토큰이라 refresh 가 불필요)" (line 608)
- **상세**: §5.8 의 해당 문구는 Cafe24 섹션 내부에 위치하고, 그 근거("막 발급된 토큰이라 refresh 가 불필요")도 Cafe24 OAuth 전용이다. 따라서 "preview-test 는 모든 서비스에서 외부 호출을 하지 않는다"는 blanket 정책이 아니다. 그러나 `spec/2-navigation/4-integration.md` §9.2 API 표(line 733)의 `preview-test` row 설명 — "저장 전 인증 정보로 연결 테스트. body: `{ service, authType, credentials }`" — 은 서비스별 외부호출 여부를 명시하지 않아 **모호성이 있다**. target draft 가 email 의 preview-test 에서 실제 SMTP `verify()` 를 수행한다고 선언하면서, §9.2 API 표 행이 갱신되지 않으면 두 spec 사이에 충돌이 아닌 공백이 생긴다. §5.8 의 "외부 호출 없음" 문구는 Cafe24 한정 설명이지만, 미래 독자가 "모든 preview-test 는 외부 호출 없음" 으로 오독할 수 있다.
- **제안**: 변경 1 에서 §5.5 에 추가하는 동시에, §5.8 Cafe24 의 "사전 검증… 외부 네트워크 호출은 수행하지 않는다" 문구에 "(email 과 달리 Cafe24 는…)" 와 같은 서비스 한정 명시를 함께 추가해 양쪽이 명확하게 대비되도록 한다. 또는 §9.2 `preview-test` 행에 "서비스별 동작: email = 실제 SMTP verify(), cafe24 = 구조 검증만" 을 주석으로 추가.

---

### [WARNING] `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정 — chat-channel-adapter 분류표 누락 검토
- **target 위치**: 변경 2, "`SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 로 정정"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md` §3.1 분류표 (line 332)
- **상세**: `spec/conventions/chat-channel-adapter.md §3.1` 분류표에는 이미 `EMAIL_SEND_FAILED` 가 `executionFailedThirdParty` 로 정확히 등재되어 있다. target draft 의 변경 2 는 `spec/2-navigation/4-integration.md` 에러 어휘 표의 stale `SMTP_SEND_FAILED` 를 `EMAIL_SEND_FAILED` 로 정정하는 것이므로, **분류표와는 충돌이 없다**. 다만 draft 의 "side-effect 점검 결과" 섹션에서 chat-channel-adapter 분류표 검토 완료를 주장하는데, 이 근거는 "send_email 실패가 execution 레벨로 격상되면 `ERROR_PORT_FALLBACK` 이 된다"는 것이다. 그러나 실제로 send_email 의 error port 에 엣지가 연결된 경우 `EMAIL_SEND_FAILED` 가 직접 분류표를 통과하므로, 분류표에 `EMAIL_SEND_FAILED` 가 등재된 것이 이미 이 케이스를 처리하는 것이다. 양쪽 모두 일관성은 있으나, draft 의 설명이 약간 부정확(오직 격상 케이스만 언급)하다.
- **제안**: side-effect 점검 결과 서술을 "chat-channel-adapter 분류표에 `EMAIL_SEND_FAILED` 는 이미 `executionFailedThirdParty` 로 등재되어 있어 행 추가 불필요" 로 더 직접적으로 교정. `ERROR_PORT_FALLBACK` 경유 케이스만 언급하면 분류표 검토가 충분한지 오해할 수 있다.

---

### [WARNING] `EMAIL_CONNECT_FAILED` — `spec/5-system/3-error-handling.md §1.4` 에 추가 누락
- **target 위치**: 변경 1 (§5.5 결과 코드: "실패 시 `IntegrationTestResult.code = EMAIL_CONNECT_FAILED`")
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` 노드 런타임 에러 코드 표 및 §3.2 output.error 표
- **상세**: target draft 의 변경 3 은 `spec/5-system/3-error-handling.md §1.4` 의 Email 행에 `EMAIL_HOST_BLOCKED` 를 추가한다. 그런데 변경 1 에서 도입된 `EMAIL_CONNECT_FAILED` 는 §1.4 에 추가되지 않는다. `EMAIL_CONNECT_FAILED` 는 연결 테스트(`/api/integrations/:id/test`, `/api/integrations/preview-test`)의 `IntegrationTestResult.code` 값이라 "노드 런타임 에러"가 아니므로 §1.4 적용 대상이 아닐 수 있다. 그러나 이 구분이 명시되지 않으면 에러 코드 어휘가 두 가지 상이한 표(`spec/2-navigation/4-integration.md` 에러 vocabulary + `spec/5-system/3-error-handling.md §1.4`)에 불완전하게 분산된다. `spec/2-navigation/4-integration.md` 에러 vocabulary 표(변경 2 대상)에도 `EMAIL_CONNECT_FAILED` 행이 추가 여부가 draft 에 기술되어 있지 않다.
- **제안**: draft 에서 `EMAIL_CONNECT_FAILED` 의 어휘 등재 위치를 명확히 결정: (a) 연결 테스트 전용 코드이므로 `spec/2-navigation/4-integration.md §에러 코드 vocabulary` 표에 행 추가 (`EMAIL_CONNECT_FAILED` | SMTP verify() 실패 | `IntegrationTestResult.code`), (b) §1.4 는 노드 런타임용이므로 추가 불필요임을 명시.

---

### [WARNING] `ALLOW_PRIVATE_HOST_TARGETS` — 기존 spec 에 미문서화, cross-cutting 정책 선언 충돌 위험
- **target 위치**: 변경 1, "사설(RFC1918)·loopback·link-local·IPv6 사설 대역을 기본 차단하고, self-host 는 `ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out 한다 … HTTP Request / Database Query 노드와 **동일한 SSRF 정책**을 따른다"
- **충돌 대상**: `spec/4-nodes/4-integration/1-http-request.md` §4.1·§8 (SSRF 가드), `spec/5-system/11-mcp-client.md` §3.2 (SSRF 정책, `MCP_ALLOW_INSECURE_URL`)
- **상세**: `ALLOW_PRIVATE_HOST_TARGETS` 환경변수는 구현(`codebase/backend/src/nodes/integration/http-request/http-safety.ts`, `database-query.handler.ts`, `.env.example:201`)에 존재하나 **어떤 spec 파일에도 문서화되어 있지 않다**. target draft 는 이를 email SSRF 가드의 opt-out 기제로 처음 spec 에 명시하면서 "HTTP Request / Database Query 와 동일"하다고 주장한다. 그러나 `spec/5-system/11-mcp-client.md §3.2` 는 MCP 의 SSRF escape hatch 를 별도 변수 `MCP_ALLOW_INSECURE_URL` 로 정의하고 있어, 각 노드 유형의 SSRF opt-out 플래그가 통일되지 않은 상태다. 또한 `spec/4-nodes/4-integration/1-http-request.md` 에 `ALLOW_PRIVATE_HOST_TARGETS` 를 opt-out 플래그로 문서화하는 기술이 없어, draft 의 주장이 spec 에 근거가 없다.
- **제안**: (a) `spec/4-nodes/4-integration/1-http-request.md §8` 및 database-query 해당 섹션에 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 설명을 추가해 draft 의 "동일 정책" 주장에 spec 근거를 만든다. (b) MCP 의 `MCP_ALLOW_INSECURE_URL` 과 `ALLOW_PRIVATE_HOST_TARGETS` 의 관계(별도 플래그, 의도적 분리인지 우연인지)를 Rationale 에 명시한다.

---

### [INFO] `SMTP_SEND_FAILED` stale 코드 — `spec/5-system/3-error-handling.md §3.2` 와 일관성 확인
- **target 위치**: 변경 2 (에러 코드 vocabulary 표 정정)
- **충돌 대상**: `spec/5-system/3-error-handling.md §3.2` output.error 대표 에러 코드 표 (line 208)
- **상세**: `spec/5-system/3-error-handling.md §3.2` 에는 이미 `EMAIL_SEND_FAILED` 가 올바르게 기록되어 있다. 변경 대상은 `spec/2-navigation/4-integration.md` 에러 vocabulary 표의 stale `SMTP_SEND_FAILED` 한 곳이다. 두 spec 간 일관성 문제이며 draft 의 변경 2 가 이를 수정한다. 충돌은 아니며 draft 가 올바른 방향이다.
- **제안**: 변경 2 적용 시 `spec/5-system/3-error-handling.md §3.2` 에 동일 정정이 필요한지도 확인(현재 이미 `EMAIL_SEND_FAILED` 로 올바름 — 추가 작업 불필요).

---

### [INFO] `EMAIL_HOST_BLOCKED` — `spec/conventions/chat-channel-adapter.md §3.1` 분류표 미등재 (side-effect 검토 보완)
- **target 위치**: 변경 3, 변경 1 (SSRF 가드 `EMAIL_HOST_BLOCKED`)
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §3.1` 분류표 (line 332–335)
- **상세**: draft 의 side-effect 점검은 `EMAIL_HOST_BLOCKED` 가 send_email 의 `error` 포트로 출력되며, 에러 포트 엣지가 없는 경우 `ERROR_PORT_FALLBACK` 으로 격상되어 분류표 INTERNAL 군에 이미 포함된다고 주장한다. 이 논리는 `ERROR_PORT_FALLBACK` 의 경우는 맞다. 그러나 에러 포트에 엣지가 **연결된** 경우 `EMAIL_HOST_BLOCKED` 가 분류표를 직접 통과하는 경로도 있다. 현재 분류표의 마지막 행은 "그 외 모든 code (`error.code === null` 포함)" → `executionFailedInternal` 이므로, `EMAIL_HOST_BLOCKED` 는 자동으로 `executionFailedInternal` 로 분류된다. 이는 기술적으로 올바른 결과이므로 충돌이 아니다. 다만 side-effect 검토에서 이 직접 통과 경로를 언급하지 않아 설명이 불완전하다.
- **제안**: draft 의 side-effect 설명을 "에러 포트에 엣지가 없으면 `ERROR_PORT_FALLBACK` (INTERNAL), 에러 포트에 엣지가 있으면 `EMAIL_HOST_BLOCKED` → fallback 행에 의해 자동으로 `executionFailedInternal` — 두 경로 모두 행 추가 불필요" 로 보완.

---

## 요약

Cross-Spec 일관성 관점에서 target draft 의 핵심 변경 (SMTP `verify()` 채택, `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정, `EMAIL_HOST_BLOCKED` 신규 코드, SSRF 가드 통일)은 기존 spec 과 직접적으로 모순되지 않는다. `SMTP_SEND_FAILED` 정정 방향은 `spec/5-system/3-error-handling.md` 와 codebase 의 현행 상태와 일치한다. 그러나 두 가지 명시적 조치가 필요하다. 첫째, `preview-test` 의 서비스별 외부호출 여부(email 은 실제 `verify()`, Cafe24 는 구조 검증만)가 §5.8 의 기존 문구와 명확히 대비되도록 문서화되어야 한다 — 현재 §5.8 문구는 Cafe24 한정이지만 blanket 정책처럼 읽힐 수 있어 오독 위험이 있다. 둘째, `ALLOW_PRIVATE_HOST_TARGETS` 가 "HTTP Request / Database Query 와 동일 정책"이라는 주장은 해당 노드 spec 에 이 변수가 문서화되지 않은 상태이므로, http-request 및 database-query spec 에 병행 기술이 있어야 draft 의 주장이 self-consistent 해진다. `EMAIL_CONNECT_FAILED` 의 어휘 등재 위치 결정(연결 테스트 전용 코드로 §1.4 제외 명시 또는 vocabulary 표 추가)도 명확히 해야 에러 코드 catalog 이 분산되지 않는다.

## 위험도

MEDIUM

---

*생성: consistency-checker cross-spec sub-agent, 2026-05-29*
