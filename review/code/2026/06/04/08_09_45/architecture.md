# Architecture Review

## 발견사항

### **[INFO]** 순수 함수 `compactMessagesToTail` 분리 — 아키텍처 관점 긍정
- 위치: `agent-memory-injection.ts` (+744)
- 상세: 메시지 물리 압축 로직을 `agent-memory-injection.ts` 의 순수 함수로 분리해 단일 책임 원칙(SRP)을 잘 지켰다. 함수는 외부 상태에 의존하지 않고, 입력 배열이 압축 불필요 조건을 만족하면 동일 참조를 반환해 불변성(immutability)을 보장한다. `ai-agent.handler.ts` 는 이 함수를 호출만 하며 압축 알고리즘 세부를 알 필요가 없다.
- 제안: 유지. 향후 압축 전략이 변경돼도 핸들러를 건드리지 않고 이 함수만 수정하면 된다.

### **[INFO]** `injectMemoryContext` 반환 타입에 `keepUserExchanges` 추가 — 응집도 우수
- 위치: `ai-agent.handler.ts` (+836~+842, +2190)
- 상세: `keepUserExchanges` 를 `injectMemoryContext` 의 반환 값으로 포함시켜 계산 로직을 한 곳에 모았다. 핸들러의 멀티턴 호출 지점에서 별도 계산 없이 반환값을 바로 사용하므로 응집도가 높다.
- 제안: 유지.

### **[WARNING]** `injectMemoryContext` 내부에서 `conversationThreadService.getThread` 를 추가 호출 — 레이어 내 중복 쿼리
- 위치: `ai-agent.handler.ts` (+2259~+2306) — `getThreadExcludingNode` 와 별도로 `getThread(fullThread)` 를 한 번 더 호출
- 상세: `keepUserExchanges` 도출을 위해 `self 포함 전체 thread` 가 필요해 `getThread` 를 추가 호출하고 있다. 같은 메서드 내에서 동일 `ConversationThreadService` 를 두 번 쿼리하는 구조는 서비스 레이어 접근 횟수를 증가시키고, 향후 서비스가 I/O-backed 로 변경될 경우 성능 회귀 위험이 있다. 현재는 in-memory 이므로 기능적 문제는 없다.
- 제안: `getThreadExcludingNode` 가 전체 thread 도 함께 반환하거나, 호출부에서 한 번 `getThread` 를 호출하고 필터링을 인자로 처리하는 방식을 검토할 것. 단기적으로는 현재 구조도 허용 가능.

### **[INFO]** `thread as { runningSummary?: string; summarizedUpToSeq?: number }` 타입 단언 뮤테이션 — 캡슐화 경계 약화
- 위치: `ai-agent.handler.ts` 기존 코드 (2263~2270)
- 상세: 이번 변경에서 직접 수정된 부분은 아니나, `injectMemoryContext` 내 `thread` 객체를 mutable 타입으로 단언해 직접 뮤테이션하는 패턴이 유지되고 있다. 이는 `ConversationThread` 의 불변 계약을 우회한다. 새로 추가된 `keepUserExchanges` 계산이 `update.summarizedUpToSeq` (뮤테이션 직후 값)를 참조하므로 실행 순서에 의존적이다.
- 제안: `ConversationThreadService` 에 `updateSummaryState(target, summary, upToSeq)` 메서드를 추가해 서비스 레이어를 통한 단일 변이 경로를 확보할 것을 중장기 로드맵으로 고려.

### **[INFO]** 물리 압축 로직이 `summarized=true` 조건에만 트리거 — 개방-폐쇄 원칙 관점
- 위치: `ai-agent.handler.ts` (+2323)
- 상세: `mem.memory.summarized && mem.keepUserExchanges > 0` 조건으로 물리 압축을 요약 발생 시에만 수행한다. 압축 트리거 조건이 핸들러 본체에 하드코딩되어 있다. 현재 요구사항에는 적합하지만, 향후 "요약 없이도 일정 주기로 압축"과 같은 전략 변경 시 조건 로직이 핸들러 코드를 직접 수정해야 한다.
- 제안: 현재 규모에서는 수용 가능. 압축 전략이 다양해질 경우 Strategy 패턴 도입을 고려.

### **[INFO]** `assertPairingIntact` 헬퍼의 두 번째 `for` 루프가 빈 바디 — 불완전한 검증
- 위치: `agent-memory-injection.spec.ts` (+77~+83)
- 상세: `for (const m of messages.slice(1))` 루프 내 `if (m.role === 'tool')` 바디가 비어있고 `void openToolIds` 로 죽은 변수를 소비한다. 이 경로는 실제로 아무런 assertion 을 수행하지 않아 검증 의도가 불완전하다. 주석으로 "위 루프에서 이미 강제"라고 설명하지만, 코드가 존재하는 한 읽는 사람이 의도를 오해할 수 있다.
- 제안: 빈 루프와 `void openToolIds` 를 제거하거나, 실제 assertion 을 채워 넣어 헬퍼의 계약을 명확히 할 것.

### **[INFO]** `ai-agent.memory.spec.ts` 에 물리 압축 테스트 중복 — 단일 책임 원칙 관점
- 위치: `ai-agent.memory.spec.ts` (+2577~+2742)
- 상세: 물리 압축의 순수 로직(`compactMessagesToTail`)은 `agent-memory-injection.spec.ts` 에서 단위 테스트로 충분히 검증한다. `ai-agent.memory.spec.ts` 의 새 테스트는 동일 케이스를 핸들러 통합 레벨에서 재검증한다. 이는 통합 테스트로서 정당하다. 다만 두 파일에 같은 시나리오("summary 발생 → messages 물리 축소")가 거의 동일한 형태로 존재하므로, 차후 압축 알고리즘 변경 시 두 곳을 함께 수정해야 한다.
- 제안: 통합 테스트는 "핸들러 배선이 올바르게 동작하는가"에만 집중하고, 구체적인 압축 경계/페어링 불변식 검증은 단위 테스트(`agent-memory-injection.spec.ts`)로 위임하는 방향으로 정리를 고려.

### **[INFO]** `spec §6.2 d.6` 및 `§12.14` spec-impl 동기화 완료 — 모듈 경계 명확
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md`, `plan/in-progress/ai-context-memory-followup-v2.md`
- 상세: spec 변경과 구현이 같은 커밋에 포함되어 있고, plan 항목의 완료 체크도 함께 갱신됐다. SDD 규약 준수.
- 제안: 유지.

---

## 요약

이번 변경은 `compactMessagesToTail` 순수 함수를 `agent-memory-injection.ts` 에 분리하고, 핸들러에서 요약 발생 시에만 이를 호출하는 배선을 추가한 구조로, SOLID 원칙 중 SRP(단일 책임)와 DIP(의존 역전) 측면에서 양호한 설계를 보인다. 순수 함수는 외부 상태 의존 없이 idempotent 하게 동작하며, 핸들러 레이어는 압축 알고리즘 세부를 알 필요 없이 결과를 받아 사용한다. 주요 구조적 우려는 `injectMemoryContext` 내부에서 `conversationThreadService` 를 두 번 쿼리하는 점(현재는 in-memory 이므로 무해하나 향후 I/O-backed 전환 시 회귀 위험)과, `ConversationThread` 객체를 타입 단언으로 직접 뮤테이션하는 기존 패턴이 `keepUserExchanges` 계산 순서와 암묵적 의존을 만든다는 점이다. 이 두 항목은 중장기 리팩터링 대상으로 관리하는 것이 적절하다. 테스트의 `assertPairingIntact` 내 빈 루프는 즉시 정리가 권장된다.

## 위험도

LOW
