# 요구사항(Requirement) Review — websocket.gateway.ts C-4

## 발견사항

### [INFO] `AuthenticatedSocket` 타입 필드가 `optional`로 정의된 이유 명확성
- 위치: `type AuthenticatedSocket = Socket & { userId?: string; workspaceId?: string; }` (파일 상단)
- 상세: `userId`/`workspaceId` 가 optional 인 것은 `handleConnection` 이 JWT 검증 성공 후 enrich 하기 때문이다. 검증 실패 시 `disconnect()` 를 즉시 호출하지만 TypeScript 타입 레벨에서는 미인증 소켓도 해당 타입으로 cast 될 수 있다. `getCommandAuthContext` 가 `!enriched.userId` null 가드를 두어 실질적 안전은 보장되어 있다. 잠재적 오용 위험은 낮으나 optional 필드를 단언(cast)하는 패턴이므로 INFO 수준으로 기재.
- 제안: 현 상태 유지 가능. 주석에 "인증 실패 시 disconnect 보장" 이 이미 명시되어 있어 충분.

### [INFO] `verifyExecutionOwnership` — 모든 예외를 `false` 로 흡수
- 위치: `private async verifyExecutionOwnership(...)` (약 line 759–769)
- 상세: `catch {}` 가 DB 오류, 네트워크 오류, `NotFound`, 소유 불일치를 모두 `false` 로 환원한다. 이는 기존 개별 핸들러들의 `try/catch → 거부 ack` 패턴과 의미론적으로 동일한 behavior-preserving 추출이다. DB 일시 장애를 403/404 와 동일하게 처리하는 점은 보안상 안전(fail-closed)이지만 운영 관점에서는 DB 오류와 소유권 불일치가 구분되지 않는다. spec §7.1 IDOR 정책("NotFound 통일") 과는 일치하므로 spec 위반은 아님.
- 제안: INFO. 현재 동작은 spec 의도에 부합한다.

### [INFO] `handleSubscribe` 의 `workspaceId` 부재 가드가 `MSG_NOT_AUTHENTICATED` 를 공유하지 않는 이유
- 위치: `handleSubscribe` 내부 `if (!workspaceId)` 분기 (subscribe 핸들러 내)
- 상세: subscribe 경로의 `"Not authenticated"` 리터럴은 상수화되지 않고 그대로 남아 있다. 커밋 메시지 및 코드 주석에 "subscribe §3.3 평문 문자열 경로는 미변경 — 커플링 차단" 이라 명시되어 있고, spec §3.3 은 구독 거부를 평문 `error` 문자열로 응답한다고 규정하여 별도 계약임이 확인된다. 의도적 분리이므로 위반 아님.

### [INFO] `handleUnsubscribe` 인증 가드 없음
- 위치: `handleUnsubscribe` 핸들러 전체
- 상세: 구독 해제 핸들러에는 userId 인증 확인이 없다. 비인증 소켓(이론상 도달 불가 — `handleConnection` 이 disconnect)이 임의 채널 unsubscribe 를 시도해도 `clientSubs.delete` 와 `client.leave` 만 호출된다. spec §3.3 / §3.4 어디에도 구독 해제 인증 요구사항이 없으므로 spec 위반 아님. 실질적 위험 미미.

### [INFO] 5개 명령 핸들러 중 `executionId` 유효성 검증 부재
- 위치: 각 핸들러 진입부 (`handleSubmitForm` 등)
- 상세: `data.executionId` 가 UUID 형식인지, null/undefined 인지 별도 검증이 없다. `verifyExecutionOwnership` → `executionsService.verifyOwnership` 이 NotFound 로 처리하므로 기능적으로 안전하게 거부된다. spec §4.2 에 클라이언트 입력 유효성 검증 요구사항이 명시되어 있지 않다. 현재 동작 수준은 spec 기대 범위 내.

---

## 기능 완전성 평가

### 1. 기능 완전성
C-4 의 목표(보일러플레이트 helper 추출)는 완전히 달성되었다.
- `AuthenticatedSocket` alias 로 모든 인라인 `Socket & {...}` 단언이 통합됨 (`handleConnection`, `handleSubscribe` 내 2곳, `emitExecutionSnapshot` 호출부, 5개 명령 핸들러 전체).
- `getCommandAuthContext` 가 명령 핸들러 5종 진입부 공통 인증 null 가드를 담당.
- `verifyExecutionOwnership` 이 소유권 확인 try/catch 를 boolean 로 중앙화.
- 상수 `MSG_NOT_AUTHENTICATED` / `MSG_NOT_AUTHORIZED_EXECUTION` 로 거부 메시지 일원화.

### 2. 엣지 케이스
- `workspaceId` 누락(JWT 에 미포함) 시 `''` 정규화 → `verifyOwnership` 이 소유 불일치로 처리: 기존 동작 보존 확인.
- `userId` 는 falsy 값 가드(`!enriched.userId`): 빈 문자열 userId 가 있으면 null 반환 — `handleConnection` 이 `payload.sub` 로 enrich 하고 빈 sub 는 정상 JWT 발급 시 불가하므로 실질적 위험 없음.
- `data.executionId` 가 빈 문자열이거나 undefined 인 경우 `verifyOwnership` 에서 NotFound 로 처리되어 소유권 거부 ack 반환: 기능적으로 안전.

### 3. TODO/FIXME
코드 전체에 `TODO`, `FIXME`, `HACK`, `XXX` 주석 없음. 확인 완료.

### 4. 의도와 구현 간 괴리
- 커밋 메시지 "behavior-preserving 추출" 주장과 코드가 일치한다. 거부 ack 조립은 각 핸들러에 남아 있고, helper 는 식별자/boolean 만 반환한다.
- `getCommandAuthContext` 주석 "subscribe 경로에는 적용하지 않는다" → 실제 `handleSubscribe` 는 이 helper 를 호출하지 않음: 일치.
- `verifyExecutionOwnership` 주석 "Forbidden 금지 — NotFound 통일" → catch 가 모든 예외를 false 로 환원: 일치.

### 5. 에러 시나리오
- 미인증 소켓: `getCommandAuthContext` 가 null 반환 → 각 핸들러가 자신의 ack shape 으로 거부.
- 소유권 불일치: `verifyExecutionOwnership` 이 false 반환 → 핸들러가 거부 ack.
- continuation 4종 후속 catch: `buildContinuationErrorAck` 경로 — 변경 없음, spec §7.5.2 계약 유지.
- `retry_last_turn` catch: `RetryLastTurnError` / `InvalidExecutionStateError` 분기 — 변경 없음.

### 6. 데이터 유효성
입력 검증 범위는 기존과 동일하다. C-4 는 인증/소유권 보일러플레이트만 추출했고 payload 필드 검증 로직을 추가하거나 제거하지 않았다.

### 7. 비즈니스 로직 (spec 정렬)
- **IDOR 정책 (spec §7.1)**: `verifyOwnership` NotFound 통일 — 기존 개별 핸들러 정책과 동일. helper 추출 후에도 소유 불일치는 NotFound 로 귀결된다(throw → catch → false). 보존 확인.
- **§7.2 ack wire shape**: continuation 4종은 flat `{success,error}`, `retry_last_turn` 은 nested `{error:{code,message}}` — helper 가 ack 를 조립하지 않고 각 핸들러가 소유. spec §7.2 의 shape 분리 보존 확인.
- **§4.2 retry_last_turn UNAUTHENTICATED/NOT_FOUND 코드 및 'Execution not found' 문구**: 핸들러가 직접 `WsErrorCode.UNAUTHENTICATED` / `WsErrorCode.NOT_FOUND` / `'Execution not found'` 를 하드코딩 — spec §4.2 실패 ack 예시 `{ code: "NOT_FOUND", message: "..." }` 와 일치. (메시지 정확값 `'Execution not found'` 는 spec 예시에 `"..."` 로 생략되어 있으나 코드와 테스트가 일치한다고 커밋 메시지 확인.)
- **§3.3 subscribe 거부 — 평문 문자열**: subscribe 경로의 리터럴은 상수화하지 않아 계약 격리 유지. spec 일치.

### 8. 반환값
- `getCommandAuthContext`: 미인증 시 `null`, 인증 시 `{userId, workspaceId}`. 모든 경로 반환값 정의됨.
- `verifyExecutionOwnership`: `true`/`false`. 모든 경로 정의됨 (catch → `false`).
- 5개 핸들러: 인증 실패, 소유권 실패, 비즈니스 로직 실패, 성공 각 경로에서 명시적 return. 모든 경로 반환값 있음.

### 9. Spec fidelity

관련 spec: `spec/5-system/6-websocket-protocol.md`

**§7.1 IDOR 정책 (Not_Found 통일)**: 코드 일치. 소유 불일치·DB 오류 모두 false 로 환원, 핸들러가 Not_Found 의미의 거부 ack 반환.

**§7.2 ack 형식**: 코드 일치. continuation 4종 = flat `{success,error,errorCode?}`, retry_last_turn = nested `{error:{code,message}}`. helper 가 shape 를 건드리지 않음.

**§4.2 retry_last_turn 실패 ack**: spec §4.2 의 `{ success:false, executionId, nodeExecutionId, resumed:false, error:{code,message} }` 와 코드 반환값 일치 (UNAUTHENTICATED 분기, NOT_FOUND 분기, INTERNAL_ERROR 분기 모두).

**§3.3 구독 거부 평문 문자열**: `handleSubscribe` 의 `"Not authenticated"` / `"Not authorized for this channel"` 리터럴이 유지됨. spec 일치.

**spec drift 없음**: 이번 C-4 변경 범위는 순수 리팩터링(behavior-preserving)이며 spec 에 새 동작을 추가하지 않는다. spec 갱신 대상 없음.

---

## 요약

이번 C-4 변경은 `WebsocketGateway` 의 5개 명령 핸들러에서 반복되던 인증+소유권 보일러플레이트를 `getCommandAuthContext` / `verifyExecutionOwnership` helper 와 `AuthenticatedSocket` 타입 alias 로 추출한 behavior-preserving 리팩터링이다. spec §7.1(IDOR NotFound 통일), §7.2(ack wire shape 분리), §4.2(retry_last_turn nested error), §3.3(subscribe 평문 거부) 모두 코드와 line-level 로 일치한다. 상수 값이 기존 문자열 리터럴과 동일하게 보존되어 wire 계약 변화가 없다. CRITICAL 또는 WARNING 발견사항 없음. 모든 발견사항은 INFO 수준이며 운영상 위험도 없다.

---

## 위험도

NONE
