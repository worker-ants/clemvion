## 부작용(Side Effect) 코드 리뷰 결과

---

### 발견사항

#### 파일 1: `execution-engine.service.ts`

- **[INFO]** `isPortFiltered` 메서드의 `_selectedPort` 타입 처리 확장
  - 위치: `isPortFiltered` 메서드 내 `_selectedPort` 처리 분기
  - 상세: `string` → `string | string[]` 로 처리 범위가 확장됨. 기존 `string` 케이스는 동일하게 처리되므로 하위 호환 유지됨.
  - 제안: 이상 없음. 다만 `selectedPort`가 빈 배열(`[]`)인 경우 `!selectedPort.includes(edgeSourcePort)` 가 항상 `true`를 반환하여 모든 엣지가 필터링됨. 멀티 레이블에서 포트가 없는 경우(`fallback`) 흐름과 일관성 있게 동작하는지 확인 필요.

---

#### 파일 3: `text-classifier.handler.ts`

- **[WARNING]** `execute()` 반환 구조 변경 — 에러 포트 반환 형태 불일치
  - 위치: `catch(error)` 블록 (구버전 `port: 'error'`, 신버전 동일)
  - 상세: 구버전은 `{ port, data: { config, output, meta } }` (레거시 포트셀렉터 형태), 신버전은 `{ config, output, meta, port }` (new shape). `adaptHandlerReturn`의 `isNewShape` 분기가 올바르게 처리하므로 기능상 문제없으나, 기존 동작이 `isLegacyPortSelector` → 신규 동작이 `isNewShape`로 분기 경로가 달라짐.
  - 제안: 현재 `adaptHandlerReturn` 구현 기준으로 정상 동작 확인됨. 이슈 없음.

- **[WARNING]** `processSingleLabelResult`에서 `confidence` 기본값 처리 변경
  - 위치: `category = parsed.category || ''` 라인
  - 상세: `parsed.category`가 `0` 또는 `false` 같은 falsy 값이 아닌 문자열이므로 `||` 연산자 사용은 안전함. 하지만 LLM이 `null`을 반환할 경우 `category`가 `''`가 되어 `isFallback = true`로 처리됨 — 의도된 동작.

- **[INFO]** `processMultiLabelResult`의 텍스트 폴백 파싱 부작용
  - 위치: `processMultiLabelResult` catch 블록
  - 상세: JSON 파싱 실패 시 `result.content`에서 카테고리 이름 문자열을 검색. 카테고리 이름이 짧거나 일반적인 단어(`Tech`, `General`)이면 오탐(false positive) 발생 가능. 예: 에러 메시지 텍스트에 "Tech"가 포함된 경우 분류 오류 발생.
  - 제안: 텍스트 폴백 시 단어 경계(word boundary) 기반 정규식 매칭 사용 권장. 단, 이는 기존 `single-label`에도 동일하게 존재하는 패턴이므로 이번 변경의 신규 부작용은 아님.

---

#### 파일 4: `handler-output.adapter.ts`

- **[INFO]** `port` 필드 타입 확장 (`string` → `string | string[]`)
  - 위치: `adaptHandlerReturn` 내 2개 분기
  - 상세: `Array.isArray(port)` 체크 추가로 배열 포트를 처리. `toEngineFlatShape`의 `base.port = adapted.port` 할당도 이미 `port?: string | string[]` 타입이므로 정상 전파됨.
  - 제안: `toEngineFlatShape` 함수가 `base.port`를 배열로 설정하는 경우, 엔진의 `isPortFiltered` 외에 다른 포트 처리 로직(예: WebSocket 이벤트 전송, 실행 경로 기록)이 배열 포트를 올바르게 처리하는지 확인 필요.

---

#### 파일 5: `node-handler.interface.ts`

- **[WARNING]** `NodeHandlerOutput.port` 타입 확장 — 기존 소비자 영향
  - 위치: `port?: string | string[]`
  - 상세: 인터페이스 변경으로 `port`를 `string`으로 가정한 기존 소비자 코드에서 타입 에러 발생 가능. 엔진 내 `port`를 직접 `string`으로 사용하는 곳(예: `edgeSourcePort !== port` 비교)이 있다면 런타임 버그 유발 가능.
  - 제안: `execution-engine.service.ts`의 `isPortFiltered`가 이를 처리하고 있으나, `structuredOutputCache`를 통해 `port`를 읽는 expression resolver 등 다른 소비자도 확인 필요. `$node["X"].port` 표현식이 배열을 반환하는 경우 다운스트림 동작 검토 필요.

---

#### 파일 6: `text-classifier.schema.ts`

- **[INFO]** `multiLabel` 필드 추가 — 기존 데이터 호환성
  - 위치: `textClassifierNodeConfigSchema` 내 `multiLabel` 필드
  - 상세: `.default(false)` 처리로 기존 저장된 노드 설정에 `multiLabel` 필드가 없어도 `false`로 파싱됨. 하위 호환 유지.
  - 제안: 이상 없음.

---

#### 파일 7: `ai-configs.tsx`

- **[INFO]** `MultiLabel` 체크박스 기본값
  - 위치: `checked={(config.multiLabel as boolean) ?? false}`
  - 상세: `includeConfidence`의 기본값은 `?? true`인데 `multiLabel`은 `?? false`. 스키마 기본값과 일치함. 이상 없음.

---

### 요약

이번 변경은 Text Classifier 노드에 Multi-label 분류 기능과 `__none__` 센티널을 추가하는 것이 핵심이다. `NodeHandlerOutput.port` 타입을 `string | string[]`으로 확장한 것이 가장 주목해야 할 인터페이스 변경으로, `handler-output.adapter.ts`와 `isPortFiltered`는 이를 올바르게 처리하고 있다. 그러나 엔진 내 다른 위치(`structuredOutputCache` 소비자, WebSocket 이벤트 직렬화, 실행 경로 기록 등)에서 `port`를 `string`으로 가정하는 코드가 존재할 경우 런타임 버그가 발생할 수 있다. `processMultiLabelResult`의 텍스트 폴백 파싱은 오탐 가능성이 있으나 이는 기존 패턴과 동일한 수준의 위험이다. 전반적으로 신규 기능 추가는 기존 동작을 침해하지 않도록 설계되었으며, 부작용 위험도는 낮은 수준이다.

### 위험도

**LOW**