# Node Handlers Co-location Migration Plan

## 배경 (Context)

이전 리팩터링에서 **노드 구성 요소**는 `/backend/src/nodes/<category>/<node-name>/` 디렉터리로 분리되었지만, **실행 핸들러**는 여전히 `/backend/src/modules/execution-engine/handlers/`에 남아 있습니다.

원래 구조 변경의 의도는 "한 노드의 모든 구성 요소(schema, metadata, handler, test)는 해당 노드 디렉터리에 모여 있어야 한다"이므로, 핸들러를 노드 단위 경로로 이전해야 합니다.

### 현 상태 (투명한 사실)
- 27개 노드 컴포넌트가 존재하며, 각각 `component.ts`에서 relative path로 해당 핸들러를 import하고 있음
- 핸들러 등록 메커니즘: `NodeComponent.createHandler(deps)` 팩토리 → `NodeHandlerRegistry.register(type, handler)`
- 외부에서 개별 핸들러를 직접 import하는 곳은 없음 (`handlers/index.ts`는 정의되어 있으나 외부 참조 없음)
- `parallel.schema.spec.ts` 한 곳에서만 spec 파일이 handler를 직접 import

### 이전 대상 목록

**핸들러 파일 (27개 + spec):**
| 카테고리 | 노드 수 |
|---|---|
| trigger | 1 |
| data | 2 |
| flow | 1 |
| ai | 3 |
| integration | 3 |
| logic | 11 |
| presentation | 5 (+ 4개 button 변형 spec) |

**공용 유틸 (재배치 필요):**
| 현재 위치 | 사용처 | 제안 위치 |
|---|---|---|
| `handlers/node-handler.interface.ts` | 전체 handler + context + expression + containers | `nodes/core/node-handler.interface.ts` |
| `handlers/node-handler.registry.ts` | execution-engine module DI | `nodes/core/node-handler.registry.ts` |
| `handlers/logic/nested-value.util.ts` | logic + data + presentation (8개 핸들러) | `nodes/core/nested-value.util.ts` |
| `handlers/logic/condition-eval.util.ts` | logic (if-else, switch, filter) | `nodes/logic/_shared/condition-eval.util.ts` |
| `handlers/integration/integration-handler-base.ts` | integration (3개) | `nodes/integration/_base/integration-handler-base.ts` |
| `handlers/integration/http-safety.ts` | http-request만 사용 | `nodes/integration/http-request/http-safety.ts` (co-located) |
| `handlers/presentation/*-buttons.handler.ts` | 해당 presentation 노드의 하위 기능 | 해당 presentation 노드 디렉터리 (handler에 병합 여부 검토) |
| `types/button.types.ts` (execution-engine/types) | presentation (5개) | `nodes/presentation/_shared/button.types.ts` |

**execution-engine에 남을 것:**
- `handler-output.adapter.ts` — execution-engine이 직접 호출 (orchestration 영역)
- orchestration/graph/expression/context/state/error/queue 관련 모든 파일

## 의존성 방향 (After)

```
nodes/core ─────────────┐
   ▲                    │  (interface, registry 제공)
   │                    ▼
nodes/<category>/<node> ─── imports shared util within nodes
   ▲
   │  (component 주입)
execution-engine (orchestration only)
```

이로써 `nodes/*` → `execution-engine/*` 참조가 완전히 사라지고, 의존성 방향이 단일 경로가 됩니다.

## 최종 타겟 구조

```
backend/src/nodes/
├── core/
│   ├── node-component.interface.ts       (기존; NodeHandler 등 import 경로만 갱신)
│   ├── node-component.registry.ts        (기존; NodeHandlerRegistry import 경로 갱신)
│   ├── node-handler.interface.ts         ← NEW (이전)
│   ├── node-handler.registry.ts          ← NEW (이전)
│   ├── nested-value.util.ts              ← NEW (이전, 범용 유틸)
│   ├── categories.ts, zod-validator.ts, index.ts
├── integration/
│   ├── _base/
│   │   └── integration-handler-base.ts   ← NEW (이전)
│   ├── http-request/
│   │   ├── http-request.component.ts
│   │   ├── http-request.schema.ts
│   │   ├── http-request.handler.ts       ← NEW (이전)
│   │   ├── http-request.handler.spec.ts  ← NEW (이전)
│   │   └── http-safety.ts                ← NEW (이전, co-located)
│   ├── database-query/  (동일 패턴)
│   └── send-email/      (동일 패턴)
├── logic/
│   ├── _shared/
│   │   └── condition-eval.util.ts        ← NEW (이전)
│   ├── if-else/ … (11개 노드, 각각 handler + spec 병합)
├── presentation/
│   ├── _shared/
│   │   └── button.types.ts               ← NEW (이전)
│   └── carousel|table|chart|form|template/ (각각 handler + 관련 buttons spec 병합)
├── ai/, data/, flow/, trigger/ (동일 패턴)
└── index.ts (기존 ALL_NODE_COMPONENTS)

backend/src/modules/execution-engine/
├── execution-engine.service.ts           (import 경로만 갱신)
├── execution-engine.module.ts
├── handler-output.adapter.ts             ← 이동 (handlers/ 하위 → 이 레벨)
├── containers/, context/, expression/, graph/, state/, error/, queues/, types/, utils/
└── (handlers/ 디렉터리 제거)
```

## 마이그레이션 전략

### 원칙
- **인터페이스 재수출(re-export) 임시 유지**: 각 Phase에서 이전된 파일의 구 경로에 re-export 파일을 남겨 점진적으로 전환 (마지막 Phase에서 제거)
  - 예외: 현재 외부 import가 없는 경우 re-export 없이 바로 이동
- **각 Phase 끝에서 반드시 lint + unit test + build 통과 확인** (CLAUDE.md TEST WORKFLOW)
- **PR 단위는 Phase 단위**로 분리 (리뷰 용이성)
- 파일 이동 시 **Git rename 추적**을 위해 `git mv` 사용 지향 (히스토리 보존)

### Phase 구분

#### Phase 1: 핵심 인터페이스/레지스트리 이동
**목표**: `NodeHandler`, `ExecutionContext`, `NodeHandlerOutput`, `ValidationResult`, `NodeHandlerRegistry`를 `nodes/core/`로 이전

1. 파일 이동:
   - `handlers/node-handler.interface.ts` → `nodes/core/node-handler.interface.ts`
   - `handlers/node-handler.registry.ts` → `nodes/core/node-handler.registry.ts`
2. 구 경로에 re-export shim 작성 (외부 안정성)
3. 다음 import 갱신:
   - `nodes/core/node-component.interface.ts`: `../../modules/execution-engine/handlers/node-handler.interface` → `./node-handler.interface`
   - `nodes/core/node-component.registry.ts`: 동일 패턴
   - `execution-engine/context/execution-context.service.ts`, `expression-resolver.service.ts`, `containers/*`: 경로 갱신
   - 기타 import 확인 (약 10곳)
4. `execution-engine.module.ts`의 provider 경로 갱신
5. 테스트

#### Phase 2: 범용/카테고리 공용 유틸 이동
**목표**: 여러 핸들러가 공유하는 유틸을 선제적으로 재배치하여, Phase 3에서 핸들러 이동 시 import를 안정화

1. `handlers/logic/nested-value.util.ts` (+ spec) → `nodes/core/nested-value.util.ts`
2. `handlers/logic/condition-eval.util.ts` (+ spec) → `nodes/logic/_shared/condition-eval.util.ts`
3. `handlers/integration/integration-handler-base.ts` (+ spec) → `nodes/integration/_base/integration-handler-base.ts`
4. `modules/execution-engine/types/button.types.ts` (+ spec) → `nodes/presentation/_shared/button.types.ts`
5. 영향받는 handler 파일들의 import 경로 일괄 갱신
6. 테스트

#### Phase 3: 핸들러 이동 (카테고리별 서브-PR)
각 서브-Phase 절차:
1. `handlers/<cat>/<name>.handler.ts` → `nodes/<cat>/<name>/<name>.handler.ts`
2. `handlers/<cat>/<name>.handler.spec.ts` → 같은 디렉터리로 이동
3. component 파일의 handler import 경로 갱신 (상대 경로 `./handler` 형태로)
4. `handlers/index.ts`에서 해당 entry 제거
5. `nodes/<cat>/<name>/index.ts`에서 handler re-export (선택적)
6. 테스트

**서브-Phase 순서 (영향 범위 작은 것부터):**
- 3a. trigger (1개: manual-trigger)
- 3b. data (2개: code, transform)
- 3c. flow (1개: workflow) — `workflow-executor.interface.ts`도 함께 이동 검토
- 3d. ai (3개)
- 3e. integration (3개) — `http-safety.ts` co-location 포함
- 3f. logic (11개)
- 3g. presentation (5개) — `*-buttons.handler.ts` 및 spec 정리 포함

#### Phase 4: 정리 (Cleanup)
1. `execution-engine/handlers/handler-output.adapter.ts`를 `execution-engine/output-adapter.ts`로 이동 (handlers/ 제거 준비)
2. `execution-engine/handlers/index.ts` 삭제 (Phase 3에서 모두 비워진 상태)
3. 빈 디렉터리 `handlers/`, 구 re-export shim 제거
4. `nodes/core/index.ts`에서 공개 API 재정리 (NodeHandler, NodeHandlerRegistry 등 export)
5. README/스펙 문서에 반영 (spec/5-system/4-execution-engine.md)
6. 최종 전수 테스트

## 영향 받는 주요 파일 (Phase별 요약)

### Phase 1 수정 대상
- `backend/src/modules/execution-engine/handlers/node-handler.interface.ts` (이동)
- `backend/src/modules/execution-engine/handlers/node-handler.registry.ts` (이동)
- `backend/src/modules/execution-engine/execution-engine.module.ts`
- `backend/src/modules/execution-engine/execution-engine.service.ts`
- `backend/src/modules/execution-engine/context/execution-context.service.ts` (+ spec)
- `backend/src/modules/execution-engine/expression/expression-resolver.service.ts` (+ spec)
- `backend/src/modules/execution-engine/containers/loop-executor.ts`, `foreach-executor.ts`, `parallel-executor.ts` (+ specs)
- `backend/src/nodes/core/node-component.interface.ts`
- `backend/src/nodes/core/node-component.registry.ts` (+ spec)

### Phase 3 수정 대상 (카테고리별)
각 노드의 `component.ts` 내 handler import 1줄 갱신 (27개 파일)
+ handler 및 spec 파일 이동 (약 35개)

## 검증 계획 (Verification)

각 Phase 종료 시:
```bash
cd backend
npm run lint
npm test
npm run build
```

**E2E 검증 (Phase 4 종료 후):**
1. `docker-compose up`으로 백엔드/프론트엔드 기동
2. 각 카테고리의 노드를 한 개씩 사용하는 워크플로를 실행
   - trigger → logic → integration (http-request) → data (transform) → presentation (table) 체인 실행 
   - AI 노드 (ai-agent)를 포함한 플로 실행
3. 실행 결과가 기존과 동일한지 확인 (status, output, meta 모두)

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 순환 import 발생 가능성 (`nodes/core/` ↔ 하위 node 디렉터리) | 빌드 실패 | Phase 1에서 `core/`가 하위 노드 디렉터리를 참조하지 않도록 엄격히 유지 |
| Phase 3 도중 `handlers/index.ts` 부분 export 상태 | 중간 커밋의 일관성 | 각 서브-Phase 내에서 index.ts 갱신을 함께 수행 |
| 히스토리 손실 (리네임 감지 실패) | blame/log 추적 어려움 | `git mv` 사용, 가능하면 파일 내용 수정은 별도 커밋 |
| 테스트 spec의 상대 경로 문제 | 런타임 실패 | 각 Phase에서 spec 먼저 실행 (unit test) |
| `*.handler.js` 확장자 import 규약 (ESM) | Import 해석 실패 | 기존 패턴 준수 — 새 위치에서도 `.js` 확장자 유지 |

## 최종 결정 필요 사항 (사용자 확인)

1. **Phase를 별도 커밋/PR로 나눌지 or 한 번에 처리할지**  
   → 추천: Phase 1 / 2 / 3 (카테고리별 병합 가능) / 4로 분할하되, 단일 브랜치에서 순차 커밋.

2. **`nested-value.util.ts` 위치**  
   → `nodes/core/`에 배치 (logic·data·presentation 모두 사용하므로)

3. **`*-buttons.handler.spec.ts`의 처리**  
   → 현재 대응되는 `*.handler.ts` 없이 spec만 존재하는 형태(예: `carousel-buttons.handler.spec.ts`). 해당 노드 핸들러 내부 button 처리 로직을 테스트하는 것이므로 노드 디렉터리로 이동 (이름 유지 or `buttons.spec.ts`로 단순화).

4. **re-export shim의 유지 기간**  
   → Phase 4에서 전부 제거 (외부 import가 없으므로 즉시 제거해도 무방함)
