# 정식 규약 준수 검토 — refactor 03 C-4 WebsocketGateway 인증/소유권 보일러플레이트 추출

검토 모드: `--impl-done` (구현 완료 후 검토)
검토 대상: `codebase/backend/src/modules/websocket/websocket.gateway.ts` diff (origin/main...HEAD)
검토 기준: `spec/conventions/` 전체

---

## 발견사항

### [INFO] `MSG_NOT_AUTHENTICATED` / `MSG_NOT_AUTHORIZED_EXECUTION` 상수가 `spec/conventions/` 에 wire 문자열로 미등재
- **target 위치**: `codebase/backend/src/modules/websocket/websocket.gateway.ts` lines 64–65 (신규 상수)
- **위반 규약**: `spec/conventions/error-codes.md §1` 의 직접 위반은 아니나, 코드 주석("값은 명문 wire 문자열 — 변경 금지(테스트가 정확한 값을 검증)")으로 테스트 계약임을 선언한 두 문자열이 `spec/conventions/` 에 SoT 없이 코드 상수로만 존재한다.
- **상세**: `spec/5-system/6-websocket-protocol.md §3.3` 은 구독 거부의 평문 `"Not authorized for this execution"` 을 예시로 적고 있으나, 명령 핸들러(5개) 공통 거부 문자열을 정의하는 규약 문서가 없다. `MSG_NOT_AUTHENTICATED = 'Not authenticated'` 는 인증 거부 wire 문자열이고 `MSG_NOT_AUTHORIZED_EXECUTION = 'Not authorized for this execution'` 은 소유권 거부 wire 문자열인데, 두 문자열의 정식 SoT 가 `spec/conventions/` 나 `spec/5-system/6-websocket-protocol.md` 의 어느 절에도 정의되어 있지 않다.
- **제안**: `spec/5-system/6-websocket-protocol.md §7.1` 또는 신규 subsection 에 "명령 핸들러 공통 거부 ack 문자열" 을 명시하는 것이 이상적이나, 이는 spec 갱신 작업이며 본 C-4 의 behavior-preserving refactor 범위 밖이다. 후속 spec 동기화 트랙(plan/in-progress/spec-sync-websocket-protocol-gaps.md)에 등재 가능.

---

### [INFO] `AuthenticatedSocket` 타입 alias — 공개 API 명명 규약 적용 대상 아님
- **target 위치**: `codebase/backend/src/modules/websocket/websocket.gateway.ts` lines 44–57 (신규 type alias)
- **위반 규약**: 없음. `spec/conventions/swagger.md §1` 의 DTO 명명 패턴(`*Dto`, `*Response`)은 공개 API DTO 대상이며, 파일 내부 TypeScript 타입 alias 에는 적용되지 않는다.
- **상세**: `AuthenticatedSocket` 은 모듈 내부 단언 타입 alias 로 공개 API surface 가 아니며, 규약 적용 대상이 아니다. 이름은 의미를 기술하고 충돌이 없다.
- **제안**: 현재 패턴 유지. 추가 조치 불필요.

---

### [INFO] `getCommandAuthContext` / `verifyExecutionOwnership` private helper 이름 — 규약 일치
- **target 위치**: `codebase/backend/src/modules/websocket/websocket.gateway.ts` lines 358, 380 (신규 private methods)
- **위반 규약**: 없음. `spec/conventions/` 에 private method 명명 규약은 별도로 정의되어 있지 않다. 두 이름 모두 `camelCase`, 의미 기술(`error-codes.md §1` 정신과 일치), 인라인 문자열 대신 상수 사용.
- **제안**: 현재 패턴 유지.

---

### [INFO] `WsErrorCode.UNAUTHENTICATED` 참조 — canonical SoT 준수
- **target 위치**: diff의 `retry_last_turn` 핸들러 인증 실패 ack `code: WsErrorCode.UNAUTHENTICATED`
- **위반 규약**: 없음. `codebase/backend/src/modules/websocket/ws-error-codes.ts` 의 `WsErrorCode` canonical object 를 import 해 사용하고 있어 인라인 문자열 리터럴 금지 관행을 준수한다. `spec/5-system/6-websocket-protocol.md §7.1` 의 `UNAUTHENTICATED` 코드 계약과 일치.
- **제안**: 현재 패턴 유지.

---

### [INFO] ack wire shape 보존 — §4.2/§7.2 계약 준수
- **target 위치**: diff 전체 — 5개 명령 핸들러의 거부 ack 반환 구조
- **위반 규약**: 없음. 검토 결과 wire shape 이 보존되어 있음.
- **상세**:
  - 4개 continuation 명령(`submit_form`/`click_button`/`submit_message`/`end_conversation`)의 거부 ack 는 `{ success: false, error: string }` 평면 형태 유지. 상수(`MSG_NOT_AUTHENTICATED` / `MSG_NOT_AUTHORIZED_EXECUTION`)로 치환됐을 뿐 wire 값은 동일.
  - `retry_last_turn` 의 거부 ack 는 `{ success: false, resumed: false, error: { code: WsErrorCode.UNAUTHENTICATED, message: MSG_NOT_AUTHENTICATED } }` nested 형태 유지. spec §4.2 의 "continuation 4종 flat / retry nested" 의도적 분리 보존.
  - `spec/5-system/6-websocket-protocol.md §4.2` ack 형태 계약과 일치.
- **제안**: 현재 패턴 유지.

---

### [INFO] `spec/conventions/spec-impl-evidence.md` frontmatter — 해당 없음
- **target 위치**: 변경 파일은 `codebase/backend/...` (코드베이스)
- **위반 규약**: 없음. spec-impl-evidence frontmatter 의무는 `spec/**/*.md` 대상이며, `codebase/` 파일 변경에는 적용되지 않는다. 본 C-4 는 spec 변경 없음으로 선언됐고 실제로 `spec/` diff 가 없다.
- **제안**: 현재 상태 유지.

---

### [INFO] `MSG_*` 상수 명명 (`UPPER_SNAKE_CASE`) — audit-actions 규약과 무관
- **target 위치**: `codebase/backend/src/modules/websocket/websocket.gateway.ts` lines 64–65
- **위반 규약**: 없음. `spec/conventions/audit-actions.md §1` 의 `<resource>.<verb>` / 토큰 규칙은 감사 로그 `action` 식별자 전용이다. `MSG_NOT_AUTHENTICATED` / `MSG_NOT_AUTHORIZED_EXECUTION` 은 WS ack 평문 문자열 상수이며 audit action 이 아니다. 상수명 자체는 `UPPER_SNAKE_CASE` 를 따르고 의미를 기술한다.
- **제안**: 현재 패턴 유지.

---

## 요약

refactor 03 C-4 의 구현 변경(WebsocketGateway 인증+소유권 보일러플레이트 추출)은 `spec/conventions/` 의 정식 규약을 직접 위반하는 항목이 없다. `AuthenticatedSocket` 타입 alias, `getCommandAuthContext`/`verifyExecutionOwnership` private helper 명명, `WsErrorCode` canonical object 참조, 5개 핸들러 ack wire shape 보존 모두 기존 규약과 충돌하지 않는다. 유일한 관찰 사항은 코드 주석이 "테스트가 검증하는 wire 계약" 으로 선언한 두 평문 거부 문자열(`'Not authenticated'` / `'Not authorized for this execution'`)의 정식 SoT 가 `spec/conventions/` 나 `spec/5-system/6-websocket-protocol.md` 에 없다는 INFO 수준 관찰이며, 이는 spec 동기화 후속 작업 트랙에 해당한다.

## 위험도

NONE
