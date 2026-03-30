## 요구사항 리뷰 결과

### 발견사항

---

**[WARNING] Manual Trigger 노드 삭제 방지 로직이 서버에 없음**
- 위치: `workflows.service.ts` → `saveCanvas()`
- 상세: `ND-MT-04` 요구사항("사용자가 삭제할 수 없음")이 프론트엔드(workflow-canvas.tsx)에만 구현됨. `saveCanvas` API에서 `manual_trigger` 노드가 없는 payload를 수신하면 서버가 그대로 삭제를 허용함. 프론트엔드 우회 시 trigger 노드 소실 가능
- 제안: `saveCanvas`에서 `manual_trigger` 노드가 payload에 포함되어 있는지, 기존 DB의 trigger 노드가 삭제 대상에 포함되었는지 검증 추가

---

**[WARNING] Manual Trigger 중복 방지 로직이 서버에 없음**
- 위치: `workflows.service.ts` → `saveCanvas()`
- 상세: `ND-MT-05` 요구사항("워크플로우당 1개만 존재")이 프론트엔드에만 구현됨. API를 통해 `manual_trigger` 타입 노드가 2개 포함된 payload를 전송하면 서버가 그대로 저장
- 제안: `saveCanvas`에서 `manual_trigger` 노드가 1개 초과이면 `BadRequestException` 반환

---

**[WARNING] `duplicate()` 메서드가 Manual Trigger 노드를 복제하지 않음**
- 위치: `workflows.service.ts:duplicate()`
- 상세: 워크플로우 복제 시 Workflow 레코드만 복사하고 노드/엣지는 복사하지 않음. `create()`는 trigger 노드를 자동 생성하지만, `duplicate()`는 원본의 모든 노드/엣지를 복제해야 하는 것이 자연스러운 동작이며 `ND-MT-04`(자동 배치)의 의도와도 맞음
- 제안: `duplicate()`에서 원본 워크플로우의 노드/엣지도 함께 복제

---

**[WARNING] `exportWorkflow()`에서 nodes/edges 미포함**
- 위치: `workflows.service.ts:exportWorkflow()`
- 상세: 주석에 "Nodes and edges will be included when those modules are integrated"가 있으나, 이번 변경으로 Node/Edge repo가 WorkflowsService에 주입됨. 미완성 상태로 유지 중
- 제안: Node/Edge를 포함하도록 구현하거나, TODO 주석으로 명확히 추적

---

**[INFO] `saveCanvas` 응답에 응답 래핑 형식 미적용**
- 위치: `workflows.controller.ts:saveCanvas()`
- 상세: `execute()` 엔드포인트는 `{ data: { executionId } }` 형식으로 응답을 래핑하지만, `saveCanvas()`는 service 반환값(`{ workflow, nodes, edges }`)을 그대로 반환하여 API 응답 포맷이 불일치
- 제안: 일관된 응답 포맷 적용 (`{ data: { workflow, nodes, edges } }`)

---

**[INFO] `execution-engine.service.ts`에서 `lastError`가 undefined일 때의 throw 수정**
- 위치: `execution-engine.service.ts:463`
- 상세: `throw lastError ?? new Error('All retry attempts exhausted')`로 개선됨. 요구사항 관점에서 긍정적 변경이나, `lastError`가 undefined인 경로(재시도 횟수가 0인 경우 등)가 실제로 발생하는지 확인 필요
- 제안: 문제없으나 재시도 0회 설정 시 동작 확인 권장

---

**[INFO] 워크플로우 실행 시 `ND-MT-03` (pass-through) 구현 확인**
- 위치: `manual-trigger.handler.ts`
- 상세: `ManualTriggerHandler.execute()`가 `input`을 그대로 반환하여 pass-through 구현. `ND-MT-03` 충족
- 제안: 없음 (올바른 구현)

---

**[INFO] `backend/.next/trace` 파일이 리뷰 대상에 포함**
- 위치: `backend/.next/trace`, `backend/.next/trace-build`
- 상세: 빌드 실패(`"failed":true`) 기록. `.next/` 디렉토리가 `.gitignore`에서 누락된 것으로 보임
- 제안: `backend/.gitignore`에 `.next/` 추가

---

### 요약

Manual Trigger 노드 관련 핵심 요구사항(`ND-MT-04` 삭제 불가, `ND-MT-05` 1개 제한)이 **프론트엔드에만 구현**되어 있어 서버 측 강제가 없는 것이 가장 큰 위험 요소다. API를 직접 호출하거나 프론트엔드 로직을 우회하면 trigger 노드 소실 및 중복 생성이 가능하며, 이는 실행 엔진에서 진입점을 찾지 못하는 런타임 오류로 이어질 수 있다. 워크플로우 복제 시 노드/엣지가 포함되지 않는 점도 기능 완전성 측면에서 미완성이다. 나머지 구현(WebSocket 이벤트 통합, ManualTriggerHandler pass-through, 캔버스 저장 트랜잭션)은 요구사항을 적절히 충족한다.

### 위험도

**MEDIUM**