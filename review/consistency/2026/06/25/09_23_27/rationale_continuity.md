# Rationale 연속성 검토 결과

**검토 모드**: --impl-prep (구현 착수 전)
**대상 작업**: refactor 03 C-4 — WebsocketGateway 5개 명령 핸들러 인증+소유권 보일러플레이트 추출
**주요 파일**: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
**참조 spec**: `spec/5-system/6-websocket-protocol.md`

---

## 발견사항

### [WARNING] `verifyExecutionOwnership` 공통 helper 가 `retry_last_turn` 소유권 거부 ack wire shape 를 변경할 위험

- **target 위치**: C-4 변경 (3) — `verifyExecutionOwnership(executionId, workspaceId): boolean` private helper 도입 제안; 변경 (4) — `'Not authorized for this execution'` 상수화
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §4.2` Rationale 노트 "실패 ack 형태" 및 "§4.2 submit_form/click_button payload·ack 정정", §7.2
- **상세**: spec §4.2 는 5개 핸들러의 소유권 거부 ack 구조가 **의도적으로 비대칭** 임을 Rationale 에 명시했다.
  - 4종 continuation (`submit_form`/`click_button`/`submit_message`/`end_conversation`): 소유권 거부 시 flat `{ success: false, error: 'Not authorized for this execution' }` 반환
  - `retry_last_turn`: 소유권 거부 시 nested `{ success: false, resumed: false, error: { code: WsErrorCode.NOT_FOUND, message: 'Execution not found' } }` 반환 — §4.2 실패 ack 예시 및 §7.2 코드 표 (`NOT_FOUND` 행) 에서 확인

  현재 구현(`handleRetryLastTurn` 의 verifyOwnership catch 블록 라인 668~689)도 이 비대칭을 정확히 구현하고 있다. 만약 공통 `verifyExecutionOwnership(): boolean` helper 가 소유권 거부 응답을 내부에서 구성하거나, 변경 (4) 의 `'Not authorized for this execution'` 상수를 `retry_last_turn` 에도 적용하면, `retry_last_turn` 의 nested wire shape 이 flat 으로 교체되어 §4.2 의 명시적 wire shape 계약을 깨뜨린다.

  spec Rationale: "4개 continuation 명령은 도입 시점부터 평면 `{ success, error }` 를 써 왔고 `errorCode` 는 그 위의 additive 확장이다 ... `retry_last_turn` 의 nested `error: { code, message }` 와 계층이 다른 것은 의도된 분리다."

- **제안**: `verifyExecutionOwnership` helper 는 소유권 확인만 담당하고(boolean 반환 또는 throw), 거부 ack 의 실제 응답 형태는 각 핸들러가 자신의 기존 구조로 직접 구성해야 한다. 변경 (4) 의 `'Not authorized for this execution'` 상수는 4종 continuation 핸들러 전용으로 한정하고, `retry_last_turn` 의 소유권 거부 경로에 적용하지 않는다.

---

### [INFO] `'Not authenticated'` 상수가 subscribe 경로와 명령 핸들러 경로에 공유될 경우 결합도

- **target 위치**: C-4 변경 (4) — `'Not authenticated'` 상수화
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §3.3` (subscribe 평문 error 문자열), §4.5 연결 레벨 에러 정의
- **상세**: `'Not authenticated'` 리터럴은 subscribe 경로(`handleSubscribe` 의 `clientSubs` 부재/`workspaceId` 부재 분기)와 5개 명령 핸들러(`!enriched.userId` 분기) 두 곳에 쓰인다. spec 이 이 문자열을 클라이언트가 코드로 파싱하는 구조화 필드로 정의한 것이 아니므로, 동일 상수로 재사용해도 spec 위반은 없다. 다만 두 경로의 ack 형태가 다르고(subscribe 는 `{ event: 'subscribed', data: { ... } }`, 명령 핸들러는 명령별 ack), 향후 한쪽만 메시지를 바꿀 경우 공유 상수가 의도치 않은 변경 범위를 만들 수 있다.
- **제안**: 상수화 자체는 허용. 다만 subscribe 경로와 명령 핸들러 경로가 **같은 상수를 참조하고 있다는 사실을 주석으로 명시**하는 것을 권장한다.

---

### [INFO] `getCommandAuthContext` helper 가 subscribe 경로에 잘못 도입되지 않도록 JSDoc 제한 명시 권장

- **target 위치**: C-4 변경 (2) — `getCommandAuthContext(client)` helper
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §3.3` — subscribe 인가는 `channelAuthorizers` (OCP) 경로로 처리, 명령 핸들러와 별개
- **상세**: `handleSubscribe` 는 `workspaceId ?? ''` 정규화 후 `!workspaceId` 가드를 별도로 수행하고, 채널 인가는 `channelAuthorizers.find(...).authorize(...)` 로 위임한다. C-4 의 `getCommandAuthContext` 는 명령 핸들러 전용이라 subscribe 를 건드리지 않으므로 spec 위반이 없다. 그러나 helper 를 나중에 subscribe 경로에 잘못 도입하면 OCP 구조 우회가 될 수 있다.
- **제안**: helper JSDoc 에 "명령 핸들러 5종 전용 — subscribe 경로는 channelAuthorizers 경로가 별도 담당" 를 한 줄 명시.

---

## 요약

C-4 refactor 의 추출 방향 자체는 spec §7.1 IDOR 정책(NotFound 통일), §3.3 subscribe 평문 error 포맷 불변, §4.2 ack wire shape 불변 전제 위에서 올바르게 설계됐다. 단 WARNING 에서 지적한 바와 같이, `verifyExecutionOwnership` helper 와 `'Not authorized for this execution'` 상수가 5개 핸들러 모두에 획일적으로 적용될 경우 `retry_last_turn` 소유권 거부 ack 의 nested wire shape 이 flat 으로 교체되는 구현 오류로 이어질 수 있다. 이 비대칭은 spec §4.2 Rationale 이 "의도된 분리" 로 명문화한 결정이므로 구현 시 helper 책임 범위를 4종 continuation 전용으로 명확히 한정해야 한다.

---

## 위험도

MEDIUM
