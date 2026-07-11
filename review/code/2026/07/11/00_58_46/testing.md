## 발견사항

- **[INFO]** 신규 테스트가 2번째(재시도) chat 만 단언하고 1번째 chat 의 llmContext 는 재확인하지 않음
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts:1026-1067` (`collection-retry loop passes attribution (llmContext) to the 2nd retry chat too`)
  - 상세: 1번째 chat 의 attribution 은 같은 `describe('processMultiTurnMessage')` 블록의 `resume turn passes row PK nodeExecutionId + workflowId ...` (L921-951) 가 이미 커버하고, `runTurnWithCollectionRetries` 는 루프 밖에서 만든 동일 `params.llmContext` 참조를 매 iteration 그대로 넘기므로 (`information-extractor.handler.ts:1019-1038`) 1번째 호출만 검증된 상태에서 2번째만 별도 검증하는 현재 구조가 논리적으로는 충분하다. 다만 이 테스트 파일만 단독으로 읽는 사람 입장에서는 "1번째도 맞는지"가 암묵적 전제로 남는다.
  - 제안: 필수는 아니지만, `calls[0][2]`/`calls[1][2]` 를 동일 테스트 안에서 함께 단언하면 이 테스트가 완전히 self-contained 해지고 두 테스트 간 암묵적 의존을 없앨 수 있다.

- **[INFO]** 회귀 캐치 여부를 실제로 mutation 검증함 — 결과: 유효
  - 위치: `information-extractor.handler.ts:1027-1038` (`runTurnWithCollectionRetries` for(;;) 루프의 `params.llmContext` 전달부)
  - 상세: 리뷰 중 해당 라인을 임시로 "1번째 iteration 에서만 `params.llmContext` 전달, 이후는 `undefined`" 로 mutate 한 뒤 신규 테스트를 재실행 → 정확히 실패(`Received: undefined`)함을 확인했고, 원복 후 clean 상태(`git diff` 없음)를 재확인했다. 즉 diff 설명대로 "코드 무변경 + 회귀 고정 테스트만" 이 맞고, 테스트가 tautological 하지 않다.
  - 제안: 없음 (확인용 기록).

- **[INFO]** B4(typing-only) 3개 소비 사이트 각각의 기존 회귀 커버리지 확인 — 결과: 모두 존재
  - 위치: `ai-turn-executor.ts` `applyMultiTurnTurnMemory`(L2279 `resumeState`) / `processMultiTurnMessage` 메인 chat(L2509 기존 `resumeState` 재사용, L2621) / `executeProviderToolBatch` 호출 인자(L2714-2719)
  - 상세: `narrowResumeState` 는 `return state as ResumeState;` 순수 타입 단언(zod `.parse()` 미개입, `resume-state.schema.ts` 의 `.partial().catchall(z.unknown())` 확인) — 런타임 행위 불변이 코드로도 확인된다. 3개 사이트 모두 별도 spec 이 이미 attribution 을 직접 단언 중: `applyMultiTurnTurnMemory` → `ai-agent.memory.spec.ts:395`("multi-turn resume: summary 압축 chat …"), 메인 chat → `ai-turn-executor.spec.ts:445`("passes llmContext … to the resume-turn LLM chat"), tool-loop 2번째 chat(같은 resumeState 참조 경유) → `ai-turn-executor.spec.ts:520`. 세 spec 모두 로컬 재실행 통과(`ai-turn-executor.spec.ts` 31/31, `ai-agent.memory.spec.ts` 36/36, `information-extractor.handler.spec.ts` 36/36). 신규 테스트 미추가가 갭이 아님.
  - 제안: 없음 (확인용 기록).

- **[INFO]** 신규 테스트의 mock 설정이 인접 테스트(L994 `feeds tool_result back and loops …`)와 거의 동일 구조로 중복
  - 위치: `information-extractor.handler.spec.ts:1026-1039` vs `:994-1007`
  - 상세: `mockLlmService.chat.mockResolvedValueOnce(...).mockResolvedValueOnce(...)` 2-call 시퀀스가 두 테스트에서 값만 같고 그대로 반복된다. 기능상 문제는 없고(각 `it` 는 `beforeEach` 로 `mockLlmService` 재생성되어 격리됨), 가독성 관점에서 사소한 개선 여지만 있다.
  - 제안: 필요 시 `mockLlmService.chat.mockResolvedValueOnce(...).mockResolvedValueOnce(...)` 부분을 헬퍼로 뽑아 재사용 가능하나 현재 규모(2줄 헬퍼 함수쌍)에서는 추출 안 해도 무방.

## 요약
B3 신규 테스트(`collection-retry loop passes attribution ... to the 2nd retry chat too`)는 코드 변경 없이 기존 동작(`runTurnWithCollectionRetries` 의 `params.llmContext` 매 iteration 전파)을 회귀 고정하는 순수 테스트 추가이며, 리뷰 중 실제로 해당 전달 로직을 mutate 해 테스트가 정확히 실패함을 확인해 tautological 하지 않음을 검증했다. 기존 대칭 테스트(1번째 chat 단언 L921, ai_agent tool-loop 2번째 chat 단언 `ai-turn-executor.spec.ts:520`)와 네이밍·구조·의도 주석이 일관되고, `beforeEach` 재생성으로 테스트 간 격리도 안전하다. B4(타이핑 전용 리팩터)는 `narrowResumeState` 가 순수 타입 단언(zod parse 없음)이라 런타임 불변이 코드로 확인되며, 영향받는 3개 소비 사이트 모두 이미 존재하는 별도 spec(`ai-agent.memory.spec.ts:395`, `ai-turn-executor.spec.ts:445,520`)이 attribution 값을 직접 단언하고 있어 신규 테스트 부재가 커버리지 갭으로 이어지지 않는다. 발견된 항목은 모두 INFO 수준의 사소한 개선 제안(자기완결성·중복 축소)이며 차단 요소는 없다.

## 위험도
NONE
