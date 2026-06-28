# 신규 식별자 충돌 검토 결과

대상: `spec/conventions/node-cancellation.md`

---

## 발견사항

### 발견사항 없음 — 전 식별자 일관 사용 확인

target 문서(`spec/conventions/node-cancellation.md`)가 도입하는 식별자를 아래 6개 관점에서 전체 코퍼스(`spec/`, `plan/in-progress/`)와 대조한 결과, **의미 충돌하는 식별자는 발견되지 않았다**.

각 관점별 확인 결과:

**1. 요구사항 ID 충돌**
- 본 문서는 독립 요구사항 ID(`ND-*`, `NAV-*` 형식)를 신규 부여하지 않는다. frontmatter `id: node-cancellation` 은 이 파일 하나에만 존재하며 다른 spec 문서에서 같은 id 로 다른 의미를 부여한 사례 없음.

**2. 엔티티/타입명 충돌**
- `NodeExecution.status = 'cancelled'` — `spec/1-data-model.md §2.14`, `spec/5-system/4-execution-engine.md §1.2`, `spec/5-system/6-websocket-protocol.md §4.1` 전체에서 동일 의미(abortSignal 경로 노드 중단 상태)로 일관 사용. 충돌 없음.
- `NodeExecutionStatus.CANCELLED` enum — 각 문서가 `node-cancellation §5` 를 SoT 로 명시적 참조.
- `ParallelBranchContext`, `ExecutionContext.abortSignal` — `spec/conventions/execution-context.md §1` 이 `node-cancellation.md` 를 동작 계약 SoT 로 위임하고 있으며, 분류(Stable core) SoT 는 `execution-context.md` 로 적절히 분리됨. 이중 정의 없음.

**3. API endpoint 충돌**
- 본 문서가 참조하는 `POST /executions/:id/stop` 은 `spec/5-system/4-execution-engine.md §7.4` 와 `spec/5-system/6-websocket-protocol.md §4.2` 에서 동일 의미로 정의됨. 충돌 없음.

**4. 이벤트/메시지명 충돌**
- `execution.node.cancelled` WS 이벤트 — `spec/5-system/6-websocket-protocol.md §4.1` 이 동일 이름·동일 payload shape(`{ executionId, nodeId, nodeExecutionId, nodeLabel, error }`)으로 정의하며 `node-cancellation §5.1` 을 SoT 로 역참조. 충돌 없음.
- `execution.cancelled` — 별개 이벤트(워크플로 전체 취소)로 명확히 구분됨. 명명 혼동 가능성은 낮음(node. prefix 유무로 구분).

**5. 환경변수·설정키 충돌**
- 본 문서는 새 ENV var 또는 config key 를 도입하지 않는다.

**6. 파일 경로 충돌**
- `spec/conventions/node-cancellation.md` — 기존에 존재하는 파일(target 이 곧 이 파일). `spec/conventions/` 내 다른 파일과 이름 겹침 없음.
- frontmatter `pending_plans: [plan/in-progress/node-cancellation-inflight-followups.md]` — 해당 파일 실존 확인(`plan/in-progress/node-cancellation-inflight-followups.md`). 유효.

**참고 사항 (충돌 아님)**

- 본 문서 §5.1 및 §6 구현 현황 표에서 `code: 'AbortError'` 를 에러 코드로 기록한다. `AbortError` 는 `CamelCase` 로, `spec/conventions/error-codes.md §1` 의 `UPPER_SNAKE_CASE` 원칙에서 벗어난다. 그러나 이는 JavaScript 표준 `Error.name` 값을 그대로 pass-through 하는 기술적 특수성(런타임에서 `error.name === 'AbortError'` 조건 분기)으로, `error-codes.md §3` historical-artifact 레지스트리 등재 후보이지만 별개 개선 작업 범위다. 본 검토 관점(다른 의미로 이미 사용 중인 식별자와의 충돌)과는 무관하며, 같은 `code: 'AbortError'` 를 다른 의미로 사용하는 사례는 없음.

- 본 문서 §2.1 및 §6 구현 현황 표에서 `node-cancellation-infrastructure.md` 를 경로 없이 참조하나, 해당 plan 은 `plan/complete/node-cancellation-infrastructure.md` 로 완료·이동됐다. 링크 stale 이지만 명명 충돌과는 무관 — 별도 일관성 검토 대상.

---

## 요약

`spec/conventions/node-cancellation.md` 가 도입·사용하는 모든 신규 식별자(frontmatter id, 엔티티 상태 enum `cancelled`, WS 이벤트 `execution.node.cancelled`, 파일 경로)는 코퍼스 전체에서 단일 의미로 일관되게 사용되고 있으며, 다른 의미로 이미 사용 중인 식별자와의 충돌은 발견되지 않았다. 상호 참조 구조(execution-engine, websocket-protocol, execution-context, data-model)가 모두 본 문서를 SoT 로 명시하고 있어 식별자 관리가 적절히 분산·조율되고 있다.

---

## 위험도

NONE
