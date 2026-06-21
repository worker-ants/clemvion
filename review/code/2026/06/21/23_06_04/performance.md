# 성능(Performance) 리뷰 — AiTurnExecutor 추출 (M-1 3단계)

## 발견사항

### [INFO] `resolveRetryStateTtlMinutes()` — 매 호출마다 `process.env` 파싱
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L614-622
- 상세: `resolveRetryStateTtlMinutes()` 는 일반 함수이므로 `buildRetryState()` 호출마다 `process.env` 를 읽고 `Number()` 변환·유효성 검사를 수행한다. 값은 앱 수명 내 불변이지만 hot path 에 있는 건 아니므로 심각도는 낮다.
- 제안: 모듈 최상위에서 한 번만 계산해 상수로 캐싱한다. `const RETRY_STATE_TTL_MINUTES = resolveRetryStateTtlMinutes();`

---

### [INFO] `capFormDataBytes` — `JSON.stringify` 를 최대 3회 호출
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L720, L744, L769
- 상세: `originalBytes` 계산(L720), `nonStringBytes` 계산(L744), `bytesAfterCap` 계산(L769) 에서 각각 `JSON.stringify` 를 호출한다. formData 가 클수록 비용이 커지지만, `capFormDataBytes` 는 form submit 경로(드문 경우)에서만 실행되므로 실제 hot path 는 아니다. 코드 명확성 측면에서는 허용 가능한 수준.
- 제안: `nonStringObject` 재직렬화 없이 `nonStringBytes = originalBytes - stringFieldBytes` 로 근사 계산 가능. 단, 정확도는 약간 낮아지므로 현재 구현(안전한 보수적 계산)을 유지하는 것이 합리적이다.

---

### [INFO] `buildTools` — 매 multi-turn 재개마다 모든 provider 순차 호출
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L3308-3343 (`processMultiTurnMessage` L2328-2333)
- 상세: `processMultiTurnMessage` 는 매 turn 마다 `buildTools` 를 재호출하며, `buildTools` 내부에서 `toolProviders` 를 순차 `for...of` 루프로 순회한다. MCP 세션 연결 등 I/O 를 동반할 수 있는 `provider.buildTools` 가 직렬화되어 실행된다. providers 수가 많고 I/O 비용이 크면 첫 번째 LLM 호출 전 지연이 누적된다.
- 제안: `Promise.all` 로 병렬화한다. 각 provider 의 `buildTools` 는 독립적이므로 의존 관계가 없다.

```ts
const builtArrays = await Promise.all(
  this.toolProviders.map(async (provider) => {
    try {
      return await provider.buildTools({ config, workspaceId, executionId, mcpDiagnostics });
    } catch (e) {
      AiTurnExecutor.logger.warn(`Provider "${provider.key}" buildTools failed: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }),
);
const providerTools = builtArrays.flat();
```

---

### [INFO] `processMultiTurnMessage` — `messages.findIndex` O(n) 선형 탐색 (form_submitted 경로)
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L2191-2193, L2249-2252
- 상세: `pendingFormToolCall` 경로에서 `messages.findIndex` 로 `toolCallId` 가 일치하는 stub 인덱스를 찾는다. messages 배열이 길어지면(장기 대화) O(n) 탐색 비용이 증가한다. 단, form submit 경로는 매우 드물게 실행되며 messages 배열이 수백 개 이상이 되는 경우는 드물다.
- 제안: 실용적 범위에서는 허용 가능하다. messages 수가 수천 이상이 예상되면 `toolCallId → index` Map 을 `_resumeState` 에 보조 인덱스로 관리하는 것을 고려.

---

### [INFO] `messages: [...messages]` 스프레드 복사 — 불필요한 shallow copy
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L1529, L1759, L2422, L2664
- 상세: LLM 호출 직전 `messages: [...messages]` 로 배열을 복사해 `requestPayload` / `chatParams` 스냅샷으로 저장한다. 이는 디버그 trace 목적의 스냅샷이지만, messages 가 대형 context window 를 포함할 경우 루프 반복마다 메모리 할당이 발생한다. 특히 tool loop 의 각 iteration 에서 발생하는 L1759/L2664 가 주목할 만하다.
- 제안: 디버그 trace 의 `requestPayload` 는 참조만 저장해도 충분한 경우가 많다. 대화 메시지 배열 크기가 수백 KB 이상이 될 수 있는 context 에서는 메모리 부담이 있다. 허용 가능한 현 설계이지만 LLM trace 로그의 메모리 비용을 인지해야 한다.

---

### [INFO] `turnDebugHistory` 누적 제한(50) — 적절히 처리됨
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L2740-2743
- 상세: `MAX_TURN_DEBUG_HISTORY = 50` 으로 turnDebug 배열을 제한해 JSONB 비대화를 방지한다. 유사하게 `MAX_RESUME_RAG_SOURCES = 200` 으로 ragSources 도 제한된다. 이는 의도적이고 올바른 설계다.

---

### [INFO] `RagAccumulator.fromState` — 재개 시 seenChunkIds Set 재구성 O(n)
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L882-898
- 상세: multi-turn resume 마다 `fromState` 가 `existingSources` 전체를 순회해 `seenChunkIds` Set 을 재구성한다. 소스 수가 `MAX_RESUME_RAG_SOURCES = 200` 으로 제한되어 있으므로 실용적 범위에서 허용 가능하다.

---

### [INFO] `Date.now()` 중복 호출 — `llmCalls.push` 에서 동일 타임스탬프를 두 번 계산
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L1557-1563, L1781-1787
- 상세: `durationMs: Date.now() - callStartedAt` 과 `finishedAt: toIso(Date.now())` 가 별도의 `Date.now()` 호출로 계산되어 두 값의 기준 시각이 약간 다르다. 성능보다는 일관성 문제지만, 한 번 저장해 재사용하는 것이 더 정확하다.
- 제안:
```ts
const finishedAt = Date.now();
llmCalls.push({
  ...
  durationMs: finishedAt - callStartedAt,
  finishedAt: toIso(finishedAt),
});
```

---

## 요약

이번 변경은 god-handler 에서 `AiTurnExecutor` 로의 무상태 collaborator 추출 리팩터링으로, 동작 보존이 목적이다. 성능 관점에서 신규로 도입된 심각한 병목은 없다. 주요 관찰 사항은: (1) `buildTools` 내 toolProvider 순차 실행이 병렬화 기회임 — 현재는 `for...of` 직렬이지만 `Promise.all` 로 전환하면 MCP 등 I/O 비용 provider 다수 구성 시 latency 개선이 가능하다. (2) LLM 호출 trace(`requestPayload: [...messages]`)의 루프 내 배열 복사는 대형 컨텍스트에서 메모리 압력을 가중시킬 수 있으나 디버그 목적상 의도된 트레이드오프다. (3) `resolveRetryStateTtlMinutes` 의 매 호출 환경변수 파싱은 모듈 초기화 시 캐싱으로 간단히 해소 가능하다. 기존 `MAX_TURN_DEBUG_HISTORY` / `MAX_RESUME_RAG_SOURCES` 누적 제한과 form data cap 등 메모리 안정성 가드는 잘 설계되어 있다.

## 위험도

LOW
