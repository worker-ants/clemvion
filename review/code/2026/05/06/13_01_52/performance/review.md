---

### 발견사항

---

**[WARNING]** 멀티 provider 도구 호출이 순차 실행됨 (병렬화 누락)
- 위치: `handler.ts:552-573`, `handler.ts:939-964`
- 상세: LLM이 한 응답에 여러 `kb_*` 도구를 동시에 요청해도 (spec 테스트 "runs parallel kb_ tool calls" 포함), 핸들러는 `for...of + await` 순차 루프로 처리한다. KB 검색은 I/O 바운드 작업이므로 직렬화는 전체 턴 응답 시간에 직결된다.
- 제안:
  ```typescript
  const providerResults = await Promise.all(
    classification.providerToolCalls.map(({ provider, call }) =>
      this.runProviderTool({ provider, call, ... })
    )
  );
  ```
  단, 결과를 messages에 push하는 순서는 toolCallId 기준으로 정렬해야 LLM에 전달되는 메시지 순서가 보장된다.

---

**[WARNING]** `buildTools`의 provider 초기화도 순차 실행
- 위치: `handler.ts:1325-1338`
- 상세: `for (const provider of this.toolProviders) { const built = await provider.buildTools(...) }` — MCP 서버 연결처럼 네트워크 지연이 있는 provider가 여럿일 때 직렬로 대기한다. `buildTools`는 각 provider가 독립적이므로 병렬화가 안전하다.
- 제안:
  ```typescript
  const results = await Promise.allSettled(
    this.toolProviders.map(p => provider.buildTools({...}))
  );
  ```

---

**[WARNING]** `classifyToolCalls`가 tool 루프 내에서 매 이터레이션마다 Map을 재구성
- 위치: `handler.ts:493`, `handler.ts:879`, `handler.ts:1232-1235`
- 상세: `while (result.toolCalls?.length && toolCallCount < maxToolCalls)` 루프 안에서 `classifyToolCalls`가 호출되며, 이 함수는 `conditions` 배열로부터 `condNameToCondition` Map을 매번 새로 빌드한다. `conditions`는 실행 중 변경되지 않으므로 루프 진입 전 1회만 생성하면 된다.
- 제안: 루프 시작 전에 Map을 생성하고 `classifyToolCalls`에 인자로 전달하거나, 함수 내에서 params 객체로 받도록 리팩터링.

---

**[WARNING]** `conditions.indexOf(cond)` — Map lookup 이후 다시 O(n) 탐색
- 위치: `handler.ts:1263`
- 상세: `condNameToCondition` Map에서 조건을 꺼낸 뒤, 우선순위 결정을 위해 `conditions.indexOf(cond)`로 다시 선형 탐색한다. Map 구성 시 인덱스를 함께 저장하면 O(1)로 해결된다.
- 제안:
  ```typescript
  const condNameToCondition = new Map<string, { cond: ConditionDef; index: number }>();
  for (let i = 0; i < conditions.length; i++) {
    condNameToCondition.set(condToolName(conditions[i].id), { cond: conditions[i], index: i });
  }
  ```

---

**[WARNING]** `conversationHistory` 설정이 핸들러에서 무시됨 — 항상 전체 메시지를 LLM에 전송
- 위치: `handler.ts:684-778` (executeMultiTurn), `handler.ts:798-1079` (processMultiTurnMessageInner)
- 상세: schema에 `conversationHistory: 'none' | 'last_n' | 'full'`과 `historyCount`가 정의되어 있으나 핸들러에서 이 값을 읽거나 적용하는 코드가 없다. `maxTurns=20`에 턴당 여러 tool call이 붙으면 messages 배열이 수백 개 항목으로 성장해 LLM 입력 토큰(비용+지연)이 불필요하게 증가한다.
- 제안: `last_n` 모드 시 LLM 호출 직전 system message + 최근 N*2 개 user/assistant 쌍만 슬라이싱해서 전달.

---

**[INFO]** 디버그 스냅샷을 위한 `[...messages]` 스프레드가 루프마다 실행
- 위치: `handler.ts:467-469`, `handler.ts:599-602`, `handler.ts:850-855`, `handler.ts:990-993`
- 상세: `loopRequest` / `chatParams`에 `messages: [...messages]`로 스냅샷을 찍는데, 이는 LLM 호출 디버그용이다. 대화가 길어질수록 루프 이터레이션마다 O(n) 배열 복사가 반복된다. 실제 LLM 호출은 `messages`(레퍼런스)를 그대로 사용하므로 스냅샷 복사만 발생한다.
- 제안: 디버그 기록이 필요할 경우 스냅샷을 지연 평가(lazy copy)하거나, 메시지 길이가 임계치(예: 100개) 이상일 때만 복사 대신 메타 정보(length, last few)만 기록.

---

**[INFO]** `turnDebugHistory` 스프레드가 매 턴마다 성장하는 배열을 복사
- 위치: `handler.ts:899`, `handler.ts:1028`
- 상세: `[...prevHistory, currentTurnDebug]`로 매 턴마다 히스토리 배열 전체를 복사한다. `maxTurns=20`이면 총 1+2+...+20 = 210회 요소 복사가 발생한다. 규모가 작아 실제 영향은 미미하지만 push-to-mutable 방식으로 전환 가능.
- 제안: state를 불변으로 유지해야 하는 제약이 없다면 배열에 직접 push 후 전달.

---

**[INFO]** 테스트에서 동일 실행을 2회 호출
- 위치: `spec.ts:137-163` (`'should NOT pre-search KB'` 테스트)
- 상세: `handler.execute()`를 결과를 버리고 한 번, 그리고 meta를 읽기 위해 다시 한 번 호출한다. mock setup 비용은 낮으나 불필요한 중복이다.

---

### 요약

handler의 핵심 성능 리스크는 두 가지다. 첫째, LLM이 한 응답에서 여러 KB/MCP 도구를 동시에 요청할 때 핸들러가 이를 순차적으로 처리하여 I/O 대기 시간이 직렬화된다 — `Promise.all`로 병렬화하면 즉각적인 개선이 가능하다. 둘째, `conversationHistory` 설정이 구현되지 않아 멀티턴 대화에서 전체 메시지 기록을 항상 LLM에 전송하므로, 대화가 길어질수록 토큰 비용과 응답 지연이 선형으로 증가한다. 그 외 `classifyToolCalls` 내 Map 재구성과 `indexOf` 중복 탐색은 conditions 상한(20개)과 maxToolCalls(기본 10)의 낮은 상수 때문에 실질적 영향은 제한적이나, 코드 구조 개선으로 해결 가능하다.

### 위험도

**MEDIUM**