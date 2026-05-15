### 발견사항

---

**[CRITICAL] 백엔드 spec 파일에 동일한 describe 블록이 중복 존재**
- 위치: `execution-engine.service.spec.ts` — diff가 추가하는 블록(Template 앞) + 전체 파일 컨텍스트에서 Template 이후 재등장하는 동일 블록
- 상세: diff는 `describe('AI Agent multi-turn — execution.ai_message emit shape')` 블록을 line 902 위치(Template 앞)에 추가하지만, 전체 파일 컨텍스트를 보면 동일한 블록이 Template 테스트 이후에도 다시 나타난다. 두 블록의 테스트 케이스·픽스처·`makeAiAgentHandler` 팩토리까지 완전히 동일하다. 결과적으로 같은 테스트가 두 번 실행되고, Jest 리포트에 중복 패스가 표시되어 실제 커버리지 신뢰도가 저하된다.
- 제안: Template 이후의 원본 블록을 제거하거나, 반대로 새로 추가된 블록만 남기고 원본을 삭제. `git diff HEAD~2` 로 원래 위치를 확인 후 하나만 남길 것.

---

**[WARNING] `messages: []`(빈 배열) 케이스 미테스트**
- 위치: `use-execution-events.test.ts` — `ai_message ignores payloads missing the messages snapshot` 테스트
- 상세: 구현체는 `!Array.isArray(payload.messages) || payload.messages.length === 0` 두 조건 모두 드롭하지만, 테스트는 `messages` 키 자체가 없는 경우만 다룬다. `messages: []`가 전달됐을 때도 0개를 유지하는지 검증하지 않는다.
- 제안:
  ```ts
  it("ai_message ignores empty messages array", () => {
    useExecutionStore.getState().startExecution("exec-1");
    const { aiMessage } = bind();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      aiMessage!({ nodeId: "agent-1", message: "x", turnCount: 1, messages: [] });
    } finally { warnSpy.mockRestore(); }
    expect(useExecutionStore.getState().conversationMessages).toHaveLength(0);
  });
  ```

---

**[WARNING] `console.warn` 호출 여부를 검증하지 않음**
- 위치: `use-execution-events.test.ts` — 동일 테스트 케이스
- 상세: `warnSpy`를 선언해 suppress는 하지만 실제로 경고가 발생하는지 `expect(warnSpy).toHaveBeenCalledWith(...)` 검증이 없다. 미래에 warn 로직이 실수로 제거돼도 테스트는 통과한다.
- 제안:
  ```ts
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining("execution.ai_message without messages snapshot"),
    expect.anything(),
  );
  ```

---

**[WARNING] 두 번째 백엔드 테스트에서 `durationMs` 검증 누락**
- 위치: `execution-engine.service.spec.ts` — `preserves the full llmCalls sequence for tool-loop turns`
- 상세: 세 llmCall의 `durationMs`(30+40+50=120)와 `totalDurationMs: 120`이 설정되어 있으나 페이로드의 `durationMs` 필드를 `expect`로 확인하지 않는다. 첫 번째 테스트가 `durationMs: 120`을 검증하는 것과 일관성이 없다.
- 제안: 마지막 `expect(payload.llmCalls as unknown[]).toHaveLength(3)` 이후에 `expect(payload.durationMs).toBe(120)` 추가.

---

**[WARNING] `_resumeState`의 필수 필드 불일치 — 두 번째 테스트**
- 위치: `execution-engine.service.spec.ts` — `makeAiAgentHandler` 반환값 두 번째 인스턴스
- 상세: 첫 번째 테스트의 `_resumeState`는 `model`, `totalInputTokens`, `totalOutputTokens`를 포함하지만 두 번째 테스트는 이 세 필드가 없다. 서비스가 이 필드를 읽어 직렬화할 경우 `undefined` 누출 또는 타입 에러가 발생할 수 있다.
- 제안: 두 번째 `_resumeState`에도 `model: 'test-model', totalInputTokens: 0, totalOutputTokens: 0` 추가.

---

**[INFO] 프로덕션 모드에서 `console.warn` 비발생 테스트 없음**
- 위치: `use-execution-events.ts:329` / 테스트 파일
- 상세: `process.env.NODE_ENV !== 'production'` 분기가 존재하지만 프로덕션 환경에서 warn이 억제되는지 테스트하지 않는다. 브랜치 커버리지 관점에서 갭이다.
- 제안: `vi.stubEnv('NODE_ENV', 'production')` 패턴으로 프로덕션 모드 케이스를 선택적으로 추가.

---

**[INFO] `turnDebugHistory` 비어 있을 때(`llmCalls` 없음) 경로 미테스트**
- 위치: `execution-engine.service.spec.ts`
- 상세: 두 테스트 모두 `turnDebugHistory`에 항목이 있는 경우만 다룬다. 첫 턴(빈 히스토리) 또는 디버그 없이 반환되는 경우의 emit 형태를 검증하지 않는다.
- 제안: `turnDebugHistory: []`인 핸들러로 `payload.llmCalls`가 `undefined` 또는 `[]`가 되는지 확인하는 케이스 추가.

---

### 요약

프론트엔드 측 변경은 레거시 폴백 제거와 그에 맞는 테스트 의도 명확화가 잘 이뤄졌으나, 빈 배열 케이스 미테스트와 `console.warn` 호출 미검증이라는 두 가지 커버리지 갭이 남는다. 백엔드 spec 파일의 가장 큰 문제는 **동일한 describe 블록의 중복**으로, 이는 단순 노이즈를 넘어 CI 리포트 신뢰도를 저하시키므로 우선 처리가 필요하다. 두 번째 테스트의 `_resumeState` 필드 불일치와 `durationMs` 검증 누락은 실제 회귀를 놓칠 수 있는 약한 어서션 지점이다.

### 위험도
**MEDIUM** (중복 describe 블록 제거 후 LOW로 낮아질 수 있음)