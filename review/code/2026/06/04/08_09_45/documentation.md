# Documentation Review

## 발견사항

### [INFO] compactMessagesToTail 독스트링 — spec 참조 번호 불일치
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` L717 (JSDoc) 및 L1098 (exported function 실체)
- 상세: JSDoc 은 `spec §6.2 d.5 — followup-v2` 를 참조하나, spec 파일(`spec/4-nodes/3-ai/1-ai-agent.md`)에서 해당 기능은 `d.6` 으로 추가되었다. d.5 는 롤링 요약 압축(`buildSummaryBufferUpdate`) 항목으로, 물리 압축은 d.6 이다. 동일한 부정확 참조가 `ai-agent.handler.ts` L1317, L2317 인라인 주석에도 있다 (`── 멀티턴 누적 messages 물리 압축 (spec §6.2 d.5 — followup-v2) ──`).
- 제안: JSDoc 및 인라인 주석 모두 `spec §6.2 d.6` 으로 정정.

### [INFO] assertPairingIntact 내부 빈 루프 블록 — 주석 의도 모호
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts` L385–390
- 상세: 두 번째 `for` 루프 바디가 비어 있고 `// tool 메시지는 항상 직전 어딘가의 assistant.toolCalls 에 매칭되어야 함.` 주석만 있다. 코드를 읽는 사람이 이 루프가 의도적 noop 인지, 미완성인지, 실제 검증 로직이 생략된 것인지 구별하기 어렵다. `void openToolIds` 처리도 linter 억제 패턴이지만 이유 설명이 없다.
- 제안: 루프가 의도적 noop 임을 한 줄로 명시(`// intentional no-op: validation already performed in the assistant-branch loop above`). `void openToolIds` 는 `// suppress unused-variable lint — tracks open ids for potential future assertions` 등으로 설명.

### [INFO] injectMemoryContext 반환 타입 내 keepUserExchanges 문서가 두 위치에서 동일 복붙
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L836–1242 (private 메서드 시그니처) 및 L2175–2190 (인라인 타입 주석)
- 상세: 두 위치의 JSDoc 블록이 동일한 내용이다. 이는 중복이지만 오류는 아니다. 단, 메서드 시그니처의 반환 타입이 인라인 타입 리터럴이므로 JSDoc 을 한 곳(메서드 선언부)에 집중하는 것이 유지보수에 유리하다. 현재 상태는 관리 불일치 위험.

### [INFO] meta.memory.compactedMessages 필드 — 스펙 참조 주석 위치
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L2304–2308
- 상세: `compactedMessages` 인라인 JSDoc 이 있으나, `meta.memory` 전체 타입의 나머지 필드들(summarized, recalledCount, tokenBudgetUsed)에는 해당 필드를 설명하는 독스트링이 없다. 일관성 차원에서 다른 필드들도 JSDoc 보완이 바람직하나 critical 수준은 아니다.

### [INFO] plan 파일 spec 참조 — §12.14 추가 명시 누락
- 위치: `plan/in-progress/ai-context-memory-followup-v2.md` 내 완료 항목
- 상세: 완료 항목은 `spec §6.2 d.6` 을 언급하지만 신규 추가된 `spec §12.14` (Rationale 섹션) 는 언급하지 않는다. plan 에서 추적성 확인 시 단방향만 된다. 치명적이지는 않으나 spec 내 두 위치가 이 결정을 기록하므로 plan 에서도 두 번호 모두 참조하는 것이 바람직하다.

### [INFO] spec 변경 — §6.2 d.6 항목 내 `meta.memory.compactedMessages` 필드명 노출
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` L648, L3659
- 상세: spec 에 `meta.memory.compactedMessages` 가 명시되었고 구현에도 동일 필드가 존재한다. 다만 `§7 Config Echo` 에 memory 출력 필드 목록이 있다면 새 `compactedMessages` 필드를 거기에도 추가해야 일관성이 유지된다. 현재 diff 에서 §7 업데이트가 포함되지 않은 것으로 보인다. (파일 전체 컨텍스트가 truncate 되어 §7 이 이미 업데이트되었을 가능성이 있으므로 WARNING 이 아닌 INFO 등급.)

### [INFO] 테스트 파일 describe 블록 제목 — 한국어/영어 혼용 패턴
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts` L48, `ai-agent.memory.spec.ts` 전반
- 상세: 신규 추가 describe 블록 제목은 한국어(예: `'multi-turn 누적 messages 물리 압축 (페어링 보존)'`)로 작성되었고, 기존 블록 제목은 영어다. 문서 표준은 아니나 일관성 관점에서 언급한다. 프로젝트 전반에서 이미 혼용이 존재하므로 INFO 수준.

---

## 요약

이번 변경은 `compactMessagesToTail` 순수 함수 추가와 멀티턴 handler 배선으로 구성된다. 문서화 품질은 전반적으로 우수하다. 신규 공개 함수에 상세한 JSDoc(알고리즘 설명, 불변식, 방어 조건 포함)이 제공되었고, spec 문서에도 d.6 항목과 §12.14 Rationale 이 추가되었으며, plan 파일도 완료 상태로 갱신되었다. 주요 개선 여지는 JSDoc 및 인라인 주석에서 `spec §6.2 d.5` 와 `d.6` 의 참조 번호 불일치(신규 기능은 d.6 인데 d.5 로 기재)로, 이를 정정하면 spec 추적성이 완전해진다. 나머지 발견사항은 주석 명확성과 중복 제거 수준의 개선 제안이다.

## 위험도

LOW
