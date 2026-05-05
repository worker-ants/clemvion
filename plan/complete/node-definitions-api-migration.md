# 노드 정의 단일화 — Backend 단일 소스 전환 계획

## Context
현재 노드 정의(메타데이터, 포트, `defaultConfig`, config JSON Schema)는 백엔드 `NodeComponentRegistry` 와 프론트엔드 `NODE_DEFINITIONS` 양쪽에 중복 하드코딩되어 있습니다. 방금 `defaultConfig` 를 양쪽에 동일하게 채웠지만, 스펙이 바뀔 때마다 두 곳을 수동으로 동기화해야 하는 상태입니다.

백엔드에는 이미 `GET /nodes/definitions` 엔드포인트가 구현되어 있고 (`backend/src/modules/nodes/nodes.controller.ts:40`), `NodeComponentRegistry.listDefinitions()` 가 `metadata`, `ports`, `configSchema`(zod → JSON Schema), `inputSchema`, `outputSchema` 를 모두 반환합니다 (`backend/src/nodes/core/node-component.registry.ts:51`). 즉 API 자체는 이미 존재하며, 프론트가 이를 소비하도록 전환하면 됩니다.

목표: 프론트 하드코딩된 `NODE_DEFINITIONS` 를 제거하고, 앱 부트 시점에 `/nodes/definitions` 를 한 번 fetch 해 전역 store 에 캐시. 기존 sync getter (`getNodeDefinition`, `getNodesByCategory`) 의 호출 코드를 대부분 그대로 두어 blast radius 를 최소화.

## 주요 제약과 의사결정

1. **sync API 유지**: `getNodeDefinition` 는 현재 13개 이상 파일에서 동기적으로 호출됨 (`custom-node.tsx`, `edge-utils.ts`, `use-execution-events.ts`, `settings-panel`, `workflow-canvas` 등). 이를 async 로 바꾸면 변경 범위가 폭발하므로 **store 선로딩 + sync selector** 패턴을 유지합니다.
2. **에디터 진입 전 프리페치**: 에디터 진입점인 `frontend/src/app/(editor)/workflows/[id]/editor-loader.tsx` 에서 이미 워크플로우 데이터를 로드 중이므로, 같은 지점에 `node-definitions` fetch 를 병렬로 묶습니다. 미로드 상태에서 `getNodeDefinition` 이 호출되는 경로가 없도록 보장.
3. **아이콘과 카테고리 메타**: `icon` 은 Lucide 아이콘 이름 문자열로 이미 직렬화 가능. `CATEGORY_COLORS` 와 `CATEGORIES` 상수는 백엔드 metadata 의 `color` 값과 카테고리 라벨/아이콘을 기반으로 프론트에서 파생하거나, 변화가 적으므로 프론트 static 상수로 유지(스펙 상 카테고리 목록은 고정).
4. **configSchema 활용**: 현재 프론트는 `NodeDefinition` 에 schema 를 들고 있지 않음. 이번 단계에서는 store 에 JSON Schema 를 그대로 보관만 하고, 실제 활용(폼 자동 생성 등)은 후속 작업. 단, 타입 정의에는 포함시켜 향후 확장 가능하도록.
5. **인증 경계**: `/nodes/definitions` 는 현재 `@ApiBearerAuth` 컨트롤러에 속하므로 로그인된 사용자만 호출 가능. 에디터는 어차피 로그인 후 진입하므로 문제 없음.

## 작업 순서

### 1단계 — 백엔드 응답 형식 정리
`backend/src/nodes/core/node-component.registry.ts` 의 `NodeDefinitionView` 를 검토:
- 현재 `metadata` 는 `NodeComponentMetadata` 그대로 노출 → 프론트가 바로 소비 가능.
- `configSchema` 는 이미 `z.toJSONSchema()` 로 변환 중.
- 추가 검토: `NodeComponentMetadata.category` 타입이 프론트와 호환되는지, `summaryTemplate`/`isDynamicPorts` 등 프론트에서 필요한 필드가 모두 포함되는지 확인.

`backend/src/modules/nodes/nodes.controller.ts:40` 의 `listDefinitions` 에 Swagger 응답 스키마(`NodeDefinitionResponseDto`) 를 명시적으로 추가 — 프론트 타입 생성을 깔끔하게.

### 2단계 — 프론트 store 구축
신규 파일: `frontend/src/lib/stores/node-definitions-store.ts`

- zustand store 에 `definitions: Record<string, NodeDefinition>` 와 `status: 'idle' | 'loading' | 'ready' | 'error'` 보관.
- `loadNodeDefinitions()` 액션: 이미 `ready` 면 no-op, 아니면 `GET /nodes/definitions` 호출 후 맵에 적재.
- selector: `getNodeDefinition(type)`, `getAllNodeDefinitions()`, `getNodesByCategory(category)` — 현재 시그니처와 동일하게 유지.

`frontend/src/lib/node-definitions/index.ts` 는 **타입 정의와 `CATEGORIES`/`CATEGORY_COLORS` 상수만** 남기고, `NODE_DEFINITIONS` 배열과 기존 sync getter 들은 제거. 기존 import 경로를 유지하기 위해 store selector 를 같은 모듈에서 re-export.

`NodeDefinition` 타입에 `defaultConfig?: Record<string, unknown>`, `configSchema?: unknown`(JSON Schema), `inputSchema?: unknown`, `outputSchema?: unknown` 를 추가.

### 3단계 — 프리페치 훅 연결
`frontend/src/app/(editor)/workflows/[id]/editor-loader.tsx` (이미 `getNodeDefinition` 을 사용 중):
- 에디터 로딩 단계에서 `loadNodeDefinitions()` 를 `Promise.all` 로 기존 워크플로우 fetch 와 함께 실행.
- store status 가 `ready` 될 때까지 기존 로딩 UI 재활용.

에디터 바깥에서 `getNodeDefinition` 을 쓰는 경로:
- `frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx:318`
- `frontend/src/components/editor/run-results/result-detail.tsx:318`
- `frontend/src/lib/websocket/use-execution-events.ts:44`

이들 진입점에도 마찬가지로 page 수준에서 `loadNodeDefinitions()` 를 호출해 prefetch. 단일 load 플래그 덕에 중복 호출해도 비용 없음.

### 4단계 — 기존 getter 호출부 정리
`getNodeDefinition` / `NODE_DEFINITIONS` 를 참조하는 모든 파일을 검토:
- import 경로는 그대로 유지 (store 가 re-export 하므로 호출부 수정 불필요).
- `workflow-canvas.tsx:426,428` 의 `NODE_DEFINITIONS` 직접 참조는 새 selector `getAllNodeDefinitions()` 로 교체.

테스트 mock 파일도 함께 조정:
- `frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:31`
- `frontend/src/components/editor/run-results/__tests__/result-detail.test.tsx:14`
→ store selector 를 mock 하거나, 기존처럼 `@/lib/node-definitions` 모듈 mock 을 유지하되 re-export 대상만 mock.

### 5단계 — 하드코딩된 `defaultConfig` 제거
방금 추가한 `frontend/src/lib/node-definitions/index.ts` 의 `defaultConfig` 필드들은 모두 제거. 이제 백엔드가 단일 소스.

### 6단계 — 검증
1. `cd backend && npm run lint && npm run test` — `/nodes/definitions` 통합 테스트(존재 시) 및 registry 테스트 통과.
2. `cd frontend && npx tsc --noEmit && npm run lint && npm run test` — 기존 mock 의존 테스트들 (use-execution-events, result-detail) 이 여전히 통과하는지 확인.
3. `cd frontend && npm run build` — production build.
4. 수동 확인:
   - 에디터 진입 → 팔레트에 모든 노드가 나타나고 기존과 동일한 아이콘/색상으로 표시.
   - 노드 드래그 후 settings-panel 열어 디폴트 값이 채워져 보이는지 확인 (HTTP Request 의 `timeout: 30000` 등).
   - execution 결과 페이지에서 노드 타입별 배지/카테고리가 정상 렌더링.
5. 네트워크 탭에서 `/nodes/definitions` 가 에디터 진입 시 한 번만 호출되는지 확인.

## 주요 대상 파일
- 백엔드: `backend/src/nodes/core/node-component.registry.ts`, `backend/src/modules/nodes/nodes.controller.ts`
- 프론트 생성: `frontend/src/lib/stores/node-definitions-store.ts`
- 프론트 수정: `frontend/src/lib/node-definitions/index.ts` (타입/상수만 남김), `frontend/src/app/(editor)/workflows/[id]/editor-loader.tsx`, `frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`, `frontend/src/components/editor/canvas/workflow-canvas.tsx` (NODE_DEFINITIONS 직접 참조 부분)
- 테스트 mock: `frontend/src/lib/websocket/__tests__/use-execution-events.test.ts`, `frontend/src/components/editor/run-results/__tests__/result-detail.test.tsx`

## Out of Scope (후속 작업 후보)
- `configSchema`(JSON Schema) 를 기반으로 settings-panel 폼 자동 생성 — 현재 수동 폼 컴포넌트가 23개 각각 존재. 본 계획에서는 store 에 schema 를 보관만 하고 UI 는 그대로.
- 노드 정의의 워크스페이스별/플러그인 기반 확장(동적 등록).
- `CATEGORIES` 상수를 백엔드가 관리하는 확장(현재 7개 고정, 변동 드묾).
