# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — UI 기능 버그(카드 접기/펼치기 미작동), 핵심 경로 테스트 누락, 반복 인덱스 계층 오류 등 즉시 조치가 필요한 항목이 복수 존재

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **UI 버그** | `SubWorkflowCard` 헤더 클릭 시 expand/collapse가 동작하지 않음. chevron 아이콘이 표시되어 클릭 가능성을 암시하지만 `onClick` 핸들러에서 `isCardHeader` 분기 누락으로 `ctx.toggleExpand`가 호출되지 않음 | `result-timeline.tsx` — `TimelineRow` `onClick` | `if (isCardHeader \|\| isMultiTurn \|\| isLiveNode)` 조건으로 수정 |
| 2 | **로직 버그** | `buildTimelineTree`의 `iterTotal`/`iterSeen`이 부모-자식 계층을 무시하고 전체 `results` 배열을 평탄하게 집계. 루트와 Sub-Workflow 양쪽에 동일 `nodeId`가 있으면 "iter 1/4" 같은 오인 레이블이 렌더링됨 | `timeline-tree.ts:27-29` | 같은 부모 컨텍스트 내 형제 노드끼리만 iteration 카운팅 수행하도록 범위 제한 |
| 3 | **테스트 누락** | `executeInline` context 상태 복원 로직 미테스트. 인라인 실행 완료 후 `context.parentNodeExecutionId`가 이전 값으로 복원되지 않으면 형제 노드들이 잘못된 parentId를 상속하는 치명적 버그 발생 가능 | `execution-engine.service.ts` — `executeInline` `prevParentNodeExecutionId` / `finally` 블록 | `executeInline` 완료 후 `context.parentNodeExecutionId`가 원래 값으로 복원됨을 검증하는 테스트 추가 |
| 4 | **테스트 누락** | `use-execution-events.ts`의 `parentNodeExecutionId` 보존 로직 미테스트. 중간 상태 이벤트에서 누락된 `parentNodeExecutionId`를 기존 값으로 유지하는 fallback 로직이 Sub-Workflow 카드 유지의 핵심이나 검증 없음 | `use-execution-events.ts` — `NODE_COMPLETED`, `NODE_FAILED` 핸들러 | `parentNodeExecutionId` 없는 이벤트 도착 시 기존 값 보존 여부 검증 테스트 추가 |
| 5 | **테스트 누락** | `execution-store.ts`의 `addNodeResult` 병합 로직(`result.parentNodeExecutionId ?? r.parentNodeExecutionId`) 미테스트 | `execution-store.ts` — `addNodeResult` | 동일 노드 두 번째 `addNodeResult` 호출 시 `parentNodeExecutionId` 유지 시나리오 테스트 추가 |
| 6 | **보안** | WebSocket 페이로드의 `parentNodeExecutionId` 런타임 검증 없음. TypeScript 타입 단언으로만 처리하여 비정상 값(긴 문자열, 비UUID)이 상태 저장소 및 React 키로 그대로 사용됨 | `use-execution-events.ts:304-440` | UUID 형식 정규식 검증 후 사용: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| 7 | **보안** | `countDescendants`/`sumDescendantDurations` 무제한 재귀로 클라이언트 측 DoS 위험. 비정상 서버 응답으로 깊은 중첩 트리 형성 시 `RangeError: Maximum call stack size exceeded` 발생 | `timeline-tree.ts:57-72` | 최대 깊이 파라미터 추가(`maxDepth = 10`, 백엔드 `MAX_RECURSION_DEPTH`와 일치) 또는 iterative 방식으로 변경 |
| 8 | **요구사항** | SKIPPED 노드에 대해 WebSocket `NODE_SKIPPED` 이벤트 미발행. DB에는 올바르게 저장되나 라이브 실행 중 클라이언트 `addNodeResult`가 호출되지 않아 Sub-Workflow 카드 내 SKIPPED 노드가 실시간으로 나타나지 않음 | `execution-engine.service.ts` — 세 개의 SKIPPED 처리 블록 | SKIPPED 노드도 `websocketService.emitNodeEvent`로 `NODE_SKIPPED` 이벤트 발행 |
| 9 | **UX** | `MIN_HEIGHT` 변경(150→240)으로 기존 사용자의 저장된 패널 높이 설정이 유효성 검사 실패로 묵시적 초기화됨 | `run-results-drawer.tsx` — `getStoredHeight()` | `Math.max(MIN_HEIGHT, Math.min(maxHeight, parsed))`로 clamp 처리 |
| 10 | **유지보수성** | `parentNodeExecutionId` context 복원 로직이 두 곳에 분리되어 있고, `recursionDepth`와 함께 "저장→변경→finally 복원" 패턴이 수동 반복됨. 세 번째 context 속성 추가 시 복잡도 선형 증가 | `execution-engine.service.ts` — `executeInline` 내부 | `withContext(context, patch, fn)` 유틸리티로 패턴 단일화 |
| 11 | **범위** | 타임라인 패널 너비 리사이즈 기능(`timelineWidth` 상태, 드래그 핸들러, 스토리지 키)과 기본 높이 변경(300→420)이 이번 변경 목적과 무관하게 포함됨 | `run-results-drawer.tsx` — `DEFAULT_TIMELINE_WIDTH` 등 신규 상수 및 핸들러 | 별도 PR로 분리하거나 의도된 범위임을 명시적으로 문서화 |
| 12 | **문서화** | 마이그레이션 파일에 기존 데이터 백필 불필요 여부 및 `ON DELETE SET NULL` 선택 근거 주석 부재. 다음 개발자가 CASCADE로 변경하거나 백필이 필요한지 판단 불가 | `V012__add_parent_node_execution_id.sql` | `-- Applies to new executions only.`, `-- ON DELETE SET NULL: preserve child execution history even when parent is deleted.` 주석 추가 |
| 13 | **동시성** | `ExecutionContext` 공유 객체에 대한 `parentNodeExecutionId` save/restore 패턴이 병렬 분기 실행 시 상태 오염 위험. 현재 순차 실행이라 즉각적 위험은 없으나 기존 `recursionDepth`와 함께 공유 컨텍스트 뮤테이션이 누적됨 | `execution-engine.service.ts:363-579` | 병렬 분기 실행이 가능한 구조라면 context shallow-clone 방식 검토. 단기적으로 순차 실행 보장 주석 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **DB 성능** | `parent_node_execution_id`는 대다수 NULL. 전체 인덱스가 불필요하게 큼 | `V012__add_parent_node_execution_id.sql` | `WHERE parent_node_execution_id IS NOT NULL` 부분 인덱스 사용 |
| 2 | **DB 운영** | 일반 `CREATE INDEX`가 인덱스 빌드 완료 시까지 쓰기 블로킹 | `V012__add_parent_node_execution_id.sql` | `CREATE INDEX CONCURRENTLY` 사용 검토 (Flyway `mixed=true` 필요) |
| 3 | **DB 설계** | `ON DELETE SET NULL` 선택 시 대량 삭제 배치에서 자식 행 일괄 UPDATE로 lock contention 가능성 | `V012__add_parent_node_execution_id.sql` | 대량 삭제 시 청크 단위 삭제 전략 검토 |
| 4 | **성능** | 드래그 중 `setTimelineWidth`/`setPanelHeight`를 `mousemove` 매 이벤트마다 호출하여 60fps 기준 초당 60회 리렌더링 발생. width 리사이즈 추가로 기존 height 문제와 중복 | `run-results-drawer.tsx` — `handleMouseMove` | `requestAnimationFrame` throttle 적용 |
| 5 | **성능** | `countDescendants`/`sumDescendantDurations`가 렌더마다 재계산. `buildTimelineTree` 시점에 bottom-up으로 미리 계산 가능 | `result-timeline.tsx` — `SubWorkflowCard`, `timeline-tree.ts` | `TimelineTreeNode`에 `cachedDescendantCount`, `cachedDescendantDurationSum` 사전 계산 저장 |
| 6 | **성능** | `@ManyToOne parentNodeExecution` 관계 선언으로 향후 루프 내 접근 시 N+1 LazyLoading 위험. 현재는 `parentNodeExecutionId` 문자열만 필요 | `node-execution.entity.ts` | 관계 선언 제거하고 컬럼만 유지. 필요 시 명시적 JOIN 사용 |
| 7 | **테스트** | `workflow.handler.spec.ts`에서 `context.nodeExecutionId = undefined` 시 `parentNodeExecutionId: undefined` 전달 검증 케이스 누락 | `workflow.handler.spec.ts` | `nodeExecutionId` 미설정 상태 테스트 케이스 추가 |
| 8 | **테스트** | `timeline-tree.test.ts`에서 서로 다른 Sub-Workflow에 동일 `nodeId`를 가진 자식이 있을 때 `iterIndex`/`totalIterations` 검증 케이스 누락 | `timeline-tree.test.ts` | 다중 Sub-Workflow 내 동일 nodeId 시나리오 테스트 추가 |
| 9 | **테스트** | `SubWorkflowCard` 기본 확장 상태(true)와 `toggleCardExpand` 동작 검증 컴포넌트 테스트 부재. `statusAccentClass` 순수함수도 미테스트 | `result-timeline.tsx` | 카드 기본 확장 상태 및 토글 동작 렌더 테스트 추가 |
| 10 | **아키텍처** | `ExecutionContext` God Object 경향. 9개 이상 이질적 필드 혼재(런타임 상태, 실행 데이터, 노드 메타데이터) | `node-handler.interface.ts` | 장기적으로 `ExecutionRuntimeState`와 `ExecutionDataContext`로 분리 고려 |
| 11 | **아키텍처** | `RowCtx` 7개 필드 수동 prop drilling. `SubWorkflowCard`에서 `{ ...ctx, toggleExpand: toggleCardExpand }` 스프레드로 매 렌더마다 새 객체 생성 | `result-timeline.tsx` — `RowCtx`, `SubWorkflowCard` | `React.createContext`로 전환 또는 스프레드를 `useMemo`로 감싸기 |
| 12 | **아키텍처** | `toggleExpand`/`toggleCardExpand` 이중 함수가 기본값 차이(`false` vs `true`)로 분기. 단일 `toggleExpand(id, defaultExpanded = false)`로 통합 가능 | `result-timeline.tsx:340-345` | 파라미터화하여 통합 |
| 13 | **요구사항** | async 모드 Sub-Workflow 노드가 항상 자식 없이 flat 행으로 렌더링됨. 설계 의도가 UI나 주석에 미명시 | `workflow.handler.ts:99-113` | async 노드 전용 배지/링크 표시 또는 설계 의도 주석 추가 |
| 14 | **UX** | 카드 헤더 클릭 시 `toggleExpand`와 `handleNodeClick`이 동시 실행되어 접기/펼치기 의도 시 선택 상태도 변경되는 부수효과 | `result-timeline.tsx` — `TimelineRow onClick` | 카드 헤더는 접기/펼치기만, 노드 선택은 별도 클릭 영역으로 분리 |
| 15 | **API** | OpenAPI/Swagger 스펙이 있다면 `NodeExecution` 스키마에 `parentNodeExecutionId` 필드 반영 필요 | API 스펙 문서 | 스펙 파일 업데이트 |
| 16 | **문서화** | `spec/` 디렉토리에 Sub-Workflow 타임라인 계층 구조, `parentNodeExecutionId` 전파 방식, 트리 렌더링 규칙 미반영 | `spec/` 디렉토리 | 관련 스펙 파일에 계층 구조 렌더링 규칙 추가 기술 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **MEDIUM** | executeInline context 복원, WS 이벤트 parentId 보존, store 병합 등 핵심 경로 테스트 3건 누락 |
| Architecture | **MEDIUM** | iterTotal 트리 범위 미적용 로직 버그, 가변 컨텍스트 공유 상태 확장성 우려 |
| Side Effect | **LOW** | SubWorkflowCard 헤더 expand 미작동 버그, MIN_HEIGHT 변경으로 기존 설정 묵시적 초기화 |
| Security | **LOW** | WebSocket 페이로드 런타임 UUID 검증 부재, 무제한 재귀 DoS 위험 |
| Requirement | **LOW** | iterTotal 계층 무시, SKIPPED 노드 WS 이벤트 미발행, async 모드 타임라인 불완전 |
| Performance | **LOW** | 드래그 고빈도 setState, partial index 미사용, CREATE INDEX CONCURRENTLY 미적용 |
| Maintainability | **LOW** | 이벤트 payload 조립 코드 산재, context 복원 패턴 중복, 드래그 로직 중복 |
| Concurrency | **LOW** | 공유 context 뮤테이션 패턴 병렬 실행 시 잠재적 경쟁 조건 |
| Scope | **LOW** | run-results-drawer.tsx에 너비 리사이즈 기능 무관하게 포함 |
| Documentation | **LOW** | 마이그레이션 파일 설계 의도 주석 부재 |
| API Contract | **LOW** | additive change로 하위 호환 보장. 스펙 문서 업데이트 필요 |
| Database | **LOW** | partial index 미사용, CONCURRENTLY 미적용, ON DELETE SET NULL 의도 미명시 |
| Dependency | **NONE** | 신규 외부 의존성 없음, 단방향 의존 그래프 유지 |

---

## 발견 없는 에이전트

- **Dependency** — 외부 패키지 추가 없음, 내부 의존 방향 정상

---

## 권장 조치사항

1. **[즉시] `SubWorkflowCard` 헤더 expand/collapse 버그 수정** — `TimelineRow onClick`에 `isCardHeader` 분기 추가 (WARNING #1)
2. **[즉시] SKIPPED 노드 WebSocket `NODE_SKIPPED` 이벤트 발행 추가** — 라이브 실행 중 Sub-Workflow 카드 내 SKIPPED 노드 실시간 미표시 (WARNING #8)
3. **[높음] `iterTotal` 카운팅을 트리 레벨별 범위로 제한** — 동일 nodeId 노드가 루트/서브 양쪽에 존재 시 잘못된 iteration 레이블 (WARNING #2)
4. **[높음] 핵심 경로 테스트 3건 추가** — executeInline context 복원, WS 이벤트 parentId 보존, store 병합 로직 (WARNING #3, #4, #5)
5. **[높음] `countDescendants`/`sumDescendantDurations` 재귀 깊이 제한** — `maxDepth = 10` 추가 (WARNING #7)
6. **[중간] WebSocket `parentNodeExecutionId` UUID 형식 런타임 검증 추가** (WARNING #6)
7. **[중간] `MIN_HEIGHT` 변경에 따른 기존 저장 설정 clamp 처리** (WARNING #9)
8. **[중간] 마이그레이션 파일에 백필 불필요 사유 및 `ON DELETE SET NULL` 근거 주석 추가** (WARNING #12)
9. **[낮음] DB 마이그레이션 partial index(`WHERE IS NOT NULL`) 및 `CREATE INDEX CONCURRENTLY` 적용 검토** (INFO #1, #2)
10. **[낮음] `run-results-drawer.tsx` 드래그 `requestAnimationFrame` throttle 적용** — 고빈도 리렌더링 개선 (INFO #4)
11. **[낮음] `spec/` 문서에 Sub-Workflow 타임라인 계층 구조 렌더링 규칙 추가** (INFO #16)