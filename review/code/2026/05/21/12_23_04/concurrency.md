# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] SSE 루프 내 `void (async () => { ... })()` 패턴 — 에러 격리 적절
- 위치: `codebase/packages/sdk/src/client.ts` — `subscribeToExecution()` (라인 1119~1164)
- 상세: SSE 스트림 읽기 루프를 `void (async () => { ... })()` 패턴으로 분리해 호출자를 블로킹하지 않는다. 이는 이벤트 루프 블로킹 방지로 올바른 설계다. `AbortController`로 외부에서 종료 신호를 보낼 수 있으며, abort된 경우 `controller.signal.aborted` 체크로 spurious error 전파를 차단한다.
- 제안: 현행 패턴 유지. 다만 `onEvent` 핸들러 내부에서 예외가 발생하면 `onError`로 전달하면서 루프가 계속 돌아가는데, `onError` 콜백에서 다시 예외가 발생할 경우 unhandled rejection이 될 수 있다. `onError?.(...)` 호출 자체도 try/catch로 감싸는 것을 권장한다.

### [INFO] `lastSeqRef` 객체 공유 — 단일 스레드 환경에서 안전
- 위치: `codebase/packages/sdk/src/client.ts` — `subscribeToExecution()` (라인 1113, 1148, 1167)
- 상세: `lastSeqRef = { value: ... }` 는 SSE 읽기 루프 내부와 `lastSeq()` 클로저 간에 공유된다. Node.js/브라우저 환경은 단일 스레드이므로 경쟁 조건이 발생하지 않는다. SSE 루프가 `lastSeqRef.value`를 갱신하는 시점과 외부가 `lastSeq()`를 읽는 시점이 충돌하지 않는다.
- 제안: 해당 없음. JavaScript 이벤트 루프 모델에서 안전.

### [INFO] `interact()` — 멱등성 키 자동 생성 (`randomUUID`)
- 위치: `codebase/packages/sdk/src/client.ts` — `interact()` (라인 1040)
- 상세: `init.idempotencyKey ?? randomUUID()` 로 매 호출마다 새 UUID를 발급한다. 이는 재시도 시 동일 키를 재사용하지 않을 수 있다는 의미로, 네트워크 오류 후 호출자가 무작정 `interact()`를 재호출하면 서버에 중복 커맨드가 도달할 수 있다. 이는 동시성 문제라기보다 API 설계 상의 트레이드오프이며, SDK의 README에 명시(idempotencyKey 미명시 시 UUIDv4 자동 발급)되어 있으므로 정보 수준으로 기록한다.
- 제안: 재시도 패턴을 사용하는 호출자는 반드시 `idempotencyKey`를 명시적으로 관리해야 함을 SDK 문서에 강조할 것. 현행 README에 언급은 있으나 "재시도 시 동일 키 재사용 필수" 경고가 없다.

### [INFO] `subscribeToExecution()` — 동시 다중 호출 시 복수 SSE 연결
- 위치: `codebase/packages/sdk/src/client.ts` — `subscribeToExecution()` (라인 1104~1168)
- 상세: `ClemvionClient` 인스턴스는 내부에 연결 상태를 보관하지 않는다. 동일 `executionId`에 대해 `subscribeToExecution()`을 복수 호출하면 복수의 SSE 연결이 병렬 생성된다. 서버 측에서 동시 연결 제한(plan §2.7 — default 3)을 두고 있으므로 클라이언트가 관리하지 않더라도 서버에서 429로 차단된다.
- 제안: SDK 차원에서는 허용 설계. 서버 제한으로 방어되어 있음.

## 요약

변경 코드는 `codebase/packages/sdk/src/client.ts`(SSE 구독 포함 SDK 클라이언트), `codebase/packages/sdk/src/signature.ts`(HMAC 검증), `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`(정적 상수), 패키지 설정 파일, 문서·plan·일관성 검토 파일로 구성된다. 동시성 관점에서 실질적 위험은 없다. SDK는 JavaScript 단일 스레드 환경을 올바르게 전제하며, SSE 루프는 `AbortController`로 안전하게 종료되고, 서명 검증 함수는 순수 동기 함수다. `void` IIFE 기반 SSE 루프에서 `onError` 콜백 자체가 예외를 던질 경우 unhandled rejection이 될 수 있다는 점과, 멱등성 키 자동 발급 패턴에서 재시도 시 동일 키 재사용 누락 위험이 INFO 수준으로 존재한다.

## 위험도

NONE

STATUS=success ISSUES=0
