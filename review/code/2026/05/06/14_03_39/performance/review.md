---

### 발견사항

- **[WARNING] 병렬 처리 가능한 provider tool 호출을 순차 실행**
  - 위치: `ai-agent.handler.ts:547-567`, `930-955`
  - 상세: LLM이 동일 응답에서 여러 KB tool을 동시에 요청해도 (`providerToolCalls`) `for...await` 루프로 순차 실행됨. KB 검색이 I/O 바운드임을 고려하면, 2개 KB 동시 호출 시 지연이 `max(t1, t2)` 대신 `t1 + t2`가 됨. 테스트 제목("runs parallel kb_ tool calls")과 구현이 불일치.
  - 제안: `Promise.all(classification.providerToolCalls.map(...))` 으로 병렬화. 단, `messages.push` 순서 보장을 위해 결과 수집 후 일괄 push 필요.

- **[WARNING] `classifyToolCalls` 내 Map 및 `indexOf` 중복 비용**
  - 위치: `ai-agent.handler.ts:1223-1260`
  - 상세: (1) `condNameToCondition` Map이 tool loop 반복마다 재생성됨. conditions가 루프 전체에서 불변임에도 O(C) 재구성이 매 이터레이션 발생. (2) `condNameToCondition.get(ctc.name)`으로 이미 condition 객체를 꺼낸 후 다시 `conditions.indexOf(cond)`를 호출해 O(C) 선형 탐색 중복.
  - 제안: Map 값에 `{ cond, index }` 쌍으로 저장해 `indexOf` 제거. Map 자체는 루프 진입 전 1회만 생성(`buildTools` 완료 직후).

- **[WARNING] `RagAccumulator.fromState` 멀티턴 재개 시 전체 sources 재순회**
  - 위치: `ai-agent.handler.ts:196-210`
  - 상세: 매 멀티턴 메시지 처리마다 `fromState`가 기존 `ragSources` 전체를 순회해 `seenChunkIds` Set을 재구성한 뒤 `push(...existingSources)`로 배열 전체를 복사함. 대화가 길어질수록 (수십 턴 × 다수 KB chunk) O(n) 비용이 매 턴마다 반복.
  - 제안: `seenChunkIds`를 직렬화해 `_resumeState`에 보존하고, `fromState`에서 기존 Set을 그대로 복원. `sources` 배열도 재복사 없이 참조 전달 후 불변 유지.

- **[WARNING] LLM 호출 파라미터 객체 이중 생성**
  - 위치: `ai-agent.handler.ts:461-479`, `594-616`, `843-862`, `981-1001`
  - 상세: 매 LLM 호출 직전 텔레메트리용 스냅샷(`firstRequest`/`loopRequest`)과 실제 호출 인자를 별도로 구성. `[...messages]` spread가 각 LLM 호출마다 O(m) 배열 복사를 발생시킴(m = 메시지 수). 멀티턴 대화에서 messages 배열이 선형 증가하므로 누적 비용이 커짐.
  - 제안: 실제 호출 인자를 먼저 구성하고 그 참조를 `llmCalls`에 기록 후, snapshot이 필요한 시점에만 `[...messages]` 복사.

- **[INFO] 테스트 내 이중 `handler.execute` 호출**
  - 위치: `ai-agent.handler.spec.ts:137-164`
  - 상세: "should NOT pre-search KB" 테스트에서 `handler.execute`를 2회 호출(`139-149`와 `151-163`). 두 번째 호출은 meta를 읽기 위한 것인데, 첫 번째 호출 결과를 재사용하거나 헬퍼를 직접 호출하면 불필요한 mock 호출과 async 오버헤드를 줄일 수 있음.
  - 제안: 첫 번째 `execute` 반환값을 변수에 저장해 재사용하거나 `readSingleTurnMeta(handler)(result)` 패턴으로 단일 호출.

- **[INFO] `buildConditionSystemPromptSuffix` 중간 배열 생성**
  - 위치: `ai-agent.handler.ts:1293-1297`
  - 상세: `.map().join()`이 중간 배열을 생성함. conditions ≤ 20개 제한으로 실질 영향은 없으나, `reduce`나 직접 문자열 누적으로 대체 가능.

---

### 요약

전반적으로 코드 구조는 명확하고 메모리 누수나 N+1 DB 쿼리 같은 심각한 성능 결함은 없다. 가장 주목할 문제는 **동일 LLM 응답에서 온 여러 provider tool 호출(KB, MCP)을 순차 실행하는 것**으로, 이는 병렬화 가능한 I/O를 직렬화해 사용자 체감 지연을 불필요하게 높인다. 그 다음으로 `classifyToolCalls`의 Map 재구성과 `indexOf` 중복, 멀티턴 재개 시 `RagAccumulator.fromState`의 전체 배열 재순회가 대화가 길어질수록 누적 비용으로 이어지는 구조적 비효율이다. LLM 호출 파라미터 이중 구성은 현재 규모에서 미미하나 메시지 수 증가에 비례해 악화된다.

### 위험도

**MEDIUM**