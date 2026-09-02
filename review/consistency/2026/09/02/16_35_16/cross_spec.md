# Cross-Spec 일관성 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 발견사항

- **[CRITICAL]** `disconnect()` 후 클라이언트 자동 재연결이 실제로는 발화하지 않는다 — draft 의 핵심 Rationale("사용자에게는 끊김이 보이지 않는다")이 기존 클라이언트 재연결 계약·현재 구현과 충돌
  - target 위치: `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` §결정(37~61행) · §구현 메모(109~113행, "developer 트랙 — 본 draft 범위 밖") · 변경표(87~107행, §9.2·§6.1 미포함)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §6.1 "재연결은 **Socket.IO 클라이언트 내장 reconnection 에 위임**"(951~962행) / §9.2 클라이언트 구현 가이드(1042~1050행, `connect_error` 만 재연결 트리거로 규정) + `codebase/frontend/src/lib/websocket/ws-client.ts` + `codebase/frontend/src/lib/websocket/use-execution-events.ts`
  - 상세: draft 는 서버가 `auth.token_expired` emit 후 `socket.disconnect()` 를 호출하는 모델을 결정한다. Socket.IO(서버·클라이언트 모두 `^4.8.3`, 실측 `codebase/backend/package.json:88`·`codebase/frontend/package.json:64`) 는 **서버가 먼저 `disconnect()` 를 호출한 연결(disconnect reason `"io server disconnect"`)에 대해서는 클라이언트의 `reconnection: true` 내장 자동 재연결을 발화하지 않는다** — 클라이언트가 명시적으로 `socket.connect()` 를 다시 호출해야 한다(Socket.IO 공식 문서 규정 동작). 그런데 `ws-client.ts` 를 실측하면:
    - `connect_error` 핸들러(63~77행)만 refresh+재연결을 수행하고, **일반 `disconnect` 이벤트 리스너는 `ws-client.ts` 안에 전혀 없다.**
    - `auth.token_expired` 를 구독하는 코드는 프론트 전체에 **0건**(`grep -rn "token_expired" codebase/frontend/src` 결과 노드 문서(.mdx) 2건과 무관 테스트 1건뿐).
    - 소켓을 재생성하는 유일한 호출부 `workflow-editor.tsx:65~70` 의 `useEffect` 는 **deps `[]`(mount 1회)** 라 이후 disconnect 에 반응해 재호출되지 않는다.
    - `use-execution-events.ts` 의 `onDisconnect`(1046~1049행)는 `isConnected`/`snapshotReceived` 를 false 로 리셋할 뿐 재연결을 트리거하지 않으며, 10초 뒤 `duration: Infinity` 의 **영구 toast**(`executions.realtimeFallback`, 1218~1223행)를 띄운다. 같은 파일 1192~1196행 주석이 "WS singleton 이 재발화하지 않아 isConnected 가 영구히 false" 라는 **바로 이 실패 모드를 이미 한 번 겪은 회귀 사례**로 명시한다.
    - 결론: draft 를 "구현 메모" 범위(백엔드 타이머+`handleDisconnect` cleanup)만으로 그대로 구현하면, 60초 사전 통지 이후 강제 disconnect 가 발생할 때(클라이언트가 사전에 refresh+재연결을 스스로 하지 않는 한) 소켓은 **자동으로 되살아나지 않고**, 10초 뒤 사용자에게 영구 경고 toast 가 뜬다 — draft 가 명시적으로 피하려던 바로 그 "예고 없이 끊기는" 것보다 나쁜, **"예고는 있었지만 스스로 복구되지 않는"** 상태가 15분마다 재발한다.
  - 제안: 다음 중 하나를 target 문서에 명시해 결정하고 변경표에 반영할 것.
    1. §9.2(클라이언트 구현 가이드)에 신규 스텝 추가 — `auth.token_expired` 수신 시 **사전 통지 창(60초) 안에** REST refresh + `socket.auth.token` 교체 + 명시적 `socket.connect()` 를 수행하도록 정식 클라이언트 계약으로 못박고, 이를 "구현 메모" 의 developer 범위에도 포함(현재는 서버 항목만 나열).
    2. §6.1 에 "서버발신 `disconnect()`(`auth.token_expired` 포함)는 Socket.IO 자동 재연결 대상이 아니며 클라이언트가 명시적으로 재연결해야 한다"는 예외를 명문화 — 현재 §6.1 은 무조건 "Socket.IO 내장 reconnection 에 위임" 이라고만 적어 이 케이스를 놓친다.
    3. (fallback) 클라이언트가 사전 통지를 놓친 경우를 대비해, 강제 disconnect 직후 클라이언트가 재연결을 재시도하는 fallback 경로(`disconnect` 이벤트에서 reason 확인 후 `connect()`)를 별도로 명시.
    어느 쪽이든 target 의 "spec 6곳·plan 3곳 전수" 목록에 §6.1·§9.2(또는 그 대체 스텝)가 빠진 것은 draft 스스로의 "전수" 주장과 어긋난다.

- **[INFO]** 변경표 항목 7 의 인용 줄번호가 가리키는 문구와 실제 위치가 어긋난다
  - target 위치: `spec-draft-ws-socket-lifetime-binds-token.md` :105 (`spec-sync-websocket-protocol-gaps.md:23` 로 인용)
  - 충돌 대상: `plan/in-progress/spec-sync-websocket-protocol-gaps.md`
  - 상세: `:23` 은 해당 항목의 체크박스 시작 줄(`- [ ] 서버발신 auth.token_expired ...`)이고, 항목 설명이 인용한 문구 *"developer 권한 밖(제품 semantics + 동작 변경)이라 여기서 멈춘다"* 는 실제로 `:49` 에 있다. `:87` "남은 하나에만 적용된다" 인용은 정확히 일치한다. 블록 시작을 앵커로 쓴 것이라면 의도된 표기일 수 있으나, 문구 자체를 짚는 인용처럼 읽혀 구현자가 잘못된 줄을 찾을 수 있다.
  - 제안: `:23` 을 `:23~49`(블록 범위) 또는 문구가 실제 위치한 `:49` 로 정정.

## 요약

target draft 는 `spec/5-system/6-websocket-protocol.md` §1.2·§1.3·§4.6·Rationale 과 `plan/in-progress/spec-sync-websocket-protocol-gaps.md`·`spec-sync-external-interaction-api-gaps.md` 를 대상으로 한 change 목록 자체는 기존 spec 문구·줄번호와 대부분 정확히 정합한다(§1.2:52, §4.6:871, Rationale:1090/1105/1106/1123 등 실측 대조 결과 일치). 데이터 모델(`spec/1-data-model.md:300`)·알림 spec(`data-flow/8-notifications.md:347`)·EIA 트래커에 대한 "변경 불요" 판정도 실측상 타당하다. 다만 draft 의 핵심 설계 결정(서버발신 `auth.token_expired` + 60초 후 강제 `disconnect()`)은 **같은 spec 문서 안의 기존 §6.1/§9.2 클라이언트 재연결 계약, 그리고 그 계약을 구현한 실제 `ws-client.ts`/`use-execution-events.ts` 코드**와 충돌한다 — Socket.IO 의 서버발신 disconnect 는 클라이언트 자동 재연결을 트리거하지 않고, 현재 프론트엔드에는 이 이벤트에 반응해 재연결하는 코드가 전혀 없다(코드 실측으로 확인). 이 갭이 그대로 구현되면 draft 가 명시적으로 목표한 "끊김이 보이지 않는다"는 결과를 얻지 못하고, 오히려 15분마다 영구 경고 toast 가 뜨는 회귀가 생긴다. 이는 target 문서의 "전수" 변경표에서 §9.2/§6.1 이 빠진 완결성 문제이자, 서버/클라이언트 계층 책임 분할이 draft 안에서 암묵적으로만("Rationale 산문") 클라이언트에 위임되고 정식 계약(§9.2)으로 못박히지 않은 문제다.

## 위험도

HIGH
