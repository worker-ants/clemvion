충분한 컨텍스트를 확보했습니다. 리뷰를 작성합니다.

---

### 발견사항

---

**[CRITICAL] `executeSync()` — 완전 미테스트**
- 위치: `execution-engine.service.ts` L779–871
- 상세: `executeSync`는 Sub-Workflow 노드가 동기 실행에 사용하는 **public** 메서드이며 고유한 로직(timeout Race, 실패/취소 상태 전파, sub-execution 레코드 생성)을 포함하지만 단 하나의 테스트 케이스도 없습니다.
- 제안:
  ```
  describe('executeSync()', () => {
    it('throws when sub-workflow not found');
    it('throws when sub-execution finishes with FAILED status');
    it('throws when sub-execution is CANCELLED');
    it('throws with timeout error when timeoutMs is exceeded');
    it('does not apply timeout when timeoutMs is 0');
  });
  ```

---

**[CRITICAL] `executeAsync()` — 완전 미테스트**
- 위치: `execution-engine.service.ts` L877–909
- 상세: `executeAsync`도 sub-workflow 노드가 비동기 실행에 사용하는 **public** 메서드이나 테스트가 전혀 없습니다.
- 제안: `executeSync`와 유사한 커버리지 필요. 특히 workflow-not-found 경로와 fire-and-forget 실패 로깅 경로.

---

**[WARNING] `rawConfig` — `executeInline` 경로 미검증**
- 위치: `execution-engine.service.spec.ts`, `ENG-RC-*` describe 블록 (L1344)
- 상세: `ENG-RC-*` 테스트는 `execute()`→`runExecution()` 경로만 검증합니다. `executeInline()`도 동일하게 `executeNode()`를 호출하므로 `rawConfig`가 주입되어야 하지만, inline 경로에서 `rawConfig`가 올바르게 노출되는지는 테스트가 없습니다. 특히 sub-workflow를 사용하는 경우 경로가 다릅니다.
- 제안: `executeInline` describe 블록에 `rawConfig` 검증 케이스 추가. 기존 `executeInline` 테스트에서 `captureSpy` 패턴을 재사용하면 됩니다.

---

**[WARNING] `rawConfig` freeze — 중첩 객체 불변성 미검증**
- 위치: `execution-engine.service.spec.ts` L1443, `execution-engine.service.ts` L2327
- 상세: 엔진은 `Object.freeze({ ...(node.config ?? {}) })`를 사용해 shallow freeze합니다. 현재 테스트는 최상위 필드 mutation만 검증합니다. `config: { nested: { key: 'value' } }` 형태의 중첩 config에서 `ctx.rawConfig.nested.key = 'hacked'`는 오류 없이 성공합니다. 인터페이스 선언(`Readonly<Record<string, unknown>>`)도 shallow만 보장하며 JSDoc에 이 제한이 언급되지 않았습니다.
- 제안: 테스트에 nested mutation이 방어되지 않음을 명시하는 케이스를 추가하거나(`INFO`로 문서화), 또는 `structuredClone` 후 deep freeze를 사용하는 방향을 검토. 최소한 `node-handler.interface.ts`의 `rawConfig` JSDoc에 "shallow freeze only" 경고 추가를 권장합니다.

---

**[WARNING] `endAiConversation()` / `ai_end_conversation` 종료 경로 미테스트**
- 위치: `execution-engine.service.ts` L1559–1566, 그리고 `waitForAiConversation` 내부의 `ai_end_conversation` 처리 분기
- 상세: `endAiConversation()` 호출 후 `endMultiTurnConversation()` 핸들러가 불리고 대화가 `ended` port로 종료되는 전체 흐름에 대한 테스트가 없습니다. 현재 AI Agent 테스트는 모두 `waiting_for_input` 재진입 흐름만 커버합니다.
- 제안:
  ```
  it('ends AI conversation via endAiConversation() and calls endMultiTurnConversation');
  it('emits EXECUTION_COMPLETED after AI conversation ends naturally');
  ```

---

**[WARNING] `buildConversationConfigFromOutput()` 미테스트**
- 위치: `execution-engine.service.ts` L217–254
- 상세: `buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`는 전용 단위 테스트가 있지만, 동일하게 export된 `buildConversationConfigFromOutput`은 테스트 없음. 이 함수는 system 메시지 필터링, `partial` 필드 선택적 전파 등 비자명한 로직을 포함합니다.
- 제안:
  ```
  describe('buildConversationConfigFromOutput', () => {
    it('filters system messages from messages array');
    it('includes maxTurns only when defined');
    it('propagates partial.extracted when present');
    it('returns safe defaults for empty input');
  });
  ```

---

**[WARNING] `recoverStuckExecutions()` 미테스트**
- 위치: `execution-engine.service.ts` L337–359
- 상세: 서버 재시작 시 `WAITING_FOR_INPUT` 상태의 execution을 `FAILED`로 전환하는 복구 로직이 테스트되지 않았습니다. `onModuleInit`에서 호출되므로 통합 테스트 환경에서도 검증 가능합니다.
- 제안: `find` mock이 `WAITING_FOR_INPUT` execution을 반환하는 시나리오에서 `FAILED` 상태와 에러 메시지가 올바르게 저장되는지 확인하는 테스트.

---

**[WARNING] 타이밍 의존 테스트 — `flushPromises` 미사용**
- 위치: `execution-engine.service.spec.ts` L2529, L2661
- 상세: Container runtime 테스트 두 곳에서 `await new Promise((r) => setTimeout(r, 200))`를 사용합니다. 나머지 테스트가 `flushPromises()`를 일관되게 사용하는 것과 대조적입니다. 느린 CI 환경에서 200ms가 충분하지 않을 수 있습니다.
- 제안: `flushPromises()`로 교체. 비동기 체인을 마이크로태스크 단위로 소진하므로 더 결정론적입니다.

---

**[INFO] `continueAiConversation` 메시지 길이 경계값 테스트 부재**
- 위치: `execution-engine.service.spec.ts` L914
- 상세: `x`.repeat(10_001)이 reject되는 것만 확인. 정확히 10_000자인 메시지가 통과하는지 경계값 테스트 없음.
- 제안: `'x'.repeat(10_000)` 입력이 정상 처리되는 케이스 추가.

---

**[INFO] `mockHandler.execute` — 비규격 반환값**
- 위치: `execution-engine.service.spec.ts` L125
- 상세: 기본 mock handler가 `{ processed: true, input }` 를 반환하는데 이는 `NodeHandlerOutput`의 `config`/`output` 필드가 없는 레거시 flat shape입니다. 엔진이 `adaptHandlerReturn()`으로 정규화하므로 동작은 하지만, 만약 `adaptHandlerReturn` 내부 동작이 바뀌면 다수의 테스트가 예상치 못하게 실패할 수 있습니다.
- 제안: 기본 mock handler를 규격 shape으로 교체 고려: `{ config: {}, output: { processed: true }, status: undefined }`.

---

**[INFO] Private 접근자 패턴 — 구현 내부 결합**
- 위치: `execution-engine.service.spec.ts` L1239, 1307, 1735, 1855
- 상세: `(service as any)['contextService']`, `service['configService']` 형태로 private 멤버에 직접 접근합니다. 리팩토링 시 테스트가 함께 깨질 위험이 있습니다.
- 제안: `configService.get` 조작은 module 생성 시 provider를 교체하거나, 테스트 전용 setter를 활용하는 방향 검토.

---

### 요약

테스트 스위트는 전반적으로 수준 높습니다 — WebSocket 이벤트, 폼/AI 블로킹 흐름, 백엣지 순환, `rawConfig` 노출, 컨테이너 런타임, 헬퍼 유틸 단위 테스트까지 광범위하게 커버합니다. 그러나 **`executeSync()`와 `executeAsync()`가 완전히 미테스트 상태**입니다. 이 두 메서드는 Sub-Workflow 핸들러가 직접 호출하는 public API로, timeout·상태 전파·에러 처리 등 고유 로직을 포함하므로 다른 경로 테스트로 대체되지 않습니다. 추가로 `rawConfig`의 `executeInline` 경로 미검증, shallow freeze의 한계, AI 대화 종료 경로 누락도 위험 요소입니다.

### 위험도

**HIGH**