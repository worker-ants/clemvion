# Rationale 연속성 검토 — `frontend/src/lib/websocket`

검토 모드: `--impl-prep` (구현 착수 전)
Target: `frontend/src/lib/websocket` (기존 구현 파일 5개)
참조 Rationale 출처: `spec/5-system/6-websocket-protocol.md §Rationale`, `spec/2-navigation/4-integration.md §Rationale`, `spec/1-data-model.md §Rationale`

---

### 발견사항

- **[WARNING]** Socket.IO `auth` 객체 인증 — spec 에 정의되지 않은 메커니즘 사용, Rationale 부재
  - target 위치: `frontend/src/lib/websocket/ws-client.ts:32-38` (`io(url, { auth: { token } })`)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §1.2 인증`
  - 상세: spec §1.2 는 인증 방식을 (1) 쿼리 파라미터 `?token={access_token}` (우선), (2) `Sec-WebSocket-Protocol: bearer, {token}` 서브프로토콜 헤더 두 가지로 한정한다. 구현은 Socket.IO 클라이언트 라이브러리의 `auth: { token }` 옵션을 사용하며, 이는 Socket.IO 핸드셰이크 단계에서 `auth` 페이로드로 전달되는 별개의 메커니즘이다. 해당 방식은 spec 에 기술되지 않았고, 이 선택을 정당화하는 Rationale 항목이 없다. 구현이 Socket.IO 위에서 동작하고 backend 도 Socket.IO Gateway 이면 `auth` 객체가 실제로 동작하는 이유가 납득되지만, spec 과의 표면적 불일치가 신규 개발자·reviewer 에게 혼란을 야기할 수 있다.
  - 제안: `spec/5-system/6-websocket-protocol.md §1.2` 에 "구현은 Socket.IO를 사용하며 `auth.token` 으로 전달 (Socket.IO Gateway 핸드셰이크 페이로드)" 를 명시하거나, `## Rationale` 에 "Socket.IO 채택 및 auth 방식 결정" 항을 추가해 spec §1.2의 두 방식 대신 `auth` 객체를 채택한 이유를 기록한다.

- **[WARNING]** 토큰 갱신 전략 — spec 의 `auth.refresh` 메시지 프로토콜 미사용, Rationale 부재
  - target 위치: `frontend/src/lib/websocket/ws-client.ts:55-73` (`connect_error` 핸들러의 refresh + `socket.connect()` 재연결 패턴)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §1.3 토큰 갱신 (연결 유지)`
  - 상세: spec §1.3 은 연결 유지 중 Access Token 갱신을 위해 클라이언트가 `{ type: "auth.refresh", payload: { token } }` 메시지를 보내고 서버가 `{ type: "auth.refreshed", payload: { expiresAt } }` 로 응답하는 프로토콜을 정의한다. 구현은 이 메시지 교환을 전혀 사용하지 않고, `connect_error` 발생 시 REST `/api/auth/refresh` 로 새 토큰을 얻어 `socket.auth.token` 을 갱신한 후 `socket.connect()` 로 재연결한다. 이 패턴은 연결이 한 번 끊긴 뒤 재연결하는 방식으로, spec 이 의도한 "연결을 유지하면서 토큰만 교환"과 다르다. 이 차이를 정당화하는 Rationale 항목이 없다.
  - 제안: `spec/5-system/6-websocket-protocol.md §Rationale` 에 "클라이언트 토큰 갱신 전략 — auth.refresh 메시지 대신 재연결 채택" 항 추가. 채택 이유(예: Socket.IO의 `auth` 갱신 패턴이 재연결 사이클과 통합되어 관리 단순화, `auth.refresh` 서버 핸들러 미구현 등)를 명시한다. 또는 spec §1.3 을 실제 구현 패턴(disconnect+reconnect)으로 갱신하고 메시지 프로토콜 항을 제거/축소한다.

- **[WARNING]** HTTP long-polling 폴백 transport 활성화 — spec 정의 범위 외, Rationale 부재
  - target 위치: `frontend/src/lib/websocket/ws-client.ts:35` (`transports: ["websocket", "polling"]`)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §1.1 엔드포인트` ("프로토콜: `wss://` (TLS 필수)")
  - 상세: spec §1.1 은 엔드포인트를 `wss://` WebSocket으로만 기술한다. 구현의 `transports: ["websocket", "polling"]` 은 WebSocket 연결 실패 시 Socket.IO HTTP long-polling 으로 자동 폴백함을 의미한다. 이는 (a) spec 이 정의한 통신 프로토콜을 우회해 `http://` 통신이 발생할 수 있고, (b) 기능 동작은 유사하지만 연결 특성(지연, 헤더 노출 등)이 달라진다. 이 결정을 정당화하는 Rationale 항목이 없다.
  - 제안: `spec/5-system/6-websocket-protocol.md §Rationale` 에 "Socket.IO transport 폴백 정책" 항 추가. polling 폴백을 허용하는 이유(예: 방화벽/프록시 환경 대응, 개발 환경 편의성)와 보안 조건(예: TLS 필수 여부, 운영 환경에서 polling 허용 여부)을 명시한다. 또는 `transports: ["websocket"]` 으로 제한하고 spec 과 일치시킨다.

- **[INFO]** Socket.IO 이벤트 이름이 spec 의 `type` 필드를 대체 — 구조 차이 문서화 권장
  - target 위치: `frontend/src/lib/websocket/ws-client.ts:83-88` (`socket.emit("subscribe", { channel })`) 및 `use-execution-events.ts:663-677` (`client.on("execution.started", ...)`)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §2.1 기본 프레임`, `§3.3 구독/구독 해제`
  - 상세: spec §3.3 은 구독 요청 메시지를 `{ type: "subscribe", id, payload: { channel } }` JSON 프레임으로 정의한다. 구현은 Socket.IO 이벤트 이름 `"subscribe"` 를 이벤트 레이어로 사용하고 data 는 `{ channel }` 만 전달한다 (`id` 없음). 마찬가지로 spec §4.1 이벤트의 `type` 필드(예: `execution.started`) 가 Socket.IO 이벤트 이름으로 직접 매핑된다. 이는 Socket.IO 추상화 덕분에 기능적으로 등가일 수 있으나, spec 의 JSON 프레임 형식과 실제 전송 구조가 다르다는 점이 문서화되지 않아 spec 을 보고 구현하려는 사람이 혼란을 겪을 수 있다.
  - 제안: `spec/5-system/6-websocket-protocol.md §Rationale` 또는 §1 서두에 "본 spec 은 프로토콜 시맨틱을 정의하며, 구현은 Socket.IO를 사용한다. Socket.IO 이벤트 이름이 spec 의 `type` 필드와 1:1 대응하고, 프레임 래퍼(`id`, `type`, `payload` 키)는 Socket.IO 직렬화가 처리한다" 라는 매핑 규약을 한 문장으로 명시한다.

- **[INFO]** `apply-execution-snapshot.ts` ai_conversation 분기의 `setConversationMessages` 미호출 — 이미 문서화된 버그
  - target 위치: `frontend/src/lib/websocket/apply-execution-snapshot.ts:223-227`
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §4.4.5` 및 `use-execution-events.ts:233-269` (WS 경로의 messages 시드 패턴)
  - 상세: WS 이벤트 경로(`use-execution-events.ts`)는 `execution.waiting_for_input` 수신 시 `convConfig.messages` 가 있고 store 가 비어있으면 `messagesToConversationItems`로 변환 후 `setConversationMessages(items)` 를 호출한다. REST 스냅샷 경로(`apply-execution-snapshot.ts` ai_conversation 분기)는 이 호출이 없어 페이지 재진입 시 대화 메시지가 복원되지 않는다. 이 불일치는 `plan/in-progress/agent-session-restore-on-rejoin.md` 에 정확히 진단·계획되어 있으며, 본 worktree 에서 수정 예정이다.
  - 제안: 현재 worktree 의 수정 계획이 이미 이 문제를 해결하므로 추가 조치 불필요. 수정 완료 후 두 경로(WS/REST)의 messages 시드 패턴이 동등해지면 spec 의 §Rationale 에 "REST 스냅샷과 WS 이벤트 두 경로가 동일한 messages 시드 로직(`messagesToConversationItems`)을 사용해야 함" 원칙을 한 줄 추가하면 향후 회귀 방지에 유익하다.

---

### 요약

`frontend/src/lib/websocket` 의 기존 구현은 `spec/5-system/6-websocket-protocol.md` 가 명시한 인증 방식(쿼리 파라미터 / Sec-WebSocket-Protocol 헤더), 토큰 갱신 메시지 프로토콜(`auth.refresh`), 통신 프로토콜 범위(`wss://` 전용) 세 영역에서 실제 동작과 spec 기술이 어긋나며, 이를 정당화하는 Rationale 항목이 없다. 이 세 경우 모두 Socket.IO 채택에서 비롯된 구조적 차이로, 기능 자체가 근본적으로 잘못된 것은 아니나 결정의 번복·대안 선택의 배경이 Rationale 에 기록되지 않아 "결정의 무근거 번복" 패턴에 해당한다. CRITICAL 수준의 기각된 대안 재도입이나 invariant 직접 위반은 발견되지 않았다. `apply-execution-snapshot.ts` 의 ai_conversation 분기 누락은 이미 plan 에 문서화된 수정 대상이므로 Rationale 위반이 아니다. 현재 worktree 의 구현 착수 자체는 차단 이슈가 없다.

---

### 위험도

LOW
