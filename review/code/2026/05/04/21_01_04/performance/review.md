### 발견사항

**[INFO]** `fromConversationMessages`에서 `callIndexByTurn` Map이 매 호출마다 새로 생성됨
- 위치: `llm-call-trace.ts`, `fromConversationMessages` 함수 내 `const callIndexByTurn = new Map<number, number>()`
- 상세: 이 함수는 렌더 경로에서 호출되지만, 변환 대상인 `fallbackMessages`는 WebSocket 이벤트 단위로 이미 메모리에 올라온 소규모 배열이다. Map 생성 비용은 무시할 수준이고, 함수 종료 시 즉시 GC 대상이 되므로 누수 우려 없음.
- 제안: 현행 유지. 만약 대화 메시지가 수천 건 이상으로 커지는 시나리오가 생긴다면 그때 검토.

**[INFO]** 각 assistant 메시지마다 Map `get` + `set` 두 번 호출
- 위치: `llm-call-trace.ts` 108~109행
- 상세: `Map.get` / `Map.set`은 평균 O(1). 루프 전체가 O(n)이며 최소 복잡도. 이중 조회는 코드 가독성과 트레이드오프가 없음.
- 제안: 현행 유지.

---

### 요약

변경 범위가 `fromConversationMessages` 내 단일 루프에 `Map<number, number>` 한 개 추가하는 것으로 국한된다. 알고리즘 복잡도는 이전과 동일한 O(n) 시간 · O(k) 공간(k = 고유 turnIndex 수)이며, 이는 메시지 전체를 순회해야 하는 이 작업의 최적 하한이다. DB/API 호출, 블로킹 I/O, 중복 연산, 불필요한 객체 생성은 없다. 테스트 파일 추가도 정적 인라인 데이터만 사용하므로 런타임 영향 없음. 성능 관점의 우려 사항이 없는 변경이다.

### 위험도

**NONE**