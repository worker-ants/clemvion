## 발견사항

---

**[WARNING] 역전된 오류 컨텍스트 흐름 — 서비스가 컨트롤러에 side-channel 정보를 주입**

- 위치: `integrations.controller.ts` catch 블록, `integration-oauth.service.ts` `callbackContextOf` export
- 상세: 서비스가 에러 객체에 `{integrationId, workspaceId, mode}` 컨텍스트를 부착해 throw → 컨트롤러가 `callbackContextOf(err)`로 추출 → 다시 서비스를 호출하는 제어 흐름이 형성됩니다. 이는 Service → (error throw) → Controller → (context extraction) → Service 로 이어지는 역방향 의존 고리로, SRP와 레이어 책임 분리 원칙을 동시에 위반합니다. 서비스가 실패 기록 여부를 스스로 판단하지 않고, 컨트롤러에게 해당 결정을 위임한 설계입니다.
- 제안: `markIntegrationCallbackError`를 서비스 내부에서 직접 호출하거나, 타입드 예외 클래스(`class OAuthCallbackException extends Error { integrationId: ...; }`)를 도입해 컨트롤러가 `instanceof`로 분기하도록 변경합니다. `callbackContextOf`를 서비스 파일에서 export하는 패턴은 서비스의 내부 에러 구조가 컨트롤러 레이어에 누출되는 경계 위반입니다.

---

**[WARNING] `lastError` DTO 타입이 `Record<string, unknown>` — API 계약 약화**

- 위치: `integration-response.dto.ts:44`
- 상세: `last_error` 필드의 구조는 `{code: string, message: string, at: string}`으로 이미 명확히 정의되어 있음에도 DTO에서 `Record<string, unknown>`으로 타입이 선언되어 있습니다. Swagger 문서에도 `additionalProperties: true`로만 기술됩니다. API 응답 DTO는 계약의 경계이므로 구조가 알려진 경우 반드시 강타입을 사용해야 합니다.
- 제안: `lastError?: { code: string; message: string; at: string } | null`로 구체화하고, `@ApiPropertyOptional`의 `type`도 인라인 스키마 대신 별도 클래스(`LastErrorDto`)로 분리합니다.

---

**[WARNING] 컨트롤러에 비즈니스 결정 로직 존재**

- 위치: `integrations.controller.ts` catch 블록 (errorCode 추출, ctx 유효성 검사, 조건부 서비스 호출)
- 상세: 에러 코드 기본값 설정(`?? 'OAUTH_CALLBACK_FAILED'`), 컨텍스트 존재 여부에 따른 기록 여부 결정, 기록 후 HTML 렌더링으로 이어지는 흐름은 비즈니스 규칙입니다. 컨트롤러는 HTTP 요청/응답 변환만 담당해야 하며, "어떤 조건에서 에러를 기록하는가"는 서비스 레이어의 책임입니다.
- 제안: 서비스에 `handleCallbackError(err, context)` 형태의 메서드를 두어 에러 코드 추출·기록·예외 재분류를 서비스 내부에서 완결하고, 컨트롤러는 결과만 받아 HTML 렌더링에 집중하도록 합니다.

---

**[INFO] `oauth-callback.template.ts`의 매직 넘버 4000ms**

- 위치: `oauth-callback.template.ts`
- 상세: `setTimeout(function(){ window.close(); }, 4000)` 의 4000이 상수화되지 않았습니다. 이 지연값은 "사용자가 오류 메시지를 읽을 수 있는 최소 시간"이라는 도메인 의미를 가지며, 스펙에서 "3~5초 지연"으로 기술된 범위의 하드코딩입니다.
- 제안: `const ERROR_CLOSE_DELAY_MS = 4000`으로 명명하거나, 함수 파라미터로 주입 가능하게 만들어 테스트 유연성을 높입니다.

---

**[INFO] FE `status-badge.tsx` — 기술 코드가 사용자 메시지에 직접 노출**

- 위치: `status-badge.tsx:22`
- 상세: `\`Last error: ${integration.statusReason}\``은 `oauth_token_exchange_failed` 같은 snake_case 기술 코드를 그대로 UI에 노출합니다. 이는 프레젠테이션 레이어가 도메인 코드와 직접 결합된 상태입니다.
- 제안: `statusReason → 사용자 친화적 메시지` 매핑 테이블을 별도 파일에 두거나, 백엔드가 이미 `lastError.message`를 함께 내려주므로 해당 필드를 우선 사용합니다.

---

## 요약

변경 0(callback 실패 관측성)의 핵심 구현은 기능적으로 올바르지만 아키텍처적으로 두 가지 구조적 문제를 내포합니다. 첫째, 서비스가 throw한 에러에서 컨트롤러가 컨텍스트를 추출해 다시 서비스를 호출하는 역방향 제어 흐름은 레이어 경계를 허문 설계로, 추후 에러 처리 로직 변경 시 컨트롤러와 서비스를 동시에 수정해야 하는 결합을 만듭니다. 둘째, `lastError` DTO의 `Record<string, unknown>` 타입과 서비스 내부 에러 구조가 `callbackContextOf`를 통해 컨트롤러에 노출되는 것은 API 계약과 모듈 경계 모두를 약화시킵니다. 나머지 변경(팝업 자동 닫기 지연, FE 상태 배지)은 범위가 좁고 책임이 명확합니다.

## 위험도

**LOW** — 기능 정확성에 즉각적 영향은 없으나, 서비스↔컨트롤러 간 에러 컨텍스트 흐름이 향후 에러 처리 확장 시 의도치 않은 결합점이 될 수 있습니다.