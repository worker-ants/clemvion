# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
대상 영역: `spec/3-workflow-editor/` (0-canvas, 1-node-common, 2-edge, 3-execution)
검토 일시: 2026-06-24

---

## 발견사항

### [WARNING] execution.retry_last_turn WS 명령 payload 충돌 — nodeId vs nodeExecutionId

- **target 위치**: `spec/3-workflow-editor/3-execution.md` §8.2 WS 명령 표
  ```
  | execution.retry_last_turn | executionId, nodeId | ...
  ```
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.2 WS 명령 표
  ```
  | execution.retry_last_turn | { executionId, nodeExecutionId } | ...
  ```
- **상세**: `3-execution.md §8.2` 는 `execution.retry_last_turn` 명령의 payload 식별자를 `nodeId` 로 기술하나, `6-websocket-protocol.md §4.2` 는 `nodeExecutionId` 를 명시하고 그 이유까지 설명한다 ("동일 nodeId 가 여러 NodeExecution row 를 가질 수 있어 row 단위 식별 필요"). 두 spec 이 같은 WS 명령의 payload 필드를 다르게 기술하므로 구현자가 어느 쪽을 따라야 할지 불명확하다. SoT 는 WS 프로토콜 spec 이며, execution.md 의 기술이 stale 이다.
- **제안**: `spec/3-workflow-editor/3-execution.md` §8.2 `execution.retry_last_turn` 행의 payload 를 `executionId, nodeExecutionId` 로 수정. WS spec 과 lockstep 유지.

---

### [WARNING] execution.md §8.1 WS 이벤트 표의 payload 약식 기술 — nodeExecutionId 누락

- **target 위치**: `spec/3-workflow-editor/3-execution.md` §8.1 이벤트 표 전체 (`execution.node.started` / `completed` / `failed` / `skipped` / `cancelled`)
  - 예: `execution.node.started | executionId, nodeId`
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 표
  - 예: `execution.node.started | { executionId, nodeId, nodeExecutionId, nodeName, nodeType }`
- **상세**: execution.md §8.1 의 payload 열은 `nodeExecutionId` / `nodeName` / `nodeType` 을 생략한 약식 기술이다. §10.5 Run Results 드로어 타임라인이 `nodeExecutionId` 로 컨테이너 body 노드의 iter 별 row 를 구분한다고 명시돼 있으므로, §8.1 이 `nodeExecutionId` 를 표시하지 않으면 구현자가 §8.1 만 읽었을 때 iter 구분 기제를 인지하지 못한다. `execution.node.cancelled` 는 특히 WS spec 이 `nodeLabel` 을 쓰는데 execution.md 는 `nodeId, error` 만 열거해 다른 alias 를 쓴 것처럼 보인다.
- **제안**: execution.md §8.1 이벤트 표를 WS spec §4.1 의 전체 payload 형식으로 업데이트하거나, 주석으로 "payload 상세는 [WS 프로토콜 §4.1] SoT" 임을 명시. 최소한 `nodeExecutionId` 포함 여부를 § 링크로 안내.

---

### [WARNING] execution.md §8.1 execution.user_message 이벤트 누락

- **target 위치**: `spec/3-workflow-editor/3-execution.md` §8.1 WS 이벤트 표 (해당 이벤트 행 없음)
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.1
  - `execution.user_message | { executionId, nodeId, nodeExecutionId, message, receivedAt }` — AI Multi Turn 모드에서 사용자 발화를 수신 즉시 라이브 노출하는 비권위 신호
- **상세**: WS spec §4.1 에 정의된 `execution.user_message` 이벤트가 execution.md §8.1 에 아예 없다. execution.md §3.6 AI Multi Turn 상태 UX(`타임라인에 사용자 메시지 optimistic 추가`)를 구현하려면 이 이벤트가 필수인데, §8.1 에 없어 구현 시 참조 불일치가 생길 수 있다.
- **제안**: `spec/3-workflow-editor/3-execution.md` §8.1 에 `execution.user_message` 이벤트 행 추가, 또는 WS spec 참조 링크로 전체 이벤트 목록을 위임하는 문구 추가.

---

### [INFO] canvas §5.3.4 summaryTemplate 표에서 Filter 노드 누락

- **target 위치**: `spec/3-workflow-editor/0-canvas.md` §5.3.4 노드별 요약 포맷 표 (Filter 행 없음)
- **충돌 대상**: `spec/4-nodes/1-logic/0-common.md` §8 summaryTemplate 표
  - `| Filter | {inputField} · {N} conditions · {combineMode} |`
  - `spec/0-overview.md` §6.1 구현 완료 목록에 Filter 포함
- **상세**: canvas §5.3.4 는 각 노드의 summaryTemplate SoT 를 각 노드 spec 으로 위임한다("포맷 SoT 는 각 노드 spec 의 summaryTemplate"). 그러나 §5.3.4 표 자체가 참조용 전체 목록처럼 쓰이는데 Filter 가 빠져 있다. §5.3.2 경고 메시지 표에는 Filter 가 포함돼 있어 inconsistency 가 눈에 띈다. 오작동 유발보다는 문서 독자의 혼란 문제.
- **제안**: canvas §5.3.4 표에 `| Filter | {inputField} · {N} conditions · {combineMode} | $input.items · 2 conditions · AND |` 행 추가.

---

### [INFO] canvas §4.1 팔레트 다이어그램에서 Filter 노드 누락

- **target 위치**: `spec/3-workflow-editor/0-canvas.md` §4.1 팔레트 구조 다이어그램 (`▼ Logic` 섹션에 Filter 없음)
- **충돌 대상**: `spec/0-overview.md` §6.1 구현 완료 목록 ("Filter" 포함), `spec/4-nodes/_product-overview.md` §4.8 ("Filter" 섹션 존재), `spec/1-data-model.md` §2.6 Node.type enum (`filter` 포함)
- **상세**: canvas §4.1 의 Logic 카테고리 팔레트 예시 다이어그램에 `If/Else`, `Switch`, `Loop`, `Variable Decl/Mod`, `Split`, `Map`, `ForEach`, `Parallel`, `Merge`, `Background` 는 있으나 `Filter` 가 없다. 동일 spec 의 §5.3.2 경고 표에는 Filter 가 등장하므로 다이어그램이 불완전하다.
- **제안**: canvas §4.1 `▼ Logic` 섹션 다이어그램에 `Filter` 행 추가.

---

### [INFO] canvas §11.3.2 Ungroup 설명의 "background" 포트 오기재

- **target 위치**: `spec/3-workflow-editor/0-canvas.md` §11.3.2 Ungroup 옵션 설명
  ```
  | Ungroup | 컨테이너의 `body`/`background` 포트에서 자식으로의 엣지만 제거 |
  ```
- **충돌 대상**: `spec/3-workflow-editor/1-node-common.md` §1.3 포트 구성 표
  - Loop/ForEach/Map 컨테이너의 포트: 입력 `in`, `emit` / 출력 `body`, `done`
  - `background` 는 Background 노드의 전용 출력 포트이며, Background 는 컨테이너 박스를 사용하지 않는 비컨테이너 노드
- **상세**: Ungroup 대상 컨테이너(Loop/ForEach/Map)의 출력 포트는 `body` (자식 진입) 와 `done` 이며 `background` 포트는 없다. `background` 는 별도 Background 노드의 포트로, 컨테이너 삭제 dialog 맥락과 무관하다. 설명이 오해를 줄 수 있다.
- **제안**: canvas §11.3.2 Ungroup 설명을 "컨테이너의 `body` 포트(와 자식 → `emit` 포트) 엣지만 제거" 로 수정.

---

## 요약

`spec/3-workflow-editor/` 의 다른 영역(WS 프로토콜 spec, 노드 시스템 spec, 데이터 모델)과의 충돌 중 CRITICAL 수준은 발견되지 않았다. 가장 주의할 사항은 `3-execution.md §8.2` 의 `execution.retry_last_turn` WS 명령 payload 가 `nodeId` 로 기재돼 있으나 `6-websocket-protocol.md §4.2` 의 권위 정의는 `nodeExecutionId` 이다 — 구현자가 execution.md 만 보고 `nodeId` 를 보내면 retry 서버 로직(`_retryState` lookup 은 `nodeExecutionId` 기준)이 동작하지 않는다(WARNING). 나머지 이슈는 execution.md §8.1 WS 이벤트 표의 payload 약식 기술(nodeExecutionId 등 누락, user_message 이벤트 전체 누락)로 SoT 인 WS spec 과의 동기화가 권장된다. canvas spec 내 Filter 노드 누락(팔레트 다이어그램·summary 표)과 Ungroup 설명의 background 오기재는 INFO 수준 명명 불일치다.

## 위험도

MEDIUM
