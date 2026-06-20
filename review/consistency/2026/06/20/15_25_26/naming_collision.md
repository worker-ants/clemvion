# 신규 식별자 충돌 검토 결과

검토 범위: `spec/4-nodes` (구현 완료 후, --impl-done, diff-base=origin/main)
도입 PR: M-5 레이어1 — 노드 등록 정적 배열 → DI multi-provider

---

## 발견사항

신규 도입된 핵심 식별자 목록:

- DI 토큰: `NODE_COMPONENT` (string constant, `nodes/core/node-component.interface.ts` co-locate)
- 모듈 클래스: `NodeComponentsModule` (파일 `nodes/node-components.module.ts`)
- 카테고리 배열: `TRIGGER_COMPONENTS`, `LOGIC_COMPONENTS`, `FLOW_COMPONENTS`, `AI_COMPONENTS`, `INTEGRATION_COMPONENTS`, `DATA_COMPONENTS`, `PRESENTATION_COMPONENTS` (각 `nodes/<category>/index.ts`)
- 신규 파일 경로: `codebase/backend/src/nodes/node-components.module.ts`, `codebase/backend/src/nodes/node-components.module.spec.ts`

충돌 검토 결과:

### 발견사항 없음 — 전 영역 클린

**1. DI 토큰 `NODE_COMPONENT`**
- target 신규 식별자: `export const NODE_COMPONENT = 'NODE_COMPONENT'` (`nodes/core/node-component.interface.ts` L393)
- 기존 사용처: 메인 코드베이스 전체 grep 결과 0건 — `ALL_NODE_COMPONENTS` / `ALL_NODE_TYPES` 만 존재하며 `NODE_COMPONENT` (단독 토큰 형태)는 어디에도 미존재. 유사 토큰 `WORKFLOW_EXECUTOR` (`workflow-executor.interface.ts:84`), `ENGINE_DRIVER` (`engine-driver.interface.ts:190`) 와 네이밍 패턴(UPPER_SNAKE, interface co-locate) 일치.
- 결론: 충돌 없음.

**2. 모듈 클래스 `NodeComponentsModule`**
- target 신규 식별자: `export class NodeComponentsModule` (`nodes/node-components.module.ts`)
- 기존 사용처: 메인 코드베이스에 `NodesModule` (`modules/nodes/nodes.module.ts`) 이 존재. `NodeComponentsModule` 이라는 이름은 0건. plan 문서(`refactor-m5-node-di-layer1.md §명명`) 및 코드 JSDoc 에서 `NodesModule`(Node 영속 + API 표면)과 명시적으로 구분 선언됨.
- 결론: 충돌 없음. `NodesModule` vs `NodeComponentsModule` 은 의미가 분리돼 있고, 혼동 위험도 문서화돼 있음.

**3. 카테고리 배열 이름 (`TRIGGER_COMPONENTS` 등 7종)**
- target 신규 식별자: 각 `nodes/<category>/index.ts` 가 export 하는 `<CATEGORY>_COMPONENTS` 배열.
- 기존 사용처: 메인 코드베이스(`/codebase/`)에서 해당 이름 0건 확인. 기존 `nodes/index.ts` 는 개별 컴포넌트 인스턴스를 직접 import(`manualTriggerComponent` 등)해 `ALL_NODE_COMPONENTS` 에 inline spread — 카테고리 배열 이름 자체가 부재했음.
- 결론: 충돌 없음.

**4. 파일 경로**
- target 신규 파일: `nodes/node-components.module.ts`, `nodes/node-components.module.spec.ts`
- 기존 파일: `nodes/index.ts`, `nodes/nodes.integration.spec.ts` — 충돌 없음. 카테고리별 `nodes/<category>/index.ts` 는 신규 파일이며(기존엔 0건), node-type별 `nodes/<category>/<type>/index.ts` 와 경로 레벨이 달라 충돌 없음.
- 결론: 충돌 없음.

**5. 요구사항 ID**
- 변경된 spec 파일 `spec/4-nodes/0-overview.md` 의 frontmatter `id: nodes-overview` 는 기존과 동일(변경 없음). 본 PR 은 spec 본문만 등록 메커니즘 설명 갱신 — 새 ID 부여 없음.
- 결론: 충돌 없음.

**6. API endpoint / 이벤트 / 환경변수**
- 본 PR 변경 범위(DI 레이어1 내부 리팩터)에서 새 API endpoint, webhook/SSE 이벤트 이름, ENV var, config key 는 도입되지 않음.
- 결론: 해당 없음.

---

## 요약

M-5 레이어1 이 도입하는 신규 식별자(`NODE_COMPONENT` DI 토큰, `NodeComponentsModule` 클래스, 7종 카테고리 배열, 신규 파일 경로 2종) 중 기존 코드베이스·spec·plan 의 어느 위치와도 충돌하는 사례가 발견되지 않았다. `NODE_COMPONENT` 토큰은 기존 `WORKFLOW_EXECUTOR`/`ENGINE_DRIVER` 컨벤션(UPPER_SNAKE, interface 파일 co-locate)을 답습해 일관성이 있으며, `NodeComponentsModule`은 API 영속 레이어의 `NodesModule`과 명시적으로 구분돼 혼동 위험도 낮다. 카테고리 배열 이름(`TRIGGER_COMPONENTS` 등)은 기존에 부재한 네임스페이스로 충돌이 없다.

---

## 위험도

NONE
