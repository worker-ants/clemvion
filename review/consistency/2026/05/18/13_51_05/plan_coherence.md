### 발견사항

- **[CRITICAL]** `ai-thread-source-mark.md` Open Question 에 대한 일방적 결정 (emission messages 격리)
  - target 위치: `spec/conventions/conversation-thread.md` §8.1 Rationale ("emit messages 를 conversation Preview 에서 격리한 이유"), §9.3 D4, §9.4, §9.2 ("3중 강제")
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` § Open Questions — "(Phase 3) injection 메시지를 UI conversation timeline 에 보여줄 것인지 vs 숨길 것인지. **잠정 결정**: 보여주되 turn 카운팅에서만 제외. inspector 에서 chip 으로 구분 표시는 추후 결정."
  - 상세: `ai-thread-source-mark.md` 는 "injection 메시지를 보여주되 turn 카운팅에서만 제외"를 **잠정 결정**으로 명시하고, chip 표시를 "Follow-up (별도 PR)"으로 미뤄 두었다. target 문서(§8.1, §9.3 D4, §9.4)는 이 잠정 결정을 "재검토"하여 **conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 교체하고 emit messages 는 LLM debug 패널 전용으로 격리**하기로 확정하고 있다. 또한 §9.2 에서 chip 표시를 "권장 → 필수(강제)"로 격상하며 "Follow-up" 분류를 폐기했다. 이 두 결정(소스 교체 + chip 강제화)은 `ai-thread-source-mark.md` 의 미해결 Open Question 을 plan 합의 없이 일방적으로 닫아버리는 것이다.
  - 제안: (a) `ai-thread-source-mark.md` 의 Open Question 항목을 "2026-05-18 conversation-thread 개정으로 결정됨" 으로 갱신하고 Phase 3/4 체크박스의 구현 방향을 동기화하거나, (b) target 문서가 해당 결정을 공식화하기 전에 plan 소유자(developer)와 합의를 먼저 수행해야 한다. Phase 2/3 구현이 아직 시작되지 않았으므로 지금 plan 을 먼저 갱신해 구현 방향을 재정의하는 것이 안전하다.

- **[CRITICAL]** `ai-thread-source-mark.md` Follow-up 의 chip 표시를 target 문서가 흡수·강제화하면서 Phase 3 체크박스와 충돌
  - target 위치: `spec/conventions/conversation-thread.md` §9.1 (source 별 시각 매핑 강제), §9.2 (3중 신호 강제), §8.1 Rationale 마지막 단락
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` § Follow-up (별도 PR) — "UI: 'injected context' chip 표시 — ConversationItem.isInjected === true 인 항목에 대해 ConversationInspector 가 시각적 구분(chip / 다른 배경색)을 추가. 본 PR 은 데이터 레이어까지만 다룬다."
  - 상세: plan 은 chip 표시를 명시적으로 "별도 PR" Follow-up 으로 분류했다. target 문서는 §9.1/§9.2 에서 source 별 아이콘·컨테이너 형식·chip 을 **현재 시점의 강제 규약**으로 선언했다. 이로 인해 Phase 3 체크박스 중 `ConversationItem.isInjected` 마커 추가 항목이 사실상 구현 범위 변경을 수반하게 되며, Phase 4 ("dev server 재현 확인") 기준도 달라진다. plan 의 "본 PR 은 데이터 레이어까지만 다룬다" 방침과 target 이 요구하는 UI 규약이 직접 충돌한다.
  - 제안: `ai-thread-source-mark.md` Phase 3/4 체크박스에 §9.1 규약 구현 항목을 추가하거나, plan Follow-up 항목을 "target 문서 §9 에서 정규 규약으로 격상됨 → 별도 PR 아닌 본 plan Phase 3 포함"으로 재분류해야 한다.

- **[WARNING]** `agent-session-restore-on-rejoin.md` 의 `parseHistoryMessages` 사용과 target §9.5 strip 규칙의 적용 범위 불일치
  - target 위치: `spec/conventions/conversation-thread.md` §9.5 (LLM-facing 마커의 UI strip) — "`threadTurnsToConversationItems`" 와 "`parseHistoryMessages` 의 history rebuild 경로"에 `/\[\/?user-input\]/g` strip 을 적용해야 한다고 명시
  - 관련 plan: `plan/in-progress/agent-session-restore-on-rejoin.md` § 구현 — "`apply-execution-snapshot.ts` 의 `ai_conversation` 분기에 `parseHistoryMessages` 를 활용한 hydration 로직 추가"
  - 상세: target 문서는 §9.5 에서 `parseHistoryMessages` 경로에도 `[user-input]…[/user-input]` strip 이 적용되어야 함을 정규 규약으로 명시했다. `agent-session-restore-on-rejoin` plan 은 이미 구현 완료([x] 표기)된 상태이나, plan 이 작성·구현될 당시에는 §9.5 의 strip 규칙이 이 정도로 명시화되어 있지 않았다. 구현된 `parseHistoryMessages` 경유 hydration 코드가 `[user-input]` 마커를 strip 하는지 여부가 target 신규 규약과 대조 검증되지 않은 상태다.
  - 제안: `agent-session-restore-on-rejoin.md` 의 Follow-up 항목에 "§9.5 strip 규칙 적합성 검증 — `parseHistoryMessages` 경유 hydration 경로에서 `[user-input]` 마커가 사용자에게 노출되지 않는지 확인"을 추가하거나, plan 완료 이동 전 별도 PR 에서 회귀 테스트를 보강한다.

- **[WARNING]** `ai-thread-source-mark.md` Phase 2 와 target 문서의 `[from <nodeLabel>]` prefix 정책 변경
  - target 위치: `spec/conventions/conversation-thread.md` §1.5 (영속·emit 형태) — "prefix 는 한 번 prepend 된 뒤 LLM 호출 messages history 의 일부로 누적되어 `output.result.messages` 에 함께 저장되고, WebSocket `ai_message.messages[]` / `waiting_for_input.conversationConfig.messages[]` 에도 그대로 emit 된다"
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Phase 2 체크박스 — "`handleAiMessageTurn` 의 `ai_message` emit 분기에서 `condMessages` 가 source 를 보존하도록 확인"
  - 상세: target 문서는 2026-05-18 CHANGELOG 에서 "§1.5 명확화 — `[from <nodeLabel>]` prefix 가 `output.result.messages` 와 emit messages 에 함께 영속되어 LLM history attribution 을 유지함을 명시 (기존 '미포함' 진술 정정)"로 §1.5 를 정정했다. `ai-thread-source-mark.md` Phase 2 의 `condMessages` source 보존 확인 체크박스는 이 §1.5 정정 이전의 이해를 바탕으로 작성됐을 가능성이 있다. Phase 2 구현 착수 전에 §1.5 변경된 의미(prefix 가 영속됨)를 Phase 2 구현 지침으로 반영해야 한다.
  - 제안: `ai-thread-source-mark.md` Phase 2 체크박스에 "§1.5 정정 반영 — prefix 는 output.result.messages 에도 영속되므로 condMessages 포함 여부 재확인" 주석을 추가한다.

- **[WARNING]** target 이 `text_classifier` / `information_extractor` 의 v2 push 정책을 미결로 두면서 `node-output-redesign` plan 과의 연계 누락
  - target 위치: `spec/conventions/conversation-thread.md` §2.3, §7 v2 로드맵 — "`text_classifier` / `information_extractor` 자동 push + 주입"을 v2 로드맵으로 명시
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` (및 information-extractor.md) — 이 두 노드의 output 구조 개선안을 담고 있으며, conversation thread 연동이 v2 시점에 확장될 예정임을 target 이 선언함
  - 상세: target §2.3 과 §7 은 `text_classifier` / `information_extractor` 의 ConversationThread 연동을 v2 범위로 확정했다. `node-output-redesign` plan 의 해당 노드 파일들은 이 v2 범위 결정을 참조하거나 후속 plan 연계를 명시하지 않고 있다. 양쪽이 독립적으로 해당 노드 개선을 진행할 경우, v2 ConversationThread push hook 추가 시점에 node-output-redesign 결과와 인터페이스 충돌이 발생할 수 있다.
  - 제안: `node-output-redesign/information-extractor.md` 와 `text-classifier.md` 에 "ConversationThread v2 연동 (conversation-thread §2.3) 을 고려해 final-assistant push 인터페이스와 §1.4 변환 규칙을 보존하는 방향으로 output 재설계"라는 주석을 추가한다.

- **[INFO]** `ai-thread-source-mark.md` §9 CHANGELOG 항목이 Phase 1 완료로 기록되어 있으나 target 문서의 §9 신규(2026-05-18) 변경으로 범위가 확장됨
  - target 위치: `spec/conventions/conversation-thread.md` §10 CHANGELOG — "2026-05-18 §9 미리보기 UI 렌더 규칙 신규" 항목
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Phase 1 [x] — "spec/conventions/conversation-thread.md — §5.1 보강 문단, §9 CHANGELOG 항목"
  - 상세: Phase 1 이 "완료" 처리된 시점(2026-05-16)에는 conversation-thread 의 §9 (미리보기 UI 렌더 규칙)가 존재하지 않았다. target 문서가 2026-05-18 에 §9 를 신규 추가했으므로 Phase 1 완료 체크박스의 scope 는 사실 부분 완료다. Phase 2/3 구현 시 §9 규약을 기준으로 삼아야 한다는 것을 plan 에 추적 메모로 남기는 것이 권장된다.
  - 제안: `ai-thread-source-mark.md` Phase 1 완료 항목 아래에 "NOTE: 2026-05-18 conversation-thread §9 신규 추가 — Phase 2/3 구현의 UI 규약 기준은 §9 를 따름" 메모를 추가한다.

- **[INFO]** `ai-agent-multiturn-waiting-persist.md` Follow-up 중 source 마커 영속 정책과 target §1.5/§1.6 의 연계
  - target 위치: `spec/conventions/conversation-thread.md` §1.5, §1.6
  - 관련 plan: `plan/in-progress/ai-agent-multiturn-waiting-persist.md` § Follow-up — "(옵션) spec/5-system/6-websocket-protocol.md §4.4.6 의 source 마커 영속 정책 결정과 함께, multi-turn 후속 turn 의 outputData 갱신 시점을 §4.4 또는 conversation-thread 컨벤션에 명시 — project-planner 위임 후보"
  - 상세: target 문서 §1.5 는 prefix 영속 정책을 정정·명시하고, §1.6 은 `[user-input]` 마커의 "LLM-facing 의무 + UI strip" 정책을 명문화했다. `ai-agent-multiturn-waiting-persist.md` 의 Follow-up 이 위임하려는 "source 마커 영속 정책 결정" 은 부분적으로 target 개정이 해소한 것이므로, 해당 Follow-up 의 잔여 범위를 재확인할 필요가 있다.
  - 제안: `ai-agent-multiturn-waiting-persist.md` Follow-up 항목에 "target conversation-thread §1.5/§1.6 (2026-05-18 정정) 이 부분 해소 — 잔여 범위: multi-turn 후속 turn 의 outputData 갱신 시점 명시만 미결" 로 좁혀 기술한다.

---

### 요약

`spec/conventions/conversation-thread.md` 의 2026-05-18 개정은 `plan/in-progress/ai-thread-source-mark.md` 의 Open Questions 와 Follow-up 을 plan 합의 없이 일방적으로 닫아버리고 있어 CRITICAL 등급 충돌이 2건 존재한다. 구체적으로 "injection 메시지 표시 정책(보여주되 turn 카운팅에서만 제외)" 을 잠정 결정한 plan 의 미해결 Open Question 을 target 이 "conversation Preview 에서 emit messages 완전 격리"로 뒤집고, chip 표시를 "Follow-up 별도 PR"에서 "현시점 강제 규약"으로 격상했다. Phase 2/3 구현이 아직 시작되지 않았으므로 코드 충돌은 발생하지 않았으나, plan 의 체크박스·구현 방향·범위 정의가 target 규약과 정합하지 않아 구현 착수 전에 plan 갱신이 필수적이다. 부수적으로 `agent-session-restore-on-rejoin` 구현의 `parseHistoryMessages` 경로가 target §9.5 strip 규칙과의 부합 여부를 확인받지 못했으며, `node-output-redesign` 의 information-extractor/text-classifier 개선안이 conversation-thread v2 연동 범위와 연계 없이 진행될 위험도 있다.

### 위험도

HIGH
