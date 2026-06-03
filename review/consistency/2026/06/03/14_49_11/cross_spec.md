# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-draft-node-execution-cancelled.md`
검토 대상 변경: 6개 spec 파일 (NodeExecution `cancelled` status 신설)

---

## 발견사항

### 1. INFO — `data-flow/3-execution.md §2.4` WS 이벤트 요약 표에 `execution.node.cancelled` 미반영

- **target 위치**: target 문서 §"변경" 4번 — `spec/data-flow/3-execution.md §3.2` Mermaid 에 `running --> cancelled` 추가
- **충돌 대상**: `spec/data-flow/3-execution.md §2.4` WebSocket 이벤트 요약 표 (line 168)
- **상세**: `§3.2` node_execution Mermaid 에 `running --> cancelled` 가 추가되었고, `§3.1` execution.status 다이어그램도 이미 `cancelled` 전이를 포함한다. 그러나 같은 파일 `§2.4` 의 WebSocket 이벤트 요약 표는 아직 `execution.node.started/completed/failed` 세 항목만 나열하고 `execution.node.cancelled` 를 포함하지 않는다. 같은 파일 내 §2.4(WS 이벤트 목록)과 §3.2(상태 다이어그램) 간 내적 비일관성이며, `spec/5-system/6-websocket-protocol.md §4.1` 표(정본)에는 이미 `execution.node.cancelled` 가 정의되어 있다.
- **제안**: `spec/data-flow/3-execution.md §2.4` 의 이벤트 요약 표 행을 `execution.node.started/completed/failed/cancelled` 로 갱신하거나, `skipped` / `cancelled` 를 추가한 별도 행으로 보완. 단, §2.4 주석이 "정본은 websocket-protocol.md §Server→Client 이벤트 매핑" 임을 이미 명시하고 있으므로 위험도는 낮다.

---

### 2. INFO — `spec/2-navigation/0-dashboard.md §5` 실행 상태 아이콘 매핑에 NodeExecution `cancelled` 미언급

- **target 위치**: target 문서 §"변경" 1번 — `execution.node.cancelled` WS 이벤트 발행 (frontend 타임라인 terminal 처리)
- **충돌 대상**: `spec/2-navigation/0-dashboard.md §5` 최근 실행 이력 표 (status 아이콘 매핑)
- **상세**: `0-dashboard.md §5` 의 실행 이력 상태 아이콘 표는 Execution(워크플로우 레벨) status를 다루며 `cancelled` 도 이미 `⛔` 로 포함되어 있다. 이 표는 NodeExecution 개별 노드 상태가 아니라 Execution 전체 상태를 표현하므로 직접 충돌은 없다. 그러나 NodeExecution `cancelled` 신설이 타임라인 UI 에도 영향을 미치는 점에서 dashboard 실행 이력에서 `cancelled` 가 이미 `⛔` 로 커버되어 있음을 확인하였다 — 정합성 유지.
- **제안**: 조치 불필요. 이미 Execution 레벨 `cancelled` 는 커버된 상태.

---

### 3. INFO — `spec/5-system/4-execution-engine.md §1.2` NodeExecution 상태 다이어그램과 target 변경의 상호 정합 확인 필요

- **target 위치**: target 문서 §"변경" 1번 — `spec/5-system/4-execution-engine.md §1.2`에 `cancelled` 추가
- **충돌 대상**: `spec/5-system/4-execution-engine.md §1.2` NodeExecution 상태 다이어그램 + 표 (현재 worktree 파일)
- **상세**: worktree 내 `spec/5-system/4-execution-engine.md §1.2` 를 확인한 결과 `cancelled` 상태가 이미 다이어그램, 상태 표, 그리고 설명에 반영되어 있다 (`running --> cancelled: abortSignal (AbortError)`, `dispatch 직전 이미 abort 된 경우도 동일(사전 체크)`, `execution.node.cancelled WS 이벤트 발행`). target 변경이 의도한 내용과 일치 — 충돌 없음.
- **제안**: 조치 불필요.

---

### 4. INFO — `spec/1-data-model.md §2.14` NodeExecution status enum 정합 확인

- **target 위치**: target 문서 §"변경" 2번 — `spec/1-data-model.md §2.14`에 `cancelled` 추가
- **충돌 대상**: 현재 worktree `spec/1-data-model.md §2.14`
- **상세**: worktree 파일에서 `NodeExecution.status` enum이 `pending / running / completed / failed / cancelled / skipped / waiting_for_input` 으로 이미 `cancelled` 를 포함하고, cross-link도 정확히 명시되어 있다. 데이터 모델이 의도한 상태와 일치 — 충돌 없음.
- **제안**: 조치 불필요.

---

### 5. INFO — `spec/conventions/node-cancellation.md §6` 구현 현황 표 내 중복 항목 유사성

- **target 위치**: target 문서 §"변경" 3번 — `spec/conventions/node-cancellation.md §5.1 / §5.2 / §6` 갱신
- **충돌 대상**: 현재 worktree `spec/conventions/node-cancellation.md §6` 구현 현황 표
- **상세**: `§6` 구현 현황 표의 `NodeExecution.status = 'cancelled'` 항목이 `✓` 로 표시되며 `V069 migration` 을 명시한다. `§5.1`/`§5.2` 에도 `cancelled` 분류 및 WS 이벤트 발행이 정의되어 있다. 다른 spec 영역(data-model §2.14, execution-engine §1.2, websocket-protocol §4.1, workflow-editor 3-execution §10.6.1)과 완전히 일치. 충돌 없음.
- **제안**: 조치 불필요.

---

### 6. INFO — `spec/data-flow/3-execution.md §2.4` 에 `execution.node.cancelled` WS 이벤트 요약 누락 (INFO 1과 동일, 강조)

(INFO 1과 동일한 파일·섹션이므로 별도 항목으로 분리하지 않고 INFO 1 에 통합.)

---

### 7. INFO — `spec/3-workflow-editor/3-execution.md §8.1` WS 이벤트 목록과 `§10.6.1` 서브탭 정합

- **target 위치**: target 문서 §"변경" 6번 — `spec/3-workflow-editor/3-execution.md` WS 이벤트 목록 + §10.6.1 서브탭
- **충돌 대상**: 현재 worktree `spec/3-workflow-editor/3-execution.md §8.1` (line 287) 및 `§10.6.1` (line 452)
- **상세**: worktree 파일에서 `§8.1` 표에 `execution.node.cancelled` 행이 이미 추가되어 있고(`executionId, nodeId, error`), `§10.6.1` 에도 `cancelled` 상태의 노드에 대한 탭 레이아웃 설명이 반영되어 있다. 충돌 없음.
- **제안**: 조치 불필요.

---

## 요약

NodeExecution `cancelled` status 신설은 6개 spec 파일(1-data-model, 4-execution-engine §1.2, node-cancellation §5+§6, data-flow/3-execution §3.2, 6-websocket-protocol §4.1+§4.4, 3-workflow-editor/3-execution §8.1+§10.6.1)에 일관되게 반영되어 있다. 모든 cross-spec 참조(data-model ↔ execution-engine ↔ websocket-protocol ↔ workflow-editor ↔ node-cancellation convention)가 동일한 `cancelled` enum 값, `AbortError` 분류 정책, `execution.node.cancelled` WS 이벤트 이름, `failed`와의 이분 정책(rehydration 실패 = `failed` 유지)을 일치하여 기술한다. 유일한 동기화 권장 항목은 `spec/data-flow/3-execution.md §2.4` 의 WS 이벤트 요약 표가 `execution.node.cancelled` 를 아직 열거하지 않는 것으로, §2.4 하단 주석이 정본을 websocket-protocol.md 로 위임하고 있어 기능적 충돌은 없다.

## 위험도

LOW
