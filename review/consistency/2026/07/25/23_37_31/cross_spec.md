# Cross-Spec 일관성 검토 — cross_spec

## 발견사항

- **[WARNING]** `node-cancellation.md` 가 chat-channel 을 "노드" 로 분류 — `1-data-model.md`/`15-chat-channel.md` 와 직접 모순
  - target 위치: `spec/conventions/node-cancellation.md` §1 (line 24) — "장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / **chat-channel** / 이커머스 통합 Cafe24·MakeShop)" / §6 구현 현황 표 (line 137) — "`chat-channel 노드 signal 전파` | — | 미구현 (Planned)"
  - 충돌 대상: `spec/1-data-model.md` §2.8 Trigger (line 230) — "type | Enum | webhook / schedule / manual (**chat-channel 은 별도 type 이 아니라 `webhook` 트리거의 `config.chatChannel` 변형**)" · `spec/5-system/15-chat-channel.md` CCH-AD-05 — 어댑터는 `executionEvents$` 를 **구독해 외부로 발송**하는 outbound listener 이며 노드 실행 컨텍스트를 갖지 않음
  - 상세: `node-cancellation.md` 는 chat-channel 을 "`context.abortSignal` 을 전파해야 할 외부 I/O 노드" 범주에 놓고 §6 표에 "미구현(Planned)" 행까지 두었다. 그러나 (1) `1-data-model.md` 의 Trigger 엔티티 정의(SoT)는 chat-channel 이 노드가 아니라 `webhook` 트리거의 `config` 변형이라고 명시하고, (2) `15-chat-channel.md`/`chat-channel-adapter.md` 의 시스템 정의(SoT)는 그 어댑터가 `NodeHandler.execute` 를 구현하는 소비자가 아니라 실행 이벤트를 **구독하는 outbound listener** 라고 명시하며, (3) 코드 실측(`codebase/backend/src/nodes/**` 전 카테고리 + `node-types.constants.ts`)에서도 `chat` 이름의 노드가 0건이고 `modules/chat-channel/**` 어댑터 코드에 `abortSignal`/`AbortSignal` 참조가 0건이다. 즉 target 문서의 분류 자체가 다른 두 SoT 문서·실제 코드와 동시에 어긋난다. 더구나 이번 diff 에서 `node-handler.interface.ts` 의 JSDoc(같은 오류를 복제하던 곳)은 `chat-channel` 을 목록에서 빼고 `Cafe24`/`MakeShop` 으로 정정했으므로(코드 쪽은 이미 수정 완료), 이제 코드 주석과 `node-cancellation.md` 본문이 서로 다른 이야기를 하는 상태다 — 이 PR 이 기존 잠재 모순을 더 뚜렷하게 만들었다. `plan/in-progress/node-cancellation-residual-signal-propagation.md`(§chat-channel 항목, won't-do 처리)와 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 (2026-07-25 #5)" 항목이 이미 이 범주 오류를 스스로 식별해 project-planner 위임을 명시해 두었다 — 즉 developer 자신이 spec 쓰기 권한이 없어 반영 못 하고 넘긴 항목이며, 본 검토는 이를 cross-spec 관점에서 재확인한다.
  - 제안: `spec/conventions/node-cancellation.md` §1 의 노드 나열에서 `chat-channel` 을 제거(코드 JSDoc 과 동일하게 `HTTP / DB / AI / Email / Cafe24 / MakeShop`)하고, §6 표의 `chat-channel 노드 signal 전파` 행을 삭제하거나 "노드 아님 — `webhook` 트리거 어댑터, cascade 대상 아님(outbound listener)" 으로 성격을 바꿔 기재. `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 가 이미 이 처분을 project-planner 대상으로 제안해 두었으므로, 다음 spec 갱신 시 두 plan 의 제안을 함께 반영.

## 요약

이번 diff 자체(코드 JSDoc 정정 + plan 갱신)는 다른 spec 영역과 충돌하지 않으며 오히려 기존 오류(코드 주석이 chat-channel 을 취소 신호 전파 대상 노드로 잘못 나열하던 것)를 바로잡았다. 다만 검토 범위인 `spec/conventions/node-cancellation.md` 자체는 여전히 §1·§6 에서 chat-channel 을 "노드" 로 분류하고 있어, 데이터 모델의 단일 SoT(`1-data-model.md` Trigger.type)와 시스템 동작 SoT(`15-chat-channel.md` CCH-AD-05)에 직접 모순된다. 이 모순은 이번 PR 이전부터 존재했으나, 코드 쪽 JSDoc 이 이번에 정정되면서 spec 문서만 뒤처진 상태로 남아 더 도드라졌다. developer 는 이를 이미 인지해 plan 문서에 project-planner 위임을 남겨 두었으므로, cross-spec 관점에서는 이 위임이 실제로 처리되도록(다음 spec 갱신 PR) 못 박는 것이 필요하다는 점 외에 추가로 발견된 신규 충돌은 없다.

## 위험도

MEDIUM
