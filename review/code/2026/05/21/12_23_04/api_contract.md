# API 계약(API Contract) 리뷰 결과

> 대상 변경: External Interaction API (EIA) 구현 — SDK + i18n + 문서
> 검토 파일: 12개 (triggers.ts i18n, SDK README/package.json/client.ts/client.spec.ts/signature.ts/signature.spec.ts/index.ts/tsconfig.json, plan, consistency check 산출물)

---

## 발견사항

### [WARNING] SSE 스트림 엔드포인트에서 토큰을 쿼리 파라미터로 전달
- 위치: `codebase/packages/sdk/src/client.ts` — `subscribeToExecution` 메서드, 라인 1116–1117
- 상세: SSE 구독 URL이 `?token=${encodeURIComponent(token)}&lastEventId=${handlers.lastEventId}` 형태로 `Bearer` 토큰을 쿼리 파라미터로 전달한다. EventSource API는 커스텀 헤더를 지원하지 않아 불가피한 측면이 있으나, 쿼리 파라미터 토큰은 서버 액세스 로그·브라우저 히스토리·Referer 헤더에 평문으로 노출된다. spec(plan §2.3 `interaction-token.guard.ts` 항목)에서 "SSE 의 `?token=` query 양쪽 지원"으로 명시적으로 허용하고 있으므로 계약 위반은 아니지만, SDK README에 이 보안 트레이드오프에 대한 명시적 주의사항이 없다.
- 제안: README에 SSE 구독 시 `token`이 쿼리 파라미터로 전달됨을 명시하고, 토큰 유효시간(1h per_execution)이 짧다는 완화 요소를 언급한다.

### [WARNING] `triggerWebhook` 응답 스키마 unwrap 이중 처리 — 일관성 불명확
- 위치: `codebase/packages/sdk/src/client.ts` 라인 1022–1024 및 `parseJsonOrThrow` 라인 1190–1191
- 상세: `triggerWebhook` 과 `parseJsonOrThrow` 모두 `parsed.data ?? (parsed as unknown as T)` 패턴을 사용해 백엔드가 `{ data: ... }` 래퍼를 사용하는 경우와 아닌 경우 모두 허용한다. `client.spec.ts`에서는 `triggerWebhook` 성공 케이스가 `{ data: { executionId: ... } }` 래퍼 형태를 검증하고, `refreshToken` 성공 케이스(라인 654–659)는 래퍼 없는 `{ token, expiresAt }` 형태를 검증한다. 실제 백엔드 응답이 엔드포인트마다 래퍼 유무가 다르다면 SDK가 두 형태를 허용하는 것은 계약 불명확을 SDK 레벨에서 흡수하는 것이 된다. 응답 스키마 일관성이 백엔드에서 보장되지 않을 경우 SDK 사용자가 혼란을 겪을 수 있다.
- 제안: 백엔드의 모든 External Interaction 엔드포인트가 `{ data: ... }` 래퍼를 일관되게 사용하도록 보장하고, SDK의 이중 처리는 하위 호환 fallback 임을 JSDoc 주석에 명시한다. `getStatus` / `refreshToken` 도 래퍼를 포함한 mock response로 테스트케이스를 보강하는 것이 권장된다.

### [WARNING] `cancel` 메서드가 `/cancel` 전용 엔드포인트를 호출하나 README는 `interact` alias로 표기
- 위치: `codebase/packages/sdk/README.md` API 섹션 라인 401 및 `client.ts` 라인 1050–1062
- 상세: README에서 `cancel`을 "편의 alias (`POST /:id/cancel`)"로 기술하고 있으나, `interact` 메서드는 `POST /interact` 엔드포인트를 사용하고 `cancel`은 `POST /cancel`을 별도로 호출한다. `interact({ command: 'cancel' })`와 `cancel()`이 서로 다른 백엔드 엔드포인트로 라우팅된다면 이는 단순 alias가 아니라 별도 계약이다. 실제로 plan §2.3에서 두 엔드포인트가 병렬로 정의되어 있어 동일 로직에 대한 두 개의 URL 진입점이 존재한다. 외부 클라이언트 입장에서 어느 것을 써야 하는지 모호하다.
- 제안: README에서 `cancel()`과 `interact({ command: 'cancel' })`의 차이(엔드포인트, Idempotency-Key 자동 발급 여부 등)를 명확히 구분하거나, 백엔드에서 두 URL이 동일 핸들러로 수렴됨을 명시한다.

### [WARNING] `InteractRequest`에서 `cancel` 커맨드가 별도 `cancel()` 메서드와 중복 노출
- 위치: `codebase/packages/sdk/src/client.ts` 라인 893–898 (`InteractCommand` 타입 정의)
- 상세: `InteractCommand`에 `'cancel'`이 포함되어 있어 `interact({ command: 'cancel' })`로 취소가 가능하면서 동시에 `cancel()` 메서드도 별도 존재한다. SDK 계약 표면에서 동일 의도의 작업에 두 경로가 있다. `cancel` 커맨드를 `interact` 바디로 전달할 경우 Idempotency-Key가 자동 발급되지만, 별도 `cancel()` 메서드에는 현재 Idempotency-Key가 없다(`buildHeaders(token)` 호출, 라인 1058).
- 제안: `cancel()` 메서드에도 `Idempotency-Key`를 자동 발급하거나(멱등성 보장), 두 경로 중 하나를 권장 경로로 문서화한다. 현재 상태는 같은 취소 작업에 대해 멱등성 보장 수준이 달라지는 API 계약 불일치다.

### [INFO] `refreshToken` 응답에서 `{ data: ... }` 래퍼 없이 테스트됨
- 위치: `codebase/packages/sdk/src/client.spec.ts` 라인 654–664
- 상세: `refreshToken` 테스트가 `jsonResponse({ token: 'iext_new', expiresAt: '...' })`로 래퍼 없는 응답을 mock하고 있다. `parseJsonOrThrow`의 `parsed.data ?? parsed` fallback에 의해 동작하지만, 실제 백엔드가 `{ data: { token, expiresAt } }` 형태로 응답한다면 테스트가 백엔드 계약을 정확히 검증하지 못한다.
- 제안: 실제 백엔드 응답 형식에 맞춘 mock으로 테스트를 보강한다.

### [INFO] SDK 버전(`0.1.0`)에 API 버전 정보 없음
- 위치: `codebase/packages/sdk/package.json` 라인 436
- 상세: 현재 SDK는 `0.1.0`으로 시작하며 버전 관리 전략(SemVer, breaking change 정책 등)이 README에 없다. External Interaction API는 외부 시스템이 소비하는 공개 계약이므로 breaking change 정책을 명시하는 것이 중요하다. 특히 `SseEvent`, `InteractCommand`, `TriggerWebhookResult` 등의 타입이 변경될 경우의 versioning 정책이 없다.
- 제안: README에 버전 정책(SemVer major bump = breaking change) 및 현재 v0 alpha 상태임을 명시한다.

### [INFO] `verifyNotificationSignature`의 서명 헤더 이름 오기 가능성
- 위치: `codebase/packages/sdk/README.md` 라인 259–260 및 `signature.ts` JSDoc
- 상세: 코드와 문서는 `X-Clemvion-Signature` 헤더를 사용한다고 명시하고 있으며, plan §2.4에도 동일하게 기술되어 있다. 일관성은 있다. 다만 SDK README 예제(라인 260)에서 `req.headers['x-clemvion-signature']`(소문자)를 사용하는데, Express에서는 헤더가 자동으로 소문자로 정규화되어 문제가 없으나, 다른 프레임워크(Fastify raw 등)에서는 대소문자 처리가 달라 주의가 필요하다.
- 제안: README 예제에 헤더 이름 정규화에 대한 짧은 주석을 추가한다.

---

## 요약

이번 변경은 External Interaction API의 SDK 클라이언트(`@workflow/sdk`)와 프론트엔드 i18n 사전을 새로 추가한 것이다. 하위 호환성 관점에서는 신규 패키지 추가이므로 기존 API 클라이언트에 대한 breaking change는 없다. SDK의 인증 메커니즘(Bearer 토큰 + Idempotency-Key)과 에러 처리(`ClemvionApiError`)는 일관성 있게 설계되었으며, HMAC 서명 검증(`verifyNotificationSignature`)은 timing-safe 비교와 5분 timestamp window를 올바르게 구현하고 있다. 다만 SSE 토큰을 쿼리 파라미터로 전달하는 보안 트레이드오프, `{ data: ... }` 래퍼 처리 불일치, `cancel` 커맨드의 이중 경로(멱등성 수준 차이 포함), SDK 버전 정책 미명시 등 외부 소비자와의 계약 명확성 측면에서 WARNING 수준의 보완이 필요하다. 전반적으로 API 계약의 핵심 구조는 견고하며, 식별된 문제들은 계약 파괴보다는 명확성·일관성 보완에 가깝다.

---

## 위험도

MEDIUM

STATUS=success ISSUES=7
