### 발견사항

---

**[CRITICAL]** `isPortFiltered` 배열 포트 지원 — 테스트 없음
- 위치: `execution-engine.service.ts:2237–2244`
- 상세: Multi-label 라우팅의 핵심 로직(`_selectedPort`가 `string[]`일 때 `Array.isArray` 분기)이 추가되었으나, 이 private 메서드를 간접적으로 검증하는 통합 테스트나 엔진 수준 테스트가 전혀 없음. Multi-label 포트 필터링이 실제로 올바르게 동작하는지 확인할 수 없음.
- 제안: `ExecutionEngineService`의 `isPortFiltered`를 테스트하는 단위 테스트 또는 multi-label 포트가 실제로 여러 다운스트림 노드를 활성화하는지 검증하는 통합 테스트 추가 필요

---

**[CRITICAL]** `handler-output.adapter.ts` `string[]` 포트 지원 — 테스트 없음
- 위치: `handler-output.adapter.ts:35, 55`
- 상세: `adaptHandlerReturn`에서 `Array.isArray(port)` 분기가 추가되었고, `toEngineFlatShape`도 `port`가 배열일 때의 처리를 포함하지만, 이 어댑터에 대한 spec 파일이 diff에 포함되지 않음. 어댑터는 엔진 전체의 핵심 인프라로, 배열 포트 처리 로직 검증이 누락됨.
- 제안: `adaptHandlerReturn({ port: ['class_0', 'class_1'], data: {...} })`와 `adaptHandlerReturn({ config: {}, output: {}, port: ['class_0'] })` 케이스 테스트 추가

---

**[WARNING]** 기본 신뢰도 검증 어설션 제거
- 위치: `text-classifier.handler.spec.ts`, "should classify and route to correct port (first category)" 테스트
- 상세: 기존 `expect(data.confidence).toBe(0.95)` 어설션이 제거됨. 핸들러의 `includeConfidence` 기본값은 `true`이므로 `baseConfig`로 실행 시 confidence가 출력에 포함되어야 하는데, 이 검증이 사라져 해당 경로의 회귀 탐지 능력이 저하됨.
- 제안: 기본 케이스 테스트에 `expect(data.confidence).toBe(0.95)` 어설션 복원

---

**[WARNING]** `context` 객체 테스트 간 공유로 인한 격리 위험
- 위치: `text-classifier.handler.spec.ts:28–34`
- 상세: `context` 객체(특히 `nodeOutputCache: {}`)가 `const`로 모듈 스코프에 선언되어 모든 테스트가 동일 참조를 공유함. 현재 `TextClassifierHandler`가 `context`를 뮤테이션하지 않으므로 즉각적인 문제는 없으나, 향후 핸들러가 `nodeOutputCache`를 사용하게 될 경우 테스트 오염 가능성이 있음.
- 제안: `beforeEach`에서 `context`를 새로 생성하거나 `Object.freeze`로 불변성 보장

---

**[WARNING]** Multi-label JSON 파싱 실패 fallback — 순서 의존성
- 위치: `text-classifier.handler.spec.ts`, "should extract categories from text on JSON parse failure" (multi-label)
- 상세: 테스트에서 LLM이 `'The text relates to Billing and Tech categories'`를 반환할 때 `['class_0', 'class_1']`을 기대함. 이는 `categories` 배열 순서대로 텍스트 서브스트링 매칭하는 구현에 의존하며, 카테고리 이름이 텍스트 안의 다른 단어에 포함될 경우(예: "Billing" → "BillingAddress") 오탐 가능성이 있음.
- 제안: 오탐 케이스 테스트 추가 또는 정확한 단어 경계(word boundary) 매칭 로직으로 개선

---

**[WARNING]** Multi-label 기본 confidence 포함 케이스 미검증
- 위치: `text-classifier.handler.spec.ts`, `execute (multi-label)` describe 블록
- 상세: multi-label에서 `includeConfidence: false` 케이스는 테스트되지만, `includeConfidence`가 기본값(`true`)일 때 `confidence` 필드가 각 카테고리 항목에 올바르게 포함되는지 명시적으로 검증하는 테스트가 없음(첫 번째 multi-label 테스트가 간접적으로 확인하긴 함).
- 제안: `includeConfidence: true` 명시 설정으로 confidence 존재 여부를 검증하는 테스트 추가

---

**[INFO]** Frontend `TextClassifierConfig` — 테스트 없음
- 위치: `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx:249–252`
- 상세: `MultiLabel` 체크박스 추가에 대한 프론트엔드 컴포넌트 테스트가 없음.
- 제안: `multiLabel` prop 변경 시 `onChange` 콜백 호출 여부 검증하는 컴포넌트 테스트 추가

---

**[INFO]** `__none__` 중복 카테고리 이름 검증 누락
- 위치: `text-classifier.handler.spec.ts`, `validate` describe 블록
- 상세: 여러 카테고리가 동일한 이름을 가질 때의 검증(중복 이름)에 대한 테스트가 없음.
- 제안: `{ name: 'Billing' }, { name: 'Billing' }` 같은 중복 카테고리 이름에 대한 `validate` 테스트 추가 (현재 스펙에서 중복 허용 여부가 불명확)

---

### 요약

텍스트 분류기의 Multi-label 모드 및 `__none__` 센티널 도입에 대한 핸들러 수준 테스트는 전반적으로 충실하게 작성되었습니다. 그러나 두 가지 치명적인 테스트 공백이 존재합니다: 엔진의 `isPortFiltered` 배열 분기와 `handler-output.adapter.ts`의 `string[]` 포트 지원이 완전히 검증되지 않아, multi-label 라우팅이 실제로 다운스트림 노드를 올바르게 활성화하는지 확인할 수 없습니다. 또한 기본 신뢰도 검증 어설션 제거, 공유 `context` 객체의 격리 위험, 텍스트 파싱 fallback의 순서 의존성 등 경미하지만 주의가 필요한 경고 수준의 이슈들도 포함되어 있습니다.

### 위험도

**HIGH**