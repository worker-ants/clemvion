# 정식 규약 준수 검토 결과

**검토 대상**: `frontend/src/lib/websocket` (impl-prep 모드)
**검토 일시**: 2026-05-17
**검토 범위**: ws-client.ts, apply-execution-snapshot.ts, use-background-run.ts, use-execution-events.ts, use-execution-interaction-commands.ts, use-kb-events.ts

---

## 발견사항

- **[INFO]** WS 인증 방식: spec 의 token 전달과 실제 구현이 일부 불일치
  - target 위치: `ws-client.ts` line 32-39, `socket = io(...)` 의 `auth: { token }` 옵션
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §1.2`
  - 상세: spec §1.2 는 인증 방식으로 (1) 쿼리 파라미터 `?token=...` 과 (2) `Sec-WebSocket-Protocol: bearer, {token}` 헤더를 명시한다. 구현은 socket.io `auth: { token }` 필드를 사용하는데, 이는 spec 에 명시된 두 방식 중 어느 것도 아닌 socket.io-specific 방식이다. 단, 이는 socket.io 의 관용적 인증 패턴이며 backend 가 socket.io gateway 로 구현됐다면 실질적 문제가 없을 수 있다. spec 이 저수준 WebSocket 스펙을 서술하고 있어 socket.io 래퍼 레이어에서의 차이가 발생했을 가능성.
  - 제안: spec §1.2 에 "socket.io auth 필드 방식도 허용" 문구를 추가하거나, 구현 주석에 spec 과의 관계를 명시한다. spec 갱신이 더 적절하다.

- **[INFO]** `execution.submit_form` 페이로드에 `nodeId` 누락
  - target 위치: `use-execution-interaction-commands.ts` line 76-84, `submitForm` 함수
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §4.2`
  - 상세: spec §4.2 는 `execution.submit_form` 의 payload 를 `{ executionId, nodeId, formData }` 로 정의한다. 실제 구현은 `{ executionId, formData }` 만 전송하고 `nodeId` 를 포함하지 않는다. backend 가 현재 waiting 중인 노드를 실행 컨텍스트에서 찾을 수 있다면 동작하지만, spec 상의 payload 형태와 다르다.
  - 제안: `submitForm` 에 `nodeId` 파라미터를 추가하거나 `useExecutionStore` 의 `waitingNodeId` 를 읽어 동봉한다. 또는 spec §4.2 의 `nodeId` 를 optional 로 변경한다.

- **[INFO]** `execution.snapshot` 이벤트가 spec 에 미등재
  - target 위치: `use-execution-events.ts` line 704, `client.on("execution.snapshot", handleSnapshot)`
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §4.1`
  - 상세: 구현 코드는 `execution.snapshot` 이벤트를 수신해 store 를 초기 hydrate 한다. 이 이벤트는 §4.1 의 이벤트 목록에 없다. 코드 내 주석("backend 가 subscribe 즉시 발송하는 snapshot")으로 보아 중요한 동작이지만 spec 에서 누락됐다.
  - 제안: spec §4.1 에 `execution.snapshot` 이벤트와 그 payload 형태(`{ execution: ExecutionData }`)를 추가한다. project-planner 위임 사항.

- **[INFO]** `execution.resumed` 이벤트가 spec 에 미등재
  - target 위치: `use-execution-events.ts` line 107, `handleExecutionResumed` 및 line 665, `client.on("execution.resumed", ...)`
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §4.1`
  - 상세: 구현은 `execution.resumed` 이벤트를 처리하나, §4.1 이벤트 목록에 해당 항목이 없다.
  - 제안: spec §4.1 에 `execution.resumed` 이벤트를 추가한다.

- **[INFO]** `execution.ai_message` 이벤트의 `nodeExecutionId` 필드 사용: spec 미정의
  - target 위치: `use-execution-events.ts` line 304-333, `handleAiMessage` 의 payload 타입
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §4.1`
  - 상세: 코드 주석에 "Sub-Workflow nesting 에서 같은 nodeId 의 AI Agent 가 여러 row 일 수 있으므로 nodeExecutionId 로 명시 라우팅" 이라 되어 있으나, spec §4.1 의 `execution.ai_message` payload 정의에는 `nodeExecutionId` 필드가 없다. 실제 동작에 영향은 없으나 spec-impl 간 drift.
  - 제안: spec §4.1 의 `execution.ai_message` payload 에 `nodeExecutionId?` 필드를 추가한다.

- **[INFO]** 채널 명명 패턴: `background:run:<id>` 가 spec 채널 목록에 없음
  - target 위치: `use-background-run.ts` line 61, `const channel = \`background:run:${backgroundRunId}\``
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §3.2`
  - 상세: spec §3.2 의 채널 패턴 표에 `background:run:{id}` 가 없다. 채널 패턴 자체는 일관된 `<domain>:<id>` 형식을 따르고 있어 관용적으로 올바르지만, 공식 등재가 빠져 있다.
  - 제안: spec §3.2 에 `background:run:{backgroundRunId}` 채널 항목을 추가한다.

- **[INFO]** `CONTINUE_BUTTON_ID = "__continue__"` 상수가 spec 에는 `__continue__` 로 정의되어 일치하나 위치가 분산
  - target 위치: `use-execution-interaction-commands.ts` line 14
  - 위반 규약: `spec/5-system/6-websocket-protocol.md §4.2`
  - 상세: spec §4.2 는 `__continue__` sentinel 을 설명하며, 구현도 동일 값을 사용한다. 규약 자체는 준수. 단, spec 이 이 값을 상수명 없이 문자열로만 기술하므로 frontend 와 spec 간 단일 정의 원칙(single source of truth)이 완전하지 않다. 실질적 문제는 없음.
  - 제안: spec §4.2 에 `CONTINUE_BUTTON_ID` 명칭을 메모로 추가하거나 현재 구현 그대로 유지. 우선순위 낮음.

---

## 요약

`frontend/src/lib/websocket` 의 구현 파일들은 `spec/conventions/node-output.md` (Node Output 규약) 및 `spec/conventions/swagger.md` 의 직접 적용 대상이 아니며, 이 파일들에 대한 위반은 없다. 적용 가능한 정식 규약은 `spec/5-system/6-websocket-protocol.md` 이며, 해당 spec 과의 비교에서 발견된 사항은 전부 INFO 수준 — 구현이 spec 보다 앞서 있거나(snapshot, resumed 이벤트 등) spec 이 socket.io 관용 패턴을 아직 반영하지 못한 drift 다. CRITICAL 또는 WARNING 급의 규약 직접 위반은 없다. `prd/`, `memory/` 등 금지 경로 사용은 없으며, 파일 명명(`use-*.ts`, `ws-client.ts`, `apply-*.ts`)도 frontend lib 관용 패턴에 부합한다. 구현 착수에 차단 사유 없음.

---

## 위험도

LOW
