# Performance Review

## 발견사항

### **[INFO]** `kbs` 배열 이중 순회 (filter 두 번 + map)
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `searchWithMeta` 내 새로 추가된 사전 차단 블록
- 상세: `kbs.filter(kb => kb.embeddingDimension == null).map(...)` 로 `unsearchable` 목록을 만든 뒤, 다시 `kbs.filter(kb => kb.embeddingDimension != null)` 로 `searchableKbs` 를 구성한다. 동일 배열을 두 번 순회하는 O(2n) 패턴이다. 실제 KB 수는 일반적으로 수십 개 이하이므로 런타임 영향은 무시할 수 있으나, 단일 `reduce` 또는 `for` 루프로 두 결과를 동시에 생산하는 것이 더 명확하다.
- 제안: 성능 임팩트 없음 — 실제 리스트 크기(수십 개)에서 무의미한 차이. 가독성 개선이 필요하면 단일 루프로 통합 가능하나, 현행 코드로 충분하다.

### **[INFO]** `withUnsearchable` 헬퍼의 스프레드 연산자 객체 복사
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `withUnsearchable` 함수
- 상세: `unsearchable.length` 가 0보다 클 때 `{ ...r, unsearchable }` 스프레드로 새 객체를 생성한다. `SearchWithMetaResult` 는 얕은 DTO 객체이므로 할당 비용은 O(1) 에 가깝고 메모리 부담이 없다. `unsearchable.length === 0` 이면 원본 참조를 그대로 반환하여 불필요한 할당을 회피하는 설계는 올바르다.
- 제안: 현행 구현으로 충분. 변경 불필요.

### **[INFO]** `unsearchable?.find(u => u.kbId === kbId)` 선형 탐색
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-tool-provider.ts` — `KbToolProvider.execute` 내 `unsearchableHit` 조회
- 상세: `KbToolProvider.execute` 는 단일 KB(`kbId`) 로 호출되며, `searchWithMeta` 역시 단일 KB 목록을 전달한다(`[kbId]`). 따라서 `unsearchable` 배열 길이는 최대 1이다. `Array.find` 는 O(n) 이지만 n=1 이므로 실질 비용은 없다. 다중 KB 경로에서도 KB 수가 수십 개를 넘지 않아 Map/Set 최적화가 불필요하다.
- 제안: 현행 구현으로 충분.

### **[INFO]** 프론트엔드 — 인라인 템플릿 리터럴 스타일 계산 (KB 목록 카드)
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` — `kb.embeddingDimension == null` 조건부 `<span>` 렌더
- 상세: `className` 에서 조건부 클래스를 템플릿 리터럴 + 삼항 연산자로 인라인 계산하고 있다. 컴포넌트가 카드 목록을 전체 재렌더할 때 매 KB 항목마다 문자열을 새로 생성한다. 페이지 크기(PAGE_SIZE=20)와 재렌더 빈도(사용자 페이지 이동 시점)를 감안하면 실질 영향은 없다. Tailwind 클래스 조합 특성상 `clsx`/`cn` 유틸 사용이 관용적이나 성능 차이는 없다.
- 제안: 성능상 문제 없음. 코드 스타일 통일을 위해 프로젝트 기존 `cn()`/`clsx()` 패턴이 있다면 맞추는 것이 유지보수성에 유리하다.

### **[INFO]** `RagAccumulator` 카운터 증가 — O(1) 연산
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `RagAccumulator.record`
- 상세: `diagnosticCount` 와 `unsearchableCount` 두 정수 카운터를 `record()` 호출 시마다 증가시킨다. 순수 O(1) 연산이며 메모리 추가 할당도 없다. `build()` 에서 조건 분기 하나 추가됐으나 마찬가지로 O(1).
- 제안: 현행 구현 최적.

---

## 요약

이번 변경의 성능 프로파일은 전반적으로 양호하다. 핵심 경로인 `searchWithMeta` 의 사전 차단 로직은 불필요한 임베딩 호출과 벡터 쿼리를 완전히 회피하여 기존 대비 오히려 성능을 개선하는 효과가 있다. 새로 추가된 연산(배열 이중 filter/map, `Array.find`, 카운터 증가, 스프레드 복사)은 모두 입력 크기가 상수(KB 수는 수십 개 이하)에 가깝거나 O(1)이어서 실질 부담이 없다. 프론트엔드 카드 렌더링도 페이지 크기(최대 20)에서 추가 비용이 무시 가능하다. 알고리즘적 병목, N+1 호출, 메모리 누수, 블로킹 I/O 문제는 발견되지 않았다.

## 위험도

NONE
