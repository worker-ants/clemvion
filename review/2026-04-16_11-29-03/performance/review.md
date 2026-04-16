## 성능 코드 리뷰 — Text Classifier Multi-label 기능

---

### 발견사항

- **[INFO]** `processMultiLabelResult`의 이중 선형 탐색
  - 위치: `text-classifier.handler.ts` — `processMultiLabelResult`
  - 상세: `filter` 단계에서 `categories.some(cat => cat.name === c.name)`으로 O(n) 탐색을 수행한 후, `matchedPorts` 산출 단계에서 `categories.findIndex(c => c.name === mc.name)`으로 동일한 탐색을 다시 수행함. 결과적으로 각 매칭 카테고리당 O(2n)의 탐색이 발생. 카테고리 수가 일반적으로 20개 미만이므로 실질적 영향은 없으나, 단일 패스로 개선 가능.
  - 제안:
    ```typescript
    const categoryIndexMap = new Map(categories.map((c, i) => [c.name, i]));
    const matchedEntries = rawCategories
      .map((c) => ({ raw: c, idx: c.name ? categoryIndexMap.get(c.name) : undefined }))
      .filter((e): e is { raw: typeof e.raw; idx: number } => e.idx !== undefined);
    matchedCategories = matchedEntries.map(({ raw }) => ({ name: raw.name!, ... }));
    const matchedPorts = matchedEntries.map(({ idx }) => `class_${idx}`);
    ```

- **[INFO]** `processMultiLabelResult`의 연쇄 중간 배열 생성
  - 위치: `text-classifier.handler.ts` — `matchedPorts` 산출 구간
  - 상세: `.map()` → `.filter()` → `.map()` 3단계 체이닝으로 매 실행마다 3개의 중간 배열 할당. 카테고리 수가 소규모이므로 GC 부담은 미미하지만, 위의 `Map` 개선안을 적용하면 자연스럽게 해소됨.
  - 제안: 위 단일 패스 개선과 함께 처리.

- **[INFO]** `buildSingleLabelPrompt` 호출 시마다 새 배열 할당
  - 위치: `text-classifier.handler.ts:134` — `const schemaEnum = [...categoryNames, NONE]`
  - 상세: LLM 호출마다 `categoryNames` 스프레드 + NONE 추가로 새 배열 생성. 카테고리가 변경되지 않는 동일 설정의 반복 실행에서는 불필요한 할당이 반복됨. 현재 핸들러는 인스턴스 수준 캐시가 없으므로 실질 영향 없음.
  - 제안: 현재 구조에서는 수용 가능. 향후 핸들러를 stateful하게 개선할 경우 메모이제이션 고려.

- **[INFO]** `isPortFiltered`의 `Array.includes` 탐색
  - 위치: `execution-engine.service.ts` — `isPortFiltered` 변경 구간
  - 상세: 엣지 전파 시마다 호출되는 함수에 `Array.includes()`(O(n)) 추가. 포트 배열 크기는 카테고리 수(≤20)로 한정되고 `Set` 전환 비용이 이득보다 크므로 현재 구현이 적절.
  - 제안: 현재 구현 유지. 변경 불필요.

---

### 요약

이번 변경의 성능 특성은 전반적으로 양호하다. 핵심 병목은 LLM API 호출이며, 인메모리 처리 경로는 카테고리 수가 수십 개 수준으로 제한되기 때문에 O(n²) 패턴이 존재하더라도 실측 영향은 무시할 수 있다. `processMultiLabelResult`의 이중 `categories` 탐색은 `Map` 인덱스로 단일 패스로 통합하면 코드 명료성과 일관성도 향상되나, 프로덕션 성능 위험은 없다.

### 위험도

**LOW**