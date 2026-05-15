### 발견사항

---

**[WARNING] `buttonItemMap` 구성 시 중첩 루프로 인한 O(n×m) 순회**
- 위치: `carousel.handler.ts` — `execute()` 메서드 내 `allButtons` 구성 블록
- 상세: `items` 배열을 순회하면서 각 아이템의 `buttons`를 다시 순회하는 이중 루프. 아이템 수와 버튼 수가 많아질수록 선형 이상의 비용 발생. 단, 현재 최대 4버튼/아이템 제한이 있어 실질적 영향은 제한적.
- 제안: 현재 제약 조건(최대 4버튼) 내에선 허용 가능하나, `items.flatMap()` 패턴으로 가독성과 일관성 개선 가능.

---

**[WARNING] `custom-node.tsx`에서 `hasAnyLink` 계산 시 과도한 중복 순회**
- 위치: `custom-node.tsx` — `hasAnyLink` 계산 라인
- 상세: 단일 boolean 계산을 위해 `globalButtons.some()`, `itemButtons.some()`, `items.some(item => item.buttons?.some())` 세 번의 순회가 연결됨. 특히 `mode === 'static'`인 경우 이미 위에서 `portDefs`를 구성하며 전체 순회를 완료했음에도 재순회.
- 제안: `portDefs` 구성 루프에서 `hasAnyPort`와 `hasAnyLink` 플래그를 동시에 수집.

```ts
let hasAnyLink = false;
// portDefs 구성 루프 내에서:
if (b.type === 'link') hasAnyLink = true;
```

---

**[INFO] `execution-engine.service.ts`에서 `buttonId.includes('__item_')` + `split()` 이중 호출**
- 위치: `execution-engine.service.ts` — `selectedPort` 계산 블록
- 상세: `includes()` 확인 후 `split()[0]`으로 다시 파싱. 단일 `split()` 결과를 재사용하면 문자열 파싱을 한 번으로 줄일 수 있음.
- 제안:
```ts
const parts = buttonId.split('__item_');
selectedPort = parts.length > 1 ? parts[0] : buttonId;
```

---

**[INFO] `carousel.handler.ts` `execute()`에서 `config.source` 사용 방식의 불필요한 폴백 체인**
- 위치: `carousel.handler.ts` — `inputArray` 계산 블록
- 상세: `sourceData = config.source` → `Array.isArray(sourceData)` → `Array.isArray(input)` → `input != null ? [input] : []` 4단계 폴백. `source`가 이미 resolve된 값이라면 첫 번째 분기 외에는 레거시 폴백용. 폴백 경로가 실제로 도달하지 않는다면 dead code 및 불필요한 조건 평가.
- 제안: `source`가 항상 전달된다는 계약이 성립하면 폴백 제거. 아닐 경우 코멘트로 명시.

---

**[INFO] `ai-agent.handler.spec.ts` 서식 변경은 순수 코드 포맷팅으로 성능 무관**
- 위치: `ai-agent.handler.spec.ts` 전반
- 상세: 모든 변경이 줄 바꿈/들여쓰기 정리로, 런타임 성능과 무관.

---

### 요약

이번 변경의 핵심 성능 관심사는 백엔드의 `carousel.handler.ts`에서 `buttonItemMap` 구성 시 발생하는 중첩 순회와 `custom-node.tsx`의 `hasAnyLink` 계산 시 중복 순회다. 두 경우 모두 최대 4버튼이라는 도메인 제약으로 실질적인 체감 성능 이슈는 없으나, 순회를 통합하면 코드 명확성과 잠재적 확장성이 개선된다. `execution-engine.service.ts`의 `split()` 이중 호출은 마이크로 최적화 수준이다. 전반적으로 알고리즘 복잡도나 메모리 사용에서 심각한 문제는 없으며, 대부분의 성능 이슈는 이미 다른 리뷰어(architecture, concurrency)에서 지적된 `adjacentQuery`의 `limit: 100` 오버페칭과 프론트엔드의 `nodeExecutions` 3중 필터 순회다.

### 위험도
**LOW**