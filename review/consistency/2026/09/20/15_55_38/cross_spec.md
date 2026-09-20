# Cross-Spec 일관성 검토 — 통합 계열 spec 사실 정정 넷

## 검토 범위

target: `plan/in-progress/spec-draft-integration-error-facts.md` (변경안 ①~④, `spec_impact` 4개 문서).
대조: `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,5-makeshop,4-cafe24}.md` ·
`spec/2-navigation/4-integration.md` · `spec/5-system/{3-error-handling,4-execution-engine}.md` ·
`spec/conventions/chat-channel-adapter.md` · `spec/data-flow/5-integration.md` (현재 본문) + 대응 코드
(`http-request.handler.ts` · `http-credentials.ts` · `http-connection-tester.ts` · `connection-test-codes.ts` ·
`database-query.handler.ts` · `makeshop-api.client.ts`).

각 변경안의 "실측" 주장을 코드에서 직접 재확인했다(아래 발견사항 참조 — 전부 CONFIRMED, 모순 없음).

## 발견사항

- **[INFO]** `5-system/3-error-handling.md §1.4` 노드-레벨 표가 Integration 4종 공통 코드(`INTEGRATION_TYPE_MISMATCH` /
  `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` / `INTEGRATION_CALL_FAILED` / `INTEGRATION_AUTH_UNSUPPORTED`)를
  카테고리로 싣지 않는다 (HTTP/Database/Email/LLM/Code/Sub-workflow 카테고리만 있고 "Integration 공통" 행이 없다).
  - target 위치: 변경안 ②·③이 `0-common.md §4.2` 와 `1-http-request.md §6`/`2-database-query.md §6.2` 에 트리거 문구를
    보강하는 자리.
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.4 "노드 수준 런타임 에러" 표.
  - 상세: 모순은 아니다 — 그 표는 "주요 항목" 이라 명시했고 SoT 는 `codebase/backend/src/nodes/core/error-codes.ts` 라고
    이미 위임돼 있다. 다만 이 draft 가 `INTEGRATION_CALL_FAILED`/`INTEGRATION_AUTH_UNSUPPORTED` 의 발생 조건을 두 문서에
    보강하는 지금, 시스템 레벨 에러 분류 표에는 그 카테고리 자체가 없어 "Integration 4종 공통 에러가 있다" 는 사실이 이
    상위 문서에서는 안 보인다. draft 의 스코프 밖이라 이 턴에 고칠 필요는 없지만, 트래커에 포인터를 남길 만하다.
  - 제안: 이 draft 는 그대로 진행하고, `5-system/3-error-handling.md §1.4` 표에 "Integration 공통" 행 추가는 별도
    후속(트래커 `spec-draft-nullable-notation-followups.md`)으로 남긴다. 차단 사유 아님.

## 실측 재확인 결과 (모순 없음 확인용 근거)

- ① `http-redirect.ts` 실재 확인 (`ls codebase/backend/src/nodes/integration/http-request/`) — `followRedirectsSafely` ·
  `outboundBlockReason` export. `http-connection-tester.ts` 도 이 둘을 import. frontmatter 추가는 사실과 일치.
- ② `http-request.handler.ts` 의 preflight catch(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 뒤)가
  `!(err instanceof SsrfBlockedError)` 분기에서 `INTEGRATION_CALL_FAILED` 로 승격하는 것을 라인 단위로 확인. redirect
  hop(`followRedirectsSafely` 가 던진 non-`IntegrationError`)은 바깥 `catch (err: unknown)` 의 `err instanceof
  IntegrationError` 가 아닌 분기로 떨어져 `HTTP_TRANSPORT_FAILED` 로 귀결되는 것도 확인 — draft 의 "실측 표"(시점별 분기)와
  코드가 정확히 일치한다. `database-query.handler.ts` 도 동일 패턴(주석 "차단 판정은 DB_HOST_BLOCKED, 판정 아닌 오류는
  INTEGRATION_CALL_FAILED")을 그대로 갖고 있어 DB 쪽 변경안도 사실과 일치.
- ③ `http-credentials.ts` 의 `resolveHttpCredentials` 가 `HttpCredentialsResult`(`ok:false` 시 `INTEGRATION_INCOMPLETE |
  INTEGRATION_AUTH_UNSUPPORTED`)를 돌려주고, `http-connection-tester.ts` `testHttpConnection` 이 `resolved.ok` 가 거짓이면
  그 code 를 그대로 `IntegrationTestResult.code` 로 반환하는 것을 확인. `connection-test-codes.ts` 의
  `IntegrationTestResultCode` union 도 `Extract<HttpCredentialsResult, {ok:false}>['code']` 를 명시적으로 포함 —
  draft 가 이미 있는 정합을 "표에 반영"만 하는 것이지 새 코드/새 계약을 만들지 않는다. `2-navigation/4-integration.md
  §14.1` 어휘 표를 대조하니 실제로 `INTEGRATION_AUTH_UNSUPPORTED` 행이 없고 `INTEGRATION_INCOMPLETE` 행에도 "연결
  테스트에서도 같은 코드로 나온다" 는 언급이 없다 — draft ③ WARNING(W1)·변경안이 정확히 이 공백을 겨눈다.
- ④ `makeshop-api.client.ts` `pingConnection` 의 403 분기(`first.status === 403 → MAKESHOP_AUTH_FAILED`)와
  `cafe24-api.client.ts` 의 `CAFE24_INSUFFICIENT_SCOPE` 를 대조 — 두 서비스가 403 을 다른 코드로 가른다는 draft 의
  주장이 노드 런타임뿐 아니라 **연결 테스트 경로**에서도 사실이다. `5-makeshop.md` §"에러 코드" 행("현재 구현은 403/401
  모두 auth_failed 로 격하한다")과도 이미 정합 — `2-navigation/4-integration.md §5.9` 의 "§5.8 정책 동일" 문구만 뒤처져
  있었다. 변경안은 그 뒤처짐을 정정할 뿐 새 비대칭을 만들지 않는다.

## 비교 대조로 확인한 인접 규약 (충돌 없음)

- `spec/conventions/chat-channel-adapter.md §3.1` 의 EIA 오류 분류 매트릭스: `INTEGRATION_CALL_FAILED` 는 명시 행이
  없고 "그 외 모든 code → `executionFailedInternal` (+ CCH-ERR-04 로그)" fallback 에 이미 들어간다. draft 가
  `INTEGRATION_CALL_FAILED` 의 신규 트리거(가드 고장)를 문서화해도 이 분류 자체는 바뀌지 않는다 — internal 취급이
  guard 고장이라는 성격과도 맞다. `HTTP_BLOCKED`(차단 판정)는 이미 그 표 line 504 에 명시 등재돼 있어 draft 의
  "차단 판정 vs 가드 고장" 구분과 그대로 정합.
- `spec/5-system/4-execution-engine.md §10.2` 는 `resolveIntegration` 실패 코드의 SoT 를 `0-common.md §4.2` 에
  위임한다고만 적혀 있어, draft 의 §4.2 보강과 직접 상충하지 않는다(오히려 SoT 위임 구조를 그대로 따른다).
- `spec/data-flow/5-integration.md` 의 시퀀스 다이어그램(§1.3)은 `resolveIntegration` 단계의 throw 코드만 다루고
  SSRF 가드·redirect hop 세부는 다루지 않아 draft 의 변경 범위와 겹치지 않는다.

## 요약

draft 가 주장하는 네 가지 사실(① `http-redirect.ts` 증거 누락, ② SSRF 가드 고장의 시점별 코드 분기, ③ HTTP 연결
테스트의 사전-자격증명 실패 코드 공유, ④ MakeShop/Cafe24 403 분류 차이)을 모두 대응 코드에서 라인 단위로 재확인했고,
전부 실제 동작과 일치했다. 네 문서(`0-common.md` · `1-http-request.md` · `2-database-query.md` ·
`2-navigation/4-integration.md`)에 걸친 변경안은 서로 참조 무결성이 있고(§4.2 ↔ §6 카탈로그 동기화까지 포함),
`5-system/3-error-handling.md` · `5-system/4-execution-engine.md` · `spec/conventions/chat-channel-adapter.md` ·
`spec/data-flow/5-integration.md` 등 인접 영역과도 직접 충돌이 없다 — 이미 위임돼 있는 SoT 구조(§4.2 가 여러
문서의 공통 참조점)를 그대로 따른다. 유일한 지적은 `5-system/3-error-handling.md` 의 노드-레벨 에러 분류 표에
"Integration 공통" 카테고리 행 자체가 없다는 사전 존재 갭이며, 이는 draft 의 스코프 밖이고 차단 사유가 아니다.

## 위험도

NONE
