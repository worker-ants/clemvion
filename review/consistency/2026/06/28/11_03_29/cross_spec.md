# Cross-Spec 일관성 검토 — `spec/conventions/node-cancellation.md`

## 발견사항

### [INFO] `execution.node.cancelled` WS 이벤트 페이로드 — `nodeName` vs `nodeLabel` 필드명 비일관성
- target 위치: `spec/conventions/node-cancellation.md` §5.1 — "종료 시 `execution.node.cancelled` WS 이벤트를 발행" 언급
- 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.1 Note: "위 표의 `node.started` / `node.completed` / `node.failed` / `node.skipped` 행은 spec 에 `nodeName` 으로 표기되어 있으나 엔진 및 프론트엔드는 모두 `nodeLabel` 을 사용하고 있다 (기존 drift, 본 PR scope 밖). `node.cancelled` 는 신설 이벤트이므로 올바른 `nodeLabel` 로 즉시 정정한다."
- 상세: WebSocket spec 에서 `execution.node.cancelled` 이벤트 페이로드가 `{ executionId, nodeId, nodeExecutionId, nodeLabel, error }` 로 `nodeLabel` 을 사용한다고 명시한다. target 문서(node-cancellation.md)는 이 이벤트를 §5.1 에서 언급하지만 페이로드 필드명을 직접 기술하지 않으므로 직접 충돌은 없다. 그러나 WebSocket spec 의 Note 가 "기존 drift" 를 인식하고 있음을 명시했으므로 target 문서가 WS 이벤트를 참조하는 링크(`[WebSocket §4.1]`) 가 올바른 SoT 를 가리키고 있다. 동기화 권장 — target 문서에서 WS 이벤트 페이로드를 직접 기술한다면 `nodeLabel` 명시 필요.
- 제안: 현재 target 문서는 WS 페이로드를 직접 기술하지 않고 링크만 하므로 조치 불요. INFO 수준 기록만.

---

### [INFO] graceful shutdown NodeExecution 단말 — target 문서와 execution-engine §11 간 암묵 분기
- target 위치: `spec/conventions/node-cancellation.md` §2.3 "향후 graceful shutdown — SIGTERM 수신 시 진행 중 execution 의 abort", §6 테이블 "Workflow 단위 timeout / graceful shutdown 의 노드 abort — 미구현 (Planned)"
- 충돌 대상: `spec/5-system/4-execution-engine.md` §11 graceful shutdown — "미완료 시: 해당 NodeExecution 을 `failed` + `error.code='SERVER_INTERRUPTED'` 로 마킹"
- 상세: target 문서는 graceful shutdown 이 abortSignal 경로(§2.3 생산자 목록)로 구현될 예정임을 "향후(Planned)" 로 기술하고 구현 테이블에서 미구현 상태로 표기한다. 반면 execution-engine §11 은 현재의 graceful shutdown 동작을 "NodeExecution `failed` + `SERVER_INTERRUPTED`" 로 명시하며, 이것은 abortSignal 경로 없이 직접 `failed` 로 마킹하는 구현이다. 두 문서 모두 동일한 상황을 다른 각도로 서술하고 있다 — target 의 "Planned" 와 engine spec 의 "현재 동작(`failed`)" 이 공존하며, 이 분기를 target 문서가 충분히 명시하고 있다. 기술적 충돌은 없지만 target 의 §6 테이블 비고란에 "현재 graceful shutdown 은 `failed`+`SERVER_INTERRUPTED` 경로(execution-engine §11)이며, abortSignal 통합 후 `cancelled` 경로로 전환될 예정" 임을 명시하면 독자 혼선을 제거할 수 있다.
- 제안: target §6 테이블 "graceful shutdown 노드 abort" 행 비고를 보강하여 현재 `SERVER_INTERRUPTED` 경로와의 관계를 명시. INFO — 비차단.

---

### [INFO] IE `processMultiTurnMessage` abort 미전파 — 관련 spec 참조 범위 축소
- target 위치: `spec/conventions/node-cancellation.md` §2.1 표 "Anthropic SDK" 행 — "단, IE(`information-extractor`) 의 multi-turn resume/continuation 경로(`processMultiTurnMessage`)는 abort 컨텍스트가 없어 signal 미전파 — 초기 실행 경로(`executeMultiTurn`)만 전파."
- 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md` §4.2 multi-turn 흐름 설명
- 상세: target 문서는 IE 의 `processMultiTurnMessage` 에서 abortSignal 미전파를 정확히 기술한다. information-extractor 스펙 §4.2 는 이 경로를 "engine 이 사용자 메시지 수신 시 호출" 로만 기술하고 abortSignal 전파 여부를 언급하지 않는다. 두 문서 간 모순은 없으나 IE spec 이 cancellation 제한을 명시하지 않아 해당 노드를 구현하는 개발자가 target 문서를 별도로 참조하지 않으면 모를 수 있다. 직접 모순이 아니므로 INFO.
- 제안: IE spec §4.2 또는 §6 에 "resumption 경로의 abortSignal 미전파 제한은 node-cancellation.md §2.1 참조" 같은 크로스 레퍼런스 추가. 비차단.

---

### [INFO] `execution.node.cancelled` 생산자 목록 — WS spec 과의 미세 불일치
- target 위치: `spec/conventions/node-cancellation.md` §5.1 — 생산자: "Parallel `cancel-others-on-fail` / 사용자 cancel / (향후) Workflow timeout. 종료 시 `execution.node.cancelled` WS 이벤트를 발행"
- 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.cancelled` 행 — "생산자: Parallel `cancel-others-on-fail` / 사용자 cancel"
- 상세: target 문서 §5.1 에는 "(향후) Workflow timeout" 이 생산자 목록에 포함되어 있으나, WS spec §4.1 의 해당 이벤트 설명에는 이 항목이 없다. 현재 미구현 상태의 Planned 항목이므로 기능 충돌은 아니지만, 두 문서의 생산자 목록이 불일치한다. 향후 구현 시 WS spec 업데이트가 필요하다.
- 제안: WS spec §4.1 의 `execution.node.cancelled` 행에 "향후 생산자: Workflow timeout (Planned)" 항목 추가하거나, target 의 §5.1 에서 WS spec 동기화 의무를 명시. INFO — 비차단.

---

### [INFO] graceful shutdown — execution-engine §11 에서 abortSignal 경로 활성화 시 NodeExecution 단말 전이 예상
- target 위치: `spec/conventions/node-cancellation.md` §5.1 — `AbortError` 분류로 `NodeExecution.status = 'cancelled'`
- 충돌 대상: `spec/5-system/4-execution-engine.md` §11 — 미완료 NodeExecution `failed` + `SERVER_INTERRUPTED`
- 상세: 현재 graceful shutdown 은 abortSignal 경로가 아닌 직접 `failed` 마킹이다. target 문서가 graceful shutdown 을 "향후 abortSignal 생산자" 로 기재한다면, 실제 구현 시 abortSignal 경로를 통하는 NodeExecution 은 `failed` 가 아닌 `cancelled` 로 마킹될 것이다. 이는 execution-engine §11 에서 명시한 현재 동작 (`failed`) 과 달라지므로, 구현 시 execution-engine §11 을 함께 갱신해야 한다. 현재는 양측 모두 의도된 상태(미구현 planned vs 현재 동작)이므로 모순 아님. 구현 착수 전 체크포인트로 기록.
- 제안: node-cancellation.md §2.3 Planned 항목에 "구현 시 execution-engine §11 의 미완료 NodeExecution 단말을 `cancelled` 로 변경해야 함" 메모 추가. INFO — 비차단.

---

## 요약

`spec/conventions/node-cancellation.md` 는 `spec/5-system/4-execution-engine.md`(§1.2, §8, §11), `spec/5-system/6-websocket-protocol.md`(§4.1), `spec/1-data-model.md`(§2.14), `spec/conventions/execution-context.md`, `spec/4-nodes/1-logic/10-parallel.md`(§5), `spec/4-nodes/3-ai/3-information-extractor.md` 와 전반적으로 정합적으로 기술되어 있다. 상태 전이(`NodeExecution.cancelled` = abortSignal 전용, rehydration 실패는 `failed` 분리), API 계약(`POST /executions/:id/stop`), WS 이벤트(`execution.node.cancelled`), RBAC, 데이터 모델 등 모두 cross-spec 간 모순이 없다. 발견된 사항은 모두 INFO — 미구현 Planned 항목과 현재 동작 간의 관계를 독자에게 더 명확히 전달하기 위한 크로스 레퍼런스 보강 및 생산자 목록 동기화 권장이다. 즉시 차단하는 CRITICAL/WARNING 항목은 없다.

## 위험도

NONE
