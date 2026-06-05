# 코드 리뷰 — 요구사항 충족 (A2: contextScope 세 노드 확장)

- 대상: `git diff 9e65f853..HEAD`
- 일시: 2026-06-05 14:05:22
- 검토자: requirement-reviewer (sub-agent)

---

## 검토 범위

A2 목표: `text_classifier` · `information_extractor` 에 `contextScope` 5필드 자동주입 확장.
확인 항목: (1) 5필드 실제 수신·주입 수행, (2) memoryStrategy 미누출, (3) spec 정합,
(4) single-turn + multi-turn 양쪽 주입, (5) 누락/엣지.

---

## 발견사항

### INFO — 기능 완전성: 5필드 schema 및 inject 정상 구현

- 위치: `text-classifier.schema.ts:93+4`, `information-extractor.schema.ts:117+4`
- 상세: 두 노드 모두 `buildConversationContextSchemaFields(orderStart)` 를 `gateOnManualMemoryStrategy` 없이 호출해 5필드(`contextScope`/`contextScopeN`/`contextInjectionMode`/`includeToolTurns`/`excludeFromConversationThread`)를 schema 에 추가한다. 공유 유틸 `injectConversationContext()` 가 두 핸들러의 LLM 호출 직전에 호출돼 thread 주입을 수행한다. `contextScope='none'`(기본값)이면 noop 으로 기존 동작 불변.

### INFO — memoryStrategy 범위 경계: 두 노드에 누출 없음

- 위치: `conversation-context-schema.ts:36-38`, `text-classifier.handler.ts`, `information-extractor.handler.ts`
- 상세: `memoryStrategy` 필드는 두 노드의 schema 에 없고, `buildConversationContextSchemaFields` 는 `gateOnManualMemoryStrategy=false`(기본) 로 호출돼 `visibleWhen:memoryStrategy` 가드가 붙지 않는다. handler 에서도 `memoryStrategy` 분기 로직이 전혀 호출되지 않는다. 경계 준수 정상.

### INFO — single-turn 주입: 두 노드 정상 구현

- 위치: `text-classifier.handler.ts:175-191`, `information-extractor.handler.ts:226-237`
- 상세: text_classifier 는 분류 LLM 호출 직전 1회, information_extractor(single_turn) 는 retry 루프 전 1회 주입해 모든 attempt 가 동일 messages 를 사용한다.

### INFO — information_extractor multi-turn 첫 진입 주입 정상

- 위치: `information-extractor.handler.ts:437-447`
- 상세: `executeMultiTurn` 에서 `inputField` 비어있을 때(`!inputField` 분기, line 413)는 주입 없이 `waiting_for_input` 반환 — 이는 의도적 설계(첫 사용자 메시지 대기). `inputField` 있을 때는 초기 messages 빌드 직후 1회 주입하고 `state.messages` 로 운반돼 후속 turn 에서 재주입하지 않는다. spec §5 "multi-turn 첫 진입 초기 messages 빌드 직후" 와 일치.

### INFO — self 노드 turn 제외: 정상

- 위치: `conversation-context-injection.ts:141-143`
- 상세: `getThreadExcludingNode(target, selfNodeId)` 가 `context.nodeId ?? ''` 를 selfNodeId 로 받아 자기 노드 turn 을 필터링한다. 테스트(`conversation-context-injection.spec.ts`, `text-classifier.thread.spec.ts`)에서도 검증됨.

### WARNING — meta.contextInjection echo: 두 노드 handler return 에 없음

- 위치: `text-classifier.handler.ts:494-502`, `text-classifier.handler.ts:577-585`, `information-extractor.handler.ts` 의 모든 return 블록
- 상세: spec `conversation-thread.md §5.3` 은 `meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 디버그 echo 를 세 노드 공통으로 정의한다. ai-agent 는 `meta.contextInjection: singleTurnInjection.injection` (line 1897) 및 `meta.contextInjection: multiTurnInjection.injection` (line 2105)로 echo 한다. text-classifier / information-extractor 는 `injected.injection` 결과 객체를 계산하지만 handler return 의 `meta` 블록에 `contextInjection` 키를 포함하지 않는다.
  - text-classifier spec(`spec/4-nodes/3-ai/2-text-classifier.md`)의 `meta.*` 표에 `meta.contextInjection` 행이 없고, information-extractor spec에도 없다. 그러나 공통 spec §5.3 과 conversation-thread.md §5.3 은 "세 노드 공통" 으로 디버그 echo 를 정의한다.
  - `contextScope='none'` 일 때 echo 필요 없음(ai-agent 도 `scope='none'`이면 미포함)은 spec 과 일치하나, `contextScope≠none` 인 실 사용 케이스에서 디버그 정보가 누락된다.
- 제안: 두 노드의 성공 path `meta` 에 `...(injected.injection.appliedScope !== 'none' ? { contextInjection: injected.injection } : {})` 추가. text-classifier 는 `processSingleLabelResult` / `processMultiLabelResult` private 메서드에서 meta 를 구성하므로 `injected.injection` 을 파라미터로 전달하거나 호출부 wrapper 에서 meta 에 추가한다. information-extractor 는 single-turn / multi-turn completed 의 meta 구성 지점에서 동일하게 추가.
  - 이 항목은 **기능 동작에 영향 없음** — 주입 자체는 완전히 작동한다. 디버깅·관찰성(observability) 누락 이슈.

### INFO — spec 갱신 정합성: 세 spec 문서 모두 갱신됨

- 위치: `spec/4-nodes/3-ai/0-common.md §10`, `spec/conventions/conversation-thread.md §2.3/§5`, `spec/4-nodes/3-ai/2-text-classifier.md §1/§3`, `spec/4-nodes/3-ai/3-information-extractor.md §1/§3`
- 상세: 공통 §10 은 세 노드 inject 확장·공유 유틸·memoryStrategy 경계를 정확히 기술. conversation-thread §2.3 의 "inject 적용 범위" 표가 "세 노드 동일"로 갱신됨. v7 로드맵 항목이 "채택 완료" 로 strikethrough. 두 노드 spec 에 5필드 행과 실행 단계 2.5/2.5 추가. 코드와 spec 이 선언 레벨에서 일치한다.

### INFO — [SPEC-DRIFT] `meta.contextInjection` echo 요구사항: text-classifier/information-extractor spec 에 행 없음

- 위치: `spec/4-nodes/3-ai/2-text-classifier.md §5.1 meta 표`, `spec/4-nodes/3-ai/3-information-extractor.md §5.1 meta 표`
- 상세: ai-agent spec §7.1 은 `meta.contextInjection` (object?) 행을 명시하고 (`1-ai-agent.md:519`), conversation-thread §5.3 도 "디버그 echo" 를 언급한다. 두 노드의 meta 표에는 이 행이 없다. 위 WARNING 과 연계 — 코드에서 echo 미구현이므로 spec 누락이 **코드 미구현을 정당화하는 것인지, spec 이 낡은 것인지**는 양면이다.
  - 현재 코드가 echo 를 빠뜨린 것이 WARNING 수준 구현 미비이며 spec 도 함께 보완이 필요하다.

### INFO — includeToolTurns: inject 측 필터링 없음 (설계 정합)

- 위치: `conversation-context-injection.ts`, `conversation-thread.service.ts:165-170`
- 상세: `includeToolTurns` 는 thread 에 ai_tool turn 을 **push** 할지 결정하는 게이트이며, **inject** 시 필터링 게이트가 아니다. `getThreadExcludingNode` 는 nodeId 기준 필터만 하므로 thread 에 이미 push 된 ai_tool turn 은 `contextScope=thread` 시 그대로 주입된다. text_classifier/information_extractor 는 ai_tool turn 을 push 하지 않으므로 실질 문제 없음. spec `0-common.md §10` 표 비고("push 측 영향 없음 — 주입 측 인터페이스 일관성용")가 이 설계를 명시적으로 정의한다. 기능 일치.

### INFO — 테스트 커버리지 충분

- 위치: `conversation-context-injection.spec.ts`, `text-classifier.thread.spec.ts:133+113`, `information-extractor.thread.spec.ts:107+119`
- 상세: 공유 유틸 단위 테스트(scope=none/thread/lastN, messages/system_text mode, self 제외, empty thread) + 두 노드 통합 테스트(inject 확인, regression none, self 제외) + information-extractor multi-turn 첫 진입 inject 확인. A2 요구 케이스가 테스트로 커버됨.

---

## 요약

A2 의 핵심 목표(text_classifier·information_extractor 에 contextScope 5필드 schema 추가 + 공유 주입 유틸 도입)는 완전히 구현돼 있다. memoryStrategy 는 두 노드에 누출되지 않았고, single-turn/multi-turn 양 경로에서 주입이 동작하며, self 제외·scope=none noop·empty thread noop 등 엣지 케이스도 코드와 테스트로 처리됐다. spec(공통 §10, conversation-thread §2.3/§5, 두 노드 개별 spec)도 세 노드 inject 확장으로 정확히 갱신됐다. 유일한 미비점은 두 노드 handler 의 `meta.contextInjection` echo 누락으로, 기능 동작에는 영향 없지만 관찰성(observability) 측면에서 WARNING 수준이다. 이 항목은 critical block 사유에 해당하지 않는다.

---

## 위험도

LOW

---

## BLOCK: NO
