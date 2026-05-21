# Testing Review — External Interaction API (PR2)

## 발견사항

### [INFO] 파일 1 — i18n 사전 (triggers.ts): 테스트 없음, 허용 수준
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
- 상세: `externalInteraction` 네임스페이스에 16개의 새 키가 추가됨. i18n 사전 상수는 테스트 대상으로 보기 어렵고, 타입 시스템(`as const`)이 오타를 빌드 시 어느 정도 걸러줌. 그러나 대응되는 영문(`en/triggers.ts`) 키와의 구조 일치성을 자동 검증하는 테스트가 없다.
- 제안: `en/triggers.ts`의 `externalInteraction` 키 대응 여부를 스냅샷 또는 키 집합 비교 테스트로 확인하는 것이 이상적. 현재는 런타임에 undefined silently가 노출될 수 있음. 단, 이 패턴은 프로젝트 기존 방식과 일관된 수준이므로 INFO로 분류.

---

### [INFO] 파일 2 — SDK README.md: 테스트 대상 아님
- 위치: `codebase/packages/sdk/README.md`
- 상세: 문서 파일이므로 테스트 대상 아님. README의 코드 예시가 실제 SDK 타입과 일치하는지 자동 검증(doctest)은 없으나, 이는 일반적인 패턴. 단, `verifyNotificationSignature`의 세 번째 인자(secret)가 문서 예시에서 `process.env.CLEMVION_NOTIFICATION_SECRET!`로 사용되는데, 실제 함수 시그니처와 일치함.

---

### [WARNING] 파일 4 — client.spec.ts: `subscribeToExecution` 테스트 부재
- 위치: `codebase/packages/sdk/src/client.spec.ts`
- 상세: `ClemvionClient`의 6개 public 메서드 중 `subscribeToExecution`에 대한 테스트가 전혀 없음. 이 메서드는 SSE 스트림 파싱(`parseSseFrame` 내부 함수 포함), `AbortController` 기반 연결 종료, `lastSeq` 추적, onError 콜백, non-ok 응답 처리 등 복잡한 비동기 로직을 포함. SDK의 핵심 기능인 SSE 구독이 무테스트 상태.
  - 누락된 커버리지 경로:
    1. SSE 스트림 성공 수신 → `onEvent` 호출 + `lastSeq` 갱신
    2. 비-2xx 응답(SSE_CONNECT_FAILED) → `onError` 호출
    3. `close()` 호출 후 이벤트 수신 안 됨 (AbortController.abort 동작)
    4. heartbeat comment 프레임(`: heartbeat\n\n`) → null 반환, `onEvent` 미호출
    5. `lastEventId` 쿼리 파라미터가 URL에 올바르게 붙는지 확인
    6. `onEvent` 핸들러가 throw해도 스트림이 계속 진행되는지
- 제안: Node.js 환경의 ReadableStream mock 또는 `TextEncoder`/`TransformStream`을 활용한 SSE 스트림 stub을 구성해 최소한 happy path + close + SSE_CONNECT_FAILED 3케이스를 추가.

---

### [WARNING] 파일 4 — client.spec.ts: `parseSseFrame` 엣지 케이스 미커버
- 위치: `codebase/packages/sdk/src/client.ts` (내부 함수 `parseSseFrame`)
- 상세: `parseSseFrame`은 module-private 함수로 직접 테스트할 수 없으나, `subscribeToExecution` 통합 테스트를 통해 간접 검증이 필요함. 현재 테스트가 없으므로 다음 경로가 미커버:
  - `id:` 없는 프레임 (seq=NaN → `Number.isFinite` false) → null 반환 확인
  - `data:` 가 유효하지 않은 JSON → null 반환 확인
  - comment-only 프레임(`: heartbeat`) → null 확인
  - 멀티라인 `data:` 누적 (현재 코드는 `data +=` 방식이므로 멀티라인 지원 여부)
- 제안: `subscribeToExecution` 테스트 추가 시 다양한 SSE 프레임 형식을 포함시켜 간접 커버.

---

### [WARNING] 파일 4 — client.spec.ts: webhookHeaders 미명시 시 기본 Content-Type 누락 검증
- 위치: `codebase/packages/sdk/src/client.spec.ts`, `triggerWebhook` 테스트
- 상세: `webhookHeaders` 옵션이 있을 때 `Authorization` 머지를 검증하지만, `Content-Type: application/json`이 항상 포함되는지 명시적으로 확인하지 않음. `interact` 테스트에서는 `Content-Type` 검증이 있으나, `triggerWebhook`의 happy path에는 없음.
- 제안: 기존 테스트에 `Content-Type` assertion 추가. 낮은 위험도이나 회귀 방지용.

---

### [WARNING] 파일 4 — client.spec.ts: `cancel`의 reason 미명시 케이스 미테스트
- 위치: `codebase/packages/sdk/src/client.spec.ts`
- 상세: `cancel` 테스트가 `reason='user_aborted'` 케이스만 다룸. `reason` 미명시 시(`cancel('exec-1', 'token')`) body가 `{ reason: undefined }` → `JSON.stringify` 시 `{}` 로 직렬화됨. 이 동작이 의도적인지 검증 없음.
- 제안: `reason` 생략 시 body가 `{}` 또는 `{ reason: undefined }` 중 어느 것인지 명시적으로 테스트하거나, 구현에서 `undefined` 필드를 제거하도록 처리 후 검증.

---

### [INFO] 파일 7 — signature.spec.ts: hmac-sha512 테스트 미포함
- 위치: `codebase/packages/sdk/src/signature.spec.ts`
- 상세: `verifyNotificationSignature`의 모든 테스트가 `'hmac-sha256'`만 사용. `'hmac-sha512'` 알고리즘 경로는 `computeNotificationSignature`의 단순 통과이지만, SDK 레벨에서도 한 건의 통합 확인이 있으면 좋음. processor 쪽 테스트(`notification-webhook.processor.spec.ts`)에서는 sha512 검증이 포함됨.
- 제안: SDK signature.spec에도 sha512 minimal case 추가 권장 (INFO 수준, critical 아님).

---

### [INFO] 파일 7 — signature.spec.ts: toleranceSec 커스텀 옵션 미테스트
- 위치: `codebase/packages/sdk/src/signature.spec.ts`
- 상세: `opts.toleranceSec` 파라미터를 커스텀 값으로 사용하는 케이스가 없음. 기본값(5분)이 아닌 경우에도 window 계산이 올바른지 확인 없음.
- 제안: `toleranceSec: 10`을 명시해 window 경계값 테스트 추가 권장.

---

### [INFO] 파일 5 — client.ts: `globalThis.fetch` 없을 때 constructor throw 테스트 미존재
- 위치: `codebase/packages/sdk/src/client.ts`, constructor 가드
- 상세: `globalThis.fetch`가 없는 환경에서 `fetchImpl`도 미명시 시 constructor가 throw하는 경로를 테스트하지 않음. Node 18 이하 환경 대응 유효성 확인 안 됨.
- 제안: `new ClemvionClient({ baseUrl: '...' })` 호출 시 `globalThis.fetch = undefined`로 설정한 테스트 추가.

---

### [WARNING] 백엔드 — InteractionController 통합 테스트 부재
- 위치: `codebase/backend/src/modules/external-interaction/` — controller 레이어
- 상세: `interaction.service.spec.ts`, `interaction.guard.spec.ts`, `interaction-token.service.spec.ts` 등 서비스/가드 단위 테스트는 충실하게 존재하지만, `InteractionController` 자체에 대한 NestJS `Test.createTestingModule` 기반 통합 테스트 파일이 없음. Spec EIA §P4에서 controller 통합 테스트를 계획했으나 현재 파일 목록에서 `interaction.controller.spec.ts`가 보이지 않음.
  - 미검증 사항:
    1. `@Controller('external/executions')` + global prefix = `/api/external/executions/*` 라우팅 정합성
    2. `InteractionGuard`가 controller에 올바르게 바인딩됐는지 (NestJS DI 검증)
    3. Idempotency middleware가 controller 레이어에서 작동하는지 (unit 레벨에서만 검증 가능한지 불명)
    4. `@ApiTags`, `@ApiBearerAuth` 등 Swagger 데코레이터가 올바른 위치에 적용됐는지는 통합 테스트로만 확인 가능
    5. SSE stream controller(`interaction-stream.controller.ts`)의 Content-Type `text/event-stream` 응답 헤더 검증
- 제안: NestJS `Test.createTestingModule`로 최소한 라우팅 + guard 바인딩 + 응답 shape를 검증하는 `interaction.controller.spec.ts` 추가.

---

### [WARNING] 백엔드 — hooks.service.spec.ts: interaction 토큰 동봉 회귀 테스트 커버리지 불완전
- 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts`
- 상세: `HooksService`에 `InteractionTokenService`가 주입됐고 mock이 제공되지만, 실제로 `interaction.enabled=true` + `tokenStrategy='per_execution'` 시 응답에 `interaction` 필드가 포함되는지를 검증하는 케이스가 보이지 않음(파일을 80줄까지만 확인). 이는 Spec §P6의 핵심 동작.
- 제안: 기존 spec 파일에 `interaction.enabled=true` trigger fixture 추가 + 응답의 `interaction.token`, `interaction.endpoints` 필드 검증 케이스 추가.

---

### [INFO] 백엔드 — SSE adapter: 5분 buffer 만료(TTL) 자동 폐기 테스트 없음
- 위치: `codebase/backend/src/modules/external-interaction/sse-adapter.service.spec.ts`
- 상세: 현재 buffer 상한(1000개 초과 시 오래된 항목 폐기)은 테스트되어 있으나, 시간 기반 TTL(5분 경과 이벤트 폐기)에 대한 테스트가 없음. 실제 구현이 시간 기반 폐기를 하는지도 spec에서 요구하는 "5분 buffer".
- 제안: `jest.useFakeTimers()`를 이용한 TTL 기반 buffer 폐기 테스트 추가 권장.

---

### [INFO] e2e — 시나리오 D(토큰 갱신), E(HMAC 검증), F(SSRF), G(동시 race) 부분 범위 제한
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts`
- 상세: e2e 파일 상단 주석에 "BullMQ Redis / Webhook 발송 자체는 검증하지 않음"이 명시됨. Plan §5의 시나리오 A(Form 자동화), B(AI Multi Turn), D(토큰 만료 + refresh), G(race)는 e2e에서 full-stack 검증이 어려운 사정이 있으나, 특히 시나리오 G(동시 submit_form → 409 STATE_MISMATCH)는 단위 테스트에서도 race condition 시나리오가 없음.
- 제안: `interaction.service.spec.ts`에 `Promise.all([interact(...), interact(...)])` 형태의 동시 호출 테스트 또는 명시적 409 경로 테스트 추가.

---

### [WARNING] NotificationDispatcher 테스트: 실제 processor와의 계약 단절 위험
- 위치: `codebase/backend/src/modules/external-interaction/notification-dispatcher.service.spec.ts`
- 상세: `NotificationDispatcher.enqueue` 테스트는 BullMQ `queue.add`가 올바른 payload/options로 호출되는지만 검증하고, 실제 `NotificationWebhookProcessor.process`는 별도 파일에서 독립 테스트됨. 두 클래스 사이의 계약(payload 타입 `NotificationWebhookJob`)이 mock을 통해 간접적으로 유지됨. 현재 구조는 테스트 격리 관점에서 올바르지만, payload 스키마 변경 시 두 테스트 파일에서 동시에 맞춰야 함.
- 제안: `NotificationWebhookJob` 타입을 공유 schema(zod 등)로 관리하거나, 계약 변경 시 컴파일 에러로 잡히도록 DTO 타입 활용을 강화.

---

## 요약

SDK(`@workflow/sdk`) 쪽은 `client.spec.ts`와 `signature.spec.ts`가 핵심 경로를 잘 커버하지만, `subscribeToExecution`(SSE 스트림 구독) 메서드 전체가 테스트 공백으로 남아 있는 것이 가장 큰 갭이다. 이 메서드는 스트림 파싱, AbortController 기반 종료, onError 전파 등 복잡한 비동기 로직을 포함하므로 버그가 발생해도 테스트에서 잡히지 않는다. 백엔드 쪽은 서비스·가드·프로세서 레이어의 단위 테스트가 체계적으로 존재하지만, Controller 레이어 통합 테스트가 부재하여 NestJS 라우팅·미들웨어·가드 바인딩이 런타임에서 올바른지 자동 검증할 방법이 없다. 또한 `hooks.service`에서 interaction 토큰 동봉 여부를 검증하는 회귀 케이스가 확인되지 않아 핵심 happy path의 e2e 신뢰도가 낮다. e2e 테스트는 인증·endpoint·응답 shape의 cross-stack 정합성에 집중하는 방향으로 의도적으로 scope를 좁혔으며 주석으로 명시되어 있어 판단 자체는 이해 가능하다. 전반적으로 보안·암호 관련 로직(서명 검증, 토큰 blacklist, SSRF, 타이밍 안전 비교)의 테스트 품질은 우수하다.

## 위험도

MEDIUM

STATUS=success
