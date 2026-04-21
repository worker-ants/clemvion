## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `embed()` 순차 API 호출 — 병렬화 미적용**
- 위치: `google.client.ts` — `embed()` 메서드
- 상세: `for...of` 루프에서 텍스트마다 `embedContent`를 순차 await. 10개 텍스트라면 왕복 지연이 10배 누적됨.
- 제안:
  ```ts
  async embed(texts: string[], model?: string): Promise<number[][]> {
    const embeddingModel = this.genAI.getGenerativeModel({
      model: model || 'text-embedding-004',
    });
    const results = await Promise.all(
      texts.map((text) => embeddingModel.embedContent(text)),
    );
    return results.map((r) => r.embedding.values);
  }
  ```
  단, Google API rate limit이 있다면 `p-limit` 등으로 concurrency를 조절해야 함.

---

**[WARNING] `stream()` 내 tool call ID에 `Date.now()` + `Math.random()` 반복 호출**
- 위치: `google.client.ts` — `stream()`, 청크 반복문 내부
- 상세: 스트리밍 루프에서 매 tool call마다 `Date.now()`와 `Math.random().toString(36).substring(2, 9)` 조합으로 ID를 생성. 단독으로는 경미하지만, `chat()` 메서드에도 동일 패턴이 존재해 코드 전역에 분산되어 있음. `crypto.randomUUID()`(이미 `workflow-assistant-stream.service.ts`에서 사용 중)가 더 충돌 안전하고 의미도 명확함.
- 제안: `randomUUID()` 통일 사용.

---

**[WARNING] `buildChatInputs()` — messages 배열 2회 순회**
- 위치: `google.client.ts` — `buildChatInputs()`
- 상세: `params.messages.filter(system)` + `params.messages.filter(non-system)` 로 동일 배열을 두 번 순회. 대화가 수백 턴으로 길어지면 낭비가 되며, `MAX_HISTORY_TURNS * 3` 슬라이싱이 호출자 측에서 이미 일어나지만 클라이언트 단에서 보장이 없음.
- 제안: 단일 순회로 분류:
  ```ts
  const systemParts: string[] = [];
  const nonSystem: ChatMessage[] = [];
  for (const m of params.messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else nonSystem.push(m);
  }
  const systemInstruction = systemParts.join('\n\n');
  ```

---

**[INFO] `stream()` 내 `usageMetadata` 폴백 — 추가 `await result.response`**
- 위치: `google.client.ts` — `stream()` 하단 `totalTokens === 0` 분기
- 상세: 스트림 종료 후 `result.response` promise를 추가로 await. Gemini SDK 내부에서 이미 버퍼링된 값이므로 네트워크 왕복은 없지만, abort 경로가 아닌 정상 경로에서도 이 분기가 실행될 수 있음. 실제로 Gemini 2.5는 마지막 청크에 usageMetadata를 포함하므로 정상 경로에서는 dead code에 가까움. 그러나 폴백 자체는 방어적으로 유효하며 성능 영향은 미미함 — 현 구현 유지 가능.

---

**[INFO] `toChatMessage()` — `JSON.stringify(tc.arguments ?? {})` 반복**
- 위치: `workflow-assistant-stream.service.ts` — `toChatMessage()` 및 `stream()` 루프 내 assistantToolCalls 조립
- 상세: history reload 시마다 저장된 `arguments` 객체를 매번 `JSON.stringify`로 직렬화. DB에서 이미 직렬화된 문자열로 꺼낼 수 있다면 이 연산을 생략할 수 있지만, 현재 entity 구조에서 `arguments`가 `Record<string, unknown>`으로 역직렬화되어 저장되므로 불가피함. 규모가 커지면 entity 설계 시 직렬화 형태로 저장하는 것을 고려할 수 있음.

---

**[INFO] `safeParse()` — Array 구분 추가로 인한 불필요한 객체 반환 방지 (긍정적 변경)**
- 위치: `workflow-assistant-stream.service.ts` — `safeParse()`
- 상세: `!Array.isArray(parsed)` 조건 추가는 성능이 아닌 정확성 개선이지만, 배열을 `{}` 대신 올바른 경로로 처리해 하위 로직의 불필요한 방어 분기를 줄임 — 의도된 개선.

---

### 요약

이번 변경은 `buildChatInputs` / `startChatSession` 추출로 `chat()`과 `stream()` 간 중복 메시지 조립 비용을 제거했고, `safeParse`·`asString` 도입으로 예외 경로에서 불필요한 객체 생성을 억제한 점은 긍정적이다. 주요 성능 리스크는 `embed()` 의 순차 API 호출 패턴으로, 다수 텍스트 임베딩 시 지연이 선형으로 증가한다. `buildChatInputs`의 이중 순회와 tool call ID 생성 방식은 낮은 우선순위의 개선 사항이다. 전반적으로 스트리밍 구현의 메모리 모델(토큰 누적, abort 처리)은 적절하며, 심각한 성능 결함은 없다.

### 위험도

**LOW**