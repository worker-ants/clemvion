# Convention Compliance Review

**검토 모드**: `--impl-prep` (구현 착수 전)
**대상**: refactor 03 C-4 — `codebase/backend/src/modules/websocket/websocket.gateway.ts` 5개 명령 핸들러 인증+소유권 보일러플레이트 behavior-preserving 추출

---

## 발견사항

### 1. 명명 규약

- **[INFO]** `AuthenticatedSocket` 타입 alias 명명은 NestJS 생태계·TypeScript 관용어로 적절하다. `spec/conventions/` 에 TypeScript 타입 alias 명명 규약이 별도 존재하지 않으므로 위반 없음.

- **[INFO]** `getCommandAuthContext(client)` / `verifyExecutionOwnership(executionId, workspaceId)` 메서드 이름은 spec `6-websocket-protocol.md §7.1` 에서 규정한 "UNAUTHENTICATED/NOT_FOUND 코드 통일" 정책과 의미상 정렬되어 있다. 명명 자체는 규약 위반 없음.

- **[INFO]** 상수화 대상 메시지 문자열(`'Not authenticated'` / `'Not authorized for this execution'`)의 상수 이름은 `WsErrorCode` 의 명명 패턴(UPPER_SNAKE_CASE, `ws-error-codes.ts`)과 패밀리를 맞추도록 권장한다(`CMD_ERR_NOT_AUTHENTICATED = 'Not authenticated'` 등). 단 이는 `spec/conventions/error-codes.md` 가 소유하는 **코드 값** 이 아니라 사람 가독 메시지 문자열이므로 conventions 직접 위반은 아니다.

---

### 2. 출력 포맷 규약

- **[CRITICAL]** `getCommandAuthContext(client)` 가 `null` 반환 시 호출 핸들러가 ack payload 를 직접 조립해야 한다는 설계가 관철되지 않으면 spec `6-websocket-protocol.md §7.2` 의 **ack wire shape 분리** 원칙이 깨진다.

  - target 위치: 계획된 `getCommandAuthContext` helper 의 반환값 소비 패턴 전반
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §4.2` — "continuation 4종(`submit_form`/`click_button`/`submit_message`/`end_conversation`) 실패 ack 는 평면 `{ success: false, error: string, errorCode?: string }`, `retry_last_turn` 실패 ack 는 nested `{ success: false, error: { code, message } }` — 계층이 다른 것은 의도된 분리"
  - 상세: helper 가 ack payload 자체를 생성(`return { event, data: { success: false, error: ... } }`)하는 형태로 구현되면, retry_last_turn 의 nested `error: { code, message }` 와 4종 continuation 의 평면 `error: string, errorCode?: string` 를 동일 helper 경로로 묶을 수 없다. helper 가 **인증/소유권 판단 결과(null / 판단값)** 만 반환하고, **ack payload 조립은 각 핸들러가 담당** 해야 shape 불변식이 유지된다.
  - 제안: `getCommandAuthContext` 반환 타입을 `{ userId: string; workspaceId: string } | null`, `verifyExecutionOwnership` 반환 타입을 `boolean` 으로 한정하고, ack 조립은 핸들러별 분기로 유지한다. plan `03-maintainability.md §C-4` 권장안 A 가 이 원칙("ack 포맷 제어가 핸들러에 남아야 §7.2 shape 차이 보존 용이")을 정확히 기술하고 있다.

- **[WARNING]** `verifyExecutionOwnership` helper 의 예외 처리 전략이 명확하지 않다. 현재 `retry_last_turn` 핸들러는 소유권 실패 ack 에 nested `error: { code: WsErrorCode.NOT_FOUND, message: 'Execution not found' }` 를 사용하고 (line 677~689), 4종 continuation 핸들러는 평면 `{ success: false, error: 'Not authorized for this execution' }` 을 사용한다 (line 354~364 등).

  - target 위치: `handleRetryLastTurn` L677~689 vs `handleSubmitForm` L354~364, `handleClickButton` L430~439, `handleSubmitMessage` L506~514, `handleEndConversation` L575~585
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §4.2` (위 CRITICAL 동일)
  - 상세: helper 가 boolean 반환 시 **두 가지 소유권 실패 ack 포맷** 을 핸들러별로 분기해야 한다. helper 가 throw 로 구현되면 retry_last_turn catch 에서 nested error 를, 4종 continuation catch 에서 flat error 를 각각 조립해야 하는데, 이는 기존 핸들러별 try/catch 구조와 동형이라 추출 이득이 줄어든다. `verifyExecutionOwnership(boolean)` 후 각 핸들러가 if-branch 로 ack 를 직접 조립하는 방식이 spec §4.2 를 가장 명확히 보존한다.
  - 제안: helper 는 판단(true/false)만 반환하고, 핸들러별 소유권 실패 분기에서 자기 ack shape 을 직접 조립한다. 이 방식에서도 `verifyOwnership` try/catch 의 흡수라는 핵심 DRY 이득은 달성된다.

- **[INFO]** `§3.3` 구독 거부 평문 error 포맷(`{ success: false, error: 'Not authenticated' }`)은 `spec/5-system/6-websocket-protocol.md §3.3` 에서 명문화된 wire 계약이다. 이 포맷은 변경 범위 밖(plan scope "§3.3 subscribe 평문 error 포맷 미변경" 명시)으로 규약 준수 상태.

---

### 3. 문서 구조 규약

- **[INFO]** 본 refactor 는 "spec 변경 없음" 을 선언하고 있다. `spec/5-system/6-websocket-protocol.md` frontmatter `status: partial` + `pending_plans` 는 변경 없이 유지된다. `spec/conventions/spec-impl-evidence.md §3` 기준으로 행위 불변 리팩토링은 `code:` 글로브가 동일 파일을 가리키므로 frontmatter 갱신 불요. 규약 준수.

- **[INFO]** `websocket.gateway.ts` 는 `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 에 이미 등재되어 있다. 동일 파일 내 helper/alias 추가는 새 `code:` 항목을 요구하지 않는다.

---

### 4. API 문서 규약

- **[INFO]** `websocket.gateway.ts` 는 NestJS WebSocket 게이트웨이로 OpenAPI/Swagger 적용 대상이 아니다(`spec/conventions/swagger.md` 의 HTTP controller/DTO 패턴 해당 없음).

---

### 5. 금지 항목

- **[CRITICAL]** 상수화할 메시지 문자열 `'Not authenticated'` 가 `§3.3` 구독 거부 ack (L153, L192)에서도 사용된다. spec `§3.3` 은 이 평문 문자열을 **명문화된 wire 값** 으로 규정했으며, 상수화 시 값이 달라지면 spec 위반이 된다.

  - target 위치: `handleSubscribe` L153, L192 (`'Not authenticated'`)
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §3.3` — "권한 없으면 동일한 `subscribed` ack 에 `success: false` 와 평문 `error` 문자열로 응답한다 (전용 에러 코드 필드 없음)" + `{ "event": "subscribed", "data": { "success": false, "error": "Not authorized for this execution" } }` 예시
  - 상세: 5개 명령 핸들러 전용 상수(예: `CMD_ERR_NOT_AUTHENTICATED = 'Not authenticated'`)와 `subscribe` 핸들러가 공유하는 경우, **값이 동일**하면 wire 관점에서 허용된다. 단 리팩토링 과정에서 상수 값이 바뀌면 `subscribe` ack 도 함께 변경되어 spec 위반이 된다.
  - 제안: 상수화 후 값이 `'Not authenticated'` 로 정확히 유지되는지 확인하고, spec §3.3 에서 명문화한 문자열은 코드 주석으로 spec 참조를 명기한다(`// spec §3.3 명문 문자열 — 변경 금지`).

- **[WARNING]** `AuthenticatedSocket` 타입 alias 를 파일 로컬로 정의할 경우 `channel-authorizer.ts` 등 다른 파일이 동일 패턴을 독립 재정의하는 drift 가 생길 수 있다. `spec/conventions/` 에 이를 금지하는 규약은 없으나, `src/modules/websocket/` 공용 타입 파일에 두면 향후 재사용성이 높아진다. 단 본 refactor scope(단일 파일 behavior-preserving) 에서는 파일 로컬 정의가 허용된다.

---

## 요약

정식 규약 준수 관점에서 가장 중요한 위험은 **spec §4.2 ack wire shape 불변식** 이다. `getCommandAuthContext` / `verifyExecutionOwnership` helper 가 ack payload 자체를 생성하는 방향으로 구현되면, continuation 4종의 평면 `{success, error, errorCode?}` 와 `retry_last_turn` 의 nested `{success, error: {code, message}}` 를 동일 helper 로 묶을 수 없어 spec 위반이 발생한다. plan `03-maintainability.md §C-4` 권장안 A 가 "ack 포맷 제어가 핸들러에 남아야 §7.2 shape 차이 보존 용이"로 이미 이 제약을 명시했으므로, 구현 시 **helper 는 판단 결과만 반환하고 ack 조립은 각 핸들러 소유** 라는 경계를 지켜야 한다. `§3.3` 구독 거부 평문 error 문자열은 spec 명문 계약이므로 상수화 시 값 동일성을 반드시 유지해야 한다. 그 외 명명·문서 구조·Swagger 규약은 모두 준수 상태이거나 해당 없음이다.

## 위험도

MEDIUM
