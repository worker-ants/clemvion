# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] applySingleTurnMemoryInjection 반환 타입 미명시
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `applySingleTurnMemoryInjection` 메서드 시그니처
- 상세: `private async applySingleTurnMemoryInjection(args: {...})` 의 반환 타입이 JSDoc 에도, TypeScript 시그니처에도 명시되어 있지 않다. 반환값은 `{ messages, finalSystemPrompt, memoryMeta, singleTurnInjection }` 4개 필드를 포함하는 객체이며, 호출측(`executeSingleTurn`)이 destructure 해 사용한다. 나머지 두 메서드(`buildSingleTurnSystemPrompt: string`, `buildSingleTurnMessages: ChatMessage[]`)는 반환 타입이 명시되어 있으나 이 메서드만 누락. TypeScript 는 추론으로 동작하지만 JSDoc 가이드 역할과 IDE 탐색성이 저하된다.
- 제안: 반환 타입을 인라인 객체 타입 또는 named interface(`SingleTurnMemoryInjectionResult`)로 명시적 선언.

### [INFO] applySingleTurnMemoryInjection 내 인라인 주석 손실
- 위치: `applySingleTurnMemoryInjection` 내부 `singleTurnInjection = { ...singleTurnInjection, injection: { ...singleTurnInjection.injection, appliedScope: 'none' } }` 블록
- 상세: 구 구현에서는 해당 라인 위에 `// 자동 전략은 contextScope 계열 무효 — contextInjection meta 미echo.` 주석이 있었다. 리팩토링 후 이 주석이 삭제됐다. 메서드 JSDoc 에 "자동 전략은 contextInjection meta 미echo" 설명이 포함되어 있어 완전한 손실은 아니나, 메서드 본문만 빠르게 읽는 독자가 `appliedScope: 'none'` 강제 설정의 근거를 즉시 파악하기 어렵다.
- 제안: 해당 라인 위에 `// 자동 전략은 contextScope 계열 무효 — contextInjection meta 미echo (spec §5).` 한 줄 복원.

### [INFO] buildSingleTurnMessages 내 ConversationThread push 인라인 주석 제거
- 위치: `buildSingleTurnMessages` 내부 `this.pushAiThreadTurn(...)` 호출부
- 상세: 구 구현에는 push 호출 바로 위에 `// ConversationThread push (spec §2.2 — single-turn ai_user, 1회).` 주석이 있었다. 신규 구현에서 이 인라인 주석이 제거되어 메서드 JSDoc 에만 흡수되었다. `executeSingleTurn` 내 다른 push 호출 사이트에는 인라인 주석이 유지되어 있어 일관성이 다소 떨어진다.
- 제안: `this.pushAiThreadTurn(...)` 호출 위에 `// ConversationThread push (spec §2.2 — single-turn ai_user, 단계 1.7).` 복원.

### [INFO] spec 단계 번호와 실행 순서 역전에 대한 주석 안내 부재
- 위치: `executeSingleTurn` 내 `applySingleTurnMemoryInjection` 호출부 인라인 주석
- 상세: `applySingleTurnMemoryInjection` 는 spec §6.1 기준 "단계 1.3" 으로 명기되어 있으나, 실제 코드 실행 순서는 `buildSingleTurnSystemPrompt(0.5)` → `buildSingleTurnMessages(1.5·1.7)` → `applySingleTurnMemoryInjection(1.3·[5])` 이다. 즉 단계 번호 `1.3` 이 `1.5` 보다 나중에 실행되는 역전 현상이 주석에 그대로 드러난다. 이는 spec 단계 구조상 메모리 주입이 messages 빌드 후에 일어나기 때문이지만, 코드 독자가 단계 번호만 보고 실행 순서를 잘못 추론할 여지가 있다.
- 제안: `applySingleTurnMemoryInjection` JSDoc 또는 caller 인라인 주석에 "단계 번호는 spec §6.1 기준이며 실행 순서는 buildSingleTurnMessages(1.5) 후 본 메서드(1.3) 순" 같은 단서를 추가해 혼동 방지.

### [INFO] review 산출물 파일들 EOF 개행 누락
- 위치: `review/consistency/2026/06/24/23_43_01/SUMMARY.md`, `_retry_state.json`, `meta.json`, `naming_collision.md`, `rationale_continuity.md`, `cross_spec.md`
- 상세: diff 상 `\ No newline at end of file` 표시가 있는 파일들이 다수 존재한다. 산출물 파일 자체의 문서화 품질보다는 파일 생성 도구의 이슈이나, diff 가독성과 일부 마크다운 파서 호환성에 영향을 줄 수 있다.
- 제안: 산출물 생성 스크립트에서 파일 말미 개행 문자를 보장하도록 조치.

---

## 요약

이번 변경은 `AiTurnExecutor.executeSingleTurn` 의 setup 단계를 3개 private 메서드(`buildSingleTurnSystemPrompt`, `buildSingleTurnMessages`, `applySingleTurnMemoryInjection`)로 분해하는 behavior-preserving 리팩토링이다. 각 신규 메서드에 spec §6.1 단계 번호를 명기한 JSDoc 가 추가되어 spec 추적성은 전반적으로 양호하다. 공개 인터페이스·API·환경변수·설정 변경이 없으므로 README·API 문서·CHANGELOG 업데이트 의무는 발생하지 않는다. 주요 문서화 갭은 (1) `applySingleTurnMemoryInjection` 반환 타입 미명시, (2) 메서드 추출 과정에서 일부 인라인 맥락 주석이 JSDoc 에 흡수되거나 삭제된 것, (3) spec 단계 번호와 실제 실행 순서의 역전 현상에 대한 안내 부재로 한정된다. 모두 INFO 수준이며 동작 정확성에는 영향이 없다.

---

## 위험도

LOW
