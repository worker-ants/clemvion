### 발견사항

- **[WARNING]** `lastError` 필드의 타입이 `additionalProperties: true`로 정의되어 API 계약이 불명확함
  - 위치: `integration-response.dto.ts` +38~44
  - 상세: `lastError?: Record<string, unknown> | null`을 `additionalProperties: true`로 Swagger에 노출하면 프론트엔드/소비자가 실제 필드 목록(`code`, `message`, `at`)을 스키마에서 파악할 수 없음. 응답 계약이 암묵적으로만 유지됨
  - 제안: `properties: { code: { type: 'string' }, message: { type: 'string' }, at: { type: 'string', format: 'date-time' } }`로 구체화하거나, 전용 DTO 클래스로 분리

- **[WARNING]** `status` 필드의 `enum`에 `pending_install` 추가는 additive breaking change 가능성 존재
  - 위치: `integration-response.dto.ts` +35
  - 상세: 클라이언트가 `switch/if-else`로 status를 열거하다가 `default`(또는 fallthrough) 처리가 없으면 `pending_install`을 받을 때 렌더링 오류 발생. 엄밀히 breaking change는 아니지만 방어적으로 다루지 않은 클라이언트는 영향받음. 프론트엔드(`status-badge.tsx`)는 이미 처리하고 있으나 외부 소비자는 미확인
  - 제안: 릴리스 노트에 "additive status value" 명시 및 클라이언트 방어 코드 권장 문서화

- **[INFO]** `callbackContextOf(err)` 추출 후 `markIntegrationCallbackError` 호출이 `await` 실패 시 에러를 삼킴
  - 위치: `integrations.controller.ts` +313~320
  - 상세: `markIntegrationCallbackError` 실패 시 예외가 이미 `catch` 블록 안에 있어 별도 핸들링 없이 무시됨. 진단 기록 실패가 사용자에게 투명하지 않음. API 계약 위반은 아니지만 관측성(observability) 관점에서 주의 필요
  - 제안: `try { await this.oauthService.markIntegrationCallbackError(...) } catch (diagErr) { this.logger.error(...) }` 패턴으로 진단 실패 로깅

- **[INFO]** OAuth callback 엔드포인트가 HTML을 반환(`text/html`)하는데 에러 응답에도 200 OK를 사용
  - 위치: `integrations.controller.ts` +321~327, `oauth-callback.template.ts`
  - 상세: popup → postMessage 패턴이므로 의도된 설계이나, HTTP 레벨 에러 상태(`4xx/5xx`)를 사용하지 않아 서버 모니터링/로그 집계에서 에러 비율이 누락됨. API 계약 문서에 "성공/실패 모두 200 + HTML body" 명시 필요
  - 제안: Swagger에 `@ApiResponse({ status: 200, description: 'OAuth callback result (HTML). Success/error embedded in HTML body via postMessage.' })` 주석 보강

---

### 요약

이번 변경의 핵심은 `IntegrationDto`에 `pending_install` status 값과 `lastError` 필드를 추가하고, OAuth callback 실패 시 `pending_install` 행의 진단 정보를 기록하는 것이다. 하위 호환성 측면에서 기존 `status` enum에 값 추가는 additive 변경이므로 방어적으로 구현된 클라이언트에는 영향이 없으나, 프론트엔드(`status-badge.tsx`)처럼 모든 status를 명시적으로 처리하는 코드에는 이미 반영되어 있어 정상이다. 가장 큰 API 계약 결함은 `lastError`의 Swagger 스키마가 `additionalProperties: true`로 불투명하게 정의된 점으로, 스키마 기반 클라이언트 생성 시 타입 정보가 손실된다.

### 위험도
**LOW**