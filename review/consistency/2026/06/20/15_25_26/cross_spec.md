# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes` (--impl-done, scope=spec/4-nodes, diff-base=origin/main)

---

## 발견사항

### [CRITICAL] 동적 포트 ID 생성 방식 충돌 — UUID v4 vs stable slug

- **target 위치**: `spec/4-nodes/1-logic/0-common.md §7 (포트 ID 불변성)`, `spec/3-workflow-editor/1-node-common.md §(ID 생성)`, `spec/4-nodes/3-ai/_product-overview.md ND-AG-20`, `spec/4-nodes/6-presentation/0-common.md §1 ButtonDef.id`
- **충돌 대상**: `spec/4-nodes/0-overview.md §1.3 (포트 정의)`
- **상세**:
  - `spec/4-nodes/0-overview.md §1.3` 은 동적 포트를 "config 항목이 보유한 **stable slug id**를 포트 ID로 사용한다. slug는 `^[a-zA-Z0-9_-]{1,64}$` 형식이며 ... **(UUID v4는 사용하지 않는다.)**"라고 명시한다.
  - 반면 `spec/4-nodes/1-logic/0-common.md §7`은 "동적 포트: 생성 시 **UUID v4**를 할당"이라고 명시한다. `spec/3-workflow-editor/1-node-common.md`도 "ID 생성: 동적 포트 추가 시 **UUID v4**를 할당한다"라고 기술한다. `spec/4-nodes/3-ai/_product-overview.md ND-AG-20`도 "포트 ID는 생성 시 UUID v4로 할당"이라고 기술한다.
  - 구현(`codebase/backend/src/nodes/core/port-id.util.ts`)은 `spec/4-nodes/0-overview.md`의 slug 방식을 따른다 — `PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/`를 사용하며 UUID v4를 쓰지 않는다.
  - `spec/4-nodes/6-presentation/0-common.md §1`은 ButtonDef.id를 UUID v4로 정의하고, 이 버튼 id가 presentation 노드의 동적 포트 ID로 쓰인다. 이 점은 spec/4-nodes/0-overview.md의 slug 방식과도 충돌 가능 — presentation 버튼 포트 ID는 UUID v4 형식이며 slug regex `^[a-zA-Z0-9_-]{1,64}$`를 통과하므로 runtime에서는 충돌이 없으나, 두 스펙의 기술 방식(slug vs UUID)이 명시적으로 모순된다.
  - `spec/4-nodes/1-logic/0-common.md §7`이 implementation의 실제 동작과 직접 모순된다: spec은 UUID v4 할당을 말하지만 코드는 slug 기반이다.
- **제안**:
  - `spec/4-nodes/1-logic/0-common.md §7`과 `spec/3-workflow-editor/1-node-common.md §ID 생성` 항목을 `spec/4-nodes/0-overview.md §1.3`의 slug 방식으로 통일 수정. 즉, "UUID v4"를 "stable slug id (`^[a-zA-Z0-9_-]{1,64}$`)"로 교체.
  - `spec/4-nodes/3-ai/_product-overview.md ND-AG-20`도 동일하게 갱신.
  - Presentation ButtonDef의 UUID v4 자동 생성은 별개 맥락(버튼 id가 UUID 형식으로 자동 생성되고 해당 값이 포트 ID로 쓰임)이므로 명확히 구분해 기술.

---

### [WARNING] `spec/4-nodes/0-overview.md §1.0` 부트스트랩 기술이 DI 방식 구현과 미싱크

- **target 위치**: `spec/4-nodes/0-overview.md §1.0` ("서버 부팅 시 ... `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)`을 호출하고") 및 §4 미구현 섹션 ("현재 노드는 전부 빌트인이며 `nodes/index.ts`의 `ALL_NODE_COMPONENTS` 정적 배열로 부팅 시 부트스트랩된다")
- **충돌 대상**: 구현 `codebase/backend/src/nodes/node-components.module.ts`, `codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts`, `codebase/backend/src/nodes/core/node-component.interface.ts`
- **상세**:
  - `spec/4-nodes/0-overview.md §1.0`의 부트스트랩 설명은 "NodeBootstrapService가 `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)`을 호출한다"고 기술한다. 이는 정적 직접 호출 방식을 암시한다.
  - 실제 구현(M-5 레이어1)은 `NodeComponentsModule`이 `NODE_COMPONENT` DI 토큰으로 `ALL_NODE_COMPONENTS`를 바인딩하고, `NodeBootstrapService`가 `@Inject(NODE_COMPONENT)` 로 주입받아 `componentRegistry.bootstrap(this.sortComponents(this.components), ...)` 를 호출한다. 또한 `(NODE_CATEGORIES.order, metadata.type)` 결정적 정렬이 포함된다.
  - §4의 "현재 노드는 전부 빌트인이며 `nodes/index.ts`의 `ALL_NODE_COMPONENTS` 정적 배열로 부팅 시 부트스트랩된다"는 기술도 DI 주입 방식을 설명하지 않아 구현과 미싱크다. spec의 §4.3 실행 인터페이스 설명에는 "(노드 카탈로그를 정적 `import`가 아닌 `NODE_COMPONENT` DI 토큰으로 주입받는 것은 ... 구현 재량 영역)"라는 주석이 있어 DI 전환을 인지하지만, §1.0의 메인 설명은 갱신되지 않았다.
  - 또한 `spec/4-nodes/0-overview.md §1.0`의 폴더 트리에 `node-components.module.ts`가 누락되어 있다.
  - 이 상태는 spec과 구현 간 설명 불일치를 유발해 향후 개발자가 오해할 수 있다. CRITICAL은 아니지만 (실제 모순보다는 설명 누락) 동기화가 필요하다.
- **제안**:
  - `spec/4-nodes/0-overview.md §1.0`의 부트스트랩 설명을 DI 방식으로 갱신: "`NodeBootstrapService.onModuleInit`이 `@Inject(NODE_COMPONENT)` DI 토큰으로 주입받은 빌트인 노드 카탈로그를 `(카테고리 order, type)` 결정적 정렬 후 `NodeComponentRegistry.bootstrap`에 전달한다."
  - 폴더 트리에 `node-components.module.ts`(NODE_COMPONENT DI 토큰 바인딩 진입점) 추가.
  - §4의 "정적 배열로 부트스트랩" 기술도 DI 방식 설명으로 갱신.

---

### [INFO] `spec/4-nodes/0-overview.md §1.0` 폴더 트리에 `node-components.module.ts` 누락

- **target 위치**: `spec/4-nodes/0-overview.md §1.0` 폴더 트리 (`codebase/backend/src/nodes/` 디렉토리 목록 끝부분)
- **충돌 대상**: 실제 파일 시스템 (`codebase/backend/src/nodes/node-components.module.ts` 존재)
- **상세**: 폴더 트리 하단에 `node-components.module.ts`가 누락되어 있다. 현재 트리는 `node-bootstrap.service.ts`의 책임(부팅 등록 진입)을 설명하지만 `NodeComponentsModule`이 DI 토큰 바인딩을 담당한다는 사실이 트리에 반영되지 않는다.
- **제안**: `spec/4-nodes/0-overview.md §1.0` 폴더 트리에 `node-components.module.ts # NODE_COMPONENT DI 토큰 바인딩 진입점 (부팅 등록 진입)` 항목 추가. [WARNING] 항목과 함께 처리하면 효율적.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` ButtonDef.id UUID v4와 전역 slug 정책의 관계 미명시

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §1 (ButtonDef)` 및 §10.5 step 3
- **충돌 대상**: `spec/4-nodes/0-overview.md §1.3` (slug 규칙, "UUID v4는 사용하지 않는다")
- **상세**: Presentation 노드의 ButtonDef.id는 UUID v4로 자동 생성되어 포트 ID로 쓰인다고 명시한다. `spec/4-nodes/0-overview.md §1.3`의 "UUID v4는 사용하지 않는다" 문구와 형식적으로 충돌처럼 읽힌다. 실질적으로는 UUID v4가 `^[a-zA-Z0-9_-]{1,64}$` slug 정규식을 통과하므로 runtime 충돌은 없으나, spec 독자가 두 문서를 같이 읽으면 혼란스럽다.
- **제안**: `spec/4-nodes/0-overview.md §1.3`에 "Presentation 버튼의 경우 button.id가 UUID v4 형식으로 자동 생성되며, 이는 slug regex를 통과하므로 포트 ID로 사용 가능"이라는 예외 주석 추가. 또는 `spec/4-nodes/6-presentation/0-common.md §1`에 "이 UUID v4가 slug regex `^[a-zA-Z0-9_-]{1,64}$`를 통과하므로 전역 포트 ID 정책과 호환된다"는 주석 추가.

---

## 요약

`spec/4-nodes` 영역에서 가장 심각한 교차 충돌은 **동적 포트 ID 생성 방식**이다. `spec/4-nodes/0-overview.md §1.3`은 slug 방식을 SSOT로 선언하고 "UUID v4는 사용하지 않는다"고 명시하며 구현도 이를 따르는 반면, `spec/4-nodes/1-logic/0-common.md §7`, `spec/3-workflow-editor/1-node-common.md`, `spec/4-nodes/3-ai/_product-overview.md ND-AG-20`은 여전히 UUID v4 방식을 기술한다. 이 문서들은 업데이트되지 않은 구 spec이며 즉시 갱신이 필요하다. 부트스트랩 경로 기술(§1.0의 정적 배열 방식 vs 실제 DI 방식)은 설명 미싱크로 CRITICAL은 아니지만 후속 개발자 혼란을 예방하기 위해 동기화를 권장한다. Presentation ButtonDef UUID v4와 전역 slug 정책의 관계는 명시적 clarification이 있으면 충분하다.

---

## 위험도

**HIGH**

(동적 포트 ID CRITICAL 충돌 — spec/4-nodes/1-logic/0-common.md §7이 구현 및 spec/4-nodes/0-overview.md §1.3과 직접 모순되어, 이를 기준으로 개발하면 포트 엣지 연결이 깨지는 버그가 발생할 수 있다.)
