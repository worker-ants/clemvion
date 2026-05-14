## 발견사항

---

**[CRITICAL] `markIntegrationCallbackError` 예외가 catch 블록 내에서 전파 — callback HTML 응답 누락 위험**

- **위치:** `integrations.controller.ts` catch 블록 (추가된 `await this.oauthService.markIntegrationCallbackError(...)`)
- **상세:** DB 갱신 호출이 실패(네트워크 오류, DB 락 등)하면 `await`가 예외를 던지고, 그 아래 `res.send(renderCallbackHtml(...))` 줄이 실행되지 않는다. 사용자는 OAuth 에러 HTML 대신 500을 받게 된다. "callback 실패 관측성" 변경의 핵심 요구사항은 기존 에러 응답 경로를 유지하면서 진단 정보를 추가 기록하는 것이다. DB 기록 실패가 사용자 피드백을 막아서는 안 된다.
- **제안:** DB 갱신을 별도 try-catch 또는 `.catch(() => { /* log but ignore */ })` 로 감싸 HTML 응답 경로를 보호한다.

```typescript
if (ctx?.integrationId && ctx.workspaceId) {
  await this.oauthService.markIntegrationCallbackError(
    ctx.integrationId,
    ctx.workspaceId,
    errorCode,
    message,
  ).catch(() => { /* observability 실패가 UX를 깨지 않도록 */ });
}
```

---

**[WARNING] `lastError` 필드가 DTO에 추가됐으나 `status-badge.tsx`에서 미사용 — 진단 단서 불완전 노출**

- **위치:** `integration-response.dto.ts` (추가된 `lastError` 필드) vs `status-badge.tsx`
- **상세:** DTO에 `lastError?: Record<string, unknown> | null` 이 추가됐고 plan("statusReason/lastError 채워졌으면 UI에 노출")도 양쪽 필드 노출을 요구한다. 그런데 status-badge는 `statusReason`만 표시하고 `lastError`를 완전히 무시한다. `lastError.message`가 사용자에게 더 구체적인 설명을 줄 수 있다(예: "Failed to exchange authorization code"). `statusReason`은 분류 코드(`oauth_token_exchange_failed`)이므로 비개발자에게는 불투명하다.
- **제안:** `변경 0` 범위 내 의도적 생략이라면 plan 체크박스에 `[ ] FE: lastError.message도 pending_install 오류 상세에 노출` 항목을 추가해 누락이 추적되도록 한다.

---

**[WARNING] `lastError` Swagger 스키마가 `additionalProperties: true`로만 선언 — API 계약 불명확**

- **위치:** `integration-response.dto.ts` 추가된 `@ApiPropertyOptional` 블록
- **상세:** `{ code, message, at }` 구조가 주석에 명시됐음에도 Swagger에는 `additionalProperties: true`만 있어 클라이언트 코드 생성기나 API 문서에서 필드 형태를 알 수 없다. `code`(string), `message`(string), `at`(string, ISO 날짜)을 명시적으로 선언하면 프론트엔드가 타입 안전하게 소비할 수 있다.
- **제안:**
```typescript
@ApiPropertyOptional({
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    at: { type: 'string', format: 'date-time' },
  },
  nullable: true,
})
lastError?: { code: string; message: string; at: string } | null;
```

---

**[WARNING] `errorCode`가 `e.response?.code`에서 오므로 케이싱이 불확정 — `status_reason` 저장값 컨벤션 위반 가능**

- **위치:** `integrations.controller.ts` — `const errorCode = e.response?.code ?? 'OAUTH_CALLBACK_FAILED'`
- **상세:** `e.response.code`는 외부 Cafe24 API, 내부 NestJS 예외 등 다양한 출처에서 올 수 있고 케이싱이 보장되지 않는다. `markIntegrationCallbackError`가 이 값을 `status_reason`에 저장한다면, spec 컨벤션(`status_reason`은 `snake_case`, e.g. `oauth_token_exchange_failed`)을 위반한 값이 DB에 들어갈 수 있다. 기본값 `'OAUTH_CALLBACK_FAILED'`도 UPPER_SNAKE_CASE로, 기존 `status_reason` 값들(`auth_failed`, `token_expired`)과 불일치한다.
- **제안:** `markIntegrationCallbackError` 내부에서 `errorCode`를 `toLowerCase()` 처리하거나, 컨트롤러에서 넘기기 전에 정규화한다. `integration-oauth.service.ts` diff가 생략되어 서비스 측 처리를 확인할 수 없으므로 서비스 코드 검토를 권고한다.

---

**[INFO] `status-badge.tsx` — `pending_install` 오류 표시가 코드 문자열을 그대로 노출**

- **위치:** `status-badge.tsx` — `` const detail = integration.statusReason ? `Last error: ${integration.statusReason}` : ... ``
- **상세:** `statusReason`이 `oauth_token_exchange_failed`와 같은 기계 코드이므로 "Last error: oauth_token_exchange_failed"가 사용자에게 표시된다. `lastError.message`가 있다면 그쪽이 사람이 읽기에 적합하다.
- **제안:** `integration.lastError?.message`를 우선 표시하고, 없으면 `statusReason`으로 폴백한다.

---

**[INFO] `oauth-callback.template.spec.ts` — 정규식이 `function(){}` 바디 구조에 의존**

- **위치:** `oauth-callback.template.spec.ts` — `html.match(/setTimeout\([^,]+,\s*(\d+)\s*\)/)`
- **상세:** `[^,]+`가 함수 리터럴 `function(){ window.close(); }`에 콤마가 없다는 사실에 의존한다. 화살표 함수(`() => window.close()`)로 변경해도 통과하지만 객체 리터럴이나 여러 인자를 받는 형태로 바뀌면 깨진다. 기능적으로 지금 당장은 문제없으나 brittleness를 인지해야 한다.

---

## 요약

이번 변경(변경 0 — callback 실패 관측성)은 목적 자체는 명확하지만, catch 블록 내 `markIntegrationCallbackError` 호출이 예외를 던질 경우 사용자에게 전달되어야 할 OAuth 에러 HTML이 누락되는 결정적 경로 보호 결함이 존재한다. DB 기록 실패가 UX를 깨면 안 된다는 요구사항이 구현에 반영되지 않았다. 추가로 `lastError` 필드가 DTO에 추가됐지만 UI(status-badge)에서 실제로 활용되지 않아 사용자에게 노출되는 진단 정보가 불완전하며, `errorCode`의 케이싱 정규화 경로가 불명확해 DB `status_reason` 컨벤션 위반 가능성이 있다.

## 위험도

**MEDIUM** — Critical 1건(catch 블록 보호 누락)이 기존 사용자 피드백 경로를 막을 수 있으며, Warning 2건(lastError 미활용, errorCode 케이싱 불확정)은 관측성 기능의 완전성과 데이터 일관성에 직접 영향을 준다.