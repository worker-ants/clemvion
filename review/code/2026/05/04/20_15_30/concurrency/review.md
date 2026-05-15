### 발견사항

- **[INFO]** `llmCalls` 배열이 복사 없이 참조로 반환됨
  - 위치: `execution-engine.service.ts` — `buildAiMessageDebugFromResumeState` 함수 내 `result.llmCalls = llmCalls`
  - 상세: 함수가 `resumeState.turnDebugHistory[last].llmCalls` 배열을 **얕은 참조**로 반환한다. Node.js 단일 스레드 모델에서는 `emitExecutionEvent` 직전의 spread 연산과 JSON 직렬화가 동일 이벤트 루프 틱 안에서 완료되므로 실용적 위험은 낮다. 그러나 spec §6.2에 명시된 "5분 이벤트 재생 버퍼"에 페이로드가 JS 객체 형태(JSON 직렬화 전)로 저장될 경우, 이후 AI 턴이 동일 `llmCalls` 배열에 항목을 추가하면 버퍼된 페이로드의 내용이 소급 변경될 수 있다.
  - 제안: `result.llmCalls = [...llmCalls]` (shallow copy) 또는 직렬화 시점에 스냅샷을 보장하는 방식으로 변경. 버퍼 구현이 JSON.stringify 후 저장이라면 현재 코드로 충분하나, 그 전제를 명시적으로 확인할 것.

---

### 요약

변경된 코드는 순수 함수(side-effect 없음)로 동시성 관점의 위험이 매우 낮다. Node.js의 단일 스레드 이벤트 루프 덕분에 `turnDebugArray.length` 확인 후 인덱스 접근(`[turnDebugArray.length - 1]`)에서의 TOCTOU는 동기 호출 경로에서 발생하지 않는다. 유일한 주의 사항은 `llmCalls` 배열이 내부 `resumeState`와 참조를 공유한다는 점이며, 이는 spec에서 언급된 재생 버퍼의 저장 방식(JS 객체 vs. 직렬화 문자열)에 따라 실제 위험 여부가 결정된다.

### 위험도

LOW