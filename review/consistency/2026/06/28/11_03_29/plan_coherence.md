## 발견사항

- **[WARNING]** spec §6 표의 MakeShop·Cafe24 추적 포인터가 완료된 plan 을 가리킴
  - target 위치: `spec/conventions/node-cancellation.md` §6 표 "MakeShop 노드 signal 전파" / "Cafe24 노드 signal 전파" 행의 비고 컬럼
  - 관련 plan: `plan/complete/node-cancellation-infrastructure.md` (완료 이동됨), `plan/in-progress/node-cancellation-inflight-followups.md`
  - 상세: 두 행 모두 `node-cancellation-infrastructure.md 추적` 이라고 명시하고 있으나, 해당 plan 은 2026-06-28 complete 폴더로 이동됐다. 더 중요한 점은, 현재 활성 pending plan(`node-cancellation-inflight-followups.md`)에 MakeShop·Cafe24 항목이 존재하지 않는다. infrastructure plan 의 본문을 확인해도 MakeShop·Cafe24 는 원래부터 scope 에 없었음이 확인된다(HTTP/AI/DB/Email/chat-channel 만 다룸). 즉 "Planned" 상태인 항목이 어느 활성 plan 에서도 추적되지 않는 추적 공백이 존재한다.
  - 제안: `node-cancellation-inflight-followups.md` 에 MakeShop·Cafe24 signal 전파 항목을 추가하거나, spec §6 표 비고를 `node-cancellation-inflight-followups.md 추적` 으로 교정해야 한다. (두 노드가 자체 `AbortController` 만 사용하고 `context.abortSignal` cascade 미구현임을 spec 이 이미 정확히 기술하고 있으므로, 추적 포인터만 현행화하면 된다.)

- **[WARNING]** spec §2.1 의 IE multi-turn resume abort 추적 포인터가 완료된 plan 을 가리킴
  - target 위치: `spec/conventions/node-cancellation.md` §2.1 Anthropic SDK 행 비고 `(node-cancellation-infrastructure.md)`
  - 관련 plan: `plan/complete/node-cancellation-infrastructure.md` (완료 이동됨), `plan/in-progress/parallel-p2-followups.md` §1
  - 상세: spec 은 "IE(`information-extractor`) 의 multi-turn resume/continuation 경로(`processMultiTurnMessage`)는 signal 미전파 — … turn 경계에서 abort 체크를 도입하는 별도 작업으로 추적 (`node-cancellation-infrastructure.md`)" 이라고 기술한다. 그러나 infrastructure plan 은 완료 이동됐으며, 완료 plan 내에서 이 resume 경로는 "by-design 미전파(`:876-877`)" 로 처리됐다. `parallel-p2-followups.md §1` 도 동일하게 `[~]` (by-design) 로 표기한다. 따라서 이 항목은 "별도 작업으로 추적 중인 미결"이 아니라 "설계 결정으로 best-effort 유예됨"에 해당한다.
  - 제안: spec §2.1 의 해당 괄호 설명을 "resume 경로는 by-design best-effort 유예 (abort context 부재 — `parallel-p2-followups.md §1` 기록)" 로 교정하거나, 실제로 이 경로를 구현하려면 `node-cancellation-inflight-followups.md` 에 별도 항목을 추가해야 한다. 현재 표현은 완료된 plan 을 활성 추적처로 가리켜 혼란을 야기한다.

- **[INFO]** spec §6 의 chat-channel 행 상태가 complete plan 의 N/A 결론과 불일치
  - target 위치: `spec/conventions/node-cancellation.md` §6 표 "chat-channel 노드 signal 전파" 행
  - 관련 plan: `plan/complete/node-cancellation-infrastructure.md` §6.2 체크박스
  - 상세: spec §6 표는 chat-channel 을 `—` (미구현 Planned) 으로 기술하나, infrastructure complete plan §6.2 는 "chat-channel 은 워크플로우 노드가 아니라 message-channel adapter — node signal 전파 대상 부재" 로 **N/A 처리**됐다. spec 이 이를 반영하지 않아 여전히 "해야 할 일"처럼 보인다.
  - 제안: spec §6 표 chat-channel 행 비고를 `N/A — chat-channel 은 workflow 노드가 아닌 message-channel adapter 로 signal 전파 대상 부재 (infrastructure plan 결론)` 로 갱신하면 혼란을 방지한다. plan 변경은 불필요.

## 요약

`spec/conventions/node-cancellation.md` 의 §2.1 및 §6 표에서 세 곳이 이미 complete 폴더로 이동한 `node-cancellation-infrastructure.md` 를 활성 추적 포인터로 참조하고 있다. MakeShop·Cafe24 의 signal 전파 구현은 어느 활성 in-progress plan 에도 등록되지 않아 실질적인 추적 공백이 생겼고(WARNING), IE resume 경로 abort 는 완료 plan 에서 by-design best-effort 로 처리됐음에도 spec 이 여전히 "별도 작업으로 추적 중"으로 표현해 혼란을 야기한다(WARNING). chat-channel 은 N/A 결론이 spec 에 미반영된 소항(INFO). 어느 충돌도 미해결 결정을 일방적으로 우회하거나 새 선행 조건을 깨지는 않으므로 CRITICAL 등급은 없다. 필요한 조치는 spec §2.1/§6 의 포인터 현행화와 `node-cancellation-inflight-followups.md` 에 MakeShop·Cafe24 항목 추가다.

## 위험도

MEDIUM
