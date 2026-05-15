## 테스트 코드 리뷰

### 발견사항

---

**[INFO]** Merge 노드 설계 변경에 따른 테스트 반영 적절성
- 위치: `merge.handler.spec.ts` 전체
- 상세: `inputCount` 제거 및 단일 `in` 포트(다중 엣지 수신)로의 설계 변경이 테스트에 반영되어 있음. input normalization 섹션에서 object/array/single value 등 다양한 입력 형태를 처리하는 테스트가 존재하며, 이는 다중 엣지 수신 패턴에 적합한 접근임.
- 제안: 해당 없음 (적절히 반영됨)

---

**[WARNING]** `timeout` 설정에 대한 테스트 누락
- 위치: `merge.handler.spec.ts` - `validate` describe 블록
- 상세: 스펙에는 `timeout` 필드(기본값 300, 초 단위)와 `partialOnTimeout` 필드가 정의되어 있음. `MergeConfig` UI에도 timeout NumberField가 존재하지만, `validate` 테스트에서 timeout 유효성 검사 케이스가 없음. timeout이 음수이거나 0인 경우 등의 검증 누락 여부 확인 필요.
- 제안:
  ```ts
  it('should return invalid for non-positive timeout', () => {
    const result = handler.validate({ strategy: 'wait_all', outputFormat: 'array', timeout: 0 });
    expect(result.valid).toBe(false);
  });
  ```

---

**[WARNING]** `strategy: first` 테스트에서 outputFormat 조합 미검증
- 위치: `merge.handler.spec.ts:112-118` - `strategy: first` describe
- 상세: `first` 전략 테스트가 `outputFormat: 'array'`만 다루고 있음. `first` 전략에서 `merge_object`, `indexed` 포맷을 사용할 때의 동작이 테스트되지 않음. 첫 번째 입력 하나만 남긴 상태에서 merge_object나 indexed 포맷으로 변환 시 결과가 직관적이지 않을 수 있음.
- 제안:
  ```ts
  it('should return first input as merge_object', async () => {
    const input = { a_node: { x: 1 }, b_node: { y: 2 } };
    const config = { strategy: 'first', outputFormat: 'merge_object' };
    const result = await handler.execute(input, config, context);
    expect(result).toEqual({ x: 1 });
  });
  ```

---

**[WARNING]** `partialOnTimeout` 동작에 대한 테스트 완전 누락
- 위치: `merge.handler.spec.ts` - execute describe 블록
- 상세: 스펙의 `partialOnTimeout` 필드(`true` 시 도착한 입력만으로 병합, `false` 시 `MERGE_TIMEOUT` 에러)에 대한 테스트가 전혀 없음. 이 필드는 스펙에 명시된 중요 동작임.
- 제안: timeout/partialOnTimeout 동작을 테스트하는 별도 describe 블록 추가 필요. 단, 실제 구현이 timeout을 지원하는 경우에 한함.

---

**[INFO]** `MergeConfig` 프론트엔드 컴포넌트 테스트 미존재
- 위치: `logic-configs.tsx` - `MergeConfig` 컴포넌트
- 상세: `inputCount` NumberField 제거 후 Strategy, Output Format, Timeout 필드만 남은 상태. 프론트엔드 컴포넌트 테스트(예: React Testing Library 기반)가 확인되지 않음. 변경 전후 렌더링 회귀를 검증할 테스트가 없음.
- 제안: `MergeConfig` 컴포넌트에 대한 렌더링 테스트 추가 검토.

---

**[INFO]** `node-definitions/index.ts` 변경에 대한 테스트 미존재
- 위치: `index.ts:39` - merge 노드 정의
- 상세: `inputs` 배열이 `[in_0, in_1]`에서 `[in]`으로 변경됨. 이 정의를 사용하는 함수(`getNodeDefinition`, `getNodesByCategory`)에 대한 단위 테스트가 없음. 노드 정의는 런타임에 널리 참조되는 데이터이므로 스냅샷 또는 구조 검증 테스트가 있으면 회귀 방지에 유리함.
- 제안: `getNodeDefinition('merge')` 결과의 inputs/outputs 구조를 검증하는 테스트 추가 검토.

---

**[INFO]** `strategy: append` 테스트가 `wait_all`과 동일한 결과만 검증
- 위치: `merge.handler.spec.ts:120-126` - `strategy: append`
- 상세: 스펙상 `append`는 "도착 순서대로 배열에 추가, 모든 입력 도착 후 출력"으로 정의됨. 현재 테스트는 `wait_all`과 동일하게만 동작함을 확인하는 수준임. `append` 전략이 도착 순서를 보장하는지, `wait_all`과 의미적으로 어떻게 다른지 구분하는 테스트가 필요할 수 있음.
- 제안: 현재 구현이 두 전략을 동일하게 처리한다면, 그 의도를 주석으로 명시하거나 스펙과의 차이를 문서화할 것.

---

**[INFO]** `sort object keys for deterministic ordering` 테스트의 결정론적 보장 범위
- 위치: `merge.handler.spec.ts:90-95`
- 상세: 키를 정렬하여 결정론적 순서를 보장하는 테스트는 의도가 명확함. 다만 실제 다중 엣지 수신 시나리오에서 엔진이 어떤 키 형식으로 입력을 전달하는지(노드 ID? 타임스탬프?) 스펙과의 연계가 테스트에 나타나지 않아 테스트의 전제가 실제 런타임 동작과 일치하는지 확인이 필요함.
- 제안: 테스트 주석 또는 describe 설명에 "엔진이 `{ [sourceNodeId]: data }` 형태로 전달한다"는 전제를 명시할 것.

---

### 요약

Merge 노드의 설계 변경(고정 다중 포트 → 단일 포트 다중 엣지 수신)에 맞춰 `merge.handler.spec.ts`는 전반적으로 잘 작성되어 있으며, input normalization, 3가지 strategy, 3가지 outputFormat, 엣지 케이스를 고루 커버하고 있음. 다만 스펙에 정의된 `timeout` / `partialOnTimeout` 필드에 대한 validate 및 execute 테스트가 전혀 없고, `strategy: first`와 non-array outputFormat의 조합 케이스도 누락되어 있음. 프론트엔드 MergeConfig 컴포넌트 변경과 node-definitions 변경에 대응하는 프론트엔드 단위 테스트도 부재함. 백엔드 핵심 로직의 테스트 구조 자체는 양호하나, 스펙과의 완전한 정합성 확보를 위해 위 누락 항목 보완이 권장됨.

### 위험도

**LOW**