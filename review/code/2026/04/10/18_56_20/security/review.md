## 보안 코드 리뷰 결과

### 발견사항

---

**[INFO]** Merge 노드 아키텍처 변경 — 입력 포트 단일화
- 위치: `index.ts` L42, `logic-configs.tsx` MergeConfig, `1-logic-nodes.md` §11
- 상세: `in_0`, `in_1`, ... 동적 포트 방식에서 단일 `in` 포트 + 다중 엣지 수신 방식으로 변경. 보안 관점에서 공격 표면의 범위가 축소되는 긍정적 변경. 동적 포트 수 (`inputCount`) 조작을 통한 DoS 가능성(과도한 포트 생성)이 제거됨.

---

**[WARNING]** `merge_object` 전략의 Prototype Pollution 위험
- 위치: `merge.handler.spec.ts` — `outputFormat: merge_object` 테스트 케이스
- 상세: `{ ...input0, ...input1 }` shallow merge 구현 시, 악의적 입력(`{ "__proto__": { "isAdmin": true } }`)을 통해 Prototype Pollution이 발생할 수 있음. 스펙 문서의 `merge_object` 형식은 이에 대한 방어 요구사항을 명시하지 않음.
- 제안: 실제 핸들러 구현에서 `Object.assign(Object.create(null), ...)` 또는 `JSON.parse(JSON.stringify(...))` 방식을 사용하고, `__proto__`, `constructor`, `prototype` 키를 병합에서 명시적으로 차단하는 필터를 추가할 것. 테스트 케이스에도 Prototype Pollution 방어 케이스 추가 필요.

```typescript
// 취약한 패턴 (추정)
const merged = Object.assign({}, ...inputs);

// 권장 패턴
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const merged = inputs.reduce((acc, item) => {
  if (item && typeof item === 'object') {
    for (const [k, v] of Object.entries(item)) {
      if (!BLOCKED_KEYS.has(k)) acc[k] = v;
    }
  }
  return acc;
}, Object.create(null));
```

---

**[WARNING]** 입력 정규화 시 임의 객체 키 신뢰
- 위치: `merge.handler.spec.ts` L67 — "should handle object input keyed by source node IDs"
- 상세: 핸들러가 입력 객체의 키를 소스 노드 ID로 신뢰하여 값을 추출하는 구조. 외부 입력이 이 객체를 오염시킬 경우, 정렬 순서 예측(`a_node` < `z_node`)을 이용해 `first` 전략에서 의도하지 않은 데이터를 우선 통과시키는 조작이 가능. 워크플로우 엔진이 이 입력 구조를 내부적으로만 생성하는 경우 실질적 위협은 낮으나, 검증 로직 부재가 우려됨.
- 제안: 입력 객체의 키가 유효한 노드 ID 형식(UUID 등)인지 검증하는 로직을 핸들러 또는 실행 엔진 레이어에서 추가.

---

**[INFO]** `timeout` 설정 서버사이드 강제 적용 여부 확인 필요
- 위치: `1-logic-nodes.md` §11 — timeout 필드, `logic-configs.tsx` MergeConfig `NumberField` (min: 1)
- 상세: UI에서 `min={1}` 제약은 클라이언트 측 검증으로, 서버에서 별도로 검증하지 않으면 timeout=0 또는 음수 설정으로 대기 무한 루프 또는 즉시 종료를 강제할 수 있음. 현재 `validate()` 테스트에 timeout 범위 검증이 없음.
- 제안: `merge.handler.spec.ts`의 `validate` describe 블록에 `timeout <= 0` 에러 케이스 및 최대값 초과 케이스 추가. 서버 핸들러의 `validate()`에서 `timeout` 범위를 강제 검증.

---

**[INFO]** 테스트 코드 — `partialOnTimeout` 필드 누락
- 위치: `merge.handler.spec.ts` 전체, `1-logic-nodes.md` §11 config 테이블
- 상세: 스펙에 `partialOnTimeout` 필드가 정의되어 있으나 테스트 케이스가 전혀 없음. 이 플래그가 `false`일 때 에러 처리 경로가 검증되지 않은 상태로 남아 있어, 에러 메시지에 내부 실행 컨텍스트 정보가 노출될 가능성 확인 불가.
- 제안: `partialOnTimeout: true/false` 각각의 케이스 및 에러 객체 구조 검증 테스트 추가.

---

### 요약

이번 변경은 Merge 노드를 동적 다중 포트 구조에서 단일 포트 + 다중 엣지 수신 구조로 단순화한 아키텍처 개선으로, 동적 포트 수 조작을 통한 DoS 가능성이 제거되는 보안적 이점이 있다. 그러나 `merge_object` 전략 구현 시 Prototype Pollution에 대한 방어가 스펙 및 테스트에 명시되지 않은 점이 가장 주요한 위험이며, 이는 실제 구현 코드(`merge.handler.ts`)에서 반드시 방어해야 한다. 입력 객체 키 신뢰 및 `timeout` 서버사이드 검증 누락도 보완이 필요하다. 하드코딩된 시크릿, 인증 우회, 경로 탐색 등의 취약점은 이번 변경 범위 내에서 발견되지 않았다.

---

### 위험도

**LOW** (단, `merge_object` Prototype Pollution 방어 미구현 시 **MEDIUM** 상향)