# Container 런타임 연결 + ForEach/Map emit 포트 도입

## Context

현재 `Loop`, `ForEach`는 frontend에서 `isContainer: true`로 마킹되고 spec 상 `body`/`done` 포트 모델이 정의되어 있지만 **엔진 런타임 쪽은 연결되어 있지 않다**:

- `ForEachHandler` / `LoopHandler`는 배열/빈 값을 그냥 반환하고 끝 (`foreach.handler.ts`, `loop.handler.ts`).
- `ForEachExecutor`, `LoopExecutor` 클래스는 `backend/src/modules/execution-engine/containers/`에 존재하지만 어느 곳에서도 호출되지 않음.
- `buildGraph`(`graph/graph-builder.ts:28-29`)는 `containerId != null`인 노드와 컨테이너 경계를 넘는 edge를 **사전에 걸러내고** 탑-레벨 그래프만 남긴다. 즉 런타임에는 container 내부가 아예 보이지 않는 상태.

추가 요구: **Map 노드를 container로 전환**하고, 본체 서브그래프의 수집 결과를 명시하기 위해 ForEach/Map에 **`emit` 포트**를 둔다 (제안 B).

최종 결과:
1. ForEach/Loop container의 body 서브그래프가 실제로 iter 단위로 실행되고, 각 iter의 leaf/emit 출력이 수집돼 done 포트로 흘러간다.
2. ForEach/Map은 `body`·`emit`·`done` 3개 포트를 가진다. body 내부에서 emit 포트로 들어온 값이 해당 iter의 결과값이 된다.
3. Map 노드는 container로 바뀌고, 기존 `mapping` inline config는 제거(마이그레이션 경로 제공).

## 전체 구조

### Phase 1: Container 런타임을 엔진에 연결 (foundation)
- 컨테이너 자식 로딩/실행 경로 확립. 기존 ForEachExecutor/LoopExecutor 호출.
- 수집 방식: 이 단계에서는 spec의 기존 leaf-auto-collect 규칙을 유지(기존 spec과 호환).
- 범위: 엔진 service + 그래프 빌더 + 기존 executor 통합.

### Phase 2: emit 포트 도입 (ForEach)
- ForEach 포트에 `emit` 추가. body 서브그래프에서 emit 포트로 들어오는 edge의 source 노드 출력을 iter 결과로 수집.
- emit edge가 없으면 빈 배열 또는 leaf fallback(결정 필요 — 아래 "결정 필요 사항" 참조).

### Phase 3: Map을 container로 전환
- `map.handler.ts`의 inline 구현 제거, Map도 container 타입으로 전환.
- 포트: `body`, `emit`, `done` (ForEach와 동일).
- `mapping[]` config 제거. 마이그레이션 노트 작성.

### Phase 4: 문서·프론트엔드 반영
- `spec/4-nodes/1-logic-nodes.md` Map/ForEach 섹션 개정.
- 프론트 `node-definitions`의 `map`, `foreach`에 `isContainer: true`, `emit` 출력 포트 추가.
- `MapConfig` UI를 (container로 전환됐으므로) 최소화 — `inputField`만 남김.

---

## Phase 1 상세 (가장 중요, 엔진 코어 변경)

### 목표
최상위 pointer 루프가 container 노드를 만났을 때, 해당 container의 자식 서브그래프를 **반복 실행하는 서브루프**로 위임하고, 수집된 결과를 container의 output으로 세팅해서 이후 done 포트 edge가 정상 전파되도록 한다.

### 핵심 파일
- `backend/src/modules/execution-engine/execution-engine.service.ts` (pointer 루프 내부)
- `backend/src/modules/execution-engine/graph/graph-builder.ts` (container-aware 변형 추가)
- `backend/src/modules/execution-engine/containers/foreach-executor.ts` (시그니처 조정)
- `backend/src/modules/execution-engine/containers/loop-executor.ts` (시그니처 조정)

### 접근 방법

**A. 서브그래프 실행 함수 추출 (refactor)**

기존 pointer 루프 본체(`execution-engine.service.ts:780-901`)를 **재사용 가능한 함수**로 분리한다:

```ts
private async runSubgraph(opts: {
  nodes: Node[];             // 실행 대상 (서브셋)
  edges: Edge[];             // 서브셋 edges
  context: ExecutionContext; // 공유
  input: unknown;            // 서브그래프 진입 값
  nodeMap, executedNodes, reachable 등 parent scope 전달 / 복사
}): Promise<void>
```

Top-level execution은 이 함수를 `{ nodes: topLevelNodes, edges: topLevelEdges }`로 한 번 호출. Container 실행은 iter마다 `{ nodes: containerChildren, edges: childEdges }`로 재귀 호출.

**B. Container dispatch**

`runSubgraph`의 pointer 루프에서 현 노드가 container type이면:
1. 해당 container의 자식 노드/edge 로드.
2. `body` 포트 edge의 target 노드를 진입점으로 삼음.
3. `done` 포트 edge는 container 외부로 나가므로 부모 스코프가 처리.
4. ForEach/Loop 타입에 따라 executor 호출:
   - **ForEach**: `ForEachExecutor.execute(config, context, (item, ctx) => runSubgraph(subOpts))` — 각 iter마다 서브루틴 실행, 결과 수집.
   - **Loop**: `LoopExecutor.execute(...)` 동일 패턴.
5. 수집 결과를 container 노드의 `nodeOutputCache[containerId]`에 세팅. 이후 outgoing edge 전파는 기존 로직 그대로 동작 → `done` 포트 edge가 따라간다.

**C. State 관리**

- `executedNodes`: iter 별로 **body children을 reset** 해야 같은 노드를 여러 번 실행 가능. 하지만 부모 스코프의 executedNodes는 건드리면 안 됨. → 자식 executedNodes를 **별도 Set**으로 새로 할당하고 iter 시작마다 clear.
- `reachable`: body 진입점(body 포트 edge의 target)을 reachable에 seed. 자식 스코프 전용.
- `nodeOutputCache`: 공유. iter 내부의 output은 마지막 iter 값으로 덮어써지지만 허용 (spec §3.2에 의거).
- `context.itemContext` / `context.loopContext`: executor가 이미 set/unset 처리.

**D. back-edge / 무한루프 guard**
- 자식 서브그래프 내부의 back-edge는 기존 `identifyBackEdges` 그대로 적용.
- container 자체가 iter를 돌리는 것이므로 container 바깥의 back-edge와는 독립.

### Phase 1 테스트

- `backend/src/modules/execution-engine/execution-engine.service.spec.ts`에 신규 suite:
  - ForEach container: body 내 Transform 1개로 각 item에 접미사 붙이기 → done 포트가 배열 수신.
  - Loop container: count=3, body 내 카운터 증가 → done 포트.
  - 중첩 container: ForEach 안에 Loop.
  - errorPolicy=skip일 때 skipped 객체 포함.

---

## Phase 2 상세 — emit 포트 (ForEach)

### 목표
body 서브그래프에서 emit 포트로 들어온 값을 iter 결과로 수집.

### 변경
- 프론트 `foreach` 노드 정의에 `emit` output 추가.
  - `outputs: [{ id: "body", ... }, { id: "emit", ... }, { id: "done", ... }]`
- spec 문서에 emit 포트 규칙 기술.
- 엔진: container 실행 시
  1. 자식 edges 중 **targetNodeId == containerId && targetPort == 'emit'** 를 찾아 `emitEdge`로 지정 (0개 또는 1개만 허용).
  2. iter 종료 후 `emitEdge.sourceNodeId`의 output을 읽어 iter 결과로 수집.
  3. emit edge가 없으면 → **결정 필요 (아래)**.

### 결정 필요 사항 ⚠️

1. **emit edge가 없을 때 동작**
   - (a) 빈 배열로 수집 (명시적이지만 실수 유발).
   - (b) 기존 spec의 leaf auto-collect로 fallback.
   - (c) validate 단에서 에러.
   
   **권장**: **(c) validate 에러** — 제안 B의 "명시성"을 끝까지 일관되게.

2. **emit edge 개수 제한**
   - 단일 emit 포트에 여러 node가 연결 가능한가?
   - **권장**: 0개 초과, 다만 여러 개 연결 시 마지막에 실행된 것 또는 **에러**.
   - 구현 단순화를 위해 **validate에서 1개로 제한**.

3. **conditional emit**
   - body 내부에서 if/else 분기에 따라 일부 iter만 emit 하도록 할 수 있나? 즉 "이 iter는 결과 없음"을 어떻게 표현?
   - 초기 버전: 모든 iter가 반드시 emit해야 함. 나중에 필요 시 "skip emit" 규칙을 별도 설계.

### Phase 2 테스트
- ForEach + body에 Transform + emit 연결 → done이 변환된 배열을 받음.
- body에서 emit 포트 대신 다른 포트로만 연결된 경우 validate 에러.
- 중첩 ForEach의 각 emit이 올바르게 수집.

---

## Phase 3 상세 — Map을 container로

### 변경
- `map.handler.ts` 제거 또는 deprecate. Map도 container dispatch 대상.
  - 구현적으로는 ForEach와 거의 동일 (배열 iteration + emit 수집). 차이는 "reduce 같은 비수집 시나리오 없음 — Map은 항상 수집"이라는 계약 뿐.
  - **엔진 내부 재사용**: Map도 `ForEachExecutor`를 그대로 사용. 사용자 관점에서만 다른 노드 타입.
- 프론트 `map` 노드 정의에 `isContainer: true`, `outputs: [body, emit, done]` 반영.
- `logic-configs.tsx`의 `MapConfig`를 `MapContainerConfig`로 교체: `inputField`만 남기고 `mapping`, `outputField`는 제거.
- `scripts/migrate-node-output-refs.ts` 업데이트.
- 기존 Map 사용 workflow 영향: **breaking change**. 기존에 저장된 `mapping[]`은 더 이상 적용되지 않음. spec에서 Transform 노드로 마이그레이션 경로 안내.

### Phase 3 테스트
- Map container: body 내 Transform으로 각 item 가공 → emit → done.
- 기존 inline Map 테스트(있다면) 정리.

---

## Phase 4 상세 — 문서·프론트엔드 마무리

### 문서
- `spec/4-nodes/1-logic-nodes.md`
  - Map 섹션: container로 재작성. mapping 제거. body/emit/done 설명.
  - ForEach 섹션: emit 포트 규칙 추가. 기존 leaf auto-collect는 **삭제 또는 legacy로 강등**.
- `spec/5-system/4-execution-engine.md` §3.2 업데이트: emit 수집 규칙.

### 프론트엔드
- `node-definitions/index.ts`: `map`에 `isContainer: true` + 포트 갱신, `foreach`에 emit 포트 추가.
- `logic-configs.tsx`: `MapConfig` 단순화.
- `node-config-summary.ts`: `mapSummary` 업데이트 (mapping 길이 기반 요약 → inputField 기반).
- 캔버스 렌더링: `isContainer` 노드가 이미 프론트에서 container로 렌더링되고 있음 → Map도 자동 container 박스로 표시될 것으로 예상. (확인 필요)

---

## 영향 분석

### Breaking changes
1. 기존 `map` 노드를 사용하는 workflow: `mapping[]` 정의가 무시되고 container body 필요 → **실행 불가**. 사용자 수동 전환.
2. 기존 ForEach 사용 workflow (이미 배포됐다면): emit 포트 필수화 시 validate 에러 발생 → 수동 전환.

### 마이그레이션 스크립트
- `map` 노드를 `transform`(array_map 연산) 또는 빈 Map container로 변환하는 스크립트 제공 여부 결정 필요. 현 프로덕트가 초기 단계인지 확인 필요.

### 기존 테스트
- ForEachHandler / LoopHandler의 기존 unit test: container runtime 도입 후 더 이상 단독으로 의미 없음 → 삭제 또는 엔진 통합 테스트로 흡수.
- `execution-engine.service.spec.ts`: container-aware 케이스 신규 추가.

---

## 검증 계획

### Phase 끝마다 수행
- `cd backend && npm run lint && npx jest && npm run build`
- `cd frontend && npm run lint && npx vitest run && npm run build`

### 수동 E2E (Phase 2 이후)
- editor에서 ForEach 노드 배치 → body에 Transform 노드 추가 → Transform을 ForEach의 emit 포트에 연결 → done 뒤에 결과 확인 노드.
- 실행 후 Run Results 드로어에서 각 iter 별 Transform output 확인, done 포트 배열 수신 확인.

---

## 결정 요청 사항 (진행 전 확인)

1. **emit edge 없을 때**: (c) validate 에러로 확정할지.
2. **기존 Map workflow 마이그레이션**: 자동 스크립트 필요한가, 아니면 breaking change로 처리 OK인가.
3. **Phase 순서**: 위 순서대로 한 단계씩 진행하며 중간 커밋/검토할지, 아니면 모든 phase를 한 PR로 묶을지.
4. **spec §3.2의 기존 leaf auto-collect 규칙**: emit 도입 후 완전 폐기할지, fallback으로 유지할지. (권장: 폐기)

이 네 가지 결정 후 Phase 1부터 실제 구현을 시작하겠습니다.
