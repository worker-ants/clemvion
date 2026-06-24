# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] buildSingleTurnMessages 내 ConversationThread ai_user push — 외부 상태 변경
- 위치: `buildSingleTurnMessages` 메서드, `pushAiThreadTurn` 호출부
- 상세: 메서드 이름이 `build*` 패턴이라 순수 값 생성(ChatMessage[] 반환)처럼 보이지만, 내부에서 `conversationThreadService.appendAiUserMessage`를 직접 호출해 외부 ConversationThread 영속 상태를 변경한다. 호출자 관점에서 `buildSingleTurnMessages`를 두 번 호출하면 `ai_user` turn이 중복 push된다. 현재 `executeSingleTurn`에서는 1회만 호출하므로 실제 회귀는 없지만, 메서드 시그니처가 숨긴 side-effect를 드러내지 않아 향후 재사용 시 중복 push 위험이 잠재한다.
- 제안: JSDoc에 "이 메서드는 호출 시 ConversationThread에 ai_user turn을 push하는 side-effect를 가진다" 명시. 또는 push를 caller(executeSingleTurn)로 올려 메서드를 순수 빌더로 유지하는 것을 고려.

### [INFO] applySingleTurnMemoryInjection — 입력 객체를 재바인딩하고 반환값으로만 갱신
- 위치: `applySingleTurnMemoryInjection` 반환 패턴, `executeSingleTurn`의 `messages = memInjection.messages; finalSystemPrompt = memInjection.finalSystemPrompt;`
- 상세: 메서드는 `args.messages`와 `args.finalSystemPrompt`를 내부에서 `let`으로 재바인딩한 후 반환 객체로 돌려준다. 호출자가 반환값을 명시적으로 반영하지 않으면 원본 변수는 변경되지 않는 불일치 상황이 발생한다. 현재 `executeSingleTurn` 구현은 올바르게 반영하고 있으나, 이 패턴은 호출자 실수로 인한 부작용 누락 가능성을 내포한다.
- 제안: 반환 타입을 명시적 named type으로 선언하거나, JSDoc에 "반환값의 messages/finalSystemPrompt로 caller 변수를 반드시 갱신해야 한다" 명기.

### [INFO] injectThreadContext 호출 — 자동 메모리 경로에서 결과가 부분 무시됨
- 위치: `applySingleTurnMemoryInjection` 내 `memoryStrategy !== 'manual'` 분기
- 상세: `memoryStrategy`가 `summary_buffer` 또는 `persistent`인 경우, `injectThreadContext`를 먼저 호출해 `singleTurnInjection` 결과를 얻지만, 그 `messages`/`finalSystemPrompt`는 이후 `memoryManager.injectMemoryContext` 결과로 덮어쓴다. `injectConversationContext`가 향후 write side-effect를 추가하면 자동 전략 경로에서 의도치 않은 이중 호출이 발생할 수 있다. 현재는 읽기 전용으로 보이므로 실질 문제는 없다.
- 제안: 자동 전략 경로에서 `injectThreadContext` 호출 목적(singleTurnInjection 메타 생성을 위한 것인지)을 JSDoc에 명기.

## 요약

이번 변경은 `executeSingleTurn`의 setup 단계를 3개의 private 메서드로 추출하는 behavior-preserving 리팩토링으로, 전역 변수 도입, 환경 변수 신규 접근, 네트워크 직접 호출, 파일시스템 변경, 공개 API 시그니처 변경은 전혀 없다. `executeSingleTurn`의 public 시그니처는 완전히 보존되며, 공유 accumulator(`ragAcc`, `mcpDiagnosticsAcc`, `presentationViolationCounters`)는 caller scope에 올바르게 유지된다. `buildSingleTurnMessages`가 이름과 달리 ConversationThread ai_user push라는 숨겨진 side-effect를 가지나, 이는 분해 전 코드에서도 동일 위치에서 발생하던 동작이므로 기존 행위 대비 새로운 부작용은 없다. 발견된 3건 모두 리팩토링 이전부터 존재하던 구조적 특성이며, 신규 도입된 위험은 없다.

## 위험도

LOW
