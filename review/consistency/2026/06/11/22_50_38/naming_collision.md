# 신규 식별자 충돌 검토 — `spec/4-nodes/4-integration/1-http-request.md`

검토 대상: `spec/4-nodes/4-integration/1-http-request.md` (2026-06-11 SSRF 전 인증 방식 공통 적용 개정)

---

## 발견사항

### 1. **[WARNING]** `HTTP_BLOCKED` — `error-codes.ts` ErrorCode enum 미등재
- target 신규 식별자: `HTTP_BLOCKED` (§5.3, §6 에러 코드 표, §4.2 Usage 로깅 매트릭스)
- 기존 사용처:
  - `codebase/backend/src/nodes/core/error-codes.ts` — `ErrorCode` const 에 `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX`, `HTTP_TIMEOUT` 이 정의되어 있으나 `HTTP_BLOCKED` 항목이 없음
  - 실제 handler 코드(`http-request.handler.ts:358/367`)는 inline string literal `'HTTP_BLOCKED'` 로 사용 중
- 상세: target spec 은 §6 에러 코드 표에 `HTTP_BLOCKED` 를 공식 코드로 명시한다. 그러나 `ErrorCode` 상수에 미등재된 상태다. `spec/5-system/3-error-handling.md` 의 HTTP 에러 코드 열거(line 77, 220)도 `HTTP_TRANSPORT_FAILED · HTTP_4XX · HTTP_5XX · HTTP_TIMEOUT` 만 포함하고 `HTTP_BLOCKED` 는 없다. 이 상태에서 다른 노드나 어댑터가 `ErrorCode.HTTP_BLOCKED` 를 참조하려 하면 컴파일 오류 없이 `undefined` 가 된다.
- 제안: `codebase/backend/src/nodes/core/error-codes.ts` 의 HTTP 그룹에 `HTTP_BLOCKED: 'HTTP_BLOCKED'` 항목 추가. `spec/5-system/3-error-handling.md` HTTP 에러 코드 열거에도 `HTTP_BLOCKED` 추가.

---

### 2. **[INFO]** `INTEGRATION_SERVICE_UNAVAILABLE` — spec §6 에 D4 신규 경로로 기술되나 `ErrorCode` enum 미등재
- target 신규 식별자: `INTEGRATION_SERVICE_UNAVAILABLE` (§5.8 / §6 에러 코드 표)
- 기존 사용처:
  - `codebase/backend/src/nodes/core/error-codes.ts` — `ErrorCode` 에 `INTEGRATION_SERVICE_UNAVAILABLE` 미포함
  - `http-request.handler.ts:197`, `database-query.handler.ts:197`, `cafe24.handler.ts:155`, `makeshop.handler.ts:146` 모두 inline string `'INTEGRATION_SERVICE_UNAVAILABLE'` 사용 중
- 상세: target 이 `INTEGRATION_SERVICE_UNAVAILABLE` 를 §6 에러 코드 표에 공식 코드로 등재했으나(D4 경로), `ErrorCode` const 에는 없다. `INTEGRATION_CALL_FAILED` 도 동일하게 inline string 이고 enum 미등재. 두 코드는 target 개정 이전부터 이미 이 상태였으며, target 이 D4 경로를 spec 에 추가하면서 명시성이 높아진 시점에 enum 등재 필요성이 부각된다.
- 제안: `INTEGRATION_SERVICE_UNAVAILABLE` 및 `INTEGRATION_CALL_FAILED` 를 `ErrorCode` 에 등재(Integration 그룹 또는 공통 그룹). target 단독 작업이 아닌 `error-codes.ts` 정비 트랙 결과물.

---

### 3. **[INFO]** `NF-SC-05` 요구사항 ID — 기존 정의와 의미 일치 확인
- target 신규 식별자: §8.2 Rationale 에서 `NF-SC-05(OWASP)` 를 준거 근거로 인용
- 기존 사용처: `spec/5-system/_product-overview.md` line 30 — `NF-SC-05 | CSRF, XSS, SQL Injection 등 OWASP Top 10 대응 | 필수 | ✅`
- 상세: target 이 인용하는 `NF-SC-05` 의 의미("OWASP Top 10 대응, SSRF 포함")와 기존 `_product-overview.md` 의 정의("CSRF, XSS, SQL Injection 등 OWASP Top 10")가 논리적으로 일치한다. SSRF 는 OWASP Top 10 A10(2021: SSRF)에 해당하므로 범위 내다. 명시적 충돌 없음.
- 제안: 필요하다면 `_product-overview.md` NF-SC-05 설명란에 SSRF 를 예시로 병기해 target 인용과의 대응을 명확히 할 수 있다. 필수는 아님.

---

### 4. **[INFO]** `authentication` 필드값 `custom` — 기존 Integration.auth_type 과의 혼동 가능성
- target 신규 식별자: config 필드 `authentication` 의 enum 값 `custom` (§1 설정 표)
- 기존 사용처: `spec/1-data-model.md §2.10` `Integration.auth_type` 에는 `oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none` 이 정의되어 있고 `custom` 값 없음. `AuthConfig.type` 에도 `custom` 없음.
- 상세: `authentication='custom'` 은 HTTP Request 노드 config 전용 값으로, "사용자가 직접 `headers` 에 인증 헤더를 입력하는 모드"를 의미한다. 기존 `Integration.auth_type` 이나 `AuthConfig.type` 의 `custom` 과 이름이 겹치지 않는다(저 두 타입에 `custom` 이 없음). 그러나 spec 맥락에서 `authentication` 값이 동일 통합 도메인 옆에 열거될 때 혼동 여지가 있다. 기존 `AuthConfig` Rationale 2.17.3에서 `AuthConfigType` / `IntegrationAuthType` 을 코드 레벨에서 명시 분리하도록 지시하고 있어 이 값은 해당 분리 가이드 밖에 있다.
- 제안: HTTP Request 노드의 `authentication` Enum 이 `HttpRequestAuthentication` 타입으로 별도 선언되어 있는지 schema 확인 권장(`http-request.schema.ts`). 이미 별도 타입이라면 충돌 없음.

---

## 요약

target(`spec/4-nodes/4-integration/1-http-request.md`)이 도입하거나 명시화한 식별자 중 요구사항 ID·엔티티명·API endpoint·이벤트명·파일 경로 충돌은 없다. 주요 주의 사항은 에러 코드 레지스트리(`error-codes.ts`)와의 비동기 문제다: `HTTP_BLOCKED` 가 spec §6 에 공식 코드로 명시됐음에도 `ErrorCode` enum 에 미등재되어 있어, 다른 모듈이 `ErrorCode.HTTP_BLOCKED` 를 type-safe 하게 참조하지 못한다. 이는 `HTTP_TIMEOUT` 이 `ErrorCode` 에 등재된 것과 대비된다. `INTEGRATION_SERVICE_UNAVAILABLE` / `INTEGRATION_CALL_FAILED` 도 동일한 미등재 패턴이나 이는 target 이전부터의 기존 상태다. 환경변수 `ALLOW_PRIVATE_HOST_TARGETS` 는 기존에 동일 이름으로 db·email·http-request 전반에 이미 정의·사용 중이며, target 의 "전 인증 방식 공통 적용" 기술은 기존 이름과 완전히 일치한다.

## 위험도

LOW
