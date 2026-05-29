# Cross-Spec 일관성 검토 결과

**Target**: `plan/in-progress/spec-draft-mail-send-status.md`
**검토 일시**: 2026-05-29
**검토 모드**: `--spec` (spec draft 검토)

---

## 발견사항

### [WARNING] `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정: 기존 spec 표의 실제 상태 확인 필요

- **target 위치**: 변경 2 — `spec/2-navigation/4-integration.md` §991 부근 에러 코드 vocabulary 표
- **충돌 대상**: `spec/2-navigation/4-integration.md` 현재 본문 line 1000
- **상세**: draft 는 vocabulary 표의 `SMTP_SEND_FAILED` 가 "stale initial draft 잔재"라며 `EMAIL_SEND_FAILED` 로 정정한다고 명시했다. 실제 현 spec 본문(`spec/2-navigation/4-integration.md:1000`)을 확인하면 `| SMTP_SEND_FAILED | nodemailer 전송 실패 | ...` 로 `SMTP_SEND_FAILED` 가 존재한다. 반면 `spec/5-system/3-error-handling.md §1.4`(line 67)·`spec/4-nodes/4-integration/3-send-email.md §5.3`(line 214) 은 이미 `EMAIL_SEND_FAILED` 로 정확하다. 따라서 정정 자체는 올바르나, draft 가 "stale" 이라고 표현하는 코드가 현재도 spec 표에 살아 있어 정정 의도를 확인할 수 있다. 정정 후 이 코드(`SMTP_SEND_FAILED`)가 어떤 문서에도 남지 않도록 일괄 검색이 필요하다.
- **제안**: draft 변경 2 적용 시 `SMTP_SEND_FAILED` 의 spec 전역 잔재 여부를 grep 으로 추가 확인. `spec/4-nodes/4-integration/0-common.md`·`spec/conventions/` 하위도 포함할 것.

---

### [WARNING] `EMAIL_HOST_BLOCKED` 분류표 누락 — `chat-channel-adapter.md §3.1` 업데이트 필요

- **target 위치**: 변경 3 — `spec/5-system/3-error-handling.md §1.4` Email 행 `EMAIL_HOST_BLOCKED` 추가, 변경 4 — `spec/4-nodes/4-integration/3-send-email.md §5.3` `EMAIL_HOST_BLOCKED` 추가
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §3.1` 카테고리 매핑 표 (line 332)
- **상세**: `spec/5-system/3-error-handling.md §1.4` 에는 "본 enum 확장 시 분류 표 행 추가 검토 의무"가 명시되어 있다(line 74). draft 는 §1.4 Email 행에 `EMAIL_HOST_BLOCKED` 를 추가하며, 이는 **노드 런타임 에러 코드 추가**에 해당한다. 현재 `chat-channel-adapter.md §3.1` 분류 표에는 `EMAIL_SEND_FAILED → executionFailedThirdParty` 만 있고, `EMAIL_HOST_BLOCKED` 행이 없다. draft 의 `side-effect 점검 결과` 절은 "분류표 행 추가 없음"으로 결론 내리며 근거로 "send_email 실패가 워크플로우 종료로 격상되면 `ERROR_PORT_FALLBACK`(이미 INTERNAL 군)이 된다"고 적는다. 이 판단은 error 포트가 연결되지 않은 경우에 대해서는 타당하다. 그러나 error 포트가 연결된 경우, `EMAIL_HOST_BLOCKED` 는 `output.error.code` 로 execution-level 에 노출되며 Chat Channel 어댑터 분류기가 코드를 직접 읽는다. 현재 분류기 fallback 규칙("그 외 모든 code → executionFailedInternal") 이 적용되어 사실상 문제없이 동작하지만, draft 가 §1.4 에 공식 추가하는 이상 분류 표에도 명시적으로 등재해 모호성을 없애는 것이 규약 의도에 부합한다.
- **제안**: `spec/conventions/chat-channel-adapter.md §3.1` 분류표에 `EMAIL_HOST_BLOCKED → executionFailedThirdParty` 행을 추가하거나, draft 의 side-effect 절에 "분류표 fallback 으로 처리됨 — 명시적 등재는 별도 grooming" 이라고 의도를 명문화하여 다음 spec 작성자가 혼동하지 않도록 한다.

---

### [WARNING] `ALLOW_PRIVATE_HOST_TARGETS` 환경 변수의 적용 범위가 기존 spec 과 명시적으로 연결되지 않음

- **target 위치**: 변경 1·4·5 — SSRF 가드가 HTTP Request `§8` 과 "동일한 메커니즘·플래그"를 공유한다는 서술
- **충돌 대상**: `spec/4-nodes/4-integration/1-http-request.md §8 SSRF 가드` (line 92–93, 310–328)
- **상세**: 현재 `1-http-request.md §8` 에는 `assertSafeOutboundUrl(url)` 함수명이 명시되어 있으나, SSRF opt-out 환경 변수에 대한 언급이 없다(`ALLOW_PRIVATE_HOST_TARGETS` 는 `.env.example` 과 코드에만 존재함을 draft 가 인정). draft 변경 5 는 이 환경 변수를 "HTTP / Database Query / Send Email(SMTP) 통합 노드 전반의 SSRF 가드를 공통 제어"한다고 최초로 spec 에 명시할 것을 제안한다. 그러나 현재 `1-http-request.md` 는 opt-out 변수 자체를 정의하지 않아, 변경 5 가 `1-http-request.md §8` 의 "SoT"로 지목되지만 정작 §8 본문에 해당 변수가 없다. `spec/5-system/11-mcp-client.md §3.2` 는 MCP 용 escape hatch 로 별도 변수 `MCP_ALLOW_INSECURE_URL=true` 를 사용하는데, SMTP/HTTP 가 `ALLOW_PRIVATE_HOST_TARGETS` 를 공유하고 MCP 가 별도 변수를 사용한다는 정책 분기가 spec 에 명시되지 않아 독자에게 혼동이 생길 수 있다.
- **제안**: 변경 5 를 적용할 때 `1-http-request.md §8` 본문 내에 `ALLOW_PRIVATE_HOST_TARGETS` 환경 변수와 그 적용 범위(HTTP·Database·Email, MCP 제외)를 정의하는 문장을 추가한다. `11-mcp-client.md §3.2` 와의 명시적 구분("MCP 는 별도 `MCP_ALLOW_INSECURE_URL`")도 한 줄 교차 참조로 남겨 두 정책이 독립 변수임을 분명히 한다.

---

### [WARNING] `EMAIL_CONNECT_FAILED` 의 `IntegrationTestResult.code` namespace 가 기존 연결 테스트 응답 계약과의 정합성 명시 필요

- **target 위치**: 변경 1·2 — "`IntegrationTestResult.code` namespace — 노드 런타임 `ErrorCode` enum 과는 별개 namespace"
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.2 API` 테이블 (line 722, 733), `spec/5-system/11-mcp-client.md §8` (line 431 `MCP_CONNECT_FAILED`)
- **상세**: draft 는 `EMAIL_CONNECT_FAILED` 가 `MCP_CONNECT_FAILED` 와 "동일 계열"이라고 서술한다. 그러나 `MCP_CONNECT_FAILED` 는 `spec/5-system/11-mcp-client.md §8.1` 에서 `tool_result.error.code` 와 `mcpDiagnostics.errors[].code` 용도로 정의되며, 이것이 `IntegrationTestResult.code` 인지 명확하지 않다. 기존 `IntegrationTestResult` shape 는 `{ success: boolean, code?: string, message?: string }` 형태로 추정되나, 현 spec 에 shape 의 정식 정의가 없다. 코드 namespace("노드 런타임 `ErrorCode` enum 과 별개")를 draft 가 선언하는 것은 올바른 방향이지만, `IntegrationTestResult` 응답 타입의 공식 정의가 spec 어디에도 없어 "동일 계열"이라는 서술이 구체적 근거를 갖추지 못한다.
- **제안**: `spec/2-navigation/4-integration.md §9.2` 또는 기존 연결 테스트 관련 절에 `IntegrationTestResult` 타입을 최소한으로 정의(`{ success: boolean, code?: string, message?: string }`)하고, Email 과 MCP 의 code namespace 간 관계를 정리한다. 또는 draft 의 "동일 계열" 서술을 "동일한 UPPER_SNAKE_CASE 값 형식을 따른다"로 좁혀 오해 소지를 줄인다.

---

### [INFO] `preview-test` 엔드포인트의 per-service 동작 분기가 spec 에 미기술

- **target 위치**: 변경 1 — "저장 전 사전 검증(`preview-test`)·저장 후 테스트(`:id/test`)·rotate 세 경로 모두 동일하게 실제 SMTP `verify()` 를 수행한다"
- **충돌 대상**: `spec/2-navigation/4-integration.md §3.3` (line 219), §9.2 (line 733), §5.8 line 608
- **상세**: 현재 spec §3.3 은 `preview-test` 를 "메모리상 자격 증명으로 검증"이라 기술하고, §5.8 line 608 은 Cafe24 한정으로 "구조적 유효성만 검증, 외부 네트워크 호출 없음"이라고 명시한다. 이 두 서술은 Cafe24-specific 컨텍스트임이 §5.8 위치로 구분되어 있다. draft 가 Email 의 `preview-test` 가 실제 SMTP `verify()` 를 수행한다고 명시하는 것은 기존 서술과 직접 모순되지는 않으나(Cafe24 한정 서술이므로), `preview-test` 엔드포인트의 per-service 분기 정책이 spec 어디에도 통합 기술되지 않아 독자가 §5.8 의 "외부 호출 없음" 을 모든 service_type 에 적용하는 오독 위험이 있다. 특히 §9.2 API 표의 endpoint 설명("저장 전 인증 정보로 연결 테스트")이 service_type 별 동작 차이를 전혀 암시하지 않는다.
- **제안**: `spec/2-navigation/4-integration.md §9.2` 의 `preview-test` 행 설명에 service_type 별 동작 분기를 간략히 주석으로 추가한다. 예: "service_type 에 따라 외부 호출 여부가 다름 — email: SMTP `verify()` 수행, cafe24: 구조 검증만(§5.8)".

---

### [INFO] Database Query 노드의 SSRF 가드 정책이 spec 에 기술되어 있지 않음

- **target 위치**: 변경 1·5 — "HTTP / Database Query / Send Email(SMTP) 통합 노드 전반의 SSRF 가드를 공통 제어"
- **충돌 대상**: `spec/4-nodes/4-integration/2-database-query.md` (SSRF 관련 기술 없음)
- **상세**: draft 변경 5 는 `ALLOW_PRIVATE_HOST_TARGETS` 가 Database Query 노드에도 적용된다고 명시한다. 그러나 `spec/4-nodes/4-integration/2-database-query.md` 에는 SSRF 가드 관련 기술이 전혀 없다. `1-http-request.md §8` 이 SSRF SoT 로 지목되나, Database Query 노드는 해당 spec 를 교차 참조하지 않는다.
- **제안**: `2-database-query.md` 에 짧은 SSRF 가드 참조 문장을 추가하거나, 변경 5 의 범위를 HTTP·Email 로 좁히고 Database 의 SSRF 적용 여부는 별도 spec task 로 추적한다. 범위를 넓히려면 Database 노드 spec 도 병행 갱신이 필요하다.

---

### [INFO] `SMTP_SEND_FAILED` 가 `chat-channel-adapter.md §3.1` 분류표와 `error-handling.md §1.4` 에 여전히 사용되지 않는 코드로 간접 혼동 가능

- **target 위치**: 변경 2 — `integration.md` vocabulary 표의 `SMTP_SEND_FAILED` 제거
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §3.1` 분류표 (line 332 — `EMAIL_SEND_FAILED` 만 존재), `spec/5-system/3-error-handling.md §1.4` (line 67 — `EMAIL_SEND_FAILED` 만 존재)
- **상세**: 분류표와 §1.4 는 이미 `EMAIL_SEND_FAILED` 를 사용하고 있어 `SMTP_SEND_FAILED` 가 제거되어도 다른 파일 수정 없이 정합하다. 단 코드베이스(`error-codes.ts`)에 `SMTP_SEND_FAILED` 가 남아 있다면 spec-impl 불일치가 생기므로 코드 변경도 병행해야 한다. draft 는 spec 문서만 변경하는 task 이므로 이 시점에서 코드 확인이 필요하다.
- **제안**: `codebase/backend/src/nodes/core/error-codes.ts` 에서 `SMTP_SEND_FAILED` 존재 여부를 확인하고, 있다면 `EMAIL_SEND_FAILED` 로 리네임하는 코드 변경 task 를 별도로 추적한다.

---

## 요약

draft 는 구현 완료된 동작(SMTP `verify()`, SSRF 가드, 신규 에러 코드 2종)을 spec 에 정합화하는 작업으로서 기존 spec 의 핵심 계약(node-output `output.error` envelope 형태, `IntegrationTestResult` 응답 shape, RBAC·데이터 모델)과 직접적으로 모순되는 지점은 없다. 주요 우려는 세 가지다: (1) `§1.4` 신규 에러 코드 추가 시 `chat-channel-adapter.md §3.1` 분류표 검토 의무(명시적 규약)를 draft side-effect 절이 "추가 불필요"로 처리했으나 명시적 등재 또는 의도 문서화가 부족하다. (2) `ALLOW_PRIVATE_HOST_TARGETS` 환경 변수가 `1-http-request.md §8` SoT 로 지목되나 정작 §8 본문에 정의가 없어 변경 5 만으로는 독자가 opt-out 정책을 완전히 파악할 수 없다. (3) `preview-test` 의 per-service 동작 분기(Email: 실제 `verify()` 수행, Cafe24: 구조 검증만)가 spec 에 명시되지 않아 §5.8 의 "외부 호출 없음" 서술이 전체 service_type 에 대한 오독을 유발할 수 있다. 이 세 가지를 draft 채택 전 보완하면 다른 영역과의 일관성이 충분히 확보된다.

---

## 위험도

**MEDIUM**
