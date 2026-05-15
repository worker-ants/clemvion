---

## 발견사항

---

### [WARNING] `postMessage` targetOrigin 와일드카드 폴백

- **위치**: `integrations.controller.ts:277`
- **상세**: `const targetOrigin = process.env.FRONTEND_URL || process.env.APP_URL || '*';`

  두 환경 변수가 모두 미설정이면 `targetOrigin = '*'`로 폴백하여 `window.opener.postMessage(payload, '*')`가 실행된다. 이 경우 팝업을 연 **모든 오리진**이 OAuth 콜백 메시지를 수신할 수 있다. 성공 페이로드에는 `previewToken`(임시 자격증명 접근 토큰), `integrationId`가 포함되므로, 악의적인 페이지가 `window.open`으로 팝업을 열어 이 값을 탈취할 수 있다. 이 코드는 이번 diff에서 새로 추가된 것은 아니지만, 이번 변경으로 **에러 페이로드에 OAuth 제공자의 에러 메시지가 추가**되어 정보 노출 표면이 확대된다.

- **제안**: 환경 변수가 없을 때 `'*'`로 폴백하는 대신 서버 시작 시 실패하거나(`APP_URL`을 필수 변수로 강제), 최소한 `'*'` 대신 `null`을 사용해 `postMessage` 자체를 차단할 것. 프로덕션 배포 환경에서 `FRONTEND_URL` 미설정 여부를 반드시 확인해야 한다.

---

### [INFO] 외부 OAuth 제공자 에러 메시지가 `lastError.message`에 비검증 저장 후 API 노출

- **위치**: `integrations.controller.ts:308`, `integration-oauth.service.ts:520-524`
- **상세**: `message = e.response?.message ?? e.message ?? 'OAuth failed'`는 외부 OAuth 제공자의 HTTP 응답 본문에서 직접 추출된다. 이 값은 `lastError.message`로 DB에 저장(`encryptedJsonTransformer` 적용)되고, 이번 diff에서 새로 추가된 `IntegrationDto.lastError`를 통해 API 응답으로 복호화되어 반환된다. 일부 OAuth 제공자는 에러 응답에 `client_secret` 일부, 요청 식별자, 내부 스택 정보 등을 포함하는 경우가 있어, 이 정보가 그대로 클라이언트에 노출될 수 있다. 접근은 해당 워크스페이스의 인증된 사용자로 제한되므로 직접적 피해 범위는 좁으나, 의도치 않은 자격증명 힌트가 포함될 수 있다.
- **제안**: `lastError.message` API 반환 시 길이 제한(예: 200자)과 민감 패턴 필터링(예: `secret`, `token`, `password` 등의 키워드)을 적용하거나, FE에서는 `statusReason`만 표시하고 `lastError.message`는 내부 진단 전용으로 API 응답에서 제외하는 것을 검토할 것.

---

### [INFO] `errorCode` 길이·형식 미검증으로 인한 DB 에러 묵살 가능성

- **위치**: `integration-oauth.service.ts:528`
  ```typescript
  integration.statusReason = errorCode.toLowerCase();
  ```
- **상세**: `errorCode = e.response?.code ?? 'OAUTH_CALLBACK_FAILED'`는 외부 제공자에서 온 문자열로, 길이·형식 검증이 없다. `statusReason` 컬럼은 `varchar(64)`이므로 64자를 초과하는 코드가 오면 TypeORM이 DB 에러를 던진다. 이 에러는 `markIntegrationCallbackError`의 외부 catch 블록에서 묵살되어(`logger.warn`만 기록) `lastError` 업데이트 전체가 실패한다. 보안 취약점이라기보다는 에러 처리 견고성 문제이지만, 진단 데이터가 무음으로 소실된다.
- **제안**: 저장 전에 `errorCode`를 안전한 길이·패턴으로 정규화할 것:
  ```typescript
  const safeCode = (e.response?.code ?? 'OAUTH_CALLBACK_FAILED')
    .slice(0, 64)
    .replace(/[^\w_-]/g, '_');
  ```

---

## 요약

이번 변경의 핵심 보안 구현은 **올바르게 처리**되어 있다 — `htmlEscape()` 함수가 팝업 HTML에서 OAuth 에러 메시지를 정확히 이스케이프하고(`oauth-callback.template.ts:75`), `jsonForScript()`는 postMessage 페이로드의 JS 인젝션을 막으며, `lastError` 컬럼은 `encryptedJsonTransformer`로 DB에 암호화된다. 프런트엔드 React JSX는 `statusReason` 문자열을 자동 이스케이프한다. 주된 우려는 **기존 코드의 `postMessage` 와일드카드 폴백**이며, 이번 diff로 에러 페이로드에 외부 제공자 메시지가 추가되면서 해당 리스크가 소폭 증가한다. 프로덕션 환경에서 `FRONTEND_URL`/`APP_URL` 미설정 시 OAuth 토큰 탈취 경로가 열릴 수 있으므로 환경 변수 강제 설정이 필요하다.

## 위험도

**LOW** — 암호화·이스케이프 구현은 적절하며 인증된 사용자 범위 내에서 동작한다. 다만 `postMessage '*'` 폴백은 프로덕션 환경 변수 누락 시 **MEDIUM**으로 상승할 수 있다.