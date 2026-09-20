# Cross-Spec 일관성 검토 — `spec-draft-integration-error-facts`

## 발견사항

- **[INFO]** HTTP 연결 테스트(§5.3)의 "가드의 고장" 사례가 이 draft 의 새 어휘 밖에 남는다
  - target 위치: 변경안 ②(트리거 3자리 — `0-common.md` §4.2 · `1-http-request.md` §4/§4.2 · `2-database-query.md` §6.2)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §5.3 "결과:" 목록 (line 476-485)
  - 상세: draft 는 노드 런타임 세 곳에 "SSRF 가드가 판정이 아닌 오류를 던지면 `INTEGRATION_CALL_FAILED`" 를 정확히 기록한다(실측: `database-query.handler.ts` line 267-285 이 `instanceof SsrfBlockedError` 로 정확히 이 두 갈래를 가른다). 그런데 같은 가드를 재사용하는 HTTP 연결 테스트(`http-connection-tester.ts`) 도 동일한 instanceof 구분을 이미 코드로 갖고 있다(line 118 주석 "`outboundBlockReason` 은 차단 «판정» 만 사유로 돌리고 가드의 다른 오류는 던지므로" — catch-all 이 `HTTP_CONNECT_FAILED` 로 승격, `HTTP_BLOCKED` 아님). §5.3 의 "결과:" 목록은 이 구분을 언급하지 않는다. draft 반영 후 노드 문서 셋은 "가드 고장 ≠ 차단 판정" 을 명시하는데, 같은 성격의 연결 테스트 문서만 침묵해 문서 간 상세도가 비대칭해진다.
  - 제안: 이 draft 의 범위는 아니지만(스코프를 인정), 후속으로 §5.3 "결과:" 목록에 "가드 자체 오류(판정 아님) → `HTTP_CONNECT_FAILED`" 한 줄을 추가하는 트래커 항목을 남기면 대칭이 완성된다. 차단 사유는 아니다.

## 확인한 항목 (충돌 없음 — 근거)

- ① `code:` 프런트매터 추가 — `http-redirect.ts` 실재 확인, 다른 spec_impact 파일의 `code:` 목록과 이름 충돌 없음.
- ② "가드의 고장" 트리거 — `database-query.handler.ts`(line 267-285) · `http-request.handler.ts`(step 8/9 흐름) 모두 `instanceof SsrfBlockedError` 로 판정/고장을 가르고, 고장은 `INTEGRATION_CALL_FAILED` 로 승격함을 코드로 확인. `0-common.md` §4.2 의 기존 `INTEGRATION_CALL_FAILED` 정의("기타 일반 예외… `toLogError` fallback")와 새 문구가 모순 없이 합성됨 — 신규 코드 생성 없음. Cafe24/MakeShop 도 같은 `INTEGRATION_CALL_FAILED` fallback 을 쓰지만(`cafe24.handler.ts`/`makeshop.handler.ts` line 360/373) mall_id/shop_uid 검증은 정규식이라 이 instanceof 분기가 애초에 없음 — draft 의 "비대상"(HTTP/DB 한정) 범위와 일치.
- ③ HTTP 연결 테스트 두 코드 — `resolveHttpCredentials`(`http-credentials.ts`)의 `HttpCredentialsResult` union 이 `INTEGRATION_INCOMPLETE` / `INTEGRATION_AUTH_UNSUPPORTED` 를 갖고, `testHttpConnection`(`http-connection-tester.ts` line 92-95)이 그대로 반환. `connection-test-codes.ts` line 52 의 `IntegrationTestResultCode` 도 `Extract<HttpCredentialsResult, {ok:false}>['code']` 로 이미 포함. `2-navigation/4-integration.md` §5.3(line 476-485)·§14.1 어휘 표(line 1100-1123) 어디에도 이 두 코드가 없음을 확인 — draft 의 factual-gap 주장이 정확하고, 기존 `INTEGRATION_INCOMPLETE` 사용례(§9.1 pending_install 가드, cafe24 `pingConnection`)와 이름이 충돌하지 않음(같은 코드의 재사용).
- ④ MakeShop §5.9 "정책 동일" 범위 좁히기 — `makeshop-api.client.ts` 의 `MakeshopPingCode`(line 165-168)는 `MAKESHOP_AUTH_FAILED | MAKESHOP_TRANSPORT_FAILED | INTEGRATION_INCOMPLETE` 뿐이며 401/403 모두 `MAKESHOP_AUTH_FAILED` 로 묶는다(`mapPingError` line 180-186). 반면 `cafe24-api.client.ts` 의 `Cafe24PingCode`(line 165-169)는 `CAFE24_AUTH_FAILED` 와 `CAFE24_INSUFFICIENT_SCOPE` 를 분리(line 417/444). §5.9 첫 문단(line 654)은 이미 "연결 테스트 401 자가회복" 만 공유 목록에 넣고 403 은 뺐는데, "테스트 방법" 문장(line 696)은 "403 처리… §5.8 정책 동일" 이라 적어 첫 문단과도 내부적으로 어긋난다 — draft 가 line 696 만 정정하고 line 654 는 그대로 두는 스코프가 정확히 이 비대칭을 해소한다.

## 요약

target draft 는 새 요구사항·엔티티·API 계약·상태 머신·RBAC·계층 책임을 전혀 추가하지 않는 순수 사실 정정 4건이며, 넷 다 코드 실측(`http-redirect.ts`, `database-query.handler.ts`, `http-credentials.ts`/`http-connection-tester.ts`, `makeshop-api.client.ts`/`cafe24-api.client.ts`)과 정확히 일치한다. 제안된 코드(`INTEGRATION_CALL_FAILED`, `INTEGRATION_INCOMPLETE`, `INTEGRATION_AUTH_UNSUPPORTED`)는 모두 기존에 이미 다른 문서·다른 노드가 쓰던 이름을 그대로 재사용하므로 요구사항 ID·API 계약 충돌이 없다. 유일하게 남는 것은 이 draft 의 의도적 스코프 밖에 있는 대칭 항목(HTTP 연결 테스트의 "가드 고장" 표기 부재)으로, 차단 사유가 아닌 후속 트래커 감이다.

## 위험도

LOW
