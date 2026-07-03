### 발견사항

없음.

target 문서(`spec/5-system/6-websocket-protocol.md`)는 이번 diff 에서 **본문 변경이 없다** (`git diff origin/main...HEAD -- spec/5-system/6-websocket-protocol.md` 결과 없음). 이번 변경은 `plan/in-progress/refactor/06-concurrency.md` 의 M-3 / M-6 / m-3 / m-5 4개 항목을 구현한 코드 전용 커밋이며, 각 항목은 plan 문서 자체에 "spec 대조: B(spec 무언급)" / "spec 무변경" 으로 명시돼 있다:

- **M-3** — `handleSubscribe`/`handleUnsubscribe` 의 `join`/`leave` 를 `await` 로 전환 + join 실패 시 `clientSubs.delete(channel)` 롤백. 실패 ack 는 `{ event: 'subscribed', data: { success: false, error: 'Subscription failed — please retry' } }` 형태로, spec §3.3("권한 없으면 ... `subscribed` ack 에 `success: false` 와 평문 `error` 문자열") 및 §7.1 명세와 shape 이 정확히 일치한다. 새 에러 코드·필드·이벤트 이름 추가 없음.
- **M-6** — frontend `use-execution-events.ts` 에 `bind()` 헬퍼(등록 직전 `off` 후 `on`)를 도입해 이중 리스너 등록을 방어. 순수 클라이언트 내부 구현 디테일이며 wire 이벤트 이름·payload·ack 계약에 영향 없음.
- **m-3** — `ws-client.ts` `connect()` 가드를 `socket?.connected` → `socket && (socket.connected || socket.active)` 로 확장. 연결 재시도 로직의 내부 가드일 뿐 §1.3 토큰 갱신·재연결 프로토콜(문서화된 `connect_error` 기반 재연결 흐름)과 모순되지 않는다.
- **m-5** — snapshot 수신 시 경고 토스트 dismiss 를 1초 지연(hysteresis)시키는 순수 UX 타이밍 변경. 이벤트·데이터 계약 무관.

4개 항목 모두 (1) 새 엔티티/필드 미도입, (2) 새 endpoint·이벤트 이름·ack shape 미도입(기존 shape 재사용), (3) 새 요구사항 ID 미부여, (4) 상태 머신(Execution/NodeExecution) 무변경, (5) RBAC/권한 모델 무관, (6) 서버(Gateway)/클라이언트(ws-client, hooks) 책임 분할 기존 구조 그대로 유지 — 6개 점검 관점 전부 해당 없음.

번들에 첨부된 `spec/0-overview.md`, `spec/1-data-model.md` 등 타 영역 spec 본문에도 WebSocket 관련 엔티티·상태·권한 재정의가 없어 대조할 잠재 충돌 지점이 없다.

### 요약

이번 diff 는 `spec/5-system/6-websocket-protocol.md` 본문을 전혀 수정하지 않는 순수 구현 강화(join/leave await+rollback, 리스너 이중등록 방어, connect pending 가드, dismiss hysteresis) 이며, 관련 plan 문서가 각 항목을 "spec 무언급/spec 무변경" 으로 이미 명시하고 있다. 변경된 ack 실패 payload 도 기존 spec 이 규정한 `{ success: false, error }` shape 을 그대로 따르므로 Cross-Spec 관점에서 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 충돌이 발견되지 않는다.

### 위험도
NONE
