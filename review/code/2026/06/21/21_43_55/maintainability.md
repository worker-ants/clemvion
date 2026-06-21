# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 테스트 픽스처 팩토리 함수의 타입 캐스팅 반복
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` 라인 168–170, 183–184, 213–214, 292–295, 317
- 상세: `agentMemFake()` 의 반환값을 `as unknown as { scheduleExtraction: jest.Mock }`, `as unknown as { recall: jest.Mock }`, `as unknown as { resolveScopeKey: jest.Mock; recall: jest.Mock }` 로 각 어서션 직전에 반복해서 캐스팅한다. 동일 패턴이 5곳 이상 반복되어 향후 `agentMemFake` 시그니처 변경 시 캐스팅 교체 누락이 발생할 수 있다.
- 제안: `agentMemFake` 반환 타입을 `jest.Mock` 필드가 포함된 전용 타입 별칭으로 좁히거나, `const am = agentMem as unknown as AgentMemFake` 형태의 지역 변수를 테스트 블록 최상단에서 한 번만 선언하는 패턴으로 통일. `#665 AiConditionEvaluator` 선례에서 같은 방식을 썼다면 일관성 유지가 우선이므로 INFO 수준 유지.

### [INFO] `threadFake` 의 `fullTurns` 파라미터 명명이 역할을 완전히 설명하지 않음
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` 라인 82–86
- 상세: `threadFake(turns, fullTurns)` 에서 첫 번째 파라미터 `turns` 는 `getThreadExcludingNode` 반환값, 두 번째 `fullTurns` 는 `getThread` 의 `{ turns }` 반환값이다. 함수 시그니처만 보면 두 파라미터의 용도 차이를 알기 어렵다.
- 제안: 파라미터명을 `excludingNodeTurns`·`fullThreadTurns` 로 변경하거나, 두 번째 파라미터에 JSDoc 주석 한 줄 추가. 호출부(`threadFake([], turns)` 패턴)도 같이 업데이트 필요.

### [INFO] `baseSched` 내 `target` 의 인라인 캐스팅이 빈 turns 를 고정
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` 라인 121
- 상세: `target: { conversationThread: { turns: [] } } as SchedArgs['target']` 로 default를 정의하면 `scheduleMemoryExtraction` 의 `persistent + 신규 turn` 테스트(라인 195–215)에서 `over` 로 전달할 때 `baseSched({ ..., lastExtractionTurnSeq: undefined })` 형태가 되고, `threadFake([], turns)` 가 `turns` 를 `getThread` 로 반환한다. `target` 과 `threadFake` 가 별도로 제어되어 데이터 흐름이 이중으로 존재한다. 현재는 올바르게 동작하지만, 누군가 `baseSched` 의 `target.turns` 를 바꾸면 테스트 의도와 실제 동작이 어긋날 여지가 있다.
- 제안: 테스트 주석으로 "target.turns 는 baseSched 픽스처에서 무시됨 — 실제 turns 는 threadFake 에서 주입" 을 명시해 읽는 이가 혼동하지 않게 한다.

### [INFO] `ai-memory-manager.ts` 의 섹션 구분 주석 스타일이 부분적으로 상이
- 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 라인 262
- 상세: 신규 추가된 섹션 주석 `// ── [keepUserExchanges 도출] multi-turn 누적 messages 물리 압축 경계 ──` 는 기존 `// ── [5a] persistent 회수 (LLM 호출 전 동기) ──` 스타일과 거의 동일하나, 기존 주석은 `// ──` + 공백 없이 바로 `[번호]` 가 오는 반면 신규 주석은 `[번호]` 없이 제목만 온다. 직전 리뷰(SUMMARY.md)에서 제안한 `// ── [keepUserExchanges 도출] ──` 형태와도 한 줄짜리 vs 블록 주석 형태가 다르다.
- 제안: 현행 상태로 동작상 문제 없음. 향후 정리 시 `// ── [keepUserExchanges 도출] ──` 한 줄 헤더 뒤 블록 주석 패턴으로 통일 고려.

## 요약

이번 변경은 `ai-memory-manager.spec.ts` 신설(14개 테스트 케이스)과 `ai-memory-manager.ts` 의 이중 서비스 호출 목적 주석 추가로 구성된다. 유지보수성 관점에서 핵심 문제였던 "이중 서비스 호출 혼동 여지(이전 WARNING #5)"는 섹션 주석으로 명확히 해소되었다. 테스트 파일은 픽스처 팩토리 패턴(llmFake/threadFake/agentMemFake/baseInject/baseSched)을 일관되게 사용해 가독성이 높고, 각 케이스의 테스트명이 검증 의도를 충분히 서술한다. 발견된 사항은 모두 INFO 수준으로, 타입 캐스팅 반복·파라미터명 일부 불명확성·주석 스타일 미세 비일관성이며 모두 비차단이다. `injectMemoryContext` 205줄 단일 함수(이전 WARNING #4)는 이번 변경 범위 밖으로 이미 DEFER 결정됐으며, 이 리뷰에서 재평가할 새로운 근거는 없다. 전체적으로 behavior-preserving 추출의 회귀 격리 목적에 충실하고 코드베이스 스타일과 일관적이다.

## 위험도

NONE
