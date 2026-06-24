# 성능(Performance) 리뷰 — M-4 park-entry dispatch registry 추출

## 발견사항

### **[INFO]** `dispatchParkEntry` 내 `getMetadata` + `getInteractionType` 이중 호출 — 기존 코드와 동일 수준, 회귀 없음
- 위치: `execution-engine.service.ts` — `dispatchParkEntry` 메서드 (약 line 198–211)
- 상세: 추출 전 각 호출 사이트에서도 `blocking = this.handlerRegistry.getMetadata(node.type)` 와 `interactionType = this.getInteractionType(context, node.id)` 를 각각 호출하던 구조였다. 통합 후 `dispatchParkEntry` 가 동일 두 호출을 한 곳에서 수행하므로 per-dispatch 호출 횟수는 동일하다. `getMetadata` 는 registry lookup(O(1) Map)이고, `getInteractionType` 는 `context.nodeOutputCache` 조회(O(1))이므로 CPU 비용은 무시할 수준이다.
- 제안: 현 수준 유지. 만약 향후 같은 노드에 대해 `dispatchParkEntry` 가 반복 호출되는 경로가 생긴다면 `ParkEntryContext` 에 이미 계산된 `blockingInteraction`/`interactionType` 를 실어 선택자 계산을 호출 전 단 1회로 줄일 수 있다.

### **[INFO]** `parkEntryRegistry` lazy getter — 적절한 지연 초기화, 추가 비용 없음
- 위치: `execution-engine.service.ts` — `get parkEntryRegistry()` (약 line 159–184)
- 상세: `_parkEntryRegistry ??= buildParkEntryRegistry(deps)` 패턴으로 서비스 인스턴스 당 1회만 배열을 생성하고 이후 동일 참조를 재사용한다. `buildParkEntryRegistry` 는 세 개의 리터럴 객체를 생성하는 순수 팩토리이므로 초기화 비용은 무시할 수준이다. `resumeTurnRegistry` 의 선례(`_resumeTurnRegistry ??=`)와 일관성도 맞는다.
- 제안: 없음.

### **[INFO]** `Array.find` O(n) 탐색 — registry 크기(현재 3)에서 비용 없음
- 위치: `execution-engine.service.ts` — `dispatchParkEntry` 내 `this.parkEntryRegistry.find(...)` (약 line 202–209)
- 상세: registry 항목이 현재 3개(form/buttons/ai)이고 이는 고정 상수다. `Array.find` 의 O(n)이지만 n=3 에서는 사실상 O(1)이다. 신규 blocking 타입 추가 시에도 종류가 수 개 수준에 머물 것으로 예상되므로 Map 전환 필요성이 없다.
- 제안: 없음. 단, 만약 항목 수가 10+으로 증가하는 시나리오가 생기면 `Map<discriminant, ParkEntryDispatch>` 로 O(1) 조회로 전환을 검토할 수 있다.

### **[INFO]** `ParkEntryContext` 객체 리터럴 — 매 호출 사이트마다 신규 생성, 허용 수준
- 위치: `execution-engine.service.ts` — 세 개의 `dispatchParkEntry({ savedExecution, executionId, node, context, graphEdges })` 호출 사이트
- 상세: 매 park 진입 시 얕은 객체 리터럴이 하나 생성된다. 해당 객체는 `waitForX` 호출 스택 위에서 단명하고, park 는 blocking I/O 대기(사용자 입력 대기)이므로 객체 생성 비용 대비 park wait latency 가 수십~수백 ms 이상이다. GC 관점에서도 단명 객체(young gen)는 V8 에서 빠르게 회수된다.
- 제안: 없음.

## 요약

이번 변경은 park 진입 분기(form/buttons/ai)가 세 곳에 하드코딩되어 있던 코드를 `dispatchParkEntry` + lazy `parkEntryRegistry` 로 일원화한 순수 리팩터링이다. 성능 관점에서 새로 도입된 비용은 사실상 없다. `dispatchParkEntry` 내 `getMetadata`/`getInteractionType` 호출은 추출 전과 동일하고, registry 탐색은 n=3 고정 배열에 대한 `Array.find` 로 O(1)에 준하며, lazy getter 는 서비스 인스턴스 당 1회 배열 생성으로 메모리 최적화가 적절하다. blocking I/O(`waitForX`) 자체가 사용자 응답 대기라는 압도적 지배 비용이므로, 도입된 추가 연산(객체 리터럴, 두 번의 O(1) lookup, find)은 전체 latency 에 미치는 영향이 없다.

## 위험도

NONE
