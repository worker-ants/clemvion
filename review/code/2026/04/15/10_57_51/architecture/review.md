## 아키텍처 코드 리뷰 결과

### 발견사항

---

**[WARNING] schema와 defaultConfig 간 타입 불일치 (schema/config 계층 일관성 위반)**
- 위치: `loop.schema.ts`, `merge.schema.ts`, `if-else.schema.ts`
- 상세: `loopNodeConfigSchema = z.object({}).passthrough()`이나 `defaultConfig: { count: 1 }`처럼, Zod 스키마에 정의되지 않은 필드가 `defaultConfig`에 포함됨. `merge.schema.ts`도 동일하게 `strategy`, `outputFormat`, `timeout`이 스키마에 없음. `if-else.schema.ts`는 `conditions: []`를 defaultConfig에 두면서 스키마에서 `min(1)`을 요구하여 defaultConfig 자체가 validation을 통과하지 못함.
- 제안: `defaultConfig`는 반드시 해당 configSchema를 통과해야 함. 스키마에 필드를 명시하거나 `defaultConfig`에서 제거할 것. `ifElseConfigSchema`의 `min(1)` 조건은 `defaultConfig: { conditions: [] }`와 충돌하므로 `min(0)`으로 수정하거나, 빈 초기값 허용 여부를 설계 차원에서 결정해야 함.

---

**[WARNING] 빈 스키마에 passthrough() 남용 (추상화 수준 불일치)**
- 위치: `loop.schema.ts`, `map.schema.ts`, `merge.schema.ts`, `split.schema.ts`, `switch.schema.ts`, `variable-declaration.schema.ts`, `variable-modification.schema.ts`, `carousel.schema.ts`, `form.schema.ts`, `pdf.schema.ts`, `table.schema.ts`, `template.schema.ts`
- 상세: 대부분의 노드가 `z.object({}).passthrough()`를 configSchema로 사용. 이는 사실상 런타임 config 검증 없음을 의미하며, 스키마 계층의 존재 의의가 희석됨. 실제로 각 노드가 사용하는 config 필드들이 있을 텐데 (merge의 strategy/timeout 등) 이것들이 스키마에 반영되지 않음.
- 제안: 노드가 실제로 사용하는 config 필드를 스키마에 명시하거나, 아직 미구현이라면 `TODO` 주석으로 명시. 검증을 의도적으로 열어두려면 `z.record(z.unknown())`가 의도를 더 명확히 표현함.

---

**[WARNING] if-else 노드의 component 파일 누락**
- 위치: `if-else/index.ts`에서 `export * from './if-else.component'`를 참조하나 해당 파일이 리뷰 목록에 없음
- 상세: `loop`, `map`, `merge` 등은 모두 `.component.ts`가 제공됐으나 `if-else.component.ts`는 누락. 파일이 없거나 검토 대상에서 빠진 것임.
- 제안: `if-else.component.ts` 파일 존재 여부 확인 및 리뷰 포함.

---

**[INFO] NodeComponent 생성 방식의 일관성 — factory vs. instance**
- 위치: 모든 `*.component.ts`
- 상세: `createHandler: () => new XxxHandler()`는 매 실행마다 새 핸들러를 생성하는 Factory 패턴. 이 자체는 합리적이나, 핸들러가 stateless임을 보장하는 구조적 장치(인터페이스, 문서)가 없음. stateful 핸들러가 실수로 등록되면 동시 실행 시 문제 발생.
- 제안: `NodeHandler` 인터페이스에 stateless 가정을 명시하거나, 핸들러를 싱글턴으로 캐싱하는 전략을 일관되게 결정할 것.

---

**[INFO] switch 노드의 outputs: [] (동적 포트 설계 미반영)**
- 위치: `switch.schema.ts:12`
- 상세: Switch는 케이스 수에 따라 동적으로 출력 포트가 생성되어야 하나 `outputs: []`로 고정. 이 구조가 의도적이라면 (런타임에 동적 생성) `NodePorts` 인터페이스에 동적 포트 지원 여부가 명시되어야 함.
- 제안: `NodeComponentMetadata` 또는 `NodePorts`에 `dynamicOutputs: true` 같은 플래그를 추가하여 의도를 명시. 그렇지 않으면 빈 배열은 "출력 없음"으로 오해될 수 있음.

---

**[INFO] 모든 logic 노드가 동일한 색상 (#3B82F6) 사용**
- 위치: 모든 logic 카테고리 schema
- 상세: 아키텍처 이슈는 아니나, 색상이 카테고리 수준에서 중앙 관리되지 않고 각 파일에 하드코딩되어 있음. 카테고리 테마 변경 시 전파 누락 위험.
- 제안: 카테고리별 색상을 상수(`NODE_CATEGORY_COLORS`)로 중앙화.

---

### 요약

전체적으로 `schema → component → handler`의 3-layer 분리, `NodeComponent` 인터페이스 기반의 Plugin 패턴, 카테고리별 모듈 격리는 확장성 측면에서 잘 설계되어 있습니다. 그러나 **Zod 스키마와 `defaultConfig` 간 계약이 런타임에 검증되지 않는 구조적 허점**이 핵심 문제입니다. 특히 `if-else`의 `conditions: []/min(1)` 충돌, `merge`의 스키마 미정의 필드처럼 실제 실행 시 예기치 않은 동작을 유발할 수 있는 불일치가 다수 존재합니다. 빈 스키마(`z.object({}).passthrough()`)의 남용은 스키마 계층 자체의 가치를 희석시키며, 각 노드의 실제 config 계약이 코드에 드러나지 않아 유지보수성이 저하됩니다.

### 위험도

**MEDIUM**