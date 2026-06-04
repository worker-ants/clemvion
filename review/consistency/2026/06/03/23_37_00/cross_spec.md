# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md 주요 확인)
검토 모드: `--impl-done`, diff-base=origin/main

---

## 발견사항

### [WARNING] 0-common.md §10 의 push 적용 범위 기술이 conversation-thread.md §2.3 과 불일치

- target 위치: `spec/4-nodes/3-ai/0-common.md` §10 (Conversation Context), 첫 번째 문장
- 충돌 대상: `spec/conventions/conversation-thread.md` §2.3 (v1 적용 범위 — push vs inject 구분)
- 상세: 0-common.md §10 는 "v1 은 `ai_agent` 만 push + 자동 주입을 구현하고, `text_classifier` / `information_extractor` 는 동일 인터페이스로 v2 에 push hook (final assistant turn) + 자동 주입이 함께 추가된다"고 기술한다. 그러나 conversation-thread.md §2.3 및 §1.4 는 **push 가 이미 v1 에서 출하 완료**됐음을 명시한다 — `pushClassifierTurn` / `pushExtractorTurn` 가 `appendAiAssistantMessage` 를 호출하여 두 노드의 final assistant turn 이 thread 에 이미 누적된다. 즉 **push** 는 v1 완료, **자동 주입(contextScope inject)** 만 v2 로드맵이다. 0-common.md §10 은 이 두 동작을 묶어 모두 v2 로 예정인 것처럼 기술하고 있어 오인을 초래한다.
- 제안: 0-common.md §10 첫 문장을 "v1 은 `ai_agent` 의 push + 자동 주입이 구현됐고, `text_classifier` / `information_extractor` 의 **push (final assistant turn)** 도 v1 출하됐다 (`pushClassifierTurn` / `pushExtractorTurn`). 두 노드의 **자동 주입 (contextScope inject)** 만 v2 에 추가 예정 ([Spec Conversation Thread §2.3](../../conventions/conversation-thread.md#23-v1-적용-범위-push-vs-inject-구분))" 으로 수정.

---

### [INFO] 0-common.md §9 색인표의 info_extractor (multi) Waiting/Resumed 셀이 미완

- target 위치: `spec/4-nodes/3-ai/0-common.md` §9 (출력 구조 색인), `info_extractor (multi)` 행의 "Waiting / Resumed" 열
- 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md` §5.4, §5.5
- 상세: 색인표에서 `info_extractor (multi)` 의 Waiting/Resumed 셀은 `(Waiting/Resumed)` 라는 괄호 플레이스홀더로만 채워져 있으나, AI Agent 의 동일 셀은 `§7.4 (waiting_for_input) / §7.5 (resumed transient)` 로 명시적 링크가 있다. information-extractor.md §5.4, §5.5 가 해당 케이스를 정의하고 있으므로 색인 링크를 `§5.4 (waiting_for_input) / §5.5 (resumed)` 로 채워주는 것이 일관성상 권장된다.
- 제안: 0-common.md §9 표의 해당 셀을 `§5.4 (waiting_for_input) / §5.5 (resumed transient)` 로 업데이트.

---

### [INFO] 0-common.md §10 의 contextScope 관련 필드 기본값이 AI Agent §1 과 부분 중복 기술

- target 위치: `spec/4-nodes/3-ai/0-common.md` §10 필드 표
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §1 설정 표
- 상세: 두 문서가 동일한 5개 필드 (`contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`) 를 기본값과 함께 중복 정의하고 있다. 값은 일치하나 두 문서를 독립적으로 수정할 때 drift 위험이 있다. 또한 0-common.md §10 의 필드 표에는 `memoryStrategy` 가 포함되어 있으나 AI Agent 전용임이 비고 컬럼에 명시되어 있고, conversation-thread.md §5 는 해당 필드 열거 없이 5개 신규 필드만 나열하여 `memoryStrategy` 를 포함하지 않는다 — 이는 의도된 차이(contextScope 축 vs. 전략 축)이나 독자 혼란 가능성이 있다.
- 제안: 0-common.md §10 를 canonical 정의로 유지하고, AI Agent §1 의 해당 필드 설명에 "공통 §10 참조" 크로스-ref 를 강화. 실질 drift 는 없으므로 동기화 우선순위는 낮음.

---

### [INFO] information-extractor.md 설정 표에 contextScope 계열 필드 및 memoryStrategy 필드 미존재

- target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` §1 (설정)
- 충돌 대상: `spec/4-nodes/3-ai/0-common.md` §10 (Conversation Context — "AI 카테고리 3 노드 공통 규약")
- 상세: 0-common.md §10 는 "AI 카테고리 3 노드 공통 규약"으로 contextScope 계열 5필드와 memoryStrategy 를 정의한다. 그러나 information-extractor.md §1 의 설정 표에는 이 필드들이 없다. text-classifier.md §1 에도 마찬가지로 미존재. ai-agent.md §1 에는 전부 존재한다. v1 에서 inject 가 ai_agent 전용이라면 분류·추출 노드의 설정 표에 이 필드들이 없는 것이 당연하나, **push 는 이미 출하**됐으므로 `excludeFromConversationThread` 필드(thread 누적 opt-out)는 두 노드에도 해당하는 공통 설정이다. 현재 설정 표에 없으면 사용자가 opt-out 경로를 모를 수 있다.
- 제안: 최소한 `excludeFromConversationThread` 필드를 information-extractor.md, text-classifier.md 의 §1 설정 표에 추가 검토. 나머지 contextScope 계열 4필드 + memoryStrategy 는 v2 inject 도입 시점에 추가하는 것이 적절.

---

## 요약

`spec/4-nodes/3-ai/` target 영역은 전반적으로 연관 spec (`spec/conventions/node-output.md`, `spec/5-system/17-agent-memory.md`, `spec/conventions/interaction-type-registry.md`, `spec/1-data-model.md`) 과의 데이터 모델·API 계약·권한 모델·상태 전이 정합성이 잘 유지되어 있다. CRITICAL 수준의 직접 모순은 발견되지 않았다. 주요 발견사항은 `0-common.md §10` 의 push 완료 여부 기술이 `conversation-thread.md §2.3` 의 구현 완료 사실과 어긋나는 WARNING 1건이다 — push(`pushClassifierTurn`/`pushExtractorTurn`)는 v1 출하 완료, 자동 주입(contextScope)만 v2 로드맵임에도 0-common.md §10 은 둘을 묶어 v2 예정인 것처럼 기술해 혼선을 준다. 나머지는 색인 표 플레이스홀더 미완 및 공통 필드 노출 누락에 해당하는 INFO 수준이다.

---

## 위험도

LOW
