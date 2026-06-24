# 성능(Performance) 리뷰

## 발견사항

### INFO: `buildSingleTurnSystemPrompt` 내 `new Date()` 매번 생성
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `buildSingleTurnSystemPrompt` 내 `buildSystemContextPrefixFromContext({ ..., now: new Date() })`
- 상세: 메서드 추출 전후 모두 동일한 패턴이며, 이 변경이 도입한 문제는 아니다. 그러나 `executeSingleTurn` 단일 호출 경로에서 `new Date()`가 `buildSingleTurnSystemPrompt` 내부에서 생성되고, 이후 `llmCalls`에서 `Date.now()`가 별도 호출된다. 단일 턴 내 타임스탬프 기준이 미미하게 분산되는 구조다. 실제 성능 영향은 무시할 수 있는 수준이나, 타임스탬프를 `executeSingleTurn` 진입부에서 한 번 생성해 공유하면 일관성이 향상된다.
- 제안: 필수 수정 아님. 향후 타임스탬프 통일이 필요하면 `singleTurnStartedAt`(이미 존재)을 활용하거나 `now`를 caller에서 주입하는 방식을 고려한다.

### INFO: `applySingleTurnMemoryInjection` 의 args 객체 할당 — 호출 경로 추가
- 위치: `executeSingleTurn` 내 `this.applySingleTurnMemoryInjection({ ... })` 호출부
- 상세: 메서드 추출로 인해 `messages`, `finalSystemPrompt` 등 이미 존재하는 값들이 새 plain object(`args`)로 한 번 더 래핑된다. 메서드 내부에서는 `let { messages, finalSystemPrompt } = args`로 다시 분해된 뒤 재할당되어 호출자가 `memInjection.messages`, `memInjection.finalSystemPrompt`를 다시 꺼내 쓴다. 중간 객체 2개(`args`, 반환 객체)가 추가 생성된다. 단일 실행당 수 KB 미만의 단명 객체이며 GC 부담은 무시할 수 있는 수준이다. 핫패스(LLM network I/O) 대비 비율이 0에 가깝다.
- 제안: 현재 코드 유지 적합. 추가 성능 개선이 필요한 시점에 args 객체를 destructured parameter 시그니처로 전환하는 정도가 최대 개선치다.

### INFO: `capFormDataBytes` 내 `JSON.stringify` 이중 호출
- 위치: `capFormDataBytes` 함수 — `originalBytes` 계산 후 최종 `bytesAfterCap` 계산 시 `JSON.stringify(capped)` 재호출
- 상세: 이 변경 PR이 도입한 코드가 아니나, 전체 파일 컨텍스트로 포함되어 있어 기록한다. `formData`가 클 경우 직렬화가 최대 3회(`originalBytes`, `nonStringBytes`, `bytesAfterCap`) 수행된다. 실제 form data는 10KB cap이 존재하므로 직렬화 비용은 제한적이다.
- 제안: 기존 코드 유지 적합. 성능 임계에 도달하면 streaming byte count 방식으로 전환 가능하나 현재는 불필요.

---

## 요약

이번 변경은 `executeSingleTurn` 내 setup 단계를 3개의 private 메서드(`buildSingleTurnSystemPrompt`, `buildSingleTurnMessages`, `applySingleTurnMemoryInjection`)로 behavior-preserving 추출한 순수 리팩토링이다. 알고리즘 복잡도·N+1 호출·캐싱 전략·블로킹 I/O 패턴은 변경 전후 완전히 동일하다. 추가된 중간 객체 할당(args wrapper, 반환 객체)은 LLM 네트워크 왕복 비용 대비 무시 가능한 수준이며, 실측 가능한 성능 퇴행은 없다. `applySingleTurnMemoryInjection`이 비동기 메모리 주입을 수행하는 구간은 원래부터 `await` 경로였으며 추출 후에도 동일한 단일 await 지점을 유지한다. 발견된 INFO 3건은 모두 기존 코드에서 비롯된 사소한 관찰이며, 이번 PR이 새로 도입한 성능 위험 요소는 없다.

## 위험도

NONE
