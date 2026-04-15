### 발견사항

---

**[WARNING] 실행 입력 데이터가 WebSocket 이벤트에 노출됨**
- 위치: `execution-engine.service.ts` — 모든 `emitNodeEvent` 호출부 (diff 전반)
- 상세: `input: nodeExec.inputData` 및 `input: nodeExecution.inputData`가 WebSocket 이벤트 페이로드에 추가됨. `inputData`에 API 키, 비밀번호, DB 자격증명, 개인정보 등 민감 데이터가 포함될 수 있음. 해당 실행 채널(`execution:{id}`)을 구독한 **모든** 연결된 클라이언트에게 브로드캐스트됨.
- 제안: `inputData`에서 민감 필드를 마스킹하는 유틸 함수(`sanitizeInputForBroadcast`)를 두거나, 스냅샷/이벤트 전송 전에 설정 노드 타입별 민감 필드 목록을 정의해 제거할 것.

---

**[WARNING] WebSocket 스냅샷에 실행 전체 데이터가 인가 검증 없이 전송됨**
- 위치: `websocket.gateway.ts` — `emitExecutionSnapshot()` 메서드
- 상세: `executionsService.findById(executionId)`는 인자로 받은 `executionId`를 그대로 사용하며, 해당 실행이 **현재 연결된 사용자의 것인지 검증하지 않음**. 인증된 사용자가 타인의 실행 ID를 알고 있을 경우 `execution:{victimId}` 채널을 구독하면 스냅샷을 수신할 수 있음. `handleSubscribe()`에서 채널 형식(`execution:`)은 검증하지만 소유권은 검증하지 않음.
- 제안: `findById` 호출 시 현재 사용자 ID(`(client as Socket & { userId? }).userId`)를 전달해 ownership 검증 수행. 또는 `ExecutionsService.findById`에 `userId` 파라미터를 추가해 DB 쿼리 시 `WHERE userId = ?` 조건 적용.

---

**[WARNING] 스냅샷 이벤트 채널에 구독 중인 클라이언트 간 데이터 격리 미흡**
- 위치: `websocket.gateway.ts` — `handleSubscribe()` 내 `emitExecutionSnapshot()` 호출
- 상세: 스냅샷은 `client.emit()`으로 해당 소켓에만 전송되지만, 이후 노드 이벤트 (`emitNodeEvent`)는 `broadcastToChannel()`로 채널 내 **전체 구독자**에게 전송됨. 채널 자체에 접근 제어가 없으므로, 실행 ID를 아는 모든 인증 사용자가 타인의 실행 진행 상황을 실시간으로 수신 가능.
- 제안: 채널 구독 시 해당 실행의 소유자 또는 권한 있는 사용자인지 확인 후 `join()` 허용.

---

**[WARNING] `interactionData`가 WebSocket 이벤트를 통해 클라이언트에 노출됨**
- 위치: `execution-engine.service.ts` — diff line `+interactionData: nodeExec.interactionData`
- 상세: `interactionData`의 내용이 불명확하며, LLM 프롬프트, 시스템 메시지, 내부 설정 등 민감 데이터를 포함할 수 있음. 프론트엔드에서 사용 용도가 확인되지 않은 채 브로드캐스트됨.
- 제안: `interactionData`에 포함 가능한 필드를 명시적으로 허용 목록(allowlist) 방식으로 선택해 전송하거나, 민감 필드를 제거한 후 전송.

---

**[INFO] `executionId`가 채널 파싱으로만 추출되며 별도 검증 없음**
- 위치: `websocket.gateway.ts` — `channel.slice('execution:'.length)`
- 상세: `executionId`는 `isValidChannel()` 통과 후 슬라이싱으로 추출됨. 현재 UUID 형식 검증이 없어 임의의 문자열이 `findById()`에 전달될 수 있음. DB 쿼리 레벨에서는 안전하지만(TypeORM 파라미터 바인딩), 로그에 임의 문자열이 기록될 수 있음.
- 제안: `executionId` 추출 후 UUID 형식 검증(`/^[0-9a-f]{8}-...$/.test(executionId)`) 추가. 프론트엔드의 `sanitizeUuid()` 패턴을 백엔드에도 적용.

---

**[INFO] 스냅샷 오류가 `debug` 레벨로만 로깅됨 — 인가 오류 감사 불가**
- 위치: `websocket.gateway.ts` — `emitExecutionSnapshot()` catch 블록
- 상세: 존재하지 않는 실행 ID 접근 오류와 권한 없는 접근 오류가 모두 동일하게 `debug` 로그로 처리됨. 보안 감사 관점에서 인가 실패를 `warn` 이상으로 구분 기록해야 함.
- 제안: `NotFoundException`과 `ForbiddenException`을 구분하여 인가 실패는 `warn` 레벨로 로깅.

---

**[INFO] 프론트엔드 스냅샷 핸들러의 입력 타입 캐스팅이 느슨함**
- 위치: `use-execution-events.ts` — `handleSnapshot` 내 `data as { execution?: ExecutionData } | null`
- 상세: WebSocket으로 수신된 데이터를 타입 단언(`as`)으로만 처리하고 런타임 검증이 없음. 악의적이거나 비정상적인 페이로드가 store에 그대로 주입될 수 있음. 프론트엔드의 `sanitizeUuid()`가 일부 필드에는 적용되지만 `outputData`, `inputData` 등 비정형 필드는 검증되지 않음.
- 제안: `zod` 등 스키마 검증 라이브러리를 사용해 스냅샷 페이로드를 파싱하거나, 최소한 필수 필드의 타입 검사를 런타임에 수행.

---

### 요약

이번 변경의 핵심 보안 위험은 **실행 데이터의 과도한 노출**과 **채널 구독 시 소유권 검증 부재**에 있습니다. `inputData`와 `interactionData`가 WebSocket 이벤트에 추가되면서 API 자격증명이나 개인정보 등 민감한 실행 입력값이 채널 구독자 전체에 브로드캐스트될 수 있으며, `execution.snapshot` 기능은 인증된 사용자라면 타인의 실행 ID만 알면 전체 실행 히스토리를 수신할 수 있는 IDOR(Insecure Direct Object Reference) 취약점을 내포합니다. REST API의 인가 계층이 WebSocket 채널에는 동등하게 적용되지 않고 있으므로, 채널 구독 시 소유권 검증과 민감 데이터 마스킹이 우선적으로 보완되어야 합니다.

### 위험도

**HIGH**