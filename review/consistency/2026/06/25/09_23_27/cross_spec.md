# Cross-Spec 일관성 검토 결과

검토 대상: refactor 03 C-4 — WebsocketGateway 인증+소유권 보일러플레이트 추출
검토 모드: --impl-prep (구현 착수 전)

---

## 발견사항

발견된 CRITICAL/WARNING 충돌 없음. 이하 INFO 1건.

---

### **[INFO]** `retry_last_turn` 핸들러의 auth 실패 ack shape 이 형제 핸들러와 다름 — 상수화 시 혼용 주의

- **target 위치**: `websocket.gateway.ts` `handleRetryLastTurn` (line 662) — 미인증 시 `error: { code: WsErrorCode.UNAUTHENTICATED, message: 'Not authenticated' }` nested object 반환.
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` — `retry_last_turn` ack 실패는 `{ success: false, ..., error: { code, message } }` nested 형태로 명시. 형제 4종 continuation 핸들러(submit_form/click_button/submit_message/end_conversation)는 평면 `{ success: false, error: string }` 사용 (§4.2 "실패 ack 형태": "`retry_last_turn` 은 nested `error: { code, message }` 를 쓰는 것만 다르다").
- **상세**: 이 차이는 spec §4.2 가 의도적으로 기록한 사항이므로 spec 모순이 아니다. 단, C-4 가 `'Not authenticated'` 문자열을 상수화할 때, 4종 continuation 핸들러(평면 `error: string`)와 `retry_last_turn`(nested `error.message: string`)이 **같은 상수를 다른 위치에 쓰는** 구조가 되는데, 이는 의도된 재사용이고 spec 위반이 아니다. `verifyExecutionOwnership` helper 도 boolean 반환이고 ack 조립은 각 핸들러가 유지하므로 wire shape 은 보존된다.
- **제안**: `getCommandAuthContext` / `verifyExecutionOwnership` helper 가 ack 조립 자체를 캡슐화하지 않는 설계(plan 대로)를 유지하면 충돌 없음. `retry_last_turn` 의 nested shape 와 4종의 평면 shape 차이를 helper 주석에 한 줄 기록해 두면 후속 변경 시 drift 방지에 도움이 된다.

---

## 요약

C-4 리팩터는 순수 내부 구현 추출(타입 alias, private helper 2개, 문자열 상수화)이며 외부 wire shape 을 변경하지 않는다. 검토한 spec 영역(spec/5-system/6-websocket-protocol.md §1.2·§3.3·§4.2·§7.1·§7.2, spec/1-data-model.md Workspace/WorkspaceMember, spec/0-overview.md RBAC)과의 직접 모순은 없다. `AuthenticatedSocket` 타입 alias 는 `handshake` 인리치 경로에서 이미 설정된 `userId`/`workspaceId` 를 그대로 참조하며 spec §1.2 인증 흐름과 일치한다. `verifyExecutionOwnership` 의 NotFound 통일 정책은 spec §7.1 의 IDOR 차단 원칙을 보존한다. 唯一한 INFO 는 `retry_last_turn` 의 nested ack shape 이 형제 4종과 의도적으로 다른 점으로, helper 가 ack 조립을 넘겨받지 않는 한 런타임 차이는 발생하지 않는다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점 모두 충돌 없이 안전하다.

---

## 위험도

NONE
