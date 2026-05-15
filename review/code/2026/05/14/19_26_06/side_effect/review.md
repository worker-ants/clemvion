코드 변경사항을 부작용 관점에서 분석합니다.

---

### 발견사항

---

**[WARNING] catch 블록 내 `await` — DB 쓰기 실패 시 HTTP 응답 미전송**

- **위치**: `integrations.controller.ts` catch 블록, `markIntegrationCallbackError` 호출부
- **상세**: 콜백 오류 핸들러에서 `await this.oauthService.markIntegrationCallbackError(...)` 가 reject 되면, 그 아래 `res.send(renderCallbackHtml(...))` 가 실행되지 않는다. 결과적으로 팝업 창이 응답 없이 걸리고 자동 닫힘도 동작하지 않는다. OAuth 콜백 팝업 특성상 사용자가 직접 닫아야 하는 상황이 되는데, 이는 관측성 향상이라는 변경 목적을 역행하는 부작용이다.
- **제안**: `markIntegrationCallbackError` 호출을 별도 try-catch로 감싸 DB 쓰기 실패가 응답을 막지 않도록 격리:
  ```typescript
  try {
    await this.oauthService.markIntegrationCallbackError(...);
  } catch (recordErr) {
    // 관측성 기록 실패는 응답을 차단하지 않음
  }
  ```

---

**[WARNING] `errorCode` 추출 경로 — NestJS 예외 구조 불일치**

- **위치**: `integrations.controller.ts` — `const errorCode = e.response?.code ?? 'OAUTH_CALLBACK_FAILED'`
- **상세**: NestJS `HttpException`의 `response`는 `{ statusCode, message, error }` 구조를 갖는다. `code` 필드는 없다. 커스텀 예외가 `response.code`를 채우지 않는 한 `errorCode`는 항상 `'OAUTH_CALLBACK_FAILED'`로 고정되고, `markIntegrationCallbackError`에 저장되는 진단 코드가 의도한 값(`OAUTH_TOKEN_EXCHANGE_FAILED` 등)이 아닌 폴백값으로 채워진다. 관측성 개선의 핵심 목표를 달성하지 못하는 조용한 실패다.
- **제안**: `integration-oauth.service.ts`의 throw 경로에서 실제로 `response.code`를 설정하는지 확인 필요. 설정하지 않는다면 에러 코드 추출 로직을 service 측의 커스텀 예외 필드(예: `err.errorCode`)에서 읽도록 `callbackContextOf` 확장 또는 별도 접근자 사용을 검토.

---

**[INFO] `IntegrationDto.lastError` 필드 — `additionalProperties: true` 개방형 스키마**

- **위치**: `integration-response.dto.ts` — `lastError?: Record<string, unknown> | null`
- **상세**: Swagger 정의에 `additionalProperties: true`가 선언되어 스키마 계약이 완전히 열려 있다. 타입스크립트 타입도 `Record<string, unknown>`이라 컴파일 타임 검증이 없다. DB에 저장된 `last_error` JSONB가 그대로 클라이언트에 노출되는데, 암호화된 `last_error` 필드를 그대로 내려보낼 경우 복호화된 민감한 OAuth 토큰 조각이 포함될 수 있다 (consistency-check rationale_continuity 리뷰에서 지적된 동일 관점).
- **제안**: 내려보낼 필드를 `{ code: string; message: string; at: string }` 형태로 DTO에서 명시적으로 선언하고, service 계층에서 필드를 선택적으로 투영해 노출 범위를 제한.

---

**[INFO] `status-badge.tsx` — `statusReason` 원시값 직접 노출**

- **위치**: `status-badge.tsx` — `` detail: `Last error: ${integration.statusReason}` ``
- **상세**: DB 저장값인 `statusReason`이 가공 없이 UI에 노출된다. 현재 값이 `oauth_token_exchange_failed` 같은 코드 문자열이라 사용자에게 읽기 어렵다. 또한 외부 OAuth 제공자 에러 메시지가 statusReason에 포함될 경우 원하지 않는 내용이 노출될 수 있다. React의 JSX 문자열 자동 이스케이프로 XSS 위험은 없으나 UX 일관성 문제는 존재한다.
- **제안**: `statusReason` 코드를 사람이 읽을 수 있는 메시지로 매핑하는 함수를 두거나, `lastError.message`를 우선 사용하는 것을 검토.

---

**[INFO] `expired` 상태의 `detail` 필드 신규 추가 — 기존 렌더러 영향**

- **위치**: `status-badge.tsx` — `expired` 분기에 `detail` 조건부 추가
- **상세**: 기존에 `expired` 케이스는 `detail` 없이 반환되었으나, `install_timeout` 조건에서 `detail`이 채워진다. `StatusView` 타입에서 `detail`이 optional이면 기존 소비자에 영향이 없다. 그러나 `detail` 유무를 분기 조건으로 사용하는 UI 코드가 있다면 `install_timeout` expired 행에서 새 UI 요소가 의도치 않게 나타날 수 있다.

---

### 요약

가장 실질적인 위험은 **컨트롤러 catch 블록 내 `await` 호출**이다. `markIntegrationCallbackError`가 실패하면 OAuth 콜백 팝업이 빈 채로 걸리는 UX 장애가 발생하며, 이는 관측성 향상이라는 변경 목적과 직접 충돌한다. `errorCode` 추출 경로가 NestJS 예외 구조와 맞지 않아 기록되는 진단 정보가 항상 폴백값(`OAUTH_CALLBACK_FAILED`)이 될 가능성도 높다. 나머지 변경(DTO 추가, 템플릿 지연 닫힘, FE 배지 로직)은 가산적 변경으로 기존 동작을 깨지 않는다.

### 위험도

**MEDIUM** — catch 블록 격리 미처리 시 OAuth 콜백 팝업 무응답 장애 가능. 1개 try-catch 추가로 해소 가능.