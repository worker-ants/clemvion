# Plan 정합성 검토 — spec/5-system (chat-channel PATCH 토큰, --impl-prep)

## 발견사항

- **[WARNING]** §5.4.1 표 2행("트리거 활성화 PATCH") 서술의 미해소 불확실성이 spec 에 반영되지 않음
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 표 2번째 행 — *"트리거 활성화 (`PATCH /api/triggers/:id` body `{ isActive: true }`) | `setupChannel()` 재호출 — 기존 `botTokenRef` 그대로 사용 | token 변경 없음"* (및 §5.4.1.1 의 동형 행)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미해소(`[ ]`) 항목 *"§5.4.1 표 2행(활성화 PATCH 가 `setupChannel` 재호출)이 구현과 어긋날 수 있다"*
  - 상세: 그 plan 항목은 `update()` 가 `if (chatChannel)` 로 게이트돼 있어 순수 `isActive` 토글 호출부는 `chatChannel` 을 body 에 싣지 않으므로 **`setupChannel()` 재호출 자체가 일어나지 않을 수 있다**고 의심하고, "판정에 필요한 것: 활성화 시 provider webhook 재등록이 필요한지" 를 미확정으로 남겨 뒀다. 그런데 target 의 §5.4.1 표는 이 행을 캐비아트 없이 확정 사실처럼 서술한다 — 같은 조사 세션에서 발견된 자매 불확실성(`details.field` 값)은 "미확정 — 후속 e2e 확인 대기" placeholder 를 받았는데(§5.4.1·§5.4.1.1 rotation 행), 이 행만 placeholder 가 없어 다음 독자가 확정 사실로 오독할 위험이 있다.
  - 제안: `impl-chat-channel-patch-token.md` 는 이 행을 D-2 의 선례로 인용하지 않기로 이미 명시했으므로 이번 PR 의 구현 범위를 넓힐 필요는 없다. 다만 target 문서에 자매 항목과 동일한 형식의 "미확정" 캐비아트를 붙이거나, 최소한 plan 의 별도 판정 turn 을 기다린다는 cross-link 을 남겨 두는 것이 좋다.

- **[WARNING]** R-CC-21 산문 폭 정정 후속이 이 developer plan 안에만 존재 — 상위 트래커에 미등재
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1.1 하단 R-CC-21 — *"PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지 않는다."*
  - 관련 plan: `plan/in-progress/impl-chat-channel-patch-token.md` §"발견한 경계 — R-CC-21 산문이 구현보다 넓다 (planner 위임)" + 체크리스트 마지막 항목 `[ ] R-CC-21 산문 폭 정정을 planner 후속으로 등재`
  - 상세: 이 plan 은 R-CC-21 의 위 문장이 문맥상 주어(`botToken`·`inboundSigningPlaintext` 두 필드)를 넘어 Telegram 의 **server-issued** `inboundSigningRef` 축(매 `setupChannel` 호출마다 새로 발급·저장되는 값, §5.4.1.1 제목이 "slack/discord 한정"이라 스코프 밖에 두는 축)까지 포섭하는 것으로 오독될 수 있음을 정확히 발견했고, "이 턴에서 고치지 않는다"며 planner 턴으로 분리하기로 스스로 판단했다. 이 판단 자체는 자기-반증형 소정정 조건 1(developer 가 그 문장을 쓰지 않음) 미성립 근거로 타당하다. 그러나 현재 이 발견을 추적하는 문서는 `impl-chat-channel-patch-token.md` 자신뿐이다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` (이 CRITICAL 두 건의 origin 트래커이자 planner 소유 문서로, 아직 다수 미해소 `[ ]` 항목을 갖고 있음)에는 이 발견이 반영돼 있지 않다(grep 확인).
  - 제안: 이 plan 이 `plan/complete/` 로 이동하기 전에 (a) `spec-draft-nullable-notation-followups.md` 에 이 발견을 별도 항목으로 등재하거나, (b) 새 planner 소유 plan 파일을 만들어 cross-link 을 남긴다. 체크리스트 마지막 항목이 실제로 체크되지 않은 채 plan 이 종료되면 이 발견은 완료된 developer plan 속에 묻혀 다음 planner 턴이 찾기 어려워진다.

- **[INFO]** `details.field` 미확정 캡처 범위가 신규 필드로 좁게 등재돼 있음 — 기존 3필드도 같은 불확실성 대상
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 (`botToken`) · §5.4.1.1 (`inboundSigningPlaintext`/`inboundSigning`) 의 "미확정 — 후속 e2e 확인 대기" 캐비아트, 그리고 §5.4.1 의 `botTokenRef` 행("`details.field='botTokenRef'`", 캐비아트 없음)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 의 미해소 항목 *"§5.4.1 · §5.4.1.1 의 `details.field` 문면이 실제 페이로드와 다를 수 있다"* — 이 항목은 `CustomValidationPipe.flattenErrors` 가 중첩 경로(`chatChannel.botTokenRef` 형태)를 만들 가능성을 **`botTokenRef`·`inboundSigningRef`·`inboundSigning` 세 필드 전체**에 대해 제기했다.
  - 상세: `impl-chat-channel-patch-token.md` 체크리스트의 `details.field` 실제 페이로드 캡처 항목이 이번 PR 에서 새로 추가되는 두 필드(`botToken`·`inboundSigningPlaintext`)만 겨냥하는 것으로 읽힐 여지가 있다. 그러나 위 plan 항목은 기존 세 필드의 `details.field` 표기(`botTokenRef` 등, target 에는 캐비아트 없이 확정 서술)도 같은 의심 대상으로 명시한다.
  - 제안: 이번 PR 이 e2e 로 `details.field` 를 실측할 때 신규 2필드뿐 아니라 기존 `botTokenRef`/`inboundSigningRef`/`inboundSigning` 도 함께 캡처해, 한 번의 실측으로 target 문서 전체(§5.4.1 전 필드)의 캐비아트를 해소하는 편이 재작업을 줄인다.

## 요약

`plan/in-progress/impl-chat-channel-patch-token.md` (이번 --impl-prep 의 주체 plan)는 origin CRITICAL 두 건(`spec-draft-nullable-notation-followups.md`)의 처방을 D-1/D-2/D-3 설계로 정확히 계승하고, 사전 실측(5개 항목)으로 처방의 함정(`SecretResolver.rotate` 빈 값 가드 부재, 생성/수정 검증 함수 공유)까지 미리 확인해 두는 등 정합성 수준이 높다. `pending_plans` 로 걸린 세 v2 백로그(Discord Gateway·Slack Socket Mode·SSR PNG)는 PATCH/bot-token 로직과 무관해 충돌 없음을 확인했다. 다만 (1) developer 자신이 발견한 R-CC-21 산문 과잉폭 이슈가 이 plan 밖 어디에도 등재되지 않아 plan 종료 후 유실 위험이 있고, (2) target §5.4.1 표의 "활성화 PATCH" 행이 같은 조사 세션에서 제기된 불확실성을 캐비아트 없이 서술해 자매 항목과 표기 방식이 어긋나며, (3) `details.field` 실측 범위가 신규 필드에만 한정될 소지가 있다. 셋 다 이번 구현 착수를 막는 CRITICAL 은 아니고, 마무리 전 등재·캐비아트·실측범위 확장으로 해소 가능한 WARNING/INFO 수준이다.

## 위험도

MEDIUM
