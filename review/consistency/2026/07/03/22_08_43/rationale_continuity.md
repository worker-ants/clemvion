### 발견사항

- **[INFO]** M-3/M-6/m-3/m-5 배치가 spec Rationale 항목을 신설하지 않고 진행됨
  - target 위치: `spec/5-system/6-websocket-protocol.md` — §3.3 (구독/join), §4.2 (unsubscribe ack), §6.1 (재연결), 관련 Rationale 섹션 전반
  - 과거 결정 출처: 해당 없음 (기각된 대안 재도입 아님) — `plan/in-progress/refactor/06-concurrency.md` M-3/M-6/m-3/m-5 항목이 "spec 대조: B(spec 외 견고성 이슈)" + "spec 갱신: 불요" 로 사전 판정
  - 상세: diff 는 (1) `handleSubscribe` 의 `client.join()` 을 await 로 전환 + 실패 시 `clientSubs` 롤백·`success:false` ack, (2) `handleUnsubscribe` 를 async 화해 `leave()` 를 best-effort await, (3) frontend `bind()` 헬퍼로 이벤트 핸들러 off-before-on 이중 등록 방어, (4) `ws-client.ts` `connect()` 에 `socket.active` pending 가드 추가, (5) snapshot 수신 시 경고 toast dismiss 에 1s hysteresis 를 도입한다. 이들은 모두 **spec 이 규정하지 않은 구현 세부의 견고성 보강**이며, target 문서의 기존 Rationale 항목(§6.1 "Socket.IO 내장 reconnection 에 위임", §6.2 "native WS 는 snapshot 모델", "resumed 의미 재정의 — enqueue 수락" 등)과 충돌하지 않는다. 다만 plan 의 "spec 갱신: 불요" 판정은 개별 코드 변경 시점의 것이라, target 문서의 `## Rationale` 에는 이 다섯 변경에 대한 근거가 전혀 기록되지 않았다.
  - 제안: 별도 조치 불요. 이미 plan 문서(`plan/in-progress/refactor/06-concurrency.md`)가 "왜 spec 무변경인가"를 각 항목별로 근거 있게 기록하고 있어 결정 근거의 소실 위험은 낮다. 다만 join 실패 롤백(M-3)처럼 클라이언트가 관찰 가능한 새 실패 모드(`success:false` ack)가 §4.2 ack 표에는 반영되지 않았으므로, 후속 spec-sync 시점에 "join 실패 시 구독 롤백 + ack success:false" 1줄을 §3.3 또는 §4.2 표 비고에 추가하는 것을 권장한다 (현재는 차단 사유 아님 — 정보성 제안).

### 요약

target(`spec/5-system/6-websocket-protocol.md`)의 diff 는 M-3(join/leave await·롤백), M-6(이중 등록 방어), m-3(connect pending 가드), m-5(dismiss hysteresis) 네 가지 방어적 견고성 수정이며, 어느 것도 문서에 기록된 기각된 대안을 재도입하거나 §6.1(Socket.IO 내장 reconnection 위임)·§6.2(native WS snapshot 모델, seq 버퍼-replay 는 SSE 전담)·"resumed = enqueue 수락" 등 기존 Rationale 의 합의된 결정·invariant 를 위반하지 않는다. 네 항목 모두 `plan/in-progress/refactor/06-concurrency.md` 에서 "spec 대조: B(spec 외 이슈)" · "spec 갱신: 불요" 로 명시적으로 사전 판정된 상태라 결정의 무근거 번복도 아니다. target spec 문서 자체의 `## Rationale` 에는 이 변경들에 대한 언급이 없으나 이는 plan 판정과 일치하는 의도된 생략이다.

### 위험도
NONE
