# Requirement Review — §1.3 단일 노드 실행 (Single-Node Execution)

리뷰 대상: `spec/3-workflow-editor/3-execution.md §1.3` vs 구현 11개 파일  
리뷰 일시: 2026-06-15

---

## 발견사항

### [INFO] TODO(PR2) — trigger type threading 미완성 (의도된 임시 처리)

- 위치: `execution-engine.service.ts:2904`
- 상세: `// TODO(PR2): trigger type threading — ExecuteOptions 에 triggerType 필드 추가 시 'manual' | 'webhook' | 'schedule' 로 세분화. 현재 schedule 실행도 'webhook' 우선순위를 받는다(spec §4.3 3-tier 미완성 — 의도된 임시 처리).`
- 단일 노드 실행(§1.3)과 직접 관련된 TODO가 아니라 trigger type 우선순위 전반에 관한 것이며, 코드 주석이 "의도된 임시 처리"임을 명시하고 있다. §1.3 범위 요구사항을 위반하지 않는다.
- 제안: 정보 차원의 기록. §4.3 trigger type threading plan이 생길 때 해소.

---

### [INFO] 에러 UX — 단일 노드 실행 실패 시 콘솔 로깅만 (사용자 가시 피드백 없음)

- 위치: `workflow-canvas.tsx:290–292`
- 상세: `handleRunThisNode`의 catch 블록은 `console.error("Single-node execution failed:", error)`만 수행하고 사용자 가시 토스트/알림 없음. 주석이 "v1 — 실패는 콘솔 로깅만(기존 handleRun 패턴과 동일)" 임을 명시하고 있어 의도된 v1 동작이다.
- spec §1.3은 에러 UX를 지정하지 않으므로 spec 위반은 아니다.
- 제안: v2 에러 UX 통일 시 처리. 현재 차단 불필요.

---

### [INFO] `previousExecutionId` 미지정 시 `undefined` vs `null` 전달

- 위치: `workflows.controller.ts:514`, `execute-node.dto.ts`
- 상세: `body?.previousExecutionId`가 미제공되면 `undefined`로 전달된다. `execute()` 내부에서 `options && 'previousExecutionId' in options ? (options.previousExecutionId ?? null) : null`로 처리되므로 `undefined`는 `null`로 정상 코어스된다. DB 컬럼(nullable, default null)과 일치.
- 단위 테스트(controller spec line 268)도 `previousExecutionId: undefined`를 명시적으로 확인한다.
- 제안: 추가 조치 불필요.

---

### [INFO] `getLatestPredecessorOutputs` — FAILED/CANCELLED NodeExecution 필터링

- 위치: `execution-engine.service.ts:7859–7866`
- 상세: `where: { status: NodeExecutionStatus.COMPLETED }` 로 COMPLETED 행만 조회한다. FAILED/CANCELLED predecessor가 있으면 해당 노드는 seed 되지 않고 `executedNodes`에 등록되지 않는다. 이 경우 `gatherNodeInput`이 `workflowInput`(수동 입력)을 fallback으로 사용한다. spec §1.3은 "predecessor 출력을 자동 주입, 미지정 시 수동 입력으로 대체"라고 명시하며, 이 fallback 동작은 spec 범위 내다.
- 제안: 추가 조치 불필요. INFO 차원 기록.

---

### [INFO] `spec/1-data-model.md §2.13` — `dry_run`과 단일 노드 실행 직교 명시

- 위치: `spec/1-data-model.md:478`, `workflows.controller.ts`
- 상세: spec은 "단일 노드 실행은 항상 `dry_run = false`(두 모드 조합 미지원, v1)"을 명시한다. `executeNode` 컨트롤러는 `dryRun`을 `ExecuteOptions`에 명시적으로 세팅하지 않는다. `execute()`의 `executedBy` variant에서 `dryRun`은 `options.dryRun ?? false`로 기본값 false를 받으므로 spec 요건 충족. 의도적 누락(명시 불필요)이다.
- 제안: 추가 조치 불필요.

---

### [INFO] 비활성(disabled) 노드 대상 단일 노드 실행 — spec §1.3 범위 한계

- 위치: `execution-engine.service.ts:3714–3724`, `spec/3-workflow-editor/3-execution.md:57`
- 상세: spec §1.3 범위 한계에 "비활성(disabled) 노드를 대상으로 하면 일반 실행과 동일하게 skip 처리되어 빈 결과로 완료된다"고 명시돼 있으며, 엔진의 `handleDisabledNode` 경로(line 3714–3724)가 이를 구현한다. `singleNodeId`가 disabled 노드를 가리키면 skip 후 `break`(line 3758–3759)로 정상 완료된다.
- 제안: 추가 조치 불필요. 단위/e2e 테스트에 disabled 노드 케이스는 없으나 spec이 "빈 결과로 완료"를 보증하므로 핵심 커버리지(대상 노드만 실행 + 완료)로 충분하다.

---

## 기능 완전성 평가

### 1. 트리거 — 우클릭 컨텍스트 메뉴 (spec §1.3: "노드 우클릭 → '이 노드 실행'")

`workflow-canvas.tsx`의 노드 컨텍스트 메뉴에 "run" 액션이 있고(line 591), `handleRunThisNode` 콜백에 연결돼 있다(line 310). i18n 키 `editor.runThisNode`가 ko("이 노드 실행") / en("Run this node")으로 정의돼 있다. **충족.**

### 2. 진입점 — `POST /api/workflows/:id/nodes/:nodeId/execute` (spec §9)

컨트롤러에 `@Post(':id/nodes/:nodeId/execute')` 엔드포인트가 구현됐다. `@Roles('editor')` 가드가 명시적으로 설정돼 spec §9의 "Editor+" 요구사항을 충족한다. `@HttpCode(HttpStatus.ACCEPTED)` (202)도 spec과 일치한다. **충족.**

### 3. 범위 — 대상 노드만 실행, downstream 미진행

`runExecution` 내부에서 `singleNodeId ? [singleNodeId] : undefined`로 reachable seed를 대상 노드로 한정하고(line 3673), 노드 실행 직후 `if (singleNodeId) { break; }`로 loop를 종결(line 3758–3760)한다. container body/parallel/back-edge 순회를 생략하는 것이 명시적으로 설명돼 있다. **충족.**

### 4. 입력 — `previousExecutionId` predecessor 출력 자동 주입

`seedSingleNodePredecessorOutputs`가 `previousExecutionId` → predecessor NodeExecution.output_data를 조회해 `nodeOutputCache`/`structuredOutputCache`에 복원하고 `executedNodes`에 등록한다. canonical shape 판별(`isCanonicalHandlerOutput`) + bare fallback(`wrapBareAsNodeHandlerOutput`) 양쪽 경로 모두 구현됐다. `gatherNodeInput`이 정상 실행과 동일 경로로 입력을 재구성한다. **충족.**

### 5. 입력 — `previousExecutionId` 미지정 시 수동 입력 fallback

`seedSingleNodePredecessorOutputs`는 `previousExecutionId`가 null이면 즉시 return한다(line 7810). predecessor가 executedNodes에 없으면 `gatherNodeInput`이 `workflowInput`(수동 입력)을 사용한다. **충족.**

### 6. 출력 — 새 Execution으로 기록, Run Results 드로어 연동

완료 시 `resultNodeId = singleNodeId ?? sortedNodeIds[sortedNodeIds.length - 1]`로 대상 노드 출력으로 outputData를 마감(line 3918–3923). `startExecution(executionId)`를 호출해 기존 WS 이벤트·Run Results 드로어 파이프라인을 그대로 재사용한다. **충족.**

### 7. 유효성 검증 — 노드가 워크플로우에 없으면 400

`nodeRepository.findOneBy({ id: nodeId, workflowId: id })`로 스코핑 검증 후 없으면 `BadRequestException({ code: 'NODE_NOT_IN_WORKFLOW' })`를 throw한다. e2e 테스트 케이스 G에서 확인된다. **충족.**

### 8. 유효성 검증 — `previousExecutionId`가 타 워크플로우면 400

`executionRepository.findOneBy({ id: body.previousExecutionId, workflowId: id })`로 검증 후 없으면 `BadRequestException({ code: 'PREVIOUS_EXECUTION_NOT_FOUND' })`를 throw한다. e2e 테스트 케이스 H에서 확인된다. **충족.**

### 9. Graceful Shutdown gate — 503 with Retry-After

`shutdownState.isShuttingDown` 확인 → `res.setHeader('Retry-After', ...)` + `ServiceUnavailableException({ code: 'SERVER_SHUTTING_DOWN' })`를 throw한다. 단위 테스트(controller spec line 314–356)에서 확인된다. **충족.**

### 10. DB 스키마 — `single_node_id` / `previous_execution_id` 컬럼

V098 migration에서 두 컬럼을 nullable, FK 제약·인덱스 없이 추가한다. entity에 `@Column({ nullable: true })` 선언이 있다. spec의 data-model §2.13 명세와 일치한다. **충족.**

### 11. 테스트 커버리지

| 계층 | 케이스 | 상태 |
|------|--------|------|
| 단위(service) | 대상 노드만 실행 + predecessor 출력 seed | 구현 |
| 단위(service) | bare predecessor outputData lenient wrap | 구현 |
| 단위(service) | previousExecutionId 미지정 시 수동 입력 | 구현 |
| 단위(controller) | 정상 경로 (singleNodeId + previousExecutionId) | 구현 |
| 단위(controller) | previousExecutionId 미제공 | 구현 |
| 단위(controller) | 노드 미존재 → 400 | 구현 |
| 단위(controller) | 워크플로우 404 propagation | 구현 |
| 단위(controller) | previousExecutionId 타 워크플로우 → 400 | 구현 |
| 단위(controller) | shutdown 중 → 503 | 구현 |
| e2e | 단일 노드 → 202 + polling terminal | 구현 |
| e2e | 미존재 노드 → 400 (NODE_NOT_IN_WORKFLOW) | 구현 |
| e2e | 타 워크플로우 previousExecutionId → 400 | 구현 |

---

## 요약

§1.3 단일 노드 실행의 요구사항 전체가 충실히 구현됐다. 진입점(POST 엔드포인트), 범위 제한(downstream 미진행 break), 입력 seed 경로(predecessor 출력 자동 주입 + 수동 fallback), 유효성 검증(노드·실행 스코핑), Graceful Shutdown gate, DB 스키마(V098), 엔티티 컬럼, 프론트엔드 컨텍스트 메뉴 트리거, API 클라이언트 메서드, i18n 키 모두 spec 요건에 부합한다. 발견된 INFO 항목 5건은 모두 의도된 v1 동작(에러 UX 미구현, trigger type TODO)이거나 내부 처리 상의 정상 패턴이며, 요구사항 위반에 해당하지 않는다. CRITICAL/WARNING 발견사항 없음.

---

## 위험도

NONE
