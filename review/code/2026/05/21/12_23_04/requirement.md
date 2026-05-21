# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [WARNING] `subscribeToExecution` — 자동 재연결(Auto-Reconnect) 미구현 (기능 완전성)
- 위치: `codebase/packages/sdk/src/client.ts` `subscribeToExecution` 메서드, 주석 라인 "Last-Event-Id 자동 재연결은 v1 에서 미지원"
- 상세: README API 섹션에는 "handlers.lastEventId 로 재연결"이라 기술되어 있고, README 예제에는 `lastEventId` 파라미터를 활용하는 SSE 재연결이 자연스럽게 동작하는 것처럼 서술되어 있다. 그러나 실제 구현은 연결이 끊기면 `onError` 콜백만 호출하고 자동 재연결을 수행하지 않는다. 호출자가 `onError` 핸들러에서 직접 `subscribeToExecution`을 재호출해야 하지만, 이 패턴이 README 에 명확히 안내되어 있지 않다. spec EIA §5.2의 `Last-Event-Id` 재연결 보장 항목을 SDK가 투명하게 지원하지 않으므로 외부 통합 개발자가 직접 재연결 로직을 구현해야 한다는 사실이 의도와 구현 간 괴리를 만든다.
- 제안: README 사용 예 §2 (AI Multi Turn 대화) 섹션에 "연결 해제 시 `onError`에서 `lastSeq()`를 읽어 재호출해야 한다"는 패턴을 코드 예시로 추가. 또는 `subscribeToExecution` 내부에 재연결 로직(`maxRetries`, backoff)을 선택적으로 구현.

---

### [WARNING] `subscribeToExecution` — SSE 토큰 query param 전달 방식, 보안 의도와 구현 불일치 (의도와 구현 간 괴리)
- 위치: `codebase/packages/sdk/src/client.ts` 라인 1112–1114, `subscribeToExecution` querystring 구성
- 상세: `interact`, `cancel`, `refreshToken`, `getStatus` 메서드는 모두 `Authorization: Bearer <token>` 헤더로 토큰을 전달한다. 그러나 `subscribeToExecution`은 `?token=<token>` query parameter로 전달한다. spec `interaction-token.guard.ts` 항목에서 "Bearer 헤더 + SSE의 `?token=` query 양쪽 지원"이라 명시하므로 기능은 동작하지만, query parameter 방식은 토큰이 HTTP 서버 로그, 브라우저 히스토리, 리퍼러 헤더에 노출될 위험이 있다. 인터랙션 토큰(`iext_*`, `itk_*`)의 민감도를 고려할 때, 가능하면 `Authorization` 헤더를 우선해야 하고 query param은 브라우저 EventSource API와 같이 헤더 설정이 불가능한 환경에서만 사용해야 한다. SDK가 fetch 기반으로 구현되어 있어 헤더 전달이 가능한데도 query param을 사용한다.
- 제안: fetch 기반 SSE 구현에서는 `Authorization` 헤더를 `buildHeaders(token)` 경유로 전달하고, query param의 `token=` 을 제거하거나 fallback으로 격하. 단, `handlers.lastEventId`가 있을 경우 `?lastEventId=<seq>` 는 유지.

---

### [WARNING] `parseSseFrame` — 다중 `data:` 라인 누적 방식의 엣지 케이스 (엣지 케이스)
- 위치: `codebase/packages/sdk/src/client.ts` `parseSseFrame` 함수, 라인 1203
- 상세: SSE 표준(WHATWG)에 따르면 하나의 이벤트 프레임에 `data:` 라인이 여러 개 있을 경우 줄바꿈(`\n`)을 구분자로 concatenation해야 한다. 현재 구현은 `data += line.slice(5).trim()`으로 단순 string append 를 하며 줄바꿈 없이 이어 붙인다. 서버가 JSON을 여러 `data:` 라인으로 분할하여 전송하면 파싱이 실패한다. spec이 `data:` 단일 라인 JSON을 명시하더라도, 서버 구현에 따라 큰 payload가 분할될 수 있고 이 경우 `JSON.parse` 오류로 `null`이 반환되어 이벤트가 무음으로 드롭된다.
- 제안: `data += '\n' + line.slice(5).trim()` 또는 SSE 표준 방식(`data:` 각 라인을 배열로 수집 후 `\n` join)으로 수정. 최종 `JSON.parse` 전에 `data.trim()` 적용.

---

### [WARNING] `cancel` 메서드 — `reason` 미전달 시 `{ reason: undefined }` body 전송 (엣지 케이스)
- 위치: `codebase/packages/sdk/src/client.ts` `cancel` 메서드, 라인 1056
- 상세: `reason` 파라미터가 `undefined`인 경우 `JSON.stringify({ reason: undefined })`는 `{}` 가 아니라 `{}`를 반환한다. 실제로 `JSON.stringify({ reason: undefined })`는 `{}` (reason 키 자체가 누락된 객체)를 반환하므로 이 경우는 정상이다. 단, `cancel` 메서드가 `interact` 메서드의 "편의 alias"로 문서화되어 있으나 `Idempotency-Key` 헤더를 추가하지 않는다. `interact` 는 자동으로 `randomUUID()`로 Idempotency-Key를 발급하지만 `cancel`은 그렇지 않아, 동일 request가 재시도되어 중복 처리될 수 있다. spec EIA §5.4에서 `/cancel` 엔드포인트의 Idempotency-Key 요구 여부가 명확하지 않으나, 안전한 취소 처리를 위해 멱등성이 권장된다.
- 제안: `cancel` 메서드에도 `Idempotency-Key` 헤더를 자동 발급(`randomUUID()`)하도록 `buildHeaders`에 포함. 또는 README에 "cancel은 Idempotency-Key를 자동 발급하지 않으므로 네트워크 재시도 시 중복 호출 주의" 명시.

---

### [WARNING] `triggerWebhook` — `endpointPath`에 슬래시 포함 시 URL 이중 인코딩 위험 (엣지 케이스)
- 위치: `codebase/packages/sdk/src/client.ts` `triggerWebhook` 메서드, 라인 1005
- 상세: `encodeURIComponent(endpointPath)`는 슬래시(`/`)를 `%2F`로 인코딩한다. spec에서 `endpointPath`가 단순 슬러그인지 슬래시를 포함한 계층적 경로인지 명확하지 않다. README 예시는 `'my-endpoint-path'` (슬래시 없음)이지만, spec `POST /api/hooks/:endpointPath`에서 `:endpointPath` 파라미터가 와일드카드 경로를 허용하는 경우 `encodeURIComponent`는 의도와 다르게 동작한다. 테스트 코드(`client.spec.ts` 라인 552)에서 `'abc'`를 입력 시 올바른 URL `https://api.clemvion.ai/api/hooks/abc`를 확인하지만, `'path/to/hook'`의 경우는 검증하지 않는다.
- 제안: spec에서 `endpointPath`의 형식(단일 세그먼트 슬러그 vs 다중 세그먼트 경로)을 확인 후, 다중 세그먼트를 허용한다면 `encodeURI` 또는 세그먼트별 `encodeURIComponent` 방식으로 수정. 단일 세그먼트만 허용이라면 슬래시 포함 입력 시 에러를 throw하는 입력 유효성 검증 추가.

---

### [INFO] `baseUrl` 유효성 검증 부재 (데이터 유효성)
- 위치: `codebase/packages/sdk/src/client.ts` `ClemvionClient` 생성자, 라인 986
- 상세: 생성자는 `baseUrl`의 trailing slash만 제거하고, URL 형식의 유효성(스키마 포함 여부, 빈 문자열 등)은 검증하지 않는다. `baseUrl = ''`인 경우 모든 API 호출이 `encodeURIComponent(executionId)` 등의 상대 경로로 fetch를 시도하여 런타임 오류가 늦게 발생한다. `fetchImpl` 유효성(`typeof !== 'function'`)은 검증하지만 `baseUrl`은 검증하지 않는 비대칭이 있다.
- 제안: 생성자에서 `new URL(this.baseUrl)`으로 파싱을 시도해 유효하지 않은 URL 형식이면 즉시 `Error`를 throw.

---

### [INFO] i18n `externalInteraction.notificationSecretRotate` — 영문 혼재 (비즈니스 로직)
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 라인 45
- 상세: 한국어 dict 파일이지만 `notificationSecretRotate: "Secret rotation"` 은 한국어 번역 없이 영문 그대로다. 다른 키들(`notificationUrl: "수신 URL"`, `healthHealthy: "정상"` 등)은 한국어로 번역되어 있어 일관성이 없다. spec 정책상 `ko` 로케일은 모든 키에 한국어 값을 요구한다(i18n-userguide Principle 1).
- 제안: `notificationSecretRotate: "Secret 교체"` 또는 `"시크릿 교체"` 등 한국어로 번역.

---

### [INFO] `verifyNotificationSignature` — `rawBody` Buffer 입력 미지원 (엣지 케이스)
- 위치: `codebase/packages/sdk/src/signature.ts` `verifyNotificationSignature` 함수
- 상세: 파라미터 타입이 `rawBody: string`으로 고정되어 있다. Express의 `req.rawBody`는 Buffer인 경우가 많아 README 예제처럼 직접 전달하면 타입 오류가 발생한다(TypeScript strict 환경). README 예제 코드 `req.rawBody`는 Express에서 `Buffer` 또는 `string`일 수 있다.
- 제안: `rawBody: string | Buffer` 타입으로 허용하고, Buffer 입력 시 `rawBody.toString('utf8')`로 변환. 또는 README에 명시적으로 `req.rawBody.toString()` 을 사용하도록 안내.

---

### [INFO] `package.json` — `ts-jest` 버전 불일치 위험 (비즈니스 로직)
- 위치: `codebase/packages/sdk/package.json` devDependencies
- 상세: `jest: "^30.0.0"`, `ts-jest: "^29.2.5"` 가 함께 명시되어 있다. `ts-jest ^29`는 `jest ^29`와 호환되며 `jest ^30`은 `ts-jest ^30`을 요구한다. 버전 불일치로 설치 또는 실행 시 오류가 발생할 수 있다.
- 제안: `ts-jest: "^30.0.0"`으로 업데이트하거나 실제 호환 가능한 버전 조합을 확인 후 명시.

---

## 요약

SDK(`@workflow/sdk`)의 핵심 기능(triggerWebhook, interact, cancel, refreshToken, getStatus, verifyNotificationSignature)은 spec EIA §4~§6 의 요구사항을 대체로 구현하고 있다. 서명 검증 로직은 timing-safe 비교, ±5분 window, secret rotation 지원이 완전히 구현되어 있고 단위 테스트도 주요 경계값(malformed, 시간 초과, rotation)을 검증한다. 그러나 SSE 구독(`subscribeToExecution`)에서 자동 재연결 미지원이 README 서술과 괴리를 만들며, 토큰을 query param으로 전달하는 보안 의도 불일치, `parseSseFrame`의 다중 `data:` 라인 처리 미준수가 기능 완전성 관점에서 주의가 필요한 항목이다. i18n ko dict의 `notificationSecretRotate` 미번역과 `ts-jest`/`jest` 버전 불일치는 낮은 위험이지만 수정이 권장된다. TODO/FIXME 주석은 발견되지 않았다.

## 위험도

MEDIUM

STATUS=success
