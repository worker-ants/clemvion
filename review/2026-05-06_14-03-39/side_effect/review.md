충분히 파악했습니다. 이제 리뷰를 작성하겠습니다.

---

## Side Effect Code Review — AI Agent Handler

### 발견사항

---

**[WARNING] 멀티턴에서 `conditionToolCalls`가 `toolCallCount`를 증가시켜 `maxToolCalls` 한도를 조기 소진**
- 위치: `handler.ts:957–967` (`processMultiTurnMessageInner`) vs `handler.ts:570–579` (`executeSingleTurn`)
- 상세: `executeSingleTurn`의 condition tool 처리 블록에는 `// does not count toward toolCallCount` 주석과 함께 카운트를 올리지 않는다. 그러나 `processMultiTurnMessageInner`에서는 동일한 condition 도구 처리 블록이 `toolCallCount++`를 실행한다. 결과적으로 `maxToolCalls: 5`를 설정한 사용자가 멀티턴에서 condition이 중간에 호출될 경우, 실제 도구 호출 없이도 카운트가 소모된다. plan 문서의 WARN #20(`toolCallCount` 정책 비대칭)이 이 지점을 가리키고 있으나, 지금 상태에서도 호출자에게 보이는 `meta.toolCalls` 값이 단일턴/멀티턴 간에 다르게 계산된다.
- 제안: `executeSingleTurn`과 `processMultiTurnMessageInner`의 condition 도구 처리 정책을 통일. 제거를 원하면 멀티턴에서도 `toolCallCount++` 제거; 유지를 원하면 단일턴에도 추가하고 주석 수정.

---

**[WARNING] 멀티턴 tool loop에서 실제 LLM 호출 인자(`tools`)와 기록 페이로드(`toolsDef`)가 불일치**
- 위치: `handler.ts:981–999` (`processMultiTurnMessageInner` 내부 while 루프)
- 상세: 첫 LLM 호출(`chatParams`)은 `toolsDef = tools.length > 0 ? tools : undefined`로 empty array를 `undefined`로 정규화한다. 그러나 루프 내 재호출(`llmService.chat`)에는 `tools`(raw array)를 넘기고, `loopReq` 로그 객체에는 `toolsDef`를 담는다. LLM 클라이언트가 `tools: []`와 `tools: undefined`를 다르게 처리하면 루프 이터레이션부터 도구 없는 응답이 달라질 수 있고, 디버그 로그는 실제와 다른 값(`undefined`)을 기록하게 된다.
  ```ts
  // loopReq (debug log) — toolsDef: undefined (비어있을 때)
  const loopReq = { ..., tools: toolsDef };
  // 실제 API 호출 — tools: [] (raw array)
  result = await this.llmService.chat(llmConfig, { ..., tools });
  ```
- 제안: 루프 호출도 `toolsDef`로 통일:
  ```ts
  result = await this.llmService.chat(llmConfig, { ..., tools: toolsDef });
  ```

---

**[INFO] 단일턴 tool loop도 동일하게 `tools`를 raw array로 전달 (첫 호출과 불일치)**
- 위치: `handler.ts:594–618` (`executeSingleTurn` while 루프)
- 상세: 첫 LLM 호출은 `tools: tools.length > 0 ? tools : undefined`이지만 루프 재호출은 `tools` 그대로 넘긴다. `loopRequest`에도 `tools`(raw)를 기록한다. 멀티턴 WARNING과 동일 패턴의 약한 형태 — 단일턴은 디버그 로그도 같은 raw 값을 쓰므로 로그 불일치는 없으나, 첫 호출과 루프 호출의 동작이 달라질 수 있다.
- 제안: 루프 호출도 `tools.length > 0 ? tools : undefined`로 일치.

---

**[INFO] `_resumeState: { ...state }` 스프레드로 미확인 필드가 다음 턴 state에 암묵 전파**
- 위치: `handler.ts:1052–1068` (`processMultiTurnMessageInner` 반환부)
- 상세: `{ ...state, messages, turnCount, ... }` 패턴은 이전 state의 모든 알 수 없는 키를 다음 턴 `_resumeState`로 그대로 내려보낸다. 외부에서 잘못된 키를 주입하거나 과거 버전의 state 구조가 남아 있어도 누적·전파된다. plan 문서 WARN #11이 이를 명시하고 있으며 추후 재작성 대상.
- 제안: 중·단기 safety net으로 `_resumeState`에 허용된 키 목록을 명시적으로 열거하거나, `MultiTurnState` 인터페이스 타입으로 강제.

---

**[INFO] 테스트에서 `process.env.NODE_ENV` 공유 상태 변경**
- 위치: `handler.spec.ts:550–561`
- 상세: `process.env.NODE_ENV = 'production'`으로 전역 환경 변수를 변경한 뒤 `finally`로 복원한다. Jest는 기본적으로 동일 파일 내 테스트를 순차 실행하므로 일반적으로 안전하지만, `--runInBand` 없는 병렬 worker 환경이나 향후 테스트 순서 변경 시 다른 테스트에 보이는 환경을 오염시킬 수 있다.
- 제안: `jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' })` 또는 `adaptHandlerReturn`에 NODE_ENV 의존 로직이 있다면 직접 파라미터로 추출해 테스트.

---

### 요약

이번 변경에서 식별된 실제 side effect 위험은 두 가지다. **멀티턴 condition 도구의 `toolCallCount` 비대칭**(단일턴은 카운트 안 함, 멀티턴은 카운트 함)은 `maxToolCalls`를 조기 소진해 사용자가 설정한 한도를 예상보다 빠르게 소모하는 관찰 가능한 동작 차이를 유발한다. **멀티턴 tool loop의 실제 LLM 호출이 `tools: []`를 전달**하는 반면 디버그 로그는 `undefined`를 기록하는 불일치는 LLM 클라이언트의 구현에 따라 도구 목록 없는 재호출의 동작이 달라질 수 있으며, 디버그 페이로드 신뢰도도 떨어뜨린다. 나머지(`_resumeState` 스프레드, 단일턴 루프 불일치, 테스트 환경 변수 변경)는 plan 문서에 인지된 backlog 항목이거나 현재 환경에서 영향이 낮은 INFO 수준이다.

### 위험도

**MEDIUM**