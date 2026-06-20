# 신규 식별자 충돌 검토 — `spec/4-nodes` (--impl-prep, M-5 노드 DI 레이어1)

## 검토 전제

작업 SoT: `plan/in-progress/refactor-m5-node-di-layer1.md` + 설계 SoT `plan/in-progress/refactor/02-architecture.md` §M-5 (line 229·246).
본 작업은 **behavior-preserving 리팩터링** (정적 배열 `ALL_NODE_COMPONENTS` → DI multi-provider). target spec(`spec/4-nodes`) 본문은 등록 메커니즘 기술만 갱신(§1.0/§4, "정적 배열"→"DI 부팅 등록")하며 새 요구사항·엔티티·엔드포인트를 도입하지 않는다.

전수 확인 결과 이 작업이 도입하는 **유일한 신규 식별자는 DI 주입 토큰 `NODE_COMPONENT`** 다 (`02-architecture.md:246`). 그 외 프롬프트의 target 본문에 등장하는 식별자(`BACKGROUND_RUN_NOT_FOUND`, `MERGE_TIMEOUT`, `PARALLEL_*`, `CONTAINER_*`, `GET /api/executions/:executionId/background-runs/:backgroundRunId` 등)는 **이미 구현된 기존 노드 spec** 의 식별자이지 본 리팩터링 신규분이 아니다 — naming-collision 관점 오탐 대상.

## 발견사항

### [INFO] 신규 DI 토큰 `NODE_COMPONENT` — 충돌 없음 (확인 완료)
- target 신규 식별자: `NODE_COMPONENT` (multi-provider 주입 토큰, `{ provide: NODE_COMPONENT, useValue, multi: true }`)
- 기존 사용처: 없음. `codebase/backend/src/**` 전수 grep 결과 동일 이름의 토큰·심볼·문자열 값(`= 'NODE_COMPONENT'`) 부재.
- 상세: 기존 DI 토큰 컨벤션은 `WORKFLOW_EXECUTOR = 'WORKFLOW_EXECUTOR'` (string 값, `nodes/core/workflow-executor.interface.ts:84`). `NODE_COMPONENT` 도 같은 패턴을 따르면 일관적이며, 문자열 값 `'NODE_COMPONENT'` 도 기존 토큰 값과 겹치지 않는다(`MAX_NODE_ITERATIONS`·`CODE_NODE_MEMORY_LIMIT_MB` 등은 config/ENV 키로 의미·네임스페이스 상이).
- 제안: 토큰 정의 위치를 `nodes/core/` (예: `node-component.interface.ts` 또는 신규 `node-component.token.ts`) 에 두고 `WORKFLOW_EXECUTOR` 와 동일하게 string-valued 로 선언. 별도 조치 불요.

### [WARNING] 카테고리 aggregator 모듈명이 기존 `NodesModule` 과 의미 충돌 소지
- target 신규 식별자: 미정 — 설계 D-1 이 "aggregator 모듈이 카테고리 모듈을 import" 라고만 기술. 구현 시 클래스명/파일명 미지정.
- 기존 사용처: `codebase/backend/src/modules/nodes/nodes.module.ts` 의 `class NodesModule` (Node 엔티티 영속 + `NodesController`(`GET /nodes/definitions`) + `NodesService`). 즉 **API 표면 모듈**.
- 상세: 신규 aggregator 는 per-category 노드-컴포넌트 provider 모듈(`{ provide: NODE_COMPONENT, multi:true }`)을 묶는 **부트스트랩/등록 모듈**로 역할이 다르다. 이를 `NodesModule`/`nodes.module.ts` 로 명명하면 동일 이름 두 클래스가 서로 다른 의미(영속·컨트롤러 vs DI 등록)로 공존해 혼선. TS 는 경로로 해소되므로 컴파일 충돌은 아니나(서로 다른 디렉토리), 가독성·온보딩 혼선이 직결.
- 제안: aggregator 를 `NodeComponentsModule`(파일 `nodes/node-components.module.ts`) 처럼 역할이 드러나는 이름으로 명명해 기존 `modules/nodes/NodesModule` 과 구분. per-category 모듈도 `LogicNodesModule` 등 `…NodesModule`/`…NodeComponentsModule` 일관 접미사 권장.

### [INFO] per-category 노드 모듈 파일명 — 기존 vendor 모듈과 비충돌 (확인 완료)
- target 신규 식별자: 카테고리별 Nest 모듈 파일 (예상 `nodes/logic/logic.module.ts`, `nodes/flow/flow.module.ts`, `nodes/ai/ai.module.ts`, `nodes/data/…`, `nodes/presentation/…`, `nodes/trigger/…`, `nodes/integration/integration.module.ts`).
- 기존 사용처: `nodes/` 트리 내 현존 `*.module.ts` 는 `integration/cafe24/cafe24.module.ts`·`integration/makeshop/makeshop.module.ts` (vendor 하위 스코프) 뿐.
- 상세: 신규 카테고리-레벨 모듈은 카테고리 디렉토리 루트에 생성되므로 vendor 하위 모듈과 경로·이름 겹치지 않는다. 단 `integration` 카테고리 모듈 신설 시, 그 모듈이 cafe24/makeshop vendor 모듈을 어떻게 합성(import)하는지가 별도 설계 포인트(충돌 아님, 구성 결정).
- 제안: 없음. 파일 경로 컨벤션(`nodes/<category>/<category>.module.ts`) 준수면 충돌 없음.

### [INFO] `ALLOWED_NODE_TYPES`·`ALL_NODE_TYPES` — 신규 아님 (기존 재사용, 오탐 차단)
- 후보 식별자: `ALLOWED_NODE_TYPES` (plan line 19), `ALL_NODE_TYPES` (D-2).
- 기존 사용처: `ALLOWED_NODE_TYPES` 는 이미 `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts:19` 의 모듈-로컬 const(`= [...ALL_NODE_TYPES]`). `ALL_NODE_TYPES` 는 `nodes/index.ts:77` export.
- 상세: D-2 는 두 이름을 **그대로 유지**하고 파생 출처만 "DI 주입 집합과 단일 출처가 되도록" 보강한다(`@IsIn` class-load 시점 평가라 DI 불가 → 정적 파생 유지 + 부팅 동등성 단언). 새 이름 도입이 아니므로 충돌 없음.
- 제안: 없음.

### [INFO] target 본문 식별자(error codes·endpoint·entity)는 기존 구현분 — naming-collision 무관
- 후보로 추출된 토큰: `BACKGROUND_RUN_NOT_FOUND`, `MERGE_TIMEOUT`, `PARALLEL_NESTED_DEPTH_EXCEEDED`, `PARALLEL_BACK_EDGE`, `CONTAINER_INVALID_CHILD`, `CONTAINER_MISSING_EMIT` 등 + `GET /api/executions/:executionId/background-runs/:backgroundRunId`.
- 기존 사용처: 전부 이미 구현 — `BACKGROUND_RUN_NOT_FOUND`→`modules/executions/background-runs/background-runs.service.ts`, `PARALLEL_NESTED_DEPTH_EXCEEDED`→`nodes/logic/parallel/parallel.schema.ts`, `CONTAINER_INVALID_CHILD`→`modules/execution-engine/execution-engine.service.ts`, background-runs 엔드포인트→ 동 background-runs 모듈.
- 상세: 이들은 if-else/parallel/merge/background 노드 spec(이미 `partial`/구현 완료)의 식별자이며, M-5 레이어1(등록 메커니즘 교체)은 이를 신규 도입·재정의하지 않는다. `--impl-prep` 프롬프트가 target spec 본문 전체를 실어 보내기 때문에 발생하는 자연스러운 동시 등장일 뿐, "신규 식별자 충돌" 아님.
- 제안: 없음. (참고: 레이어2 per-workspace entitlement·레이어3 marketplace 의 `registerDynamic(comp,{workspaceId})`·`NodeCategory='custom'` DB enum 은 본 레이어1 범위 밖이므로 본 검토 대상 아님.)

### [INFO] 신규 ENV var / config key — 도입 없음 (확인 완료)
- 상세: 레이어1 은 DI 배선 변경만으로 behavior-preserving 이며 새 환경변수·설정 키를 도입하지 않는다(정렬은 기존 `core/categories.ts` 의 `order` 사용). target 본문의 `CODE_NODE_MEMORY_LIMIT_MB`·`MAX_NODE_ITERATIONS`·`NODE_ENV` 는 기존 키로, 본 작업 신규분 아님.
- 제안: 없음.

## 요약

M-5 노드 DI 레이어1 은 behavior-preserving 리팩터링으로, 실질 신규 식별자는 multi-provider 주입 토큰 `NODE_COMPONENT` 단 하나다. 동명의 토큰·심볼·문자열 값이 코드베이스에 없어 충돌하지 않으며, 기존 `WORKFLOW_EXECUTOR` string-token 컨벤션과 정합한다. target spec 본문에 동시 등장하는 error code·엔드포인트·엔티티명은 모두 이미 구현된 기존 노드 spec 의 식별자로 naming-collision 관점 오탐이다. 유일한 실질 주의점은 신규 카테고리 aggregator 모듈을 `NodesModule` 로 명명하면 기존 `modules/nodes/NodesModule`(API 표면)과 의미가 겹쳐 혼선을 부르는 점(WARNING) — 역할이 드러나는 이름(`NodeComponentsModule` 등) 권장. CRITICAL 충돌 없음.

## 위험도

LOW
