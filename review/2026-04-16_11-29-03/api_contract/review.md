## 발견사항

### **[CRITICAL]** `category` 필드 타입 변경: `''` → `null`
- **위치**: `text-classifier.handler.ts` - `processSingleLabelResult()`
- **상세**: 매칭 실패 시 반환값이 `category: ""` (빈 문자열)에서 `category: null`로 변경됨. 기존 클라이언트가 `if (data.category)` 또는 빈 문자열 비교로 분기하는 경우 동작이 달라짐. 이는 명시적 breaking change임
- **제안**: 변경 사유를 API changelog에 명시하고, 클라이언트 코드에서 `!= null` 혹은 명시적 `=== null` 체크를 사용하도록 마이그레이션 가이드 제공

---

### **[WARNING]** `NodeHandlerOutput.port` 타입 확장: `string` → `string | string[]`
- **위치**: `node-handler.interface.ts:70`, `handler-output.adapter.ts:35,53`
- **상세**: 핸들러 인터페이스의 `port` 필드 타입이 확장됨. 내부 엔진(`isPortFiltered`)과 어댑터는 대응되었으나, `structuredOutputCache`를 통해 `port`를 읽는 하위 소비자(`$node[X].port` expression 접근 등)가 배열을 기대하지 않고 문자열로 처리한다면 런타임 오류 가능
- **제안**: `expressionResolver`나 WebSocket emit 경로에서 `port`를 문자열로 직렬화하는 코드가 있는지 전수 검토 필요

---

### **[WARNING]** 에러 응답 형식 변경
- **위치**: `text-classifier.handler.ts` - `execute()` catch 블록
- **상세**: 이전 에러 반환 구조:
  ```json
  { "port": "error", "data": { "config": {...}, "output": {...}, "meta": {} } }
  ```
  변경 후:
  ```json
  { "config": {...}, "output": { "error": "...", "originalInput": "..." }, "meta": {}, "port": "error" }
  ```
  레거시 `isLegacyPortSelector` shape(`port` + `data`)에서 신규 `isNewShape`(`config` + `output`)으로 변경됨. `adaptHandlerReturn`이 두 형식을 모두 처리하지만, 프론트엔드에서 에러 포트의 `data.output.error` vs `output.error` 접근 경로가 달라짐
- **제안**: 에러 포트 출력 구조에 대한 클라이언트 소비 코드 확인 및 통합 테스트 추가

---

### **[WARNING]** `config` 출력 필드 비일관성
- **위치**: `text-classifier.handler.ts` - `processSingleLabelResult()` vs `processMultiLabelResult()`
- **상세**: Single-label은 `config: { categories, inputField }`, Multi-label은 `config: { categories, inputField, multiLabel: true }`를 반환. `multiLabel: false`인 single-label에서는 `multiLabel` 필드가 누락되어 `$node["X"].config.multiLabel` 접근 시 `undefined` 반환
- **제안**: 두 경로 모두 `config: { categories, inputField, multiLabel }` 형식으로 통일

---

### **[INFO]** Multi-label 모드에서 `meta` 필드 누락 테스트
- **위치**: `text-classifier.handler.spec.ts` - `execute (multi-label)` describe 블록
- **상세**: Single-label 테스트에는 `meta.model`, `meta.inputTokens` 등을 검증하는 케이스가 있으나, multi-label 테스트에는 `meta` 검증이 없음. `processMultiLabelResult()`가 `meta`를 반환하지만 계약상 검증되지 않음
- **제안**: multi-label `meta` 필드 검증 테스트 추가

---

### **[INFO]** 스키마(`textClassifierNodeConfigSchema`)와 핸들러 기본값 불일치
- **위치**: `text-classifier.schema.ts:59`, `text-classifier.handler.ts:51`
- **상세**: 스키마의 `includeConfidence` 기본값은 `false`이나, 핸들러는 `config.includeConfidence ?? true`로 처리. 프론트엔드가 스키마 기본값을 적용하지 않은 채로 요청을 보낼 경우 핸들러가 `true`로 override함
- **제안**: 스키마와 핸들러의 기본값을 동일하게 통일 (핸들러도 `?? false` 또는 스키마를 `true`로 변경)

---

## 요약

이번 변경은 Text Classifier 노드에 Multi-label 분류 모드를 추가하고 `__none__` 센티널을 도입하는 기능 확장이다. API 계약 관점에서 가장 중요한 이슈는 single-label 실패 시 `category` 값이 `""` → `null`로 변경되는 breaking change로, 기존 클라이언트의 falsy 체크 로직을 깨뜨릴 수 있다. 또한 `NodeHandlerOutput.port` 타입이 `string | string[]`으로 확장됨에 따라 expression resolver 등 내부 소비자에 대한 영향 범위 검토가 필요하며, 에러 응답 형식 변경도 클라이언트 호환성 확인이 요구된다. `config` 출력 필드 비일관성과 스키마/핸들러 간 기본값 불일치는 이후 혼선을 유발할 수 있어 정비가 권장된다.

## 위험도

**MEDIUM**