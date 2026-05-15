## 발견사항

### [INFO] `createEmptyConversationThread()` 팩토리 반복 호출 (테스트 파일 1~8)
- **위치**: 각 `.spec.ts` 파일의 테스트 픽스처 초기화 블록
- **상세**: `beforeEach` / 파일 스코프 변수에서 `createEmptyConversationThread()`를 반복 호출. 반환 객체가 단순 리터럴이라면 부담 없으나, 내부에서 참조형 자료를 생성하는 경우 테스트 간 상태 누출 가능성 존재. 현재는 각 테스트가 독립 인스턴스를 갖는 구조라 이중 생성이 없어 문제 없음.
- **제안**: 현행 유지. 단, `createEmptyConversationThread` 구현이 참조형(배열·객체) 필드를 반환한다면 `Object.freeze` 적용 또는 불변 기본값 패턴 적용 권장.

---

### [WARNING] WebSocket 페이로드 선형 증가 (File 45 — `6-websocket-protocol.md`)
- **위치**: `execution.waiting_for_input` 이벤트 payload에 `conversationThread?` 추가
- **상세**: 스펙은 `turns` 배열 전체를 snapshot으로 동봉한다. 대화가 길어질수록 (`seq 0 → N`) 모든 `waiting_for_input` 이벤트 페이로드가 O(N) 증가. 장기 대화(수십 턴 이상) 시 WebSocket 메시지 크기가 수 KB → 수십 KB로 늘어나 클라이언트 파싱 비용과 네트워크 트래픽이 함께 증가.
- **제안**: `conversationThread`를 선택적(`?`)으로 둔 것은 올바른 방향. 추가로 다음 중 하나를 검토:
  1. `turns` 대신 마지막 N개(`lastN: 10`) 또는 `nextSeq` + diff 전송으로 점진적 업데이트
  2. 클라이언트가 필요 시 별도 REST/SSE 엔드포인트로 thread를 pull하는 lazy fetch 패턴

---

### [WARNING] Redis ExecutionContext 직렬화 비용 누적 (File 43 — `4-execution-engine.md`)
- **위치**: §6.2 저장 전략 — `노드 hook 시 Redis conversationThread 일부`
- **상세**: `ConversationThreadService.append*` 호출마다 `ExecutionContext` 전체(variables, caches, conversationThread 포함)가 Redis에 직렬화된다. 각 turn append가 O(N) 직렬화를 유발. 대화 50턴 시 직렬화 크기는 초기 대비 N배 증가. `totalChars`로 cap을 두고 있으나 직렬화 자체는 매 append마다 발생.
- **제안**:
  1. `conversationThread`를 ExecutionContext와 별도 Redis 키(`thread:{executionId}`)로 분리해 append 시 context 전체 재직렬화를 방지 (RPUSH 또는 list 구조 활용)
  2. 혹은 append 연산을 배치(batch)하여 노드 완료 시점에만 flush

---

### [INFO] Background Thread Snapshot — 배열 복사 명세 (File 43)
- **위치**: `§3.3 Background` — `{ ...thread, turns: [...thread.turns] }`
- **상세**: 스펙이 turns 배열까지 명시적으로 새 인스턴스로 복사하도록 정확히 기술하고 있어 격리 불변량(ND-BG-05)이 유지됨. O(N) 복사이나 enqueue 시 1회만 발생하므로 허용 가능한 비용.
- **제안**: Turn 객체 자체가 immutable(Object.freeze 또는 readonly 타입)이면 shallow array copy로 충분. 구현 시 turn 내부를 deep copy하지 않아도 됨을 명시적으로 확인 권장.

---

### [INFO] `$thread.text` 표현식 연산 비용 (File 44 — `5-expression-language.md`)
- **위치**: `§4.4 $thread 속성` — `text: String | system_text 렌더 결과`
- **상세**: `$thread.text` 평가는 모든 turn을 순회해 헤더+본문을 문자열로 조합하는 O(N) 연산. 표현식이 동일 실행 컨텍스트 내에서 여러 노드에서 반복 참조될 경우 매번 재계산됨.
- **제안**: 실행 컨텍스트 내에서 `$thread.text`를 lazy computed property 또는 memoize 패턴으로 캐시. turns 배열이 변경될 때만 무효화.

---

## 요약

이번 변경사항은 대부분 spec 문서·테스트 픽스처·plan 파일 수정으로, 런타임 성능에 직접적인 영향을 미치는 코드 변경은 없다. 그러나 스펙이 확정한 아키텍처 결정 중 두 가지 — **WS 페이로드에 turns 전체 동봉**과 **append마다 ExecutionContext 전체 재직렬화** — 가 대화가 길어질수록 선형적으로 비용이 증가하는 구조를 내재하고 있다. `totalChars` 기반 cap이 있어 무제한 증가는 방지되나, cap 상한(스펙상 `MAX_INJECTED_CHARS` 등)에 도달하기 전 구간에서도 성능 저하가 점진적으로 발생할 수 있으므로, 구현 단계에서 Redis 분리 키와 WS diff 전송 전략을 검토할 것을 권장한다.

## 위험도

**LOW** — 런타임 코드 변경 없음. 설계 수준의 선형 비용 누적 패턴 2건이 구현 시 주의가 필요하나, cap 제한과 선택적 페이로드(`?`) 설계로 즉각적 위험은 낮음.