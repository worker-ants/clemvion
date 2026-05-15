### 발견사항

---

**[CRITICAL] `enrichInfoExtractorOutputSchema` 테스트 누락**
- 위치: `use-expression-context.ts:54–100`, `use-expression-context.test.ts`
- 상세: 6개 이상의 분기를 가진 복잡한 순수 함수(`baseSchema === undefined`, 빈 fields 배열, `name` 없는 field, `output.properties` 없는 schema, 기존 `extracted` 키 병합 등)에 대해 직접 단위 테스트가 전혀 없음. 오직 간접적으로(availableNodes 통해) 검증됨.
- 제안: `enrichInfoExtractorOutputSchema`를 직접 테스트하거나, 각 분기 경로를 커버하는 케이스를 `use-expression-context.test.ts`에 추가

---

**[CRITICAL] `getSchemaKeys` / `resolveSchemaNode` 직접 단위 테스트 없음**
- 위치: `resolve-nested-path.ts:142–220`
- 상세: `resolve-nested-path.ts`에 추가된 `getSchemaKeys`, `resolveSchemaNode`, `schemaTypeLabel` 모두 직접 테스트 파일에서 검증되지 않음. 특히 배열 index 세그먼트 경로(`items`를 통한 탐색), MAX_DEPTH 초과, `type`이 배열인 경우(`["string", "null"]`), `items.properties`를 통한 하강 등이 미검증
- 제안: `resolve-nested-path.test.ts`에 `getSchemaKeys` 전용 describe 블록 추가

---

**[WARNING] `$node["X"].meta.<path>` 폴스루 동작 미검증**
- 위치: `use-expression-suggestions.ts:150–178`, `use-expression-suggestions.test.ts`
- 상세: `nodeAccessorDrillMatch` 정규식은 `(output|config)`만 처리. `$node["X"].meta.something` 입력 시 `nodeAccessorDrillMatch`를 빠져나와 `nodeAccessorMatch`(`$node["X"].meta`)도 일치하지 않아 루트 변수 제안으로 폴스루됨. 의도한 동작인지 불분명하며 테스트가 없음
- 제안: `meta` accessor drill-down의 미지원이 의도라면 명시적 테스트로 문서화; 지원 필요하다면 정규식과 테스트 추가

---

**[WARNING] `dropStaleEdges`에서 null/undefined handle 케이스 미검증**
- 위치: `edge-utils.ts:131–140`, `edge-utils.test.ts`
- 상세: 노드 정의가 있을 때 `edge.sourceHandle === null` 또는 `edge.targetHandle === null`인 케이스 미테스트. 현 로직은 `if (sourceOutputs.size > 0 && edge.sourceHandle)` 조건으로 null handle을 통과시키지만, 실제 React Flow에서 handle이 없는 엣지가 유효한지 검증 안 됨
- 제안: `sourceHandle: null`이고 정의가 있는 노드 케이스의 명시적 테스트 추가

---

**[WARNING] `dropStaleEdges` 테스트의 중첩 `beforeAll`로 인한 상태 의존성**
- 위치: `edge-utils.test.ts:234–264`
- 상세: 외부 `beforeAll`이 전역 store를 설정하고, `dropStaleEdges` describe 블록 내 `beforeAll`이 이를 spread+확장. 테스트 실행 순서나 describe 블록 재배치 시 상태 불일치 위험. `ai_agent`/`template` 정의가 외부 `beforeAll`의 데이터에 의존
- 제안: `dropStaleEdges` 테스트 그룹 내에서 완전한 독립 store 상태 설정; 또는 `beforeEach`로 격리

---

**[WARNING] 이스케이프된 따옴표(`\"`) 포함 노드 키의 토큰 파싱 미검증**
- 위치: `use-expression-suggestions.ts:53–100`
- 상세: `getExpressionToken`의 역방향 스캔 시 이스케이프 처리(`between[k - 1] !== "\\"`)를 구현했으나, `$node["Node \"Quoted\""]` 같은 케이스에 대한 테스트 없음. 또한 `k === 0`일 때 `between[k - 1]`는 `undefined`로 `!== "\\"` 조건이 참이 되는 엣지케이스 미처리
- 제안: 이스케이프된 따옴표 포함 키 케이스 테스트 추가, 인덱스 0 경계값 처리 확인

---

**[WARNING] 백엔드 Zod 출력 스키마 테스트 없음**
- 위치: `ai-agent.schema.ts`, `information-extractor.schema.ts`, `text-classifier.schema.ts`
- 상세: `aiAgentNodeOutputSchema`, `informationExtractorNodeOutputSchema`, `textClassifierNodeOutputSchema` 모두 `z.safeParse()` 단위 테스트 없음. 핸들러 실제 출력 데이터와의 정합성 검증 불가
- 제안: 각 핸들러의 실제 출력 픽스처로 스키마 `safeParse` 성공/실패 케이스 추가

---

**[INFO] `WorkflowEditorLoader`의 `dropStaleEdges` 통합 미검증**
- 위치: `editor-loader.tsx:52–76`
- 상세: stale edge 제거 후 `console.warn` 발생, 길이 비교 로직, `enrichEdgesWithPortData` 체이닝이 컴포넌트 레벨에서 테스트되지 않음
- 제안: stale edge가 제거되는 시나리오 포함 `editor-loader` 통합 테스트 또는 로직 유틸 함수로 추출

---

**[INFO] 스키마-샘플 유니온의 "sample wins" 동작 검증 범위**
- 위치: `use-expression-suggestions.test.ts` ("unions runtime sample with schema fields")
- 상세: `type` 필드가 샘플과 스키마 모두에 있을 때 샘플 타입이 우선함을 검증하는 테스트가 있으나, 객체/배열 타입 필드에서 `isExpandable` 플래그가 올바르게 병합되는지 미검증

---

### 요약

전반적으로 프론트엔드 핵심 로직(`dropStaleEdges`, `useExpressionContext` 스키마 첨부, `useExpressionSuggestions` 새 패턴)에 대한 테스트가 잘 추가되어 있으나, 두 가지 CRITICAL 갭이 존재한다: `enrichInfoExtractorOutputSchema`(다분기 순수 함수)와 `getSchemaKeys`/`resolveSchemaNode`(새 스키마 탐색 유틸)가 직접 단위 테스트 없이 간접 경로로만 검증된다. 또한 `$node["X"].meta.<path>` 폴스루 동작과 handle null 케이스, 백엔드 Zod 스키마 검증이 미비하다.

### 위험도
**MEDIUM**