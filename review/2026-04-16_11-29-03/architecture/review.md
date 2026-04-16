## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING]** `_selectedPort`의 데이터 페이로드 내 메타데이터 혼재 (기존 패턴 확장)
- **위치**: `execution-engine.service.ts` `isPortFiltered()`, `executeInline()` 내 `_selectedPort` 스트리핑 로직
- **상세**: 라우팅 제어 메타데이터(`_selectedPort`)가 핸들러 출력 데이터 객체에 직접 임베드되어 있습니다. 이번 변경으로 `string[]` 타입이 추가되면서 이 구조적 냄새가 더 복잡해졌습니다. 포트 선택 정보는 데이터 페이로드와 분리된 채널(예: `NodeHandlerOutput.port` 필드)로 전달되어야 합니다. `executeInline`에서 `_selectedPort`를 수동으로 스트리핑하는 코드가 필요한 것 자체가 레이어 경계 위반을 나타냅니다.
- **제안**: 장기적으로 `toEngineFlatShape`/`adaptHandlerReturn` 어댑터 쌍이 제거되고 `NodeHandlerOutput.port`가 단일 진실 소스가 되면, `_selectedPort`는 자연스럽게 사라집니다. 현재는 기존 패턴을 그대로 따른 것이므로 이번 PR 범위에서 수정 불필요, 단 추후 Phase 3 정리 시 우선 처리 권장.

---

**[WARNING]** Single/Multi-label 간 `config` 출력 형태 비대칭
- **위치**: `text-classifier.handler.ts:processS ingleLabelResult()` (line ~232), `processMultiLabelResult()` (line ~280)
- **상세**: `processSingleLabelResult`는 `config: { categories, inputField }`를 반환하고, `processMultiLabelResult`는 `config: { categories, inputField, multiLabel: true }`를 반환합니다. 다운스트림에서 `$node["Text Classifier"].config.multiLabel`로 모드를 판별할 때 single-label 결과에는 이 필드가 없어 `undefined`가 됩니다. 일관성 없는 config 형태는 표현식 작성 시 혼란을 유발합니다.
- **제안**:
  ```typescript
  // processSingleLabelResult에서
  return {
    config: { categories, inputField, multiLabel: false }, // 명시적 false
    ...
  };
  ```

---

**[WARNING]** `propagateReachability`의 `string[]` 포트 처리 검증 필요
- **위치**: `execution-engine.service.ts` `propagateReachability()` (diff에 미포함)
- **상세**: `isPortFiltered`는 `string[]` 포트를 올바르게 처리하지만, `propagateReachability`가 `nodeOutputCache`에서 `_selectedPort: string[]`를 읽어 reachability를 전파할 때 동일한 로직을 거치는지 확인이 필요합니다. `isPortFiltered`를 통해 간접적으로 처리된다면 문제없으나, `propagateReachability` 내부에서 `_selectedPort`를 직접 읽는 코드가 있다면 array 처리가 누락될 수 있습니다.
- **제안**: `propagateReachability` 내부에서 `_selectedPort` 를 직접 읽는 경우 `isPortFiltered`와 동일한 `Array.isArray` 분기를 추가해야 합니다.

---

**[INFO]** `TextClassifierHandler` 책임 범위는 적절
- **위치**: `text-classifier.handler.ts` 전체
- **상세**: `buildSingleLabelPrompt`, `buildMultiLabelPrompt`, `processSingleLabelResult`, `processMultiLabelResult`로 분리한 것은 SRP 관점에서 양호합니다. `execute`는 오케스트레이션만 담당하고, 실제 프롬프트 구성과 결과 파싱이 private 메서드로 위임됩니다. 클래스 크기 대비 응집도가 높습니다.

---

**[INFO]** `NONE_SENTINEL` 정적 상수화는 올바른 설계
- **위치**: `text-classifier.handler.ts:16`
- **상세**: `static readonly NONE_SENTINEL = '__none__'`으로 매직 스트링을 제거하고, `validate()`에서 예약어 검증, 프롬프트 주입, schema enum 확장까지 단일 상수로 통제합니다. OCP 관점에서 센티널 값 변경 시 단일 지점 수정으로 전파됩니다.

---

**[INFO]** `NodeHandlerOutput.port: string | string[]` 타입 확장은 하위 호환
- **위치**: `node-handler.interface.ts`, `handler-output.adapter.ts`
- **상세**: 기존 `string` 타입을 유지한 채 `string[]`를 추가하고, `adaptHandlerReturn`의 두 경로(legacy port selector, legacy bare object) 모두에서 `Array.isArray` 분기를 추가했습니다. 변경이 일관성 있게 적용되었습니다.

---

### 요약

이번 변경은 Text Classifier 노드에 Multi-label 분류 모드를 추가하는 기능 확장으로, 아키텍처적으로 전반적으로 건전합니다. `NodeHandlerOutput.port`를 `string | string[]`로 확장하고 엔진의 포트 필터링 로직을 일관되게 수정한 접근은 OCP를 적절히 준수합니다. 주요 개선 포인트는 두 가지입니다: single/multi-label 간 `config` 출력의 `multiLabel` 필드 비대칭(실제 사용성에 영향), 그리고 `propagateReachability`에서 `string[]` 포트 처리 여부 검증(잠재적 라우팅 버그). `_selectedPort`가 데이터 페이로드에 혼재하는 구조적 문제는 기존 기술 부채이며 이번 PR에서 악화되지는 않았으나, Phase 3 어댑터 정리 시 함께 해소되어야 합니다.

### 위험도

**LOW** — 핵심 라우팅 로직(`isPortFiltered`)은 올바르게 수정되었으며, `propagateReachability` 검증과 config 비대칭 수정은 선제적 조치 수준입니다.