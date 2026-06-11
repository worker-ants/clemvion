# Cross-Spec 일관성 검토 결과

**Target**: `spec/4-nodes/4-integration/1-http-request.md`
**검토 일시**: 2026-06-11
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [WARNING] `spec/5-system/3-error-handling.md` §1.4 HTTP 에러 코드 목록에 `HTTP_BLOCKED` 누락

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표 — `HTTP_BLOCKED` 를 정식 `output.error.code` 로 정의
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.4 노드 수준 에러 카탈로그 HTTP 행 — `HTTP_TRANSPORT_FAILED · HTTP_4XX · HTTP_5XX · HTTP_TIMEOUT` 만 열거, `HTTP_BLOCKED` 가 없음
- **상세**: target(1-http-request.md)은 `HTTP_BLOCKED` 를 SSRF 차단 전용 `output.error.code` 로 §6 표에 명시하고, D4 결정으로 이 코드가 `port:'error'` 로 surface 된다고 규정한다. 그러나 3-error-handling.md §1.4 HTTP 카테고리 행에는 `HTTP_BLOCKED` 가 포함되지 않아, 시스템 전반 에러 카탈로그와 노드 spec 간 에러 코드 집합이 일치하지 않는다. node-output.md D4 주석과 2-navigation/4-integration.md §Rationale 은 `HTTP_BLOCKED` 를 명확히 언급하지만, 공식 에러 코드 SoT 역할을 하는 3-error-handling.md 에서 이 코드가 빠져 있으면 다른 영역(Chat Channel adapter, 에러 처리 공용 로직 등)이 이 코드를 인식하지 못할 수 있다.
- **제안**: `spec/5-system/3-error-handling.md` §1.4 HTTP 행을 `HTTP_TRANSPORT_FAILED · HTTP_4XX · HTTP_5XX · HTTP_TIMEOUT · HTTP_BLOCKED` 로 갱신. target 의 §6 정의는 정확하므로 수정 불요.

---

### [WARNING] `spec/0-overview.md` §6.1 노드 시스템 목록에 SSRF 전 인증 공통 변경 반영 누락

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §8.2 Rationale — SSRF 가드를 `none`/`custom` 포함 전 인증 방식 공통으로 확장했음을 명시 (2026-06-11 결정)
- **충돌 대상**: `spec/0-overview.md` §6.1 Integration(HTTP·Database·Send Email) 구현 완료 행 — HTTP Request 노드의 SSRF 동작에 대한 별도 언급 없음
- **상세**: 직접 모순은 아니나 0-overview.md §6.1 의 `Integration(HTTP·Database·Send Email)` 구현 완료 행이 HTTP Request 의 인증 방식별 SSRF 동작 변경(breaking change)을 반영하지 않는다. 운영자가 0-overview.md 만 참조할 경우 `none`/`custom` 인증 시 SSRF 가드가 적용됨을 알 수 없다. 0-overview.md 는 상세 동작이 아닌 기능 목록을 기술하므로 CRITICAL 은 아니지만, self-host 운영 영향(breaking)이 있는 변경이라 가시성 필요.
- **제안**: 0-overview.md §6.1 HTTP·Integration 행에 간략히 "SSRF 가드 전 인증 방식 공통(§8.2, 2026-06-11)" 을 주석으로 추가하거나, §6.1 "완료" 설명 칸에 `ALLOW_PRIVATE_HOST_TARGETS` 플래그 주의 문구를 링크로 삽입. 우선순위는 낮음(운영 문서로 별도 전달 가능).

---

### [INFO] `spec/5-system/3-error-handling.md` §1.4 HTTP 행의 `HTTP_TIMEOUT` 코드 — target §6 표에 불포함

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표 — `HTTP_TRANSPORT_FAILED` 는 있으나 `HTTP_TIMEOUT` 은 별도 항목으로 없음
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.4 HTTP 행 — `HTTP_TIMEOUT` 포함
- **상세**: target 의 §4 step 12 및 §6 표는 `AbortController` timeout 실패를 `HTTP_TRANSPORT_FAILED` (fetch reject 통합 코드)로 기술하며, 별도 `HTTP_TIMEOUT` 코드를 정의하지 않는다. 3-error-handling.md §1.4 는 `HTTP_TIMEOUT` 을 독립 항목으로 열거하고 있어 두 문서가 timeout 처리 경로에 대해 미세하게 다른 코드 집합을 기술한다. 현재 구현 실체(`error-codes.ts`)가 어느 spec 을 따르는지에 따라 하나가 오기재다. target 이 "timeout = `HTTP_TRANSPORT_FAILED` 통합" 을 명확히 선언했으므로 3-error-handling.md 의 `HTTP_TIMEOUT` 별도 열거가 오래된 기술일 가능성이 있다.
- **제안**: `codebase/backend/src/nodes/core/error-codes.ts` 의 실제 `ErrorCode` enum 을 확인해 `HTTP_TIMEOUT` 이 독립 코드인지 확인. target 의 §6 표 각주 또는 3-error-handling.md §1.4 HTTP 행에 "AbortController timeout → `HTTP_TRANSPORT_FAILED`(통합) 또는 별도 `HTTP_TIMEOUT`" 분류를 명확히 기술해 두 문서를 동기화.

---

### [INFO] `spec/5-system/3-error-handling.md` §1.4 Email 행 서술 — `EMAIL_HOST_BLOCKED` 와 `HTTP_BLOCKED` 관계 참조가 target 을 가리키지 않음

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 SSRF opt-out callout — `HTTP Request(none/integration/custom 전부)·Database Query·Send Email(SMTP) 가 동일 플래그를 공유한다` 명시
- **충돌 대상**: `spec/5-system/3-error-handling.md` §1.4 Email 행 — `EMAIL_HOST_BLOCKED (SSRF 가드 차단 — host 가 사설/loopback, 기본 ON·ALLOW_PRIVATE_HOST_TARGETS opt-out)` 로 기술하나 이와 대칭되는 HTTP 행에서 `HTTP_BLOCKED` 가 누락되어 두 코드의 쌍 관계가 에러 카탈로그에서 보이지 않음
- **상세**: 직접 모순은 아니나 3-error-handling.md 에서 Email 의 `EMAIL_HOST_BLOCKED` 는 설명이 있지만 HTTP 행에 `HTTP_BLOCKED` 가 없어, 코드 카탈로그를 읽는 독자가 HTTP Request 도 동일 메커니즘을 갖는다는 사실을 찾기 어렵다. WARNING 항목(HTTP_BLOCKED 누락)과 동일 루트 원인이나, 상호 참조 가시성 관점의 별개 INFO.
- **제안**: [WARNING] 항목 수정 시 함께 해결됨 — HTTP 행에 `HTTP_BLOCKED` 추가 및 `EMAIL_HOST_BLOCKED` 와의 메커니즘 공유를 짧게 서술.

---

### [INFO] `spec/5-system/11-mcp-client.md` §3.2 `ALLOW_PRIVATE_HOST_TARGETS` 참조 출처가 target §4 SSRF opt-out callout 를 가리킴 — 상호 참조 정합성 확인

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 SSRF opt-out callout — "AI Agent 의 MCP 서버는 별개 정책(`MCP_ALLOW_INSECURE_URL`, [Spec MCP Client §3.2])" 명시
- **충돌 대상**: `spec/5-system/11-mcp-client.md` §3.2 — `ALLOW_PRIVATE_HOST_TARGETS(http-request §4)` 를 역참조로 언급
- **상세**: 두 문서의 상호 참조 고리가 서로를 가리키고 있으며 내용 자체의 모순은 없다. target 이 §4 SSRF opt-out callout 에서 "HTTP Request(`none`/`integration`/`custom` 전부)" 범위를 명확히 확대함에 따라 11-mcp-client.md 의 역참조 맥락("정당 용도가 있는 항목")이 여전히 유효한지 재확인이 필요하다. 기존 표현은 특정 HTTP 인증 방식을 전제하지 않으므로 충돌은 없음.
- **제안**: 별도 수정 불요. 11-mcp-client.md 의 `ALLOW_PRIVATE_HOST_TARGETS(http-request §4)` 참조 앵커가 §4 callout 를 직접 가리키는지 링크만 확인.

---

## 요약

target(`spec/4-nodes/4-integration/1-http-request.md`)의 핵심 변경 사항 — SSRF 가드를 `none`/`custom` 인증 포함 전 인증 방식 공통으로 확대(§8.2) 및 `HTTP_BLOCKED` 에러 코드 D4 경로 서술(§6) — 은 기존 spec 영역과 **직접 모순되는 충돌이 없다**. `spec/4-nodes/4-integration/0-common.md` 의 D4 결정 서술, `3-send-email.md` 의 `ALLOW_PRIVATE_HOST_TARGETS` 공유 원칙, `11-mcp-client.md` 의 역참조 모두 target 과 정합한다. 다만 시스템 전체 에러 코드 카탈로그 역할을 하는 `spec/5-system/3-error-handling.md` §1.4 HTTP 행이 `HTTP_BLOCKED` 를 포함하지 않아, 이 코드를 참조하는 다른 영역(Chat Channel adapter 분류 로직 등)의 누락 인식 가능성이 있는 WARNING 이 1건 식별됐다. `HTTP_TIMEOUT` vs `HTTP_TRANSPORT_FAILED` 통합 기술의 미세 불일치는 실체 코드 확인이 필요한 INFO 수준이다. 전체적으로 cross-spec 관점의 blocking 충돌은 없으며, `spec/5-system/3-error-handling.md` §1.4 HTTP 행의 동기화로 WARNING 이 해소된다.

---

## 위험도

LOW
