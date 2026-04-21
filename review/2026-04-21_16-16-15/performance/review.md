### 발견사항

---

**[WARNING] 스트리밍 루프 내 문자열 누적이 O(n²)**
- 위치: `anthropic.client.ts` → `block.args += delta.partial_json`, `openai.client.ts` → `entry.args += argsFragment`
- 상세: JavaScript 엔진은 문자열 `+=`를 매번 새 문자열로 복사한다. 수백 개의 delta 조각이 들어오는 긴 tool arguments (예: 코드 블록, 대형 JSON) 에서는 누적 복사 비용이 chunk 수의 제곱에 비례한다.
- 제안: 배열로 수집한 뒤 루프 종료 후 `.join('')` 단 한 번에 결합.
```ts
// 선언부
args: string[]   // string → string[]

// delta 누적
block.args.push(delta.partial_json);

// tool_call_end 시
arguments: block.args.join('') || '{}'
```

---

**[WARNING] `getWorkflow`에서 nodes/edges 쿼리 직렬 실행**
- 위치: `explore-tools.service.ts:110–117`
- 상세: `nodeRepo.find()`와 `edgeRepo.find()`가 `await` 두 번으로 순차 실행된다. 두 쿼리는 서로 독립적이므로 불필요한 왕복 대기가 발생한다.
- 제안:
```ts
const [nodes, edges] = await Promise.all([
  this.nodeRepo.find({ where: { workflowId: id } }),
  this.edgeRepo.find({ where: { workflowId: id } }),
]);
```

---

**[WARNING] `appendMessage`에서 session 테이블을 두 번 UPDATE**
- 위치: `workflow-assistant-session.service.ts:149–157`
- 상세: `sessionRepo.update()`로 `lastInteractionAt`·`updatedAt`을 갱신한 직후 `sessionRepo.increment()`로 `messageCount`를 증가시킨다. DB 왕복이 2회 발생하며, 트랜잭션 없이 두 쿼리 사이에 실패하면 `messageCount`와 실제 메시지 수가 어긋날 수 있다.
- 제안: 단일 `UPDATE` 쿼리로 병합.
```ts
await this.sessionRepo
  .createQueryBuilder()
  .update(WorkflowAssistantSession)
  .set({
    lastInteractionAt: now,
    updatedAt: now,
    messageCount: () => '"message_count" + 1',
  })
  .where('id = :id', { id: sessionId })
  .execute();
```

---

**[WARNING] Zustand 상태 직접 변이 (direct mutation)**
- 위치: `assistant-store.ts` → `handleSseEvent` 내 `tool_call` 처리 블록
- 상세: `for (const other of [...s.messages].reverse()) { if (other.plan) { other.plan.steps = ... } }` — `s.messages` 사본을 만들었더라도 `other`는 원본 객체 참조이므로 `other.plan.steps`를 재할당하면 Zustand 내부 상태를 직접 변이한다. React가 참조 비교로 변경을 감지하지 못해 UI가 갱신되지 않는 버그이며, strict mode에서 예외 없이 무음 실패한다.
- 제안: `set()` 콜백 안에서 불변 방식으로 처리.
```ts
set((s) => {
  let updated = false;
  const messages = s.messages.map((m) => {
    if (updated || !m.plan) return m;
    updated = true;
    return {
      ...m,
      plan: {
        ...m.plan,
        steps: m.plan.steps.map((step) =>
          step.id === stepId && step.status === 'pending'
            ? { ...step, status: 'done' }
            : step,
        ),
      },
    };
  });
  return { messages };
});
```

---

**[INFO] `wouldCreateCycle`이 O(V×E)**
- 위치: `shadow-workflow.ts:233–244`
- 상세: DFS 스택을 순회하면서 매 노드마다 `this.edges.values()` 전체를 스캔한다. 엄밀히는 O(V×E). 일반적인 워크플로 크기(< 50노드)에서는 무시할 수준이나, 대형 워크플로 지원이 요구될 경우 인접 리스트를 미리 빌드하면 O(V+E)로 개선된다.
- 제안: 필요 시 `Map<string, string[]>` adjacency list를 `apply()` 호출 시 한 번만 구성.

---

**[INFO] `buildSystemPrompt`에서 pretty-print JSON**
- 위치: `system-prompt.ts:48`
- 상세: `JSON.stringify(current, null, 2)`는 인덴트 공백을 포함해 LLM 입력 토큰을 최대 30–40% 늘린다. 대형 워크플로(50+ 노드)에서는 비용이 유의미하다.
- 제안: LLM 품질 저하 없이 `JSON.stringify(current)`로 교체 가능. 혹은 노드·엣지의 position을 시스템 프롬프트에서 제외.

---

**[INFO] `setWorkflow`에서 API 호출 3회 직렬**
- 위치: `assistant-store.ts:setWorkflow`
- 상세: `getLatestSession` → `loadSession` (getSessionDetail 포함) → `listSessions` 순으로 3회 왕복. 에디터 진입 시마다 발생한다.
- 제안: `getLatestSession`과 `listSessions`를 `Promise.all`로 병렬화하고, `loadSession`은 latest가 존재할 때만 순차 실행.

---

**[INFO] 스트리밍 중 자동 스크롤 미작동**
- 위치: `assistant-panel.tsx:useEffect([messages.length, isStreaming])`
- 상세: `text_delta` 이벤트는 메시지 수가 아닌 내용을 갱신하므로 이 effect는 스트리밍 중 발동되지 않는다. 응답이 길어질수록 사용자가 직접 스크롤해야 한다.
- 제안: 스트리밍 중에는 `requestAnimationFrame`이나 `messages` 배열 자체를 의존성에 포함해 매 delta마다 스크롤 갱신.

---

### 요약

가장 심각한 문제는 두 가지다. 첫째, Anthropic·OpenAI 스트리밍 클라이언트 모두 tool argument를 `+=`로 누적해 LLM이 긴 JSON을 생성할 때 O(n²) 복사가 발생하며, 이는 스트리밍 지연 및 GC 압박으로 직결된다. 둘째, `assistant-store`의 plan step 완료 처리가 Zustand 상태를 직접 변이해 UI 갱신이 묵음 실패할 수 있는 정확성 버그다. 나머지 항목(직렬 DB 쿼리, 이중 UPDATE, 토큰 낭비)은 운영 부하가 커지기 전에 정비하면 충분한 수준이다.

### 위험도

**MEDIUM**